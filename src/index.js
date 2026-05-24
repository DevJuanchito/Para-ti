require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const { deployCommands } = require('./deploy-commands');
const { info, warn, error } = require('./utils/logger');
const embedCommand = require('./commands/embed');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  error('Falta DISCORD_TOKEN. Crea tus variables en Railway o en tu archivo .env local.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
client.commands.set(embedCommand.data.name, embedCommand);

client.once(Events.ClientReady, readyClient => {
  info(`Bot conectado como ${readyClient.user.tag}`);
  info(`Usa /embed ayuda para ver el panel.`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton()) {
      const handled = await embedCommand.handleButton(interaction);
      if (handled) return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction);
  } catch (err) {
    error('Error procesando interacción.', err);
    const payload = {
      content: '❌ Ocurrió un error ejecutando el comando. Revisa la consola del bot.',
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

process.on('unhandledRejection', err => error('Unhandled rejection:', err));
process.on('uncaughtException', err => error('Uncaught exception:', err));

async function main() {
  if (process.env.AUTO_DEPLOY_COMMANDS === 'true') {
    try {
      await deployCommands();
    } catch (err) {
      warn('El bot seguirá iniciando, pero no pudo registrar comandos automáticamente.', err);
    }
  }

  await client.login(token);
}

main().catch(err => {
  error('No se pudo iniciar el bot.', err);
  process.exit(1);
});
