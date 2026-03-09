const os = require('os');

module.exports = {
  name: 'version',
  description: 'Show Node.js and system version',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'Version Information:',
        `  Node.js: ${process.version}`,
        `  Platform: ${process.platform}`,
        `  Architecture: ${process.arch}`,
        `  OS: ${os.type()} ${os.release()}`,
        `  Hostname: ${os.hostname()}`
      ].join('\n')
    };
  }
};
