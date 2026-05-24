const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
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

const TEMPLATE_CHOICES = [
  { label: '📢 Anuncio', value: 'anuncio', description: 'Mensaje oficial para tu comunidad' },
  { label: '📜 Reglas', value: 'reglas', description: 'Reglas decoradas del servidor' },
  { label: '🛠️ Update', value: 'update', description: 'Cambios, parches o novedades' },
  { label: '🎉 Evento', value: 'evento', description: 'Evento especial con fecha y premios' },
  { label: '🎁 Sorteo', value: 'sorteo', description: 'Sorteo bonito y llamativo' },
  { label: '🛡️ Staff', value: 'staff', description: 'Aviso serio del equipo staff' },
  { label: '🛒 Tienda', value: 'tienda', description: 'Servicios, productos o ventas' },
  { label: '⚠️ Mantenimiento', value: 'mantenimiento', description: 'Estado, pausas o mantenimiento' },
  { label: '💎 Premium', value: 'premium_card', description: 'Diseño elegante para anuncio importante' },
  { label: '🌈 Neon', value: 'neon', description: 'Estilo colorido y llamativo' }
];

function parseColor(input, fallback = 0x5865F2) {
  if (typeof input === 'number' && Number.isInteger(input)) return input;
  if (!input) return fallback;
  const raw = String(input).trim().toLowerCase();
  if (COLOR_NAMES[raw] !== undefined) return COLOR_NAMES[raw];

  const normalized = raw.replace('#', '').replace('0x', '');
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return Number.parseInt(normalized, 16);
  }

  return fallback;
}

