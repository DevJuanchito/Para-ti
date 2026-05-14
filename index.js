/*
  JUANPLAY - Bot de música para Discord
  Desarrollador/créditos únicos: DEVJUANCHO
  Railway-ready · Node.js · discord.js v14 · @discordjs/voice · yt-dlp · ffmpeg
*/

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} = require('@discordjs/voice');

const BOT_VERSION = '1.0.1-railway-fix-interacciones';
const COLORS = {
  ok: 0x57f287,
  warn: 0xffcc4d,
  error: 0xed4245,
};

const env = (key, fallback = '') => (process.env[key] ?? fallback).toString().trim();
const boolEnv = (key, fallback = false) => {
  const raw = env(key, String(fallback)).toLowerCase();
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(raw);
};
const intEnv = (key, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const value = Number.parseInt(env(key, String(fallback)), 10);
  if (Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};
const colorEnv = (key, fallback = '#ff2f7d') => {
  const raw = env(key, fallback).replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return Number.parseInt(raw, 16);
  return Number.parseInt(fallback.replace('#', ''), 16);
};

const CONFIG = {
  DISCORD_TOKEN: env('DISCORD_TOKEN'),
  GUILD_ID: env('GUILD_ID'),
  VOICE_TIMEOUT_MS: intEnv('VOICE_TIMEOUT_MS', 120000, 10000, 60 * 60 * 1000),
  VOICE_SELF_DEAF: boolEnv('VOICE_SELF_DEAF', true),
  DEFAULT_VOLUME: intEnv('DEFAULT_VOLUME', 85, 0, 150),
  MAX_PLAYLIST_ITEMS: intEnv('MAX_PLAYLIST_ITEMS', 25, 1, 100),
  MAX_QUEUE_SIZE: intEnv('MAX_QUEUE_SIZE', 80, 1, 300),
  COMMAND_COOLDOWN_MS: intEnv('COMMAND_COOLDOWN_MS', 2500, 0, 60000),
  PRIVATE_COMMAND_RESPONSES: boolEnv('PRIVATE_COMMAND_RESPONSES', true),
  PUBLIC_NOWPLAYING_PANEL: boolEnv('PUBLIC_NOWPLAYING_PANEL', true),
  AUTO_RECOMMEND_AFTER_END: boolEnv('AUTO_RECOMMEND_AFTER_END', true),
  END_RECOMMENDATIONS_MODE: env('END_RECOMMENDATIONS_MODE', 'button').toLowerCase(),
  RECOMMENDATION_COUNT: intEnv('RECOMMENDATION_COUNT', 5, 1, 10),
  BOT_COLOR: colorEnv('BOT_COLOR', '#ff2f7d'),
  DEFAULT_EMOJI: env('DEFAULT_EMOJI', '🐵') || '🐵',
  DEVELOPER_NAME: env('DEVELOPER_NAME', 'DEVJUANCHO') || 'DEVJUANCHO',
  BOT_BRAND: env('BOT_BRAND', 'JUANPLAY') || 'JUANPLAY',
  YTDLP_BIN: env('YTDLP_BIN', 'yt-dlp') || 'yt-dlp',
  FFMPEG_BIN: env('FFMPEG_BIN', 'ffmpeg') || 'ffmpeg',
  YOUTUBE_COOKIE: process.env.YOUTUBE_COOKIE || '',
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const guildStates = new Map();
const cooldowns = new Map();
const buttonSessions = new Map();
let commandsRegistered = false;
let cookieFilePath = null;

function brandLine() {
  return `${CONFIG.DEFAULT_EMOJI} ${CONFIG.BOT_BRAND} · ${CONFIG.DEVELOPER_NAME}`;
}

function makeEmbed(title, description, color = CONFIG.BOT_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `${CONFIG.BOT_BRAND} · Créditos ${CONFIG.DEVELOPER_NAME} · v${BOT_VERSION}` })
    .setTimestamp();
}

function formatDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 'Desconocida';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function trimText(text, max = 90) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function safeUrl(text) {
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function platformFromUrl(input = '') {
  const s = input.toLowerCase();
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'YouTube';
  if (s.includes('soundcloud.com')) return 'SoundCloud';
  if (s.includes('spotify.com')) return 'Spotify';
  if (s.includes('music.apple.com')) return 'Apple Music';
  if (s.includes('deezer.com')) return 'Deezer';
  return safeUrl(input) ? 'Link' : 'YouTube Search';
}

function isExternalMusicLink(input = '') {
  const platform = platformFromUrl(input);
  return ['Spotify', 'Apple Music', 'Deezer'].includes(platform);
}

function ytdlpBaseArgs() {
  const args = ['--no-warnings', '--ignore-config'];
  if (CONFIG.YOUTUBE_COOKIE) {
    const file = ensureCookieFile();
    if (file) args.push('--cookies', file);
  }
  return args;
}

function ensureCookieFile() {
  if (!CONFIG.YOUTUBE_COOKIE) return null;
  if (cookieFilePath && fs.existsSync(cookieFilePath)) return cookieFilePath;
  cookieFilePath = path.join(os.tmpdir(), 'juanplay_youtube_cookies.txt');
  const value = CONFIG.YOUTUBE_COOKIE.replace(/\\n/g, '\n');
  fs.writeFileSync(cookieFilePath, value, 'utf8');
  return cookieFilePath;
}

function classifyYtdlpError(stderr = '') {
  const text = String(stderr || '');
  if (/429|too many requests|temporarily blocked|blocked/i.test(text)) {
    return 'YouTube bloqueó temporalmente la IP del hosting (error 429). El bot funciona sin cookies por defecto; si el bloqueo continúa, agrega una variable opcional YOUTUBE_COOKIE con cookies válidas en formato Netscape.';
  }
  if (/sign in to confirm|bot|captcha/i.test(text)) {
    return 'YouTube pidió verificación anti-bot para esta IP. Prueba de nuevo más tarde o usa la variable opcional YOUTUBE_COOKIE si tu hosting está bloqueado.';
  }
  return trimText(text, 350) || 'yt-dlp no pudo obtener información de esa canción.';
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxBuffer = options.maxBuffer ?? 4 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env,
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${command} tardó demasiado en responder.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > maxBuffer) stdout = stdout.slice(-maxBuffer);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > maxBuffer) stderr = stderr.slice(-maxBuffer);
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr });
      const err = new Error(classifyYtdlpError(stderr));
      err.stderr = stderr;
      err.code = code;
      reject(err);
    });
  });
}

