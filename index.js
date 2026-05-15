'use strict';

require('dotenv').config();

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const childProcess = require('node:child_process');
const ffmpegStatic = require('ffmpeg-static');

if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  generateDependencyReport,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
} = require('@discordjs/voice');

const BOT_NAME = 'JUANVOICE';
const FOOTER = 'DEVJUANCHO • JuanStudio • JUANVOICE';
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TEMP_DIR = path.join(os.tmpdir(), 'juanvoice-tts');
const SETTINGS_FILE = path.join(DATA_DIR, 'guild-settings.json');

const VOICES = {
  'es-LA-female': {
    label: 'Español latino femenino',
    shortName: 'es-MX-DaliaNeural',
    googleLang: 'es',
    emoji: '🌸',
  },
  'es-LA-male': {
    label: 'Español latino masculino',
    shortName: 'es-MX-JorgeNeural',
    googleLang: 'es',
    emoji: '🎙️',
  },
  'es-ES-female': {
    label: 'Español España femenino',
    shortName: 'es-ES-ElviraNeural',
    googleLang: 'es',
    emoji: '✨',
  },
  'es-ES-male': {
    label: 'Español España masculino',
    shortName: 'es-ES-AlvaroNeural',
    googleLang: 'es',
    emoji: '📢',
  },
  'en-US-female': {
    label: 'Inglés femenino',
    shortName: 'en-US-JennyNeural',
    googleLang: 'en',
    emoji: '💬',
  },
  'en-US-male': {
    label: 'Inglés masculino',
    shortName: 'en-US-GuyNeural',
    googleLang: 'en',
    emoji: '🔊',
  },
};

const VOICE_CHOICES = Object.entries(VOICES).map(([value, voice]) => ({
  name: `${voice.emoji} ${voice.label}`,
  value,
}));

class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}

function parseMs(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function parsePositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(String(value).trim().toLowerCase());
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  defaultVoice: VOICES[process.env.DEFAULT_VOICE] ? process.env.DEFAULT_VOICE : 'es-LA-female',
  botColor: normalizeHexColor(process.env.BOT_COLOR, '#ff2f7d'),
  commandCooldownMs: parseMs(process.env.COMMAND_COOLDOWN_MS, 3000),
  maxTextLength: parsePositiveInt(process.env.MAX_TEXT_LENGTH, 250),
  maxQueueSize: parsePositiveInt(process.env.MAX_QUEUE_SIZE, 50),
  voiceTimeoutMs: parseMs(process.env.VOICE_TIMEOUT_MS, 120000),
  autoTtsEnabledByDefault: parseBool(process.env.AUTO_TTS_ENABLED, false),
  ttsProvider: ['edge', 'google', 'auto'].includes(String(process.env.TTS_PROVIDER || '').toLowerCase()) ? String(process.env.TTS_PROVIDER || '').toLowerCase() : 'auto',
  port: parsePositiveInt(process.env.PORT, 3000),
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

let edgeTtsModulePromise = null;
let googleTtsModulePromise = null;
let persistedSettings = loadSettings();
const guildStates = new Map();
const cooldowns = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    console.error('[SETTINGS] No se pudo leer guild-settings.json:', error);
    return {};
  }
}

async function saveSettings() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(SETTINGS_FILE, JSON.stringify(persistedSettings, null, 2), 'utf8');
  } catch (error) {
    console.error('[SETTINGS] No se pudo guardar guild-settings.json:', error);
  }
}

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const saved = persistedSettings[guildId] || {};
    guildStates.set(guildId, {
      guildId,
      player: null,
      connection: null,
      queue: [],
      current: null,
      playing: false,
      defaultVoice: VOICES[saved.defaultVoice] ? saved.defaultVoice : CONFIG.defaultVoice,
      autoTtsChannelId: saved.autoTtsChannelId || null,
      autoTtsEnabled: typeof saved.autoTtsEnabled === 'boolean' ? saved.autoTtsEnabled : CONFIG.autoTtsEnabledByDefault,
      leaveTimer: null,
      stopVersion: 0,
    });
  }

  return guildStates.get(guildId);
}

function persistGuildState(guildId) {
  const state = getState(guildId);
  persistedSettings[guildId] = {
    defaultVoice: state.defaultVoice,
    autoTtsChannelId: state.autoTtsChannelId,
    autoTtsEnabled: state.autoTtsEnabled,
  };
  saveSettings().catch(console.error);
}

function createEmbed(title, description, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || CONFIG.botColor)
    .setTitle(title)
    .setDescription(description || null)
    .setFooter({ text: FOOTER })
    .setTimestamp();

  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.fields) embed.addFields(options.fields);

  return embed;
}

function successEmbed(title, description, fields = []) {
  return createEmbed(`✅ ${title}`, description, { fields });
}

function errorEmbed(description) {
  return createEmbed('❌ Error', description, { color: '#ff4d4d' });
}

