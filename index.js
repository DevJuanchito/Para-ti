import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import ytSearch from 'yt-search';
import ffmpegStatic from 'ffmpeg-static';

const require = createRequire(import.meta.url);

const CONFIG = {
  token: process.env.DISCORD_TOKEN || process.env.TOKEN,
  guildId: process.env.GUILD_ID || '',
  color: parseColor(process.env.BOT_COLOR || '#ff2f7d'),
  emoji: process.env.DEFAULT_EMOJI || '🐵',
  developer: process.env.DEVELOPER_NAME || 'DEVJUANCHO',
  brand: process.env.BOT_BRAND || 'JUANPLAY',
  version: '10.0.0',
  defaultVolume: clamp(Number(process.env.DEFAULT_VOLUME || 85), 1, 150),
  voiceTimeoutMs: Number(process.env.VOICE_TIMEOUT_MS || 120000),
  selfDeaf: String(process.env.VOICE_SELF_DEAF || 'true').toLowerCase() !== 'false',
  maxPlaylistItems: Number(process.env.MAX_PLAYLIST_ITEMS || 25),
  maxQueueSize: Number(process.env.MAX_QUEUE_SIZE || 80),
  cooldownMs: Number(process.env.COMMAND_COOLDOWN_MS || 2500),
  privateResponses: String(process.env.PRIVATE_COMMAND_RESPONSES || 'true').toLowerCase() !== 'false',
  publicPanel: String(process.env.PUBLIC_NOWPLAYING_PANEL || 'true').toLowerCase() !== 'false',
  autoRecommend: String(process.env.AUTO_RECOMMEND_AFTER_END || 'true').toLowerCase() !== 'false',
  recommendationCount: clamp(Number(process.env.RECOMMENDATION_COUNT || 5), 1, 10),
  youtubeCookie: process.env.YOUTUBE_COOKIE || '',
  ffmpegPath: process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg',
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp'
};

