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
    if (process.env[key] && String(process.env[key]).trim() !== '') return String(process.env[key]).trim();
    if (localConfig[key] && String(localConfig[key]).trim() !== '') return String(localConfig[key]).trim();
  }
  return '';
}

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).toLowerCase());
}

function asNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const localConfig = readLocalConfig();

export const config = {
  token: getValue(localConfig, 'DISCORD_TOKEN', 'TOKEN'),
  clientId: getValue(localConfig, 'CLIENT_ID', 'DISCORD_CLIENT_ID'),
  guildId: getValue(localConfig, 'GUILD_ID', 'DISCORD_GUILD_ID'),
  prefix: getValue(localConfig, 'PREFIX') || '!',
  enablePrefixCommands: asBoolean(getValue(localConfig, 'ENABLE_PREFIX_COMMANDS'), false),
  maxPlaylistSongs: asNumber(getValue(localConfig, 'MAX_PLAYLIST_SONGS'), 20),
  staySeconds: asNumber(getValue(localConfig, 'STAY_SECONDS'), 90),
  voiceTimeoutMs: asNumber(getValue(localConfig, 'VOICE_TIMEOUT_MS'), 60_000),
  youtubeCookie: getValue(localConfig, 'YOUTUBE_COOKIE')
};

export function requireToken() {
  if (!config.token) {
    throw new Error(
      'Falta configurar DISCORD_TOKEN. En Railway ve a Variables y agrega DISCORD_TOKEN con el token de tu bot.'
    );
  }
}

export function getYtdlRequestOptions() {
  if (!config.youtubeCookie) return {};
  return {
    requestOptions: {
      headers: {
        cookie: config.youtubeCookie
      }
    }
  };
}
