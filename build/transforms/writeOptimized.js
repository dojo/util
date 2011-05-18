define(["../buildControl", "../process", "../fs", "../fileUtils", "dojo/has", "dojo"], function(bc, process, fs, fileUtils, has, dojo) {

	// default to a no-op
	var compile= function(){};

	if(has("host-rhino") && (bc.optimize || bc.layerOptimize)){
		function sscompile(text, dest, optimizeSwitch, copyright){
			// decode the optimize switch
			var
				options= optimizeSwitch.split("."),
				comments= 0,
				keepLines= 0,
				strip= null;
			while(options.length){
				switch(options.pop()){
				case "normal":
					strip= "normal";
					break;
				case "warn":
					strip= "warn";
					break;
				case "all":
					strip= "all";
					break;
				case "keeplines":
					keepLines= 1;
					break;
				case "comments":
					comments= 1;
					break;
				}
			}

			//Use rhino to help do minifying/compressing.
			var context = Packages.org.mozilla.javascript.Context.enter();
			try{
				// Use the interpreter for interactive input (copied this from Main rhino class).
				context.setOptimizationLevel(-1);

				if(comments){
					//Strip comments
					var script = context.compileString(text, dest, 1, null);
					text = new String(context.decompileScript(script, 0));

					//Replace the spaces with tabs.
					//Ideally do this in the pretty printer rhino code.
					text = text.replace(/    /g, "\t");
				}else{
					//Apply compression using custom compression call in Dojo-modified rhino.
					text = new String(Packages.org.dojotoolkit.shrinksafe.Compressor.compressScript(text, 0, 1, strip));
					if(!keepLines){
						text = text.replace(/[\r\n]/g, "");
					}
				}
			}finally{
				Packages.org.mozilla.javascript.Context.exit();
			}
			return copyright + text;
		}

		var JSSourceFilefromCode, closurefromCode, jscomp= 0;
		function ccompile(text, dest, optimizeSwitch, copyright){
			if(!jscomp){
				// don't do this unless demanded...it may not be available
				JSSourceFilefromCode=java.lang.Class.forName('com.google.javascript.jscomp.JSSourceFile').getMethod('fromCode',[java.lang.String,java.lang.String]);
				closurefromCode = function(filename,content){
					return JSSourceFilefromCode.invoke(null,[filename,content]);
				};
				jscomp = com.google.javascript.jscomp;
			}
			//Fake extern
			var externSourceFile = closurefromCode("fakeextern.js", " ");

			//Set up source input
			var jsSourceFile = closurefromCode(String(dest), String(text));

			//Set up options
			var options = new jscomp.CompilerOptions();
			options.prettyPrint = optimizeSwitch.indexOf(".keepLines") !== -1;

			var FLAG_compilation_level = jscomp.CompilationLevel.SIMPLE_OPTIMIZATIONS;
			FLAG_compilation_level.setOptionsForCompilationLevel(options);
			var FLAG_warning_level = jscomp.WarningLevel.DEFAULT;
			FLAG_warning_level.setOptionsForWarningLevel(options);

			//Run the compiler
			var compiler = new Packages.com.google.javascript.jscomp.Compiler(Packages.java.lang.System.err);
			var result = compiler.compile(externSourceFile, jsSourceFile, options);
			return copyright + compiler.toSource();
		}

		compile= function(resource, text, copyright, optimizeSwitch, callback){
			bc.logInfo("optimizing " + resource.dest);
			var result;
			if(/closure/.test(optimizeSwitch)){
				result= ccompile(stripConsoleRe ? text.replace(stripConsoleRe, "0 && $&") : text, resource.dest, optimizeSwitch, copyright);
			}else{
				result= sscompile(text, resource.dest, optimizeSwitch, copyright);
			}
			fs.writeFile(resource.dest, result, resource.encoding, function(err){
				if(err){
					bc.logError("failed to write optimized file (" + result.dest + ")");
				}
				callback(resource, err);
			});
			return callback;
		};
	}

	if(has("host-node") && (bc.optimize || bc.layerOptimize)){
		// start up a few processes to compensate for the miserably slow closure compiler
		bc.optimizerOutput= "";
		var
			processesStarted= 0,
			totalOptimizerOutput= "",
			nextProcId= 0,
			sendJob= function(src, dest, optimizeSwitch, copyright){
				processes[nextProcId++].write(src, dest, optimizeSwitch, copyright);
				nextProcId= nextProcId % bc.maxOptimizationProcesses;
			},
			tempFileDirs= {},
			doneRe= new RegExp("^Done\\s\\(compile\\stime.+$", "m"),
			optimizerRunner= require.nameToUrl("build/optimizeRunner.js"),
			buildRoot= optimizerRunner.match(/(.+)\/build\/optimizeRunner\.js$/)[1],
			javaClasses= fileUtils.catPath(buildRoot, "closureCompiler/compiler.jar") + ":" + fileUtils.catPath(buildRoot, "shrinksafe/js.jar") + ":" + fileUtils.catPath(buildRoot, "shrinksafe/shrinksafe.jar");
		for(var processes= [], i= 0; i<bc.maxOptimizationProcesses; i++) {(function(){
			var
				runner= require.nodeRequire("child_process").spawn("java", ["-cp", javaClasses, "org.mozilla.javascript.tools.shell.Main", optimizerRunner]),
				proc= {
					runner:runner,
					results:"",
					tempResults:"",
					sent:[],
					write:function(src, dest, optimizeSwitch, copyright){
						proc.sent.push(dest);
						runner.stdin.write(src + "\n" + dest + "\n" + optimizeSwitch + "\n" + dojo.toJson(copyright) + "\n");
					},
					sink:function(output){
						proc.tempResults+= output;
						var match, message, chunkLength;
						while((match= proc.tempResults.match(doneRe))){
							message= match[0];
							bc.logInfo("done: " + proc.sent.shift() + " " + message.substring(5));
							chunkLength= match.index + message.length;
							proc.results= proc.tempResults.substring(0, chunkLength);
							proc.tempResults= proc.tempResults.substring(chunkLength);
						}
					}
				};
			processesStarted++; // matches *3*
			runner.stdout.on("data", function(data){
				// the +"" converts to Javascript string
				proc.sink(data+"");
			}),
			runner.stderr.on("data", function(data){
				// the +"" converts to Javascript string
				proc.sink(data+"");
			}),
			runner.on("exit", function(code){
				// TODO: figure out how to stop closure compiler from emmitting this drivel
				proc.results+= proc.tempResults;
				totalOptimizerOutput+= proc.results.
					replace(/\n[^\n]+com.google.javascript.jscomp.PhaseOptimizer[^\n]+\n[^\n]+/g, "").
					replace(/\n[^\n]+com.google.javascript.jscomp.Compiler[^\n]+\n[^\n]+/g, "");
				bc.optimizerOutput+= totalOptimizerOutput;
				processesStarted--; // matches *3*
				if(!processesStarted){
					// all the processes have completed and shut down at this point
					if(1 || bc.showOptimizerOutput){
						bc.logInfo(totalOptimizerOutput);
					}
					/*
					for(var p in tempFileDirs){
						bc.waiting++;  // matched with *2*
						var
							cb= function(code, text){
								bc.passGate(); // matched with *2*
							},
							filename= p + "/*consoleStripped*",
							errorMessage= "failed to delete temporary files (" + filename + ")",
							args= has("is-windows") ?
								["cmd", "/c", "del", fileUtils.normalize(filename), errorMessage, bc, cb] :
								["rm", filename, errorMessage, bc, cb];
						process.exec.apply(args);
					}
					*/
					bc.passGate(); // matched with *1*
				}
			});
			processes.push(proc);
		})();}

		bc.gateListeners.push(function(gate){
			if(gate=="cleanup"){
				// going through the cleanup gate signals that all optimizations have been started;
				// we now signal the runner there are no more files and wait for the runner to stop
				bc.logInfo("waiting for the optimizer runner to finish...");
				bc.waiting++;  // matched with *1*
				processes.forEach(function(proc){
					proc.write(".\n");
				});
			}
		});

		var stripConsoleRe= 0;
		if(bc.stripConsole){
			var consoleMethods= "assert|count|debug|dir|dirxml|group|groupEnd|info|profile|profileEnd|time|timeEnd|trace|log";
			if(bc.stripConsole=="warn"){
				consoleMethods+= "|warn";
			}else if(bc.stripConsole=="all"){
				consoleMethods+= "|warn|error";
			}
			stripConsoleRe= new RegExp("console\\.(" + consoleMethods + ")\\s*\\(", "g");
		}

		compile= function(resource, text, copyright, optimizeSwitch, callback){
			if(stripConsoleRe && /closure/.test(optimizeSwitch)){
				var tempFilename= resource.dest + ".consoleStripped.js";
				text= text.replace(stripConsoleRe, "0 && $&");
				tempFileDirs[fileUtils.getFilepath(tempFilename)]= 1;
				fs.writeFile(tempFilename, text, resource.encoding, function(err){
					if(!err){
						sendJob(tempFilename, resource.dest, optimizeSwitch, copyright);
					}
					callback(resource, err);
				});
				return callback;
			}else{
				sendJob(resource.dest + ".uncompressed.js", resource.dest, optimizeSwitch, copyright);
				return 0;
			}
		};
	}

	return function(resource, callback) {
		if(bc.optimize && !resource.layer){
			return compile(resource, resource.getText(), resource.pack.copyright, bc.optimize, callback);
		}else if(bc.layerOptimize && resource.layer){
			return compile(resource, resource.layerText, resource.layer.copyright, bc.layerOptimize, callback);
		}else{
			return 0;
		}
	};
});
