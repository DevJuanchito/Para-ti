import ffmpegPath from 'ffmpeg-static';
import play from 'play-dl';
import {
  ActivityType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} from '@discordjs/voice';
import { config, requireToken } from './config.js';
import { slashCommandData } from './commands.js';

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;
requireToken();

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];

if (config.enablePrefixCommands) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });
const queues = new Map();

class UserError extends Error {}

function brandEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'JUANPLAY • Bot creado para JuanStudio' })
    .setTimestamp();
}

function errorEmbed(message) {
  return brandEmbed('JUANPLAY aviso', `❌ ${message}`);
}

function formatDuration(raw) {
  if (!raw) return 'En vivo / desconocido';
  if (typeof raw === 'string') return raw;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) return 'Desconocido';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function bestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0]?.url ?? null;
}

function cleanTitle(title) {
  return title || 'Cancion sin titulo';
}

function videoToSong(video, requestedBy) {
  return {
    title: cleanTitle(video.title),
    url: video.url,
    duration: video.durationRaw || formatDuration(video.durationInSec),
    thumbnail: bestThumbnail(video.thumbnails),
    requestedBy: requestedBy?.tag || requestedBy?.username || 'Usuario'
  };
}

async function resolveSongs(query, requestedBy) {
  const search = query.trim();
  if (!search) throw new UserError('Escribe el nombre o URL de una cancion.');

  const type = play.yt_validate(search);

  if (type === 'playlist') {
    const playlist = await play.playlist_info(search, { incomplete: true });
    const videos = await playlist.all_videos();
    const limited = videos.slice(0, config.maxPlaylistSongs);
    if (limited.length === 0) throw new UserError('No encontre canciones en esa playlist.');
    return limited.map(video => videoToSong(video, requestedBy));
  }

  if (type === 'video') {
    const info = await play.video_basic_info(search);
    const details = info.video_details;
    return [
      {
        title: cleanTitle(details.title),
        url: details.url,
        duration: details.durationRaw || formatDuration(details.durationInSec),
        thumbnail: bestThumbnail(details.thumbnails),
        requestedBy: requestedBy?.tag || requestedBy?.username || 'Usuario'
      }
    ];
  }

  const results = await play.search(search, {
    limit: 1,
    source: { youtube: 'video' }
  });

  if (!results.length) {
    throw new UserError('No encontre esa cancion. Prueba con otro nombre o con una URL de YouTube.');
  }

  return [videoToSong(results[0], requestedBy)];
}

function getState(guild) {
  let state = queues.get(guild.id);

  if (!state) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    state = {
      guildId: guild.id,
      player,
      connection: null,
      current: null,
      songs: [],
      textChannel: null,
      leaveTimer: null
    };

    player.on(AudioPlayerStatus.Idle, () => {
      playNext(guild.id).catch(error => {
        console.error('[JUANPLAY] Error al reproducir la siguiente cancion:', error);
      });
    });

    player.on('error', error => {
      console.error('[JUANPLAY] Error del reproductor:', error);
      sendToTextChannel(state, `⚠️ Error reproduciendo la cancion. Saltando a la siguiente...`).catch(() => {});
      playNext(guild.id).catch(console.error);
    });

    queues.set(guild.id, state);
  }

  return state;
}

async function sendToTextChannel(state, contentOrEmbed) {
  const channel = state.textChannel;
  if (!channel || !channel.isTextBased?.()) return;

  if (typeof contentOrEmbed === 'string') {
    await channel.send({ content: contentOrEmbed }).catch(() => {});
    return;
  }

  await channel.send({ embeds: [contentOrEmbed] }).catch(() => {});
}

function scheduleLeave(guildId) {
  const state = queues.get(guildId);
  if (!state) return;

  clearTimeout(state.leaveTimer);
  state.leaveTimer = setTimeout(() => {
    const latestState = queues.get(guildId);
    if (!latestState || latestState.current || latestState.songs.length > 0) return;
    destroyQueue(guildId, false);
  }, Math.max(10, config.staySeconds) * 1000);
}

