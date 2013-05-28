// rhino js to parse the graph on the server (for performance reasons; the graph kills IE8-)

var files=arguments[0].split(",");
var robot=arguments[1]=="true";
var graph=eval(readFile("graph.json"));
	
// flag/fix for some important DOH-related ids: doh/runner, doh/main, robot, etc
var dohIDs={};
var robotIDs={};
for(var k in graph.labels){
	if(/doh(\/(main|runner))?\.js$/.test(graph.labels[k])){
		dohIDs[k]=1;
	}
	if(/robot(x?)\.js$/.test(graph.labels[k])){
		robotIDs[k]=1;
	}
}

function isDOHTest(id){
	for(var i in dohIDs){
		if(graph.map[i][id]){
			return true;
		}
	}
}

function isRobotTest(id){
	for(var i in robotIDs){
		if(graph.map[i][id]){
			return true;
		}
	}
}


// print all of fileID's leaf nodes; they are the test cases
var tests={};
var visited={};
for(var j=0; j<files.length; j++){
	var fileName=files[j];
	var fileID="";
	for(var k in graph.labels){
		if(graph.labels[k]==fileName){
			fileID=k;
			break;
		}
	}
	var stack=[];
	var stackPtr=0;
	stack[0]=fileID;
	visited[fileID]=1;
	while(stackPtr>=0){
		var current=stack[stackPtr--];
		var mapcurrent=graph.map[current];
		var child=null;
		for(child in mapcurrent){
			if(!visited[child]){
				visited[child]=1;
				stack[++stackPtr]=child;
			}
		}
		if(!child){
			// leaf node; most likely a DOH test but not necessarily automated
			var currentLabel=graph.labels[current];
			// is it *really* a test?
			if(/test/.test(currentLabel)&&isDOHTest(current)&&(robot||!isRobotTest(current))){
				// print the doh code
				// doh.register("Bidi", require.toUrl("./Bidi.html"), 999999);
				//if(printDOH){
					//printf("doh.register(\"%s\", require.toUrl(\"%s\"), 999999);\r\n", labels[current], labels[current]);
				//}else{
					//print(labels[current]);
				//}
				// instead of registering here, wait so we register only unique tests
				tests[currentLabel]=1;
			}
		}
	}
}
// register tests
print("{");
var started=false;
for(var i in tests){
	//doh.register(i, require.toUrl(i+"?mode=test"), 999999);
	if(started){
		print(",")
	}
	started=true;
	print("\""+i+"\":"+1);
}
print("}");