function infoEmbed(title, description, fields = []) {
  return createEmbed(`💖 ${title}`, description, { fields });
}

function warnEmbed(title, description, fields = []) {
  return createEmbed(`⚠️ ${title}`, description, { color: '#ffcc00', fields });
}

function truncate(text, max = 120) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function checkCooldown(userId) {
  if (!CONFIG.commandCooldownMs) return;

  const now = Date.now();
  const last = cooldowns.get(userId) || 0;
  const remaining = last + CONFIG.commandCooldownMs - now;

  if (remaining > 0) {
    throw new UserFacingError(`Espera **${Math.ceil(remaining / 1000)}s** antes de usar otro comando.`);
  }

  cooldowns.set(userId, now);
}

function cleanCooldowns() {
  const now = Date.now();
  for (const [userId, timestamp] of cooldowns.entries()) {
    if (now - timestamp > CONFIG.commandCooldownMs * 4 + 60000) {
      cooldowns.delete(userId);
    }
  }
}

function resolveVoiceKey(voiceKey, guildId) {
  const state = guildId ? getState(guildId) : null;
  const candidate = voiceKey || state?.defaultVoice || CONFIG.defaultVoice;
  return VOICES[candidate] ? candidate : CONFIG.defaultVoice;
}

function getVoiceLabel(voiceKey) {
  const key = VOICES[voiceKey] ? voiceKey : CONFIG.defaultVoice;
  const voice = VOICES[key];
  return `${voice.emoji} ${voice.label}`;
}

function sanitizeSpeechText(rawText) {
  const raw = String(rawText || '').trim();

  if (!raw) {
    throw new UserFacingError('El texto está vacío. Escribe algo para leerlo en voz alta.');
  }

  if (raw.length > CONFIG.maxTextLength) {
    throw new UserFacingError(`Tu texto tiene **${raw.length}** caracteres. El máximo configurado es **${CONFIG.maxTextLength}**.`);
  }

  if (/@everyone|@here/i.test(raw)) {
    throw new UserFacingError('Por seguridad, no puedo leer mensajes que contengan **@everyone** o **@here**.');
  }

  let text = raw
    .replace(/```[\s\S]*?```/g, ' bloque de código ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' enlace ')
    .replace(/<@!?\d+>/g, ' usuario ')
    .replace(/<@&\d+>/g, ' rol ')
    .replace(/<#\d+>/g, ' canal ')
    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, ' emoji ')
    .replace(/:[a-zA-Z0-9_]+:/g, ' emoji ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[*_~>#|[\]{}()]/g, ' ')
    .replace(/@/g, ' arroba ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    throw new UserFacingError('Después de limpiar menciones y markdown, no queda texto válido para leer.');
  }

  return text;
}

async function loadEdgeTTSModule() {
  if (!edgeTtsModulePromise) {
    edgeTtsModulePromise = import('edge-tts-universal');
  }

  return edgeTtsModulePromise;
}

async function loadGoogleTTSModule() {
  if (!googleTtsModulePromise) {
    googleTtsModulePromise = Promise.resolve(require('google-tts-api'));
  }

  return googleTtsModulePromise;
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': `${BOT_NAME}/1.0 (+Discord TTS Bot)`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al descargar audio TTS.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeWithEdge(text, voiceKey) {
  const voice = VOICES[resolveVoiceKey(voiceKey)];
  const mod = await loadEdgeTTSModule();
  const EdgeTTS = mod.EdgeTTS
    || mod.UniversalEdgeTTS
    || mod.IsomorphicEdgeTTS
    || mod.default?.EdgeTTS
    || mod.default?.UniversalEdgeTTS
    || mod.default?.IsomorphicEdgeTTS;

  if (!EdgeTTS) {
    throw new Error('No se encontró EdgeTTS en edge-tts-universal.');
  }

  const tts = new EdgeTTS(text, voice.shortName, {
    rate: '+0%',
    volume: '+0%',
    pitch: '+0Hz',
  });

  const result = await tts.synthesize();

  if (!result?.audio?.arrayBuffer) {
    throw new Error('edge-tts-universal no devolvió un Blob de audio válido.');
  }

  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

  if (audioBuffer.length < 100) {
    throw new Error('edge-tts-universal devolvió audio vacío o demasiado pequeño.');
  }

  return audioBuffer;
}

async function synthesizeWithGoogleFallback(text, voiceKey) {
  const voice = VOICES[resolveVoiceKey(voiceKey)];
  const googleTTS = await loadGoogleTTSModule();
  const options = {
    lang: voice.googleLang || 'es',
    slow: false,
    host: 'https://translate.google.com',
  };

  const entries = typeof googleTTS.getAllAudioUrls === 'function'
    ? googleTTS.getAllAudioUrls(text, options)
    : [{ url: googleTTS.getAudioUrl(text.slice(0, 200), options) }];

  const urls = entries
    .map((entry) => (typeof entry === 'string' ? entry : entry?.url))
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error('google-tts-api no devolvió URLs de audio.');
  }

  const parts = [];
  for (const url of urls) {
    const buffer = await fetchBuffer(url);
    if (buffer.length > 100) parts.push(buffer);
  }

  const audioBuffer = Buffer.concat(parts);

  if (audioBuffer.length < 100) {
    throw new Error('google-tts-api devolvió audio vacío o demasiado pequeño.');
  }

  return audioBuffer;
}

async function synthesizeToFile(text, voiceKey) {
  const filePath = path.join(TEMP_DIR, `jv-tts-${Date.now()}-${crypto.randomUUID()}.mp3`);
  const errors = [];
  let audioBuffer = null;
  let provider = null;

  if (CONFIG.ttsProvider === 'edge' || CONFIG.ttsProvider === 'auto') {
    try {
      audioBuffer = await synthesizeWithEdge(text, voiceKey);
      provider = 'edge-tts-universal';
    } catch (error) {
      errors.push(`Edge: ${error.message}`);
      if (CONFIG.ttsProvider === 'edge') throw error;
    }
  }

  if (!audioBuffer && (CONFIG.ttsProvider === 'google' || CONFIG.ttsProvider === 'auto')) {
    try {
      audioBuffer = await synthesizeWithGoogleFallback(text, voiceKey);
      provider = 'google-tts-api';
    } catch (error) {
      errors.push(`Google fallback: ${error.message}`);
      if (CONFIG.ttsProvider === 'google') throw error;
    }
  }

  if (!audioBuffer) {
    throw new Error(`No se pudo generar audio TTS. ${errors.join(' | ')}`);
  }

  await fsp.writeFile(filePath, audioBuffer);
  return { filePath, provider, bytes: audioBuffer.length };
}

async function cleanupTempFile(filePath) {
  if (!filePath) return;
  try {
    await fsp.rm(filePath, { force: true });
  } catch (error) {
    console.error('[TEMP] No se pudo borrar audio temporal:', error);
  }
}

async function cleanupOldTempFiles() {
  try {
    const files = await fsp.readdir(TEMP_DIR);
    await Promise.all(
      files
        .filter((file) => file.startsWith('jv-tts-') && file.endsWith('.mp3'))
        .map((file) => cleanupTempFile(path.join(TEMP_DIR, file))),
    );
  } catch (error) {
    console.error('[TEMP] No se pudo limpiar la carpeta temporal:', error);
  }
}

function ensurePlayer(guildId) {
  const state = getState(guildId);

  if (state.player) return state.player;

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    const current = state.current;
    state.current = null;
    state.playing = false;

    if (current?.filePath) {
      await cleanupTempFile(current.filePath);
    }

    processQueue(guildId).catch((error) => console.error('[QUEUE] Error procesando cola:', error));
  });

  player.on('error', async (error) => {
    console.error(`[PLAYER:${guildId}]`, error);
    const current = state.current;
    state.current = null;
    state.playing = false;

    if (current?.filePath) {
      await cleanupTempFile(current.filePath);
    }

    processQueue(guildId).catch((queueError) => console.error('[QUEUE] Error tras fallo del reproductor:', queueError));
  });

  state.player = player;
  return player;
}

