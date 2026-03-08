module.exports = {
  name: 'clear',
  description: 'Clear terminal output',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: 'CLEAR_TERMINAL',
      data: { action: 'clear' }
    };
  }
};
