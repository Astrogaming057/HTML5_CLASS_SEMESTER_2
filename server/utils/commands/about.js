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
        '  Astro Code',
        '  A web-based IDE (editor, preview, and tools)',
        `  Node.js ${process.version}`,
        `  Platform: ${process.platform}`
      ].join('\n')
    };
  }
};
