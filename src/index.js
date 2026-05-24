require('dotenv').config();

const express = require('express');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const { connectDatabase } = require('./lib/database');
const { loadCommandModules, registerCommands } = require('./lib/registerCommands');
const GuildConfig = require('./models/GuildConfig');
const { buildMemberEmbed } = require('./lib/embedFactory');

const requiredVariables = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missingVariables = requiredVariables.filter(name => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${missingVariables.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

function startHealthServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.get('/', (_req, res) => {
    res.json({
      status: 'online',
      bot: client.user?.tag || 'iniciando',
      uptime: process.uptime()
    });
  });

  app.listen(port, () => {
    console.log(`🌐 Health server activo en puerto ${port}.`);
  });
}

async function safeSendMemberEmbed(member, type) {
  const config = await GuildConfig.findOne({ guildId: member.guild.id });
  if (!config) return;

  const data = type === 'welcome' ? config.welcome : config.farewell;
  if (!data?.enabled || !data.channelId) return;

  const channel = await member.guild.channels.fetch(data.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = buildMemberEmbed(type, data, member);
  await channel.send({ embeds: [embed] }).catch(error => {
    console.error(`❌ No pude enviar ${type} en ${member.guild.name}:`, error.message);
  });
}

async function main() {
  startHealthServer();
  await connectDatabase();

  if (process.env.AUTO_DEPLOY_COMMANDS === 'true') {
    await registerCommands();
  }

  const commandModules = loadCommandModules();
  for (const command of commandModules) {
    client.commands.set(command.data.name, command);
  }

  client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Bot conectado como ${readyClient.user.tag}.`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Error ejecutando /${interaction.commandName}:`, error);

      const payload = {
        content: '❌ Ocurrió un error ejecutando este comando. Revisa los logs en Railway.',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  });

  client.on(Events.GuildMemberAdd, member => safeSendMemberEmbed(member, 'welcome'));
  client.on(Events.GuildMemberRemove, member => safeSendMemberEmbed(member, 'farewell'));

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(error => {
  console.error('❌ Error iniciando el bot:', error);
  process.exit(1);
});
