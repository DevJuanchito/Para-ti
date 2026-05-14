import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');

function readLocalConfig() {
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.warn('[JUANPLAY] config.json existe, pero no se pudo leer:', error.message);
    return {};
  }
}

function getValue(localConfig, ...keys) {
  for (const key of keys) {
    const envValue = process.env[key];
    if (envValue !== undefined && String(envValue).trim() !== '') return String(envValue).trim();

    const localValue = localConfig[key];
    if (localValue !== undefined && String(localValue).trim() !== '') return String(localValue).trim();
  }
  return '';
}

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).toLowerCase());
}

function asNumber(value, defaultValue, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

const localConfig = readLocalConfig();

export const config = {
  token: getValue(localConfig, 'DISCORD_TOKEN', 'TOKEN'),
  clientId: getValue(localConfig, 'CLIENT_ID', 'DISCORD_CLIENT_ID'),
  guildId: getValue(localConfig, 'GUILD_ID', 'DISCORD_GUILD_ID'),
  prefix: getValue(localConfig, 'PREFIX') || '!',
  enablePrefixCommands: asBoolean(getValue(localConfig, 'ENABLE_PREFIX_COMMANDS'), false),
  maxPlaylistSongs: asNumber(getValue(localConfig, 'MAX_PLAYLIST_SONGS'), 25, 1, 100),
  staySeconds: asNumber(getValue(localConfig, 'STAY_SECONDS'), 120, 10, 900),
  voiceTimeoutMs: asNumber(getValue(localConfig, 'VOICE_TIMEOUT_MS'), 60_000, 10_000, 180_000),
  defaultVolume: asNumber(getValue(localConfig, 'DEFAULT_VOLUME'), 85, 1, 150),
  youtubeCookie: getValue(localConfig, 'YOUTUBE_COOKIE', 'YOUTUBE_COOKIES'),
  youtubeUserAgent:
    getValue(localConfig, 'YOUTUBE_USER_AGENT') ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
};

export function requireToken() {
  if (!config.token) {
    throw new Error(
      'Falta configurar DISCORD_TOKEN. En Railway ve a Variables y agrega DISCORD_TOKEN con el token de tu bot.'
    );
  }
}

export function getYtdlRequestOptions() {
  const headers = {
    'User-Agent': config.youtubeUserAgent,
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept': '*/*'
  };

  if (config.youtubeCookie) headers.cookie = config.youtubeCookie;

  return {
    requestOptions: { headers }
  };
}
