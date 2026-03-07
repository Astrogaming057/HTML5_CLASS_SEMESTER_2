const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_DIR: path.resolve(__dirname, '..'),
  WATCH_OPTIONS: {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  }
};
