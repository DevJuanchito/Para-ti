import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { requireConfig } from './config.js';

const token = requireConfig('DISCORD_TOKEN');
const clientId = requireConfig('CLIENT_ID');
const guildId = requireConfig('GUILD_ID');

const rest = new REST({ version: '10' }).setToken(token);
const body = commands.map((command) => command.data.toJSON());

try {
  console.log('🔄 Registrando comandos slash en el servidor...');

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body }
  );

  console.log('✅ Comandos registrados correctamente.');
} catch (error) {
  console.error('❌ Error registrando comandos:', error);
}
