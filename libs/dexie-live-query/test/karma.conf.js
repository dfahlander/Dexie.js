// Include common configuration
const {karmaCommon, getKarmaConfig, defaultBrowserMatrix} = require('../../../test/karma.common');

module.exports = function (config) {
  const cfg = getKarmaConfig({
    // Be fine with testing on local travis firefox
    ci: [
      "Firefox",
      "bs_chrome_latest_supported",
      "bs_safari_latest_supported"
    ],
    pre_npm_publish: [
      "Firefox",
      "bs_chrome_latest_supported",
      "bs_safari_latest_supported"
    ]
  }, {
    // Base path should point at the root 
    basePath: '../../../',
    files: karmaCommon.files.concat([
      'node_modules/rxjs/bundles/rxjs.umd.js',
      'dist/dexie.js',
      'libs/dexie-live-query/dist/dexie-live-query.js',
      'libs/dexie-live-query/test/bundle.js',
      { pattern: 'libs/dexie-live-query/test/*.map', watched: false, included: false },
      { pattern: 'libs/dexie-live-query/dist/*.map', watched: false, included: false }
    ])
  });

  config.set(cfg);
}
