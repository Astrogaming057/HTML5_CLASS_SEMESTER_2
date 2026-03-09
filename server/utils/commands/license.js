module.exports = {
  name: 'license',
  description: 'Show license information',
  category: 'Utilities',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: 'License information not available. Check project documentation.'
    };
  }
};
