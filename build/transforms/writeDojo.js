///
// \amd-mid build/lib/transforms/writeBdLoad
//
// A function to write the bdLoad resource.
//
// The function writes the results of transforming the loader source. has.js is integrated as follows:
//	 * if bc.has=="*build", then build/has/bdBuildHas is provided to the loader boot; otherwise...
//	 * if bc.has.getText exists and is a function, then the result of that function is provided to the loader boot; otherwise...
//	 * build/has/naiveHas is provided to the loader boot bc.loader.boots
//
// Other transforms may request a bootstrap be written for them that includes the loader and loader config. They
// may execute such a request by pushing a function into bc.loader.boots. The function must return a [filename, text]
// pair that indicates the bootstrap text to append to the loader and the destination to write the result.
define([
	"../buildControl",
	"../fileUtils",
	"fs",
	"../stringify",
	"./writeAmd",
	"spawn"
], function(bc, fileUtils, fs, stringify, writeAmd, spawn) {
	return function(resource, callback) {
		var
			getUserConfig= function() {
				if (!bc.userConfig) {
					return "this.dojoConfig || this.djConfig || this.require || {}";
				}
				var result= stringify(bc.userConfig);
				if (result.unsolved) {
					bc.logWarn("The user configuration contains unsolved values. This may or may not be an error.");
				}
				return result;
			},

			computeLocation= function(basePath, path) {
				if (path.indexOf(basePath + "/")==0) {
					return "." + path.substring(basePath.length);
				}
				var
					parts= basePath.split("/"),
					prefix= "";
				for (var i= parts.length-1; i>=0; i--) {
					 prefix+= (prefix ? "/.." : "..");
					var check= parts.slice(0, i).join("/") + "/";
					if (path.indexOf(check)==0) {
						return prefix + path.substring(check.length-1);
					}
				}
				return path;
			},

			getPackage= function(name) {
				// the purpose of this somewhat verbose routine is to write a minimal package object for each
				// package, yet allow client code to pass extra (i.e., outside the scope of CJS specs) config
				//	information within the package object
				var
					 srcPack= bc.packages[name],
					 destPack= bc.destPackages[name],
					 result= {},
					 p;
				for (p in srcPack) result[p]= srcPack[p];
				for (p in destPack) result[p]= destPack[p];
				// everything relative to the dojo dir
				// TODO: making everything relative to dojo needs to be optional
				if (name=="dojo") {
					result.location= ".";
				} else {
					result.location= computeLocation(bc.destPackageBasePath + "/dojo", destPack.location);
				}
				delete result.mapProg;
				delete result.trees;
				delete result.dirs;
				delete result.files;
				delete result.resourceTags;
				if (result.lib=="lib") delete result.lib;
				if (result.main=="main") delete result.main;
				if (!result.packageMap.length) delete result.packageMap;
				return result;
			},

			getDefaultConfig= function() {
				var config= bc.defaultConfig || {hasCache:[]};
				config.packages= config.packages || [];
				if (bc.baseUrl) {
					config.baseUrl= bc.baseUrl;
				}
				for (var p in bc.packages) {
					config.packages.push(getPackage(p));
				}
				var result= stringify(config);
				if (result.unsolved) {
					bc.logWarn("The default configuration contains unsolved values. This may or may not be an error.");
				}
				return result;
			},

			waitCount= 0,

			errors= [],

			onCompressComplete= function(err) {
				if (err) {
					errors.push(err);
				}
				if (--waitCount==0) {
					callback(resource, errors.length && errors);
				}
			},

			onWriteComplete= function(err) {
				if (err) {
					errors.push(err);
				}
				if (!err && bc.layerOptimize && 0) {
					var proc= spawn("java", ["-jar", "/home/rcgill/dev/ccompiler/compiler.jar", "--compilation_level", "SIMPLE_OPTIMIZATIONS", "--js", resource.dest+".uncompressed.js", "--js_output_file", resource.dest]).on("exit", onCompressComplete);
					proc.stdout.on('data', function (data) {
						console.log(data.toString("ascii"));
					});
					proc.stderr.on('data', function (data) {
						console.log(data.toString("ascii"));
					});
				} else if (--waitCount==0) {
					callback(resource, errors.length && errors);
				}
			},

			doWrite= function(filename, text) {
				if (bc.layerOptimize && 0) {
					filename+= ".uncompressed.js";
				}
				fileUtils.ensureDirectoryByFilename(filename);
				waitCount++;
				fs.writeFile(filename, text, "utf8", onWriteComplete);
			},

			writeNonmoduleLayers= function(){
				// write any layers that are not also an existing module
				for (var mid in bc.layers) {
					var
						moduleInfo= bc.getSrcModuleInfo(mid),
						resource= bc.amdResources[moduleInfo.pqn],
						layer= bc.layers[mid];
					if (!resource && !layer.boot) {
						doWrite(bc.getDestModuleInfo(moduleInfo.path).url, writeAmd.getLayerText(0, layer.include, layer.exclude));
					}
				}
			};

		// the writeDojo transform...
		try {
			// the default application to the loader constructor is replaced with purpose-build user and default config values
			var
				configText= "(" + getUserConfig() + ", " + getDefaultConfig() + ");",
				layerText= writeAmd.getLayerText(0, bc.dojoLayer.include, bc.dojoLayer.exclude);
			doWrite(resource.dest,
				resource.getText() + configText + layerText +
					"require({\n" +
					"	 deps:['dojo'].concat(require.deps || []),\n" +
					"	 callback:require.callback\n" +
					"});\n"
			);

			//write any bootstraps; boots is a map from dest filename to boot layer
			resource.boots.forEach(function(item) {
				// each item is a map of include, exclude, boot, bootText
				doWrite(item.boot.dest, loaderText + writeAmd.getLayerText(0, item.include, item.exclude) + item.bootText);
			});

			writeNonmoduleLayers();
		} catch (e) {
			if (waitCount) {
				// can't return the error since there are async processes already going
				errors.push(e);
				return 0;
			} else {
				return e;
			}
		}
		return callback;
	};
});
