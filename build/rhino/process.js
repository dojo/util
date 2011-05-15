define([], function() {
	return {
		cwd:function() {
			return environment["user.dir"];
		},

		exit:function(resultCode) {
			// no documented way to return an exit code in rhino
			if (resultCode) {
				throw new Error("exit with result code: " + resultCode);
			}
			quit();
		},

		exec:function() {
			// signature is (command, arg1, ..., argn, callback)
			for(var args= [], i= 0; i<arguments.length-1; i++){
				args.push(arguments[i]);
			}
			arguments[i](runCommand.apply(this, args));
		},

		spawn:function(){
			console.log("ERROR: NOT IMPLEMENTED");
		}
	};
});