async function ytdlpJson(target, options = {}) {
  const args = [
    ...ytdlpBaseArgs(),
    '--dump-single-json',
    '--skip-download',
    target,
  ];
  if (options.noPlaylist !== false) args.splice(args.length - 1, 0, '--no-playlist');
  if (options.flat) args.splice(args.length - 1, 0, '--flat-playlist');
  const { stdout } = await runProcess(CONFIG.YTDLP_BIN, args, { timeoutMs: options.timeoutMs ?? 25000 });
  return JSON.parse(stdout);
}

async function ytdlpPlaylistJson(target, limit) {
  const args = [
    ...ytdlpBaseArgs(),
    '--dump-single-json',
    '--flat-playlist',
    '--skip-download',
    '--playlist-end',
    String(limit),
    target,
  ];
  const { stdout } = await runProcess(CONFIG.YTDLP_BIN, args, { timeoutMs: 30000, maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function youtubeSearch(query, count = 1) {
  const target = `ytsearch${count}:${query}`;
  const data = await ytdlpJson(target, { flat: true, noPlaylist: false, timeoutMs: 22000 });
  const entries = Array.isArray(data.entries) ? data.entries : [];
  return entries.slice(0, count).map((entry) => normalizeTrack(entry, 'YouTube', query)).filter(Boolean);
}

async function autocompleteSearch(query) {
  // IMPORTANTE: el autocomplete de Discord debe responder en menos de 3 segundos.
  // No usamos yt-dlp aquí para evitar que el comando se quede "pensando" cuando Railway/YouTube tarda.
  const base = String(query || '').replace(/\s+/g, ' ').trim();
  if (base.length < 2) return [];

  const suggestions = [
    base,
    `${base} official video`,
    `${base} official audio`,
    `${base} lyrics`,
    `${base} remix`,
    `${base} live`,
    `${base} slowed`,
    `${base} instrumental`,
  ];

  const seen = new Set();
  return suggestions
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 25)
    .map((item) => ({
      name: trimText(`🔎 ${item}`, 90),
      value: item.slice(0, 100),
    }));
}

function normalizeUrl(entry) {
  const raw = entry?.webpage_url || entry?.original_url || entry?.url || '';
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return `https://www.youtube.com/watch?v=${raw}`;
  if (String(raw).startsWith('http')) return raw;
  if (entry?.ie_key === 'Youtube' || entry?.extractor_key === 'Youtube') return `https://www.youtube.com/watch?v=${raw}`;
  return raw;
}

function normalizeTrack(entry, fallbackPlatform = 'YouTube', sourceQuery = '') {
  if (!entry) return null;
  const url = normalizeUrl(entry);
  const title = entry.title || entry.fulltitle || sourceQuery || 'Canción sin título';
  if (!url && !title) return null;
  let platform = fallbackPlatform;
  if (entry.extractor_key) platform = entry.extractor_key.replace(/_/g, ' ');
  if (url) platform = platformFromUrl(url) === 'Link' ? platform : platformFromUrl(url);
  return {
    title: trimText(title, 160),
    url,
    duration: entry.duration || entry.duration_string || 0,
    platform,
    thumbnail: entry.thumbnail || (Array.isArray(entry.thumbnails) && entry.thumbnails.at(-1)?.url) || null,
    uploader: entry.uploader || entry.channel || entry.artist || '',
    sourceQuery,
  };
}

async function resolveExternalMusicLink(input) {
  // Spotify, Apple Music y Deezer se tratan como búsqueda por título cuando yt-dlp logra leer metadatos.
  // Si el hosting o la plataforma no entrega título, se avisa de forma privada al usuario.
  const platform = platformFromUrl(input);
  try {
    const info = await ytdlpJson(input, { timeoutMs: 25000 });
    const titleParts = [info.artist, info.creator, info.uploader, info.title].filter(Boolean);
    const title = titleParts.length > 1 ? `${titleParts[0]} ${info.title}` : info.title;
    if (title && !/^spotify|apple music|deezer$/i.test(title.trim())) {
      const found = await youtubeSearch(title, 1);
      if (found[0]) {
        found[0].platform = `${platform} → YouTube`;
        found[0].sourceQuery = title;
        return found;
      }
    }
  } catch {
    // Continuar con un intento más básico desde el slug de la URL.
  }
  const fallback = input
    .split(/[/?#]/)
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]/g, ' ')
    ?.replace(/\btrack\b|\balbum\b|\bsong\b/gi, '')
    ?.trim();
  if (fallback && fallback.length > 4 && !/^[a-z0-9]{15,}$/i.test(fallback)) {
    const found = await youtubeSearch(fallback, 1);
    if (found[0]) {
      found[0].platform = `${platform} → YouTube`;
      found[0].sourceQuery = fallback;
      return found;
    }
  }
  throw new Error(`${platform} fue detectado, pero no se pudo leer el título desde ese link. Escribe el nombre de la canción o artista para buscarla en YouTube.`);
}

function looksLikePlaylist(input) {
  if (!safeUrl(input)) return false;
  const s = input.toLowerCase();
  return s.includes('list=') || s.includes('/playlist') || s.includes('/sets/');
}

async function resolveInput(input, maxItems = 1) {
  const clean = String(input || '').trim();
  if (!clean) throw new Error('Escribe el nombre o link de una canción.');

  if (safeUrl(clean) && isExternalMusicLink(clean)) {
    return resolveExternalMusicLink(clean);
  }

  if (safeUrl(clean)) {
    if (looksLikePlaylist(clean) && maxItems > 1) {
      const playlist = await ytdlpPlaylistJson(clean, maxItems);
      const entries = Array.isArray(playlist.entries) ? playlist.entries : [];
      const tracks = entries.map((entry) => normalizeTrack(entry, platformFromUrl(clean), clean)).filter((t) => t && t.url);
      if (tracks.length) return tracks.slice(0, maxItems);
    }
    const info = await ytdlpJson(clean, { timeoutMs: 30000 });
    if (Array.isArray(info.entries) && info.entries.length) {
      return info.entries.slice(0, maxItems).map((entry) => normalizeTrack(entry, platformFromUrl(clean), clean)).filter(Boolean);
    }
    const track = normalizeTrack(info, platformFromUrl(clean), clean);
    if (!track || !track.url) throw new Error('No pude resolver ese link de música.');
    return [track];
  }

  const results = await youtubeSearch(clean, maxItems);
  if (!results.length) throw new Error('No encontré resultados en YouTube para esa búsqueda.');
  return results;
}

function attachRequester(track, interaction) {
  return {
    ...track,
    requestedById: interaction.user.id,
    requestedByTag: interaction.user.tag,
    requestedByName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
  };
}

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    const state = {
      guildId,
      player,
      connection: null,
      queue: [],
      current: null,
      volume: CONFIG.DEFAULT_VOLUME,
      panelMessageId: null,
      panelChannelId: null,
      lastTextChannelId: null,
      lastRequesterId: null,
      recommendationSeed: null,
      idleTimer: null,
      currentProcesses: [],
      testMode: false,
      lock: false,
    };

    player.on(AudioPlayerStatus.Idle, async () => {
      if (state.testMode) {
        state.testMode = false;
        await refreshPanelByState(state, 'idle').catch(() => {});
        scheduleVoiceTimeout(state);
        return;
      }
      await handleTrackEnded(state).catch((error) => console.error('[JUANPLAY] Error al terminar pista:', error));
    });

    player.on('error', async (error) => {
      console.error('[JUANPLAY] Error de reproductor:', error?.message || error);
      killCurrentProcesses(state);
      const failed = state.current;
      state.current = null;
      await minimalPublicError(state, failed, error?.message || 'Error de audio').catch(() => {});
      await playNext(state).catch((err) => console.error('[JUANPLAY] Error intentando siguiente canción:', err));
    });

    guildStates.set(guildId, state);
  }
  return guildStates.get(guildId);
}

