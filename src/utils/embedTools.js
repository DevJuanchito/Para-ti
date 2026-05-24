const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const COLOR_NAMES = {
  azul: 0x5865F2,
  morado: 0x9B59B6,
  rosa: 0xE91E63,
  rojo: 0xED4245,
  naranja: 0xF97316,
  amarillo: 0xFEE75C,
  verde: 0x57F287,
  aqua: 0x1ABC9C,
  negro: 0x2B2D31,
  blanco: 0xFFFFFF,
  gris: 0x95A5A6,
  dorado: 0xF1C40F,
  premium: 0xFF73FA,
  discord: 0x5865F2
};

function parseColor(input, fallback = 0x5865F2) {
  if (!input) return fallback;
  const raw = String(input).trim().toLowerCase();
  if (COLOR_NAMES[raw] !== undefined) return COLOR_NAMES[raw];

  const normalized = raw.replace('#', '').replace('0x', '');
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return Number.parseInt(normalized, 16);
  }

  return fallback;
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function replacePlaceholders(text, interaction) {
  if (!text) return text;

  return String(text)
    .replaceAll('{user}', `${interaction.user}`)
    .replaceAll('{username}', interaction.user.username)
    .replaceAll('{server}', interaction.guild?.name ?? 'Servidor')
    .replaceAll('{memberCount}', String(interaction.guild?.memberCount ?? 0))
    .replaceAll('{channel}', `${interaction.channel}`);
}

function safeString(value, maxLength) {
  if (!value) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function validateMessageTarget(channel) {
  if (!channel || !channel.isTextBased()) {
    return 'Ese canal no puede recibir mensajes de texto.';
  }
  return null;
}

function getBotPermissionError(channel, clientUser) {
  const permissions = channel.permissionsFor?.(clientUser);
  if (!permissions) return null;

  const missing = [];
  if (!permissions.has(PermissionFlagsBits.SendMessages)) missing.push('Enviar mensajes');
  if (!permissions.has(PermissionFlagsBits.EmbedLinks)) missing.push('Insertar enlaces/embeds');
  if (channel.isThread?.() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads)) {
    missing.push('Enviar mensajes en hilos');
  }

  return missing.length ? `Me faltan permisos en ${channel}: ${missing.join(', ')}.` : null;
}

function makeLinkButton(label, url) {
  if (!label || !url || !isHttpUrl(url)) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(safeString(label, 80))
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

function makePreviewButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_send:${sessionId}`)
      .setEmoji('📨')
      .setLabel('Enviar embed')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed_cancel:${sessionId}`)
      .setEmoji('🗑️')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );
}

function totalEmbedCharacters(embeds) {
  return embeds.reduce((total, embed) => {
    const data = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
    let count = 0;
    count += data.title?.length ?? 0;
    count += data.description?.length ?? 0;
    count += data.footer?.text?.length ?? 0;
    count += data.author?.name?.length ?? 0;
    if (Array.isArray(data.fields)) {
      for (const field of data.fields) {
        count += field.name?.length ?? 0;
        count += field.value?.length ?? 0;
      }
    }
    return total + count;
  }, 0);
}

function ensureEmbedLimits(embeds) {
  if (!Array.isArray(embeds) || embeds.length === 0) return 'Debes enviar al menos un embed.';
  if (embeds.length > 10) return 'Discord permite máximo 10 embeds por mensaje.';
  if (totalEmbedCharacters(embeds) > 6000) {
    return 'Tus embeds superan el límite combinado de 6000 caracteres de Discord.';
  }
  return null;
}

function createEmbedFromOptions(interaction, defaults = {}) {
  const title = interaction.options.getString('titulo') ?? defaults.title;
  const description = interaction.options.getString('descripcion') ?? defaults.description;
  const color = interaction.options.getString('color') ?? defaults.color;
  const image = interaction.options.getString('imagen') ?? defaults.image;
  const thumbnail = interaction.options.getString('thumbnail') ?? defaults.thumbnail;
  const footer = interaction.options.getString('footer') ?? defaults.footer;
  const author = interaction.options.getString('autor') ?? defaults.author;
  const url = interaction.options.getString('url') ?? defaults.url;
  const timestamp = interaction.options.getBoolean('timestamp') ?? defaults.timestamp ?? false;

  const embed = new EmbedBuilder()
    .setColor(parseColor(color, defaults.colorNumber ?? 0x5865F2));

  if (title) embed.setTitle(safeString(replacePlaceholders(title, interaction), 256));
  if (description) embed.setDescription(safeString(replacePlaceholders(description, interaction), 4096));
  if (footer) embed.setFooter({ text: safeString(replacePlaceholders(footer, interaction), 2048) });
  if (author) embed.setAuthor({ name: safeString(replacePlaceholders(author, interaction), 256) });
  if (url && isHttpUrl(url)) embed.setURL(url);
  if (image && isHttpUrl(image)) embed.setImage(image);
  if (thumbnail && isHttpUrl(thumbnail)) embed.setThumbnail(thumbnail);
  if (timestamp) embed.setTimestamp();

  return embed;
}

