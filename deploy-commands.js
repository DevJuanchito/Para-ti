import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN) throw new Error('DISCORD_TOKEN is missing in .env');
if (!CLIENT_ID) throw new Error('DISCORD_CLIENT_ID is missing in .env');

const commands = [
  new SlashCommandBuilder()
    .setName('code-create')
    .setDescription('Create or update a Roblox redeem code.')
    .addStringOption((option) =>
      option.setName('code').setDescription('Example: UPDATE1').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reward')
        .setDescription('Reward type')
        .setRequired(true)
        .addChoices(
          { name: 'Cash', value: 'Cash' },
          { name: 'Gems', value: 'Gems' },
        )
    )
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('Reward amount').setRequired(true).setMinValue(1)
    )
    .addIntegerOption((option) =>
      option.setName('maxuses').setDescription('Maximum total uses').setRequired(true).setMinValue(1)
    )
    .addIntegerOption((option) =>
      option.setName('expires_days').setDescription('Optional: expires in this many days').setRequired(false).setMinValue(1)
    )
    .addBooleanOption((option) =>
      option.setName('active').setDescription('Should the code start active?').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('code-list')
    .setDescription('List active Roblox redeem codes.')
    .addBooleanOption((option) =>
      option.setName('include_disabled').setDescription('Also show disabled codes?').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('code-info')
    .setDescription('Show information for one code.')
    .addStringOption((option) =>
      option.setName('code').setDescription('Code name').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('code-disable')
    .setDescription('Disable a Roblox redeem code.')
    .addStringOption((option) =>
      option.setName('code').setDescription('Code name').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('code-delete')
    .setDescription('Soft-delete a Roblox redeem code and remove it from the list.')
    .addStringOption((option) =>
      option.setName('code').setDescription('Code name').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

try {
  console.log('Refreshing Discord slash commands...');
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Guild slash commands registered.');
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Global slash commands registered.');
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