function clearLeaveTimer(guildId) {
  const state = getState(guildId);
  if (state.leaveTimer) {
    clearTimeout(state.leaveTimer);
    state.leaveTimer = null;
  }
}

function scheduleVoiceTimeout(guildId) {
  const state = getState(guildId);
  clearLeaveTimer(guildId);

  if (!CONFIG.voiceTimeoutMs) return;
  if (state.current || state.queue.length > 0) return;

  const timer = setTimeout(() => {
    const latest = getState(guildId);
    const connection = latest.connection || getVoiceConnection(guildId);

    if (connection && !latest.current && latest.queue.length === 0) {
      try {
        connection.destroy();
      } catch (error) {
        console.error('[VOICE] Error destruyendo conexión por timeout:', error);
      }

      latest.connection = null;
      latest.playing = false;
      console.log(`[VOICE:${guildId}] Desconectado por inactividad.`);
    }
  }, CONFIG.voiceTimeoutMs);

  if (typeof timer.unref === 'function') timer.unref();
  state.leaveTimer = timer;
}

function wireConnection(connection, guildId) {
  if (connection.__juanvoiceWired) return;
  connection.__juanvoiceWired = true;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      const state = getState(guildId);
      try {
        connection.destroy();
      } catch (error) {
        console.error('[VOICE] Error al destruir conexión desconectada:', error);
      }
      state.connection = null;
      state.playing = false;
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    const state = getState(guildId);
    state.connection = null;
    state.playing = false;
    clearLeaveTimer(guildId);
  });

  connection.on('error', (error) => {
    console.error(`[VOICE:${guildId}]`, error);
  });
}

