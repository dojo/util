//Helper functions to deal with file I/O.

var fileUtil = {};

fileUtil.getLineSeparator = function(){
	//summary: Gives the line separator for the platform.
	//For web builds override this function.
	return java.lang.System.getProperty("line.separator"); //Java String
}

//Recurses startDir and finds matches to the files that match regExpFilter.
//Ignores files/directories that start with a period (.).
fileUtil.getFilteredFileList = function(startDir, regExpFilter, makeUnixPaths, startDirIsJavaObject){
	var files = [];

	var topDir = startDir;
	if(!startDirIsJavaObject){
		topDir = new java.io.File(startDir);
	}

	if(topDir.exists()){
		var dirFileArray = topDir.listFiles();
		for (var i = 0; i < dirFileArray.length; i++){
			var file = dirFileArray[i];
			if(file.isFile()){
				var filePath = file.getPath();
				if(makeUnixPaths){
					//Make sure we have a JS string.
					filePath = String(filePath);
					if(filePath.indexOf("/") == -1){
						filePath = filePath.replace(/\\/g, "/");
					}
				}
				if(!file.getName().match(/^\./) && filePath.match(regExpFilter)){
					files.push(filePath);
				}
			}else if(file.isDirectory() && !file.getName().match(/^\./)){
				var dirFiles = this.getFilteredFileList(file, regExpFilter, makeUnixPaths, true);
				files.push.apply(files, dirFiles);
			}
		}
	}

	return files;
}

fileUtil.readFile = function(/*String*/path, /*String?*/encoding){
	encoding = encoding || "utf-8";
	var file = new java.io.File(path);
	var lineSeparator = fileUtil.getLineSeparator();
	var input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding));
	try {
		var stringBuffer = new java.lang.StringBuffer();
		var line = "";
		while((line = input.readLine()) !== null){
			stringBuffer.append(line);
			stringBuffer.append(lineSeparator);
		}
		return stringBuffer.toString();
	} finally {
		input.close();
	}
}

fileUtil.saveUtf8File = function(/*String*/fileName, /*String*/fileContents){
	fileUtil.saveFile(fileName, fileContents, "utf-8");
}

fileUtil.saveFile = function(/*String*/fileName, /*String*/fileContents, /*String?*/encoding){
	var outFile = new java.io.File(fileName);
	var outWriter;
	if(encoding){
		outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), encoding);
	}else{
		outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile));
	}

	var os = new java.io.BufferedWriter(outWriter);
	try{
		os.write(fileContents);
	}finally{
		os.close();
	}
}

fileUtil.deleteFile = function(fileName){
	var file = new java.io.File(fileName);
	if(file.exists()){
		file["delete"]();
	}
}
