dojo.provide("shrinksafe.tests.module");

// basic helper functions for running multiple tests.
shrinksafe.tests.module.getContents = function(path){
	// summary: Load a file from this /tests/ path into a variable
	path = "../shrinksafe/tests/" + path;
	return readFile(path); // String
}

shrinksafe.tests.module.compress = function(source){
	// summary: Shorthand to compress some String version of JS code
	return new String(Packages.org.dojotoolkit.shrinksafe.Compressor.compressScript(source, 0, 1)).toString();
}

shrinksafe.tests.module.loader = function(path){
	// summary: Simple function to load and compress some file. Returns and object
	//	 with 'original' and 'compressed' members, respectively. 
	var s = shrinksafe.tests.module.getContents(path);
	return {
		original: s, 
		compressed: shrinksafe.tests.module.compress(s)
	};
}

try{
	tests.register("shrinksafe", 
	[
		function forwardReference(t){
			
			var src = shrinksafe.tests.module.loader("3241.js");

			t.assertTrue(src.original.length > src.compressed.length);
			t.assertTrue(src.compressed.indexOf("test") == -1)

			eval(src.compressed);
			t.assertEqual("data", result);
			delete result;
		},

		function nestedReference(t){
			var src = shrinksafe.tests.module.loader("5303.js");
			
			t.assertTrue(src.original.length > src.compressed.length);
			t.assertTrue(src.compressed.indexOf("say_hello") == -1)
			t.assertTrue(src.compressed.indexOf("callback") == -1)

			eval(src.compressed);
			// make sure it runs to completion
			t.assertEqual("hello worldhello world", result);
			// globals must not be renamed
			t.assertEqual("function", typeof CallMe);
			delete result;
		},
		
		function varConflict(t){
			// ensuring a shrunken variable won't overwrite an existing variable 
			// name, regardless of scope.
			var src = shrinksafe.tests.module.loader("8974.js");

			t.assertTrue(src.original.length > src.compressed.length);
			t.assertTrue(src.compressed.indexOf("variabletwo") == -1)

			eval(src.compressed);
			t.assertEqual(-1, result);
			delete result;
		},
		
		function varlists(t){
			// test to ensure var a, b, c; always works
			var src = shrinksafe.tests.module.loader("1768.js");
			
			// ensure the things we expect to hide are hidden
			t.t(src.compressed.indexOf("superlong") == -1);
			t.t(src.compressed.indexOf("aFunction") == -1);
			t.t(src.compressed.indexOf("inList") == -1);
			
			// sanity checking:
			var boo = eval(src.compressed);
			t.is(4, result);
			delete result;
			
		},
		
		function debuggerCall(t){
			// make sure we don't die when we find a debugger; statement 
			var src = shrinksafe.tests.module.loader("9444.js");
			t.t(src.compressed.indexOf("debugger") > -1);
		}
		
		
	]);
}catch(e){
	doh.debug(e);
}
