'use strict';

var util = require('util');

var _ = require('lodash');
var LastFmNode = require('lastfm').LastFmNode;
var ProgressBar = require('progress');
var RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 'second');
var RSVP = require('rsvp');

var cache = require('./cache');


function API(key, group) {
  this.key = key;
  this.group = group;
  this.members = null;
  this._client = new LastFmNode({
    api_key: this.key
  });
}
module.exports = API;

API.prototype.request = function(method, options) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    self._client.request(method, _.defaults({
      handlers: {
        success: function(data) {resolve(data);},
        error: function(error) {reject(error.message);}
      }
    }, options));
  });
};

API.prototype.setup = function() {
  console.log('Setting up Last.fm client');
  var self = this;
  if (self.members) {
    return RSVP.resolve(self.members);
  } else {
    console.log('Getting group members for group', self.group);
    return self.request('group.getMembers', {group: self.group})
      .then(function(data) {
        self.members = _.pluck(data.members.user, 'name');
        console.log('Found', self.members.length, 'member(s)');
        return self.members;
      });
  }
};

API.prototype.userGetRecentTracks = function(user, from, to) {
  console.log('Getting tracks for', user, '.');
  var self = this;
  var options = {
    user: user,
    limit: 200,
    from: from.unix(),
    to: to.unix()
  };

  function getPageCount() {
    return self.request('user.getRecentTracks', options).then(function(data) {
      // Meta data is top level instead of @attr when no recent tracks
      var meta = (data.recenttracks['@attr'] || data.recenttracks);
      return parseInt(meta.totalPages, 10);
    });
  }

  function loadCachedPage(pageNumber) {
    return cache.loadData('trackpage.'+user, pageNumber, from, to);
  }

  function isCachedPage(pageNumber) {
    return cache.has('trackpage.'+user, pageNumber, from, to);
  }

  function getPage(pageNumber) {
    return self.request('user.getRecentTracks', _.defaults({
      page: pageNumber
    }, options));
  }

  function getPages(pageCount) {
    console.log('Found', pageCount, 'pages.');
    if (pageCount === 0) {
      return RSVP.resolve([]);
    }
    return new RSVP.Promise(function(resolve, reject) {
      var format = 'Requesting ' + user + ' tracks [:bar] :percent :etas';
      var bar = new ProgressBar(format, { total: pageCount, width: 20 });
      var pages = [];
      var page;

      function progress(page) {
        pages.push(page);
        bar.tick();
        if (pages.length === pageCount) {
          resolve(RSVP.all(pages));
        }
      }

      _.times(pageCount, function(idx) {
        var pageNumber = idx + 1;
        if (isCachedPage(pageNumber)) {
          page = RSVP.resolve(loadCachedPage(pageNumber));
          progress(page);
        } else {
          limiter.removeTokens(1, function(err, remaning) {
            page = getPage(idx + 1);
            progress(page);
          });
        }
      });

    });
  }

  function processPages(recentTracksPages) {
    return _.chain(recentTracksPages)
      .map(function(rawPage, idx) {
        cache.writeData('trackpage.'+user, idx+1, from, to, rawPage);
        return rawPage.recenttracks.track;
      })
      .flatten(true)
      .value();
  }

  return getPageCount()
    .then(getPages)
    .then(processPages)
    .then(function(tracks) {
      console.log('Found', tracks.length, 'track(s) for', user);
      return tracks;
    });
};

API.prototype.getGroupTracks = function(from, to) {
  var self = this;
  console.log('Getting getGroupTracks for', self.group);

  var cacheHit = cache.loadData('grouptracks.', self.group, from, to)
  if (cacheHit) {
    console.log('Returning cached grouptracks');
    return RSVP.resolve(cacheHit);
  }

  function getTracks(members) {
    return new RSVP.Promise(function(resolve, reject) {
      var users = _.clone(members);
      var groupTracks = {};

      function consumeUser() {
        var user = users.shift();
        if (!user) {
          return resolve(groupTracks);
        }
        self.userGetRecentTracks(user, from, to).then(function(tracks) {
          groupTracks[user] = tracks;
          consumeUser();
        }, reject);
      }

      consumeUser();
    });
  }

  function processTracks(tracks) {
    cache.writeData('grouptracks.', self.group, from, to, tracks);
    return tracks;
  }

  return self.setup()
    .then(getTracks)
    .then(processTracks);
};