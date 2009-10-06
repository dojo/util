checkstyleUtil = {
	errors: []
};

checkstyleUtil.applyRules = function(fileName, contents){
	// Do not process JSON files
	if(contents.charAt(0) == "{"){
		return;
	}
	
	// Mark all the characters that are in comments.
	var comments = checkstyleUtil.getComments(contents);
	
	// Apply all the rules to the file
	for(var ruleName in checkstyleUtil.rules){
		checkstyleUtil.rules[ruleName](fileName, contents, comments);
	}
};

// Calculate the characters in a file that are in comment fields
// These will be ignored by the checkstyle rules.
checkstyleUtil.getComments = function(contents){
	var comments = [];
	
	// Initialize the array to false values.
	for(var i = 0; i < contents.length; i++){
		contents[i] = false;
	}
	
	var sep = "\n";
	
	function markComments(start, end){
		var idx = contents.indexOf(start);
	
		while(idx > -1){
			var endComment = contents.indexOf(end, idx);
			if(endComment < 0){
				endComment = contents.length;
			}
			
			for(var i = idx; i < endComment; i++){
				comments[i] = true;
			}
			idx = contents.indexOf(start, endComment);
		}	
	}
	function markQuotes(quote){
		var inQuote = false;
		for(var i = 0; i < contents.length; i++){
			if(comments[i]){
				continue;
			}
			if(contents.charAt(i) == quote 
				&& (i == 0 || contents.charAt(i - 1) != "\\")){
				inQuote = !inQuote;
			} else if(inQuote){
				comments[i] = true;
			}
		}
	}
	
	function markRegexs() {
		var idx = contents.indexOf("/g");
		
		while(idx > -1) {
			if(!comments[idx]){
				// Look back until either a forward slash
				// or a new line is found
				var prevChar = contents.charAt(idx - 1);
				var i = idx;
				while(prevChar != "\n" && prevChar != "/" && i > 0){
					prevChar = contents.charAt(--i);
				}
				if(prevChar == "/"){
					for(; i < idx; i++){
						comments[i] = true;
					}
				}
			}
			idx = contents.indexOf("/g", idx + 2)
		}
	}
	
	markComments("//", sep);
	markComments("/*", "*/");
	markQuotes("\"");
	markQuotes('\'');
	markRegexs();
	
	
	return comments;
}

// Calculate the line number of the character at index 'pos'
checkstyleUtil.getLineNumber = function(contents, pos){
	var counter = 0;
	var sep = "\n";
		
	for(var i = pos; i > -1; i--){
		if(contents.charAt(i) == "\n"){
			counter ++;
		}
	}
	return counter + 1;
};

// Store the information for a single error.
checkstyleUtil.addError = function(msg, fileName, contents, pos){
	while(fileName.indexOf("../") == 0){
		fileName = fileName.substring(3);
	}
	checkstyleUtil.errors.push({
		file: fileName,
		line: checkstyleUtil.getLineNumber(contents, pos),
		message: msg
	});
};

// Find the next character in 'contents' after the index 'start'
// Spaces and tabs are ignored.
checkstyleUtil.getNextChar = function(contents, start, comments, ignoreNewLine){
	for(var i = start; i < contents.length; i++){
		if(comments && comments[i]){
			continue;
		}
		if(contents.charAt(i) != " " 
			&& contents.charAt(i) != "\t" 
			&& (!ignoreNewLine || contents.charCodeAt(i) != 13)){
			return {
				value: contents[i],
				pos: i
			};
		}
	}
	return null;
};

// Find the next occurrence of the character in the 
// 'contents' array after the index 'start'
checkstyleUtil.findNextCharPos = function(contents, start, character){
	for(var i = start; i < contents.length; i++){
		if(contents.charAt(i) == character){
			return i;
		}
	}
	return -1;
};

