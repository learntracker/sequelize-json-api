sequelize-json-api
==================

An express router module that adds a [JSON API](http://jsonapi.org/) for all defined [Sequelize](http://sequelizejs.com/) models to your application.

Usage
-----


```javascript
var express = require('express')
  , Sequelize = require('Sequelize-json-api')
	, api = require('sequelize-json-api')

var sequelize = new Sequelize();

// define models here

api = api(sequelize,{
  endpoint: '/api', // needed for href calculation
})

app.use('/api', api);

app.listen();
```
