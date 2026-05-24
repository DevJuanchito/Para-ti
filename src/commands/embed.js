const {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const {
  buildMessagePayload,
  buildPayloadFromDraft,
  createEmbedFromOptions,
  createHelpEmbed,
  createPanelComponents,
  createPanelControlEmbed,
  ensureEmbedLimits,
  getBotPermissionError,
  getTemplateData,
  importDraftFromText,
  isHttpUrl,
  makeLinkButton,
  makePreviewButtons,
  mergeDraft,
  localizeEmbedJson,
  normalizeEmbedJson,
  parseColor,
  replacePlaceholders,
  safeString,
  templateToEmbedData,
  validateMessageTarget
} = require('../utils/embedTools');

const previewSessions = new Map();
const panelSessions = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000;

function cleanOldSessions() {
  const now = Date.now();
  for (const [id, session] of previewSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) previewSessions.delete(id);
  }
  for (const [id, session] of panelSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) panelSessions.delete(id);
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

function makePanelSession(interaction, channelId) {
  cleanOldSessions();
  const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  panelSessions.set(sessionId, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId,
    draft: {
      content: '',
      embed: templateToEmbedData('premium_card', interaction),
      buttonLabel: '',
      buttonUrl: ''
    },
    createdAt: Date.now()
  });
  return sessionId;
}

async function getOwnedPanelSession(interaction, sessionId) {
  cleanOldSessions();
  const session = panelSessions.get(sessionId);
  if (!session) {
    await interaction.reply({ content: '⏰ Este panel expiró. Usa `/embed panel` otra vez.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return null;
  }
  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: '❌ Solo quien abrió este panel puede usarlo.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return null;
  }
  return session;
}

async function getTargetChannel(interaction, channelId) {
  return interaction.client.channels.fetch(channelId).catch(() => null);
}

function addTextInput(modal, id, label, style, required, maxLength, value, placeholder) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(maxLength);

  const safeValue = safeString(value, maxLength);
  if (safeValue) input.setValue(safeValue);
  if (placeholder) input.setPlaceholder(placeholder);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
}

function buildPanelTextModal(sessionId, draft) {
  const modal = new ModalBuilder()
    .setCustomId(`embed_panel_modal_text:${sessionId}`)
    .setTitle('✏️ Editar texto del embed');

  addTextInput(modal, 'titulo', 'Título', TextInputStyle.Short, false, 256, draft.embed?.title, '📢・ANUNCIO OFICIAL');
  addTextInput(modal, 'descripcion', 'Descripción', TextInputStyle.Paragraph, false, 4000, draft.embed?.description, 'Escribe aquí el mensaje principal...');
  addTextInput(modal, 'contenido', 'Texto fuera del embed', TextInputStyle.Paragraph, false, 2000, draft.content, '@everyone o texto normal, opcional');
  addTextInput(modal, 'footer', 'Footer', TextInputStyle.Short, false, 2048, draft.embed?.footer?.text, 'Mi servidor • Anuncios');
  addTextInput(modal, 'autor', 'Autor', TextInputStyle.Short, false, 256, draft.embed?.author?.name, 'Staff Team');

  return modal;
}

function buildPanelVisualModal(sessionId, draft) {
  const modal = new ModalBuilder()
    .setCustomId(`embed_panel_modal_visual:${sessionId}`)
    .setTitle('🎨 Editar visual del embed');

  addTextInput(modal, 'color', 'Color', TextInputStyle.Short, false, 30, draft.embed?.color ? `#${Number(draft.embed.color).toString(16).padStart(6, '0')}` : '', 'premium, azul, morado o #5865F2');
  addTextInput(modal, 'imagen', 'Imagen o GIF grande', TextInputStyle.Short, false, 1000, draft.embed?.image?.url, 'https://...gif');
  addTextInput(modal, 'thumbnail', 'Thumbnail o GIF pequeño', TextInputStyle.Short, false, 1000, draft.embed?.thumbnail?.url, 'https://...png');
  addTextInput(modal, 'url', 'URL del título', TextInputStyle.Short, false, 1000, draft.embed?.url, 'https://...');
  addTextInput(modal, 'timestamp', 'Timestamp', TextInputStyle.Short, false, 10, draft.embed?.timestamp ? 'si' : '', 'si / no');

  return modal;
}

