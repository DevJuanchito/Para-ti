const {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const {
  buildMessagePayload,
  createEmbedFromOptions,
  createHelpEmbed,
  ensureEmbedLimits,
  getBotPermissionError,
  getTemplateData,
  isHttpUrl,
  makeLinkButton,
  makePreviewButtons,
  parseColor,
  replacePlaceholders,
  safeString,
  validateMessageTarget
} = require('../utils/embedTools');

const previewSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000;

function cleanOldSessions() {
  const now = Date.now();
  for (const [id, session] of previewSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) previewSessions.delete(id);
  }
}

function makeSession(interaction, payload, channelId, mode = 'send') {
  cleanOldSessions();
  const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  previewSessions.set(sessionId, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId,
    payload,
    mode,
    createdAt: Date.now()
  });
  return sessionId;
}

function addCommonCreateOptions(subcommand) {
  return subcommand
    .addStringOption(option => option
      .setName('titulo')
      .setDescription('Título del embed')
      .setMaxLength(256))
    .addStringOption(option => option
      .setName('descripcion')
      .setDescription('Descripción principal del embed')
      .setMaxLength(4000))
    .addChannelOption(option => option
      .setName('canal')
      .setDescription('Canal donde se enviará. Si lo dejas vacío, usa el canal actual.')
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread
      ))
    .addStringOption(option => option
      .setName('color')
      .setDescription('Color: azul, morado, rosa, rojo, verde, premium o HEX #5865F2')
      .setMaxLength(30))
    .addStringOption(option => option
      .setName('imagen')
      .setDescription('URL de imagen o GIF grande')
      .setMaxLength(1000))
    .addStringOption(option => option
      .setName('thumbnail')
      .setDescription('URL de imagen pequeña o GIF')
      .setMaxLength(1000))
    .addStringOption(option => option
      .setName('footer')
      .setDescription('Texto inferior del embed')
      .setMaxLength(2048))
    .addStringOption(option => option
      .setName('autor')
      .setDescription('Nombre de autor del embed')
      .setMaxLength(256))
    .addStringOption(option => option
      .setName('url')
      .setDescription('URL que se abrirá al tocar el título')
      .setMaxLength(1000))
    .addStringOption(option => option
      .setName('contenido')
      .setDescription('Texto fuera del embed, opcional')
      .setMaxLength(2000))
    .addRoleOption(option => option
      .setName('mencionar_rol')
      .setDescription('Rol que quieres mencionar junto al embed'))
    .addStringOption(option => option
      .setName('boton_texto')
      .setDescription('Texto del botón con enlace')
      .setMaxLength(80))
    .addStringOption(option => option
      .setName('boton_url')
      .setDescription('URL del botón con enlace')
      .setMaxLength(1000))
    .addBooleanOption(option => option
      .setName('timestamp')
      .setDescription('Agregar fecha/hora al embed'))
    .addBooleanOption(option => option
      .setName('enviar_directo')
      .setDescription('Enviar sin previsualización'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Crea, previsualiza, envía y edita embeds bonitos.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand => addCommonCreateOptions(
      subcommand
        .setName('crear')
        .setDescription('Crear un embed personalizado.')
    ))
    .addSubcommand(subcommand => subcommand
      .setName('plantilla')
      .setDescription('Usar una plantilla decorada para anuncios, reglas, eventos y más.')
      .addStringOption(option => option
        .setName('tipo')
        .setDescription('Tipo de plantilla')
        .setRequired(true)
        .addChoices(
          { name: '📢 Anuncio', value: 'anuncio' },
          { name: '📜 Reglas', value: 'reglas' },
          { name: '🛠️ Update', value: 'update' },
          { name: '🎉 Evento', value: 'evento' },
          { name: '🎁 Sorteo', value: 'sorteo' },
          { name: '🛡️ Staff', value: 'staff' },
          { name: '🛒 Tienda', value: 'tienda' },
          { name: '⚠️ Mantenimiento', value: 'mantenimiento' }
        ))
      .addStringOption(option => option
        .setName('mensaje')
        .setDescription('Texto que reemplaza la descripción de la plantilla')
        .setMaxLength(4000))
      .addStringOption(option => option
        .setName('titulo')
        .setDescription('Título personalizado')
        .setMaxLength(256))
      .addChannelOption(option => option
        .setName('canal')
        .setDescription('Canal donde se enviará. Si lo dejas vacío, usa el canal actual.')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        ))
      .addStringOption(option => option
        .setName('color')
        .setDescription('Color: azul, morado, rosa, rojo, verde, premium o HEX #5865F2')
        .setMaxLength(30))
      .addStringOption(option => option
        .setName('imagen')
        .setDescription('URL de imagen o GIF grande')
        .setMaxLength(1000))
      .addStringOption(option => option
        .setName('thumbnail')
        .setDescription('URL de imagen pequeña o GIF')
        .setMaxLength(1000))
      .addStringOption(option => option
        .setName('contenido')
        .setDescription('Texto fuera del embed, opcional')
        .setMaxLength(2000))
      .addRoleOption(option => option
        .setName('mencionar_rol')
        .setDescription('Rol que quieres mencionar junto al embed'))
      .addStringOption(option => option
        .setName('boton_texto')
        .setDescription('Texto del botón con enlace')
        .setMaxLength(80))
      .addStringOption(option => option
        .setName('boton_url')
        .setDescription('URL del botón con enlace')
        .setMaxLength(1000))
      .addBooleanOption(option => option
        .setName('enviar_directo')
        .setDescription('Enviar sin previsualización')))
    .addSubcommand(subcommand => subcommand
      .setName('editar')
      .setDescription('Editar un embed enviado por este bot.')
      .addStringOption(option => option
        .setName('mensaje_id')
        .setDescription('ID del mensaje que quieres editar')
        .setRequired(true)
        .setMaxLength(40))
      .addChannelOption(option => option
        .setName('canal')
        .setDescription('Canal del mensaje. Si lo dejas vacío, usa el canal actual.')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        ))
      .addStringOption(option => option
        .setName('titulo')
        .setDescription('Nuevo título')
        .setMaxLength(256))
      .addStringOption(option => option
        .setName('descripcion')
        .setDescription('Nueva descripción')
        .setMaxLength(4000))
      .addStringOption(option => option
        .setName('color')
        .setDescription('Nuevo color')
        .setMaxLength(30))
      .addStringOption(option => option
        .setName('imagen')
        .setDescription('Nueva URL de imagen/GIF grande')
        .setMaxLength(1000))
      .addStringOption(option => option
        .setName('thumbnail')
        .setDescription('Nueva URL de miniatura/GIF')
        .setMaxLength(1000))
      .addStringOption(option => option
        .setName('footer')
        .setDescription('Nuevo footer')
        .setMaxLength(2048))
      .addStringOption(option => option
        .setName('autor')
        .setDescription('Nuevo autor')
        .setMaxLength(256))
      .addStringOption(option => option
        .setName('url')
        .setDescription('Nueva URL del título')
        .setMaxLength(1000))
      .addStringOption(option => option
        .setName('contenido')
        .setDescription('Nuevo texto fuera del embed')
        .setMaxLength(2000))
      .addStringOption(option => option
        .setName('boton_texto')
        .setDescription('Nuevo texto del botón con enlace')
        .setMaxLength(80))
      .addStringOption(option => option
        .setName('boton_url')
        .setDescription('Nueva URL del botón')
        .setMaxLength(1000))
      .addBooleanOption(option => option
        .setName('timestamp')
        .setDescription('Agregar fecha/hora nueva')))
    .addSubcommand(subcommand => subcommand
      .setName('json')
      .setDescription('Crear un embed avanzado pegando JSON.')
      .addStringOption(option => option
        .setName('json')
        .setDescription('JSON del embed o mensaje con embeds')
        .setRequired(true)
        .setMaxLength(4000))
      .addChannelOption(option => option
        .setName('canal')
        .setDescription('Canal donde se enviará. Si lo dejas vacío, usa el canal actual.')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        ))
      .addBooleanOption(option => option
        .setName('enviar_directo')
        .setDescription('Enviar sin previsualización')))
    .addSubcommand(subcommand => subcommand
      .setName('ayuda')
      .setDescription('Ver ayuda del bot de embeds.')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ayuda') {
      const brand = process.env.BOT_BRAND || 'Embed Studio';
      await interaction.reply({ embeds: [createHelpEmbed(brand)], ephemeral: true });
      return;
    }

    if (subcommand === 'crear') {
      await handleCreate(interaction);
      return;
    }

    if (subcommand === 'plantilla') {
      await handleTemplate(interaction);
      return;
    }

    if (subcommand === 'editar') {
      await handleEdit(interaction);
      return;
    }

    if (subcommand === 'json') {
      await handleJson(interaction);
    }
  },

  async handleButton(interaction) {
    const [prefix, action, sessionId] = interaction.customId.split(':');
    if (prefix !== 'embed' || !['send', 'cancel'].includes(action)) return false;

    cleanOldSessions();
    const session = previewSessions.get(sessionId);
    if (!session) {
      await interaction.reply({ content: '⏰ Esta previsualización expiró. Vuelve a crear el embed.', ephemeral: true });
      return true;
    }

    if (interaction.user.id !== session.userId) {
      await interaction.reply({ content: '❌ Solo quien creó esta previsualización puede usar estos botones.', ephemeral: true });
      return true;
    }

    if (action === 'cancel') {
      previewSessions.delete(sessionId);
      await interaction.update({ content: '🗑️ Previsualización cancelada.', embeds: [], components: [] });
      return true;
    }

    const targetChannel = await interaction.client.channels.fetch(session.channelId).catch(() => null);
    const targetError = validateMessageTarget(targetChannel);
    if (targetError) {
      previewSessions.delete(sessionId);
      await interaction.update({ content: `❌ ${targetError}`, embeds: [], components: [] });
      return true;
    }

    const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
    if (permissionError) {
      await interaction.reply({ content: `❌ ${permissionError}`, ephemeral: true });
      return true;
    }

    await targetChannel.send(session.payload);
    previewSessions.delete(sessionId);
    await interaction.update({ content: `✅ Embed enviado correctamente en ${targetChannel}.`, embeds: [], components: [] });
    return true;
  }
};