// Creates a simple function that searches for the token, and 
// adds an error if it is found
checkstyleUtil.createSimpleSearch = function(token, message){
	return function(fileName, contents, comments){
		var idx = contents.indexOf(token);
		
		while(idx > -1){
			
			if(!comments[idx]){
				checkstyleUtil.addError(message, fileName, contents, idx);
			}
			idx = contents.indexOf(token, idx + 1);
		}
	};
};

// Creates a function that fails a test if the given token
// does not have a space to the left and right.
checkstyleUtil.createSpaceWrappedSearch = function(token, message){
	return function(fileName, contents, comments){
		
		var idx = contents.indexOf(token);
		var before, after;
		var tokenLength = token.length;

		while(idx > -1){
			before = contents.charAt(idx - 1);
			after = contents.charAt(idx + tokenLength);
			if(!comments[idx] && 
				((before != " " && before != "\t" && (token != "==" || before != "!")) || 
				(
					(after != " " && contents.charCodeAt(idx + tokenLength) != 13 
						&& contents.charCodeAt(idx + tokenLength) != 10)
				&& 	(token != "==" || after != "=")
				))){
				checkstyleUtil.addError(message, fileName, contents, idx);
			}
			idx = contents.indexOf(token, idx + token.length);
		}
	};
};



checkstyleUtil.isEOL = function(contents, pos){
	var c = contents.charCodeAt(pos);
	return c == 10 || c == 13;
};

// All the rules that will be applied to each file.
checkstyleUtil.rules = {

	"elseFollowedBySpace": function(fileName, contents, comments){
		var idx = contents.indexOf("else ");
		while(idx > -1){

			if(!comments[idx] && contents.substring(idx + 5, idx + 7) != "if"){
				checkstyleUtil.addError("\" else \" cannot be followed by a space", fileName, contents, idx);
			}
			idx = contents.indexOf("else {", idx + 1);
		}
	},
	
	"trailingComma" : function(fileName, contents, comments){
		
		var s = ",";
		var idx = contents.indexOf(s);
		var nextChar;
		
		while(idx > -1){
			if(!comments[idx]){
				nextChar = checkstyleUtil.getNextChar(contents, idx + 1, comments, true);
				if(nextChar.value == "}"){
					checkstyleUtil.addError("Trailing commas are not permitted", fileName, contents, idx);
				}
			}
			idx = contents.indexOf(s, idx + 1);
		}
	},
	
	"switchCaseNewLine" : function(fileName, contents, comments){
		var s = "\tcase ";
		var idx = contents.indexOf(s);
		var nextColonIdx;
		var eolIdx;
		
		while(idx > -1){
			
			if(!comments[idx]){
				eolIdx = contents.indexOf("\n", idx + 4);
				
				if(eolIdx > idx){
					// Count backwards from the end of the line.
					// The first character, that is not a comment,
					// Should be a ':'
					
					for(var i = eolIdx; i > idx + 4; i--){
						var c = contents.charAt(i);
						if(!comments[i] 
							&& c != ' '
							&& c != '\t'
							&& c != ':'
							&& !checkstyleUtil.isEOL(contents, i)){
							checkstyleUtil.addError(
								"A CASE statement should be followed by a new line", 
								fileName, contents, idx);
							break;
						}
						if(c == ':'){
							break;
						}
					}
				}
			}
			idx = contents.indexOf(s, idx + 4);
		}
	},
	
	"curlyBraceAtStartOfLine": function(fileName, contents, comments){
		
		var idx = contents.indexOf("\n");
		
		while(idx > -1){
			var nextChar = checkstyleUtil.getNextChar(contents, idx + 1);
			
			if(nextChar && !comments[nextChar.pos] && nextChar.value == "{"){
				// Go back three lines, and look for "dojo.declare".  If it exists in the last three lines,
				// then it is ok to have  { at the start of this line.
				
				var nlCount = 0;
				var i;
				for(i = idx - 1; i > -1 && nlCount < 3; i--){
					if(contents[i] == "\n"){
						nlCount++;
					}
				}
				var declarePos = contents.indexOf("dojo.declare", Math.max(0, i));
				if(declarePos < 0 || declarePos > idx){
					checkstyleUtil.addError("An opening curly brace should not be the first on a line", fileName, contents, idx);
				}
			}
			idx = contents.indexOf("\n", idx + 1);
		}
	},
	
	"parenthesisSpaceCurlyBrace": checkstyleUtil.createSimpleSearch(") {", "A space is not permitted between a closing parenthesis and a curly brace"),
	
	"useTabs": function(fileName, contents, comments){
		
		var idx = contents.indexOf("  ");
		
		while(idx > -1){
			var nextChar = checkstyleUtil.getNextChar(contents, idx + 1);
			if(!comments[idx] && nextChar && nextChar.value.charCodeAt(0) != 13){
				checkstyleUtil.addError("Tabs should be used instead of spaces", fileName, contents, idx);
				var nextLine = checkstyleUtil.findNextCharPos(contents, idx + 1, "\n");
				if(nextLine < 0){
					break;
				}
				idx = contents.indexOf("  ", nextLine + 1);
			} else{
				idx = contents.indexOf("  ", idx + 2);
			}
		}
	},
	
	"spacesAroundEquals": checkstyleUtil.createSpaceWrappedSearch("==", "The equals sign should be preceded and followed by a space"),
	"spacesAroundOr": checkstyleUtil.createSpaceWrappedSearch("||", "The || sign should be preceded and followed by a space"),
	"spacesAroundAnd": checkstyleUtil.createSpaceWrappedSearch("&&", "The && sign should be preceded and followed by a space")
};

