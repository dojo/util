load("buildUtilXd.js");

//START findJsFiles function
//Given an array of source directories to search, find all files
//that match filePathRegExp.
findJsFiles = function(srcDirs, filePathRegExp){
	var jsFileNames = [];
	for(var i = 0; i < srcDirs.length; i++){
		var fileList = buildUtil.getFilteredFileList(srcDirs[i].prefixPath, filePathRegExp, true);
		if(fileList){
			for(var j = 0; j < fileList.length; j++){
				jsFileNames.push({prefix: srcDirs[i].prefix, prefixPath: srcDirs[i].prefixPath, path: fileList[j]});
			}
		}
	}
	return jsFileNames;
}
//END findJsFiles function


//START of the "main" part of the script.
//This is the entry point for this script file.
var action = arguments[0];
var profileFile = arguments[1];
var releaseDir = arguments[2];

//Load Dojo so we can use readText() defined in hostenv_rhino.js.
//Also gives us the ability to use all the neato toolkit features.
djConfig={
	baseRelativePath: "../"
};
load('../dojo.js');
dojo.require("dojo.string.extras");
dojo.require("dojo.i18n.common");
dojo.require("dojo.json");

//Find the bundles that need to be flattened.
load("buildUtil.js");

//Define array used to store the source directories that need to be
//scanned for .js files to convert to .xd.js files. The objects
//in srcDirs should e a 
var srcDirs = [];

//Any other arguments to this file are directories to search.
for(var i = 3; i < arguments.length; i++){
	srcDirs.push({prefix: "dojo", prefixPath: arguments[i]});
}

//Get the resource prefixes from the profile and add them to the search list.
var prefixes = buildUtil.configPrefixes(profileFile);
if(prefixes && prefixes.length > 0){
	for(i = 0; i < prefixes.length; i++){
		//Add to list of directories to scan.
		print("Adding module resource dir: " + djConfig.baseRelativePath + prefixes[i][1]);
		srcDirs.push({prefix: prefixes[i][0], prefixPath: djConfig.baseRelativePath + prefixes[i][1]});
	}
}

if(action == "xdgen"){
	//Build master list of files to process.
	var jsFileNames = findJsFiles(srcDirs, /\.js$/);	
	
	//Run makeXdContents on each file and save the XD file contents to a xd.js file.
	for(j = 0; j < jsFileNames.length; j++){
		//Use new String so we get a JS string and not a Java string.
		var jsFileName = new String(jsFileNames[j].path);
		var xdFileName = jsFileName.replace(/\.js$/, ".xd.js");
		
		//Files in nls directories (except for the top level one in Dojo that has multiple
		//bundles flattened) need to have special xd contents.
		if(jsFileName.match(/\/nls\//) && jsFileName.indexOf(releaseDir + "/nls/") == -1){
			var xdContents = buildUtilXd.makeXdBundleContents(jsFileNames[j].prefix, jsFileNames[j].prefixPath, jsFileName, readText(jsFileName), djConfig.baseRelativePath, prefixes);			
		}else{
			var xdContents = buildUtilXd.makeXdContents(readText(jsFileName), djConfig.baseRelativePath, prefixes);
		}
		buildUtil.saveUtf8File(xdFileName, xdContents);
	}
}else if(action == "xdremove"){
	//Build master list of files to process.
	var jsFileNames = findJsFiles(srcDirs, /\.xd\.js$/);
	
	//Run makeXdContents on each file and save the XD file contents to a xd.js file.
	for(j = 0; j < jsFileNames.length; j++){
		buildUtil.deleteFile(jsFileNames[j].path);
	}
}

//END of the "main" part of the script.