async function handleCreate(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, ephemeral: true });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, ephemeral: true });
    return;
  }

  const embed = createEmbedFromOptions(interaction, {
    title: '✨ Título del embed',
    description: 'Escribe una descripción con `/embed crear descripcion:` para personalizar este mensaje.',
    color: 'discord',
    timestamp: false
  });

  const limitError = ensureEmbedLimits([embed]);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, ephemeral: true });
    return;
  }

  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para usar botón debes poner `boton_texto` y `boton_url` juntos.', ephemeral: true });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', ephemeral: true });
    return;
  }

  const payload = buildMessagePayload({
    interaction,
    embedOrEmbeds: embed,
    content: interaction.options.getString('contenido'),
    role: interaction.options.getRole('mencionar_rol'),
    buttonLabel,
    buttonUrl
  });

  await sendOrPreview(interaction, payload, targetChannel);
}

async function handleTemplate(interaction) {
  const type = interaction.options.getString('tipo');
  const template = getTemplateData(type, interaction);
  const customMessage = interaction.options.getString('mensaje');
  const customTitle = interaction.options.getString('titulo');
  const customColor = interaction.options.getString('color');
  const image = interaction.options.getString('imagen');
  const thumbnail = interaction.options.getString('thumbnail');

  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, ephemeral: true });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(parseColor(customColor ?? template.color, 0x5865F2))
    .setTitle(safeString(replacePlaceholders(customTitle ?? template.title, interaction), 256))
    .setDescription(safeString(replacePlaceholders(customMessage ?? template.description, interaction), 4096))
    .setFooter({ text: safeString(replacePlaceholders(template.footer, interaction), 2048) });

  if (template.timestamp) embed.setTimestamp();
  if (image && isHttpUrl(image)) embed.setImage(image);
  if (thumbnail && isHttpUrl(thumbnail)) embed.setThumbnail(thumbnail);

  const limitError = ensureEmbedLimits([embed]);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, ephemeral: true });
    return;
  }

  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para usar botón debes poner `boton_texto` y `boton_url` juntos.', ephemeral: true });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', ephemeral: true });
    return;
  }

  const payload = buildMessagePayload({
    interaction,
    embedOrEmbeds: embed,
    content: interaction.options.getString('contenido'),
    role: interaction.options.getRole('mencionar_rol'),
    buttonLabel,
    buttonUrl
  });

  await sendOrPreview(interaction, payload, targetChannel);
}

