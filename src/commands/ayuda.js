const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Muestra los comandos principales del bot.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#ff77dd')
      .setTitle('✨・Centro de ayuda')
      .setDescription('Bot premium para decorar tu servidor con bienvenidas, despedidas, anuncios y embeds.')
      .addFields(
        {
          name: '🌸 Bienvenidas',
          value: '`/config-bienvenida` configura canal, texto, color, imagen, GIF y prueba.'
        },
        {
          name: '🌙 Despedidas',
          value: '`/config-despedida` configura mensajes cuando alguien sale.'
        },
        {
          name: '📢 Anuncios',
          value: '`/anuncio` envía un anuncio bonito con rol, botón, imagen o GIF.'
        },
        {
          name: '🎨 Embeds',
          value: '`/embed` crea mensajes personalizados con decoración premium.'
        },
        {
          name: '🔧 Configuración',
          value: '`/config-ver` mira la config actual. `/config-reset` reinicia ajustes.'
        },
        {
          name: '🪄 Placeholders',
          value: '`{user}` `{user.username}` `{server}` `{memberCount}` `{createdAt}` `{joinedAt}`'
        }
      )
      .setFooter({ text: `${interaction.guild?.name || 'Discord'} ✦ Sistema premium` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
