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
    if (process.env[key] && String(process.env[key]).trim() !== '') return process.env[key];
    if (localConfig[key] && String(localConfig[key]).trim() !== '') return localConfig[key];
  }
  return '';
}

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).toLowerCase());
}

const localConfig = readLocalConfig();

export const config = {
  token: getValue(localConfig, 'DISCORD_TOKEN', 'TOKEN'),
  clientId: getValue(localConfig, 'CLIENT_ID', 'DISCORD_CLIENT_ID'),
  guildId: getValue(localConfig, 'GUILD_ID', 'DISCORD_GUILD_ID'),
  prefix: getValue(localConfig, 'PREFIX') || '!',
  enablePrefixCommands: asBoolean(getValue(localConfig, 'ENABLE_PREFIX_COMMANDS'), false),
  maxPlaylistSongs: Number(getValue(localConfig, 'MAX_PLAYLIST_SONGS')) || 25,
  staySeconds: Number(getValue(localConfig, 'STAY_SECONDS')) || 60
};

export function requireToken() {
  if (!config.token) {
    throw new Error(
      'Falta configurar DISCORD_TOKEN. En Railway ve a Variables y agrega DISCORD_TOKEN con el token de tu bot.'
    );
  }
}
