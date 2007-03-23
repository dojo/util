//START of the "main" part of the script.
//This is the entry point for this script file.
load("fileUtil.js");
load("buildUtil.js");

var profileFile = arguments[0];
var releaseDir = arguments[1];
var dojoFileName = arguments[2];
var version = arguments[3];
var lineSeparator = java.lang.System.getProperty("line.separator");

var result = buildUtil.makeDojoJs(buildUtil.loadDependencyList(profileFile), version);

//Save the dojo.js contents. It is always the first result.
fileUtil.saveFile(releaseDir + "/" + dojoFileName, result[0].contents);

//Save the other layers, if there are any.
for(var i = 1; i < result.length; i++){
	fileUtil.saveFile(releaseDir + "/" + result[i].layerName, result[i].contents);
}

//Save the dependency list to build.txt
var buildText = "Files baked into this build:" + lineSeparator;
for(var i = 0; i < result.length; i++){
	buildText += lineSeparator + result[i].layerName + ":" + lineSeparator;
	buildText += result[i].depList.join(lineSeparator) + lineSeparator;
}

fileUtil.saveFile(releaseDir + "/build.txt", buildText);

print(buildText);

