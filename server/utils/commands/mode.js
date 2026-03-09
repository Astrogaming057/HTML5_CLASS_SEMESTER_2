module.exports = {
  name: 'mode',
  description: 'Show server mode (app or browser)',
  category: 'System Information',
  aliases: ['app-mode', 'browser-mode'],
  
  execute(context, args = []) {
    const mode = process.env.SERVER_MODE || global.__SERVER_MODE || 'browser';
    const isAppMode = mode === 'app';
    
    return {
      success: true,
      message: `Server Mode: ${isAppMode ? 'App (Electron)' : 'Browser'}\n` +
               `  Running in: ${isAppMode ? 'Electron application window' : 'Web browser'}\n` +
               `  Auto-launch: ${isAppMode ? 'Disabled' : 'Enabled'}\n` +
               `  Restart method: ${isAppMode ? 'start-app.bat' : 'start.bat'}`
    };
  }
};
