module.exports = {
  name: 'modules',
  description: 'Show loaded modules',
  category: 'Server Management',
  aliases: [],
  
  execute(context, args = []) {
    const modules = Object.keys(require.cache).slice(0, 20);
    return {
      success: true,
      message: [
        'Loaded Modules (first 20):',
        ...modules.map(m => `  ${m}`)
      ].join('\n')
    };
  }
};
