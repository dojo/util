define(
	["require", "dojo", "./fs", "./fileUtils", "./process", "commandLineArgs", "./stringify", "./version", "dojo/text!./help.txt"],
	function(require, dojo, fs, fileUtils, process, argv, stringify, version, help) {
	///
	// AMD-ID build/argv
	//
	// This module parses the command line and returns the result in an object with the following properties
	//
	//	 buildControlScripts: a vector of build objects, ordered as provided on the command line
	//	 basePath:
	//	 destBasePath:
	//	 destPackageBasePath:
	//	 check:
	//
	// Design of relative paths:
	//
	//	 * All relative source paths and relative bc.destBasePath are relative to bc.basePath
	//	 * All relative destination paths are relative to bc.destBasePath
	//	 * Relative bd.basePath found in a build control script is relative to the directory that contains the script
	//	 * Any relative path found on the command line is relative to the current working directory
	//
	// For each build control script that is compiled, if bc.basePath is undefined, it is set to the directory that
	// contains the script. Notice that this feature can be disabled by setting e.g., "basePath==0" in any build control script.

	eval(require.scopeify("./fileUtils"));
	var
		// used to build up the result
		result= {
			buildControlScripts:[]
		},

		buildControlScripts= result.buildControlScripts,

		cwd= process.cwd(),

		printVersion= 0,
		printHelp= 0,

		errorCount= 0,

		reportError= function(message, e) {
			console.log(message);
			if (e) {
				console.log(e);
			}
			errorCount++;
		},

		illegalArgumentValue= function(argumentName, position) {
			console.log("illegal argument value for " + argumentName + " (argument " + position + ").");
			errorCount++;
		},

		evalScriptArg=
			function(arg){
				if(arg=="true"){
					return true;
				}else if(arg=="false"){
					return false;
				}else if(arg=="null"){
					return null;
				}else if(isNaN(arg)){
					return dojo.fromJson("{\"result\":\"" + arg + "\"}").result;
				}else{
					return Number(arg);
				}
			},

		loadBuildInfo= function(
			filename,
			scriptType
		) {
			///
			// Load, evaluate and return the result of the contents of the file given by
			// filename in a scope type given by scriptType as follows:
			//
			// When scriptType is falsy, contents of filename should be a Javascript object.
			// `code
			// (<contents>)
			//
			// When scriptType is "loader", contents of filename should be an application of require to a configuration object.
			// `code
			// (function() {
			//	 var result, require= function(config){result=config;};
			//	 <contents>
			//	 return result;
			// })();
			//
			// When scriptType is "require", contents of filename should include the variable "require" which should hold the
			// build contorl object:
			// `code
			// <contents>; require;
			//
			// If result contains the property basePath and/or build.basePath, then these are normalized with respect to the
			// path given by filename.

			var
				// remember the the directory of the last build script processed; this is the default location of basePath
				path= getFilepath(filename),
				type= getFiletype(filename),
				src;
			if (!type) {
				if (scriptType) {
					filename+= ".js";
				} else {
					filename+= ".bcs.js";
				}
			}
			try {
				src= fs.readFileSync(filename, "utf8");
				if (scriptType=="loader") {
					src= "(function(){var result, require= function(config){result=config;};" + src + "; return result;})();";
				} else if (scriptType=="require") {
					src= src + ";require;";
				} else {
					src= "(" + src + ")";
				}
			} catch (e) {
				reportError("failed to read build control script " + filename);
				return 0;
			}
			var e= 0;
			try {
				// build control script
				var bcs= eval(src, filename);
				if (bcs) {
					if (bcs.basePath) {
						bcs.basePath= computePath(bcs.basePath, path);
					} else if (typeof bcs.basePath == "undefined") {
						bcs.basePath= path;
					}
					if (bcs.build) {
						if (bcs.build.basePath) {
							bcs.build.basePath= computePath(bcs.build.basePath, path);
						} else if (typeof bcs.build.basePath == "undefined") {
							bcs.build.basePath= path;
						}
					}
					buildControlScripts.push(bcs);
					return true;
				}
			} catch (e) {
				 reportError("failed to evaluate build control script " + filename, e);
				//squelch
			}
			return 0;
		};

	//arg[0] is node; argv[1] is the buildControlScripts program; therefore, start with argv[2]
	for (var arg, i= 0, end= argv.length; i<end;) {
		arg= argv[i++];
		switch (arg) {
			case "-b":
			case "--build":
				if (i<end) {
					loadBuildInfo(getAbsolutePath(argv[i++], cwd), false);
				} else {
					illegalArgumentValue("build", i);
				}
				break;

			case "-r":
			case "--require":
				if (i<end) {
					loadBuildInfo(getAbsolutePath(argv[i++], cwd), "require");
				} else {
					illegalArgumentValue("require", i);
				}
				break;

			case "-l":
			case "--loader":
				if (i<end) {
					loadBuildInfo(getAbsolutePath(argv[i++], cwd), "loader");
				} else {
					illegalArgumentValue("loader", i);
				}
				break;

			case "--check":
				// read, process, and send the configuration to the console and then exit
				result.check= true;
				break;

			case "--clean":
				// read, process, and send the configuration to the console and then exit
				result.clean= true;
				break;

			case "--release":
				// read, process, and send the configuration to the console and then exit
				result.release= true;
				break;

			case "--help":
				// read, process, and send the configuration to the console and then exit
				printHelp= true;
				console.log(help);
				break;

			case "-v":
			case "--version":
				// read, process, and send the configuration to the console and then exit
				printVersion= true;
				console.log(version+"");
				break;

			case "--unit-test":
				// special hook for testing
				if (i<end) {
					result.unitTest= argv[i++];
				} else {
					illegalArgumentValue("unit-test", i);
				}
				break;

			case "--unit-test-param":
				// special hook for testing
				if (i<end) {
					result.unitTestParam= result.unitTestParam || [];
					result.unitTestParam.push(argv[i++]);
				} else {
					illegalArgumentValue("unit-test", i);
				}
				break;

			default:
				// possible formats
				//
				//   -flag value
				//   --flag value
				//   flag=value

				var match= arg.match(/^\-\-?(.+)/);
				if (match && i<end) {
					// the form "-[-]<flag> <value>"; *must* provide a value
					result[match[1]]= argv[i++];
				} else {
					var parts= arg.split("=");
					if (parts.length==2) {
						if (/htmlFiles|htmlDir|profile|profileFile/.test(parts[0])) {
							buildControlScripts.push(parts);
						} else {
							result[parts[0]]= evalScriptArg(parts[1]);
						}
					} else {
						illegalArgumentValue(arg, i);
					}
				}
		}
	}

	// change the name of v1.6- log property
	// TODO: warn if command line arg steps on a known, used build control property
	// see similarly processing in argv
	if(result.log!==undefined){
		result.logLevel= result.log;
		delete result.log;
	}

	if (((printHelp || printVersion) && argv.length==3) || (printHelp && printVersion && argv.length==4)) {
		//just asked for either help or version or both; don't do more work or reporting
		process.exit(0);
	}

	if (false && !errorCount && !buildControlScripts.length) {
		try {
			console.log("no build control script was given; trying to read config.js in the current working directory");
			if (loadBuildInfo(getAbsolutePath("./config.js", cwd), "require")) {
				console.log("successfully read config.js; using it for the build");
			}
		} catch(e) {
		}
	}

	if (errorCount==1 && !buildControlScripts.length) {
		console.log("no build control script ever found. Nothing to do; terminating application.");
		process.exit(-1);
	} else if (errorCount) {
		console.log("errors on command line; terminating application.");
		process.exit(-1);
	}

	if (result.unitTest=="argv") {
		var passed= fs.readFileSync(result.unitTestParam[0], "ascii")==stringify(result);
		console.log(passed ? "PASSED" : "FAILED");
		if (!passed) {
			console.log(stringify(result));
		}
		process.exit(passed ? 0 : -1);
	}
	return result;
});


