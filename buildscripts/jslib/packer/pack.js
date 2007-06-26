load("lib/writeFile.js");
load("base2.js");
load("Packer.js");
load("Words.js");

// arguments
var inFile = arguments[0];
var outFile = arguments[1] || inFile.replace(/\.js$/, "-p.js");

// options
var base62 = false;
var shrink = true;

var script = readFile(inFile);
var packer = new Packer;
var packedScript = packer.pack(script, base62, shrink);

writeFile(outFile, packedScript);