if (!CONFIG.token) {
  throw new Error('Falta DISCORD_TOKEN en Railway. Agrega DISCORD_TOKEN=TU_TOKEN_DEL_BOT');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const guildStates = new Map();
const cooldowns = new Map();
const searchCache = new Map();
const pendingProcesses = new Set();

function parseColor(value) {
  const clean = String(value).replace('#', '').trim();
  const n = Number.parseInt(clean, 16);
  return Number.isFinite(n) ? n : 0xff2f7d;
}

function clamp(num, min, max) {
  if (Number.isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function cut(text, max = 100) {
  const str = String(text || '').replace(/\s+/g, ' ').trim();
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function safeUrl(url) {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function isUrl(input) {
  return /^https?:\/\//i.test(String(input || '').trim());
}

function isDirectAudioUrl(input) {
  return /^https?:\/\/.+\.(mp3|m4a|wav|ogg|opus|flac|webm)(\?.*)?$/i.test(String(input || '').trim());
}

function isSpotifyLike(url) {
  return /open\.spotify\.com|music\.apple\.com|deezer\.com/i.test(url);
}

function platformName(url) {
  if (/youtu\.?be|youtube\.com/i.test(url)) return 'YouTube';
  if (/soundcloud\.com/i.test(url)) return 'SoundCloud';
  if (/open\.spotify\.com/i.test(url)) return 'Spotify → YouTube';
  if (/music\.apple\.com/i.test(url)) return 'Apple Music → YouTube';
  if (/deezer\.com/i.test(url)) return 'Deezer → YouTube';
  if (isDirectAudioUrl(url)) return 'Audio directo';
  return isUrl(url) ? 'Plataforma compatible' : 'Búsqueda por nombre';
}

function baseEmbed(title, description = '') {
  return new EmbedBuilder()
    .setColor(CONFIG.color)
    .setTitle(`${CONFIG.emoji} ${title}`)
    .setDescription(description)
    .setFooter({ text: `${CONFIG.brand} v${CONFIG.version} • Desarrollador único: ${CONFIG.developer}` })
    .setTimestamp(new Date());
}

function progressBar() {
  return '▰▰▰▱▱▱▱▱▱▱';
}

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    const state = {
      guildId,
      player,
      connection: null,
      queue: [],
      history: [],
      current: null,
      volume: CONFIG.defaultVolume,
      textChannel: null,
      panelMessage: null,
      panelChannelId: null,
      cleanup: null,
      playingStartedAt: null,
      lastError: null
    };

    player.on(AudioPlayerStatus.Playing, () => {
      state.playingStartedAt = Date.now();
    });

    player.on(AudioPlayerStatus.Idle, () => {
      if (state.cleanup) {
        state.cleanup();
        state.cleanup = null;
      }
      if (state.current) {
        state.history.unshift({ ...state.current, endedAt: Date.now() });
        state.history = state.history.slice(0, 25);
      }
      state.current = null;
      playNext(state.guildId).catch((err) => {
        console.error('[JUANPLAY] Error avanzando la cola:', err);
        state.lastError = err?.message || String(err);
        updatePanel(state, 'error', state.lastError).catch(() => {});
      });
    });

    player.on('error', (error) => {
      console.error('[JUANPLAY] Error del reproductor:', error);
      state.lastError = error?.message || String(error);
      if (state.cleanup) {
        state.cleanup();
        state.cleanup = null;
      }
      updatePanel(state, 'error', state.lastError).catch(() => {});
      setTimeout(() => playNext(state.guildId).catch(() => {}), 1200);
    });

    guildStates.set(guildId, state);
  }
  return guildStates.get(guildId);
}

function setIdlePresence() {
  if (!client.user) return;
  client.user.setPresence({
    status: 'online',
    activities: [
      {
        type: ActivityType.Listening,
        name: `${CONFIG.brand} • /play • ${CONFIG.developer}`
      }
    ]
  }).catch?.(() => {});
}

function setPlayingPresence(track) {
  if (!client.user || !track) return;
  client.user.setPresence({
    status: 'online',
    activities: [
      {
        type: ActivityType.Listening,
        name: cut(track.title, 120)
      }
    ]
  }).catch?.(() => {});
}

function ytDlpBaseArgs() {
  const args = [
    '--no-warnings',
    '--no-check-certificates',
    '--prefer-free-formats',
    '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    '--add-header', 'referer:https://www.youtube.com/',
    '--add-header', 'accept-language:es-ES,es;q=0.9,en;q=0.8',
    '--retries', '8',
    '--fragment-retries', '8',
    '--extractor-retries', '4',
    '--socket-timeout', '25'
  ];
  if (CONFIG.youtubeCookie) {
    args.push('--add-header', `cookie:${CONFIG.youtubeCookie}`);
  }
  return args;
}

function runCommand(command, args, timeoutMs = 20000, maxOutput = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    pendingProcesses.add(child);
    let stdout = '';
    let stderr = '';
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutput) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutput) stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      pendingProcesses.delete(child);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      pendingProcesses.delete(child);
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${command} falló. code=${code} signal=${signal}${killedByTimeout ? ' timeout=true' : ''}\n${stderr || stdout}`));
    });
  });
}

async function ytdlpJson(input, extra = []) {
  const args = [
    ...ytDlpBaseArgs(),
    '--dump-single-json',
    '--skip-download',
    ...extra,
    input
  ];
  const { stdout } = await runCommand(CONFIG.ytdlpPath, args, 25000);
  return JSON.parse(stdout);
}

async function searchVideos(query, limit = 5) {
  const clean = String(query || '').trim();
  if (!clean) return [];
  try {
    const results = await Promise.race([
      ytSearch(clean),
      new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout')), 6500))
    ]);
    return (results?.videos || [])
      .filter((v) => v && v.url && v.title)
      .slice(0, limit)
      .map((v) => ({
        title: v.title,
        url: v.url,
        duration: v.timestamp || 'Desconocida',
        thumbnail: v.thumbnail,
        author: v.author?.name || v.author || 'YouTube',
        source: 'YouTube'
      }));
  } catch (err) {
    console.warn('[JUANPLAY] yt-search falló, usando yt-dlp:', err?.message || err);
    const data = await ytdlpJson(`ytsearch${limit}:${clean}`, ['--flat-playlist']);
    const entries = data?.entries || [];
    return entries.slice(0, limit).map((e) => ({
      title: e.title || 'Resultado de YouTube',
      url: e.url?.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.id || e.url}`,
      duration: e.duration_string || e.duration || 'Desconocida',
      thumbnail: e.thumbnail,
      author: e.uploader || e.channel || 'YouTube',
      source: 'YouTube'
    }));
  }
}

async function autocompleteVideos(query) {
  const clean = String(query || '').trim();
  if (clean.length < 2) return [];
  try {
    const results = await Promise.race([
      searchVideos(clean, 8),
      new Promise((resolve) => setTimeout(() => resolve([]), 2200))
    ]);
    return results.map((r) => ({
      name: cut(`🎵 ${r.title} • ${r.author}`, 100),
      value: cut(r.url || r.title, 100)
    }));
  } catch {
    return [];
  }
}

function createTrack(data, requester, originalQuery = '') {
  return {
    title: cut(data.title || originalQuery || 'Canción sin título', 180),
    url: data.url || data.webpage_url || originalQuery,
    webpageUrl: data.webpage_url || data.url || originalQuery,
    duration: data.duration || data.duration_string || data.timestamp || 'Desconocida',
    thumbnail: data.thumbnail || data.thumbnails?.at?.(-1)?.url || null,
    author: data.author || data.uploader || data.channel || 'Desconocido',
    source: data.source || platformName(data.url || originalQuery),
    requestedById: requester.id,
    requestedByTag: requester.tag || requester.username,
    requestedAt: Date.now(),
    originalQuery
  };
}

