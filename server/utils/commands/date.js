module.exports = {
  name: 'date',
  description: 'Show current date',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    const now = new Date();
    return {
      success: true,
      message: `Current Date: ${now.toLocaleDateString()} (${now.toISOString().split('T')[0]})`
    };
  }
};
