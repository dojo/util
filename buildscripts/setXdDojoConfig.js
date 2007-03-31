//START of the "main" part of the script.
//This is the entry point for this script file.
var dojoFile = arguments[0];
var xdUrl = arguments[1];

load("fileUtil.js");
load("buildUtil.js");
load("buildUtilXd.js");

var fileContents = fileUtil.readFile(dojoFile);
fileContents = buildUtilXd.setXdDojoConfig(fileContents, xdUrl);
fileUtil.saveFile(dojoFile, fileContents);


