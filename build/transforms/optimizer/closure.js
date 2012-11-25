define([
	"../../buildControl",
	"dojo/has!host-node?./sendJob:",
	"../../fs",
	"../../fileUtils",
	"./stripConsole",
	"dojo/_base/lang",
	"dojo/has"
], function(bc, sendJob, fs, fileUtils, stripConsole, lang, has){
	if(has("host-node")){
		var tempFileDirs = {};
		return function(resource, text, copyright, optimizeSwitch, callback){
			copyright = copyright || "";
			if(bc.stripConsole){
				var tempFilename = resource.dest + ".consoleStripped.js";
				text = stripConsole(text);
				tempFileDirs[fileUtils.getFilepath(tempFilename)] = 1;
				fs.writeFile(tempFilename, bc.newlineFilter(text, resource, "closureStripConsole"), resource.encoding, function(err){
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

	if(has("host-rhino")){
		var JSSourceFilefromCode,
			closurefromCode,
			jscomp = 0;

		var ccompile = function(text, dest, optimizeSwitch, copyright){
			/*jshint rhino:true */
			/*global com:false Packages:false */
			if(!jscomp){
				// don't do this unless demanded...it may not be available
				JSSourceFilefromCode = java.lang.Class.forName("com.google.javascript.jscomp.JSSourceFile").getMethod("fromCode", [ java.lang.String, java.lang.String ]);
				closurefromCode = function(filename,content){
					return JSSourceFilefromCode.invoke(null, [filename, content]);
				};
				jscomp = com.google.javascript.jscomp;
			}
			//Fake extern
			var externSourceFile = closurefromCode("fakeextern.js", " ");

			//Set up source input
			var jsSourceFile = closurefromCode(String(dest), String(text));

			//Set up options
			var options = new jscomp.CompilerOptions();
			lang.mixin(options, bc.optimizeOptions);
			if(optimizeSwitch.indexOf(".keeplines") !== -1){
				options.prettyPrint = true;
			}
			var FLAG_compilation_level = jscomp.CompilationLevel.SIMPLE_OPTIMIZATIONS;
			FLAG_compilation_level.setOptionsForCompilationLevel(options);
			var FLAG_warning_level = jscomp.WarningLevel.DEFAULT;
			FLAG_warning_level.setOptionsForWarningLevel(options);

			//Prevent too-verbose logging output
			Packages.com.google.javascript.jscomp.Compiler.setLoggingLevel(java.util.logging.Level.SEVERE);

			//Run the compiler
			var compiler = new Packages.com.google.javascript.jscomp.Compiler(Packages.java.lang.System.err);
			compiler.compile(externSourceFile, jsSourceFile, options);
			return copyright + "//>>built" + bc.newline + compiler.toSource();
		};

		return function(resource, text, copyright, optimizeSwitch, callback){
			bc.log("optimize", ["module", resource.mid]);
			copyright = copyright || "";
			try{
				var result = ccompile(stripConsole(text), resource.dest, optimizeSwitch, copyright);
				fs.writeFile(resource.dest, result, resource.encoding, function(err){
					if(err){
						bc.log("optimizeFailedWrite", ["filename", result.dest]);
					}
					callback(resource, err);
				});
			}catch(e){
				bc.log("optimizeFailed", ["module identifier", resource.mid, "exception", e + ""]);
				callback(resource, 0);
			}
			return callback;
		};
	}

	throw new Error("Unknown host environment: only nodejs and rhino are supported by closure optimizer.");
});