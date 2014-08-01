module.exports = exports = {
	deserialize: function(req){
		return req.body[req.model_name];
	},
	serializeOne: function(req, instance){
		var values = instance.values;
	    if(Object.keys(req.model.associations).length > 0){

	      for(association in req.model.associations){
	        assoc = req.model.associations[association]
	        var identifier = assoc.identifier.toLowerCase();
	        var targetName = assoc.target.tableName.toLowerCase();
	        var tableName = req.model.tableName.toLowerCase();

	        //TODO: handle HasOne

	        if(assoc.associationType == 'HasMany'){
	          if(targetName in values){
	            var ids = [];
	            values[targetName].forEach(function(assoc_value){
	              ids.push(assoc_value.id);
	            });
	            values[targetName] = ids;
	          }
	        }
	      }
	    }
	    return values;
	}
}