function killCurrentProcesses(state) {
  for (const child of state.currentProcesses || []) {
    try {
      if (child && !child.killed) child.kill('SIGKILL');
    } catch {}
  }
  state.currentProcesses = [];
}

async function ensureVoiceConnection(interaction) {
  const guild = interaction.guild;
  const state = getState(guild.id);
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error('Entra primero a un canal de voz y vuelve a intentarlo.');
  }

  const me = guild.members.me || await guild.members.fetchMe();
  const perms = voiceChannel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.Connect)) throw new Error('No tengo permiso para conectarme a tu canal de voz.');
  if (!perms?.has(PermissionFlagsBits.Speak)) throw new Error('No tengo permiso para hablar en tu canal de voz.');

  const existing = getVoiceConnection(guild.id);
  if (existing && state.connection === existing) {
    if (existing.joinConfig.channelId !== voiceChannel.id) {
      existing.destroy();
      state.connection = null;
    } else {
      existing.subscribe(state.player);
      return existing;
    }
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: CONFIG.VOICE_SELF_DEAF,
  });
  connection.subscribe(state.player);
  state.connection = connection;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      try { connection.destroy(); } catch {}
      if (state.connection === connection) state.connection = null;
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  return connection;
}

function createMusicStream(track, state) {
  const ytdlpArgs = [
    ...ytdlpBaseArgs(),
    '-q',
    '--no-playlist',
    '--force-ipv4',
    '-f',
    'bestaudio/best',
    '-o',
    '-',
    track.url,
  ];

  const ffmpegArgs = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    'pipe:0',
    '-analyzeduration',
    '0',
    '-loglevel',
    'error',
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    'pipe:1',
  ];

  const ytdlp = spawn(CONFIG.YTDLP_BIN, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const ffmpeg = spawn(CONFIG.FFMPEG_BIN, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  state.currentProcesses = [ytdlp, ffmpeg];

  let ytdlpErr = '';
  let ffmpegErr = '';
  ytdlp.stderr.on('data', (d) => { ytdlpErr += d.toString('utf8'); });
  ffmpeg.stderr.on('data', (d) => { ffmpegErr += d.toString('utf8'); });

  ytdlp.on('error', (err) => console.error('[JUANPLAY] yt-dlp no inició:', err.message));
  ffmpeg.on('error', (err) => console.error('[JUANPLAY] ffmpeg no inició:', err.message));
  ytdlp.stdout.on('error', () => {});
  ffmpeg.stdin.on('error', () => {});
  ffmpeg.stdout.on('error', () => {});

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.on('close', (code) => {
    try { ffmpeg.stdin.end(); } catch {}
    if (code && state.current === track) {
      console.error('[JUANPLAY] yt-dlp stream:', classifyYtdlpError(ytdlpErr));
    }
  });
  ffmpeg.on('close', (code) => {
    if (code && state.current === track) {
      console.error('[JUANPLAY] ffmpeg stream:', trimText(ffmpegErr, 300));
    }
  });

  const resource = createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true,
    metadata: track,
  });
  if (resource.volume) resource.volume.setVolume(Math.max(0, Math.min(2, state.volume / 100)));
  return resource;
}

function createToneResource(state) {
  const ffmpeg = spawn(CONFIG.FFMPEG_BIN, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=880:duration=2',
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  state.currentProcesses = [ffmpeg];
  return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
}

async function playNext(state) {
  if (state.lock) return;
  state.lock = true;
  try {
    clearVoiceTimeout(state);
    killCurrentProcesses(state);
    state.current = null;

    if (!state.queue.length) {
      await setPresenceIdle();
      await refreshPanelByState(state, 'ended');
      scheduleVoiceTimeout(state);
      return;
    }

    const next = state.queue.shift();
    state.current = next;
    state.recommendationSeed = next;
    state.lastRequesterId = next.requestedById || state.lastRequesterId;

    const resource = createMusicStream(next, state);
    state.player.play(resource);
    await setPresencePlaying(next.title);
    await refreshPanelByState(state, 'playing');
  } finally {
    state.lock = false;
  }
}

async function handleTrackEnded(state) {
  killCurrentProcesses(state);
  if (state.current) state.recommendationSeed = state.current;
  state.current = null;
  await playNext(state);
}

function enqueueTracks(state, tracks) {
  const freeSlots = CONFIG.MAX_QUEUE_SIZE - state.queue.length - (state.current ? 1 : 0);
  if (freeSlots <= 0) throw new Error(`La cola está llena. Límite: ${CONFIG.MAX_QUEUE_SIZE} canciones.`);
  const accepted = tracks.slice(0, freeSlots);
  state.queue.push(...accepted);
  return accepted;
}

function clearVoiceTimeout(state) {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

function scheduleVoiceTimeout(state) {
  clearVoiceTimeout(state);
  state.idleTimer = setTimeout(async () => {
    if (state.current || state.queue.length) return;
    killCurrentProcesses(state);
    try { state.connection?.destroy(); } catch {}
    state.connection = null;
    await setPresenceIdle();
  }, CONFIG.VOICE_TIMEOUT_MS);
}

async function refreshPanelByState(state, status = 'playing') {
  if (!CONFIG.PUBLIC_NOWPLAYING_PANEL) return;
  const channelId = state.lastTextChannelId || state.panelChannelId;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = makePanelEmbed(state, status);
  const components = makePanelButtons(Boolean(state.current));

  if (state.panelMessageId) {
    const existing = await channel.messages.fetch(state.panelMessageId).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed], components });
      return;
    }
  }

  const message = await channel.send({ embeds: [embed], components }).catch(() => null);
  if (message) {
    state.panelMessageId = message.id;
    state.panelChannelId = channel.id;
  }
}

