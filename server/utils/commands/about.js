module.exports = {
  name: 'about',
  description: 'Show about information',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: [
        'About:',
        '  HTMLCLASS Server',
        '  A web-based code editor and preview system',
        `  Node.js ${process.version}`,
        `  Platform: ${process.platform}`
      ].join('\n')
    };
  }
};
