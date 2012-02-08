define(["../buildControl", "../fileUtils", "../fs", "dojo/_base/lang", "dojo/json"], function(bc, fileUtils, fs, lang, json) {
	var
		computingLayers
			// the set of layers being computed; use this to detect circular layer dependencies
			= {},

		computeLayerContents= function(
			layerModule,
			include,
			exclude
		) {
			// add property layerSet (a set of mid) to layerModule that...
			//
			//	 * includes dependency tree of layerModule
			//	 * includes all modules in layerInclude and their dependency trees
			//	 * excludes all modules in layerExclude and their dependency trees
			//	 * excludes layerModule itself
			//
			// note: layerSet is built exactly as given above, so included modules that are later excluded
			// are *not* in result layerSet
			if(layerModule && computingLayers[layerModule.mid]){
				bc.log("amdCircularDependency", ["module", layerModule.mid]);
				return {};
			}
			computingLayers[layerModule.mid]= 1;

			var
				includeSet= {},
				visited,
				includePhase,
				traverse= function(module) {
					var mid= module.mid;

					if (visited[mid]) {
						return;
					}
					visited[mid]= 1;
					if (includePhase) {
						includeSet[mid]= module;
					} else {
						delete includeSet[mid];
					}
					if(module!==layerModule && module.layer){
						var layerModuleSet= module.moduleSet || computeLayerContents(module, module.layer.include, module.layer.exclude);
						for(var p in layerModuleSet){
							if (includePhase) {
								includeSet[p]= layerModuleSet[p];
							} else {
								delete includeSet[p];
							}
						}
					}else{
						for (var deps= module.deps, i= 0; deps && i<deps.length; traverse(deps[i++])){
						}
					}
				};

			visited= {};
			includePhase= true;
			if (layerModule) {
				traverse(layerModule);
			}
			include.forEach(function(mid) {
				var module= bc.amdResources[bc.getSrcModuleInfo(mid, layerModule).mid];
				if (!module) {
					bc.log("amdMissingLayerIncludeModule", ["missing", mid, "layer", layerModule && layerModule.mid]);
				} else {
					traverse(module);
				}
			});

			visited= {};
			includePhase= false;
			exclude.forEach(function(mid) {
				var module= bc.amdResources[bc.getSrcModuleInfo(mid, layerModule).mid];
				if (!module) {
					bc.log("amdMissingLayerExcludeModule", ["missing", mid, "layer", layerModule && layerModule.mid]);
				} else {
					traverse(module);
				}
			});

			if(layerModule){
				layerModule.moduleSet= includeSet;
				delete computingLayers[layerModule.mid];
			}
			return includeSet;
		},

		insertAbsMid = function(
			text,
			resource
		){
			return (!resource.mid || resource.tag.hasAbsMid || !bc.insertAbsMids) ?
				text : text.replace(/(define\s*\(\s*)(.*)/, "$1\"" + resource.mid + "\", $2");
		},

		getCacheEntry = function(
			pair
		){
			return "'" + pair[0] + "':" + pair[1];
		},

		getDiscreteLocales = function(locale){
			for(var locales = locale.split("-"), result = [], current = "", i= 0; i<locales.length; i++){
				result.push(current += (i ? "-" : "") + locales[i]);
			}
			return result;
		},

		getFlattenedNlsBundles = function(
			resource,
			rootBundles,
			noref
		){
			var newline = bc.newline,
				match= resource.dest.match(/(.+)\/([^\/]+)\.js$/),
				rootPath = match[1] + "/nls/" + match[2],
				result = {};
			bc.localeList.forEach(function(locale){
				var locales = getDiscreteLocales(locale),
					cache = [];
				rootBundles.forEach(function(bundleRoot){
					var prefix = bundleRoot.prefix,
						bundle = "/" + bundleRoot.bundle;
					locales.forEach(function(locale){
						if(bundleRoot.localizedSet[locale]){
							var mid = prefix + locale + bundle,
								module = bc.amdResources[mid];
							if(module){
								cache.push("'" + mid + "':function(){" + newline + module.getText() + newline + "}");
							}else{
								//TODO real msg
								console.log("NOT FOUND");
							}
						}
					});
				});
				if(cache.length && noref){
					cache.push("'*noref':1");
				}
				result[rootPath + "_" + locale + ".js"] = cache.length ? "require({cache:{" + newline + cache.join("," + newline) + "}});" + newline : "";
			});
			return result;
		},

		getLayerText= function(
			resource,
			include,
			exclude,
			noref
		) {
			var
				newline = bc.newline,
				rootBundles = [],
				cache= [],
				moduleSet= computeLayerContents(resource, include, exclude);
			for (var p in moduleSet) if(!resource || p!=resource.mid){
				var module= moduleSet[p];
				if (module.internStrings) {
					cache.push(getCacheEntry(module.internStrings()));
				} else if(module.getText){
					cache.push("'" + p + "':function(){" + newline + module.getText() + newline + "}");
				} else {
					bc.log("amdMissingLayerModuleText", ["module", module.mid, "layer", resource.mid]);
				}
				if(module.localizedSet){
					// this is a root NLS bundle
					rootBundles.push(module);
				}
			}
			var text= "";
			if(resource){
				text= insertAbsMid(resource.getText(), resource);
			}
			if(cache.length && noref){
				cache.push("'*noref':1");
			}
			cache = cache.length ? "require({cache:{" + newline + cache.join("," + newline) + "}});" + newline : "";

			text = cache + newline + text;

			if(resource && resource.layer && resource.layer.postscript){
				text+= resource.layer.postscript;
			}

			if(resource && bc.localeList && rootBundles.length && resource.flattenedNlsBundles===undefined){
				resource.flattenedNlsBundles = getFlattenedNlsBundles(resource, rootBundles, noref);
			}

			return text;
		},

		getStrings= function(
			resource
		){
			var cache = [],
				newline = bc.newline;
			resource.deps && resource.deps.forEach(function(dep){
				if(dep.internStrings){
					cache.push(getCacheEntry(dep.internStrings()));
				}
			});
			return cache.length ? "require({cache:{" + newline + cache.join("," + newline) + "}});" + newline : "";
		},

		getDestFilename= function(resource){
			if(!resource.tag.nls && ((resource.layer && bc.layerOptimize) || (!resource.layer && bc.optimize))){
				return resource.dest + ".uncompressed.js";
			}else{
				return resource.dest;
			}
		},

		writeNls = function(rootResource, copyright, callback){
			// this is a root bundle; therefore write it *and* all of the localized bundles.
			var
				waitCount = 1, // matches *1*
				errors = [],
				onWriteComplete = function(err) {
					if(err){
						errors.push(err);
					}
					if(--waitCount==0){
						callback(rootResource, errors.length && errors);
					}
				},
				prefix = rootResource.prefix,
				bundle = "/" + rootResource.bundle,
				localizedSet = rootResource.localizedSet;
			for(var p in localizedSet){
				var mid = prefix + p + bundle,
					module = bc.amdResources[mid];
				if(!module){
					// TODO: add proper message log
					console.log("MISSING: " + mid);
				}else{
					var text = insertAbsMid(module.getText(), module);
					module.setText(text);
					var filename = getDestFilename(module);
					fileUtils.ensureDirectoryByFilename(filename);
					waitCount++; // matches *2*
					fs.writeFile(filename, bc.newlineFilter(copyright + "//>>built" + bc.newline + text, module, "writeAmd"), module.encoding, onWriteComplete); // *2*

				}
			}

			text = insertAbsMid(rootResource.getText(), rootResource);
			rootResource.setText(text);
			fs.writeFile(getDestFilename(rootResource), bc.newlineFilter(copyright + "//>>built" + bc.newline + text, rootResource, "writeAmd"), module.encoding, onWriteComplete); // *1*
			return callback;
		},

		write= function(resource, callback) {
			fileUtils.ensureDirectoryByFilename(resource.dest);

			var copyright;
			if(resource.pack){
				copyright= resource.pack.copyrightNonlayers && (resource.pack.copyright || bc.copyright);
			}else{
				copyright = bc.copyrightNonlayers &&  bc.copyright;
			}
			if(!copyright){
				copyright = "";
			}

			if(resource.tag.nls){
				return resource.localizedSet ? writeNls(resource, copyright, callback) : 0;
			}

			var text;
			if(resource.layer){
				if(resource.layer.boot || resource.layer.discard){
					// resource.layer.boot layers are written by the writeDojo transform
					return 0;
				}
				text= resource.layerText= getLayerText(resource, resource.layer.include, resource.layer.exclude, resource.layer.noref);
				if(resource.layer.compat=="1.6"){
					text+= "require(" + json.stringify(resource.layer.include) + ");" + bc.newline;
				}

				copyright= resource.layer.copyright || "";
			}else{
				text= insertAbsMid(resource.getText(), resource);
				text= (bc.internStrings ? getStrings(resource) : "") + text;
				resource.text= text;
			}

			var
				waitCount = 1, // matches *1*
				errors = [],
				onWriteComplete = function(err) {
					if(err){
						errors.push(err);
					}
					if(--waitCount==0){
						callback(resource, errors.length && errors);
					}
				};

			if(resource.flattenedNlsBundles){
				for(var p in resource.flattenedNlsBundles){
					waitCount++;
					fileUtils.ensureDirectoryByFilename(p);
					fs.writeFile(p, resource.flattenedNlsBundles[p], resource.encoding, onWriteComplete);
				}
			}

			fs.writeFile(getDestFilename(resource), bc.newlineFilter(copyright + "//>>built" + bc.newline + text, resource, "writeAmd"), resource.encoding, onWriteComplete);
			return callback;
		};
		write.getLayerText= getLayerText;
		write.getDestFilename= getDestFilename;
		write.computeLayerContents= computeLayerContents;

		return write;
});

