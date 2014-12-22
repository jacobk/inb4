var _ = require('lodash');
var argv = require('minimist')(process.argv.slice(2));
var async = require('async');
var moment = require('moment');
var ProgressBar = require('progress');
var RSVP = require('rsvp');
var util = require('util');

var help = require('../helpers');
var Storage = require('../storage');
var API = require('../api');
var dbPathDefault = '/tmp/inb4.sqlite3';

var spec = {
  cmd: 'build',
  desc: 'Build local database with last.fm stats',
  args: {
    '--db   ': 'FQPN to sqlite3 db to write (default: '+dbPathDefault+')',
    '--from ': 'Cut off date to start at (default: start of current year)',
    '--to   ': 'Cut off date to stop at (default: current date)',
    '--key  ': 'Last.fm API key (required)',
    '--group': 'Last.fm group name (required)'
  }
};

var dbPath = argv.db || dbPathDefault;
var from = moment(argv.from || '2014-01-01').startOf('day');
var to = (argv.to ? moment(argv.to) : moment()).endOf('day');
var key = argv.key || help.missingArg('--key', spec);
var group = argv.group || help.missingArg('--group', spec);

function handleError(reason) {
  console.log('Build failed', reason);
  if (reason.stack) {
    console.log(reason.stack);
  }
}

module.exports = function() {
  console.log(util.format("Generating stats for period %s - %s",
    from.toISOString(), to.toISOString()));

  var storage = new Storage(dbPath);
  var api = new API(key, group);

  storage.init().then(function() {
    api.getGroupTracks(from, to)
      .then(function(groupTracks) {
        var trackCount = _.reduce(groupTracks, function(acc, tracks) {
          return acc + tracks.length;
        }, 0);

        var format = 'Adding plays [:bar] :percent';
        var bar = new ProgressBar(format, { total: trackCount, width: 20 });

        async.series(_.map(groupTracks, function(tracks, user) {
          return function(gcb) {

            console.log(' processing user', user);
            async.series(_.chain(tracks)
              .reject(function(track) {
                return track['@attr'] && track['@attr'].nowplaying;
              })
              .map(function(track) {
                var play = {
                  user: user,
                  date: parseInt(track.date.uts, 10),
                  track: {mbid: track.mbid, name: track.name},
                  artist: {mbid: track.artist.mbid, name: track.artist['#text']},
                  album: {mbid: track.album.mbid, name: track.album['#text']}
                };
                return function(cb) {
                  bar.tick();
                  return storage.addPlay(play, cb);
                };
              })
              .value(), gcb
            );

          };
        }));

      })
      .catch(handleError);
  });
};