function buildPanelLinkModal(sessionId, draft) {
  const modal = new ModalBuilder()
    .setCustomId(`embed_panel_modal_link:${sessionId}`)
    .setTitle('🔗 Botón con enlace');

  addTextInput(modal, 'boton_texto', 'Texto del botón', TextInputStyle.Short, false, 80, draft.buttonLabel, 'Abrir ticket');
  addTextInput(modal, 'boton_url', 'URL del botón', TextInputStyle.Short, false, 1000, draft.buttonUrl, 'https://...');

  return modal;
}

function buildPanelImportModal(sessionId) {
  const modal = new ModalBuilder()
    .setCustomId(`embed_panel_modal_import:${sessionId}`)
    .setTitle('📋 Pegar JSON o ENV');

  addTextInput(
    modal,
    'data',
    'JSON o ENV',
    TextInputStyle.Paragraph,
    true,
    4000,
    '',
    'Pega aquí tu JSON o ENV. Ejemplo: TITLE=Anuncio'
  );

  return modal;
}

function parseYesNo(value) {
  if (!value) return false;
  return ['si', 'sí', 's', 'yes', 'y', 'true', '1'].includes(String(value).trim().toLowerCase());
}

async function renderPanelReply(interaction, sessionId, session, mode = 'reply', extraContent = null) {
  const targetChannel = await getTargetChannel(interaction, session.channelId);
  const payload = buildPayloadFromDraft(session.draft, interaction);
  const limitError = ensureEmbedLimits(payload.embeds);
  const controlEmbed = createPanelControlEmbed(process.env.BOT_BRAND || 'Embed Studio', targetChannel ?? interaction.channel, session.draft);

  const response = {
    content: extraContent ?? (limitError ? `❌ ${limitError}` : '🎛️ **Editor visual listo.** Ajusta tu embed y envíalo cuando esté perfecto.'),
    embeds: [controlEmbed, ...payload.embeds],
    components: createPanelComponents(sessionId),
    flags: MessageFlags.Ephemeral
  };

  if (mode === 'update') return interaction.update(response);
  return interaction.reply(response);
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
    .addSubcommand(subcommand => subcommand
      .setName('panel')
      .setDescription('Abrir una interfaz visual con botones, formularios, plantillas y JSON/ENV.')
      .addChannelOption(option => option
        .setName('canal')
        .setDescription('Canal donde se enviará. Si lo dejas vacío, usa el canal actual.')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        )))
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
          { name: '⚠️ Mantenimiento', value: 'mantenimiento' },
          { name: '💎 Premium', value: 'premium_card' },
          { name: '🌈 Neon', value: 'neon' }
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
      .setName('importar')
      .setDescription('Enviar un embed pegando JSON o formato ENV tipo TITLE=...')
      .addStringOption(option => option
        .setName('data')
        .setDescription('JSON o ENV del embed')
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
      await interaction.reply({ embeds: [createHelpEmbed(brand)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === 'panel') {
      await handlePanel(interaction);
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

    if (subcommand === 'importar') {
      await handleImport(interaction, interaction.options.getString('data'));
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
    if (interaction.customId.startsWith('embed_panel_')) {
      return handlePanelButton(interaction);
    }

    const [prefix, action, sessionId] = interaction.customId.split(':');
    if (prefix !== 'embed' || !['send', 'cancel'].includes(action)) return false;

    cleanOldSessions();
    const session = previewSessions.get(sessionId);
    if (!session) {
      await interaction.reply({ content: '⏰ Esta previsualización expiró. Vuelve a crear el embed.', flags: MessageFlags.Ephemeral });
      return true;
    }

    if (interaction.user.id !== session.userId) {
      await interaction.reply({ content: '❌ Solo quien creó esta previsualización puede usar estos botones.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    await targetChannel.send(session.payload);
    previewSessions.delete(sessionId);
    await interaction.update({ content: `✅ Embed enviado correctamente en ${targetChannel}.`, embeds: [], components: [] });
    return true;
  },

  async handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith('embed_panel_template:')) return false;
    const sessionId = interaction.customId.split(':')[1];
    const session = await getOwnedPanelSession(interaction, sessionId);
    if (!session) return true;

    const template = interaction.values[0];
    session.draft.embed = templateToEmbedData(template, interaction);
    session.createdAt = Date.now();
    await renderPanelReply(interaction, sessionId, session, 'update', `✅ Plantilla aplicada: **${template}**`);
    return true;
  },

  async handleModal(interaction) {
    if (!interaction.customId.startsWith('embed_panel_modal_')) return false;

    const [, , , modalType, sessionId] = interaction.customId.split(':');
    const session = await getOwnedPanelSession(interaction, sessionId);
    if (!session) return true;

    if (modalType === 'text') {
      applyTextModal(interaction, session);
      await renderPanelReply(interaction, sessionId, session, 'reply', '✅ Texto actualizado.');
      return true;
    }

    if (modalType === 'visual') {
      const error = applyVisualModal(interaction, session);
      await renderPanelReply(interaction, sessionId, session, 'reply', error ? `⚠️ ${error}` : '✅ Visual actualizado.');
      return true;
    }

    if (modalType === 'link') {
      const error = applyLinkModal(interaction, session);
      await renderPanelReply(interaction, sessionId, session, 'reply', error ? `⚠️ ${error}` : '✅ Botón actualizado.');
      return true;
    }

    if (modalType === 'import') {
      const raw = interaction.fields.getTextInputValue('data');
      try {
        const imported = importDraftFromText(raw, interaction);
        session.draft = mergeDraft(session.draft, imported);
        await renderPanelReply(interaction, sessionId, session, 'reply', '✅ JSON/ENV importado y decorado. Revisa la previsualización.');
      } catch (error) {
        await interaction.reply({ content: `❌ No pude importar eso: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
      return true;
    }

    return false;
  }
};

async function handlePanel(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const sessionId = makePanelSession(interaction, targetChannel.id);
  const session = panelSessions.get(sessionId);
  await renderPanelReply(interaction, sessionId, session, 'reply');
}

async function handlePanelButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0].replace('embed_panel_', '');
  const sessionId = parts[1];
  const session = await getOwnedPanelSession(interaction, sessionId);
  if (!session) return true;

  if (action === 'text') {
    await interaction.showModal(buildPanelTextModal(sessionId, session.draft));
    return true;
  }

  if (action === 'visual') {
    await interaction.showModal(buildPanelVisualModal(sessionId, session.draft));
    return true;
  }

  if (action === 'link') {
    await interaction.showModal(buildPanelLinkModal(sessionId, session.draft));
    return true;
  }

  if (action === 'import') {
    await interaction.showModal(buildPanelImportModal(sessionId));
    return true;
  }

  if (action === 'refresh') {
    await renderPanelReply(interaction, sessionId, session, 'update', '👀 Previsualización actualizada.');
    return true;
  }

  if (action === 'cancel') {
    panelSessions.delete(sessionId);
    await interaction.update({ content: '🗑️ Panel cancelado.', embeds: [], components: [] });
    return true;
  }

  if (action === 'send') {
    const targetChannel = await getTargetChannel(interaction, session.channelId);
    const targetError = validateMessageTarget(targetChannel);
    if (targetError) {
      await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
    if (permissionError) {
      await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const payload = buildPayloadFromDraft(session.draft, interaction);
    const limitError = ensureEmbedLimits(payload.embeds);
    if (limitError) {
      await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    await targetChannel.send(payload);
    panelSessions.delete(sessionId);
    await interaction.update({ content: `✅ Embed enviado correctamente en ${targetChannel}.`, embeds: [], components: [] });
    return true;
  }

  return false;
}

function applyTextModal(interaction, session) {
  const title = interaction.fields.getTextInputValue('titulo');
  const description = interaction.fields.getTextInputValue('descripcion');
  const content = interaction.fields.getTextInputValue('contenido');
  const footer = interaction.fields.getTextInputValue('footer');
  const author = interaction.fields.getTextInputValue('autor');

  session.draft.embed.title = title || undefined;
  session.draft.embed.description = description || undefined;
  session.draft.content = content || undefined;
  session.draft.embed.footer = footer ? { text: footer } : undefined;
  session.draft.embed.author = author ? { name: author } : undefined;
  session.createdAt = Date.now();
}

function applyVisualModal(interaction, session) {
  const color = interaction.fields.getTextInputValue('color');
  const image = interaction.fields.getTextInputValue('imagen');
  const thumbnail = interaction.fields.getTextInputValue('thumbnail');
  const url = interaction.fields.getTextInputValue('url');
  const timestamp = interaction.fields.getTextInputValue('timestamp');
  const warnings = [];

  if (color) session.draft.embed.color = parseColor(color);
  if (image) {
    if (isHttpUrl(image)) session.draft.embed.image = { url: image };
    else warnings.push('La imagen no era URL http/https y no se aplicó.');
  } else {
    delete session.draft.embed.image;
  }

  if (thumbnail) {
    if (isHttpUrl(thumbnail)) session.draft.embed.thumbnail = { url: thumbnail };
    else warnings.push('El thumbnail no era URL http/https y no se aplicó.');
  } else {
    delete session.draft.embed.thumbnail;
  }

  if (url) {
    if (isHttpUrl(url)) session.draft.embed.url = url;
    else warnings.push('La URL del título no era http/https y no se aplicó.');
  } else {
    delete session.draft.embed.url;
  }

  if (timestamp) {
    if (parseYesNo(timestamp)) session.draft.embed.timestamp = new Date().toISOString();
    else delete session.draft.embed.timestamp;
  }

  session.createdAt = Date.now();
  return warnings.join(' ');
}

function applyLinkModal(interaction, session) {
  const buttonLabel = interaction.fields.getTextInputValue('boton_texto');
  const buttonUrl = interaction.fields.getTextInputValue('boton_url');

  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    return 'Para usar botón debes llenar texto y URL juntos.';
  }

  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    return 'La URL del botón debe empezar con http:// o https://';
  }

  session.draft.buttonLabel = buttonLabel || undefined;
  session.draft.buttonUrl = buttonUrl || undefined;
  session.createdAt = Date.now();
  return null;
}

async function handleCreate(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para usar botón debes poner `boton_texto` y `boton_url` juntos.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para usar botón debes poner `boton_texto` y `boton_url` juntos.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', flags: MessageFlags.Ephemeral });
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

async function handleImport(interaction, rawData) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  let draft;
  try {
    draft = importDraftFromText(rawData, interaction);
  } catch (error) {
    await interaction.reply({ content: `❌ No pude importar eso: ${error.message}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const payload = buildPayloadFromDraft(draft, interaction);
  const limitError = ensureEmbedLimits(payload.embeds);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  await sendOrPreview(interaction, payload, targetChannel);
}

async function handleEdit(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const messageId = interaction.options.getString('mensaje_id');
  const message = await targetChannel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    await interaction.reply({ content: '❌ No encontré ese mensaje en el canal indicado.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (message.author.id !== interaction.client.user.id) {
    await interaction.reply({ content: '❌ Solo puedo editar mensajes que yo mismo envié.', flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const newContent = interaction.options.getString('contenido');
  const buttonLabel = interaction.options.getString('boton_texto');
  const buttonUrl = interaction.options.getString('boton_url');

  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: '❌ Para cambiar el botón debes poner `boton_texto` y `boton_url` juntos.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: '❌ La URL del botón debe empezar con http:// o https://', flags: MessageFlags.Ephemeral });
    return;
  }

  const components = buttonLabel && buttonUrl ? [makeLinkButton(buttonLabel, buttonUrl)] : message.components;

  await message.edit({
    content: newContent !== null ? safeString(replacePlaceholders(newContent, interaction), 2000) : message.content,
    embeds: [embed],
    components,
    allowedMentions: { parse: [] }
  });

  await interaction.reply({ content: `✅ Embed editado correctamente en ${targetChannel}.`, flags: MessageFlags.Ephemeral });
}

async function handleJson(interaction) {
  const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;
  const targetError = validateMessageTarget(targetChannel);
  if (targetError) {
    await interaction.reply({ content: `❌ ${targetError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const permissionError = getBotPermissionError(targetChannel, interaction.client.user);
  if (permissionError) {
    await interaction.reply({ content: `❌ ${permissionError}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const raw = interaction.options.getString('json');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await interaction.reply({ content: '❌ JSON inválido. Revisa comas, comillas y llaves.', flags: MessageFlags.Ephemeral });
    return;
  }

  const rawEmbeds = Array.isArray(parsed.embeds) ? parsed.embeds : [parsed];
  const uniqueEmbeds = rawEmbeds.slice(0, 10).map(data => EmbedBuilder.from(localizeEmbedJson(data, interaction)));
  const limitError = ensureEmbedLimits(uniqueEmbeds);
  if (limitError) {
    await interaction.reply({ content: `❌ ${limitError}`, flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: `✅ Embed enviado correctamente en ${targetChannel}.`, flags: MessageFlags.Ephemeral });
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
    flags: MessageFlags.Ephemeral
  });
}
