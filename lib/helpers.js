var _ = require('lodash');

var helpers = module.exports = {};

helpers.missingArg = function missingArg(arg, spec) {
  console.log('Required arg', arg, 'missing');
  console.log();
  helpers.printUsage(spec);
  process.exit(1);
};

helpers.printUsage = function(spec) {
  var lines = ['usage: inb4 '];
  if (!spec) {
    lines.push('<command>');
  } else {
    lines.push(spec.cmd);
    lines.push('\n\n');
    lines.push(spec.desc + '\n');
    _.each(spec.args, function(desc, arg) {
      lines.push('  ' + arg + ' ' + desc + '\n');
    });
  }
  console.error(lines.join(''));
};
