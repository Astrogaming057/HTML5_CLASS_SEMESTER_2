const os = require('os');

module.exports = {
  name: 'whoami',
  description: 'Show current user',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: `User: ${os.userInfo().username || 'Unknown'}\nHome: ${os.userInfo().homedir || 'N/A'}`
    };
  }
};
