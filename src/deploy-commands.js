require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { info, error } = require('./utils/logger');
const embedCommand = require('./commands/embed');

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token) throw new Error('Falta DISCORD_TOKEN en las variables de entorno.');
  if (!clientId) throw new Error('Falta CLIENT_ID en las variables de entorno.');

  const rest = new REST({ version: '10' }).setToken(token);
  const commands = [embedCommand.data.toJSON()];

  if (guildId) {
    info(`Registrando comandos en el servidor ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    info('Comandos de servidor registrados.');
    return;
  }

  info('Registrando comandos globales...');
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  info('Comandos globales registrados. Pueden tardar un poco en aparecer en todos los servidores.');
}

if (require.main === module) {
  deployCommands().catch(err => {
    error('No se pudieron registrar los comandos.', err);
    process.exit(1);
  });
}

module.exports = { deployCommands };