async function resolveInput(input, requester) {
  const query = String(input || '').trim();
  if (!query) throw new Error('Escribe el nombre o link de una canción.');

  if (isUrl(query)) {
    const url = safeUrl(query);
    if (!url) throw new Error('El link no parece válido.');

    if (/list=|\/playlist\?/i.test(url) && /youtube\.com|youtu\.be/i.test(url)) {
      const data = await ytdlpJson(url, ['--flat-playlist', '--playlist-end', String(CONFIG.maxPlaylistItems)]);
      const entries = (data.entries || []).slice(0, CONFIG.maxPlaylistItems);
      if (!entries.length) throw new Error('No encontré canciones en esa playlist.');
      const tracks = entries.map((entry) => createTrack({
        title: entry.title,
        url: entry.url?.startsWith('http') ? entry.url : `https://www.youtube.com/watch?v=${entry.id || entry.url}`,
        duration: entry.duration_string || entry.duration,
        thumbnail: entry.thumbnail,
        author: entry.uploader || entry.channel || 'YouTube',
        source: 'YouTube Playlist'
      }, requester, query));
      return tracks;
    }

    if (isSpotifyLike(url)) {
      let metadataText = url;
      try {
        const data = await ytdlpJson(url, ['--no-playlist']);
        metadataText = [data.title, data.artist || data.uploader || data.channel].filter(Boolean).join(' ');
      } catch {
        metadataText = decodeURIComponent(url).replace(/[/?=&._-]+/g, ' ');
      }
      const results = await searchVideos(metadataText, 1);
      if (!results.length) throw new Error('No encontré una versión reproducible para ese link.');
      return [createTrack({ ...results[0], source: platformName(url) }, requester, query)];
    }

    try {
      const data = isDirectAudioUrl(url)
        ? { title: url.split('/').pop()?.split('?')[0] || 'Audio directo', url, duration: 'Desconocida', source: 'Audio directo' }
        : await ytdlpJson(url, ['--no-playlist']);
      return [createTrack({
        title: data.title,
        url: data.webpage_url || data.original_url || url,
        duration: data.duration_string || secondsToTime(data.duration),
        thumbnail: data.thumbnail,
        author: data.uploader || data.channel || data.artist,
        source: platformName(url)
      }, requester, query)];
    } catch (err) {
      throw new Error(`No pude leer ese link. Prueba con el nombre de la canción. Detalle: ${cut(err.message, 180)}`);
    }
  }

  const results = await searchVideos(query, 1);
  if (!results.length) throw new Error('No encontré resultados con ese nombre.');
  return [createTrack(results[0], requester, query)];
}

function secondsToTime(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 'Desconocida';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function connectToVoice(interaction) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error('Primero entra a un canal de voz y vuelve a usar el comando.');
  }

  const me = interaction.guild.members.me;
  const perms = voiceChannel.permissionsFor(me);
  const missing = [];
  if (!perms?.has(PermissionFlagsBits.ViewChannel)) missing.push('Ver canal');
  if (!perms?.has(PermissionFlagsBits.Connect)) missing.push('Conectarse');
  if (!perms?.has(PermissionFlagsBits.Speak)) missing.push('Hablar');
  if (missing.length) {
    throw new Error(`Me faltan permisos en el canal de voz: ${missing.join(', ')}.`);
  }

  const state = getState(interaction.guildId);
  state.textChannel = interaction.channel;

  const old = getVoiceConnection(interaction.guildId);
  if (old && old.joinConfig.channelId !== voiceChannel.id) {
    old.destroy();
    state.connection = null;
  }

  if (!state.connection || state.connection.state.status === VoiceConnectionStatus.Destroyed) {
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: CONFIG.selfDeaf
    });

    state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(state.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(state.connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        try { state.connection.destroy(); } catch {}
        state.connection = null;
        setIdlePresence();
      }
    });
  }

  state.connection.subscribe(state.player);
  await entersState(state.connection, VoiceConnectionStatus.Ready, CONFIG.voiceTimeoutMs);
  return state;
}

function createAudioPipeline(track, state) {
  const children = [];
  let ytdlp = null;
  let ffmpeg = null;

  if (isDirectAudioUrl(track.url)) {
    ffmpeg = spawn(CONFIG.ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
      '-i', track.url,
      '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(ffmpeg);
  } else {
    ytdlp = spawn(CONFIG.ytdlpPath, [
      ...ytDlpBaseArgs(),
      '-f', 'bestaudio/best',
      '-o', '-',
      '--no-playlist',
      '--quiet',
      track.url
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffmpeg = spawn(CONFIG.ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    children.push(ytdlp, ffmpeg);
  }

  for (const child of children) {
    pendingProcesses.add(child);
    child.on('close', () => pendingProcesses.delete(child));
    child.on('error', (err) => {
      console.error('[JUANPLAY] Proceso de audio falló:', err?.message || err);
    });
    child.stderr?.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg && !/Broken pipe|Immediate exit requested/i.test(msg)) {
        console.warn('[JUANPLAY audio]', cut(msg, 500));
      }
    });
  }

  const resource = createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true,
    metadata: track
  });
  resource.volume?.setVolume(clamp(state.volume, 1, 150) / 100);

  const cleanup = () => {
    for (const child of children) {
      try {
        if (!child.killed) child.kill('SIGKILL');
      } catch {}
    }
  };

  return { resource, cleanup };
}

