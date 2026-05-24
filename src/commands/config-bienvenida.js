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
    .setName('config-bienvenida')
    .setDescription('Configura el mensaje premium de bienvenida.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(option =>
      option.setName('activo').setDescription('Activa o desactiva las bienvenidas.').setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal donde se enviarán las bienvenidas.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption(option =>
      option
        .setName('titulo')
        .setDescription('Título del embed. Usa {user}, {server}, {memberCount}.')
        .setMaxLength(256)
    )
    .addStringOption(option =>
      option
        .setName('descripcion')
        .setDescription('Texto del embed. Usa placeholders como {user} y {server}.')
        .setMaxLength(4000)
    )
    .addStringOption(option =>
      option.setName('color').setDescription('Color hexadecimal. Ejemplo: #ff77dd')
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

    const color = normalizeHexColor(colorInput);
    if (colorInput && !color) {
      return interaction.reply({ content: '❌ Ese color no es válido. Usa formato `#ff77dd`.', ephemeral: true });
    }

    if (!isValidUrl(imagen) || !isValidUrl(thumbnail)) {
      return interaction.reply({ content: '❌ La imagen o thumbnail debe ser una URL `http` o `https` válida.', ephemeral: true });
    }

    if (activo && !canal) {
      return interaction.reply({ content: '❌ Para activar bienvenidas debes elegir un canal.', ephemeral: true });
    }

    const config = await getOrCreateGuildConfig(interaction.guildId);
    config.welcome.enabled = activo;
    if (canal) config.welcome.channelId = canal.id;
    if (titulo !== null) config.welcome.title = titulo;
    if (descripcion !== null) config.welcome.description = descripcion;
    if (colorInput) config.welcome.color = color;
    if (imagen !== null) config.welcome.image = imagen || null;
    if (thumbnail !== null) config.welcome.thumbnail = thumbnail || null;
    if (footer !== null) config.welcome.footer = footer || null;
    await config.save();

    const targetChannel = canal || interaction.guild.channels.cache.get(config.welcome.channelId);

    if (probar && targetChannel?.isTextBased()) {
      const embed = buildMemberEmbed('welcome', config.welcome, interaction.member);
      await targetChannel.send({ embeds: [embed] });
    }

    return interaction.reply({
      content:
        `✅ Bienvenida configurada.\n` +
        `Estado: **${activo ? 'activada' : 'desactivada'}**\n` +
        `Canal: ${config.welcome.channelId ? `<#${config.welcome.channelId}>` : 'sin canal'}\n` +
        `Tip: puedes usar placeholders: \`{user}\`, \`{user.username}\`, \`{server}\`, \`{memberCount}\`, \`{createdAt}\`.`,
      ephemeral: true
    });
  }
};
