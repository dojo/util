function factory(uglify){
	if(!uglify){
		throw new Error("Unknown host environment: only nodejs is supported by uglify optimizer.");
	}
	if(uglify.minify){
		//uglify2, provide a uglify-1 compatible uglify function
		var UglifyJS = uglify;
		uglify = function(code, options){
			//parse
			var ast = UglifyJS.parse(code, options);
			ast.figure_out_scope();

			//by default suppress warnings from uglify2
			var compress_options = options.compress_options || {};
			if(!('warnings' in compress_options)){
				compress_options.warnings = false;
			}
			var compressor = UglifyJS.Compressor(compress_options);
			compressed_ast = ast.transform(compressor);
			compressed_ast.figure_out_scope();

			//mangle
			compressed_ast.compute_char_frequency();
			compressed_ast.mangle_names();

			return compressed_ast.print_to_string(options.gen_options);
		}
	}
	return uglify;
}

if(global.define){
	//loaded by dojo AMD loader
	define(["dojo/has!host-node?dojo/node!uglify-js:"], factory);
}else{
	//loaded in a node sub process
	try{
		var uglify = require("uglify-js");
	}catch(e){}
	uglify = factory(uglify);
	process.on("message", function(data){
		var result = "", error = "";
		try{
			var result = uglify(data.text, data.options);
		}catch(e){
			error = e.toString() + " " + e.stack;
		}
		process.send({text: result, dest: data.dest, error: error});
	});
}
