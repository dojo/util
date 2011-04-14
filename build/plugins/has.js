define(["dojo/regexp"], function(dojoRegExp) {
	// TODO: this implementation resolves and removed the has! expression at build time; need to make this optional

	return {
		start:function(
			id,
			referenceModule,
			bc
		) {
			var hasPlugin= bc.amdResources["dojo*has"];
			if (!hasPlugin) {
				throw new Error("has! plugin missing");
			}
	
			var 
				has = function(featureId) {
					return bc.staticHasFeatures[featureId];
				},
				tokens = id.match(/[\?:]|[^:\?]*/g), 
				i = 0,
				get = function(skip){
					var operator, term = tokens[i++];
					if(term == ":"){
						// empty string module name, resolves to undefined
						return undefined;
					}else{
						// postfixed with a ? means it is a feature to branch on, the term is the name of the feature
						if(tokens[i++] == "?"){
							if(!skip && has(term)){
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
				};
			var 
				resolvedId = get(),
				dependentModuleInfo= resolvedId && bc.getSrcModuleInfo(resolvedId, referenceModule);
			if(dependentModuleInfo){
				var module= bc.amdResources[dependentModuleInfo.pqn];
				if (module) {
					var regex= new RegExp("(dojo\/)|([./]+)" + dojoRegExp.escapeString("has!" + id), "g");
					referenceModule.text= referenceModule.text.replace(regex, resolvedId);
					return [hasPlugin, module];
				} else {
					bc.logError("failed to resolve has! dependency (" + dependentModuleInfo.pqn + ") for module (" + resource.src + ")");
					return [hasPlugin];
				}
			}else{
				return [hasPlugin];
			}
		}
	};
});
