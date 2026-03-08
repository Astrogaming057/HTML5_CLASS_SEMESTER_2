const fs = require('fs').promises;
const path = require('path');

module.exports = {
  name: 'verify',
  description: 'Verify installation',
  category: 'Development & Debug',
  aliases: [],
  
  async execute(context, args = []) {
    try {
      const requiredFiles = ['index.js', 'config.js'];
      const missing = [];
      
      for (const file of requiredFiles) {
        try {
          await fs.stat(path.join(__dirname, '..', '..', file));
        } catch {
          missing.push(file);
        }
      }
      
      return {
        success: missing.length === 0,
        message: missing.length === 0 
          ? '✓ Installation verified. All required files present.'
          : `✗ Missing files: ${missing.join(', ')}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Verification error: ${error.message}`
      };
    }
  }
};
