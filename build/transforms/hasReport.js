define(["../buildControl", "../stringify"], function(bc, stringify) {
	return function() {
		var 
			p, 
			features= bc.hasFeatures,
			sorted= [];
		for (p in features) {
			if (1 || !(p in bc.staticHasFeatures)) sorted.push([[p], features[p]]);
		}
		sorted.sort(function(lhs, rhs){ return lhs[0]<rhs[0] ? -1 : (lhs[0]>rhs[0] ? 1 : 0); });

		var sort= function(set) {
			var sorted= [];
			for (var p in set) {
				sorted.push(p);
			}
			return sorted.sort();
		};

		console.log("staticHasFeatures= {");
		console.log(sorted.map(function(item) {
			return "	// " + sort(item[1]).join(", ") + "\n	 '" + item[0] + "':1";
		}).join(",\n\n"));
		console.log("};");
		return 0;
	};
});