function makePanelEmbed(state, status) {
  if (state.current) {
    const track = state.current;
    const requester = track.requestedById ? `<@${track.requestedById}>` : (track.requestedByName || 'Desconocido');
    const embed = makeEmbed(`${CONFIG.DEFAULT_EMOJI} ${CONFIG.BOT_BRAND} está reproduciendo`, `**${track.title}**`, CONFIG.BOT_COLOR)
      .addFields(
        { name: '🎵 Canción actual', value: track.url ? `[${trimText(track.title, 70)}](${track.url})` : track.title, inline: false },
        { name: '🙋 Quién la pidió', value: requester, inline: true },
        { name: '⏱️ Duración', value: formatDuration(track.duration), inline: true },
        { name: '🌐 Plataforma', value: track.platform || 'YouTube', inline: true },
        { name: '🔊 Volumen', value: `${state.volume}%`, inline: true },
        { name: '📜 Canciones en cola', value: `${state.queue.length}`, inline: true },
        { name: '👑 Créditos', value: CONFIG.DEVELOPER_NAME, inline: true },
      );
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    return embed;
  }

  const seed = state.recommendationSeed?.title ? `Última canción: **${state.recommendationSeed.title}**` : 'No hay canción sonando ahora.';
  const msg = status === 'ended'
    ? `${seed}\n\nLa cola está vacía. Usa el botón **Recomendados privados** o escribe **/play** para seguir escuchando.`
    : 'El reproductor está inactivo.';
  return makeEmbed(`${CONFIG.DEFAULT_EMOJI} ${CONFIG.BOT_BRAND} en espera`, msg, COLORS.warn)
    .addFields(
      { name: '📜 Canciones en cola', value: `${state.queue.length}`, inline: true },
      { name: '🔊 Volumen', value: `${state.volume}%`, inline: true },
      { name: '👑 Créditos', value: CONFIG.DEVELOPER_NAME, inline: true },
    );
}

function makePanelButtons(isPlaying) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jp_pause').setLabel('Pausar').setEmoji('⏸️').setStyle(ButtonStyle.Secondary).setDisabled(!isPlaying),
    new ButtonBuilder().setCustomId('jp_resume').setLabel('Reanudar').setEmoji('▶️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('jp_skip').setLabel('Saltar').setEmoji('⏭️').setStyle(ButtonStyle.Primary).setDisabled(!isPlaying),
    new ButtonBuilder().setCustomId('jp_queue').setLabel('Cola privada').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('jp_rec').setLabel('Recomendados privados').setEmoji('✨').setStyle(ButtonStyle.Secondary),
  ), new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jp_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!isPlaying),
  )];
}

async function minimalPublicError(state, track, reason) {
  if (!state.lastTextChannelId) return;
  const channel = await client.channels.fetch(state.lastTextChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const embed = makeEmbed('⚠️ Error de reproducción', `No pude reproducir **${trimText(track?.title || 'esa canción', 90)}**. Intentaré continuar con la cola.`, COLORS.warn)
    .addFields({ name: 'Detalle privado/técnico', value: trimText(reason, 120), inline: false });
  if (state.panelMessageId) {
    const msg = await channel.messages.fetch(state.panelMessageId).catch(() => null);
    if (msg) return msg.edit({ embeds: [embed], components: makePanelButtons(false) }).catch(() => {});
  }
}

async function setPresenceStartup() {
  client.user?.setPresence({
    activities: [{ name: '/play | DEVJUANCHO', type: ActivityType.Listening }],
    status: 'online',
  });
}

async function setPresencePlaying(title) {
  client.user?.setPresence({
    activities: [{ name: `Escuchando: ${trimText(title, 80)}`, type: ActivityType.Listening }],
    status: 'online',
  });
}

async function setPresenceIdle() {
  client.user?.setPresence({
    activities: [{ name: `${CONFIG.BOT_BRAND} | ${CONFIG.DEVELOPER_NAME}`, type: ActivityType.Listening }],
    status: 'idle',
  });
}

function commandDefinitions() {
  const songOption = (builder, required = true) => builder
    .setName('cancion')
    .setDescription('Nombre o link de la canción')
    .setRequired(required)
    .setAutocomplete(true);

  return [
    new SlashCommandBuilder().setName('play').setDescription('Reproduce una canción por nombre o link').addStringOption((o) => songOption(o, true)),
    new SlashCommandBuilder().setName('juanplay').setDescription('Alias bonito de /play').addStringOption((o) => songOption(o, true)),
    new SlashCommandBuilder().setName('buscar').setDescription('Busca canciones y elige con botones privados').addStringOption((o) => songOption(o, true)),
    new SlashCommandBuilder().setName('recomendados').setDescription('Muestra recomendaciones privadas').addStringOption((o) => songOption(o, false)),
    new SlashCommandBuilder().setName('similares').setDescription('Busca canciones similares a la actual o a una canción').addStringOption((o) => songOption(o, false)),
    new SlashCommandBuilder().setName('queue').setDescription('Muestra la cola de música en privado'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('Muestra la canción actual'),
    new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual'),
    new SlashCommandBuilder().setName('stop').setDescription('Detiene la música y limpia la cola'),
    new SlashCommandBuilder().setName('pause').setDescription('Pausa la canción actual'),
    new SlashCommandBuilder().setName('resume').setDescription('Reanuda la canción pausada'),
    new SlashCommandBuilder().setName('volume').setDescription('Cambia el volumen').addIntegerOption((o) => o.setName('porcentaje').setDescription('Volumen de 0 a 150').setRequired(true).setMinValue(0).setMaxValue(150)),
    new SlashCommandBuilder().setName('leave').setDescription('Saca al bot del canal de voz'),
    new SlashCommandBuilder().setName('testvoz').setDescription('Prueba si el bot puede entrar al canal de voz'),
    new SlashCommandBuilder().setName('testaudio').setDescription('Reproduce un tono corto para probar el audio'),
    new SlashCommandBuilder().setName('diagnostico').setDescription('Revisa token, GUILD_ID, ffmpeg, yt-dlp, voz y permisos'),
    new SlashCommandBuilder().setName('perfil').setDescription('Muestra el perfil recomendado del bot'),
    new SlashCommandBuilder().setName('creditos').setDescription('Muestra los créditos oficiales'),
    new SlashCommandBuilder().setName('help').setDescription('Muestra la ayuda de JUANPLAY'),
  ].map((command) => command.toJSON());
}

async function registerCommands() {
  if (commandsRegistered) return;
  if (!CONFIG.DISCORD_TOKEN) throw new Error('Falta DISCORD_TOKEN en Railway.');
  if (!CONFIG.GUILD_ID) throw new Error('Falta GUILD_ID en Railway.');
  const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: commandDefinitions() });
  commandsRegistered = true;
  console.log(`[JUANPLAY] Comandos slash registrados en GUILD_ID ${CONFIG.GUILD_ID}.`);
}

