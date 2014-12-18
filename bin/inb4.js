#!/usr/bin/env node

/*
 * https://github.com/jacobk/werk
 *
 * Copyright (c) 2014 Jacob Kristhammar
 * Licensed under the MIT license.
 */

var util = require('util');
var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var LastFmNode = require('lastfm').LastFmNode;
var RSVP = require('rsvp');
var RateLimiter = require('limiter').RateLimiter;
var ProgressBar = require('progress');
var argv = require('minimist')(process.argv.slice(2));

// TODO: Usage
// from, to, key, group

var from = moment(argv.from || '2014-01-01');
var to = argv.to ? moment(argv.to) : moment();
var lastfm = new LastFmNode({
  api_key: argv.key
});
var limiter = new RateLimiter(1, 'second');
var members;
var stats = {};
var baseDir = '/tmp/';
var trackCount = 0;

console.log(util.format("Generating stats for period %s - %s",
  from.toISOString(), to.toISOString()));

function request(method, options) {
  return new RSVP.Promise(function(resolve, reject) {
    lastfm.request(method, _.defaults({
      handlers: {
        success: function(data) {resolve(data);},
        error: function(error) {reject(error.message);}
      }
    }, options));
  });
}

function genFilePath(prefix, suffix) {
  return util.format('%s%s-%s-%s-%s.json', baseDir, prefix, from.unix(),
    to.unix(), suffix);
}

function writeData(prefix, suffix, data) {
  var filePath = genFilePath(prefix, suffix);
  console.log('Writing', filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadData(prefix, suffix) {
  var filePath = genFilePath(prefix, suffix);
  if (fs.existsSync(filePath)) {
    return require(filePath);
  } else {
    return false;
  }
}

function handleError(reason) {
  console.error('Boom goes the dynamite: ' + reason);
  console.log(reason.stack);
}

function setup() {
  return request('group.getMembers', {group: argv.group}).then(function(data) {
    members = _.pluck(data.members.user, 'name');
    return true;
  });
}

function userGetRecentTracks(user) {
  console.log('Getting tracks for', user, '.');
  var options = {
    user: user,
    limit: 200,
    from: from.unix(),
    to: to.unix()
  };

  function getPageCount() {
    return request('user.getRecentTracks', options).then(function(data) {
      return parseInt(data.recenttracks['@attr'].totalPages, 10);
    });
  }

  function getPage(pageNumber) {
    // console.log('Getting recent track for user', user, 'page', pageNumber);
    return request('user.getRecentTracks', _.defaults({
      page: pageNumber
    }, options));
  }

  function getPages(pageCount) {
    console.log('Found', pageCount, 'pages.');
    return new RSVP.Promise(function(resolve, reject) {
      var format = 'Requesting ' + user + ' tracks [:bar] :percent :etas';
      var bar = new ProgressBar(format, { total: pageCount, width: 20 });
      var pages = [];
      _.times(pageCount, function(idx) {
        limiter.removeTokens(1, function(err, remaning) {
          pages.push(getPage(idx + 1));
          bar.tick();
          if (pages.length === pageCount) {
            resolve(RSVP.all(pages));
          }
        });
      });
    });
  }

  function collateArtists(recentTracksPages) {
    console.log('Collating artists for', user, 'found',
        recentTracksPages.length, 'promises');
    var artists = {}, name;
    _.each(recentTracksPages, function(page, idx) {
      writeData(user + 'Page', idx+1, page.recenttracks.track);
      _.each(page.recenttracks.track, function(track) {
        trackCount++;
        name = track.artist['#text'];
        if (!artists[name]) {
          artists[name] = 1;
        } else {
          artists[name]++;
        }
      });
    });

    writeData('userArtists', user, artists);

    return artists;
  }

  var cachedArtists = loadData('userArtists', user);

  if (cachedArtists) {
    console.log('Using cached artist list');
    return RSVP.resolve(cachedArtists);
  } else {
    return getPageCount()
      .then(getPages)
      .then(collateArtists);
  }
}

function getGroupArtists() {
  return new RSVP.Promise(function(resolve, reject) {
    var users = _.clone(members);
    var artists = {};

    function consumeUser() {
      var user = users.shift();
      if (!user) {
        return resolve(artists);
      }
      userGetRecentTracks(user).then(function(userArtists) {
        _.merge(artists, userArtists, function(a, b) {
          return a ? a + b : b;
        });
        consumeUser();
      }, reject);
    }

    consumeUser();
  });
}

function proccessArtists(artists) {
  writeData('groupArtists', argv.group, artists);
  return artists;
}


setup()
  .then(getGroupArtists)
  .then(proccessArtists)
  .then(function(artists) {
    console.log(JSON.stringify(artists, null, 2));
    console.log(trackCount);
  })
  .catch(handleError);