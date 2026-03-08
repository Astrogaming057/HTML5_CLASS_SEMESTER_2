module.exports = {
  name: 'time',
  description: 'Show current time',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    const now = new Date();
    return {
      success: true,
      message: `Current Time: ${now.toLocaleTimeString()} (${now.toISOString()})`
    };
  }
};
