/*jshint node:true */
define([
	"../../buildControl",
	"../../fs",
	"./stripConsole",
	"dojo/_base/lang",
	"./uglify_worker",
	"require"
], function(bc, fs, stripConsole, lang, uglify, require){
	if(!uglify){
		throw new Error("Unknown host environment: only nodejs is supported by uglify optimizer.");
	}

	if(bc.multiprocess){
		var nodeReq = require.nodeRequire,
			processes = [],
			cpus = bc.multiprocess < 0 ? nodeReq('os').cpus().length : bc.multiprocess,
			fork = nodeReq("child_process").fork,
			proc, jobs = {}, currentIndex = 0, queue = [],
			worker = require.toUrl("./uglify_worker.js");
		//bc.log("Using multiprocess="+cpus);
		for(var i = 0; i < cpus; i++){
			proc = fork(worker);
			proc.on("message", function(data){
				if(jobs[data.dest]){
					var func = jobs[data.dest];
					delete jobs[data.dest];
					func(data);
				}
			});
			processes.push(proc);
		}
	}

	return function(resource, text, copyright, optimizeSwitch, callback){
		copyright = copyright || "";

		var options = bc.optimizeOptions || {};

		if(optimizeSwitch.indexOf(".keeplines") > -1){
			options.gen_options = options.gen_options || {};
			options.gen_options.beautify = true;
			options.gen_options.indent_level = 0; //don't indent, just keep new lines
		}
		if(optimizeSwitch.indexOf(".comments") > -1){
			throw new Error("'comments' option is not supported by uglify optimizer.");
		}

		var handleResult = function(data){
			try{
				if(data.error){
					throw data.error;
				}
				var result = copyright + "//>>built" + bc.newline + data.text;

				fs.writeFile(resource.dest, result, resource.encoding, function(err){
					if(err){
						bc.log("optimizeFailedWrite", ["filename", resource.dest]);
					}
					callback(resource, err);
				});
			}catch(e){
				bc.log("optimizeFailed", ["module identifier", resource.mid, "exception", e + ""]);
				callback(resource, 0);
			}
		};

		if(bc.multiprocess){
			jobs[resource.dest] = handleResult;
			processes[currentIndex].send({text: stripConsole(text),
				options: options, src: resource.src, dest: resource.dest});
			currentIndex = (currentIndex+1) % processes.length;
		} else {
			process.nextTick(function(){
				handleResult({text: uglify(stripConsole(text), options)});
			});
		}

		return callback;
	};
});