async function playNext(guildId) {
  const state = getState(guildId);
  if (!state.connection) {
    state.current = null;
    setIdlePresence();
    return;
  }

  if (!state.queue.length) {
    state.current = null;
    setIdlePresence();
    await updatePanel(state, 'ended');
    return;
  }

  const track = state.queue.shift();
  state.current = track;
  state.lastError = null;

  try {
    const { resource, cleanup } = createAudioPipeline(track, state);
    state.cleanup = cleanup;
    state.player.play(resource);
    setPlayingPresence(track);
    await updatePanel(state, 'playing');
  } catch (err) {
    state.lastError = err?.message || String(err);
    console.error('[JUANPLAY] No pude iniciar canción:', err);
    await updatePanel(state, 'error', state.lastError);
    setTimeout(() => playNext(guildId).catch(() => {}), 1000);
  }
}

function nowPlayingEmbed(state) {
  const t = state.current;
  if (!t) return baseEmbed('JUANPLAY está listo', 'Usa `/play` o `/juanplay` para poner música.');
  const embed = baseEmbed('JUANPLAY está sonando',
    `### [${cut(t.title, 90)}](${t.webpageUrl || t.url})\n` +
    `**Pedido por:** <@${t.requestedById}>\n` +
    `**Canal / fuente:** ${t.source}\n` +
    `**Duración:** ${t.duration || 'Desconocida'}\n` +
    `**Volumen:** ${state.volume}%\n` +
    `**Cola:** ${state.queue.length} canción(es)\n\n` +
    `${progressBar()}\n` +
    `**Desarrollador:** ${CONFIG.developer}`
  );
  if (t.thumbnail) embed.setThumbnail(t.thumbnail);
  return embed;
}

function playerButtons(state, ended = false) {
  const playing = state.player.state.status === AudioPlayerStatus.Playing;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(playing ? 'jp:pause' : 'jp:resume')
      .setLabel(playing ? 'Pausar' : 'Seguir')
      .setEmoji(playing ? '⏸️' : '▶️')
      .setStyle(playing ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId('jp:skip')
      .setLabel('Saltar')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId('jp:stop')
      .setLabel('Stop')
      .setEmoji('🛑')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId('jp:queue')
      .setLabel('Cola privada')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('jp:similar')
      .setLabel('Recomendados')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success)
  );
  return [row1];
}

async function updatePanel(state, mode = 'playing', detail = '') {
  if (!CONFIG.publicPanel || !state.textChannel) return;

  let embed;
  let components = playerButtons(state, mode === 'ended');

  if (mode === 'playing') {
    embed = nowPlayingEmbed(state);
  } else if (mode === 'ended') {
    if (state.queue.length || state.current) return;
    embed = baseEmbed('La música terminó',
      `No mandaré recomendaciones públicas para no spamear.\n` +
      `Pulsa **Recomendados** y solo tú verás sugerencias privadas.\n\n` +
      `**Última canción:** ${state.history[0] ? `[${cut(state.history[0].title, 80)}](${state.history[0].webpageUrl || state.history[0].url})` : 'Ninguna'}\n` +
      `**Desarrollador:** ${CONFIG.developer}`
    );
    if (state.history[0]?.thumbnail) embed.setThumbnail(state.history[0].thumbnail);
  } else if (mode === 'error') {
    embed = baseEmbed('JUANPLAY tuvo un problema de audio',
      `Voy a intentar seguir con la siguiente canción.\n\n` +
      `**Detalle corto:** ${cut(detail || 'Error desconocido', 250)}\n` +
      `**Tip:** Usa /diagnostico para revisar FFmpeg, yt-dlp y Opus.`
    );
  } else {
    embed = baseEmbed('JUANPLAY', 'Panel actualizado.');
  }

  try {
    if (state.panelMessage) {
      await state.panelMessage.edit({ embeds: [embed], components });
      return;
    }
    const msg = await state.textChannel.send({ embeds: [embed], components });
    state.panelMessage = msg;
    state.panelChannelId = state.textChannel.id;
  } catch (err) {
    console.warn('[JUANPLAY] No pude actualizar panel:', err?.message || err);
    state.panelMessage = null;
  }
}

