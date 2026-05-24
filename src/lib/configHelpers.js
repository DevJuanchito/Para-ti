const GuildConfig = require('../models/GuildConfig');

async function getOrCreateGuildConfig(guildId) {
  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = await GuildConfig.create({ guildId });
  }
  return config;
}

function formatConfigLine(name, data) {
  const estado = data.enabled ? '✅ Activado' : '❌ Desactivado';
  const canal = data.channelId ? `<#${data.channelId}>` : 'Sin canal';
  return `**${name}:** ${estado}\nCanal: ${canal}\nColor: \`${data.color || '#ff77dd'}\``;
}

module.exports = { getOrCreateGuildConfig, formatConfigLine };
