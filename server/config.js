const path = require('path');

const baseDir = process.env.BASE_DIR ? path.resolve(process.env.BASE_DIR) : path.resolve(__dirname, '..');

// Log the BASE_DIR being used (only in app mode to avoid cluttering browser console)
if (process.env.SERVER_MODE === 'app' || process.env.APP_MODE === 'true') {
  console.log(`[Config] BASE_DIR set to: ${baseDir}`);
  console.log(`[Config] BASE_DIR from env: ${process.env.BASE_DIR || 'not set'}`);
}

const debug =
  process.env.HTMLCLASS_DEBUG === '1' ||
  process.env.HTMLCLASS_DEBUG === 'true';

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_DIR: baseDir,
  DEBUG: debug,
  WATCH_OPTIONS: {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  }
};