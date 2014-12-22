'use strict';

var fs = require('fs');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var async = require('async');
var _ = require('lodash');
var RSVP = require('rsvp');

function Storage(filePath) {
  this._users = {};
  var db = this.db = new sqlite3.Database(filePath);
}
module.exports = Storage;

Storage.prototype.init = function() {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    var ddl = fs.readFileSync(path.join(__dirname, '../db/inb4_01.sql')).toString();
    var stmts = _.map(ddl.split(/^\n/m), function(stmt) {
      return function(cb) { self.db.run(stmt, cb); };
    });
    async.series(stmts, resolve);
  });
};

// play := {
//   user:
//   date:
//   track: {name: mbid:}
//   artist: {name: mbid:}
//   album: {name: mbid:}
// }
Storage.prototype.addPlay = function(play, callback) {
  var self = this;

  function get_artist() {
    return self.find_or_create_artist(play.artist);
  }

  function get_album(artist) {
    var albumInfo = _.assign({artist_id: artist.id}, play.album);
    return self.find_or_create_album(albumInfo);
  }

  function get_track(album) {
    var trackInfo = _.assign({
      artist_id: album.artist_id,
      album_id: album.id
    }, play.track);
    return self.find_or_create_track(trackInfo);
  }

  function addTrack(track) {
    return self.addPlayForTrack(play, track);
  }

  function add(track) {
    if (track) {
      return addTrack(track);
    } else {
      return get_artist()
        .then(get_album)
        .then(get_track)
        .then(addTrack);
    }

  }

  return self.find('tracks', play.track)
    .then(add)
    .then(callback);

};

Storage.prototype.addPlayForTrack = function(play, track) {
  var self = this;
  return self.find_or_create_user(play.user)
    .then(function(user) {
      var stmt = 'INSERT INTO plays (user_id, track_id, date) VALUES (?,?,?)';
      return self.do('run', stmt, user.id, track.id, play.date);
    });
};

Storage.prototype.find_or_create_artist = function(info) {
  var cols = ['name', 'mbid'];
  return this.find_or_create('artists', cols, info);
};

Storage.prototype.find_or_create_album = function(info) {
  var cols = ['name', 'mbid', 'artist_id'];
  return this.find_or_create('albums', cols, info);
};

Storage.prototype.find_or_create_track = function(info) {
  var cols = ['name', 'mbid', 'artist_id', 'album_id'];
  return this.find_or_create('tracks', cols, info);
};

Storage.prototype.find_or_create = function(tbl, cols, info) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    function find() {
      return self.find(tbl, info);
    }

    function create_if_needed(row) {
      var sel = '('+cols.join(',')+')';
      var marks = '('+_.map(cols, function() {return '?';}).join(',')+')';
      var vals = _.map(cols, function(col) {return info[col];});
      if (row) {
        return row;
      }
      return self.do('run', 'INSERT INTO '+tbl+' '+sel+' VALUES '+marks, vals)
        .then(find);
    }

    find()
      .then(create_if_needed)
      .then(resolve)
      .catch(reject);
  });
};

Storage.prototype.find = function(tbl, info) {
  var stmt, params;
  if (info.mbid) {
    stmt = 'SELECT * FROM '+tbl+' WHERE mbid = ?';
    params = [info.mbid];
  } else {
    stmt = 'SELECT * FROM '+tbl+' WHERE name = ?';
    params = [info.name];
  }
  return this.do('get', stmt, params);
};

Storage.prototype.find_or_create_user = function(username) {
  var self = this;
  var cachedUser = self._users[username];
  if (cachedUser) {
    return RSVP.resolve(cachedUser);
  }
  return new RSVP.Promise(function(resolve, reject) {
    function find() {
      return self.do('get', 'SELECT id, name FROM users WHERE name = ?', username)
        .then(function(user) {
          self._users[username] = user;
          return user;
        });
    }

    function create_if_needed(user) {
      if (user) {
        return user;
      }
      return self.do('run', 'INSERT INTO users (name) VALUES (?)', username)
        .then(find);
    }

    find()
      .then(create_if_needed)
      .then(resolve)
      .catch(reject);
  });

};

Storage.prototype.do = function() {
  var self = this;
  var args = Array.prototype.slice.call(arguments);
  // The first arg is the sqlite3 method to apply
  var method = args.shift();

  return new RSVP.Promise(function(resolve, reject) {
    // Add sqlite callback to args
    args.push(function(err, row) {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
    self.db[method].apply(self.db, args);
  });

};