function destroyQueue(guildId, notify = true) {
  const state = queues.get(guildId);
  const connection = getVoiceConnection(guildId) || state?.connection;

  if (state) {
    clearTimeout(state.leaveTimer);
    state.songs = [];
    state.current = null;
    state.player.stop(true);
  }

  if (connection) {
    try {
      connection.destroy();
    } catch {}
  }

  if (notify && state) {
    sendToTextChannel(state, '👋 JUANPLAY salio del canal de voz.').catch(() => {});
  }

  queues.delete(guildId);
}

async function connectToUserVoice(context) {
  const member = context.member;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    throw new UserError('Primero entra a un canal de voz y vuelve a usar el comando.');
  }

  const me = voiceChannel.guild.members.me;
  const permissions = voiceChannel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.Connect)) {
    throw new UserError('No tengo permiso para conectarme a tu canal de voz.');
  }

  if (!permissions?.has(PermissionFlagsBits.Speak)) {
    throw new UserError('No tengo permiso para hablar en tu canal de voz.');
  }

  const state = getState(context.guild);
  state.textChannel = context.channel;
  clearTimeout(state.leaveTimer);

  if (state.connection && state.connection.joinConfig.channelId === voiceChannel.id) {
    state.connection.subscribe(state.player);
    return state;
  }

  const oldConnection = getVoiceConnection(context.guild.id);
  if (oldConnection) {
    try {
      oldConnection.destroy();
    } catch {}
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: context.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  connection.on('error', error => console.error('[JUANPLAY] Error de conexion de voz:', error));
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      ]);
    } catch {
      destroyQueue(context.guild.id, false);
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  connection.subscribe(state.player);
  state.connection = connection;
  return state;
}

async function playNext(guildId) {
  const state = queues.get(guildId);
  if (!state) return;

  clearTimeout(state.leaveTimer);

  const next = state.songs.shift();
  if (!next) {
    state.current = null;
    scheduleLeave(guildId);
    return;
  }

  state.current = next;

  try {
    const source = await play.stream(next.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(source.stream, {
      inputType: source.type,
      metadata: next
    });

    state.player.play(resource);

    const embed = brandEmbed('🎧 JUANPLAY esta sonando', `[${next.title}](${next.url})`)
      .addFields(
        { name: 'Duracion', value: next.duration || 'Desconocida', inline: true },
        { name: 'Pedido por', value: next.requestedBy || 'Usuario', inline: true }
      );

    if (next.thumbnail) embed.setThumbnail(next.thumbnail);
    await sendToTextChannel(state, embed);
  } catch (error) {
    console.error('[JUANPLAY] No pude reproducir:', error);
    await sendToTextChannel(state, `⚠️ No pude reproducir **${next.title}**. Saltando a la siguiente...`);
    state.current = null;
    await playNext(guildId);
  }
}

function makeSongList(songs) {
  return songs
    .slice(0, 10)
    .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) • ${song.duration || 'Desconocida'}`)
    .join('\n');
}

async function safeReply(context, payload) {
  if (context.type === 'interaction') {
    if (context.interaction.deferred || context.interaction.replied) {
      return context.interaction.editReply(payload);
    }
    return context.interaction.reply(payload);
  }

  return context.message.reply(payload);
}

async function safeDefer(context) {
  if (context.type === 'interaction' && !context.interaction.deferred && !context.interaction.replied) {
    await context.interaction.deferReply();
  }
}

async function commandHelp(context) {
  const prefixLine = config.enablePrefixCommands
    ? `\n\nTambien puedes usar comandos con prefijo: \`${config.prefix}play\`, \`${config.prefix}skip\`, \`${config.prefix}help\`.`
    : '';

  const embed = brandEmbed(
    '🎵 JUANPLAY comandos',
    [
      '`/juanplay busqueda` - reproduce musica con nombre unico.',
      '`/play busqueda` - reproduce una cancion o URL.',
      '`/skip` - salta la cancion actual.',
      '`/pause` - pausa.',
      '`/resume` - continua.',
      '`/queue` - mira la cola.',
      '`/nowplaying` - cancion actual.',
      '`/stop` - detiene todo y sale.',
      '`/leave` - sale del canal.',
      '`/ping` - prueba el bot.',
      prefixLine
    ].join('\n')
  );

  await safeReply(context, { embeds: [embed] });
}

