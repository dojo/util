(function(){
	// must use this.require to make this work in node.js
	var require = this.require;
	!require.async && require(["dojo"]);
	require.bootRequire && require.apply(null, require.bootRequire);
	require.bootReady && require.ready(require.bootReady);
})();
