module.exports = {
  name: 'threads',
  description: 'Show thread information',
  category: 'Memory & Performance',
  aliases: [],
  
  execute(context, args = []) {
    return {
      success: true,
      message: `Threads: Node.js is single-threaded. Worker threads: ${require('worker_threads').isMainThread ? 'Main thread' : 'Worker thread'}`
    };
  }
};
