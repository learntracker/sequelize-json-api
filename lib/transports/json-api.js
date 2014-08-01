var util = require('util');

module.exports = exports = {
	deserialize: function(req){
		return req.body[req.model_name];
	},
	serializeOne: function(req, instance){
		// This moves all associations into the 'links' property, per the JSON-API spec
	    var values = instance.values;
	    if(Object.keys(req.model.associations).length > 0){
	      values.links = {};

	      for(association in req.model.associations){
	        assoc = req.model.associations[association]
	        var identifier = assoc.identifier.toLowerCase();
	        var targetName = assoc.target.tableName.toLowerCase();
	        var tableName = req.model.tableName.toLowerCase();

	        if(assoc.associationType == 'BelongsTo'){
	          if(identifier in values){
	            values.links[identifier] = {
	              href: util.format("http://%s%s/%s/%s", req.hostname, req.options.endpoint, targetName, values[identifier]),
	              ids: values[identifier],
	              type: targetName
	            }
	            delete values[identifier]
	          }
	        }

	        //TODO: handle HasOne

	        if(assoc.associationType == 'HasMany'){
	          if(targetName in values){
	            values.links[targetName] = {
	              href: util.format("http://%s%s/%s/%s/%s", req.hostname, req.options.endpoint, tableName, values.id, targetName),
	              ids: [],
	              type: targetName
	            };
	            values[targetName].forEach(function(assoc_value){
	              values.links[targetName].ids.push(assoc_value.id);
	            });
	            delete values[targetName]
	          }
	        }
	      }
	    }
	    return values
	}
}