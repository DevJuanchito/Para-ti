import 'dotenv/config';
import { Client, GatewayIntentBits, Events, EmbedBuilder } from 'discord.js';
import {
  normalizeCode,
  saveCode,
  getCode,
  listCodes,
  deleteCode,
  updateEntry,
  codeEntryId,
} from './opencloud.js';

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_USER_IDS = (process.env.DISCORD_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const ADMIN_ROLE_ID = (process.env.DISCORD_ADMIN_ROLE_ID || '').trim();

if (!TOKEN) throw new Error('DISCORD_TOKEN is missing in .env');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function isAllowed(interaction) {
  if (ADMIN_USER_IDS.includes(interaction.user.id)) return true;
  if (ADMIN_ROLE_ID && interaction.member?.roles?.cache?.has?.(ADMIN_ROLE_ID)) return true;
  // Also allow Discord users who have the permission exposed by the command default permission.
  return interaction.memberPermissions?.has?.('ManageGuild') === true;
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Nunca';
  return `<t:${expiresAt}:R>`;
}

function formatCodeLine(code) {
  const uses = `${code.CurrentUses || 0}/${code.MaxUses || 0}`;
  const status = code.Active ? 'Activo' : 'Desactivado';
  return `**${code.Code}** — ${code.Amount} ${code.RewardType} — Usos: ${uses} — ${status} — Expira: ${formatExpiry(code.ExpiresAt)}`;
}

function codeEmbed(code, title = 'Código') {
  return new EmbedBuilder()
    .setTitle(`${title}: ${code.Code}`)
    .setColor(code.Active ? 0x57f287 : 0xed4245)
    .addFields(
      { name: 'Premio', value: `${code.Amount} ${code.RewardType}`, inline: true },
      { name: 'Usos', value: `${code.CurrentUses || 0}/${code.MaxUses || 0}`, inline: true },
      { name: 'Estado', value: code.Active ? 'Activo' : 'Desactivado', inline: true },
      { name: 'Expira', value: formatExpiry(code.ExpiresAt), inline: true },
      { name: 'Creado por', value: code.CreatedBy || 'Desconocido', inline: true },
    )
    .setTimestamp(new Date());
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!isAllowed(interaction)) {
    await interaction.reply({ content: 'No tienes permiso para usar comandos de códigos.', ephemeral: true });
    return;
  }

  try {
    if (interaction.commandName === 'code-create') {
      await interaction.deferReply({ ephemeral: true });

      const code = normalizeCode(interaction.options.getString('code', true));
      const reward = interaction.options.getString('reward', true);
      const amount = interaction.options.getInteger('amount', true);
      const maxUses = interaction.options.getInteger('maxuses', true);
      const expiresDays = interaction.options.getInteger('expires_days') || 0;
      const active = interaction.options.getBoolean('active');
      const now = Math.floor(Date.now() / 1000);

      if (!code) {
        await interaction.editReply('Código inválido. Usa letras, números, _ o -.');
        return;
      }

      const existing = await getCode(code);
      const saved = await saveCode({
        ...(existing || {}),
        Code: code,
        RewardType: reward,
        Amount: amount,
        MaxUses: maxUses,
        CurrentUses: existing?.CurrentUses || 0,
        Active: active === null ? true : active,
        CreatedBy: existing?.CreatedBy || `Discord:${interaction.user.tag}`,
        CreatedAt: existing?.CreatedAt || now,
        UpdatedAt: now,
        ExpiresAt: expiresDays > 0 ? now + expiresDays * 86400 : 0,
        RedeemedUsers: existing?.RedeemedUsers || {},
      });

      await interaction.editReply({ embeds: [codeEmbed(saved, existing ? 'Código actualizado' : 'Código creado')] });
      return;
    }

    if (interaction.commandName === 'code-list') {
      await interaction.deferReply({ ephemeral: true });
      const includeDisabled = interaction.options.getBoolean('include_disabled') || false;
      const codes = await listCodes({ includeDisabled });

      if (codes.length === 0) {
        await interaction.editReply('No hay códigos para mostrar.');
        return;
      }

      const chunks = [];
      let current = '';
      for (const code of codes) {
        const line = formatCodeLine(code) + '\n';
        if ((current + line).length > 3500) {
          chunks.push(current);
          current = '';
        }
        current += line;
      }
      if (current) chunks.push(current);

      const embed = new EmbedBuilder()
        .setTitle(includeDisabled ? 'Códigos' : 'Códigos activos')
        .setDescription(chunks[0])
        .setColor(0x5865f2)
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });

      for (const extra of chunks.slice(1)) {
        await interaction.followUp({ embeds: [new EmbedBuilder().setDescription(extra).setColor(0x5865f2)], ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === 'code-info') {
      const code = normalizeCode(interaction.options.getString('code', true));
      const entry = await getCode(code);
      if (!entry) {
        await interaction.reply({ content: `No encontré el código **${code}**.`, ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [codeEmbed(entry, 'Info')], ephemeral: true });
      return;
    }

    if (interaction.commandName === 'code-disable') {
      await interaction.deferReply({ ephemeral: true });
      const code = normalizeCode(interaction.options.getString('code', true));
      const entry = await getCode(code);
      if (!entry) {
        await interaction.editReply(`No encontré el código **${code}**.`);
        return;
      }
      entry.Active = false;
      entry.UpdatedAt = Math.floor(Date.now() / 1000);
      await updateEntry(codeEntryId(code), entry, true);
      await interaction.editReply({ embeds: [codeEmbed(entry, 'Código desactivado')] });
      return;
    }

    if (interaction.commandName === 'code-delete') {
      await interaction.deferReply({ ephemeral: true });
      const code = normalizeCode(interaction.options.getString('code', true));
      const deleted = await deleteCode(code);
      if (!deleted) {
        await interaction.editReply(`No encontré el código **${code}**.`);
        return;
      }
      await interaction.editReply(`Código **${code}** eliminado de la lista y desactivado.`);
      return;
    }
  } catch (error) {
    console.error(error);
    const message = `Error: ${error.message || error}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message.slice(0, 1900));
    } else {
      await interaction.reply({ content: message.slice(0, 1900), ephemeral: true });
    }
  }
});

client.login(TOKEN);
