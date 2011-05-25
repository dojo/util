define(["dojo/regexp"], function(dojoRegExp) {
	return {
		start:function(
			id,
			referenceModule,
			bc
		) {
			var
				getHasPluginDependency= function(){
					var hasPlugin= bc.amdResources["dojo*has"];
					if(!hasPlugin){
						bc.logError("failed to find dojo/has! plugin");
						return [];
					}else{
						return [hasPlugin];
					}
				},

				has = function(featureId) {
					var value = bc.staticHasFeatures[featureId];
					return (value===undefined || value==-1) ? undefined : value;
				},

				tokens = id.match(/[\?:]|[^:\?]*/g),

				i = 0,

				get = function(skip){
					var operator, term = tokens[i++];
					if(term == ":"){
						// empty string module name; therefore, no dependency
						return "";
					}else{
						// postfixed with a ? means it is a feature to branch on, the term is the name of the feature
						if(tokens[i++] == "?"){
							var hasResult= has(term);
							if(hasResult===undefined){
								return undefined;
							}else if(!skip && hasResult){
								// matched the feature, get the first value from the options
								return get();
							}else{
								// did not match, get the second value, passing over the first
								get(true);
								return get(skip);
							}
						}
						// a module
						return term;
					}
				},

				resolvedId = get();

			// we only need the plugin if we need to resolve at run time
			if(resolvedId===undefined){
				bc.logInfo("module identifier (" + id + ") could not be resolved during build-time");
				return getHasPluginDependency();
			}else if(!resolvedId){
				return [];
			}else{
				var
					moduleInfo= bc.getSrcModuleInfo(resolvedId, referenceModule),
					module= bc.amdResources[moduleInfo.pqn];
				if(module){
					var regex= new RegExp("(dojo\\/)|([./]+)has\\!" + dojoRegExp.escapeString(id), "g");
					referenceModule.text= referenceModule.text.replace(regex, resolvedId);
					return [module];
				}else{
					bc.logError("failed to resolve has! dependency (" + moduleInfo.pqn + ")" + (referenceModule ? " for module (" + referenceModule.src + ")" : ""));
					return getHasPluginDependency();
				}
			}
		}
	};
});
