var Mocha = require("mocha"),
    path = require("path"),
    walk = require("walk");

global.__base = __dirname + "/";

var SCRIPTS_REGEX = /^test_[a-z0-9_]+\.js$/i;

var mocha = new Mocha,
    walker  = walk.walk(path.resolve(__dirname), { followLinks: false });

walker.on('file', function(root, stat, next) {
  if(SCRIPTS_REGEX.test(stat.name)) {
    mocha.addFile(path.join(root, stat.name));
  }
  next();
});

walker.on('end', function() {
  mocha.run(function(failures) {
    process.on("exit", function() {
      process.exit(failures);
    });
  });
});
