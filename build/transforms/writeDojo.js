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
	"../fs",
	"../stringify",
	"./writeAmd",
	"../process",
	"dojo/text!./dojoBoot.js"
], function(bc, fileUtils, fs, stringify, writeAmd, process, dojoBootText) {
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

			waitCount= 1, // matches *1*

			errors= [],

			onWriteComplete= function(err) {
				if (err) {
					errors.push(err);
				}
				if (--waitCount==0) {
					callback(resource, errors.length && errors);
				}
			},

			doWrite= function(filename, text) {
				fileUtils.ensureDirectoryByFilename(filename);
				waitCount++;
				fs.writeFile(filename, text, "utf8", onWriteComplete);
			};

		// the writeDojo transform...
		try {
			// the default application to the loader constructor is replaced with purpose-build user and default config values
			var
				configText= "(" + getUserConfig() + ", " + getDefaultConfig() + ");",
				layerText= resource.layerText= writeAmd.getLayerText(0, resource.layer.include, resource.layer.exclude),
				dojoLayerText= resource.layerText= resource.getText() + configText + layerText + (bc.dojoBootText || dojoBootText);
			doWrite(writeAmd.getDestFilename(resource), dojoLayerText);
			//write any bootstraps; boots is a vector of resources that have been marked as bootable by the discovery process

			resource.boots.forEach(function(item) {
				// each item is a hash of include, exclude, boot, bootText
				item.layerText= dojoLayerText + writeAmd.getLayerText(item, item.layer.include, item.layer.exclude) + (item.bootText || "");
				doWrite(writeAmd.getDestFilename(item), item.layerText);
			});

			onWriteComplete(0); // matches *1*
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
