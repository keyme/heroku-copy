'use strict';

let _   = require('lodash');
let cli = require('heroku-cli-util');

function Apps (heroku) {
  this.heroku = heroku;
}

Apps.prototype = {
  getApp: function* (app) {
    try {
      return yield this.heroku.get(`/apps/${app}`);
    } catch(err) {
      if (err.statusCode === 404) {
        console.error(`Couldn't find app ${cli.color.cyan(app)}.`);
        process.exit(1);
      } else { throw err; }
    }
  },

  getLastRelease: function* (app) {
    let releases = yield this.heroku.request({
      path: `/apps/${app.name}/releases`,
      headers: { 'Range': 'version ..; order=desc;'}
    });
    let release = _.chain(releases)
    .filter('slug')
    .first()
    .value();
    if (!release) {
      throw new Error(`No slug for app ${cli.color.cyan(app.name)} was found.
Push some code to ${cli.color.cyan(app.name)} before copying it.`);
    }
    return release;
  },

  getLastSlug: function* (app) {
    let release = yield this.getLastRelease(app);
    return yield this.heroku.get(`/apps/${app.name}/slugs/${release.slug.id}`);
  },

  copySlug: function* (oldApp, newApp, slug) {
    if (slug.commit) {
      process.stdout.write(`Deploying ${cli.color.green(slug.commit.substring(0,7))} to ${cli.color.cyan(newApp.name)}... `);
    } else {
      process.stdout.write(`Deploying to ${cli.color.cyan(newApp.name)}... `);
    }
    yield this.heroku.post(`/apps/${newApp.name}/releases`, {body: {
      slug: slug.id,
      description: `Copied from ${oldApp.name}`
    }});
    console.log('done');
  },

  setBuildpacks: function (oldApp, newApp) {
    let heroku = this.heroku;
    return heroku.request({
      headers: {'Range': ''},
      path: `/apps/${oldApp.name}/buildpack-installations`
    }).then(function (buildpacks) {
      if (buildpacks.length === 0) { return; }
      buildpacks = buildpacks.map(function (buildpack) {
        return {buildpack: buildpack.buildpack.url};
      });
      return heroku.request({
        method: 'PUT',
        body: {updates: buildpacks},
        headers: {'Range': ''},
        path: `/apps/${newApp.name}/buildpack-installations`
      });
    });
  }
};

module.exports = Apps;