function colorToHex(value) {
  const num = parseColor(value, 0x5865F2);
  return `#${num.toString(16).padStart(6, '0').toUpperCase()}`;
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
  if (value === null || value === undefined) return undefined;
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
  if (!permissions.has(PermissionFlagsBits.ViewChannel)) missing.push('Ver canal');
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
      .setCustomId(`embed:send:${sessionId}`)
      .setEmoji('📨')
      .setLabel('Enviar embed')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed:cancel:${sessionId}`)
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

function normalizeEmbedJson(data = {}) {
  const normalized = { ...data };
  if (typeof normalized.color === 'string') normalized.color = parseColor(normalized.color);
  if (typeof normalized.footer === 'string') normalized.footer = { text: normalized.footer };
  if (typeof normalized.author === 'string') normalized.author = { name: normalized.author };
  if (typeof normalized.image === 'string') normalized.image = { url: normalized.image };
  if (typeof normalized.thumbnail === 'string') normalized.thumbnail = { url: normalized.thumbnail };
  return normalized;
}

function localizeEmbedJson(data, interaction) {
  const input = normalizeEmbedJson(data);
  const output = { ...input };

  if (output.title) output.title = safeString(replacePlaceholders(output.title, interaction), 256);
  if (output.description) output.description = safeString(replacePlaceholders(output.description, interaction), 4096);
  if (output.footer?.text) output.footer = { ...output.footer, text: safeString(replacePlaceholders(output.footer.text, interaction), 2048) };
  if (output.author?.name) output.author = { ...output.author, name: safeString(replacePlaceholders(output.author.name, interaction), 256) };

  if (output.image?.url && !isHttpUrl(output.image.url)) delete output.image;
  if (output.thumbnail?.url && !isHttpUrl(output.thumbnail.url)) delete output.thumbnail;
  if (output.url && !isHttpUrl(output.url)) delete output.url;

  return output;
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
    },
    premium_card: {
      title: '💎・COMUNICADO PREMIUM',
      description: '╭───────────────╮\n│ ✨ **Mensaje importante** ✨ │\n╰───────────────╯\n\n💜 Escribe aquí el contenido principal.\n\n> Diseño elegante para anuncios especiales en **{server}**.',
      color: 'premium',
      footer: `${serverName} • Premium Studio`,
      timestamp: true
    },
    neon: {
      title: '🌈・NEON DROP',
      description: '⚡ **Nuevo aviso con estilo neon**\n\n▸ Punto importante 1\n▸ Punto importante 2\n▸ Punto importante 3\n\n✨ Usa GIFs, emojis y botones para hacerlo más llamativo.',
      color: 'rosa',
      footer: `${serverName} • Neon Mode`,
      timestamp: true
    }
  };

  return templates[templateName] ?? templates.anuncio;
}

function templateToEmbedData(templateName, interaction) {
  const template = getTemplateData(templateName, interaction);
  const data = {
    title: template.title,
    description: template.description,
    color: parseColor(template.color),
    footer: { text: template.footer }
  };
  if (template.timestamp) data.timestamp = new Date().toISOString();
  return data;
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

function buildPayloadFromDraft(draft, interaction) {
  const embedData = localizeEmbedJson(draft.embed ?? {}, interaction);
  const embed = EmbedBuilder.from(embedData);
  const components = [];
  const button = makeLinkButton(draft.buttonLabel, draft.buttonUrl);
  if (button) components.push(button);

  return {
    content: safeString(replacePlaceholders(draft.content, interaction), 2000),
    embeds: [embed],
    components,
    allowedMentions: { parse: [] }
  };
}

function parseBooleanLike(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = String(value).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'y'].includes(raw);
}

function parseEnvLike(text) {
  const result = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim().toUpperCase();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value.replaceAll('\\n', '\n');
  }
  return result;
}

function importDraftFromText(text, interaction) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('No pegaste contenido.');

  if (raw.startsWith('{') || raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    const base = Array.isArray(parsed) ? { embeds: parsed } : parsed;
    const firstEmbed = Array.isArray(base.embeds) ? base.embeds[0] : base;
    return {
      content: base.content,
      embed: normalizeEmbedJson(firstEmbed ?? {}),
      buttonLabel: base.buttonLabel ?? base.button_text ?? base.button?.label,
      buttonUrl: base.buttonUrl ?? base.button_url ?? base.button?.url
    };
  }

  const env = parseEnvLike(raw);
  const embed = {};

  if (env.TITLE || env.TITULO) embed.title = env.TITLE ?? env.TITULO;
  if (env.DESCRIPTION || env.DESCRIPCION) embed.description = env.DESCRIPTION ?? env.DESCRIPCION;
  if (env.COLOR) embed.color = parseColor(env.COLOR);
  if (env.IMAGE || env.IMAGEN) embed.image = { url: env.IMAGE ?? env.IMAGEN };
  if (env.THUMBNAIL) embed.thumbnail = { url: env.THUMBNAIL };
  if (env.FOOTER) embed.footer = { text: env.FOOTER };
  if (env.AUTHOR || env.AUTOR) embed.author = { name: env.AUTHOR ?? env.AUTOR };
  if (env.URL) embed.url = env.URL;
  if (parseBooleanLike(env.TIMESTAMP)) embed.timestamp = new Date().toISOString();

  return {
    content: env.CONTENT || env.CONTENIDO,
    embed: normalizeEmbedJson(embed),
    buttonLabel: env.BUTTON_TEXT || env.BOTON_TEXTO,
    buttonUrl: env.BUTTON_URL || env.BOTON_URL
  };
}

function mergeDraft(baseDraft, importedDraft) {
  return {
    ...baseDraft,
    content: importedDraft.content ?? baseDraft.content,
    embed: {
      ...(baseDraft.embed ?? {}),
      ...(importedDraft.embed ?? {})
    },
    buttonLabel: importedDraft.buttonLabel ?? baseDraft.buttonLabel,
    buttonUrl: importedDraft.buttonUrl ?? baseDraft.buttonUrl
  };
}

function createPanelControlEmbed(brand, targetChannel, draft) {
  const hasButton = draft.buttonLabel && draft.buttonUrl ? '✅' : '➖';
  const color = colorToHex(draft.embed?.color ?? 0x5865F2);

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`🎛️ ${brand} — Editor visual de embeds`)
    .setDescription('Usa los botones para editar el mensaje sin escribir comandos largos. Puedes pegar JSON o formato ENV y luego enviarlo.')
    .addFields(
      { name: '📍 Canal destino', value: `${targetChannel}`, inline: true },
      { name: '🎨 Color', value: color, inline: true },
      { name: '🔘 Botón', value: hasButton, inline: true },
      { name: '⚡ Atajos', value: '`Texto` cambia título/descripción. `Visual` cambia color e imágenes. `JSON/ENV` importa todo rápido.' }
    )
    .setFooter({ text: 'La previsualización es privada. Solo tú ves este panel.' });
}

function createPanelComponents(sessionId) {
  const templateRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`embed_panel_template:${sessionId}`)
      .setPlaceholder('🎨 Elegir plantilla decorada')
      .addOptions(TEMPLATE_CHOICES.map(choice => new StringSelectMenuOptionBuilder()
        .setLabel(choice.label)
        .setValue(choice.value)
        .setDescription(choice.description)
      ))
  );

  const editRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_panel_text:${sessionId}`)
      .setEmoji('✏️')
      .setLabel('Texto')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_panel_visual:${sessionId}`)
      .setEmoji('🎨')
      .setLabel('Visual')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_panel_link:${sessionId}`)
      .setEmoji('🔗')
      .setLabel('Botón')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_panel_import:${sessionId}`)
      .setEmoji('📋')
      .setLabel('JSON/ENV')
      .setStyle(ButtonStyle.Secondary)
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_panel_refresh:${sessionId}`)
      .setEmoji('👀')
      .setLabel('Ver preview')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_panel_send:${sessionId}`)
      .setEmoji('🚀')
      .setLabel('Enviar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed_panel_cancel:${sessionId}`)
      .setEmoji('🗑️')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  return [templateRow, editRow, actionRow];
}

