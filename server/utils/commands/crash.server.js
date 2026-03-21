/**
 * TEST ONLY: terminates the Node server process.
 * Use from the Commands terminal (WebSocket server commands).
 *
 * Uses exit code 42 so Electron's main process does NOT auto-restart the child
 * (exit 1 triggers restart after 3s, which made it look like only a log happened).
 */
const logger = require('../logger');

module.exports = {
  description: 'TEST: exit server process (code 42; Electron will not auto-restart)',
  category: 'Testing',
  aliases: [],

  execute() {
    logger.error('[crash.server] intentional process.exit(42) for testing');
    process.exit(42);
  },
};
