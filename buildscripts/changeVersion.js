// Changes the Dojo version in a file. Used during the release process.

var
	version = "" + arguments[0],
	revision = "" + arguments[1],
	filename = "" + arguments[2],

	writeFile= function(filename, contents){
		var
			outFile = new java.io.File(filename),
			outWriter;
		outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), "UTF-8");
		var os = new java.io.BufferedWriter(outWriter);
		try{
			os.write(contents);
		}finally{
			os.close();
		}
	},


	changeVersion = function(/*String*/version, /*String*/fileContents){
		// summary:
		//		Changes the version number for dojo. Input should be the fileContents
		//		of a file that contains the version number.

		//Set version number.
		//First, break apart the version string.
		var verSegments = version.match(/^(\d*)\.?(\d*)\.?(\d*)\.?(.*)$/);
		var majorValue = verSegments[1] || 0;
		var minorValue = verSegments[2] || 0;
		var patchValue = verSegments[3] || 0;
		var flagValue  = verSegments[4] || "";

		// Do the final version replacement.
		if(/(package|bower)/.test(filename)){
			fileContents = fileContents.replace(
				/['"](version|dojo|dijit|dojox)['"]\s*\:\s*['"][\w\.\-]+?["']/g,
				'"$1": "' + version + '"'
			);
		}else{
			fileContents = fileContents.replace(
				/major:\s*\d*,\s*minor:\s*\d*,\s*patch:\s*\d*,\s*flag:\s*".*?"\s*,/g,
				"major: " + majorValue + ", minor: " + minorValue + ", patch: " + patchValue + ", flag: \"" + flagValue + "\","
			);
			fileContents = fileContents.replace(/\$Rev(: [0-9a-f]* )?\$/, revision ? "$Rev: " + revision + " $" : "$Rev$");
		}

		return fileContents; //String
	};

print(version);
print(filename);
var fileContents = readFile(filename, "utf-8");
fileContents = changeVersion(version, fileContents);
writeFile(filename, fileContents);
