dojo.provide("shrinksafe.tests.module");

function compress(path){
	path = "../shrinksafe/tests/" + path;
	return new String(Packages.org.dojotoolkit.shrinksafe.Compressor.compressScript(readFile(path), 0, 1)).toString();
}
try{
	eval(compress("5303.js"));
	doh.assertEqual("hello worldhello world", result);
}catch(e){
	doh.debug(e);
}
