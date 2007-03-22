//Make a copy of the tests dir, then run this script, giving the location
//of the tests copy, and the URL to use dojo.js

var startDir = arguments[0];
var xdDojoUrl = arguments[1];

load("buildUtil.js");

var fileList = buildUtil.getFilteredFileList(startDir, /\.(html|htm)$/, true);

for(var i = 0; i < fileList.length; i++){
	var fileName = fileList[i];	
	var fileContents = String(buildUtil.readFile(fileName));
	fileContents = fileContents.replace(/src\=\".*dojo.js"/, 'src="' + xdDojoUrl + '"');
	buildUtil.saveUtf8File(fileName, fileContents);
}