async function assertVoicePermissions(channel) {
  const me = channel.guild.members.me || (await channel.guild.members.fetchMe());
  const permissions = channel.permissionsFor(me);

  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    throw new UserFacingError(`No tengo permiso para **conectarme** a ${channel}.`);
  }

  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    throw new UserFacingError(`No tengo permiso para **hablar** en ${channel}.`);
  }
}

async function connectToVoiceChannel(channel) {
  if (!channel) {
    throw new UserFacingError('Debes estar dentro de un canal de voz para usar este comando.');
  }

  await assertVoicePermissions(channel);

  const guildId = channel.guild.id;
  const state = getState(guildId);
  const player = ensurePlayer(guildId);
  const existing = state.connection || getVoiceConnection(guildId);

  if (existing && existing.joinConfig?.channelId === channel.id && existing.state.status !== VoiceConnectionStatus.Destroyed) {
    state.connection = existing;
    existing.subscribe(player);
    clearLeaveTimer(guildId);
    return existing;
  }

  if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
    try {
      existing.destroy();
    } catch (error) {
      console.error('[VOICE] Error moviendo conexión:', error);
    }
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  state.connection = connection;
  wireConnection(connection, guildId);
  connection.subscribe(player);
  clearLeaveTimer(guildId);

  await entersState(connection, VoiceConnectionStatus.Ready, 30000);
  return connection;
}

async function connectToMemberVoice(member) {
  const channel = member?.voice?.channel;
  if (!channel) {
    throw new UserFacingError('Debes estar dentro de un canal de voz para que pueda entrar y leer el texto.');
  }

  return connectToVoiceChannel(channel);
}

async function disconnectGuild(guildId, clearQueue = true) {
  const state = getState(guildId);
  state.stopVersion += 1;

  if (clearQueue) state.queue = [];

  if (state.current?.filePath) {
    await cleanupTempFile(state.current.filePath);
  }

  state.current = null;
  state.playing = false;

  if (state.player) {
    try {
      state.player.stop(true);
    } catch (error) {
      console.error('[PLAYER] Error deteniendo reproductor:', error);
    }
  }

  const connection = state.connection || getVoiceConnection(guildId);
  if (connection) {
    try {
      connection.destroy();
    } catch (error) {
      console.error('[VOICE] Error saliendo del canal:', error);
    }
  }

  state.connection = null;
  clearLeaveTimer(guildId);
}

async function stopGuildAudio(guildId) {
  const state = getState(guildId);
  state.stopVersion += 1;
  state.queue = [];

  if (state.current?.filePath) {
    await cleanupTempFile(state.current.filePath);
  }

  state.current = null;
  state.playing = false;

  if (state.player) {
    state.player.stop(true);
  }

  scheduleVoiceTimeout(guildId);
}

function clearGuildQueue(guildId) {
  const state = getState(guildId);
  const amount = state.queue.length;
  state.queue = [];
  return amount;
}

async function notifyTextChannel(channelId, embed) {
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased?.()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('[NOTIFY] No se pudo enviar aviso al canal de texto:', error);
  }
}

async function enqueueSpeech({ guild, member, text, voiceKey, channel, source = 'command' }) {
  const state = getState(guild.id);
  const cleanText = sanitizeSpeechText(text);

  if (state.queue.length >= CONFIG.maxQueueSize) {
    throw new UserFacingError(`La cola está llena. Máximo configurado: **${CONFIG.maxQueueSize}** mensajes.`);
  }

  const finalVoiceKey = resolveVoiceKey(voiceKey, guild.id);
  const pendingBefore = state.queue.length + (state.current ? 1 : 0);
  const item = {
    id: crypto.randomUUID(),
    guildId: guild.id,
    channelId: channel?.id || null,
    authorId: member?.id || null,
    authorTag: member?.user?.tag || member?.user?.username || 'Usuario',
    text: cleanText,
    voiceKey: finalVoiceKey,
    voiceLabel: getVoiceLabel(finalVoiceKey),
    source,
    createdAt: Date.now(),
    filePath: null,
  };

  state.queue.push(item);
  clearLeaveTimer(guild.id);
  processQueue(guild.id).catch((error) => console.error('[QUEUE] Error al iniciar cola:', error));

  return {
    item,
    position: pendingBefore + 1,
  };
}

