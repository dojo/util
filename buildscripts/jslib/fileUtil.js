//Helper functions to deal with file I/O.

var fileUtil = {};

fileUtil.getLineSeparator = function(){
	//summary: Gives the line separator for the platform.
	//For web builds override this function.
	return java.lang.System.getProperty("line.separator"); //Java String
}

fileUtil.getFilteredFileList = function(/*String*/startDir, /*RegExp*/regExpFilter, /*boolean?*/makeUnixPaths, /*boolean?*/startDirIsJavaObject){
	//summary: Recurses startDir and finds matches to the files that match regExpFilter.
	//Ignores files/directories that start with a period (.).
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
					filePath = new String(filePath);
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

	return files; //Array
}


fileUtil.copyDir = function(/*String*/srcDir, /*String*/destDir, /*RegExp*/regExpFilter){
	//summary: copies files from srcDir to destDir using the regExpFilter to determine if the
	//file should be copied.
	var fileNames = fileUtil.getFilteredFileList(srcDir, regExpFilter, true);
	
	for(var i = 0; i < fileNames.length; i++){
		var srcFileName = fileNames[i];
		var destFileName = srcFileName.replace(srcDir, destDir);

		//logger.trace("Src filename: " + srcFileName);
		//logger.trace("Dest filename: " + destFileName);

		//Make sure destination dir exists.
		var destFile = new java.io.File(destFileName);
		var parentDir = destFile.getParentFile();
		if(!parentDir.exists()){
			if(!parentDir.mkdirs()){
				throw "Could not create directory: " + parentDir.getAbsolutePath();
			}
		}

		//Java's version of copy file.
		var srcChannel = new java.io.FileInputStream(srcFileName).getChannel();
		var destChannel = new java.io.FileOutputStream(destFileName).getChannel();
		destChannel.transferFrom(srcChannel, 0, srcChannel.size());
		srcChannel.close();
		destChannel.close();
	}
}

fileUtil.readFile = function(/*String*/path, /*String?*/encoding){
	//summary: reads a file and returns a string
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
		//Make sure we return a JavaScript string and not a Java string.
		return new String(stringBuffer.toString()); //String
	} finally {
		input.close();
	}
}

fileUtil.saveUtf8File = function(/*String*/fileName, /*String*/fileContents){
	//summary: saves a file using UTF-8 encoding.
	fileUtil.saveFile(fileName, fileContents, "utf-8");
}

fileUtil.saveFile = function(/*String*/fileName, /*String*/fileContents, /*String?*/encoding){
	//summary: saves a file.
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

fileUtil.deleteFile = function(/*String*/fileName){
	//summary: deletes a file or directory if it exists.
	var file = new java.io.File(fileName);
	if(file.exists()){
		if(file.isDirectory()){
			var files = file.listFiles();
			for(var i = 0; i < files.length; i++){
				this.deleteFile(files[i]);
			}
		}
		file["delete"]();
	}
}