function getTemplateData(templateName, interaction) {
  const serverName = interaction.guild?.name ?? 'Servidor';
  const templates = {
    anuncio: {
      title: '📢・ANUNCIO OFICIAL',
      description: '✨ **Tenemos novedades para la comunidad.**\n\nEscribe aquí tu anuncio principal y decóralo con emojis, links o menciones.\n\n> Gracias por estar en **{server}**.',
      color: 'discord',
      footer: `${serverName} • Sistema de anuncios`,
      timestamp: true
    },
    reglas: {
      title: '📜・REGLAS DEL SERVIDOR',
      description: '✅ Respeta a todos.\n✅ No spam ni flood.\n✅ No contenido ofensivo.\n✅ Usa cada canal correctamente.\n\n> Mantengamos **{server}** limpio y divertido.',
      color: 'dorado',
      footer: `${serverName} • Normas de convivencia`,
      timestamp: true
    },
    update: {
      title: '🛠️・NUEVA ACTUALIZACIÓN',
      description: '🚀 **Cambios nuevos:**\n\n• Mejora 1\n• Mejora 2\n• Corrección 3\n\n💜 Gracias por apoyar el proyecto.',
      color: 'morado',
      footer: `${serverName} • Changelog`,
      timestamp: true
    },
    evento: {
      title: '🎉・EVENTO ESPECIAL',
      description: '🔥 **Se viene un evento para toda la comunidad.**\n\n📅 Fecha: por definir\n⏰ Hora: por definir\n🎁 Premios: sorpresa\n\nReacciona o entra al canal indicado para participar.',
      color: 'premium',
      footer: `${serverName} • Eventos`,
      timestamp: true
    },
    sorteo: {
      title: '🎁・SORTEO ACTIVO',
      description: 'Participa en este sorteo especial.\n\n🏆 **Premio:** por definir\n⏳ **Finaliza:** pronto\n📌 **Requisito:** estar en el servidor\n\n¡Mucha suerte!',
      color: 'verde',
      footer: `${serverName} • Sorteos`,
      timestamp: true
    },
    staff: {
      title: '🛡️・AVISO DEL STAFF',
      description: 'El equipo de staff informa:\n\n> Escribe aquí el aviso importante para la comunidad.\n\nGracias por colaborar y respetar las indicaciones.',
      color: 'rojo',
      footer: `${serverName} • Staff Team`,
      timestamp: true
    },
    tienda: {
      title: '🛒・TIENDA / SERVICIOS',
      description: '✨ **Productos disponibles:**\n\n• Producto 1 — precio\n• Producto 2 — precio\n• Producto 3 — precio\n\nAbre ticket o usa el botón para más información.',
      color: 'aqua',
      footer: `${serverName} • Tienda`,
      timestamp: true
    },
    mantenimiento: {
      title: '⚠️・MANTENIMIENTO',
      description: 'Estamos realizando mantenimiento.\n\n🔧 **Estado:** en progreso\n⏰ **Duración estimada:** por definir\n\nAvisaremos cuando todo vuelva a la normalidad.',
      color: 'naranja',
      footer: `${serverName} • Estado del servicio`,
      timestamp: true
    }
  };

  return templates[templateName] ?? templates.anuncio;
}

function buildMessagePayload({ interaction, embedOrEmbeds, content, role, buttonLabel, buttonUrl }) {
  const embeds = Array.isArray(embedOrEmbeds) ? embedOrEmbeds : [embedOrEmbeds];
  const components = [];
  const buttonRow = makeLinkButton(buttonLabel, buttonUrl);
  if (buttonRow) components.push(buttonRow);

  const mention = role ? `<@&${role.id}>` : '';
  const cleanContent = safeString(replacePlaceholders(content, interaction), 2000) ?? '';
  const finalContent = [mention, cleanContent].filter(Boolean).join('\n');

  return {
    content: finalContent || undefined,
    embeds,
    components,
    allowedMentions: role ? { roles: [role.id], users: [], parse: [] } : { parse: [] }
  };
}

function createHelpEmbed(brand = 'Embed Studio') {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`✨ ${brand} — Panel de Embeds`)
    .setDescription('Crea mensajes bonitos para anuncios, reglas, eventos, updates, sorteos y más. Todo funciona en el canal actual o en el canal que elijas.')
    .addFields(
      {
        name: '🧩 Comandos principales',
        value: '`/embed crear` crea un embed personalizado.\n`/embed plantilla` usa diseños ya decorados.\n`/embed editar` edita un mensaje embed enviado por el bot.\n`/embed json` envía embeds avanzados desde JSON.'
      },
      {
        name: '🎨 Colores rápidos',
        value: '`azul`, `morado`, `rosa`, `rojo`, `naranja`, `amarillo`, `verde`, `aqua`, `negro`, `blanco`, `dorado`, `premium` o HEX como `#5865F2`.'
      },
      {
        name: '✨ Placeholders',
        value: '`{user}` menciona al usuario.\n`{username}` nombre del usuario.\n`{server}` nombre del servidor.\n`{memberCount}` miembros.\n`{channel}` canal actual.'
      },
      {
        name: '🖼️ Animaciones',
        value: 'Pon una URL `.gif` en `imagen` o `thumbnail` para darle movimiento al embed.'
      }
    )
    .setFooter({ text: 'Tip: si no eliges canal, se envía en el canal donde usaste el comando.' })
    .setTimestamp();
}

module.exports = {
  parseColor,
  isHttpUrl,
  replacePlaceholders,
  safeString,
  validateMessageTarget,
  getBotPermissionError,
  makeLinkButton,
  makePreviewButtons,
  ensureEmbedLimits,
  createEmbedFromOptions,
  getTemplateData,
  buildMessagePayload,
  createHelpEmbed
};