function queueEmbed(state, user) {
  if (!state.current && !state.queue.length) {
    return baseEmbed('Cola de JUANPLAY', `No hay música en cola.\nSolicitado por: <@${user.id}>`);
  }
  const lines = [];
  if (state.current) lines.push(`**Sonando:** [${cut(state.current.title, 70)}](${state.current.webpageUrl || state.current.url}) • <@${state.current.requestedById}>`);
  if (state.queue.length) {
    lines.push('', '**Siguientes:**');
    state.queue.slice(0, 10).forEach((t, i) => lines.push(`[0m${i + 1}. [${cut(t.title, 65)}](${t.webpageUrl || t.url}) • <@${t.requestedById}>`));
    if (state.queue.length > 10) lines.push(`…y ${state.queue.length - 10} más.`);
  }
  lines.push('', `**Solicitado por:** <@${user.id}>`);
  return baseEmbed('Cola privada de JUANPLAY', lines.join('\n'));
}

async function sendPrivate(interaction, payload) {
  const data = { ...payload, ephemeral: true };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => interaction.followUp(data));
  return interaction.reply(data);
}

function isCooldown(interaction) {
  const key = `${interaction.user.id}:${interaction.commandName || interaction.customId}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < CONFIG.cooldownMs) return Math.ceil((CONFIG.cooldownMs - (now - last)) / 1000);
  cooldowns.set(key, now);
  return 0;
}

async function handlePlay(interaction, input) {
  const wait = isCooldown(interaction);
  if (wait) {
    return interaction.reply({ content: `⏳ Espera ${wait}s antes de usar otra vez el comando.`, ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: CONFIG.privateResponses });

  let state;
  try {
    state = await connectToVoice(interaction);
  } catch (err) {
    return interaction.editReply({ embeds: [baseEmbed('No pude entrar al canal de voz', err.message)] });
  }

  if (state.queue.length >= CONFIG.maxQueueSize) {
    return interaction.editReply({ embeds: [baseEmbed('Cola llena', `La cola tiene el límite de ${CONFIG.maxQueueSize} canciones.`)] });
  }

  try {
    const tracks = await resolveInput(input, interaction.user);
    const available = Math.max(0, CONFIG.maxQueueSize - state.queue.length);
    const accepted = tracks.slice(0, available);
    state.queue.push(...accepted);

    const shouldStart = !state.current && state.player.state.status !== AudioPlayerStatus.Playing;
    if (shouldStart) await playNext(interaction.guildId);

    const embed = baseEmbed('Agregado a JUANPLAY',
      accepted.length === 1
        ? `**Canción:** [${cut(accepted[0].title, 80)}](${accepted[0].webpageUrl || accepted[0].url})\n**La pidió:** <@${interaction.user.id}>\n**Posición en cola:** ${shouldStart ? 'Sonando ahora' : state.queue.length}`
        : `Agregué **${accepted.length}** canciones a la cola.\n**Pedido por:** <@${interaction.user.id}>`
    );
    if (accepted[0]?.thumbnail) embed.setThumbnail(accepted[0].thumbnail);
    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[JUANPLAY] Error en /play:', err);
    return interaction.editReply({ embeds: [baseEmbed('No pude reproducir eso', cut(err.message || String(err), 500))] });
  }
}

function cacheResults(results, requesterId) {
  const key = crypto.randomBytes(5).toString('hex');
  searchCache.set(key, { results, requesterId, createdAt: Date.now() });
  setTimeout(() => searchCache.delete(key), 15 * 60 * 1000).unref?.();
  return key;
}

function resultsButtons(key, results) {
  const rows = [];
  let row = new ActionRowBuilder();
  results.slice(0, 5).forEach((_, i) => {
    if (row.components.length === 5) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    row.addComponents(new ButtonBuilder()
      .setCustomId(`jp:add:${key}:${i}`)
      .setLabel(`Poner #${i + 1}`)
      .setEmoji('🎵')
      .setStyle(ButtonStyle.Success));
  });
  if (row.components.length) rows.push(row);
  return rows;
}

async function handleSearch(interaction, query, title = 'Resultados privados') {
  await interaction.deferReply({ ephemeral: true });
  const results = await searchVideos(query, 5);
  if (!results.length) {
    return interaction.editReply({ embeds: [baseEmbed('Sin resultados', 'No encontré canciones con ese texto.')] });
  }
  const key = cacheResults(results, interaction.user.id);
  const desc = results.map((r, i) => `**${i + 1}.** [${cut(r.title, 75)}](${r.url})\n${r.author || 'YouTube'} • ${r.duration || 'Desconocida'}`).join('\n\n');
  return interaction.editReply({ embeds: [baseEmbed(title, `${desc}\n\nSolo tú ves estos botones.`)], components: resultsButtons(key, results) });
}

async function recommendationResults(state, query = '') {
  let base = query?.trim();
  if (!base && state.current) base = `${state.current.title} ${state.current.author || ''}`;
  if (!base && state.history[0]) base = `${state.history[0].title} ${state.history[0].author || ''}`;
  if (!base) base = 'música latina popular 2026';
  const cleaned = base.replace(/\(official.*?\)|\[official.*?\]|video oficial|official video|lyrics|letra/ig, '').trim();
  return searchVideos(`${cleaned} canciones similares`, CONFIG.recommendationCount);
}

