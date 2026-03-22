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

/** Server-side remote proxy agent (optional): keeps WSS /agent open for presence */
const REMOTE_PROXY_URL = process.env.REMOTE_PROXY_URL
  ? String(process.env.REMOTE_PROXY_URL).trim()
  : '';
const REMOTE_AGENT_TOKEN = process.env.REMOTE_AGENT_TOKEN
  ? String(process.env.REMOTE_AGENT_TOKEN).trim()
  : '';
const REMOTE_DEVICE_KEY = process.env.REMOTE_DEVICE_KEY
  ? String(process.env.REMOTE_DEVICE_KEY).trim()
  : '';

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_DIR: baseDir,
  DEBUG: debug,
  REMOTE_PROXY_URL,
  REMOTE_AGENT_TOKEN,
  REMOTE_DEVICE_KEY,
  WATCH_OPTIONS: {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  }
};