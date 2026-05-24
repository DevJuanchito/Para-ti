const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const { buildCustomEmbed, buildLinkButton } = require('../lib/embedFactory');
const { normalizeHexColor, isValidUrl } = require('../lib/validators');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Envía un anuncio premium con embed, GIF, rol y botón opcional.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal donde se enviará el anuncio.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('mensaje').setDescription('Contenido principal del anuncio.').setRequired(true).setMaxLength(4000)
    )
    .addStringOption(option =>
      option.setName('titulo').setDescription('Título del anuncio.').setMaxLength(256)
    )
    .addRoleOption(option =>
      option.setName('rol').setDescription('Rol a mencionar antes del embed.')
    )
    .addStringOption(option =>
      option.setName('color').setDescription('Color hexadecimal. Ejemplo: #ffd166')
    )
    .addStringOption(option =>
      option.setName('imagen').setDescription('URL de imagen o GIF grande.')
    )
    .addStringOption(option =>
      option.setName('thumbnail').setDescription('URL de miniatura.')
    )
    .addStringOption(option =>
      option.setName('footer').setDescription('Texto pequeño al final.').setMaxLength(2048)
    )
    .addStringOption(option =>
      option.setName('boton-texto').setDescription('Texto del botón con enlace.').setMaxLength(80)
    )
    .addStringOption(option =>
      option.setName('boton-url').setDescription('URL del botón.')
    ),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const mensaje = interaction.options.getString('mensaje');
    const titulo = interaction.options.getString('titulo') || '📢・Nuevo anuncio';
    const rol = interaction.options.getRole('rol');
    const colorInput = interaction.options.getString('color');
    const imagen = interaction.options.getString('imagen');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer') || `${interaction.guild.name} ✦ Anuncio oficial`;
    const botonTexto = interaction.options.getString('boton-texto');
    const botonUrl = interaction.options.getString('boton-url');

    const color = normalizeHexColor(colorInput, '#ffd166');
    if (colorInput && !color) {
      return interaction.reply({ content: '❌ Ese color no es válido. Usa formato `#ffd166`.', ephemeral: true });
    }

    if (!isValidUrl(imagen) || !isValidUrl(thumbnail) || !isValidUrl(botonUrl)) {
      return interaction.reply({ content: '❌ Imagen, thumbnail o botón deben usar URL `http` o `https` válida.', ephemeral: true });
    }

    if ((botonTexto && !botonUrl) || (!botonTexto && botonUrl)) {
      return interaction.reply({ content: '❌ Para usar botón debes poner `boton-texto` y `boton-url`.', ephemeral: true });
    }

    const embed = buildCustomEmbed({
      title: titulo,
      description: `╭・━━━━━━━━━━━━━━・╮\n${mensaje}\n╰・━━━━━━━━━━━━━━・╯`,
      color,
      image: imagen,
      thumbnail,
      footer,
      authorName: interaction.guild.name,
      authorIcon: interaction.guild.iconURL({ size: 256 })
    });

    const components = buildLinkButton(botonTexto, botonUrl);
    const content = rol ? `${rol}` : undefined;

    await canal.send({ content, embeds: [embed], components });

    return interaction.reply({
      content: `✅ Anuncio enviado en ${canal}.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
