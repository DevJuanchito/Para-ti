import { REST, Routes } from 'discord.js';
import { config, requireToken } from './config.js';
import { slashCommandData } from './commands.js';

requireToken();

if (!config.clientId) {
  throw new Error('Falta CLIENT_ID. Este archivo es opcional. El bot tambien registra comandos automaticamente al iniciar.');
}

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: slashCommandData
    });
    console.log(`✅ Comandos registrados en el servidor ${config.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: slashCommandData
    });
    console.log('✅ Comandos globales registrados. Pueden tardar en aparecer.');
  }
} catch (error) {
  console.error('❌ Error registrando comandos:', error);
  process.exit(1);
}