function isOnCooldown(interaction) {
  if (!CONFIG.COMMAND_COOLDOWN_MS) return false;
  const key = `${interaction.user.id}:${interaction.commandName || interaction.customId || 'button'}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < CONFIG.COMMAND_COOLDOWN_MS) return Math.ceil((CONFIG.COMMAND_COOLDOWN_MS - (now - last)) / 1000);
  cooldowns.set(key, now);
  return false;
}

function clonePayload(payload) {
  return typeof payload === 'string' ? { content: payload } : { ...(payload || {}) };
}

function addEphemeralFlag(payload, ephemeral) {
  const finalPayload = clonePayload(payload);
  delete finalPayload.ephemeral; // discord.js v14 depreca "ephemeral"; usar flags evita warnings.
  if (ephemeral) finalPayload.flags = MessageFlags.Ephemeral;
  return finalPayload;
}

function stripInitialOnlyFlags(payload) {
  const finalPayload = clonePayload(payload);
  delete finalPayload.ephemeral;
  delete finalPayload.flags; // editReply no puede cambiar si es privado; eso se define en defer/reply.
  return finalPayload;
}

async function deferSmart(interaction, ephemeral = CONFIG.PRIVATE_COMMAND_RESPONSES) {
  if (interaction.deferred || interaction.replied) return true;
  const payload = ephemeral ? { flags: MessageFlags.Ephemeral } : {};
  await interaction.deferReply(payload);
  return true;
}

async function replySmart(interaction, payload, ephemeral = CONFIG.PRIVATE_COMMAND_RESPONSES) {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(stripInitialOnlyFlags(payload));
    }
    if (interaction.replied) {
      return await interaction.followUp(addEphemeralFlag(payload, ephemeral));
    }
    return await interaction.reply(addEphemeralFlag(payload, ephemeral));
  } catch (error) {
    console.error('[JUANPLAY] No pude responder interacción:', error?.message || error);
    return null;
  }
}

async function loadingReply(interaction, title, description, ephemeral = true) {
  await deferSmart(interaction, ephemeral);
  await interaction.editReply({ embeds: [makeEmbed(title, description, CONFIG.BOT_COLOR)] }).catch(() => {});
}

async function errorReply(interaction, error) {
  const message = error?.message || String(error || 'Error desconocido.');
  const embed = makeEmbed('⚠️ Algo salió mal', message, COLORS.error);
  await replySmart(interaction, { embeds: [embed] }, true);
}

async function handlePlayCommand(interaction) {
  const query = interaction.options.getString('cancion', true);
  await loadingReply(interaction, '🔎 Buscando canción', `Estoy buscando **${trimText(query, 120)}** y preparando el canal de voz...`, CONFIG.PRIVATE_COMMAND_RESPONSES);
  const state = getState(interaction.guild.id);
  state.lastTextChannelId = interaction.channelId;
  await ensureVoiceConnection(interaction);

  const maxItems = looksLikePlaylist(query) ? CONFIG.MAX_PLAYLIST_ITEMS : 1;
  const tracks = (await resolveInput(query, maxItems)).map((track) => attachRequester(track, interaction));
  const accepted = enqueueTracks(state, tracks);
  const first = accepted[0];
  const embed = makeEmbed(
    '✅ Agregado a la cola',
    accepted.length === 1
      ? `**${first.title}**\nPlataforma: **${first.platform}**\nCola actual: **${state.queue.length + (state.current ? 1 : 0)}**`
      : `Se agregaron **${accepted.length}** canciones.\nLímite de playlist: **${CONFIG.MAX_PLAYLIST_ITEMS}**\nCola actual: **${state.queue.length + (state.current ? 1 : 0)}**`,
    COLORS.ok,
  );
  await replySmart(interaction, { embeds: [embed] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
  if (!state.current && state.player.state.status !== AudioPlayerStatus.Playing) await playNext(state);
  else await refreshPanelByState(state, 'playing');
}

async function handleSearchCommand(interaction) {
  const query = interaction.options.getString('cancion', true);
  await loadingReply(interaction, '🔎 Buscando resultados', `Buscando **${trimText(query, 120)}**...`, true);
  const results = await youtubeSearch(query, 5);
  if (!results.length) throw new Error('No encontré resultados para esa búsqueda.');
  const id = createSession(results.map((track) => attachRequester(track, interaction)), interaction.user.id, 'search');
  const embed = makeEmbed('🔎 Resultados privados', results.map((t, i) => `**${i + 1}.** ${t.title}\n${formatDuration(t.duration)} · ${t.platform}`).join('\n\n'));
  const row = new ActionRowBuilder().addComponents(results.map((_, i) => new ButtonBuilder()
    .setCustomId(`search:${id}:${i}`)
    .setLabel(`Elegir ${i + 1}`)
    .setStyle(ButtonStyle.Primary)));
  await replySmart(interaction, { embeds: [embed], components: [row] }, true);
}

function createSession(tracks, userId, type) {
  const id = crypto.randomBytes(5).toString('hex');
  buttonSessions.set(id, { tracks, userId, type, createdAt: Date.now() });
  setTimeout(() => buttonSessions.delete(id), 10 * 60 * 1000).unref?.();
  return id;
}

async function makeRecommendations(seedText, count = CONFIG.RECOMMENDATION_COUNT) {
  const query = `${seedText} canciones similares recomendadas`;
  return youtubeSearch(query, count);
}

async function handleRecommendationsCommand(interaction, similarMode = false) {
  await loadingReply(interaction, '✨ Preparando recomendaciones', 'Buscando canciones parecidas sin spamear el canal...', true);
  const state = getState(interaction.guild.id);
  const typed = interaction.options?.getString('cancion', false);
  const seed = typed || state.current?.title || state.recommendationSeed?.title;
  if (!seed) throw new Error('No tengo una canción base todavía. Escribe un nombre o reproduce algo primero.');
  const results = (await makeRecommendations(seed)).map((track) => attachRequester(track, interaction));
  if (!results.length) throw new Error('No encontré recomendaciones ahora mismo.');
  await sendRecommendationButtons(interaction, results, similarMode ? `🎧 Similares a: ${seed}` : `✨ Recomendados para: ${seed}`);
}

async function sendRecommendationButtons(interaction, results, title) {
  const id = createSession(results, interaction.user.id, 'recommendations');
  const embed = makeEmbed(title, results.map((t, i) => `**${i + 1}.** ${t.title}\n${formatDuration(t.duration)} · ${t.platform}`).join('\n\n'));
  const rows = [];
  for (let i = 0; i < results.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(results.slice(i, i + 5).map((_, offset) => {
      const index = i + offset;
      return new ButtonBuilder()
        .setCustomId(`rec:${id}:${index}`)
        .setLabel(`Agregar ${index + 1}`)
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success);
    })));
  }
  await replySmart(interaction, { embeds: [embed], components: rows }, true);
}

async function handleQueueCommand(interaction) {
  const state = getState(interaction.guild.id);
  const lines = [];
  if (state.current) lines.push(`🎵 **Actual:** ${state.current.title}`);
  if (state.queue.length) {
    lines.push(...state.queue.slice(0, 15).map((t, i) => `**${i + 1}.** ${t.title} · ${formatDuration(t.duration)}`));
    if (state.queue.length > 15) lines.push(`…y ${state.queue.length - 15} más.`);
  }
  const embed = makeEmbed('📜 Cola privada', lines.length ? lines.join('\n') : 'La cola está vacía.');
  await replySmart(interaction, { embeds: [embed] }, true);
}

async function handleNowPlaying(interaction) {
  const state = getState(interaction.guild.id);
  if (!state.current) return replySmart(interaction, { embeds: [makeEmbed('💤 Nada sonando', 'Usa **/play** para empezar.', COLORS.warn)] }, true);
  const embed = makePanelEmbed(state, 'playing');
  await replySmart(interaction, { embeds: [embed] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
}

async function handleSkip(interaction) {
  const state = getState(interaction.guild.id);
  if (!state.current) throw new Error('No hay canción sonando para saltar.');
  const skipped = state.current.title;
  killCurrentProcesses(state);
  state.player.stop(true);
  await replySmart(interaction, { embeds: [makeEmbed('⏭️ Canción saltada', `Se saltó **${skipped}**.`, COLORS.ok)] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
}

async function handleStop(interaction) {
  const state = getState(interaction.guild.id);
  state.queue = [];
  state.current = null;
  killCurrentProcesses(state);
  state.player.stop(true);
  await setPresenceIdle();
  await refreshPanelByState(state, 'idle');
  scheduleVoiceTimeout(state);
  await replySmart(interaction, { embeds: [makeEmbed('⏹️ Reproducción detenida', 'Cola limpiada sin spamear el canal.', COLORS.ok)] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
}

async function handlePause(interaction) {
  const state = getState(interaction.guild.id);
  if (!state.current) throw new Error('No hay canción sonando.');
  const ok = state.player.pause(true);
  await replySmart(interaction, { embeds: [makeEmbed('⏸️ Pausa', ok ? 'Música pausada.' : 'No pude pausar ahora mismo.', ok ? COLORS.ok : COLORS.warn)] }, true);
  await refreshPanelByState(state, 'playing');
}

async function handleResume(interaction) {
  const state = getState(interaction.guild.id);
  const ok = state.player.unpause();
  await replySmart(interaction, { embeds: [makeEmbed('▶️ Reanudar', ok ? 'Música reanudada.' : 'No hay nada pausado para reanudar.', ok ? COLORS.ok : COLORS.warn)] }, true);
  await refreshPanelByState(state, 'playing');
}

async function handleVolume(interaction) {
  const state = getState(interaction.guild.id);
  const volume = interaction.options.getInteger('porcentaje', true);
  state.volume = volume;
  const resource = state.player.state.resource;
  if (resource?.volume) resource.volume.setVolume(Math.max(0, Math.min(2, volume / 100)));
  await replySmart(interaction, { embeds: [makeEmbed('🔊 Volumen actualizado', `Volumen: **${volume}%**`, COLORS.ok)] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
  await refreshPanelByState(state, 'playing');
}

async function handleLeave(interaction) {
  const state = getState(interaction.guild.id);
  state.queue = [];
  state.current = null;
  killCurrentProcesses(state);
  state.player.stop(true);
  try { state.connection?.destroy(); } catch {}
  state.connection = null;
  await setPresenceIdle();
  await replySmart(interaction, { embeds: [makeEmbed('👋 Salí del canal de voz', 'Listo. Usa **/play** para llamarme de nuevo.', COLORS.ok)] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
}

async function handleTestVoice(interaction) {
  await loadingReply(interaction, '🔊 Probando voz', 'Intentando conectarme al canal de voz...', true);
  await ensureVoiceConnection(interaction);
  const state = getState(interaction.guild.id);
  state.lastTextChannelId = interaction.channelId;
  await replySmart(interaction, { embeds: [makeEmbed('✅ Prueba de voz correcta', 'Pude conectarme al canal de voz.', COLORS.ok)] }, true);
}

async function handleTestAudio(interaction) {
  await loadingReply(interaction, '🔊 Probando audio', 'Preparando tono de prueba...', true);
  const state = getState(interaction.guild.id);
  if (state.current) throw new Error('Hay música sonando ahora. Para no interrumpir a todos, usa /pause o /stop antes de /testaudio.');
  state.lastTextChannelId = interaction.channelId;
  await ensureVoiceConnection(interaction);
  clearVoiceTimeout(state);
  state.testMode = true;
  const resource = createToneResource(state);
  if (resource.volume) resource.volume.setVolume(Math.max(0, Math.min(2, state.volume / 100)));
  state.player.play(resource);
  await replySmart(interaction, { embeds: [makeEmbed('🔊 Prueba de audio', 'Reproduciendo un tono corto de 2 segundos.', COLORS.ok)] }, true);
}

function checkBinary(binary, arg = '-version') {
  const out = spawnSync(binary, [arg], { encoding: 'utf8' });
  return { ok: out.status === 0, text: (out.stdout || out.stderr || '').split('\n')[0] || 'Sin salida' };
}

async function handleDiagnostic(interaction) {
  await loadingReply(interaction, '🧪 Ejecutando diagnóstico', 'Revisando Railway, binarios, permisos y voz...', true);
  const state = getState(interaction.guild.id);
  const ffmpeg = checkBinary(CONFIG.FFMPEG_BIN, '-version');
  const ytdlp = checkBinary(CONFIG.YTDLP_BIN, '--version');
  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
  const channel = interaction.channel;
  const channelPerms = channel?.permissionsFor(me);
  const voiceChannel = interaction.member?.voice?.channel;
  const voicePerms = voiceChannel?.permissionsFor(me);
  const connection = getVoiceConnection(interaction.guild.id) || state.connection;

  const fields = [
    { name: '🔐 Token detectado', value: CONFIG.DISCORD_TOKEN ? '✅ Sí' : '❌ No', inline: true },
    { name: '🆔 GUILD_ID detectado', value: CONFIG.GUILD_ID ? `✅ ${CONFIG.GUILD_ID}` : '❌ No', inline: true },
    { name: '🎛️ ffmpeg disponible', value: ffmpeg.ok ? `✅ ${ffmpeg.text}` : '❌ No detectado', inline: false },
    { name: '📥 yt-dlp disponible', value: ytdlp.ok ? `✅ ${ytdlp.text}` : '❌ No detectado', inline: false },
    { name: '🔊 Conexión de voz', value: connection ? `✅ ${connection.state.status}` : '⚠️ Sin conexión activa', inline: true },
    { name: '🧩 Versión del bot', value: BOT_VERSION, inline: true },
    { name: '📌 Permisos texto', value: [
      channelPerms?.has(PermissionFlagsBits.ViewChannel) ? '✅ Ver canales' : '❌ Ver canales',
      channelPerms?.has(PermissionFlagsBits.SendMessages) ? '✅ Enviar mensajes' : '❌ Enviar mensajes',
      channelPerms?.has(PermissionFlagsBits.EmbedLinks) ? '✅ Insertar enlaces' : '❌ Insertar enlaces',
      channelPerms?.has(PermissionFlagsBits.ReadMessageHistory) ? '✅ Leer historial' : '❌ Leer historial',
    ].join('\n'), inline: true },
    { name: '🎙️ Permisos voz', value: voiceChannel ? [
      voicePerms?.has(PermissionFlagsBits.Connect) ? '✅ Conectarse' : '❌ Conectarse',
      voicePerms?.has(PermissionFlagsBits.Speak) ? '✅ Hablar' : '❌ Hablar',
      voicePerms?.has(PermissionFlagsBits.UseVAD) ? '✅ Usar actividad de voz' : '❌ Usar actividad de voz',
    ].join('\n') : '⚠️ Entra a un canal de voz para revisar permisos de voz.', inline: true },
  ];

  const embed = makeEmbed('🧪 Diagnóstico JUANPLAY', 'Revisión rápida para Railway y Discord.', ffmpeg.ok && ytdlp.ok && CONFIG.DISCORD_TOKEN && CONFIG.GUILD_ID ? COLORS.ok : COLORS.warn)
    .addFields(fields);
  await replySmart(interaction, { embeds: [embed] }, true);
}

function profileText() {
  return [
    `${CONFIG.DEFAULT_EMOJI} ${CONFIG.BOT_BRAND} — Bot de música para Discord`,
    '',
    `${CONFIG.BOT_BRAND} es un bot de música profesional, decorado y estable para servidores de Discord. Permite reproducir canciones por nombre o link, buscar resultados con botones, manejar cola privada, recomendaciones, panel público editable y diagnóstico completo.`,
    '',
    `Desarrollador/créditos únicos: ${CONFIG.DEVELOPER_NAME}`,
    '',
    'Comandos principales:',
    '/play, /juanplay, /buscar, /recomendados, /similares, /queue, /nowplaying, /skip, /stop, /pause, /resume, /volume, /leave, /testvoz, /testaudio, /diagnostico, /perfil, /creditos, /help',
    '',
    'Permisos recomendados:',
    'Ver canales, Enviar mensajes, Insertar enlaces, Leer historial de mensajes, Usar comandos de aplicación, Conectarse, Hablar y Usar actividad de voz.',
  ].join('\n');
}

async function handleProfile(interaction) {
  const embed = makeEmbed('📝 Perfil recomendado para Discord Developer Portal', `\`\`\`\n${profileText().slice(0, 3500)}\n\`\`\``);
  await replySmart(interaction, { embeds: [embed] }, true);
}

