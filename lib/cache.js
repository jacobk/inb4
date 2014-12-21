'use strict';

var fs = require('fs');
var util = require('util');
var baseDir = '/tmp/';

var cache = module.exports = {};

cache.genFilePath = function(prefix, suffix, from, to) {
  return util.format('%s%s-%s-%s-%s.json', baseDir, prefix, from.unix(),
    to.unix(), suffix);
};

cache.writeData = function(prefix, suffix, from, to, data) {
  var filePath = this.genFilePath(prefix, suffix, from, to);
  console.log('Writing', filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

cache.loadData = function(prefix, suffix, from, to) {
  var filePath = this.genFilePath(prefix, suffix, from, to);
  if (fs.existsSync(filePath)) {
    return require(filePath);
  } else {
    return false;
  }
};

cache.has = function(prefix, suffix, from, to) {
  var filePath = this.genFilePath(prefix, suffix, from, to);
  return fs.existsSync(filePath);
};