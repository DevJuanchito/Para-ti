import { existsSync, readFileSync } from 'node:fs';

function readLocalConfig() {
  const path = './config.json';

  if (!existsSync(path)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error('No se pudo leer config.json. Revisa que el JSON este bien escrito.');
    console.error(error);
    return {};
  }
}

const localConfig = readLocalConfig();

export const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || localConfig.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID || localConfig.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID || localConfig.GUILD_ID
};

export function requireConfig(key) {
  const value = config[key];

  if (!value || String(value).includes('PEGA_AQUI')) {
    throw new Error(`Falta configurar ${key}. Usa variables del hosting o crea config.json desde config.example.json.`);
  }

  return value;
}
