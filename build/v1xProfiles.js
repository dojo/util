define([
	"require",
	"./buildControlBase",
	"./fs", "./fileUtils",
	"./process",
	"dojo",
	"dojo/text!./copyright.txt",
	"dojo/text!./buildNotice.txt"], function(require, bc, fs, fileUtils, process, dojo, defaultCopyright, defaultBuildNotice) {
	eval(require.scopeify("./fs, ./fileUtils"));
	var
		defaultBuildProps= {
			// v1.6- default values
			profile:"base",
			profileFile:"",
			htmlFiles:"",
			htmlDir:"",
			version:"0.0.0.dev",
			localeList:"ar,ca,cs,da,de-de,el,en-gb,en-us,es-es,fi-fi,fr-fr,he-il,hu,it-it,ja-jp,ko-kr,nl-nl,nb,pl,pt-br,pt-pt,ru,sk,sl,sv,th,tr,zh-tw,zh-cn",
			releaseName:"dojo",
			releaseDir:"../../release/",
			internStrings:true,
			optimize:"",
			layerOptimize:"shrinksafe",
			cssOptimize:"",
			cssImportIgnore:"",
			stripConsole:"normal",
			copyTests:false,
			mini:true,
			xdDojoPath:"",
			symbol:"",
			scopeDjConfig:"",
			scopeMap:{},
			buildLayers:"",
			query:"default",
			replaceLoaderConfig:1,

			// the following configuration variables are deprecated and have no effect
			//log:0,
			//loader:0,
			//xdScopeArgs:0,
			//xdDojoScopeName:0,
			//expandProvide:0,
			//removeDefaultNameSpaces:0,
			//addGuards:0,

			// the following values are settings understood by the v1.7+ builder that cause behavior like the v1.6- builder

			// if we're building consequent to a profile, then don't include a default package
			noDefaultPackage:1,
			destPackageBasePath:".",

			packages:[],

			staticHasFeatures: {
				'dojo-boot':0,
				'host-browser':1
/*
				'dojo-boot':0,
				'dojo-debug-messages':0,
				'dojo-guarantee-console':0,
				'dojo-load-firebug-console':0,
				'dojo-loader':1,
				'dojo-register-openAjax':0,
				'dojo-sniff':1,
				'dojo-test-sniff':1,
				'dojo-test-xd':1,
				'dojo-v1x-i18n-Api':1,
				'dom':1,
				'host-browser':1,
				'host-node':0,
				'host-rhino':0,
				"dojo-has-api":1,
				'dojo-loader-catches':1,
				'dojo-error-api':1,
				'dojo-inject-api':1,
				'dojo-pageload-api':1,
				'dojo-ready-api':1,
				'dojo-xhr-factory':1,
				'dojo-publish-privates':1, // TODO: change to
				'dojo-requirejs-api':0,
				'dojo-sniff':0,
				'dojo-timeoutApi':1,
				'dojo-trace-api':1,
				'dojo-undef-api':0,
				"dojo-gettext-api":1
*/
			},

			bootConfig: {
				hasCache:{
					"host-browser":1,
					"dom":1,
					"dojo-amd-factory-scan":1,
					"dojo-loader":1,
					"dojo-has-api":1,
					"dojo-xhr-factory":1,
					"dojo-inject-api":1,
					"dojo-timeout-api":1,
					"dojo-trace-api":1,
					"dojo-log-api":1,
					"dojo-loader-catches":0,
					"dojo-dom-ready-api":1,
					"dojo-dom-ready-plugin":1,
					"dojo-ready-api":1,
					"dojo-error-api":1,
					"dojo-publish-privates":1,
					"dojo-gettext-api":1,
					"dojo-config-api":1,
					"dojo-sniff":1,
					"config-tlmSiblingOfDojo":1,
					"dojo-sync-loader":1,
					"dojo-test-sniff":1,
					"dojo-xdomain-test-api":1
				},

				packages: [{
					// note: like v1.6-, this bootstrap computes baseUrl to be the dojo directory
					name:'dojo',
					location:'.',
					lib:'.'
				}]
			}
		},

		processProfile= function(profile, args) {
			// process a v1.6- profile
			//
			// v1.6- has the following relative path behavior:
			//
			//	 * the util/buildscripts directory is assumed to be the cwd upon build program startup
			//	 * the dojo directory as specified in profile dependencies.prefixes (if relative) is
			//     assumed to be relative to util/buildscripts
			//	 * similarly the releaseDir directory (if relative) is assumed to be relative to util/buildscripts
			//	 * all other relative paths are relative to the dojo directory (in spite of what some docs say)
			//	 * all non-specified paths for top-level modules are assummed to be siblings of dojo.
			//     For example, myTopModule.mySubModule is assumed to reside at dojo/../myTopModule/mySubModule.js
			//
			// This has the net effect of forcing the assumption that build program is be executed from util/buildscripts.
			// when relative paths are used; this may be convenient. The behavior is probably consequent to rhino's design
			// that does not report the full path of the script being executed. In order to help, the following v1.7+
			// options are available:
			//
			//	 -buildPath path/to/util/buildscripts/build
			//	 -baseUrl	path/to/use/instead/of/path/to/util/buildscripts
			//
			// This doesn't eliminiate the strange behavior of releaseDir. Users who find releaseDir inconvenient should
			// use destBasePath.

			var
				p,
				result= {},
				layers= profile.layers || [],
				prefixes= profile.prefixes || [],
				copyright= profile.copyright!==undefined ? profile.copyright : defaultCopyright,
				buildNotice= profile.buildNotice!==undefined ? profile.buildNotice : defaultBuildNotice,
				getTopLevelModule= function(mid){
					return mid.split(".")[0];
				};

			for (p in defaultBuildProps) {
				result[p]= defaultBuildProps[p];
			}

			// find all the top-level modules by traversing each layer's dependencies
			var topLevelMids= {dojo:1};
			layers.forEach(function(layer){
				(layer.dependencies || []).forEach(function(mid) {
					// pair a [mid, path], mid, a dotted module id, path relative to dojo directory
					topLevelMids[getTopLevelModule(mid)]= 1;
				});
			});

			// convert the prefix vector to a map; make sure all the prefixes are in the top-level map
			var prefixMap= {}, copyrightMap= {};
			prefixes.forEach(function(pair){
				topLevelMids[pair[0]]= 1;
				prefixMap[pair[0]]= pair[1];
				copyrightMap[pair[0]]= pair[2];
			});

			// make sure we have a dojo prefix; memorize it
			var activeDojoPath= fileUtils.computePath(require.nameToUrl("dojo/package.json").match(/(.+)\/package\.json$/)[1], process.cwd());
			if(!prefixMap.dojo) {
				// use the loader to find the real dojo path
				prefixMap.dojo= activeDojoPath;
			}else{
				if (profile.basePath===undefined && /^\./.test(prefixMap.dojo) && compactPath(catPath(activeDojoPath, "../util/buildscripts"))!=process.cwd()){
					bc.logWarn("did not specify profile.basePath, yet did specify a relative dojo path and running build with the current working directory different than util/buildscripts");
				}
				if(computePath(prefixMap.dojo, profile.basePath || process.cwd())!=activeDojoPath){
					bc.logWarn("dojo path specified in profile is different than the dojo being used for the build program");
				}
			}

			var dojoPath= prefixMap.dojo= compactPath(prefixMap.dojo);

			// make sure we have a prefix for each top-level module
			// normalize dojo out of the non-dojo prefixes
			for(var mid in topLevelMids){
				var path= prefixMap[mid] || ("../" + mid);
				if (mid!="dojo") {
					prefixMap[mid]= computePath(path, dojoPath);
				}
			}

			// now make a package for each top-level module
			var packages= result.packages= [];
			for(mid in prefixMap){
				packages.push({
					name:mid,
					location:prefixMap[mid],
					lib:".",
					copyright:copyrightMap[mid]!==undefined ? copyrightMap[mid] : defaultCopyright
				});
			}

			// remember the doh package info (this is done here to get the location
			// this will be added to packages in buildControl after the command line
			// switches are processed (remember, they're not processed here
			result.dohPackageInfo= {
					name:"doh",
					location:dojoPath + "/../util/doh",
					lib:".",
					destLocation:"util/doh"
			};

			// resolve all the layer names into module names;
			var
				filenameToMid= function(filename) {
					for (var topLevelMid in prefixMap) {
						if (filename.indexOf(prefixMap[topLevelMid])==0) {
							var
								mid= filename.substring(prefixMap[topLevelMid].length),
								match= mid.match(/(.+)\.js$/);
							if (match) {
								return topLevelMid + match[1];
							}
						}
					}
					return 0;
				},
				layerNameToLayerMid= {};
			layers.forEach(function(layer) {
				var mid= filenameToMid(computePath(layer.name, dojoPath));
				if (!mid) {
					bc.logError("unable to resolve layer name (" + layer.name + ") into a module identifier");
					return;
				}
				layerNameToLayerMid[layer.name]= mid;
			});

			var
				getLayerCopyrightMessage= function(explicit, mid){
					// this is a bit obnoxious as a default, but it's the v1.6- behavior
					// TODO: consider changing
					if(explicit!==undefined){
						return explicit;
					}
					if(copyrightMap[getTopLevelModule(mid)]!==undefined){
						return copyrightMap[getTopLevelModule(mid)];
					}else{
						return defaultCopyright + defaultBuildNotice;
					}
				},
				fixedLayers= {"dojo/dojo": {copyright:defaultCopyright + defaultBuildNotice, include:["dojo"], exclude:[]}};
			layers.forEach(function(layer) {
				var
					mid= layerNameToLayerMid[layer.name],
					result= {
						copyright:getLayerCopyrightMessage(layer.copyright, mid),
						include:(layer.dependencies || []).map(function(item) { return item.replace(/\./g, "/"); }),
						exclude:(layer.layerDependencies || []).map(function(item) {
							var mid= layerNameToLayerMid[item];
							if (!mid) {
								bc.logError("unable to resolve layer dependency (" + item + ") in layer (" + layer.name + ")");
							}
							return mid;
						})
					};
				if(mid=="dojo/dojo"){
					if(!layer.customBase){
						result.include.push("dojo");
					}
				}else{
					result.exclude.push("dojo");
				}
				if (layer.discard) {
					result.discard= true;
				}
				if(layer.boot){
					result.boot= true;
				}
				if (layer.copyright) {
					result.copyright= layer.copyright;
				}
				fixedLayers[mid]= result;
			});
			result.layers= fixedLayers;

			if (profile.destBasePath) {
				if (profile.releaseDir || profile.releaseName) {
					bc.logWarn("destBasePath given; ignoring releaseDir and releaseName");
				}
			} else {
				var
					releaseName= (profile.releaseName || args.releaseName || result.releaseName).replace(/\\/g, "/"),
					releaseDir= (profile.releaseDir || args.releaseDir || result.releaseDir).replace(/\\/g, "/");
				profile.destBasePath= computePath(catPath(releaseDir, releaseName), profile.basePath);
			}

			for (p in profile) {
				// the conditional is to keep v1.6- compat
				// TODO: recognition of "false" should be deprecated
				if (/loader|xdScopeArgs|xdDojoScopeName|expandProvide|removeDefaultNameSpaces|addGuards/.test(p)) {
					profile[p]= "deprecated; value(" + profile[p] + ") ignored";
				}
				result[p=="layers" ? "rawLayers" : p]= profile[p]=="false" ? false : profile[p];
			}
			result.localeList = result.localeList.split(",");

			// TODOC: we now take care of the console without shrink safe
			// TODO/TODOC: burn in dojoConfig, djConfig
			// TODO/TODOC: dojoConfig, djConfig should be able to be objects (string restrinction lifted)
			// TODOC: action is assumed to be build, no more clean, help if you want it explicitly

			bc.defaultConfig= {
				hasCache: bc.hasCache || {
					"host-browser":1,
					"dom":1,
					"dojo-loader":1,
					"dojo-has-api":1,
					"dojo-xhr-factory":1,
					"dojo-inject-api":1,
					"dojo-timeout-api":1,
					"dojo-trace-api":1,
					"dojo-log-api":1,
					"dojo-loader-catches":1,
					"dojo-dom-ready-api":1,
					"dojo-dom-ready-plugin":1,
					"dojo-ready-api":1,
					"dojo-error-api":1,
					"dojo-publish-privates":1,
					"dojo-gettext-api":1,
					"dojo-config-api":1,
					"dojo-sniff":1,
					"dojo-sync-loader":1,
					"dojo-test-sniff":1
				}
			};

			return result;
		},

		processProfileFile= function(filename, args){
			var text= readFileSync(filename, "utf8");

			//Remove the call to getDependencyList.js because it is not supported anymore.
			if (/load\(("|')getDependencyList.js("|')\)/.test(text)) {
				bc.logWarn("load(\"getDependencyList.js\") is no supported.");
				text.replace(/load\(("|')getDependencyList.js("|')\)/, "");
			}

			// how about calling it a profile (instead of v1.6- dependencies)...
			var profile= (function(__text){
				var
					// the logger is currently depricated; stub it out so profiles to cause exceptions on undefined
					// TODO: should we bring this back?
					noop = function(){},
					logger = {
						TRACE: 0,
						INFO: 1,
						WARN: 2,
						ERROR: 3,
						level: 0,
						logPrefix: "",
						trace:noop,
						info:noop,
						warn:noop,
						error:noop,
						_print:noop
					},
					dependencies= {};
				eval(__text);
				return dependencies;
			})(text);
			return processProfile(profile, args);
		},

		processHtmlFiles= function(files){
			bc.logInfo("html files: " + files.join(", "));
			var
				layers = {},
				prefix = "",
				prefixes = {dijit: true, dojox: true};
			files.forEach(function(htmlFile){
				var
					priorLayers = [],
					addLayer = function(scriptName){
						if(layers[scriptName]){
						// if this module has been added before, find the intersection of dependencies
							layers[scriptName] = layers[scriptName].filter(function(scriptName){
								return priorLayers.indexOf(scriptName) > -1;
							});
						}else{
							layers[scriptName] = priorLayers.concat();
						}
						if(scriptName.indexOf('.') > -1){
							prefixes[scriptName.substring(scriptName, scriptName.indexOf('.'))] = true;
						}
						priorLayers.push(scriptName);
					};

				var html = fs.readFileSync(htmlFile);
				html.replace(/<script [^>]*src=["']([^'"]+)["']/gi, function(t, scriptName){
					// for each script tag
					if(scriptName.indexOf("dojo/dojo.js") > -1){
						// use dojo.js to determine the prefix for our namespaces
						prefix = scriptName.substring(0, scriptName.indexOf("dojo/dojo.js"));
					}else{
						// non-dojo.js script files, add it to our list of layers
						addLayer(scriptName = scriptName.substring(prefix.length, scriptName.length - 3).replace(/\//g, '.'));
					}
				});
				html.replace(/dojo\.require\(["']([^'"]+)["']\)/g, function(t, scriptName){
					// for each dojo.require call add it to the layers as well
					addLayer(scriptName);
				});
			});

			var prefixPaths = [];
			// normalize the prefixes into the arrays that the build expects
			for(prefix in prefixes){
				prefixPaths.push([prefix, "../" + prefix]);
			}
			var layersArray = [];
			for(var name in layers){
				// for each layer, create a layer object
				layersArray.push({
					name: "../" + name.replace(/\./g,'/') + ".js", // use filename
					dependencies: [
						name.replace(/\//g,'.') // use module name
					],
					//use all previous layers as layer dependencies
					layerDependencies: layers[name].map(function(name){
						return "../" + name.replace(/\./g,'/') + ".js";
					})
				});
			}
			var profileProperties = {
				layers: layersArray,
				prefixes: prefixPaths
			};
			if(bc.profileFile){
				fs.writeFileSync(bc.profileFile, "dependencies = " + dojo.toJson(profileProperties), "utf8");
			}
			processProfile(profileProperties);
		};

	return {
		processProfile:processProfile,
		processProfileFile:processProfileFile,
		processHtmlFile:processHtmlFiles
	};
});
