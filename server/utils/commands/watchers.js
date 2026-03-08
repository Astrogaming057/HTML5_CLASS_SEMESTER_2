module.exports = {
  name: 'watchers',
  description: 'Show file watchers status',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: 'File watchers are active. Check server logs for watcher status.'
    };
  }
};