var noSpaceAfter = ["catch","do","finally","for","if","switch","try","while","with"];

// Add checks for all the elements that are not allowed to have a space after them.
checkstyleUtil.createNoSpaceAfterFunction = function(name){
	checkstyleUtil.rules["noSpaceAfter" + noSpaceAfter[i] + "1"] = 
		checkstyleUtil.createSimpleSearch(" " + name +" ", "\" " + name + " \" cannot be followed by a space");
	checkstyleUtil.rules["noSpaceAfter" + noSpaceAfter[i] + "2"] = 
		checkstyleUtil.createSimpleSearch("\t" + name +" ", "\" " + name + " \" cannot be followed by a space");
}

for(var i = 0; i < noSpaceAfter.length; i++){
	checkstyleUtil.createNoSpaceAfterFunction(noSpaceAfter[i]);
}

checkstyleUtil.clear = function(){
	checkstyleUtil.errors = [];
}

checkstyleUtil.serializeErrors = function(){
	var buf = [];
	var errs = checkstyleUtil.errors;
	for(var i = 0; i < errs.length; i++){
		buf.push(errs[i].file + ":" + errs[i].line + " - " + errs[i].message);
	}
	return buf.join("\n");
}

checkstyleUtil.makeSimpleFixes = function(contents){
	
	var comments = checkstyleUtil.getComments(contents);
	for(var i = 0; i < noSpaceAfter.length; i++){
		contents = checkstyleUtil.fixSpaceAfter(contents, noSpaceAfter[i], comments);
	}
	contents = contents.split("    ").join("\t")
				.split("  ").join("\t")
				.split(") {").join("){")
				.split("\tif (").join("\tif(")
				.split("} else").join("}else")
				.split("}\telse").join("}else")
				.split("}else {").join("}else{")
				.split("\twhile (").join("\twhile(")
				.split("\tfor (").join("\tfor(")
				.split("\tswitch (").join("\tswitch(");
	
	comments = checkstyleUtil.getComments(contents);
	contents = checkstyleUtil.fixSpaceBeforeAndAfter(contents, "==", comments);
	comments = checkstyleUtil.getComments(contents);
	contents = checkstyleUtil.fixSpaceBeforeAndAfter(contents, "||", comments);
	comments = checkstyleUtil.getComments(contents);
	contents = checkstyleUtil.fixSpaceBeforeAndAfter(contents, "&&", comments);
	return contents;
}

