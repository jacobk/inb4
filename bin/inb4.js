#!/usr/bin/env node

/*
 * https://github.com/jacobk/werk
 *
 * Copyright (c) 2014 Jacob Kristhammar
 * Licensed under the MIT license.
 */

'use strict';

var RSVP = require('rsvp');
var argv = require('minimist')(process.argv.slice(2));

var help = require('../lib/helpers');

if (argv._.length === 0) {
  help.printUsage();
  process.exit(1);
}

var cmdName = argv._[0].toLowerCase();
var cmd;

try {
  cmd = require('../lib/cmds/' + cmdName);
} catch(e) {
  process.exit(1);
}

cmd();

RSVP.on('error', function(reason) {
  console.error('RSVP error');
  if (reason.stack) {
    console.error(reason.stack);
  } else {
    console.error(JSON.stringify(reason));
  }
});

