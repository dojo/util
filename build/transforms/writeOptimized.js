define(["../buildControl", "require"], function(bc, require){
	var optimizers = {};
	if(bc.optimize){
		require(["./optimizer/" + bc.optimize.split(".")[0]], function(optimizer){
			optimizers[bc.optimize] = optimizer;
		});
	}
	if(bc.layerOptimize){
		require(["./optimizer/" + bc.layerOptimize.split(".")[0]], function(optimizer){
			optimizers[bc.layerOptimize] = optimizer;
		});
	}

	return function(resource, callback) {
		if(bc.optimize && !resource.layer){
			return optimizers[bc.optimize](resource, resource.getText(), resource.pack.copyright, bc.optimize, callback);
		}else if(bc.layerOptimize && resource.layer && !resource.layer.discard){
			return optimizers[bc.layerOptimize](resource, resource.layerText, resource.layer.copyright, bc.layerOptimize, callback);
		}else{
			return 0;
		}
	};
});