async function handleRecommendations(interaction, query = '') {
  await interaction.deferReply({ ephemeral: true });
  const state = getState(interaction.guildId);
  const results = await recommendationResults(state, query);
  if (!results.length) return interaction.editReply({ embeds: [baseEmbed('Sin recomendados', 'No encontré recomendados ahora mismo.')] });
  const key = cacheResults(results, interaction.user.id);
  const desc = results.map((r, i) => `**${i + 1}.** [${cut(r.title, 75)}](${r.url})\n${r.author || 'YouTube'} • ${r.duration || 'Desconocida'}`).join('\n\n');
  return interaction.editReply({ embeds: [baseEmbed('Recomendados para ti', `${desc}\n\nEstos recomendados solo los ves tú.`)], components: resultsButtons(key, results) });
}

async function handleAddButton(interaction, key, index) {
  const entry = searchCache.get(key);
  if (!entry) return interaction.reply({ content: '⏳ Esa búsqueda ya expiró. Usa /buscar otra vez.', ephemeral: true });
  if (entry.requesterId !== interaction.user.id) {
    return interaction.reply({ content: '🔒 Estos botones son privados de otra persona. Usa /buscar o /recomendados para crear los tuyos.', ephemeral: true });
  }
  const result = entry.results[Number(index)];
  if (!result) return interaction.reply({ content: 'No encontré ese resultado.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  let state;
  try {
    state = await connectToVoice(interaction);
    const track = createTrack(result, interaction.user, result.title);
    state.queue.push(track);
    const shouldStart = !state.current && state.player.state.status !== AudioPlayerStatus.Playing;
    if (shouldStart) await playNext(interaction.guildId);
    return interaction.editReply({ embeds: [baseEmbed('Agregado desde botones', `**${cut(track.title, 90)}**\nPedido por <@${interaction.user.id}>\n${shouldStart ? 'Sonando ahora.' : `Cola: ${state.queue.length}`}`)] });
  } catch (err) {
    return interaction.editReply({ embeds: [baseEmbed('No pude agregarlo', cut(err.message || String(err), 500))] });
  }
}

function sameVoice(interaction, state) {
  const userChannel = interaction.member?.voice?.channelId;
  const botChannel = state.connection?.joinConfig?.channelId;
  return userChannel && botChannel && userChannel === botChannel;
}

async function handleButton(interaction) {
  const [prefix, action, key, index] = interaction.customId.split(':');
  if (prefix !== 'jp') return;
  if (action === 'add') return handleAddButton(interaction, key, index);

  const state = getState(interaction.guildId);
  if (['pause', 'resume', 'skip', 'stop'].includes(action) && !sameVoice(interaction, state)) {
    return interaction.reply({ content: 'Entra al mismo canal de voz del bot para usar esos controles.', ephemeral: true });
  }

  if (action === 'pause') {
    state.player.pause();
    await updatePanel(state, 'playing');
    return interaction.reply({ content: '⏸️ Pausado.', ephemeral: true });
  }
  if (action === 'resume') {
    state.player.unpause();
    await updatePanel(state, 'playing');
    return interaction.reply({ content: '▶️ Siguiendo.', ephemeral: true });
  }
  if (action === 'skip') {
    state.player.stop(true);
    return interaction.reply({ content: '⏭️ Saltando canción.', ephemeral: true });
  }
  if (action === 'stop') {
    state.queue = [];
    state.player.stop(true);
    if (state.connection) {
      try { state.connection.destroy(); } catch {}
      state.connection = null;
    }
    state.current = null;
    setIdlePresence();
    await updatePanel(state, 'ended');
    return interaction.reply({ content: '🛑 Música detenida y cola limpiada.', ephemeral: true });
  }
  if (action === 'queue') {
    return interaction.reply({ embeds: [queueEmbed(state, interaction.user)], ephemeral: true });
  }
  if (action === 'similar') {
    return handleRecommendations(interaction, '');
  }
}

async function diagnosticsEmbed(interaction) {
  const lines = [];
  lines.push(`**Bot:** ${client.user?.tag || 'No conectado'}`);
  lines.push(`**Servidor:** ${interaction.guild?.name || interaction.guildId}`);
  lines.push(`**Node:** ${process.version}`);
  lines.push(`**FFmpeg:** ${CONFIG.ffmpegPath}`);
  lines.push(`**yt-dlp:** ${CONFIG.ytdlpPath}`);
  lines.push(`**Cookie YouTube:** ${CONFIG.youtubeCookie ? 'Configurada' : 'No configurada (puede funcionar sin ella)'}`);
  try {
    require.resolve('opusscript');
    lines.push('**Opus:** OK (`opusscript`)');
  } catch {
    lines.push('**Opus:** ❌ Falta `opusscript`');
  }
  try {
    const r = await runCommand(CONFIG.ytdlpPath, ['--version'], 10000, 10000);
    lines.push(`**yt-dlp versión:** ${cut(r.stdout.trim(), 60)}`);
  } catch (err) {
    lines.push(`**yt-dlp prueba:** ❌ ${cut(err.message, 120)}`);
  }
  try {
    const r = await runCommand(CONFIG.ffmpegPath, ['-version'], 10000, 10000);
    lines.push(`**FFmpeg versión:** ${cut(r.stdout.split('\n')[0], 100)}`);
  } catch (err) {
    lines.push(`**FFmpeg prueba:** ❌ ${cut(err.message, 120)}`);
  }
  const state = getState(interaction.guildId);
  lines.push(`**Conexión voz:** ${state.connection?.state?.status || 'sin conexión'}`);
  lines.push(`**Player:** ${state.player?.state?.status || 'desconocido'}`);
  lines.push(`**Cola:** ${state.queue.length}`);
  if (state.lastError) lines.push(`**Último error:** ${cut(state.lastError, 200)}`);
  return baseEmbed('Diagnóstico JUANPLAY', lines.join('\n'));
}

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Pon música por nombre o link.')
    .addStringOption((o) => o.setName('cancion').setDescription('Nombre, link de YouTube, SoundCloud, Spotify, Apple, Deezer o audio directo.').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('juanplay')
    .setDescription('Comando personalizado de JUANPLAY para poner música.')
    .addStringOption((o) => o.setName('cancion').setDescription('Nombre o link de la canción.').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('buscar')
    .setDescription('Busca canciones y muestra botones privados para elegir.')
    .addStringOption((o) => o.setName('texto').setDescription('Texto a buscar.').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('recomendados')
    .setDescription('Muestra recomendaciones privadas sin spamear el canal.')
    .addStringOption((o) => o.setName('base').setDescription('Canción/artista base opcional.').setRequired(false).setAutocomplete(true)),
  new SlashCommandBuilder().setName('similares').setDescription('Recomendaciones privadas basadas en lo que está sonando o el historial.'),
  new SlashCommandBuilder().setName('queue').setDescription('Muestra la cola en privado.'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Muestra lo que suena ahora en privado.'),
  new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual.'),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la música y limpia la cola.'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa la música.'),
  new SlashCommandBuilder().setName('resume').setDescription('Continúa la música.'),
  new SlashCommandBuilder().setName('leave').setDescription('Saca el bot del canal de voz.'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Cambia el volumen del bot.')
    .addIntegerOption((o) => o.setName('nivel').setDescription('Volumen de 1 a 150.').setRequired(true).setMinValue(1).setMaxValue(150)),
  new SlashCommandBuilder().setName('testvoz').setDescription('Prueba que el bot pueda entrar al canal de voz.'),
  new SlashCommandBuilder().setName('diagnostico').setDescription('Revisa FFmpeg, yt-dlp, Opus, conexión y estado.'),
  new SlashCommandBuilder().setName('perfil').setDescription('Texto recomendado para el perfil/descripción del bot.'),
  new SlashCommandBuilder().setName('creditos').setDescription('Créditos oficiales de JUANPLAY.'),
  new SlashCommandBuilder().setName('help').setDescription('Ayuda de JUANPLAY.'),
  new SlashCommandBuilder().setName('ping').setDescription('Prueba rápida del bot.')
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.token);
  const body = commands.map((cmd) => cmd.toJSON());
  if (CONFIG.guildId) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.guildId), { body });
    console.log(`[JUANPLAY] Comandos registrados en servidor ${CONFIG.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    console.log('[JUANPLAY] Comandos globales registrados. Pueden tardar en aparecer.');
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ ${CONFIG.brand} conectado como ${client.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${client.user.id}`);
  console.log(`🎧 Desarrollador: ${CONFIG.developer}`);
  setIdlePresence();
  try {
    await registerCommands();
    console.log('✅ Comandos slash listos.');
  } catch (err) {
    console.error('[JUANPLAY] Error registrando comandos:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      const choices = await autocompleteVideos(focused.value);
      return interaction.respond(choices.slice(0, 10)).catch(() => {});
    }

    if (interaction.isButton()) return handleButton(interaction);

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (commandName === 'play' || commandName === 'juanplay') {
      return handlePlay(interaction, interaction.options.getString('cancion', true));
    }
    if (commandName === 'buscar') {
      return handleSearch(interaction, interaction.options.getString('texto', true), 'Busca y elige en privado');
    }
    if (commandName === 'recomendados' || commandName === 'similares') {
      return handleRecommendations(interaction, interaction.options.getString?.('base') || '');
    }
    if (commandName === 'queue') {
      const state = getState(interaction.guildId);
      return interaction.reply({ embeds: [queueEmbed(state, interaction.user)], ephemeral: true });
    }
    if (commandName === 'nowplaying') {
      const state = getState(interaction.guildId);
      return interaction.reply({ embeds: [nowPlayingEmbed(state)], ephemeral: true });
    }
    if (commandName === 'pause') {
      const state = getState(interaction.guildId);
      state.player.pause();
      await updatePanel(state, 'playing');
      return interaction.reply({ content: '⏸️ Pausado.', ephemeral: true });
    }
    if (commandName === 'resume') {
      const state = getState(interaction.guildId);
      state.player.unpause();
      await updatePanel(state, 'playing');
      return interaction.reply({ content: '▶️ Siguiendo.', ephemeral: true });
    }
    if (commandName === 'skip') {
      const state = getState(interaction.guildId);
      state.player.stop(true);
      return interaction.reply({ content: '⏭️ Saltando.', ephemeral: true });
    }
    if (commandName === 'stop') {
      const state = getState(interaction.guildId);
      state.queue = [];
      state.player.stop(true);
      if (state.connection) {
        try { state.connection.destroy(); } catch {}
        state.connection = null;
      }
      state.current = null;
      setIdlePresence();
      await updatePanel(state, 'ended');
      return interaction.reply({ content: '🛑 Música detenida y cola limpiada.', ephemeral: true });
    }
    if (commandName === 'leave') {
      const state = getState(interaction.guildId);
      state.queue = [];
      state.player.stop(true);
      if (state.connection) {
        try { state.connection.destroy(); } catch {}
        state.connection = null;
      }
      state.current = null;
      setIdlePresence();
      return interaction.reply({ content: '👋 Salí del canal de voz.', ephemeral: true });
    }
    if (commandName === 'volume') {
      const state = getState(interaction.guildId);
      const level = interaction.options.getInteger('nivel', true);
      state.volume = clamp(level, 1, 150);
      const resource = state.player.state.resource;
      resource?.volume?.setVolume(state.volume / 100);
      await updatePanel(state, 'playing');
      return interaction.reply({ content: `🔊 Volumen cambiado a ${state.volume}%.`, ephemeral: true });
    }
    if (commandName === 'testvoz') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const state = await connectToVoice(interaction);
        return interaction.editReply({ embeds: [baseEmbed('Prueba de voz correcta', `Entré al canal de voz y quedé en estado: **${state.connection.state.status}**.\nAhora prueba /play.`)] });
      } catch (err) {
        return interaction.editReply({ embeds: [baseEmbed('Falló la prueba de voz', cut(err.message || String(err), 500))] });
      }
    }
    if (commandName === 'diagnostico') {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({ embeds: [await diagnosticsEmbed(interaction)] });
    }
    if (commandName === 'perfil') {
      const desc = `**Nombre recomendado:** ${CONFIG.brand}\n\n` +
        `**Descripción / About Me:**\n` +
        `🎵 ${CONFIG.brand} — música con comandos slash, búsqueda, cola, recomendados privados y panel limpio para servidores públicos.\n` +
        `Desarrollador único: ${CONFIG.developer}.\n\n` +
        `La descripción real del perfil se cambia en Discord Developer Portal → General Information / Bot. La actividad sí la cambia el código automáticamente con la canción actual.`;
      return interaction.reply({ embeds: [baseEmbed('Perfil oficial de JUANPLAY', desc)], ephemeral: true });
    }
    if (commandName === 'creditos') {
      return interaction.reply({ embeds: [baseEmbed('Créditos oficiales', `**${CONFIG.brand}**\nDesarrollador único: **${CONFIG.developer}**\nSistema de música, recomendaciones privadas, panel público limpio y actividad dinámica.`)], ephemeral: true });
    }
    if (commandName === 'help') {
      const desc = `**Música**\n` +
        '`/play` o `/juanplay` nombre/link\n' +
        '`/buscar` resultados con botones privados\n' +
        '`/recomendados` y `/similares` solo para ti\n\n' +
        `**Control**\n` +
        '`/pause`, `/resume`, `/skip`, `/stop`, `/leave`, `/volume`\n\n' +
        `**Info**\n` +
        '`/queue`, `/nowplaying`, `/diagnostico`, `/perfil`, `/creditos`\n\n' +
        `Panel público sin spam + respuestas privadas. Desarrollador: **${CONFIG.developer}**.`;
      return interaction.reply({ embeds: [baseEmbed('Ayuda de JUANPLAY', desc)], ephemeral: true });
    }
    if (commandName === 'ping') {
      return interaction.reply({ content: `🏓 Pong • ${client.ws.ping}ms • ${CONFIG.brand} by ${CONFIG.developer}`, ephemeral: true });
    }
  } catch (err) {
    console.error('[JUANPLAY] Error ejecutando interacción:', err);
    const payload = { embeds: [baseEmbed('Error inesperado', cut(err.message || String(err), 500))], ephemeral: true };
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('[JUANPLAY] Unhandled rejection:', err);
});

process.on('SIGTERM', () => {
  for (const child of pendingProcesses) {
    try { child.kill('SIGKILL'); } catch {}
  }
  client.destroy();
  process.exit(0);
});

client.login(CONFIG.token);
