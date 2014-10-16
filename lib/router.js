var util = require('util')
  , _ = require('lodash')
  , Promise = require('bluebird')
  , express = require('express')
  , inflection = require('inflection')
  , validator = require('validator');

var Router = module.exports = function(sequelize, options) {
  var api = express.Router();
  var models = {}
  var transport;

  sequelize.daoFactoryManager.daos.forEach(function(model){
    models[model.tableName.toLowerCase()] = model;
  });

  options = _.extend({
    endpoint: '/api',
    logLevel: 'info',
    allowed: Object.keys(models),
    allowOrigin: "",
    transport: "json-api",
    idValidator: validator.isInt
  }, options || {});
  
  transport = require('./transports/' + options.transport);

  api.use(function(req, res, next) {
    req.locals = req.locals || {};
    req.locals.options = options;
    res.set("Access-Control-Allow-Origin", options.allowOrigin)
    next(); // make sure we go to the next routes and don't stop here
  });

  var errors = {
      invalidResourceId: function(resource_id){
        return {
          errors: {
            title: "Invalid resource id",
            description: util.format("The resource id '%s' is invalid.", resource_id)
          }
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
      routeDoesNotExist: function(routename){
        return {
          errors: {
            title: "Route does not exist",
            description: util.format("The route /%s does not exits.", routename)
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

  options.allowed.forEach(function(model_name){
    if(!(model_name in models)) throw "Error: Unknown model '" + model_name + "'";
    var model = models[model_name];

    model.assocSetters = [];
    model.includes = [];
    model.includes_id = [];
    
    // build the include Array or Object for eager loading associations
    for(association_name in model.associations){
      association = model.associations[association_name]
      var targetName = association.target.tableName.toLowerCase();
      if(association.associationType == 'HasMany'){
        model.assocSetters.push({name: targetName, setter: association.accessors.set});
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
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, X-AUTHENTICATION, X-IP, Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.send('');
  })

  api.initialize = function (){
    // route /model
    api.route('/:resource')
      .all(function(req, res, next){
        if(req.params.resource in models){
          req.locals.model = models[req.params.resource];
          req.locals.model_name = inflection.singularize(req.locals.model.tableName.toLowerCase());
          req.locals.routename = inflection.pluralize(req.locals.model.tableName.toLowerCase());

          next();
        }else{
          res.json(errors.routeDoesNotExist(req.params.resource))
        }
      })
      .get(function(req, res) {
        req.locals.query_options = _.merge(
          {include: req.locals.model.includes_id},
          req.locals.query_options || {});
        req.locals.model
          .findAll(req.locals.query_options)
          .success(function(instances){
            var values = [];
            instances.forEach(function(instance){
              values.push(transport.serializeOne(req,instance));
            });
            ret = {}
            ret[req.locals.routename] = instances;
            res.json(ret);
          });
      })
      .post(function(req, res) {
        req.locals.model
          .create(transport.deserialize(req))
          .success(function(instance){
            var values = transport.serializeOne(req,instance);
            ret = {}
            ret[req.locals.routename] = values;
            res.status(201).json(ret);
          })
          .error(function(err){
              res.json({error: err, req: req.body});
          });
      });

    // route /model/id
    api.route('/:resource/:id')
      .all(function(req, res, next){
        if(req.params.resource in models){
          req.locals.model = models[req.params.resource];
          req.locals.model_name = inflection.singularize(req.locals.model.tableName.toLowerCase());
          req.locals.routename = inflection.pluralize(req.locals.model.tableName.toLowerCase());

          if(!options.idValidator(req.params.id)){
            res.json(errors.invalidResourceId(req.params.id))
          }else{
            next();
          }
        }else{
          res.json(errors.routeDoesNotExist(req.params.resource))
        }
      })
      .get(function(req, res) {
        if(req.params.id.indexOf(',') > 0){
          res.json(errors.notYetImplemented())
        }else{
          req.locals.query_options = _.merge(
            {where: {id: req.params.id}, include: req.locals.model.includes_id},
            req.locals.query_options || {});
          req.locals.model
            .find(req.locals.query_options)
            .success(function(instance){
              if(instance){
                var values = transport.serializeOne(req,instance);
                ret = {}
                ret[req.locals.routename] = values;
                res.json(ret);
              }else{
                res.json(errors.doesNotExist(req.locals.routename, req.params.id))
              }
            })
            .error(function(err){
              res.send('error');
            });
        }
      })
      .put(function(req, res) {
        var model = req.locals.model;
        var routename = req.locals.routename;
        var attributes = transport.deserialize(req);

        req.locals.query_options = _.merge(
          {where: {id: req.params.id}, include: model.includes_id},
          req.locals.query_options || {});
        model
          .find(req.locals.query_options)
          .success(function(instance){
            if(instance){
              // run the setters
              Promise.map(model.assocSetters, function(assoc){
                console.log(assoc.name, assoc.setter);
                if(attributes[assoc.name] && attributes[assoc.name].length > 0){
                  // get the linked objects
                  return Promise.map(attributes[assoc.name], function(assocId){
                    return models[assoc.name].find({where: {id: assocId}});
                  }).then(function(assocList){
                    // filter items that weren't found
                    assocList = assocList.filter(function(n){ return n != undefined });
                    // remove from attributes
                    delete attributes[assoc.name];
                    return instance[assoc.setter](assocList);
                  })
                }else if(attributes[assoc.name]){
                  // empty association
                  return instance[assoc.setter]([]);
                }else{
                  return;
                }
              }).then(function(){
                // finally update attributes
                instance
                  .updateAttributes(attributes)
                  .success(function(instance) {
                    instance
                      .reload(req.locals.query_options)
                      .success(function(instance) {
                        var values = transport.serializeOne(req,instance);
                        ret = {}
                        ret[routename] = values;
                        res.json(ret);
                      });
                  });
              }).catch(function(err){
                console.log(err);
                res.send('error');
              });
            }else{
              res.json(errors.doesNotExist(routename, req.params.id))
            }
          })
          .error(function(err){
            res.send('error');
          });
      })
      .delete(function(req, res) {
        if(req.params.id.indexOf(',') > 0){
          res.json(errors.notYetImplemented())
        }else{
          req.locals.query_options = _.merge(
            {where: {id: req.params.id}},
            req.locals.query_options || {});
          req.locals.model
            .find(req.locals.query_options)
            .success(function(instance){
              if(instance){
                instance
                  .destroy()
                  .success(function(){
                    res.status(204).send('');
                  })
              }else{
                res.json(errors.doesNotExist(req.locals.routename, req.params.id))
              }
            });
        }
      });
    api.route('/:resource/:id/:collection')
      .all(function(req, res, next){
        req.locals.model = models[req.params.collection];
        req.locals.routename = inflection.pluralize(req.locals.model.tableName.toLowerCase());
        req.association = models[req.params.resource];

        req.identifier = req.locals.model.associations[req.association.name].identifier

        if(!options.idValidator(req.params.id)){
          res.json(errors.invalidResourceId(req.params.id))
        }else{
          next();
        }
      })
      .get(function(req, res) {
        req.locals.query_options = _.merge(
          {
            where:{},
            include: req.locals.model.includes_id
          },
          req.locals.query_options || {});
        req.locals.query_options.where[req.identifier] = req.params.id;
        req.locals.model
          .findAll(req.locals.query_options)
          .success(function(instances){
            var values = [];
            instances.forEach(function(instance){
              values.push(transport.serializeOne(req,instance));
            });
            ret = {}
            ret[req.locals.routename] = instances;
            res.json(ret);
          });
      });
  }
  return api;
}
