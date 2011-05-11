define(["../buildControl"], function(bc) {
	return function(resource) {
		var
			aggregateDeps= [],

			define= function(mid, dependencies, factory) {
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

			processWithRegExs= function() {
				// do it the hard (unreliable) way; first try to find "dojo.provide" et al since those names are less likely
				// to be overloaded than "define" and "require"

				// TODO: the naive regex process that's used below may fail to properly recognize the semnatics of the code.
				// There is no way around this other than a proper tokenizer and parser. Note however, this kind of process
				// has been in use with the v1.6- build system for a long time.
				// TODO: provide a way to let the build user provide an execution environment for applications like dojo.requireIf
				var
					// strip comments...string and regexs in the code may cause this to fail badly
					contents= resource.text.replace(/(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg , ""),

					// look for dojo.require et al; notice that only expressions *without* parentheses are understood
					dojoExp= /dojo\.(require|platformRequire|provide|requireLocalization|requireAfterIf|requireIf)\s*\(([\w\W]+?)\)/mg,

					// string-comma-string (with optional whitespace
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

					if (!dojoV1xLoaderModule) {
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
		if (resource.tag.amd || /\/\/>>\s*pure-amd/.test(resource.text)) {
			processPureAmdModule();
		} else {
			processWithRegExs();
		}

		// resolve the dependencies into modules
		var deps= resource.deps;
		aggregateDeps.forEach(function(dep) {
			if (!(/(require)|(export)|(module)/.test(dep))) {
				try {
					var module= getAmdModule(dep, resource);
					if (module instanceof Array) {
						module.forEach(function(module){ deps.push(module); });
					} else if (module) {
						deps.push(module);
					} else {
						bc.logError("failed to resolve dependency (" + dep + ") for module (" + resource.src + ")");
					}
				} catch (e) {
					bc.logError("failed to resolve dependency (" + dep + ") for module (" + resource.src + ")", e);
				}
			}
		});
	};
});
