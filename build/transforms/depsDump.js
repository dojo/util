define(["../buildControl", "../stringify"], function(bc, stringify) {
	return function() {
		var
			modules= [],
			midToId= {},
			i= 0,
			resource, p;
		for (p in bc.resources) {
			resource= bc.resources[p];
			if (resource.deps && !resource.test && !/\/nls\//.test(resource.src) && resource.pqn!="dojo*_base" && resource.pqn!="dojo*_base/browser" && (resource.pqn=="dojo*main" || /_base/.test(resource.pqn))) {
				resource.deps.forEach(function(module){
					//console.log('"' + resource.path + '" -> "' + module.path + '";');
				});
				resource.uid= i;
				midToId[bc.resources[p].path]= i;
				modules.push(resource);
				i++;
			}
		}
		var depsTree= modules.map(function(module) {
			return module.deps.map(function(item){ return item.uid; });
		});

		var
			idTree= {},
			getItem= function(parts, bag) {
				var part= parts.shift();
				if (!(part in bag)) {
					bag[part]= {};
				}
				if (parts.length) {
					return getItem(parts, bag[part]);
				} else {
					return bag[part];
				}
			};
		modules.forEach(function(item, i) {
			var parts= item.path.split("/");
			getItem(parts, idTree)["*"]= i;
		});
//console.log(stringify(depsTree));
//console.log(stringify(idTree));

		// depsTree and idTree now hold all the info need to pass to the client to do 100% client-side
		// deps tracing
	};
});
