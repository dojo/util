define(["../buildControl"], function(bc) {
	return function(resource) {
		var
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
				requireIf: function(a, b) {
					if (a) {
						aggregateDeps.push(b.replace(/\./g, "/"));
					}
				},
				requireAfterIf: function(a, b) {
					if (a) {
						aggregateDeps.push(b.replace(/\./g, "/"));
					}
				},
				platformRequire: function(a) {
					console.log("TODO:platformRequire");
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
				var match= mid.match(/^([^\!]+)\!(.+)$/);
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

			processPureAmdModule= function() {
				// find the dependencies for this resource using the fast path if the module says it's OK
				// pure AMD says the module can be executed in the build environment
				// note: the user can provide a build environment with TODO
				try {
					var f= new Function("define", "require", resource.text);
					f(define, require);
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
					dojoExp= /dojo\.(require|platformRequire|provide|requireLocalization|requireAfterIf|requireIf)\s*\(([\w\W]+?)\)/mg,

					// string-comma-string with optional whitespace
					requireLocalizationFixup= /^\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]/,

					// look for define applications with an optional string first arg and an array second arg;
					// notice the regex stops after the second arg
					defineExp= /(^|\s)define\s*\(\s*(["'][^'"]+['"]\s*,\s*)?\[[\w\W]*?\]/g,

					// look for require applications with an array for the first arg;
					// notice the regex stops after the first arg
					requireExp= /(^|\s)require\s*\(\s*\[[\w\W]*?\]/g,

					dojoV1xLoaderModule= 0,
					result;

					// look for dojo loader applications
					while((result= dojoExp.exec(contents)) != null) {
						// fix up requireLocalization a bit
						if (result[1]=="requireLocalization") {
							var fixup= result[2].match(requireLocalizationFixup);
							result= fixup ? "dojo.requireLocalization(" + fixup[0] + ")" : 0;
						} else {
							result= result[0];
						}
						try {
							if (result) {
								dojoV1xLoaderModule= 1;
								resource.tag.synModule= 1;
								var f= new Function("dojo", result);
								f(dojo);
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
									text + "\n});\nrequire([" + mid + "]);\n";
							}
							return this.text;
						};
					}else{
						// look for AMD define
						while((result= defineExp.exec(contents)) != null) {
							try {
								result= result[0] + ")";
								var f= new Function("define",result);
								f(define, require);
							} catch (e) {
								bc.logWarn("unable to evaluate AMD define function in " + resource.src + "; ignored function call; error and function text follows...", e, result);
							}
						}
						// look for AMD require
						while((result= requireExp.exec(contents)) != null) {
							try {
								result= result[0] + ")";
								var f= new Function("require", result);
								f(define, require);
							} catch (e) {
								bc.logWarn("unable to evaluate AMD require function in " + resource.src + "; ignored function call; error and function text follows...", e, result);
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
			if (!(/(require)|(export)|(module)/.test(dep))) {
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
