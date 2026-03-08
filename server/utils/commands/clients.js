module.exports = {
  name: 'clients',
  description: 'Show connected WebSocket clients',
  category: 'Network & Connections',
  aliases: [],
  
  execute(context, args = []) {
    const clientCount = context.wsManager ? context.wsManager.clients.size : 0;
    const clients = context.wsManager ? Array.from(context.wsManager.clients) : [];
    
    const readyStates = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    };
    
    const states = clients.map(c => readyStates[c.readyState] || 'UNKNOWN');
    const openCount = states.filter(s => s === 'OPEN').length;
    
    return {
      success: true,
      message: [
        'WebSocket Clients:',
        `  Total: ${clientCount}`,
        `  Open: ${openCount}`,
        `  States: ${states.join(', ')}`
      ].join('\n'),
      data: {
        total: clientCount,
        open: openCount,
        states: states
      }
    };
  }
};
