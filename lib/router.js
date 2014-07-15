var util = require('util')
  , _ = require('lodash')
  , express = require('express')
  , inflection = require('inflection')
  , validator = require('validator');

var Router = module.exports = function(sequelize, options) {
  var api = express.Router();
  var models = {}
  
  sequelize.daoFactoryManager.daos.forEach(function(model){
    models[model.tableName.toLowerCase()] = model;
  });

  options   = _.extend({
    endpoint: '/api',
    logLevel: 'info',
    allowed: Object.keys(models),
    allowOrigin: "https://localhost:4200"
  }, options || {})

  api.use(function(req, res, next) {
    // do logging
    console.log('Serving ' + req.path);

    res.set("Access-Control-Allow-Origin", options.allowOrigin)
    next(); // make sure we go to the next routes and don't stop here
  });

  var errors = {
      invalidResourceId: function(resource_id){
        return {
          title: "Invalid resource id",
          description: util.format("The resource id '%s' is invalid.", resource_id)
        }
      },
      doesNotExist: function(routename, resource_id){
        return {
          errors: {
            title: "Resource does not exist",
            description: util.format("The resource /%s/%s does not exits.", routename, resource_id)
          }
        }
      },
      notYetImplemented: function(){
        return {
          errors: {
            title: "Not yet implemented",
            description: "Deleting multiple resources is not yet implemented."
          }
        }
      }
  };

  function fixlinks(req, instance){
    // This moves all associations into the 'links' property, per the JSON-API spec
    var values = instance.values;
    if(Object.keys(req.model.associations).length > 0){

      for(association in req.model.associations){
        assoc = req.model.associations[association]
        var identifier = assoc.identifier.toLowerCase();
        var targetName = assoc.target.tableName.toLowerCase();
        var tableName = req.model.tableName.toLowerCase();

        //if(assoc.associationType == 'BelongsTo'){
        //  if(identifier in values){
        //    console.log('getting: ' + identifier);
        //    values[identifier] = values[identifier].id;
        //  }
        //}

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
    return values
  }

  options.allowed.forEach(function(model_name){
    var model = models[model_name];

    model.includes = [];
    model.includes_id = [];
    
    // build the include Array or Object for eager loading associations
    for(association_name in model.associations){
      association = model.associations[association_name]
      var targetName = association.target.tableName.toLowerCase();
      if(association.associationType == 'HasMany'){
        model.includes.push(models[targetName]);
        model.includes_id.push({
          model: models[targetName],
          as: association.as,
          attributes: ['id']
        });
      }
    }
  });

  api.options('/*',function(req,res){
    //res.set('Access-Control-Allow-Origin': http://ember.eagle)
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, X-AUTHENTICATION, X-IP, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.send('');
  })

  // route /model
  api.route('/:resource')
    .all(function(req, res, next){
      req.model = models[req.params.resource];
      req.model_name = inflection.singularize(req.model.tableName.toLowerCase());
      req.routename = inflection.pluralize(req.model.tableName.toLowerCase());

      next();
    })
    .get(function(req, res) {
      req.model
        .findAll({include: req.model.includes_id})
        .success(function(instances){
          var values = [];
          instances.forEach(function(instance){
            values.push(fixlinks(req,instance));
          });
          ret = {}
          ret[req.routename] = instances;
          res.json(ret);
        });
    })
    .post(function(req, res) {
      console.log(req.body[req.model_name]);
      req.model
        .create(req.body[req.model_name])
        .success(function(instance){
          var values = fixlinks(req,instance);
          ret = {}
          ret[req.routename] = values;
          res.status(201).json(ret);
        })
        .error(function(err){
            res.json({error: err, req: req.body});
        });
    });

  // route /model/id
  api.route('/:resource/:id')
    .all(function(req, res, next){
      req.model = models[req.params.resource];
      req.routename = inflection.pluralize(req.model.tableName.toLowerCase());

      if(!validator.isInt(req.params.id)){
        res.json(errors.invalidResourceId(req.params.id))
      }else{
        next();
      }
    })
    .get(function(req, res) {
      if(req.params.id.indexOf(',') > 0){
        res.json(errors.notYetImplemented())
      }else{
        req.model
          .find({where: {id: req.params.id}, include: req.model.includes_id})
          .success(function(instance){
            if(instance){
              var values = fixlinks(req,instance);
              ret = {}
              ret[req.routename] = values;
              res.json(ret);
            }else{
              res.json(errors.doesNotExist(req.routename, req.params.id))
            }
          })
          .error(function(err){
            res.send('error');
          });
      }
    })
    .put(function(req, res) {
      

      res.json(errors.notYetImplemented())
    })
    .delete(function(req, res) {
      if(req.params.id.indexOf(',') > 0){
        res.json(errors.notYetImplemented())
      }else{
        req.model
          .find({where: {id: req.params.id}})
          .success(function(instance){
            if(instance){
              instance
                .destroy()
                .success(function(){
                  res.status(204).send('');
                })
            }else{
              res.json(errors.doesNotExist(req.routename, req.params.id))
            }
          });
      }
    });
  api.route('/:resource/:id/:collection')
    .all(function(req, res, next){
      req.model = models[req.params.collection];
      req.routename = inflection.pluralize(req.model.tableName.toLowerCase());
      req.association = models[req.params.resource];

      req.identifier = req.model.associations[req.association.name].identifier

      if(!validator.isInt(req.params.id)){
        res.json(errors.invalidResourceId(req.params.id))
      }else{
        next();
      }
    })
    .get(function(req, res) {
      var query_options = {
        where:{},
        include: req.model.includes_id
      };
      query_options.where[req.identifier] = req.params.id;
      req.model
        .findAll(query_options)
        .success(function(instances){
          var values = [];
          instances.forEach(function(instance){
            values.push(fixlinks(req,instance));
          });
          ret = {}
          ret[req.routename] = instances;
          res.json(ret);
        });
    });
  return api;
}