async function handleCredits(interaction) {
  const embed = makeEmbed('👑 Créditos oficiales', `**${CONFIG.BOT_BRAND}** fue creado y personalizado por **${CONFIG.DEVELOPER_NAME}**.\n\nDiseño profesional, panel público editable, respuestas privadas anti-spam y música con yt-dlp + ffmpeg.`, CONFIG.BOT_COLOR);
  await replySmart(interaction, { embeds: [embed] }, CONFIG.PRIVATE_COMMAND_RESPONSES);
}

async function handleHelp(interaction) {
  const embed = makeEmbed('📖 Ayuda de JUANPLAY', 'Bot de música profesional para Discord, creado por DEVJUANCHO.')
    .addFields(
      { name: '🎵 Música', value: '`/play`, `/juanplay`, `/buscar`, `/recomendados`, `/similares`', inline: false },
      { name: '🎚️ Control', value: '`/pause`, `/resume`, `/skip`, `/stop`, `/volume`, `/leave`', inline: false },
      { name: '📜 Información', value: '`/queue`, `/nowplaying`, `/perfil`, `/creditos`, `/help`', inline: false },
      { name: '🧪 Pruebas', value: '`/diagnostico`, `/testvoz`, `/testaudio`', inline: false },
      { name: '💡 Uso rápido', value: 'Entra a un canal de voz y escribe `/play cancion:<nombre o link>`.', inline: false },
    );
  await replySmart(interaction, { embeds: [embed] }, true);
}

