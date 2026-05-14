import ffmpegPath from 'ffmpeg-static';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';
import ytpl from 'ytpl';
import {
  ActivityType,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} from '@discordjs/voice';
import { config, getYtdlRequestOptions, requireToken } from './config.js';
import { slashCommandData } from './commands.js';

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;
requireToken();

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates
];

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

function cleanTitle(title) {
  return title || 'Cancion sin titulo';
}

function bestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0]?.url ?? null;
}

function formatDuration(secondsOrString) {
  if (!secondsOrString) return 'Desconocida';
  if (typeof secondsOrString === 'string') return secondsOrString;

  const seconds = Number(secondsOrString);
  if (!Number.isFinite(seconds)) return 'Desconocida';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function isProbablyUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function ytdlOptions() {
  return {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    dlChunkSize: 0,
    ...getYtdlRequestOptions()
  };
}

function infoOptions() {
  return getYtdlRequestOptions();
}

function songFromYtdlDetails(details, requestedBy) {
  return {
    title: cleanTitle(details.title),
    url: details.video_url || details.videoUrl || details.url,
    duration: formatDuration(details.lengthSeconds ? Number(details.lengthSeconds) : details.durationRaw),
    thumbnail: bestThumbnail(details.thumbnails),
    requestedBy: requestedBy?.tag || requestedBy?.username || 'Usuario'
  };
}

function songFromSearchVideo(video, requestedBy) {
  return {
    title: cleanTitle(video.title),
    url: video.url,
    duration: video.timestamp || formatDuration(video.seconds),
    thumbnail: video.thumbnail || bestThumbnail(video.thumbnails),
    requestedBy: requestedBy?.tag || requestedBy?.username || 'Usuario'
  };
}

function songFromPlaylistItem(item, requestedBy) {
  return {
    title: cleanTitle(item.title),
    url: item.shortUrl || item.url,
    duration: item.duration || 'Desconocida',
    thumbnail: item.bestThumbnail?.url || item.thumbnail || null,
    requestedBy: requestedBy?.tag || requestedBy?.username || 'Usuario'
  };
}

async function resolveSongs(query, requestedBy) {
  const search = query.trim();
  if (!search) throw new UserError('Escribe el nombre o URL de una cancion.');

  // Playlist de YouTube.
  if (ytpl.validateID(search) && !ytdl.validateURL(search)) {
    try {
      const playlist = await ytpl(search, { limit: config.maxPlaylistSongs });
      const songs = playlist.items
        .filter(item => item?.url || item?.shortUrl)
        .map(item => songFromPlaylistItem(item, requestedBy));

      if (songs.length === 0) throw new UserError('No encontre canciones reproducibles en esa playlist.');
      return songs;
    } catch (error) {
      if (error instanceof UserError) throw error;
      console.error('[JUANPLAY] Error leyendo playlist:', error);
      throw new UserError('No pude leer esa playlist. Prueba con una cancion individual o con otro enlace.');
    }
  }

  // Video directo de YouTube.
  if (ytdl.validateURL(search)) {
    try {
      const info = await ytdl.getBasicInfo(search, infoOptions());
      return [songFromYtdlDetails(info.videoDetails, requestedBy)];
    } catch (error) {
      console.error('[JUANPLAY] Error leyendo enlace de YouTube:', error);
      throw new UserError('No pude leer ese enlace de YouTube. Prueba con otro link o con el nombre de la cancion.');
    }
  }

  if (isProbablyUrl(search)) {
    throw new UserError('Por ahora solo acepto enlaces de YouTube. Tambien puedes escribir el nombre de la cancion.');
  }

  // Busqueda por nombre.
  try {
    const results = await ytSearch(search);
    const video = results.videos.find(item => item?.url && !item.live) || results.videos.find(item => item?.url);

    if (!video) {
      throw new UserError('No encontre esa cancion. Prueba con otro nombre o con una URL de YouTube.');
    }

    return [songFromSearchVideo(video, requestedBy)];
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error('[JUANPLAY] Error buscando en YouTube:', error);
    throw new UserError('No pude buscar en YouTube ahora mismo. Prueba con un enlace directo de YouTube.');
  }
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
      leaveTimer: null,
      isConnecting: false
    };

    player.on(AudioPlayerStatus.Idle, () => {
      playNext(guild.id).catch(error => {
        console.error('[JUANPLAY] Error al reproducir la siguiente cancion:', error);
      });
    });

    player.on('error', error => {
      console.error('[JUANPLAY] Error del reproductor:', error);
      sendToTextChannel(state, '⚠️ Error reproduciendo la cancion. Saltando a la siguiente...').catch(() => {});
      state.current = null;
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
    state.isConnecting = false;
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

async function getGuildMember(context) {
  if (context.member?.voice) return context.member;
  try {
    return await context.guild.members.fetch(context.user.id);
  } catch {
    return context.member;
  }
}

function voiceConnectionErrorMessage(status) {
  return [
    'No pude conectarme al canal de voz.',
    `Estado de conexion: **${status || 'desconocido'}**.`,
    '',
    'Revisa esto:',
    '1. El bot debe tener **Ver canales**, **Conectarse** y **Hablar** en ese canal de voz.',
    '2. Usa un canal de voz normal, no Stage/escenario.',
    '3. Si estas en Railway y sigue igual, cambia la region del canal de voz a **Automatico** o prueba otro host que permita voz/UDP.'
  ].join('\n');
}

async function connectToUserVoice(context) {
  const member = await getGuildMember(context);
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    throw new UserError('Primero entra a un canal de voz y vuelve a usar el comando.');
  }

  if (voiceChannel.type === ChannelType.GuildStageVoice) {
    throw new UserError('Estoy detectando un canal Stage/escenario. Prueba en un canal de voz normal.');
  }

  const me = await voiceChannel.guild.members.fetchMe();
  const permissions = voiceChannel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    throw new UserError('No tengo permiso para ver tu canal de voz.');
  }

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
    selfDeaf: false,
    selfMute: false
  });

  state.connection = connection;
  state.isConnecting = true;

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

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, config.voiceTimeoutMs);
    connection.subscribe(state.player);
    state.isConnecting = false;
    return state;
  } catch (error) {
    const status = connection.state?.status;
    console.error('[JUANPLAY] No pude entrar a voz:', { status, error });
    try {
      connection.destroy();
    } catch {}
    state.connection = null;
    state.isConnecting = false;
    throw new UserError(voiceConnectionErrorMessage(status));
  }
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
    const stream = ytdl(next.url, ytdlOptions());

    stream.on('error', error => {
      console.error('[JUANPLAY] Error del stream de YouTube:', error);
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      metadata: next,
      inlineVolume: true
    });

    resource.volume?.setVolume(0.85);
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
    ? `\nTambien puedes usar: \`${config.prefix}play\`, \`${config.prefix}skip\`, \`${config.prefix}help\`.`
    : '';

  const embed = brandEmbed(
    '🎵 JUANPLAY comandos',
    [
      '`/juanplay busqueda` - reproduce por nombre o URL de YouTube.',
      '`/play busqueda` - igual que /juanplay.',
      '`/testvoz` - prueba conexion al canal de voz.',
      '`/skip` - salta la cancion actual.',
      '`/pause` - pausa.',
      '`/resume` - continua.',
      '`/queue` - mira la cola.',
      '`/nowplaying` - cancion actual.',
      '`/stop` - detiene todo y sale.',
      '`/leave` - sale del canal.',
      '`/ping` - prueba el bot.',
      prefixLine
    ].filter(Boolean).join('\n')
  );

  await safeReply(context, { embeds: [embed] });
}

async function commandPlay(context, query) {
  await safeDefer(context);

  const songs = await resolveSongs(query, context.user);
  const state = await connectToUserVoice(context);
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

async function commandTestVoice(context) {
  await safeDefer(context);
  const state = await connectToUserVoice(context);
  await safeReply(context, {
    embeds: [brandEmbed('✅ JUANPLAY voz lista', 'Me conecte bien al canal de voz. Ahora prueba `/juanplay nombre de cancion`.')]
  });
  scheduleLeave(context.guild.id);
  return state;
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
      case 'testvoz':
      case 'voice':
        return await commandTestVoice(context);
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
        throw new UserError('Comando no reconocido. Usa `/help`.');
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

client.once(Events.ClientReady, async readyClient => {
  console.log(`✅ JUANPLAY conectado como ${readyClient.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${readyClient.user.id}`);
  console.log('🎵 Usa /help, /testvoz o /juanplay en Discord.');

  readyClient.user.setPresence({
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

client.on(Events.GuildCreate, async guild => {
  try {
    await registerCommandsForGuild(guild);
  } catch (error) {
    console.error('[JUANPLAY] No pude registrar comandos en nuevo servidor:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
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
  client.on(Events.MessageCreate, async message => {
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