checkstyleUtil.insertChar = function(contents, ch, pos){
	return contents.substring(0, pos) + ch + contents.substring(pos);
}
checkstyleUtil.deleteChar = function(contents, pos){
	return contents.substring(0, pos) + contents.substring(pos + 1);
}

checkstyleUtil.fixSpaceAfter = function(contents, token, comments){
	var idx = contents.indexOf(token + " ");
	
	while(idx > -1){
		if(!comments[idx]){
			contents = checkstyleUtil.deleteChar(contents, idx + token.length);
		}
		
		idx = contents.indexOf(token + " ", idx + token.length);
	}
	return contents;
}

checkstyleUtil.fixSpaceBeforeAndAfter = function(contents, token, comments){
	var idx = contents.indexOf(token);
	var before, after;

	while(idx > -1){
		before = contents.charAt(idx - 1);
		after = contents.charAt(idx + 2);
		if(!comments[idx]){
			if(before != " " && before != "\t" && (token != "==" || before != "!")){
				contents = checkstyleUtil.insertChar(contents, " ", idx);
				idx ++;
			}
			if((after != " " && contents.charCodeAt(idx + 2) != 13 
					&& contents.charCodeAt(idx + 2) != 10)
				&& 	(token != " == " || after != "=")){
				contents = contents = checkstyleUtil.insertChar(contents, " ", idx + token.length);
				idx++;
			}
		}
		idx = contents.indexOf(token, idx + token.length);
	}
	return contents;
}

// Creates the data file suitable to be loaded into a dojo.data.ItemFileReadStore
checkstyleUtil.generateReport = function(skipPrint){
	
	var ids = 1;
	var json = ["{id:'" +(ids++) + "', file: 'All', isFolder:true}"];

	// A map of folders that have already been found.
	var allFolders = {};
	
	var messageIds = {};
	var messageCounter = 1;
	var i, err;
	
	function getFolderName(fileName){
		// Extract the folder name from a file name
		var idx = fileName.lastIndexOf("/");
		return fileName.substring(0, idx);
	}
	
	// Add a folder to the list of folders.
	function pushFolder(folderName){
		if(!allFolders[folderName]){
			allFolders[folderName] = true;
			json.push("{id: '" +(ids++) + "', file: '" + folderName + "', folder: 1}");
		}
	}
	
	for(i = 0; i < checkstyleUtil.errors.length; i++){
		err = checkstyleUtil.errors[i];
		var message = err.message;
		var messageId = messageIds[message];
		if(!messageId){
			messageId = "m" + messageCounter++;
			messageIds[message] = messageId;
			
			json.push("{id:'" + messageId + 
					"',msg:'" + message + 
					"'}");
		}
	}
	
	pushFolder("All");
	
	// Create the JSON records for each error.
	for(i = 0; i < checkstyleUtil.errors.length; i++){
		err = checkstyleUtil.errors[i];
		var folderName = getFolderName(err.file);
		pushFolder(folderName);
		
		json.push("{id:'" +(ids++) + 
					"', file:'" + err.file + 
					"',line:" + err.line + 
					",msg:{'_reference':'" + messageIds[err.message] + 
					//"'},folder:'" + folderName +
					"'},folder: 0" +
					"}");
		
	}

	// Add the date that the check was run to the store.
	json.push("{id:'" +(ids++) + "', date: " +(new Date()).getTime() + "}");
	
	// Save the file.

	if(!skipPrint){
		print("Found " + checkstyleUtil.errors.length + " checkstyle errors. " +
		"Open the file checkstyleReport.html to view the results.");
	}
					
	return "{ identifier: 'id', label:'file', items: [" + json.join(",\n") + "]}";
};