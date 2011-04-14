define(["../buildControl", "exec", "../fileUtils"], function(bc, exec, fileUtils) {
	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
		if (exec("cp", resource.src, resource.dest)) {
			bc.logError("failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"");
		}
		return 0;
	};
});
