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
    allowed: Object.keys(models)
  }, options || {})

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
      values.links = {};

      for(association in req.model.associations){
        assoc = req.model.associations[association]
        var identifier = assoc.identifier.toLowerCase();
        var targetName = assoc.target.tableName.toLowerCase();
        var tableName = req.model.tableName.toLowerCase();

        if(assoc.associationType == 'BelongsTo'){
          if(identifier in values){
            values.links[identifier] = {
              href: util.format("http://%s%s/%s/%s", req.hostname, options.endpoint, targetName, values[identifier]),
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
              href: util.format("http://%s%s/%s/%s/%s", req.hostname, options.endpoint, tableName, values.id, targetName),
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

  // route /model
  api.route('/:model')
    .all(function(req, res, next){
      req.model = models[req.params.model];
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
      req.model
        .create(req.body)
        .success(function(instance){
          var values = fixlinks(req,instance);
          ret = {}
          ret[req.routename] = values;
          res.json(ret);
        })
        .error(function(err){
            res.json({error: err, req: req.body});
        });
    });

  // route /model/id
  api.route('/:model/:id')
    .all(function(req, res, next){
      req.model = models[req.params.model];
      req.routename = inflection.pluralize(req.model.tableName.toLowerCase());

      next();
    })
    .get(function(req, res) {
      if(req.params.id.indexOf(',') > 0){
        res.json(errors.notYetImplemented())
      }else if(!validator.isInt(req.params.id)){
        res.json(errors.invalidResourceId(req.params.id))
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
      }else if(!validator.isInt(req.params.id)){
        res.json(errors.invalidResourceId(req.params.id))
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


  return api;
}