async function processQueue(guildId) {
  const state = getState(guildId);
  if (state.playing || state.current) return;

  const connection = state.connection || getVoiceConnection(guildId);
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    state.connection = null;
    state.playing = false;
    return;
  }

  if (state.queue.length === 0) {
    scheduleVoiceTimeout(guildId);
    return;
  }

  const item = state.queue.shift();
  const stopVersionAtStart = state.stopVersion;
  state.current = item;
  state.playing = true;
  clearLeaveTimer(guildId);

  try {
    const synthesis = await synthesizeToFile(item.text, item.voiceKey);
    item.filePath = synthesis.filePath;
    item.provider = synthesis.provider;
    item.bytes = synthesis.bytes;

    if (state.stopVersion !== stopVersionAtStart || state.current?.id !== item.id) {
      await cleanupTempFile(item.filePath);
      return;
    }

    const resource = createAudioResource(fs.createReadStream(item.filePath), {
      inputType: StreamType.Arbitrary,
      metadata: item,
    });

    const player = ensurePlayer(guildId);
    player.play(resource);

    entersState(player, AudioPlayerStatus.Playing, 8000).catch((playError) => {
      console.warn(`[PLAYER:${guildId}] El audio fue enviado, pero no se confirmó estado Playing:`, playError.message);
    });
  } catch (error) {
    console.error('[TTS] Error generando o reproduciendo TTS:', error);

    if (item.filePath) {
      await cleanupTempFile(item.filePath);
    }

    await notifyTextChannel(
      item.channelId,
      errorEmbed(`No pude leer ese texto en voz. Revisa permisos de voz, FFmpeg y logs de Railway.\n\nDetalle: \`${truncate(error.message, 180)}\``),
    );

    state.current = null;
    state.playing = false;
    processQueue(guildId).catch((queueError) => console.error('[QUEUE] Error continuando cola:', queueError));
  }
}

function queueEmbed(guildId) {
  const state = getState(guildId);
  const fields = [];

  if (state.current) {
    fields.push({
      name: '▶️ Reproduciendo ahora',
      value: `**${state.current.voiceLabel}**\n“${truncate(state.current.text, 180)}”\nPor: <@${state.current.authorId}>${state.current.provider ? `\nMotor: \`${state.current.provider}\`` : ''}`,
    });
  }

  if (state.queue.length > 0) {
    const list = state.queue
      .slice(0, 10)
      .map((item, index) => `**${index + 1}.** ${item.voiceLabel} — “${truncate(item.text, 80)}”`)
      .join('\n');

    fields.push({
      name: `📋 Pendientes (${state.queue.length})`,
      value: state.queue.length > 10 ? `${list}\n...y ${state.queue.length - 10} más.` : list,
    });
  }

  if (fields.length === 0) {
    fields.push({ name: '📭 Cola vacía', value: 'No hay mensajes TTS pendientes.' });
  }

  return infoEmbed('Cola de JUANVOICE', 'Estado actual de los mensajes por leer.', fields);
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('jv_join').setLabel('Entrar').setEmoji('🔊').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('jv_leave').setLabel('Salir').setEmoji('👋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('jv_stop').setLabel('Detener').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('jv_clear').setLabel('Limpiar cola').setEmoji('🧹').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('jv_queue').setLabel('Ver cola').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildCommands() {
  const textOption = (option) => option
    .setName('texto')
    .setDescription('Texto que JUANVOICE leerá en voz alta.')
    .setRequired(true)
    .setMaxLength(Math.min(CONFIG.maxTextLength, 2000));

  const voiceOption = (option) => option
    .setName('voz')
    .setDescription('Voz opcional para este mensaje.')
    .setRequired(false)
    .addChoices(...VOICE_CHOICES);

  return [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('JUANVOICE entra al canal de voz donde estás.'),

    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('JUANVOICE sale del canal de voz.'),

    new SlashCommandBuilder()
      .setName('decir')
      .setDescription('Lee un texto en voz alta con una voz opcional.')
      .addStringOption(textOption)
      .addStringOption(voiceOption),

    new SlashCommandBuilder()
      .setName('hablar')
      .setDescription('Lee un texto en voz alta usando la voz predeterminada.')
      .addStringOption(textOption),

    new SlashCommandBuilder()
      .setName('voces')
      .setDescription('Muestra las voces disponibles.'),

    new SlashCommandBuilder()
      .setName('setvoz')
      .setDescription('Configura la voz predeterminada del servidor.')
      .addStringOption((option) => option
        .setName('voz')
        .setDescription('Nueva voz predeterminada.')
        .setRequired(true)
        .addChoices(...VOICE_CHOICES)),

    new SlashCommandBuilder()
      .setName('autotts')
      .setDescription('Configura el modo automático de texto a voz.')
      .addSubcommand((subcommand) => subcommand
        .setName('canal')
        .setDescription('Activa AutoTTS en un canal de texto.')
        .addChannelOption((option) => option
          .setName('canal')
          .setDescription('Canal de texto que JUANVOICE leerá automáticamente.')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((subcommand) => subcommand
        .setName('off')
        .setDescription('Desactiva el modo automático.')),

    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Detiene el audio actual y limpia la cola.'),

    new SlashCommandBuilder()
      .setName('cola')
      .setDescription('Muestra la cola de mensajes TTS pendientes.'),

    new SlashCommandBuilder()
      .setName('limpiarcola')
      .setDescription('Vacía la cola de mensajes TTS pendientes.'),

    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Muestra un panel bonito con botones de control.'),

    new SlashCommandBuilder()
      .setName('diagnostico')
      .setDescription('Muestra el estado técnico de JUANVOICE.'),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Muestra todos los comandos disponibles.'),
  ];
}

async function registerSlashCommands() {
  if (!CONFIG.guildId) {
    console.warn('[COMMANDS] Falta GUILD_ID. No se registraron comandos slash.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(CONFIG.token);
  const commands = buildCommands().map((command) => command.toJSON());

  await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.guildId), { body: commands });
  console.log(`[COMMANDS] ${commands.length} comandos slash registrados en guild ${CONFIG.guildId}.`);
}

async function getInteractionMember(interaction) {
  if (interaction.member?.voice) return interaction.member;
  return interaction.guild.members.fetch(interaction.user.id);
}

async function replyInteraction(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }

  return interaction.reply(payload);
}

async function replyError(interaction, message) {
  const payload = { embeds: [errorEmbed(message)], ephemeral: true };

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => interaction.editReply({ embeds: [errorEmbed(message)] }).catch(console.error));
  }

  return interaction.reply(payload).catch(console.error);
}

async function handleJoin(interaction) {
  const member = await getInteractionMember(interaction);
  await connectToMemberVoice(member);
  await interaction.reply({
    embeds: [successEmbed('Conectado', `Entré a ${member.voice.channel} y estoy listo para leer mensajes.`)],
  });
}

async function handleLeave(interaction) {
  const state = getState(interaction.guildId);
  const connection = state.connection || getVoiceConnection(interaction.guildId);

  if (!connection) {
    throw new UserFacingError('No estoy conectado a ningún canal de voz.');
  }

  await disconnectGuild(interaction.guildId, true);
  await interaction.reply({ embeds: [successEmbed('Desconectado', 'Salí del canal de voz y limpié la cola.')] });
}

async function handleSay(interaction, useVoiceOption) {
  await interaction.deferReply();

  const member = await getInteractionMember(interaction);
  await connectToMemberVoice(member);

  const text = interaction.options.getString('texto', true);
  const voice = useVoiceOption ? interaction.options.getString('voz', false) : null;
  const { item } = await enqueueSpeech({
    guild: interaction.guild,
    member,
    channel: interaction.channel,
    text,
    voiceKey: voice,
    source: interaction.commandName,
  });

  const state = getState(interaction.guildId);
  const isNowPlaying = state.current?.id === item.id;
  const indexInQueue = state.queue.findIndex((queued) => queued.id === item.id);
  const status = isNowPlaying ? 'Reproduciendo ahora' : `Posición en cola: **${indexInQueue + 1}**`;

  await interaction.editReply({
    embeds: [successEmbed('Texto agregado', `${status}\n**Voz:** ${item.voiceLabel}\n**Texto:** “${truncate(item.text, 180)}”`)],
  });
}

async function handleVoices(interaction) {
  const fields = Object.entries(VOICES).map(([key, voice]) => ({
    name: `${voice.emoji} ${voice.label}`,
    value: `Valor: \`${key}\`\nMotor: \`${voice.shortName}\``,
    inline: true,
  }));

  await interaction.reply({
    embeds: [infoEmbed('Voces disponibles', 'Puedes usarlas en `/decir texto voz` o configurarlas con `/setvoz voz`.', fields)],
    ephemeral: true,
  });
}

