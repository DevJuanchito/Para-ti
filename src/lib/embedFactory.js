const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { replacePlaceholders } = require('./placeholders');

const DEFAULTS = {
  welcome: {
    title: '🌸・Bienvenid@ a {server}',
    description:
      '꒰ঌ Hola {user} ໒꒱\n\n' +
      '✨ Esperamos que disfrutes el servidor.\n' +
      '💫 Ahora somos **{memberCount}** miembros.\n\n' +
      '╰┈➤ Lee las reglas y pásala increíble.',
    footer: 'Entrada registrada con estilo ✦'
  },
  farewell: {
    title: '🌙・Alguien salió de {server}',
    description:
      '꒰ঌ {user.username} se ha ido del servidor ໒꒱\n\n' +
      '🕊️ Gracias por haber formado parte de la comunidad.\n' +
      '💫 Ahora quedamos **{memberCount}** miembros.',
    footer: 'Salida registrada ✦'
  }
};

function applyOptionalMedia(embed, config) {
  if (config.image) embed.setImage(config.image);
  if (config.thumbnail) embed.setThumbnail(config.thumbnail);
  if (config.footer) embed.setFooter({ text: config.footer });
  return embed;
}

function buildMemberEmbed(type, config, member) {
  const fallback = DEFAULTS[type];
  const title = replacePlaceholders(config.title || fallback.title, member);
  const description = replacePlaceholders(config.description || fallback.description, member);
  const footer = replacePlaceholders(config.footer || fallback.footer, member);

  const embed = new EmbedBuilder()
    .setColor(config.color || '#ff77dd')
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(config.thumbnail || member.user.displayAvatarURL({ size: 512 }))
    .setFooter({ text: footer })
    .setTimestamp();

  if (config.image) embed.setImage(config.image);
  return embed;
}

function buildCustomEmbed({ title, description, color, image, thumbnail, footer, authorName, authorIcon }) {
  const embed = new EmbedBuilder()
    .setColor(color || '#ff77dd')
    .setDescription(description)
    .setTimestamp();

  if (title) embed.setTitle(title);
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (footer) embed.setFooter({ text: footer });
  if (authorName) embed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });

  return embed;
}

function buildLinkButton(label, url) {
  if (!label || !url) return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(label)
        .setURL(url)
        .setStyle(ButtonStyle.Link)
        .setEmoji('✨')
    )
  ];
}

module.exports = {
  buildMemberEmbed,
  buildCustomEmbed,
  buildLinkButton,
  applyOptionalMedia
};
