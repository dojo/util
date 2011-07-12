define([
	"require",
	"./argv",
	"./fs",
	"./fileUtils",
	"./buildControlDefault",
	"./v1xProfiles",
	"./stringify",
	"./process",
	"dojo/text!./help.txt"], function(require, args, fs, fileUtils, bc, v1xProfiles, stringify, process, helpText) {
	//
	// Process the arguments given on the command line to build up a build control object that is used to instruct and control
	// the build process.
	//
	// This modules is a bit tedious. Is methodically goes through each option set, cleaning and conditioning user input making it
	// easy to use for the remainder of the program. Readers are advised to tackle it top-to-bottom. There is no magic...just
	// a whole bunch of imperative programming.
	//
	eval(require.scopeify("./fs, ./fileUtils, ./v1xProfiles"));
	var
		isString= function(it) {
			return typeof it === "string";
		},

		cleanupFilenamePair= function(item, srcBasePath, destBasePath, hint) {
			var result;
			if (isString(item)) {
				result= [computePath(item, srcBasePath), computePath(item, destBasePath)];
			} else {
				result= [computePath(item[0], srcBasePath), computePath(item[1], destBasePath)].concat(item.slice(2));
			}
			if (!isAbsolutePath(result[0]) || !isAbsolutePath(result[1])) {
				bc.log("inputInvalidPath" ["path", item, "hint", hint]);
			}
			return result;
		},

		slashTerminate= function(path){
			return path + /\/$/.test(path) ? "" : "/";
		},

		isEmpty= function(it) {
			for (var p in it) return false;
			return true;
		},

		mix= function(dest, src) {
			dest= dest || {};
			src= src || {};
			for (var p in src) dest[p]= src[p];
			return dest;
		},

		mixPackage= function(packageInfo) {
			var name= packageInfo.name;
			bc.packageMap[name]= mix(bc.packageMap[name], packageInfo);
		},

		// mix a build control object into the global build control object
		mixBuildControlObject= function(src) {
			// the build control properties...
			//	 paths, pluginProcs, transforms, staticHasFeatures
			// ...are mixed one level deep; packages and packagePaths require special handling; all others are over-written
			// FIXME: the only way to modify the transformJobs vector is to create a whole new vector?
			for (var p in src) {
				if (!/(paths)|(pluginProcs)|(transforms)|(staticHasFeatures)|(packages)|(packagePaths)/.test(p)) {
					bc[p]= src[p];
				}
			}
			// the one-level-deep mixers
			["paths","pluginProcs","transforms","staticHasFeatures"].forEach(function(p) {
				bc[p]= mix(bc[p], src[p]);
			});

			// packagePaths and packages require special processing to get their contents into packageMap; do that first...
			// process packagePaths before packages before packageMap since packagePaths is less specific than
			// packages is less specific than packageMap. Notice that attempts to edit an already-existing package
			// only edits specific package properties given (see mixPackage, above)
			for (var base in src.packagePaths) {
				src.packagePaths[base].forEach(function(packageInfo) {
					if (isString(packageInfo)) {
						packageInfo= {name:packageInfo};
					}
					packageInfo.location= catPath(base, packageInfo.name);
					mixPackage(packageInfo);
				});
			};
			(src.packages || []).forEach(function(packageInfo) {
					if (isString(packageInfo)) {
						packageInfo= {name:packageInfo};
					}
					mixPackage(packageInfo);
			});
		};

	if(!args.buildControlScripts.length){
		bc.log("pacify", "no profile or build control script provided; use the option --help for help");
		process.exit(0);
	}

	// for each build control object or v1.6- profile in args, mix into bc in the order they appeared on the command line
	// FIXME: rename "buildControlScript et al to profile...keep the peace
	args.buildControlScripts.forEach(function(item) {
		if (item instanceof Array) {
			switch (item[0]) {
				case "htmlDir":
					var htmlFiles= [];
					fs.readdirSync(item[1]).forEach(function(filename){
						if(/\.html$/.test(filename)){
							htmlFiles.push(filename);
						}
					});
					processHtmlFiles(htmlFiles);
					break;

				case "htmlFiles":
					processHtmlFiles(item[1].split(","));
					break;
				case "profile":
					// more relaxed than v1.6-; if it looks like a file, assume the profileFile behavior; this makes profileFile redundant
					if(/\//.test(item[1])){
						item= processProfileFile(item[1], args);
					}else{
						item= processProfileFile(require.baseUrl + "../util/buildscripts/profiles/" + item[1] + ".profile.js", args);
					}
					break;
				case "profileFile":
					bc.log("inputDeprecatedProfileFile");
					item= processProfileFile(item[1], args);
					break;
			}
		}
		var
			temp= mix({}, item),
			build= item.build;
		delete temp.build;
		mixBuildControlObject(temp);
		build && mixBuildControlObject(build);
	});

	// lastly, explicit command line switches override any evaluated build control objects
	for (var argName in args) if (argName!="buildControlScripts") {
		bc[argName]= args[argName];
	}

	//
	// at this point the raw build control object has been fully initialized; clean it up and look for errors...
	//
	bc.basePath= computePath(bc.basePath, process.cwd());
	bc.destBasePath= computePath(bc.destBasePath || (bc.basePath + (bc.basePathSuffix || "-build")), bc.basePath);
	bc.destPackageBasePath= computePath(bc.destPackageBasePath || "./packages", bc.destBasePath);

	// compute files, dirs, and trees
	(function () {
		for (var property in {files:1, dirs:1, trees:1}) {
			bc[property]= bc[property].map(function(item) {
				return cleanupFilenamePair(item, bc.basePath, bc.destBasePath, property);
			});
		}
	})();

	// cleanup the compactCssSet (if any)
	(function() {
		var cleanSet= {}, src, dest;
		for (src in bc.compactCssSet) {
			dest= bc.compactCssSet[src];
			cleanSet[computePath(src, bc.basePath)]= isString(dest) ? computePath(dest, bc.destBasePath) : dest;
		}
		bc.compactCssSet= cleanSet;
	})();

	// cleanup the replacements (if any)
	(function() {
		var cleanSet= {}, src, dest;
		for (src in bc.replacements) {
			cleanSet[computePath(src, bc.basePath)]= bc.replacements[src];
		}
		bc.replacements= cleanSet;
	})();

	// explicit mini and/or copyTests wins;
	// in particular, explicit copyTests ignores explicit mini with regard to tests
	if(!("mini" in bc)){
		bc.mini = true;
	}
	if(!("copyTests" in bc)){
		bc.copyTests = !bc.mini;
	}
	if(isString(bc.copyTests)){
		bc.copyTests = bc.copyTests.toLowerCase();
	}
	if(bc.copyTests!="build"){
		// convert to pure boolean
		bc.copyTests = !!bc.copyTests;
	}
	if(bc.copyTests && !bc.packageMap.doh){
		bc.packageMap.doh= bc.dohPackageInfo;
	}

	// clean up bc.packageMap and bc.paths so they can be used just as in bdLoad
	(function() {
		// so far, we've been using bc.packageMap to accumulate package info as it is provided by packagePaths and/or packages
		// in zero to many build control scripts. This routine moves each package config into bc.packages which is a map
		// from package name to package config (this is different from the array the user uses to pass package config info). Along
		// the way, each package config object is cleaned up and all default values are calculated. Finally, the bdLoad-required
		// global packageMap (a map from package name to package name) is computed.
		bc.packages= bc.packageMap;
		bc.destPackages= {};
		bc.packageMap= {};
		bc.destPackageMap= {};
		for (var packageName in bc.packages) {
			var pack= bc.packages[packageName];

			var filename = catPath(pack.location, "package.json"),
				packageJson= readAndEval(filename, "package.json"),
				defaultProfileFilename = pack.name + ".profile.js";
			if(isEmpty(packageJson)){
				bc.log("inputMissingPackageJson", ["filename", filename]);
			}else{
				if(packageJson.main && !pack.main){
					pack.main= packageJson.main;
				}
				if("dojoBuild" in packageJson){
					// notice this allows setting defaultProfileFilename to "" which will prevent a default profile from being processed
					defaultProfileFilename = packageJson.dojoBuild;
				}
				if(packageJson.version){
					bc.log("packageVersion", ["package", packageName, "version", packageJson.version]);
				}
			}
			if(defaultProfileFilename){
				var defaultProfile = readAndEval(catPath(pack.location, defaultProfileFilename), "default profile");
				for (var p in defaultProfile) {
					if (!(p in pack)) {
						pack[p]= defaultProfile[p];
					}else if(p in {resourceTags:1}){
						// these are mixed one level deep
						// TODO: review all profile properties and see if there are any others than resourceTags that ought to go here
						mix(pack[p], defaultProfile[p]);
					}
				}
			}

			// build up info to tell all about a package; all properties semantically identical to definitions used by bdLoad
			// note: pack.name=="" for default package
			pack.main= isString(pack.main) ? pack.main : "main";
			if(!pack.main.indexOf("./")){
				pack.main = pack.main.substring(2);
			}

			pack.location= computePath(pack.location || (pack.name ? "./" + pack.name : bc.basePath), bc.basePath);
			pack.packageMap= pack.packageMap || 0;
			require.computeMapProg(pack.packageMap, (pack.mapProg= []));

			// dest says where to output the compiled code stack
			var destPack= bc.destPackages[pack.name]= {
				name:pack.destName || pack.name,
				main:pack.destMain || pack.main,
				location:computePath(pack.destLocation || ("./" + (pack.destName || pack.name)), bc.destPackageBasePath),
				packageMap:pack.destPackageMap || pack.packageMap
			};
			require.computeMapProg(pack.destPackageMap, (destPack.mapProg= []));
			delete pack.destname;
			delete pack.destMain;
			delete pack.destLocation;
			delete pack.destPackageMap;

			if (!pack.trees) {
				// copy the package tree; don't copy any hidden directorys (e.g., .git, .svn) or temp files
				pack.trees= [[pack.location, destPack.location, /(\/\.)|(~$)/]];
			} // else the user has provided explicit copy instructions

			// filenames, dirs, trees just like global, except relative to the pack.(src|dest)Location
			for (var property in {files:1, dirs:1, trees:1}) {
				pack[property]= (pack[property] || []).map(function(item) {
					return cleanupFilenamePair(item, pack.location, destPack.location, property + " in package " + pack.name);
				});
			}
			if (pack.name) {
				// don't try to put the default package (named "") in the packageMap
				bc.packageMap[pack.name]= pack.name;
				bc.destPackageMap[destPack.name]= destPack.name;
			}
		}
		// now that bc.packageMap is initialized...
		require.computeMapProg(bc.packageMap, (bc.packageMapProg= []));
		require.computeMapProg(bc.destPackageMap, (bc.destPackageMapProg= []));

		// get this done too...
		require.computeMapProg(bc.paths, (bc.pathsMapProg= []));
		require.computeMapProg(bc.destPaths || bc.paths, (bc.destPathsMapProg= []));

		bc.srcModules= {};
		bc.destModules= {};

		// add some methods to bc to help with resolving AMD module info
		var trimLastFiveChars= function(text){
			return text.substring(0, text.length-5);
		};

		bc.getSrcModuleInfo= function(mid, referenceModule, ignoreFileType) {
			if(ignoreFileType){
				var result= require.getModuleInfo(mid+"/x", referenceModule, bc.packages, bc.srcModules, bc.basePath + "/", bc.packageMapProg, bc.pathsMapProg, true);
				// trim /x.js
				result.mid= trimLastFiveChars(result.mid);
				result.url= trimLastFiveChars(result.url);
				return result;
			}else{
				return require.getModuleInfo(mid, referenceModule, bc.packages, bc.srcModules, bc.basePath + "/", bc.packageMapProg, bc.pathsMapProg, true);
			}
		};

		bc.getDestModuleInfo= function(mid, referenceModule, ignoreFileType) {
			// note: bd.destPagePath should never be required; but it's included for completeness and up to the user to provide it if some transform does decide to use it
			if(ignoreFileType){
				var result= require.getModuleInfo(mid+"/x", referenceModule, bc.destPackages, bc.destModules, bc.destBasePath + "/", bc.destPackageMapProg, bc.destPathsMapProg, true);
				// trim /x.js
				result.mid= trimLastFiveChars(result.mid);
				result.url= trimLastFiveChars(result.url);
				return result;
			}else{
				return require.getModuleInfo(mid, referenceModule, bc.destPackages, bc.destModules, bc.destBasePath + "/", bc.destPackageMapProg, bc.destPathsMapProg, true);
			}
		};
	})();

	(function() {
		// a layer is a module that should be written with all of its dependencies, as well as all modules given in
		// the include vector together with their dependencies, excluding modules contained in the exclude vector and their dependencies
		var fixedLayers= {};
		for (var mid in bc.layers) {
			var layer= bc.layers[mid];
			if (layer instanceof Array) {
				layer= {
					exclude: layer,
					include: []
				};
			} else {
				layer.exclude= layer.exclude || [];
				layer.include= layer.include || [];
			}
			// boot is just boolean to say "prefix with the loader"
			fixedLayers[mid]= layer;
		}
		bc.layers= fixedLayers;
	})();

	bc.locales= bc.loaderConfig.locales || bc.locales || [];

	// for the static has flags, -1 means its not static; this gives a way of combining several static has flag sets
	// and still allows later sets to delete flags set in earlier sets
	var deleteStaticHasFlagSet= [];
	for (var p in bc.staticHasFeatures) if (bc.staticHasFeatures[p]==-1) deleteStaticHasFlagSet.push(p);
	deleteStaticHasFlagSet.forEach(function(flag){delete bc.staticHasFeatures[flag];});

	if(bc.action){
		bc.action.split(/\W|\s/).forEach(function(action){
			action= action.match(/\s*(\S+)\s*/)[1];
			switch(action){
				case "check":
					bc.check= true;
					break;
				case "clean":
					bc.clean= true;
					break;
				case "release":
					bc.release= true;
					break;
				default:
					bc.log("inputUnknownAction" ["action", action]);
					process.exit(0);

			}
		});
	}

	if(!bc.check && !bc.clean && !bc.release){
		bc.log("pacify", "Nothing to do; you must explicitly instruct the application to do something; use the option --help for help.");
		process.exit(0);
	}

	if(bc.clean!==undefined && !bc.clean){
		// user said do NOT clean; honor that
	}else if(bc.release && !bc.buildLayers){
		// doing a complete build; therefore, autoclean unless told otherwise
		bc.clean= true;
	}

	// understand stripConsole from dojo 1.3 and before
	var stripConsole= bc.stripConsole;
	if (!stripConsole || stripConsole=="none") {
		stripConsole= false;
	} else if (stripConsole == "normal,warn") {
		bc.log("inputDeprecatedStripConsole", ["deprecated", "normal,warn", "use", "warn"]);
		stripConsole = "warn";
	} else if (stripConsole == "normal,error") {
		bc.log("inputDeprecatedStripConsole", ["deprecated", "normal,error", "use", "all"]);
		stripConsole = "all";
	} else if (!/normal|warn|all|none/.test(stripConsole)){
		bc.log("inputUnknownStripConsole", ["value", stripConsole]);
	}
	bc.stripConsole= stripConsole;

	if(bc.optimize){
		bc.optimize= bc.optimize.toLowerCase();
		if(!/^(comments|shrinksafe(\.keeplines)?|closure(\.keeplines)?)$/.test(bc.optimize)){
			bc.log("inputUnknownOptimize" ["value", bc.optimize]);
		}else{
			if(/shrinksafe/.test(bc.optimize) && stripConsole){
				bc.optimize+= "." + stripConsole;
			}
		}
	}
	if(bc.layerOptimize){
		bc.layerOptimize= bc.layerOptimize.toLowerCase();
		if(!/^(comments|shrinksafe(\.keeplines)?|closure(\.keeplines)?)$/.test(bc.layerOptimize)){
			bc.log("inputUnknownLayerOptimize" ["value", bc.layerOptimize]);
		}else{
			if(/shrinksafe/.test(bc.layerOptimize) && stripConsole){
				bc.layerOptimize+= "." + stripConsole;
			}
		}
	}

	var fixedScopeMap = {};
	bc.scopeNames = [];
	(bc.scopeMap || [["dojo", "dojo"], ["dijit", "dijit"], ["dojox", "dojox"]]).forEach(function(pair){
		fixedScopeMap[pair[0]] = pair[1];
		bc.scopeNames.push(pair[0]);
	});
	bc.scopeMap = fixedScopeMap;

	var fixedInternStringsSkipList = {};
	(bc.internSkipList || bc.internStringsSkipList || []).forEach(function(mid){
		fixedInternStringsSkipList[mid.replace(/\./g, "/")] = 1;
	});
	bc.internStringsSkipList = fixedInternStringsSkipList;

	var deprecated= [];
	for(p in bc){
		if(/^(loader|xdDojoPath|symbol|scopeDjConfig|xdScopeArgs|xdDojoScopeName|expandProvide|buildLayers|query|removeDefaultNameSpaces|addGuards)$/.test(p)){
			deprecated.push(p);
			bc.log("inputDeprecated", ["switch", p]);
		}
	}
	deprecated.forEach(function(p){
		delete bc[p];
	});

	// dump bc (if requested) before changing gateNames to gateIds below
	if (bc.check) (function() {
		bc.log("pacify", stringify(bc));
if(0){
		// don't dump out private properties used by build--they'll just generate questions
		var
			dump= {},
			internalProps= {
				buildControlScripts:1,
				check:1,
				destModules:1,
				destPackageMapProg:1,
				destPackages:1,
				destPathsMapProg:1,
				errorCount:1,
				getDestModuleInfo:1,
				getSrcModuleInfo:1,
				logInfo:1,
				logError:1,
				logWarn:1,
				messages:1,
				packageMap:1,
				packageMapProg:1,
				packages:1,
				pathsMapProg:1,
				resources:1,
				resourcesByDest:1,
				srcModules:1,
				startTimestamp:1,
				version:1,
				warnCount:1
			};
		for (var p in bc) if (!internalProps[p]) {
			dump[p]= bc[p];
		}
		var packages= dump.packages= [];
		for (p in bc.packages) {
			var
				pack= bc.packages[p],
				destPack= bc.destPackages[p];
			packages.push({
				name:pack.name, main:pack.main, location:pack.location, modules:pack.modules||{}, trees:pack.trees,
				destName:destPack.name, destMain:destPack.main, destLocation:destPack.location
			});
		}
		bc.log("pacify", stringify(dump));
}
	})();


	// clean up the gates and transforms
	(function() {
		// check that each transform references a valid gate
		for (var gates= {}, i= 0; i<bc.gates.length; i++) {
			gates[bc.gates[i][1]]= i;
		}
		var
			transforms= bc.transforms,
			gateId;
		for (var transformId in transforms) {
			// each item is a [AMD-MID, gateName] pair
			gateId= gates[transforms[transformId][1]];
			if (typeof gateId == "undefined") {
				bc.log("inputUnknownGate", ["transform", transformId, "gate", transforms[transformId][1]]);
			} else {
				transforms[transformId][1]= gateId;
			}
		}
	})();

	// clean up the transformJobs
	(function() {
		// check that that each transformId referenced in transformJobs references an existing item in transforms
		// ensure proper gate order of the transforms given in transformJobs; do not disturb order within a given
		// gate--this is the purview of the user
		var transforms= bc.transforms;
		bc.transformJobs.forEach(function(item) {
			// item is a [predicate, vector of transformId] pairs
			var error= false;
			var tlist= item[1].map(function(id) {
				// item is a transformId
				if (transforms[id]) {
					// return a [trandformId, gateId] pair
					return [id, transforms[id][1]];
				} else {
					error= true;
					bc.log("inputUnknownTransform", ["transform", id]);
					return 0;
				}
			});
			// tlist is a vector of [transformId, gateId] pairs than need to be checked for order
			if (!error) {
				for (var i= 0, end= tlist.length - 1; i<end;) {
					if (tlist[i][1]>tlist[i+1][1]) {
						var t= tlist[i];
						tlist[i]= tlist[i+1];
						tlist[i+1]= t;
						i && i--;
					} else {
						i++;
					}
				}
				// now replace the vector of transformIds with the sorted list
				item[1]= tlist;
			}
		});
	})();

	if (args.unitTest=="dumpbc") {
		console.log(stringify(bc) + "\n");
	}

	if(bc.quiet){
		(function(){
			var delSet = {};
			for(var p in bc.pacifySet){
				if(bc.messageMap[p][1]>199){
					delSet[p] = 1;
				}
			}
			for(p in delSet){
				delete bc.pacifySet[p];
			}
		})();
	}

	return bc;
});
