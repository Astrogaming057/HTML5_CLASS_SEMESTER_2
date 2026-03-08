module.exports = {
  name: 'env',
  description: 'Show environment variables',
  category: 'System Information',
  aliases: [],
  
  execute(context, args = []) {
    const envVars = Object.keys(process.env)
      .filter(key => !key.includes('PASSWORD') && !key.includes('SECRET') && !key.includes('KEY'))
      .slice(0, 20)
      .map(key => `  ${key}=${process.env[key]?.substring(0, 50) || ''}`)
      .join('\n');
    
    return {
      success: true,
      message: `Environment Variables (first 20, excluding secrets):\n${envVars}`
    };
  }
};