function createHelpEmbed(brand = 'Embed Studio') {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`✨ ${brand} — Panel de Embeds`)
    .setDescription('Crea mensajes bonitos para anuncios, reglas, eventos, updates, sorteos y más. Todo funciona en el canal actual o en el canal que elijas.')
    .addFields(
      {
        name: '🎛️ Interfaz rápida',
        value: '`/embed panel` abre un editor visual con botones, menú de plantillas y formularios.'
      },
      {
        name: '🧩 Comandos principales',
        value: '`/embed crear` crea un embed personalizado.\n`/embed plantilla` usa diseños decorados.\n`/embed importar` acepta JSON o formato ENV.\n`/embed editar` edita un mensaje enviado por el bot.'
      },
      {
        name: '📋 Formato ENV rápido',
        value: '`TITLE=...` `DESCRIPTION=...` `COLOR=#5865F2` `IMAGE=https://...` `BUTTON_TEXT=...` `BUTTON_URL=https://...`'
      },
      {
        name: '✨ Placeholders',
        value: '`{user}` menciona al usuario. `{username}` nombre del usuario. `{server}` nombre del servidor. `{memberCount}` miembros. `{channel}` canal actual.'
      },
      {
        name: '🖼️ Animaciones',
        value: 'Pon una URL `.gif` en `imagen`, `thumbnail`, `IMAGE` o `THUMBNAIL` para darle movimiento al embed.'
      }
    )
    .setFooter({ text: 'Tip: si no eliges canal, se envía en el canal donde usaste el comando.' })
    .setTimestamp();
}

module.exports = {
  COLOR_NAMES,
  TEMPLATE_CHOICES,
  parseColor,
  colorToHex,
  isHttpUrl,
  replacePlaceholders,
  safeString,
  validateMessageTarget,
  getBotPermissionError,
  makeLinkButton,
  makePreviewButtons,
  ensureEmbedLimits,
  normalizeEmbedJson,
  localizeEmbedJson,
  createEmbedFromOptions,
  getTemplateData,
  templateToEmbedData,
  buildMessagePayload,
  buildPayloadFromDraft,
  importDraftFromText,
  mergeDraft,
  createPanelControlEmbed,
  createPanelComponents,
  createHelpEmbed
};
