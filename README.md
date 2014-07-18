sequelize-json-api
==================

An express router module that adds a [JSON API](http://jsonapi.org/) for all defined [Sequelize](http://sequelizejs.com/) models to your application.

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

app.use('/api', api);

app.listen();
```

Options
-------

```javascript
{
    endpoint: '/api', // the api endpoint, this is used to build resource URLs
    allowed: [], // a list of models to expose on the api, default so all if none specified
    allowOrigin: "*" // the value for the Access-Control-Allow-Origin header to support CORS
}
```

Exposed Routes
--------------

Method | Route                        |        |
-------|------------------------------|-------------------------------------|
GET    | `/:resource`                 | Returns a [resource collection][2] of `:resources`|
POST   | `/:resource`                 | Create a new `:resource` and returns [individual resource][1] |
GET    | `/:resource/:id`             | Returns the [individual resource][1] `:resource/:id` |
PUT    | `/:resource/:id`             | Updates and returns the [individual resource][1] `:resource/:id` |
DELETE | `/:resource/:id`             | Deletes `:resource/:id` |
GET    | `/:resource/:id/:collection` | Returns a [resource collection][2] of `:collection` where associated with `:resource/:id` |

[1]: http://jsonapi.org/format/#document-structure-individual-resource-representations "Individual Resource"
[2]: http://jsonapi.org/format/#document-structure-resource-collection-representations "Resource Collection"
