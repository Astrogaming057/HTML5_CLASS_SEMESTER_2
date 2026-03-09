module.exports = {
  name: 'logs',
  description: 'Show recent logs',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: 'Recent logs are displayed in the Server terminal tab. Use the server output to view logs.'
    };
  }
};
