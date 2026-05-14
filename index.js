import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { DefaultExtractors } from '@discord-player/extractor';
import { GuildQueueEvent, Player, useMainPlayer } from 'discord-player';
import { commands } from './commands.js';
import { requireConfig } from './config.js';

const token = requireConfig('DISCORD_TOKEN');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = new Player(client);
await player.extractors.loadMulti(DefaultExtractors);

client.commands = new Collection();

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    const mainPlayer = useMainPlayer();
    await mainPlayer.context.provide(
      { guild: interaction.guild },
      () => command.execute(interaction)
    );
  } catch (error) {
    console.error(error);

    const message = '❌ Ocurrio un error ejecutando el comando.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

player.events.on(GuildQueueEvent.PlayerStart, async (queue, track) => {
  const channel = queue.metadata?.channel;
  if (!channel) return;

  await channel.send(`🎧 Reproduciendo ahora: **${track.title || track.name}**`).catch(() => {});
});

player.events.on(GuildQueueEvent.PlayerFinish, async (queue, track) => {
  const channel = queue.metadata?.channel;
  if (!channel) return;

  await channel.send(`✅ Termino: **${track.title || track.name}**`).catch(() => {});
});

player.events.on(GuildQueueEvent.Error, async (queue, error) => {
  console.error('Error en la cola:', error);

  const channel = queue.metadata?.channel;
  if (!channel) return;

  await channel.send('❌ Hubo un error con la musica.').catch(() => {});
});

client.login(token);
