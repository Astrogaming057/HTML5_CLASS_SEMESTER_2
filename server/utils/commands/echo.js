module.exports = {
  name: 'echo',
  description: 'Echo text',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: args.join(' ') || '(empty)'
    };
  }
};