async function handleEdit(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, ephemeral: true });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, ephemeral: true });
    return;
  }

  const messageId = interaction.options.getString('mensaje_id');
  const message = await targetChannel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    await interaction.reply({ content: '❌ No encontré ese mensaje en el canal indicado.', ephemeral: true });
    return;
  }

  if (message.author.id !== interaction.client.user.id) {
    await interaction.reply({ content: '❌ Solo puedo editar mensajes que yo mismo envié.', ephemeral: true });
    return;
  }

  const oldEmbed = message.embeds[0];
  const embed = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder().setColor(0x5865F2);

  const title = interaction.options.getString('titulo');
  const description = interaction.options.getString('descripcion');
  const color = interaction.options.getString('color');
  const image = interaction.options.getString('imagen');
  const thumbnail = interaction.options.getString('thumbnail');
  const footer = interaction.options.getString('footer');
  const author = interaction.options.getString('autor');
  const url = interaction.options.getString('url');
  const timestamp = interaction.options.getBoolean('timestamp');

  if (title !== null) embed.setTitle(safeString(replacePlaceholders(title, interaction), 256));
  if (description !== null) embed.setDescription(safeString(replacePlaceholders(description, interaction), 4096));
  if (color !== null) embed.setColor(parseColor(color, 0x5865F2));
  if (footer !== null) embed.setFooter({ text: safeString(replacePlaceholders(footer, interaction), 2048) });
  if (author !== null) embed.setAuthor({ name: safeString(replacePlaceholders(author, interaction), 256) });
  if (url !== null && isHttpUrl(url)) embed.setURL(url);
  if (image !== null && isHttpUrl(image)) embed.setImage(image);
  if (thumbnail !== null && isHttpUrl(thumbnail)) embed.setThumbnail(thumbnail);
  if (timestamp === true) embed.setTimestamp();

  const limitError = ensureEmbedLimits([embed]);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, ephemeral: true });
    return;
  }

  const newContent = interaction.options.getString('contenido');
  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');

  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para cambiar el botón debes poner `boton_texto` y `boton_url` juntos.', ephemeral: true });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', ephemeral: true });
    return;
  }

  const components = buttonLabel && buttonUrl ? [makeLinkButton(buttonLabel, buttonUrl)] : message.components;

  await message.edit({
    content: newContent !== null ? safeString(replacePlaceholders(newContent, interaction), 2000) : message.content,
    embeds: [embed],
    components,
    allowedMentions: { parse: [] }
  });

  await interaction.reply({ content: `✅ Embed editado correctamente en ${targetChannel}.`, ephemeral: true });
}

