define(["../buildControl", "../process", "../fileUtils"], function(bc, process, fileUtils) {
	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
		process.exec("cp", resource.src, resource.dest, function(code){
			if(code){
				bc.logError("failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"");
			}
			callback(resource, code);
		});
		return callback;
	};
});
