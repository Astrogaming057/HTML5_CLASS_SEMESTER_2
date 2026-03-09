module.exports = {
  name: 'ports',
  description: 'Show listening ports',
  category: 'Network & Connections',
  aliases: [],
  
  execute(context, args = []) {
    const port = context.server?.address()?.port || 'N/A';
    return {
      success: true,
      message: `Listening Ports:\n  HTTP: ${port}\n  WebSocket: ${port} (same port)`
    };
  }
};