async function handleJson(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, ephemeral: true });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, ephemeral: true });
    return;
  }

  const raw = interaction.options.getString('json');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await interaction.reply({ content: '❌ JSON inválido. Revisa comas, comillas y llaves.', ephemeral: true });
    return;
  }

  const rawEmbeds = Array.isArray(parsed.embeds) ? parsed.embeds : [parsed];
  const uniqueEmbeds = rawEmbeds.slice(0, 10).map(data => {
    const normalized = { ...data };
    if (typeof normalized.color === 'string') normalized.color = parseColor(normalized.color);
    return EmbedBuilder.from(normalized);
  });
  const limitError = ensureEmbedLimits(uniqueEmbeds);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, ephemeral: true });
    return;
  }

  const payload = {
    content: parsed.content ? safeString(replacePlaceholders(parsed.content, interaction), 2000) : undefined,
    embeds: uniqueEmbeds,
    components: [],
    allowedMentions: { parse: [] }
  };

  await sendOrPreview(interaction, payload, targetChannel);
}

async function sendOrPreview(interaction, payload, targetChannel) {
  const enviarDirecto = interaction.options.getBoolean('enviar_directo') ?? false;

  if (enviarDirecto) {
    await targetChannel.send(payload);
    await interaction.reply({ content: `✅ Embed enviado correctamente en ${targetChannel}.`, ephemeral: true });
    return;
  }

  const sessionId = makeSession(interaction, payload, targetChannel.id);
  const previewComponents = [];

  if (payload.components?.length) {
    previewComponents.push(...payload.components);
  }
  previewComponents.push(makePreviewButtons(sessionId));

  await interaction.reply({
    content: `👀 **Previsualización** — destino: ${targetChannel}\nToca **Enviar embed** para publicarlo o **Cancelar** para descartarlo.`,
    embeds: payload.embeds,
    components: previewComponents,
    ephemeral: true
  });
}
