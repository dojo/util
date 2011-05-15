define(["../fileHandleThrottle"], function(fht) {
	var spawn= require.nodeRequire("child_process").spawn;
	return {
		cwd:process.cwd,
		exit:process.exit,

		exec:function() {
			// signature is (command, arg1, ..., argn, callback)
			for(var command= arguments[0], args= [], i= 1; i<arguments.length-1; i++){
				args.push(arguments[i]);
			}
			var callback= arguments[i];
			fht.enqueue(function(){
				var
					text= "",
					process= spawn(command, args);
				process.on("exit", function(code){
					fht.release();
					callback && callback(code, text);
				});
				process.stdout.on("data", function(data){
					text+= data;
				});
				process.stderr.on("data", function(data){
					text+= data;
				});
			});
		},

		spawn:function(){
			console.log("ERROR: NOT IMPLEMENTED");
		}
	};
});

