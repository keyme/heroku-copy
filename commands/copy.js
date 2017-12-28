'use strict';

let co         = require('co');
let Apps       = require('../lib/apps');
let Addons     = require('../lib/addons');
let cli        = require('heroku-cli-util');

let stopping;
let fromAppName;
let toAppName;

function wait(ms) {
  return function(done) {
    setTimeout(done, ms);
  };
}

function handleErr(context, heroku) {
  return function (err) {
    cli.errorHandler({
      exit:    false,
      logPath: context.herokuDir + '/error.log',
    })(err);

    process.exit(1);
  };
}

function getFromApp(context) {
  let fromAppName = context.flags.from;
  if (!fromAppName) {
    cli.error('No source app specified.\nSpecify an app to copy from with --from APP');
    return;
  }
  context.app = fromAppName;
  return fromAppName;
}

function getToApp(context) {
  return context.flags.to;
}

function* copy (context, heroku) {
  let apps = new Apps(heroku);
  let addons = new Addons(heroku);

  let oldApp = yield apps.getApp(fromAppName);
  let slug   = yield apps.getLastSlug(oldApp);

  if (stopping) { return; }
  let newApp = yield apps.getApp(toAppName);

  if (stopping) { return; }
  yield cli.action('Setting buildpacks', apps.setBuildpacks(oldApp, newApp));

  if (stopping) { return; }
  yield addons.copyConfigVars(oldApp, newApp);

  if (stopping) { return; }
  yield apps.copySlug(oldApp, newApp, slug);

  yield wait(2000);

  console.log(`Copy complete. View it at ${cli.color.cyan(newApp.web_url)}`);
}

function* run (context, heroku) {
  fromAppName = getFromApp(context);
  if (!fromAppName) { return; }
  toAppName = getToApp(context);
  if (!toAppName) { return; }
  process.once('SIGINT', function () {
    stopping = true;
  });
  try {
    yield copy(context, heroku);
  } catch (err) {
    if (err.body && err.body.id === 'two_factor') throw err;
    handleErr(context, heroku)(err);
  }
}

const cmd = {
  needsAuth: true,
  hidden: true,
  description: 'copy an existing app into another app',
  help: `Copy config vars and slug to an existing app.
Example:

    $ heroku copy --from my-production-app --to my-development-app`,
  flags: [
    {name: 'from', description: 'app to copy from', hasValue: true},
    {name: 'to', description: 'app to create', hasValue: true}
  ],
  run: cli.command({preauth: true}, co.wrap(run))
};

exports.apps = Object.assign({topic: 'copy', hidden: true}, cmd);
exports.root = Object.assign({topic: 'apps', command: 'copy'}, cmd);