async function handleCommand(interaction) {
  const cooldown = isOnCooldown(interaction);
  if (cooldown) {
    return replySmart(interaction, { embeds: [makeEmbed('⏳ Cooldown anti-spam', `Espera **${cooldown}s** antes de volver a usar este comando.`, COLORS.warn)] }, true);
  }

  switch (interaction.commandName) {
    case 'play':
    case 'juanplay': return handlePlayCommand(interaction);
    case 'buscar': return handleSearchCommand(interaction);
    case 'recomendados': return handleRecommendationsCommand(interaction, false);
    case 'similares': return handleRecommendationsCommand(interaction, true);
    case 'queue': return handleQueueCommand(interaction);
    case 'nowplaying': return handleNowPlaying(interaction);
    case 'skip': return handleSkip(interaction);
    case 'stop': return handleStop(interaction);
    case 'pause': return handlePause(interaction);
    case 'resume': return handleResume(interaction);
    case 'volume': return handleVolume(interaction);
    case 'leave': return handleLeave(interaction);
    case 'testvoz': return handleTestVoice(interaction);
    case 'testaudio': return handleTestAudio(interaction);
    case 'diagnostico': return handleDiagnostic(interaction);
    case 'perfil': return handleProfile(interaction);
    case 'creditos': return handleCredits(interaction);
    case 'help': return handleHelp(interaction);
    default: throw new Error('Comando no reconocido.');
  }
}

