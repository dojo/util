define(["../fileHandleThrottle"], function(fht) {
	var fs= require.nodeRequire("fs");
	var path = require.nodeRequire("path");
	return {
		statSync:fs.statSync,
		mkdirSync:fs.mkdirSync,
		readFileSync:fs.readFileSync,
		readdirSync:fs.readdirSync,

		readFile: function(filename, encoding, cb) {
			fht.enqueue(function(){
				fs.readFile(filename, encoding, function(code){
					fht.release();
					cb.apply(null, arguments);
				});
			});
		},
		isAbsolute: function(filename) {
			var fileToCheck = fs.realpathSync(filename);
			var normalizedPath = path.normalize (filename);
			return (fileToCheck == normalizedPath);
		},
		writeFile: function(filename, contents, encoding, cb) {
			fht.enqueue(function(){
				fs.writeFile(filename, contents, encoding, function(code){
					fht.release();
					cb.apply(null, arguments);
				});
			});
		}

	};
});