async function handleSetVoice(interaction) {
  const voice = interaction.options.getString('voz', true);

  if (!VOICES[voice]) {
    throw new UserFacingError('Esa voz no existe. Usa `/voces` para ver las opciones disponibles.');
  }

  const state = getState(interaction.guildId);
  state.defaultVoice = voice;
  persistGuildState(interaction.guildId);

  await interaction.reply({
    embeds: [successEmbed('Voz configurada', `La voz predeterminada del servidor ahora es **${getVoiceLabel(voice)}**.`)],
  });
}

async function handleAutoTTS(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const state = getState(interaction.guildId);

  if (subcommand === 'off') {
    state.autoTtsEnabled = false;
    state.autoTtsChannelId = null;
    persistGuildState(interaction.guildId);

    await interaction.reply({ embeds: [successEmbed('AutoTTS desactivado', 'Ya no leeré automáticamente mensajes de canales de texto.')] });
    return;
  }

  const channel = interaction.options.getChannel('canal', true);
  state.autoTtsEnabled = true;
  state.autoTtsChannelId = channel.id;
  persistGuildState(interaction.guildId);

  await interaction.reply({
    embeds: [successEmbed('AutoTTS activado', `Leeré automáticamente los mensajes escritos en ${channel}.\nPara apagarlo usa **/autotts off**.`)],
  });
}

async function handleStop(interaction) {
  await stopGuildAudio(interaction.guildId);
  await interaction.reply({ embeds: [successEmbed('Audio detenido', 'Detuve el audio actual y limpié toda la cola.')] });
}

async function handleQueue(interaction) {
  await interaction.reply({ embeds: [queueEmbed(interaction.guildId)], ephemeral: true });
}

