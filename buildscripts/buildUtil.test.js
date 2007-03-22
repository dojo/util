load('buildUtil.js');
buildUtil.isDebug = true;

function printA(array) {
	print("  " + array.join("\n  "));
}

function test(deps) {
	print("Dependencies:");	
	printA(deps)
	print("Resolved:");
	printA(buildUtil.getDependencyList(deps));
	print("");	
}

test(['dojo.widget.Button']);
test(['dojo.widget.Button']);

print("")
print("Note : MISSING dojo.widget.Button from second run")

