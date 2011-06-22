define(["../buildControl", "../fileUtils", "dojo/json", "../fs"], function(bc, fileUtils, json, fs) {
	return function(resource) {
		var
			absMid = 0,

			deps,

			aggregateDeps= [],

			defineApplied= 0,

			define= function(mid, dependencies, factory) {
				defineApplied= 1;
				var
					arity= arguments.length,
					args= 0,
					defaultDeps= ["require", "exports", "module"];

				// TODO: add the factory scan?
				if (0) {
					if (arity==1) {
						dependencies= [];
						mid.toString()
							.replace(/(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg, "")
							.replace(/require\(["']([\w\!\-_\.\/]+)["']\)/g, function (match, dep) {
								dependencies.push(dep);
							});
						args= [0, defaultDeps.concat(dependencies), mid];
					}
				}
				if (!args) {
					args= arity==1 ? [0, defaultDeps, mid] :
						(arity==2 ? (mid instanceof Array ? [0, mid, dependencies] : [mid, defaultDeps, dependencies]) :
							[mid, dependencies, factory]);
				}

				absMid = args[0];
				deps= args[1];
				aggregateDeps= aggregateDeps.concat(deps);
			},

			require= function(depsOrConfig, callbackOrDeps) {
				if (depsOrConfig instanceof Array) {
					aggregateDeps= aggregateDeps.concat(depsOrConfig);
				} else {
					aggregateDeps= aggregateDeps.concat(depsOrConfig.deps || []);
					(callbackOrDeps instanceof Array) && (aggregateDeps= aggregateDeps.concat(callbackOrDeps));
				}
			},

			dojoProvideList= [],

			dojo= {
				require: function(a, b) {
					aggregateDeps.push(a.replace(/\./g, "/"));
				},
				platformRequire: function(modMap) {
					// see dojo/_base/loader
					var result = (modMap.common || []).concat(modMap[bc.platform] || modMap["default"] || []);
					result.forEach(function(item){
						if(item instanceof Array){
							aggregateDeps.push(item[1].replace(/\./g, "/"));
						}else{
							aggregateDeps.push(item.replace(/\./g, "/"));
						}
					});
				},
				requireLocalization: function(a, b) {
					aggregateDeps.push("dojo/i18n!" + a.replace(/\./g, "/")	 + "/nls/" + b.replace(/\./g, "/"));
				},
				provide: function(a) {
					dojoProvideList.push(a);
				}
			},

			getAmdModule= function(
				mid,
				referenceModule
			) {
				var match= mid.match(/^([^\!]+)\!(.*)$/);
				if (match) {
					var
						pluginId= bc.getSrcModuleInfo(match[1], referenceModule).pqn,
						pluginProc= bc.plugins[pluginId];
					return pluginProc ? pluginProc.start(match[2], referenceModule, bc) : 0;
				} else {
					var
						moduleInfo= bc.getSrcModuleInfo(mid, referenceModule),
						module= moduleInfo && bc.amdResources[moduleInfo.pqn];
					return module;
				}
			},

			tagAbsMid = function(){
				if(absMid && absMid!=resource.path){
					bc.logError("AMD module (" + resource.src + ") specified an absolute module identifier that is not consistent with the configuration and filename");
				}
				if(absMid){
					resource.tag.hasAbsMid = 1;
				}
			},

			processPureAmdModule= function() {
				// find the dependencies for this resource using the fast path if the module says it's OK
				// pure AMD says the module can be executed in the build environment
				// note: the user can provide a build environment with TODO
				try {

					var f= new Function("define", "require", resource.text);
					f(define, require);
					tagAbsMid();
				} catch (e) {
					bc.logError("unable to evaluate pure AMD module in " + resource.src + "; error follows...", e);
				}
			},

			isObject= function(it){
				return typeof it=="object" && !(it instanceof Array) && it!==null;
			},

			amdBundle= {},

			syncBundle= {},

			evalNlsResource= function(text){
				try{
					var f= new Function("define", resource.text);
					f(define);
					if(defineApplied){
						return amdBundle;
					}
				}catch(e){
				}
				try{
					var result= eval(text);
					return isObject(result) ? syncBundle : 0;
				}catch(e){
				}
				return 0;
			},

			// the following is a direct copy from the v1.6- build util; this is so janky, we dare not touch
			interningDojoUriRegExpString = "(((templatePath|templateCssPath)\\s*(=|:)\\s*)dojo\\.(module)?Url\\(|dojo\\.cache\\s*\\(\\s*)\\s*?[\\\"\\']([\\w\\.\\/]+)[\\\"\\'](([\\,\\s]*)[\\\"\\']([\\w\\.\\/-]*)[\\\"\\'])?(\\s*,\\s*)?([^\\)]*)?\\s*\\)",
			//                              123                                 4                5                                                     6                      78                   9                         0           1

			interningGlobalDojoUriRegExp = new RegExp(interningDojoUriRegExpString, "g"),

			interningLocalDojoUriRegExp = new RegExp(interningDojoUriRegExpString),

			internStrings = function(){
				var
					shownFileName = false,

					getText = function(src){
						return fs.readFileSync(src, "utf8");
					};

				resource.text= resource.text.replace(interningGlobalDojoUriRegExp, function(matchString){
					var parts = matchString.match(interningLocalDojoUriRegExp);

					if(!shownFileName){
						bc.logInfo("interning strings for : " + resource.src);
						shownFileName = true;
					}

					var textModuleInfo= bc.getSrcModuleInfo(fileUtils.catPath(parts[6].replace(/\./g, "/"), parts[9]), 0, true);
					if(bc.internStringsSkipList[textModuleInfo.path]){
						bc.logInfo("skipping " + textModuleInfo.path);
						return matchString;
					}

					var textModule = bc.resources[textModuleInfo.url];
					if(!textModule){
						bc.logInfo("could not find " + textModuleInfo.url);
						return matchString;
					}

					// note: it's possible the module is being processed by a set of transforms that don't add a
					// getText method (e.g., copy); therefore, we provide one for these cases
					var text = (textModule.getText && textModule.getText()) || getText(textModule.src);
					if(!text){
						bc.logInfo("skipping because there is nothing to intern " + textModuleInfo.path);
						return matchString;
					}

					text = json.stringify(text);

					if(matchString.indexOf("dojo.cache") != -1){
						//Handle dojo.cache-related interning.
						var endContent = parts[11];
						if(!endContent){
							endContent = text;
						}else{
							var braceIndex = endContent.indexOf("{");
							if(braceIndex != -1){
								endContent = endContent.substring(0, braceIndex + 1)
									+ 'value: ' + text + ','
									+ endContent.substring(braceIndex + 1, endContent.length);
							}
						}
						return 'dojo.cache("' + parts[6] + '", "' + parts[9] + '", ' + endContent + ')';
					}else if(parts[3] == "templatePath"){
						//Replace templatePaths
						return "templateString" + parts[4] + text;
					}else{
						//Dealing with templateCssPath; not doing this anymore
						return matchString;
					}
				});
			},

			processWithRegExs= function() {
				// do it the hard (unreliable) way; first try to find "dojo.provide" et al since those names are less likely
				// to be overloaded than "define" and "require"

				// TODO: the naive regex process that's used below may fail to properly recognize the semnatics of the code.
				// There is no way around this other than a proper tokenizer and parser. Note however, this kind of process
				// has been in use with the v1.x build system for a long time.
				// TODO: provide a way to let the build user provide an execution environment for applications like dojo.requireIf
				// TODO: add scanning for dojo.cache for intern strings support of old-style modules
				var
					// strip comments...string and regexs in the code may cause this to fail badly
					contents= resource.text.replace(/(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg , ""),

					// look for dojo.require et al; notice that only expressions *without* parentheses are understood
					dojoExp= /dojo\.(require|platformRequire|provide|requireLocalization)\s*\(([\w\W]+?)\)/mg,

					requireProvideArgCheck= /^\s*['"][^'"]+?['"]\s*$/,

					platformRequireArgCheck= /^\s*\{[\w\W]+\}\s*$/,

					// string-comma-string with optional whitespace
					requireLocalizationFixup= /^\s*['"][^'"]+?['"]\s*,\s*['"][^'"]+?['"]/,

					dojoV1xLoaderModule= 0,
					result, f;

				// look for dojo loader applications
				while((result= dojoExp.exec(contents)) != null) {
					// fix up requireLocalization a bit
					if (result[1]=="requireLocalization") {
						var fixup= result[2].match(requireLocalizationFixup);
						result= fixup ? "dojo.requireLocalization(" + fixup[0] + ")" : 0;
					} else if(result[1]=="platformRequire"){
						result= platformRequireArgCheck.test(result[2]) ? result[0] : 0;
					} else {
						result= requireProvideArgCheck.test(result[2]) ? result[0] : 0;
					}
					try {
						if (result) {
							dojoV1xLoaderModule= 1;
							resource.tag.synModule= 1;
							f= new Function("dojo", result);
							f(dojo);
						}else{
							bc.logInfo("(" + resource.src + ") did not process sync loader API: " + result[0]);
						}
					} catch (e) {
						bc.logWarn("unable to evaluate dojo loader function in " + resource.src + "; ignored function call; error and function text follows...", e, result);
					}
				}

				// check for multiple or irrational dojo.provides
				if (dojoProvideList.length) {
					if (dojoProvideList.length>1) {
						bc.logWarn("multiple dojo.provides given in a single resource (" + resource.src + ")");
					}
					dojoProvideList.forEach(function(item) {
						if (item.replace(/\./g, "/")!=resource.path) {
							bc.logWarn("dojo.provide module identifier (" + item + ") does not match resource location (" + resource.path + ")");
						}
					});
				}

				if(dojoV1xLoaderModule){
					if(bc.internStrings){
						internStrings();
					}
					var getText= resource.getText;
					resource.getText= function(){
						if (!this.replacementsApplied) {
							this.replacementsApplied= true;
							var
								depsSet= {},
								deps= ["\"dojo\"", "\"dijit\"", "\"dojox\""].concat(this.deps.map(function(dep){
									depsSet[dep.path.replace(/\//g, ".")]= 1;
									return "\"" + dep.path + "\"";
								})).join(","),

								// TODO: fix this for rescoping
								scopeArgs= "dojo, dijit, dojox",

								mid= "\"" + this.path + "\"",

								text= getText.call(this).replace(/dojo\.((require)|(provide))\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*/g, function(match, unused, require, provide, id){
									if(provide || id in depsSet){
										return "/* builder delete begin\n" + match + "\n builder delete end */\n";
									}else{
										return match;
									}
								});
							this.text= "define(" +
								(bc.writeAbsMids ? mid + "," : "") +
								"[" + deps + "], function(" + scopeArgs + "){\ndojo.getObject(" + mid.replace(/\//g, ".") + ", 1);\n" +
								text + "\nreturn dojo.getObject(" + mid.replace(/\//g, ".") + ");});\nrequire([" + mid + "]);\n";
						}
						return this.text;
					};
				}else{
					// look for AMD define
					var
						// look for define applications with an optional string first arg and an optional array second arg;
						// notice the regex stops after the second arg
						//          1                    2                   3      4                5
						defineExp= /(^|\s*)define\s*\(\s*(["'][^'"]+['"])?\s*(,)?\s*(\[[^\]]*?\])?\s*(,)?/g,

						// a test run in the console
						//test = [
						//	'define("test")',
						//	'define("test", ["test1"])',
						//	'define("test", ["test1", "test2"])',
						//	'define(["test1"])',
						//	'define(["test1", "test2"])',
						//	'define("test", ["test1"], function(test){ hello;})',
						//	'define("test", function(test){ hello;})',
						//	'define(["test1"], function(test){ hello;})',
						//	'define(function(test){ hello;})',
						//	'define({a:1})'
						//],

						// look for require applications with an array for the first arg;
						// notice the regex stops after the first arg
						requireExp= /(^|\s)require\s*\(\s*\[[^\]]*?\]/g,

						foundDefine = 0;
					while((result= defineExp.exec(contents)) != null) {
						try {
							foundDefine = 1;
							if(result[2]){
								// first arg a string
								if(result[3]){
									// first arg a module id
									if(result[5]){
										// (mid, deps, factory)
										result= result[0] + "{})";
									}else if(result[4]){
										// (mid, <array value>)
										result = result[0] + ")";
									}else {
										// (mid, factory)
										result = result[0] + "{})";
									}
								}else{
									// no comma after string first arg; therefore module value of a string
									result= result[0]  + ")";
								}
							}else if(result[4]){
								// first arg an array
								if(result[5]){
									// (deps, factory)
									result = result[0] + "{})";
								}else{
									// no comma after array first arg; therefore module value is an array
									result = result[0] + ")";
								}
							}else{
								//just a factory
								result = "define({})";
							}
							f= new Function("define", result);
							f(define);
							tagAbsMid();
						} catch (e) {
							bc.logWarn("unable to evaluate AMD define function in " + resource.src + "; ignored function call; error and function text follows...", e, result);
						}
					}
					// look for AMD require, iff no define since a require inside a define should not be processed
					if(!foundDefine){
						while((result= requireExp.exec(contents)) != null) {
							try {
								result= result[0] + ")";
								f= new Function("require", result);
								f(require);
							} catch (e) {
								bc.logWarn("unable to evaluate AMD require function in " + resource.src + "; ignored function call; error and function text follows...", e, result);
							}
						}
					}
				}
			};

		// scan the resource for dependencies
		if(resource.tag.nls){
			// either a v1.x sync bundle or an AMD bundle
			var nlsResult= evalNlsResource(resource.text);
			if(nlsResult===syncBundle){
				resource.tag.syncNls= 1;
				var
					match= resource.pqn.match(/(^.*\/nls\/)(([a-zA-Z\-]+)\/)?([^\/]+)$/),
					prefix= match[1],
					locale= match[3],
					bundle= match[4];
				if(locale){
					var
						rootPqn= prefix + bundle,
						rootBundle= bc.amdResources[rootPqn];
					if(rootBundle){
						var localizedSet= rootBundle.localizedSet || (rootBundle.localizedSet= {});
						localizedSet[locale]= 1;
					}else{
						bc.logWarn("module (" + resource.src + ") appeared to be a pre-AMD style (synchronous) i18n bundle, but there was no root bundle found.");
					}
				}

				var getText= resource.getText;
				resource.getText= function(){
					var text= getText.call(this);

					// this is frome the old builder...
					// If this is an nls bundle, make sure it does not end in a ; Otherwise, bad things happen.
					if(text.match(/\/nls\//)){
						text = text.replace(/;\s*$/, "");
					}

					if(this.localizedSet){
						// this is the root bundle
						var availableLocales= [];
						for(var p in this.localizedSet){
							availableLocales.push("\"" + p + "\":1");
						}
						return "define({root:\n" + text + ",\n" + availableLocales.join(",\n") + "\n});\n";
					}else{
						return "define(" + text + ");";
					}
				};
			}else if(nlsResult===amdBundle){
				processPureAmdModule();
			}else{
				bc.logWarn("module (" + resource.src + ") appeared to be an i18n bundle, but was not; it will be copied but otherwise ignored.");
			}
		}else if(resource.tag.amd || /\/\/>>\s*pure-amd/.test(resource.text)) {
			processPureAmdModule();
		}else{
			processWithRegExs();
		}

		// resolve the dependencies into modules
		deps= resource.deps;
		aggregateDeps.forEach(function(dep) {
			if (!(/^(require|exports|module)$/.test(dep))) {
				try {
					var module= getAmdModule(dep, resource);
					if (module instanceof Array) {
						module.forEach(function(module){ deps.push(module); });
					} else if (module) {
						deps.push(module);
					} else {
						bc.logWarn("failed to resolve dependency (" + dep + ") for module (" + resource.src + ")");
					}
				} catch (e) {
					bc.logWarn("failed to resolve dependency (" + dep + ") for module (" + resource.src + ")", e);
				}
			}
		});

	};
});
