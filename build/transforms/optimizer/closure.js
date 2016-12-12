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
		return function(resource, text, copyright, optimizeSwitch, callback){
			copyright = copyright || "";
			if(bc.stripConsole){
				var tempFilename = resource.dest + ".consoleStripped.js";
				text = stripConsole(text);
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
			jscomp = 0,
			built = "//>>built" + bc.newline;

		var ccompile = function(text, dest, optimizeSwitch, copyright, useSourceMaps){
			/*jshint rhino:true */
			/*global com:false Packages:false */
			if(!jscomp){
				JSSourceFilefromCode = java.lang.Class.forName("com.google.javascript.jscomp.SourceFile").getMethod("fromCode", [ java.lang.String, java.lang.String ]);
				closurefromCode = function(filename,content){
					return JSSourceFilefromCode.invoke(null, [filename, content]);
				};
				jscomp = com.google.javascript.jscomp;
			}
			//Fake extern
			var externSourceFile = closurefromCode("fakeextern.js", " ");

			//Set up source input
			var destFilename = dest.split("/").pop(),
				jsSourceFile = closurefromCode(destFilename + ".uncompressed.js", String(text));

			//Set up options
			var options = new jscomp.CompilerOptions();

			var FLAG_compilation_level = jscomp.CompilationLevel.SIMPLE_OPTIMIZATIONS;
			FLAG_compilation_level.setOptionsForCompilationLevel(options);
			var FLAG_warning_level = jscomp.WarningLevel.DEFAULT;
			FLAG_warning_level.setOptionsForWarningLevel(options);

			// force this option to false to prevent overly agressive code elimination (#18919)
			options.setDeadAssignmentElimination(false);

			for(var k in bc.optimizeOptions){
				// some options need to pass as funtion argument
				if (k === 'languageIn') {
					options.setLanguageIn(jscomp.CompilerOptions.LanguageMode[bc.optimizeOptions[k]]);
					continue;
				}
				options[k] = bc.optimizeOptions[k];
			}
			// Must have non-null path to trigger source map generation, also fix version
			options.setSourceMapOutputPath("");
			options.setSourceMapFormat(jscomp.SourceMap.Format.V3);
			if(optimizeSwitch.indexOf(".keeplines") !== -1){
				options.prettyPrint = true;
			}


			//Prevent too-verbose logging output
			Packages.com.google.javascript.jscomp.Compiler.setLoggingLevel(java.util.logging.Level.SEVERE);

			// Run the compiler
			// File name and associated map name
			var mapTag = useSourceMaps ? (bc.newline + "//# sourceMappingURL=" + destFilename + ".map") : "";
			var compiler = new Packages.com.google.javascript.jscomp.Compiler(Packages.java.lang.System.err);
			compiler.compile(externSourceFile, jsSourceFile, options);
			var result = copyright + built + compiler.toSource() + mapTag;

			if(useSourceMaps){
				var sourceMap = compiler.getSourceMap();
				sourceMap.setWrapperPrefix(copyright + built);
				var sb = new java.lang.StringBuffer();
				sourceMap.appendTo(sb, destFilename);
				fs.writeFile(dest + ".map", sb.toString(), "utf-8");
			}

			return result;
		};

		return function(resource, text, copyright, optimizeSwitch, callback){
			bc.log("optimize", ["module", resource.mid]);
			copyright = copyright || "";
			try{
				var result = ccompile(stripConsole(text), resource.dest, optimizeSwitch, copyright, bc.useSourceMaps);
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
