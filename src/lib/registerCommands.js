const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

function loadCommandModules() {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  return commandFiles.map(file => {
    const command = require(path.join(commandsPath, file));
    if (!command.data || !command.execute) {
      throw new Error(`El comando ${file} necesita data y execute.`);
    }
    return command;
  });
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    throw new Error('Faltan DISCORD_TOKEN o CLIENT_ID para registrar comandos.');
  }

  const commandModules = loadCommandModules();
  const commands = commandModules.map(command => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(token);

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  console.log(`🔁 Registrando ${commands.length} comandos ${guildId ? `en servidor ${guildId}` : 'globalmente'}...`);
  await rest.put(route, { body: commands });
  console.log('✅ Comandos slash registrados.');

  return commandModules;
}

module.exports = { loadCommandModules, registerCommands };
