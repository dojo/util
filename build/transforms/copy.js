define(["../buildControl", "exec", "../fileUtils"], function(bc, exec, fileUtils) {
	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
        var complete= false;
		exec("cp", resource.src, resource.dest, function(code){
			complete= true;
			if(code){
				bc.logError("failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"");
			}
		});
		return complete ? 0 : callback;
	};
});
