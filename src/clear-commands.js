require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { info, error } = require('./utils/logger');

function getMode() {
  const raw = (process.argv[2] || 'all').toLowerCase();
  if (['global', 'guild', 'all'].includes(raw)) return raw;
  return 'all';
}

async function clearCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  const mode = getMode();

  if (!token) throw new Error('Falta DISCORD_TOKEN en las variables de entorno.');
  if (!clientId) throw new Error('Falta CLIENT_ID en las variables de entorno.');

  const rest = new REST({ version: '10' }).setToken(token);

  if (mode === 'global' || mode === 'all') {
    info('Borrando comandos globales de esta aplicación...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    info('Comandos globales borrados. Puede tardar un poco en reflejarse en Discord.');
  }

  if (mode === 'guild' || mode === 'all') {
    if (!guildId) {
      if (mode === 'guild') throw new Error('Para borrar comandos de servidor necesitas configurar GUILD_ID.');
      info('GUILD_ID vacío: saltando borrado de comandos de servidor.');
      return;
    }

    info(`Borrando comandos del servidor ${guildId} para esta aplicación...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    info('Comandos del servidor borrados.');
  }
}

if (require.main === module) {
  clearCommands().catch(err => {
    error('No se pudieron borrar los comandos.', err);
    process.exit(1);
  });
}

module.exports = { clearCommands };
