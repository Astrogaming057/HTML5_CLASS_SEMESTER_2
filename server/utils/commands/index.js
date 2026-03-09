const fs = require('fs');
const path = require('path');

// Load all command files dynamically
const commands = {};
const commandsDir = __dirname;

// Helper to get commands object (for use by commands that need to access other commands)
function getCommands() {
  return commands;
}

const commandFiles = fs.readdirSync(commandsDir).filter(file => 
  file.endsWith('.js') && file !== 'index.js' && file !== 'utils.js'
);

for (const file of commandFiles) {
  const commandName = path.basename(file, '.js');
  try {
    const commandModule = require(path.join(commandsDir, file));
    if (commandModule && typeof commandModule.execute === 'function') {
      commands[commandName] = commandModule;
    }
  } catch (error) {
    console.error(`Error loading command ${commandName}:`, error);
  }
}

// Get all command names and their metadata
function getAllCommands() {
  const commandList = [];
  
  for (const [name, module] of Object.entries(commands)) {
    if (module && typeof module.execute === 'function') {
      commandList.push({
        name: name,
        description: module.description || '',
        category: module.category || 'Other',
        aliases: module.aliases || []
      });
    }
  }
  
  return commandList.sort((a, b) => a.name.localeCompare(b.name));
}

// Get commands by category
function getCommandsByCategory() {
  const categorized = {};
  
  for (const [name, module] of Object.entries(commands)) {
    if (module && typeof module.execute === 'function') {
      const category = module.category || 'Other';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push({
        name: name,
        description: module.description || '',
        aliases: module.aliases || []
      });
    }
  }
  
  // Sort commands within each category
  for (const category in categorized) {
    categorized[category].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return categorized;
}

// Execute a command
async function executeCommand(commandName, context, args = []) {
  // Check direct match
  if (commands[commandName]) {
    return await commands[commandName].execute(context, args);
  }
  
  // Check aliases
  for (const [name, module] of Object.entries(commands)) {
    if (module && module.aliases && module.aliases.includes(commandName)) {
      return await module.execute(context, args);
    }
  }
  
  return {
    success: false,
    message: `Unknown command: ${commandName}. Type 'help' for available commands.`
  };
}

module.exports = {
  commands,
  getCommands,
  getAllCommands,
  getCommandsByCategory,
  executeCommand
};
