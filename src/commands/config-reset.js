const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateGuildConfig } = require('../lib/configHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-reset')
    .setDescription('Reinicia configuración de bienvenida, despedida o todo.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('tipo')
        .setDescription('Qué configuración quieres reiniciar.')
        .setRequired(true)
        .addChoices(
          { name: 'bienvenida', value: 'welcome' },
          { name: 'despedida', value: 'farewell' },
          { name: 'todo', value: 'all' }
        )
    ),

  async execute(interaction) {
    const tipo = interaction.options.getString('tipo');
    const config = await getOrCreateGuildConfig(interaction.guildId);

    if (tipo === 'welcome' || tipo === 'all') {
      config.welcome = { enabled: false, channelId: null, color: '#ff77dd' };
    }

    if (tipo === 'farewell' || tipo === 'all') {
      config.farewell = { enabled: false, channelId: null, color: '#8a7cff' };
    }

    await config.save();

    return interaction.reply({
      content: `✅ Configuración reiniciada: **${tipo === 'all' ? 'todo' : tipo}**.`,
      ephemeral: true
    });
  }
};