async function handleClearQueue(interaction) {
  const amount = clearGuildQueue(interaction.guildId);
  await interaction.reply({ embeds: [successEmbed('Cola limpiada', `Se eliminaron **${amount}** mensajes pendientes. El audio actual no se detuvo.`)] });
}

async function handlePanel(interaction) {
  const embed = infoEmbed(
    'Panel de control',
    'Usa los botones para controlar JUANVOICE de forma rápida.\n\n🔊 **Entrar** · 👋 **Salir** · ⏹️ **Detener** · 🧹 **Limpiar cola** · 📋 **Ver cola**',
  );

  await interaction.reply({ embeds: [embed], components: panelComponents() });
}

function detectFfmpeg() {
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    return `ffmpeg-static: ${ffmpegStatic}`;
  }

  try {
    const result = childProcess.spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    if (result.status === 0) {
      const firstLine = String(result.stdout || '').split('\n')[0] || 'ffmpeg en PATH';
      return firstLine;
    }
  } catch {
    // Ignorar. El diagnóstico devolverá no detectado.
  }

  return 'No detectado';
}

function getDependencyReportShort() {
  try {
    return generateDependencyReport()
      .split('\n')
      .filter((line) => /@discordjs\/voice|prism-media|opusscript|FFmpeg|libopus|Encryption|sodium|tweetnacl|not found|found|version/i.test(line))
      .slice(0, 18)
      .join('\n')
      .trim();
  } catch (error) {
    return `No se pudo generar reporte: ${error.message}`;
  }
}

async function handleDiagnostic(interaction) {
  const state = getState(interaction.guildId);
  const connection = state.connection || getVoiceConnection(interaction.guildId);
  const channelId = connection?.joinConfig?.channelId;
  const voiceChannel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
  const ffmpegStatus = detectFfmpeg();

  const fields = [
    { name: '🔌 Voz', value: connection ? `Conectado (${connection.state.status})` : 'No conectado', inline: true },
    { name: '📍 Canal actual', value: voiceChannel ? `${voiceChannel}` : 'Ninguno', inline: true },
    { name: '📋 Cola', value: `${state.queue.length} pendiente(s)`, inline: true },
    { name: '🎙️ Voz actual', value: getVoiceLabel(state.defaultVoice), inline: true },
    { name: '🟢 Node.js', value: process.version, inline: true },
    { name: '🎛️ FFmpeg', value: truncate(ffmpegStatus, 100), inline: true },
    { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
    { name: '⏱️ Uptime', value: formatDuration(process.uptime() * 1000), inline: true },
    { name: '🤖 AutoTTS', value: state.autoTtsEnabled && state.autoTtsChannelId ? `<#${state.autoTtsChannelId}>` : 'Desactivado', inline: true },
    { name: '🗣️ Motor TTS', value: `\`${CONFIG.ttsProvider}\``, inline: true },
    { name: '🧪 Dependencias voz', value: `\`\`\`txt\n${truncate(getDependencyReportShort(), 900)}\n\`\`\``, inline: false },
  ];

  await interaction.reply({ embeds: [infoEmbed('Diagnóstico de JUANVOICE', 'Estado actual del bot y del sistema.', fields)], ephemeral: true });
}

async function handleHelp(interaction) {
  const fields = [
    { name: '🔊 Voz', value: '`/join` entra al canal.\n`/leave` sale del canal.\n`/stop` detiene audio y limpia cola.', inline: false },
    { name: '💬 Texto a voz', value: '`/decir texto voz` lee con voz opcional.\n`/hablar texto` lee con la voz predeterminada.\n`/voces` muestra voces.\n`/setvoz voz` define la voz del servidor.', inline: false },
    { name: '⚙️ AutoTTS y cola', value: '`/autotts canal` activa lectura automática.\n`/autotts off` desactiva AutoTTS.\n`/cola` muestra pendientes.\n`/limpiarcola` vacía la cola.', inline: false },
    { name: '🧩 Panel y estado', value: '`/panel` muestra botones.\n`/diagnostico` revisa conexión, FFmpeg, ping y uptime.', inline: false },
  ];

  await interaction.reply({
    embeds: [infoEmbed('Ayuda de JUANVOICE', 'Bot TTS profesional para Discord Voice. Sin música, sin YouTube, sin yt-dlp y sin cookies.', fields)],
    ephemeral: true,
  });
}

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id === 'jv_join') {
    const member = await getInteractionMember(interaction);
    await connectToMemberVoice(member);
    await interaction.reply({ embeds: [successEmbed('Conectado', `Entré a ${member.voice.channel}.`)], ephemeral: true });
    return;
  }

  if (id === 'jv_leave') {
    const state = getState(interaction.guildId);
    const connection = state.connection || getVoiceConnection(interaction.guildId);
    if (!connection) throw new UserFacingError('No estoy conectado a ningún canal de voz.');
    await disconnectGuild(interaction.guildId, true);
    await interaction.reply({ embeds: [successEmbed('Desconectado', 'Salí del canal de voz y limpié la cola.')], ephemeral: true });
    return;
  }

  if (id === 'jv_stop') {
    await stopGuildAudio(interaction.guildId);
    await interaction.reply({ embeds: [successEmbed('Detenido', 'Audio detenido y cola limpiada.')], ephemeral: true });
    return;
  }

  if (id === 'jv_clear') {
    const amount = clearGuildQueue(interaction.guildId);
    await interaction.reply({ embeds: [successEmbed('Cola limpiada', `Se eliminaron **${amount}** mensajes pendientes.`)], ephemeral: true });
    return;
  }

  if (id === 'jv_queue') {
    await interaction.reply({ embeds: [queueEmbed(interaction.guildId)], ephemeral: true });
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`[READY] ${client.user.tag} listo.`);
  client.user.setActivity('Leyendo mensajes | JUANVOICE', { type: ActivityType.Listening });

  try {
    await cleanupOldTempFiles();
    await registerSlashCommands();
  } catch (error) {
    console.error('[READY] Error en inicialización:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.inGuild()) return;

  try {
    checkCooldown(interaction.user.id);

    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'join':
          await handleJoin(interaction);
          break;
        case 'leave':
          await handleLeave(interaction);
          break;
        case 'decir':
          await handleSay(interaction, true);
          break;
        case 'hablar':
          await handleSay(interaction, false);
          break;
        case 'voces':
          await handleVoices(interaction);
          break;
        case 'setvoz':
          await handleSetVoice(interaction);
          break;
        case 'autotts':
          await handleAutoTTS(interaction);
          break;
        case 'stop':
          await handleStop(interaction);
          break;
        case 'cola':
          await handleQueue(interaction);
          break;
        case 'limpiarcola':
          await handleClearQueue(interaction);
          break;
        case 'panel':
          await handlePanel(interaction);
          break;
        case 'diagnostico':
          await handleDiagnostic(interaction);
          break;
        case 'help':
          await handleHelp(interaction);
          break;
        default:
          await replyError(interaction, 'Comando no reconocido. Usa `/help`.');
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('jv_')) {
      await handleButton(interaction);
    }
  } catch (error) {
    if (error instanceof UserFacingError) {
      await replyError(interaction, error.message);
      return;
    }

    console.error('[INTERACTION] Error inesperado:', error);
    await replyError(interaction, 'Ocurrió un error inesperado, pero el bot sigue funcionando. Revisa los logs si eres el dueño.');
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.inGuild() || message.author.bot) return;

    const state = getState(message.guildId);
    if (!state.autoTtsEnabled || !state.autoTtsChannelId || message.channelId !== state.autoTtsChannelId) return;

    const member = message.member || (await message.guild.members.fetch(message.author.id));
    if (!member?.voice?.channel) return;

    const connection = state.connection || getVoiceConnection(message.guildId);
    if (!connection) {
      await connectToMemberVoice(member);
    } else if (connection.joinConfig?.channelId !== member.voice.channel.id) {
      return;
    }

    checkCooldown(message.author.id);

    await enqueueSpeech({
      guild: message.guild,
      member,
      channel: message.channel,
      text: message.content,
      voiceKey: null,
      source: 'autotts',
    });
  } catch (error) {
    if (error instanceof UserFacingError) return;
    console.error('[AUTOTTS] Error:', error);
  }
});

