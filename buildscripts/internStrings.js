//START of the "main" part of the script.
//This is the entry point for this script file.
var profileFile = arguments[0];
var loader = arguments[1];
var releaseDir = arguments[2];
var srcRoot = arguments[3];

load("buildUtil.js");

buildUtil.internTemplateStrings(profileFile, loader, releaseDir, srcRoot);
