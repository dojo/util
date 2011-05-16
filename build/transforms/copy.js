define(["../buildControl", "../process", "../fileUtils", "dojo/has"], function(bc, process, fileUtils, has) {
	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
		var command= has("is-windows") ? "copy" : "cp";
		process.exec(command, resource.src, resource.dest, function(code, text){
			if(code){
				bc.logError("failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"");
				bc.logError(text);
			}
			callback(resource, code);
		});
		return callback;
	};
});