setInterval(cleanCooldowns, 60000).unref();

function startHealthServer() {
  const server = http.createServer((req, res) => {
    const isHealth = req.url === '/' || req.url === '/health';

    if (!isHealth) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
      return;
    }

    const body = {
      ok: true,
      bot: BOT_NAME,
      ready: client.isReady(),
      uptime: Math.floor(process.uptime()),
      guilds: client.guilds.cache.size,
      ping: client.ws.ping,
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  });

  server.listen(CONFIG.port, '0.0.0.0', () => {
    console.log(`[HEALTH] Servidor health escuchando en puerto ${CONFIG.port}.`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Promesa rechazada sin manejar:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[PROCESS] Excepción no capturada:', error);
});

async function shutdown(signal) {
  console.log(`[SHUTDOWN] Recibido ${signal}. Cerrando JUANVOICE...`);

  for (const guildId of guildStates.keys()) {
    await disconnectGuild(guildId, true).catch(console.error);
  }

  await cleanupOldTempFiles().catch(console.error);
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
  if (!CONFIG.token) {
    console.error('[ENV] Falta DISCORD_TOKEN. Configura las variables de entorno antes de iniciar.');
    process.exit(1);
  }

  if (!CONFIG.guildId) {
    console.warn('[ENV] Falta GUILD_ID. El bot iniciará, pero no podrá registrar comandos slash del servidor automáticamente.');
  }

  startHealthServer();
  await client.login(CONFIG.token);
}

main().catch((error) => {
  console.error('[MAIN] Error fatal al iniciar:', error);
  process.exit(1);
});
