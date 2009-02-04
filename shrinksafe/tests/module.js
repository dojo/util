dojo.provide("shrinksafe.tests.module");

doh.compress = function(path){
	path = "../shrinksafe/tests/" + path;
	return new String(Packages.org.dojotoolkit.shrinksafe.Compressor.compressScript(readFile(path), 0, 1)).toString();
}

try{
	tests.register("nestedReference", 
	[
		function(t){
			eval(doh.compress("5303.js"));
			t.assertEqual("hello worldhello world", result);
		}
	]);
}catch(e){
	doh.debug(e);
}
