'use strict';

let _   = require('lodash');
let cli = require('heroku-cli-util');
let util = require('util');

function ErrorPlanNotFound() {
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);

  this.name = this.constructor.name;
}

util.inherits(ErrorPlanNotFound, Error);

function Addons (heroku) {
  this.heroku = heroku;
}

Addons.prototype = {
  copyConfigVars: function* (oldApp, newApp) {
    console.log(`Copying config vars:`);
    let oldConfigVars = yield this.heroku.get(`/apps/${oldApp.name}/config-vars`);
    let newConfigVars = yield this.heroku.get(`/apps/${newApp.name}/config-vars`);

    let clearedConfigVars = _.reduce(Object.keys(newConfigVars), function (result, key) {
      result[key] = null;
      return result;
    }, {});

    let configVars = _.reduce(Object.keys(oldConfigVars), function (result, key) {
      result[key] = oldConfigVars[key];
      return result;
    }, clearedConfigVars);

    for (var key of Object.keys(configVars)) {
      let color = configVars[key] === null ? cli.color.red : cli.color.green;
      console.log(`  ${color(key)}`);
    }

    process.stdout.write('  ... ');
    yield this.heroku.request({
      method: 'PATCH',
      path: `/apps/${newApp.name}/config-vars`,
      body: configVars
    });
    console.log('done');
  }
};

module.exports = Addons;
