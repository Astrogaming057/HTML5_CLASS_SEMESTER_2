module.exports = {
  name: 'pwd',
  description: 'Show current working directory',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: `Current Directory: ${process.cwd()}\nBase Directory: ${context.baseDir}`
    };
  }
};
