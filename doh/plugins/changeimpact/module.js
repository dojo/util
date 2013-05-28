// automagic test module.
// see README for more info

define(["doh/main", "require", "dojo/request/xhr"], function(doh, require, xhr){
	// graph's JSON format:
	// {
	//	labels:{id1:"dojo/dojo.js",id2:"dojo/on.js",...},
	//	graph:{id1:["id2","id3"],id2:["id1","id4"],...}
	// }
	
	// get window args in the usual way
	var files=null;
	var robot=false;
	var qstr = window.location.search.substr(1);
	if(qstr.length){	
	var qparts = qstr.split("&");
		for(var x=0; x<qparts.length; x++){
			var tp = qparts[x].split("="), name = tp[0], value = tp[1].replace(/[<>"'\(\)]/g, "");	// replace() to avoid XSS attack
			//Avoid URLs that use the same protocol but on other domains, for security reasons.
			if (value.indexOf("//") === 0 || value.indexOf("\\\\") === 0) {
				throw "Insupported URL";
			}
			switch(name){
				case "files":
					files = value.split(",");
					break;
				case "robot":
					robot = value=="yes";
					break;
			}
		}
	}
	if(!files){
		// help them out here...
		files=prompt("Enter the file names you changed, separated by commas, and their tests will be loaded.","dijit/form/Button.js,dojox/mobile/SpinWheel.js").split(",");
		robot=confirm("Also run robot tests?");
	}
	
	// 
	xhr.post("plugins/changeimpact/graph.php",{sync:true,handleAs:"json",data:"files="+files+"&robot="+robot}).then(function(tests){
		// register tests
		for(var i in tests){
			doh.register(i, require.toUrl(i+"?mode=test"), 999999);
		}
	});
	
	/*// flag/fix for some important DOH-related ids: doh/runner, doh/main, robot, etc
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
	for(var i in tests){
		doh.register(i, require.toUrl(i+"?mode=test"), 999999);
	}*/
});