async function commandPlay(context, query) {
  await safeDefer(context);

  const state = await connectToUserVoice(context);
  const songs = await resolveSongs(query, context.user);
  state.songs.push(...songs);

  const wasIdle = !state.current && state.player.state.status !== AudioPlayerStatus.Playing;
  if (wasIdle) await playNext(context.guild.id);

  const embed = brandEmbed(
    songs.length > 1 ? '✅ Playlist agregada a JUANPLAY' : '✅ Cancion agregada a JUANPLAY',
    songs.length > 1
      ? `Agregue **${songs.length}** canciones a la cola. Maximo configurado: **${config.maxPlaylistSongs}**.`
      : `[${songs[0].title}](${songs[0].url})`
  );

  if (songs.length === 1 && songs[0].thumbnail) embed.setThumbnail(songs[0].thumbnail);
  await safeReply(context, { embeds: [embed] });
}

async function commandSkip(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna cancion sonando ahora.');

  const skipped = state.current;
  state.player.stop(true);
  await safeReply(context, { embeds: [brandEmbed('⏭️ JUANPLAY salto la cancion', `Saltada: **${skipped.title}**`)] });
}

async function commandStop(context) {
  const state = queues.get(context.guild.id);
  if (!state) throw new UserError('JUANPLAY no esta reproduciendo nada.');

  destroyQueue(context.guild.id, false);
  await safeReply(context, { embeds: [brandEmbed('⏹️ JUANPLAY detenido', 'Limpie la cola y sali del canal de voz.')] });
}

async function commandPause(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna cancion para pausar.');

  const paused = state.player.pause(true);
  if (!paused) throw new UserError('No pude pausar la cancion ahora mismo.');

  await safeReply(context, { embeds: [brandEmbed('⏸️ JUANPLAY pausado', `Pausado: **${state.current.title}**`)] });
}

async function commandResume(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna cancion para continuar.');

  const resumed = state.player.unpause();
  if (!resumed) throw new UserError('No pude continuar la cancion ahora mismo.');

  await safeReply(context, { embeds: [brandEmbed('▶️ JUANPLAY continua', `Sonando: **${state.current.title}**`)] });
}

async function commandQueue(context) {
  const state = queues.get(context.guild.id);

  if (!state?.current && (!state || state.songs.length === 0)) {
    throw new UserError('La cola esta vacia. Usa `/juanplay` o `/play` para poner musica.');
  }

  const currentLine = state.current ? `🎧 Ahora: [${state.current.title}](${state.current.url})` : '🎧 Ahora: nada';
  const nextLines = state.songs.length > 0 ? makeSongList(state.songs) : 'No hay mas canciones en cola.';
  const extra = state.songs.length > 10 ? `\n\nY **${state.songs.length - 10}** canciones mas...` : '';

  await safeReply(context, {
    embeds: [brandEmbed('📜 Cola de JUANPLAY', `${currentLine}\n\n${nextLines}${extra}`)]
  });
}

async function commandNowPlaying(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna cancion sonando ahora.');

  const song = state.current;
  const embed = brandEmbed('🎶 Sonando ahora en JUANPLAY', `[${song.title}](${song.url})`)
    .addFields(
      { name: 'Duracion', value: song.duration || 'Desconocida', inline: true },
      { name: 'Pedido por', value: song.requestedBy || 'Usuario', inline: true },
      { name: 'En cola', value: String(state.songs.length), inline: true }
    );

  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  await safeReply(context, { embeds: [embed] });
}

async function commandLeave(context) {
  const state = queues.get(context.guild.id);
  const connection = getVoiceConnection(context.guild.id);

  if (!state && !connection) throw new UserError('JUANPLAY no esta en ningun canal de voz.');

  destroyQueue(context.guild.id, false);
  await safeReply(context, { embeds: [brandEmbed('👋 JUANPLAY salio', 'Me desconecte del canal de voz.')] });
}

