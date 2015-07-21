define([
	"../buildControl",
	"../process",
	"../fileUtils",
	"../fs",
	"dojo/has"
], function(bc, process, fileUtils, fs, has) {

	function copyFileWithFs(src, dest, cb) {
		if (has("is-windows")) {
			src = fileUtils.normalize(src);
			dest = fileUtils.normalize(dest);
		}
		fs.copyFile(src, dest, cb);
	}

	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
		var
			cb = function(code, text){
				callback(resource, code);
			},
			errorMessage = "failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"",
			args = has("is-windows") ?
				["cmd", "/c", "copy", fileUtils.normalize(resource.src), fileUtils.normalize(resource.dest), errorMessage, bc, cb] :
				["cp", resource.src, resource.dest, errorMessage, bc, cb];

		if (bc.useFsCopy) {
			copyFileWithFs(resource.src, resource.dest, cb);
			return callback;
		}

		process.exec.apply(process, args);
		return callback;
	};
});
