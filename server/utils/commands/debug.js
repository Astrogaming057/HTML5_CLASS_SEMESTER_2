module.exports = {
  name: 'debug',
  description: 'Toggle debug mode',
  category: 'Development & Debug',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: `Debug mode: ${process.env.DEBUG ? 'Enabled' : 'Disabled'}\nSet DEBUG environment variable to enable.`
    };
  }
};
