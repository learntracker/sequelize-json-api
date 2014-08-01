sequelize-json-api
==================

An express router module that adds a JSON api conformant to the  [JSON API](http://jsonapi.org/) spec for all defined [Sequelize](http://sequelizejs.com/) models in your application.

Development Note
----------------

I specifically started this project to support the [Ember Data](https://github.com/emberjs/data) adapter [ember-json-api](https://github.com/daliwali/ember-json-api) but quickly found it has some limitations. I realized this after implementing partial support for JSON API format.

So I now support two transport formats, `json-api` and `ember-restadapter`. The later supports [Ember Data RESTAdapter](http://emberjs.com/api/data/classes/DS.RESTAdapter.html) transport format.

Usage
-----

```javascript
var express = require('express')
  , Sequelize = require('sequelize')
  , api = require('sequelize-json-api')

var sequelize = new Sequelize();

// define models here

api = api(sequelize,{
  endpoint: '/api', // needed for href calculation
})

api.use(function(req,res,next){
	//Do some middleware function
	next();
});

api.initialize();
app.use('/api', api);

app.listen();
```

Options
-------

```javascript
{
    endpoint: '/api', // the api endpoint, this is used to build resource URLs
    allowed: [], // a list of models to expose on the api, default so all if none specified
    allowOrigin: "*", // the value for the Access-Control-Allow-Origin header to support CORS
    transport: "json-api", // the transport format to use for the api, json-api or ember-restadapter
    idValidator: function(id){return true;} //a method to validate ids, default is `validator.isInt`
}
```

Exposed Routes
--------------

Method | Route                        |        |
-------|------------------------------|-------------------------------------|
GET    | `/:resource`                 | Returns a [resource collection][2] of `:resources`|
POST   | `/:resource`                 | Create a new `:resource` and returns [individual resource][1] |
GET    | `/:resource/:id`             | Returns the [individual resource][1] `:resource/:id` |
PUT    | `/:resource/:id`             | (*Pending [issues/6](issues/6)*) Updates and returns the [individual resource][1] `:resource/:id` |
DELETE | `/:resource/:id`             | Deletes `:resource/:id` |
GET    | `/:resource/:id/:collection` | Returns a [resource collection][2] of `:collection` where associated with `:resource/:id` |

[1]: http://jsonapi.org/format/#document-structure-individual-resource-representations "Individual Resource"
[2]: http://jsonapi.org/format/#document-structure-resource-collection-representations "Resource Collection"
