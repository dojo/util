define(["../buildControl", "exec", "../fileUtils"], function(bc, exec, fileUtils) {
	return function(resource, callback) {
		fileUtils.ensureDirectoryByFilename(resource.dest);
        var
			complete= false,
			result,
			finish= function(code){
				complete= true;
				result= code;
			};
		exec("cp", resource.src, resource.dest, function(code){
			if(code){
				bc.logError("failed to copy file from \"" + resource.src + "\" to \"" + resource.dest + "\"");
			}
			finish(code);
		});
		if(!complete){
			finish= function(code){
				callback(resource, code);
			};
		}
		return complete ? result : callback;
	};
});
