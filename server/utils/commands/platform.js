const os = require('os');

module.exports = {
  name: 'platform',
  description: 'Show platform information',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'Platform Information:',
        `  Type: ${os.type()}`,
        `  Platform: ${process.platform}`,
        `  Release: ${os.release()}`,
        `  Architecture: ${process.arch}`,
        `  Endianness: ${os.endianness()}`,
        `  Hostname: ${os.hostname()}`
      ].join('\n')
    };
  }
};
