/* 
	params: 
		hostenvType: 
			we expect to have hostenvType defined, but we provide "browser" if
			it's not defined.
		dependencies:
			an Array of strings in the form normally accepted by
			dojo.hostenv.loadModule("..."), although it is acceptable to
			include the whole loadModule("...") call.
*/

load('buildUtil.js');

//print(dojo.hostenv.loadedUris.join(",\n"));
print(buildUtil.getDependencyList(this['dependencies'], this['hostenvType']).join(",\n").depList);
