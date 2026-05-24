const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const { getOrCreateGuildConfig } = require('../lib/configHelpers');
const { normalizeHexColor, isValidUrl } = require('../lib/validators');
const { buildMemberEmbed } = require('../lib/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-despedida')
    .setDescription('Configura el mensaje premium de despedida.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(option =>
      option.setName('activo').setDescription('Activa o desactiva las despedidas.').setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal donde se enviarán las despedidas.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(option =>
      option
        .setName('titulo')
        .setDescription('Título del embed. Usa {user.username}, {server}, {memberCount}.')
        .setMaxLength(256)
    )
    .addStringOption(option =>
      option
        .setName('descripcion')
        .setDescription('Texto del embed. Usa placeholders como {user.username} y {server}.')
        .setMaxLength(4000)
    )
    .addStringOption(option =>
      option.setName('color').setDescription('Color hexadecimal. Ejemplo: #8a7cff')
    )
    .addStringOption(option =>
      option.setName('imagen').setDescription('URL de imagen o GIF grande para el embed.')
    )
    .addStringOption(option =>
      option.setName('thumbnail').setDescription('URL de miniatura. Si lo dejas vacío, usa avatar.')
    )
    .addStringOption(option =>
      option.setName('footer').setDescription('Texto pequeño al final del embed.').setMaxLength(2048)
    )
    .addBooleanOption(option =>
      option.setName('probar').setDescription('Envía una prueba al canal configurado.')
    ),

  async execute(interaction) {
    const activo = interaction.options.getBoolean('activo');
    const canal = interaction.options.getChannel('canal');
    const titulo = interaction.options.getString('titulo');
    const descripcion = interaction.options.getString('descripcion');
    const colorInput = interaction.options.getString('color');
    const imagen = interaction.options.getString('imagen');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const probar = interaction.options.getBoolean('probar') ?? false;

    const color = normalizeHexColor(colorInput, '#8a7cff');
    if (colorInput && !color) {
      return interaction.reply({ content: '❌ Ese color no es válido. Usa formato `#8a7cff`.', ephemeral: true });
    }

    if (!isValidUrl(imagen) || !isValidUrl(thumbnail)) {
      return interaction.reply({ content: '❌ La imagen o thumbnail debe ser una URL `http` o `https` válida.', ephemeral: true });
    }

    if (activo && !canal) {
      return interaction.reply({ content: '❌ Para activar despedidas debes elegir un canal.', ephemeral: true });
    }

    const config = await getOrCreateGuildConfig(interaction.guildId);
    config.farewell.enabled = activo;
    if (canal) config.farewell.channelId = canal.id;
    if (titulo !== null) config.farewell.title = titulo;
    if (descripcion !== null) config.farewell.description = descripcion;
    if (colorInput) config.farewell.color = color;
    if (imagen !== null) config.farewell.image = imagen || null;
    if (thumbnail !== null) config.farewell.thumbnail = thumbnail || null;
    if (footer !== null) config.farewell.footer = footer || null;
    await config.save();

    const targetChannel = canal || interaction.guild.channels.cache.get(config.farewell.channelId);

    if (probar && targetChannel?.isTextBased()) {
      const embed = buildMemberEmbed('farewell', config.farewell, interaction.member);
      await targetChannel.send({ embeds: [embed] });
    }

    return interaction.reply({
      content:
        `✅ Despedida configurada.\n` +
        `Estado: **${activo ? 'activada' : 'desactivada'}**\n` +
        `Canal: ${config.farewell.channelId ? `<#${config.farewell.channelId}>` : 'sin canal'}.`,
      ephemeral: true
    });
  }
};
