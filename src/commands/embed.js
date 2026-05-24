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
    .setName('embed')
    .setDescription('Crea y envía un embed personalizado bonito.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal donde se enviará el embed.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('descripcion').setDescription('Texto principal del embed.').setRequired(true).setMaxLength(4000)
    )
    .addStringOption(option =>
      option.setName('titulo').setDescription('Título del embed.').setMaxLength(256)
    )
    .addStringOption(option =>
      option.setName('color').setDescription('Color hexadecimal. Ejemplo: #00d4ff')
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
      option.setName('autor').setDescription('Nombre que aparece arriba del embed.').setMaxLength(256)
    )
    .addStringOption(option =>
      option.setName('boton-texto').setDescription('Texto del botón con enlace.').setMaxLength(80)
    )
    .addStringOption(option =>
      option.setName('boton-url').setDescription('URL del botón.')
    ),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const descripcion = interaction.options.getString('descripcion');
    const titulo = interaction.options.getString('titulo');
    const colorInput = interaction.options.getString('color');
    const imagen = interaction.options.getString('imagen');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const autor = interaction.options.getString('autor');
    const botonTexto = interaction.options.getString('boton-texto');
    const botonUrl = interaction.options.getString('boton-url');

    const color = normalizeHexColor(colorInput, '#00d4ff');
    if (colorInput && !color) {
      return interaction.reply({ content: '❌ Ese color no es válido. Usa formato `#00d4ff`.', ephemeral: true });
    }

    if (!isValidUrl(imagen) || !isValidUrl(thumbnail) || !isValidUrl(botonUrl)) {
      return interaction.reply({ content: '❌ Imagen, thumbnail o botón deben usar URL `http` o `https` válida.', ephemeral: true });
    }

    if ((botonTexto && !botonUrl) || (!botonTexto && botonUrl)) {
      return interaction.reply({ content: '❌ Para usar botón debes poner `boton-texto` y `boton-url`.', ephemeral: true });
    }

    const embed = buildCustomEmbed({
      title: titulo,
      description: descripcion,
      color,
      image: imagen,
      thumbnail,
      footer,
      authorName: autor,
      authorIcon: interaction.user.displayAvatarURL({ size: 256 })
    });

    await canal.send({ embeds: [embed], components: buildLinkButton(botonTexto, botonUrl) });

    return interaction.reply({
      content: `✅ Embed enviado en ${canal}.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
