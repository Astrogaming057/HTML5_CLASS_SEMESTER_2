module.exports = {
  name: 'trace',
  description: 'Show stack trace',
  category: 'Development & Debug',
  aliases: [],
  
  execute(context, args = []) {
    const stack = new Error().stack;
    return {
      success: true,
      message: `Stack Trace:\n${stack.split('\n').slice(2, 10).join('\n')}`
    };
  }
};
