const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getOrCreateGuildConfig, formatConfigLine } = require('../lib/configHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-ver')
    .setDescription('Muestra la configuración actual del bot en este servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getOrCreateGuildConfig(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#b388ff')
      .setTitle('⚙️・Configuración del bot')
      .setDescription('Aquí tienes el estado actual de bienvenidas y despedidas.')
      .addFields(
        { name: '🌸 Bienvenida', value: formatConfigLine('Sistema', config.welcome), inline: false },
        { name: '🌙 Despedida', value: formatConfigLine('Sistema', config.farewell), inline: false }
      )
      .setFooter({ text: `${interaction.guild.name} ✦ Panel de configuración` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
