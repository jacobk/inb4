#!/usr/bin/env node

/*
 * https://github.com/jacobk/werk
 *
 * Copyright (c) 2014 Jacob Kristhammar
 * Licensed under the MIT license.
 */

'use strict';

var util = require('util');
var path = require('path');
var _ = require('lodash');
var moment = require('moment');
var RSVP = require('rsvp');
var async = require('async');
var argv = require('minimist')(process.argv.slice(2));
var ProgressBar = require('progress');

var Storage = require('../lib/storage');
var API = require('../lib/api');

// TODO: Usage
// from, to, key, group

var dbPath = argv.db || '/tmp/inb4.sqlite3';
var from = moment(argv.from || '2014-01-01').startOf('day');
var to = (argv.to ? moment(argv.to) : moment()).startOf('day');

console.log(util.format("Generating stats for period %s - %s",
  from.toISOString(), to.toISOString()));

function handleError(reason) {
  console.error('Boom goes the dynamite: ' + reason);
  console.log(reason.stack);
}

RSVP.on('error', handleError);

// COMMAND
// NB. Index needs to be rebuilt if users are added/removed from group
//
// - build [--from ] [--to] --key --group [default from=overall] [default to=now]

var storage = new Storage(dbPath);
var api = new API(argv.key, argv.group);

storage.init()
  .then(function() {
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