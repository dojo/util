define(function() {
	return {
		start:function(
			id,
			referenceModule,
			bc
		) {
			return [bc.amdResources["dojo/selector/acme"]];
		}
	};
});