async function commandPing(context) {
  await safeReply(context, {
    embeds: [brandEmbed('🏓 JUANPLAY ping', `Latencia: **${Math.round(client.ws.ping)}ms**`)]
  });
}

async function runCommand(context, commandName, args = []) {
  const command = commandName.toLowerCase();

  try {
    switch (command) {
      case 'help':
      case 'ayuda':
        return await commandHelp(context);
      case 'juanplay':
      case 'play': {
        const query = context.type === 'interaction'
          ? context.interaction.options.getString('busqueda', true)
          : args.join(' ');
        return await commandPlay(context, query);
      }
      case 'skip':
      case 'saltar':
        return await commandSkip(context);
      case 'stop':
      case 'parar':
        return await commandStop(context);
      case 'pause':
      case 'pausa':
        return await commandPause(context);
      case 'resume':
      case 'continuar':
        return await commandResume(context);
      case 'queue':
      case 'cola':
        return await commandQueue(context);
      case 'nowplaying':
      case 'np':
        return await commandNowPlaying(context);
      case 'leave':
      case 'salir':
        return await commandLeave(context);
      case 'ping':
        return await commandPing(context);
      default:
        throw new UserError(`Comando no reconocido. Usa \`/help\`.`);
    }
  } catch (error) {
    const message = error instanceof UserError
      ? error.message
      : 'Ocurrio un error interno. Revisa los logs de Railway.';

    if (!(error instanceof UserError)) console.error('[JUANPLAY] Error ejecutando comando:', error);
    await safeReply(context, { embeds: [errorEmbed(message)] }).catch(console.error);
  }
}

async function registerCommandsForGuild(guild) {
  await guild.commands.set(slashCommandData);
  console.log(`[JUANPLAY] Comandos slash registrados en: ${guild.name} (${guild.id})`);
}

async function registerSlashCommands() {
  if (config.guildId) {
    const guild = await client.guilds.fetch(config.guildId);
    await registerCommandsForGuild(guild);
    return;
  }

  const guilds = await client.guilds.fetch();
  for (const [, partialGuild] of guilds) {
    const guild = await partialGuild.fetch();
    await registerCommandsForGuild(guild);
  }
}

client.once('ready', async () => {
  console.log(`✅ JUANPLAY conectado como ${client.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${client.user.id}`);
  console.log('🎵 Usa /help o /juanplay en Discord.');

  client.user.setPresence({
    activities: [{ name: 'JUANPLAY /help', type: ActivityType.Listening }],
    status: 'online'
  });

  try {
    await registerSlashCommands();
    console.log('✅ Comandos slash listos. Si no aparecen, reinvita el bot con bot + applications.commands.');
  } catch (error) {
    console.error('[JUANPLAY] No pude registrar comandos slash:', error);
  }
});

client.on('guildCreate', async guild => {
  try {
    await registerCommandsForGuild(guild);
  } catch (error) {
    console.error('[JUANPLAY] No pude registrar comandos en nuevo servidor:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  await runCommand({
    type: 'interaction',
    interaction,
    guild: interaction.guild,
    member: interaction.member,
    user: interaction.user,
    channel: interaction.channel
  }, interaction.commandName);
});

if (config.enablePrefixCommands) {
  client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(config.prefix)) return;

    const withoutPrefix = message.content.slice(config.prefix.length).trim();
    if (!withoutPrefix) return;

    const [commandName, ...args] = withoutPrefix.split(/\s+/);

    await runCommand({
      type: 'message',
      message,
      guild: message.guild,
      member: message.member,
      user: message.author,
      channel: message.channel
    }, commandName, args);
  });
}

process.on('unhandledRejection', error => {
  console.error('[JUANPLAY] Promesa rechazada:', error);
});

process.on('uncaughtException', error => {
  console.error('[JUANPLAY] Error no capturado:', error);
});

client.login(config.token);