async function handleButton(interaction) {
  const state = getState(interaction.guild.id);
  state.lastTextChannelId = interaction.channelId;

  if (interaction.customId === 'jp_pause') return handlePause(interaction);
  if (interaction.customId === 'jp_resume') return handleResume(interaction);
  if (interaction.customId === 'jp_skip') return handleSkip(interaction);
  if (interaction.customId === 'jp_stop') return handleStop(interaction);
  if (interaction.customId === 'jp_queue') return handleQueueCommand(interaction);
  if (interaction.customId === 'jp_rec') {
    await loadingReply(interaction, '✨ Recomendados privados', 'Preparando recomendaciones para ti...', true);
    const seed = state.current?.title || state.recommendationSeed?.title;
    if (!seed) throw new Error('Todavía no tengo una canción base para recomendar.');
    const results = (await makeRecommendations(seed)).map((track) => attachRequester(track, interaction));
    return sendRecommendationButtons(interaction, results, `✨ Recomendados para: ${seed}`);
  }

  const [type, sessionId, indexRaw] = interaction.customId.split(':');
  if (!['search', 'rec'].includes(type)) return;
  const session = buttonSessions.get(sessionId);
  if (!session) throw new Error('Este menú expiró. Usa el comando otra vez.');
  if (session.userId !== interaction.user.id) throw new Error('Estos botones son privados para quien abrió el menú.');
  const index = Number.parseInt(indexRaw, 10);
  const track = session.tracks[index];
  if (!track) throw new Error('No encontré esa opción.');

  await loadingReply(interaction, '✅ Agregando canción', 'Conectando al canal de voz y agregando la canción seleccionada...', true);
  await ensureVoiceConnection(interaction);
  const enriched = attachRequester(track, interaction);
  const accepted = enqueueTracks(state, [enriched]);
  await replySmart(interaction, { embeds: [makeEmbed('✅ Canción agregada', `**${accepted[0].title}** fue agregada a la cola.`, COLORS.ok)] }, true);
  if (!state.current && state.player.state.status !== AudioPlayerStatus.Playing) await playNext(state);
  else await refreshPanelByState(state, 'playing');
}

client.once(Events.ClientReady, async () => {
  console.log(`[JUANPLAY] Conectado como ${client.user.tag}.`);
  await setPresenceStartup();
  try {
    await registerCommands();
  } catch (error) {
    console.error('[JUANPLAY] No se pudieron registrar comandos:', error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      if (focused?.name === 'cancion') {
        const choices = await autocompleteSearch(focused.value);
        return interaction.respond(choices).catch(() => {});
      }
      return interaction.respond([]).catch(() => {});
    }

    if (!interaction.inGuild()) {
      return replySmart(interaction, 'JUANPLAY solo funciona dentro de servidores de Discord.', true);
    }

    if (interaction.isChatInputCommand()) return await handleCommand(interaction);
    if (interaction.isButton()) return await handleButton(interaction);
  } catch (error) {
    console.error('[JUANPLAY] Error en interacción:', error?.message || error);
    await errorReply(interaction, error);
  }
});

process.on('unhandledRejection', (error) => console.error('[JUANPLAY] unhandledRejection:', error));
process.on('uncaughtException', (error) => console.error('[JUANPLAY] uncaughtException:', error));

if (!CONFIG.DISCORD_TOKEN) {
  console.error('[JUANPLAY] Falta DISCORD_TOKEN. Agrega la variable en Railway sin comillas.');
  process.exit(1);
}
if (!CONFIG.GUILD_ID) {
  console.error('[JUANPLAY] Falta GUILD_ID. Agrega la variable en Railway sin comillas.');
  process.exit(1);
}

client.login(CONFIG.DISCORD_TOKEN);
