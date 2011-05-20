define(["../buildControl", "../version"], function(bc, version) {
	return function(resource, callback) {
		resource.reports.push({
			dir:".",
			filename:"build-report.txt",
			content: function(){
				var result= "";

				result+= "build started: " + bc.startTimestamp + "\n";
				result+= "build application version: " + version + "\n";

				result+= "Messages:\n";
				result+= bc.messages.join("\n") + "\n\n";

				result+= "Layer Contents:\n";
				for(var p in bc.resources){
					resource= bc.resources[p];
					if(resource.moduleSet){
						result+= resource.path + ":\n";
						var moduleSet= resource.moduleSet;
						for(var q in moduleSet){
							result+= "\t" + moduleSet[q].path + "\n";
						}
						result+= "\n";
					}
				}

				result+= "Optimizer Messages:\n";
				result+= bc.optimizerOutput;

				result+= "build finished: " + new Date() + "\n";
				return result;
			}
		});
		return 0;
	};
});
