/*
  🎧 JUANPLAY DEVJUANCHO PÚBLICO v8
  Creado para DEVJUANCHO / JuanStudio
  Discord Music Bot con comandos slash, yt-dlp, recomendaciones, paneles decorados,
  cola completa paginada, anti-spam, botones de control y actividad dinámica.
*/

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ActivityType,
  MessageFlags,
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  getVoiceConnection,
} = require('@discordjs/voice');

const ytdlp = require('youtube-dl-exec');
const yts = require('yt-search');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegPath;

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID || '';
const VOICE_TIMEOUT_MS = Number(process.env.VOICE_TIMEOUT_MS || 120000);
const VOICE_SELF_DEAF = String(process.env.VOICE_SELF_DEAF || 'true').toLowerCase() !== 'false';
const DEFAULT_VOLUME = Math.max(1, Math.min(200, Number(process.env.DEFAULT_VOLUME || 85))) / 100;
const MAX_PLAYLIST_ITEMS = Math.max(1, Math.min(100, Number(process.env.MAX_PLAYLIST_ITEMS || 25)));
const MAX_QUEUE_SIZE = Math.max(10, Math.min(1000, Number(process.env.MAX_QUEUE_SIZE || 500)));
const COMMAND_COOLDOWN_MS = Math.max(0, Number(process.env.COMMAND_COOLDOWN_MS || 2500));
const ANNOUNCE_NOW_PLAYING = String(process.env.ANNOUNCE_NOW_PLAYING || 'false').toLowerCase() === 'true';
const QUEUE_ITEMS_PER_PAGE = Math.max(5, Math.min(20, Number(process.env.QUEUE_ITEMS_PER_PAGE || 10)));
const BOT_COLOR = process.env.BOT_COLOR || '#ff2f7d';
const SUCCESS_COLOR = process.env.SUCCESS_COLOR || '#2ecc71';
const WARNING_COLOR = process.env.WARNING_COLOR || '#f1c40f';
const ERROR_COLOR = process.env.ERROR_COLOR || '#ff2f7d';
const BOT_NAME = process.env.BOT_NAME || 'JUANPLAY';
const BOT_VERSION = '8.0.0';
const BRAND = process.env.BOT_BRAND || 'DEVJUANCHO • JuanStudio';
const BOT_INVITE_URL = process.env.BOT_INVITE_URL || '';
const SUPPORT_SERVER = process.env.SUPPORT_SERVER || '';
const WEBSITE_URL = process.env.WEBSITE_URL || '';
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const EPHEMERAL = MessageFlags.Ephemeral;

if (!TOKEN) {
  console.error('❌ Falta DISCORD_TOKEN en Railway → Variables.');
  process.exit(1);
}

const cookieFile = prepareCookieFile(process.env.YOUTUBE_COOKIE || process.env.YOUTUBE_COOKIES || '');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const queues = new Map();
const searchCache = new Map();
const commandCooldowns = new Map();
let lastPresenceText = '';
let lastPresenceAt = 0;
let pendingPresenceTimer = null;

setInterval(cleanSearchCache, 5 * 60 * 1000).unref();
setInterval(cleanCommandCooldowns, 10 * 60 * 1000).unref();

function makeEmbed(title, description, color = BOT_COLOR) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || '')
    .setFooter({ text: `${BRAND} • ${BOT_NAME} v${BOT_VERSION}` })
    .setTimestamp();

  const icon = client.user?.displayAvatarURL?.({ size: 128 });
  if (icon) embed.setAuthor({ name: `${BOT_NAME} Music System`, iconURL: icon });
  return embed;
}

function okEmbed(title, description) {
  return makeEmbed(`✅ ${title}`, description, SUCCESS_COLOR);
}

function warnEmbed(title, description) {
  return makeEmbed(`⚠️ ${title}`, description, WARNING_COLOR);
}

function errEmbed(title, description) {
  return makeEmbed(`❌ ${title}`, description, ERROR_COLOR);
}

function musicEmbed(title, description) {
  return makeEmbed(`🎧 ${title}`, description, BOT_COLOR);
}

function premiumLine(label, value) {
  return `**${label}:** ${value}`;
}

function nowPlayingEmbed(track, q = null) {
  const elapsedMs = q?.player?.state?.playbackDuration || 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const totalSec = parseDurationSeconds(track.duration);
  const bar = totalSec ? `\n${buildProgressBar(elapsedSec, totalSec)}\n\`${formatDuration(elapsedSec)} / ${track.duration}\`` : '';
  const queueCount = q ? q.tracks.length : 0;
  const requester = track.requestedBy ? `**${escapeMd(track.requestedBy)}**` : '**alguien**';

  const embed = musicEmbed(
    `${BOT_NAME} está sonando`,
    [
      `╭─ **Canción actual**`,
      `│ 💿 **[${escapeMd(track.title)}](${track.url})**`,
      `│ 👤 Pedido por: ${requester}`,
      `│ ⏱️ Duración: **${track.duration || 'desconocida'}**`,
      `│ 🌐 Fuente: **${escapeMd(track.source || 'yt-dlp')}**`,
      `│ 📜 En cola: **${queueCount}**`,
      `╰─ ${bar || '✨ Usa los botones para controlar el reproductor.'}`,
    ].join('\n')
  );
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function queueEmbed(q, page = 0) {
  const totalPages = getQueuePages(q);
  const safePage = clamp(page, 0, Math.max(0, totalPages - 1));
  const start = safePage * QUEUE_ITEMS_PER_PAGE;
  const visible = q.tracks.slice(start, start + QUEUE_ITEMS_PER_PAGE);
  const status = getPlayerStatusText(q);
  const lines = [];

  lines.push(`╭─ **Panel de cola ${BOT_NAME}**`);
  lines.push(`│ ${status}`);
  lines.push(`│ 🔊 Volumen: **${Math.round(q.volume * 100)}%**`);
  lines.push(`│ 📜 Próximas canciones: **${q.tracks.length}/${MAX_QUEUE_SIZE}**`);
  lines.push(`╰─ Página **${safePage + 1}/${totalPages}**`);
  lines.push('');

  if (q.current) {
    lines.push(`🎧 **Actual:** [${escapeMd(q.current.title)}](${q.current.url})`);
    lines.push('');
  }

  if (!q.tracks.length) {
    lines.push('✨ La cola está vacía. Usa `/play` o `/buscar` para agregar música.');
  } else {
    lines.push(visible.map((track, i) => trackLine(track, start + i + 1)).join('\n'));
  }

  const embed = musicEmbed('Cola completa', lines.join('\n'));
  if (q.current?.thumbnail) embed.setThumbnail(q.current.thumbnail);
  return embed;
}

function helpEmbed() {
  return musicEmbed('Centro de comandos', [
    '╭─ **Música**',
    '│ `/play busqueda` — reproduce por nombre o link.',
    '│ `/juanplay busqueda` — comando principal personalizado.',
    '│ `/buscar busqueda` — recomendados con botones.',
    '│ `/recomendados busqueda` — igual que buscar, con diseño bonito.',
    '│ `/nowplaying` o `/np` — canción actual.',
    '╰─ `/panel` — panel rápido con controles.',
    '',
    '╭─ **Cola y controles**',
    '│ `/queue pagina` o `/cola pagina` — mira toda la cola por páginas.',
    '│ `/clearqueue` o `/limpiarcola` — vacía la cola sin parar la canción actual.',
    '│ `/skip` `/stop` `/pause` `/resume` — controles rápidos.',
    '│ `/volume numero` — volumen 1 a 200.',
    '╰─ `/leave` — saca el bot del canal de voz.',
    '',
    '╭─ **Bot público**',
    '│ `/testvoz` — prueba conexión al canal de voz.',
    '│ `/diagnostico` — revisa estado y variables.',
    '│ `/plataformas` — links compatibles.',
    '│ `/setup` — configuración recomendada.',
    '│ `/invite` — enlace de invitación si está configurado.',
    '╰─ `/creditos` — créditos DEVJUANCHO.',
  ].join('\n'));
}

function platformsEmbed() {
  return musicEmbed('Plataformas compatibles', [
    '✅ **YouTube** por nombre, link y playlist.',
    '✅ **SoundCloud** por link.',
    '✅ **Links directos** `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`, `.webm`.',
    '✅ **Spotify / Apple Music / Deezer / Tidal**: toma el nombre del link y busca la canción en YouTube.',
    '✅ Muchas páginas soportadas por **yt-dlp**.',
    '',
    '⚠️ Puede funcionar **sin cookie**. Si YouTube tira **429**, agrega `YOUTUBE_COOKIE` nueva en Railway.',
  ].join('\n'));
}

function setupEmbed() {
  return musicEmbed('Setup recomendado para Discord + Railway', [
    '╭─ **OAuth2**',
    '│ Scopes: `bot` y `applications.commands`.',
    '│ Permisos: Ver canales, Enviar mensajes, Insertar enlaces, Leer historial, Usar comandos slash, Conectarse y Hablar.',
    '╰─ Reinvita el bot si los comandos no aparecen.',
    '',
    '╭─ **Variables Railway**',
    '│ `DISCORD_TOKEN` obligatorio.',
    '│ `GUILD_ID` recomendado para comandos instantáneos.',
    '│ `ANNOUNCE_NOW_PLAYING=false` evita spam automático por cada canción.',
    '│ `COMMAND_COOLDOWN_MS=2500` evita spam de comandos.',
    '│ `MAX_QUEUE_SIZE=500` protege servidores públicos.',
    '│ `BOT_INVITE_URL` opcional para `/invite`.',
    '╰─ `YOUTUBE_COOKIE` solo si YouTube bloquea con 429.',
    '',
    '🎨 **Perfil del bot:** avatar, banner y descripción se cambian en Discord Developer Portal. Desde el código sí se actualiza la actividad dinámica.',
  ].join('\n'));
}

function creditsEmbed() {
  return musicEmbed('Créditos', [
    '👑 **DEVJUANCHO**',
    '🏗️ **JuanStudio**',
    `🎧 **${BOT_NAME} Music Bot Público v${BOT_VERSION}**`,
    '',
    'Decorado, optimizado para público, con actividad dinámica, anti-spam y cola completa paginada.',
  ].join('\n'));
}

function inviteEmbed() {
  const lines = [];
  if (BOT_INVITE_URL) lines.push(`🔗 **Invita el bot:** ${BOT_INVITE_URL}`);
  else lines.push('⚠️ No hay enlace configurado. Agrega `BOT_INVITE_URL` en Railway para que `/invite` lo muestre.');
  if (SUPPORT_SERVER) lines.push(`🛟 **Soporte:** ${SUPPORT_SERVER}`);
  if (WEBSITE_URL) lines.push(`🌐 **Web:** ${WEBSITE_URL}`);
  lines.push('', 'Permisos recomendados: `bot` + `applications.commands`.');
  return musicEmbed(`Invitar ${BOT_NAME}`, lines.join('\n'));
}

function trackLine(track, index) {
  const duration = track.duration || '??';
  const requester = track.requestedBy ? ` • 👤 ${escapeMd(track.requestedBy)}` : '';
  return `**${index}.** [${escapeMd(track.title)}](${track.url}) — \`${duration}\`${requester}`;
}

function playerControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jp_ctrl:pause').setEmoji('⏸️').setLabel('Pausar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('jp_ctrl:resume').setEmoji('▶️').setLabel('Seguir').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('jp_ctrl:skip').setEmoji('⏭️').setLabel('Saltar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('jp_ctrl:queue').setEmoji('📜').setLabel('Cola').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('jp_ctrl:stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
  );
}

function queueControlsRow(page, totalPages, queueLength) {
  const safePage = clamp(page, 0, Math.max(0, totalPages - 1));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`jp_queue:${safePage}:prev`)
      .setEmoji('⬅️')
      .setLabel('Atrás')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`jp_queue:${safePage}:refresh`)
      .setEmoji('🔄')
      .setLabel('Actualizar')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`jp_queue:${safePage}:next`)
      .setEmoji('➡️')
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`jp_queue:${safePage}:clear`)
      .setEmoji('🧹')
      .setLabel('Vaciar cola')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(queueLength <= 0)
  );
}

function queueComponents(q, page = 0) {
  const totalPages = getQueuePages(q);
  return [queueControlsRow(page, totalPages, q.tracks.length), playerControlsRow()];
}

function searchPickRows(results, id) {
  const rows = [];
  for (let row = 0; row < Math.ceil(results.length / 5); row++) {
    const actionRow = new ActionRowBuilder();
    for (let i = row * 5; i < Math.min(results.length, row * 5 + 5); i++) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`jp_pick:${id}:${i}`)
          .setLabel(`${i + 1}`)
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

function escapeMd(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}

function cleanInput(input) {
  return String(input || '').trim().replace(/^<|>$/g, '').trim();
}

function isUrl(input) {
  return /^https?:\/\//i.test(cleanInput(input));
}

function isMusicServiceThatNeedsSearch(url) {
  return /open\.spotify\.com|music\.apple\.com|deezer\.page\.link|deezer\.com|tidal\.com|music\.amazon\.|pandora\.com/i.test(url);
}

function directAudioUrl(url) {
  return /\.(mp3|m4a|wav|ogg|opus|flac|aac|webm)(\?|#|$)/i.test(url);
}

function hasModule(name) {
  try {
    require.resolve(name);
    return true;
  } catch (_) {
    return false;
  }
}

function youtubePlaylistUrl(url) {
  return /[?&]list=/i.test(url) && /youtube\.com|youtu\.be/i.test(url);
}

function commonYtDlpFlags(extra = {}) {
  const flags = {
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    addHeader: [
      `user-agent:${USER_AGENT}`,
      'referer:https://www.youtube.com/',
      'accept-language:es-ES,es;q=0.9,en;q=0.8',
    ],
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    socketTimeout: 20,
    ...extra,
  };
  if (cookieFile) flags.cookies = cookieFile;
  return flags;
}

function prepareCookieFile(rawCookie) {
  const raw = String(rawCookie || '').trim();
  if (!raw) return null;

  const out = path.join(os.tmpdir(), 'juanplay-youtube-cookies.txt');

  try {
    if (raw.startsWith('# Netscape HTTP Cookie File') || raw.includes('\t.youtube.com\t')) {
      fs.writeFileSync(out, raw, 'utf8');
      console.log('🍪 YOUTUBE_COOKIE cargada como cookies.txt Netscape.');
      return out;
    }

    const cleaned = raw.replace(/^cookie\s*:?\s*/i, '').replace(/^Cookie\s*:\s*/i, '').trim();
    const rows = ['# Netscape HTTP Cookie File', '# Generado automáticamente por JUANPLAY. No compartas este archivo.'];
    for (const part of cleaned.split(';')) {
      const [name, ...valueParts] = part.trim().split('=');
      const value = valueParts.join('=');
      if (!name || !value) continue;
      rows.push(`.youtube.com\tTRUE\t/\tTRUE\t2147483647\t${name.trim()}\t${value.trim()}`);
      rows.push(`.google.com\tTRUE\t/\tTRUE\t2147483647\t${name.trim()}\t${value.trim()}`);
    }
    fs.writeFileSync(out, `${rows.join('\n')}\n`, 'utf8');
    console.log('🍪 YOUTUBE_COOKIE cargada y convertida a cookies.txt.');
    return out;
  } catch (error) {
    console.warn('⚠️ No pude preparar YOUTUBE_COOKIE:', error.message);
    return null;
  }
}

function getQueue(guildId) {
  let q = queues.get(guildId);
  if (q) return q;

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });

  q = {
    guildId,
    textChannel: null,
    voiceChannelId: null,
    connection: null,
    player,
    tracks: [],
    current: null,
    history: [],
    volume: DEFAULT_VOLUME,
    locked: false,
    lastError: null,
  };

  player.on(AudioPlayerStatus.Idle, () => {
    if (q.current) q.history.unshift({ ...q.current, process: null });
    if (q.history.length > 25) q.history.length = 25;
    stopTrackProcess(q.current);
    q.current = null;
    refreshPresence();
    setTimeout(() => playNext(guildId).catch(console.error), 350);
  });

  player.on('error', (error) => {
    q.lastError = error;
    console.error('[JUANPLAY] Error del reproductor:', error);
    if (q.textChannel && ANNOUNCE_NOW_PLAYING) {
      q.textChannel.send({
        embeds: [errEmbed('Error reproduciendo', `Falló el stream actual. Paso a la siguiente canción.\n\n\`${cut(error.message || error, 900)}\``)],
      }).catch(() => {});
    }
    stopTrackProcess(q.current);
    q.current = null;
    refreshPresence();
    setTimeout(() => playNext(guildId).catch(console.error), 750);
  });

  queues.set(guildId, q);
  return q;
}

function stopTrackProcess(track) {
  if (!track || !track.process) return;
  try {
    if (!track.process.killed) track.process.kill('SIGKILL');
  } catch (_) {}
  track.process = null;
}

async function ensureVoice(interaction, q) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) throw new Error('Primero entra a un canal de voz.');

  const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) throw new Error('No tengo permiso **Ver canales** en ese canal de voz.');
  if (!permissions?.has(PermissionFlagsBits.Connect)) throw new Error('No tengo permiso **Conectarse** en ese canal de voz.');
  if (!permissions?.has(PermissionFlagsBits.Speak)) throw new Error('No tengo permiso **Hablar** en ese canal de voz.');

  q.voiceChannelId = voiceChannel.id;
  q.textChannel = interaction.channel;

  const existing = getVoiceConnection(interaction.guild.id);
  if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
    q.connection = existing;
    existing.subscribe(q.player);
    if (existing.state.status === VoiceConnectionStatus.Ready) return existing;
    await entersState(existing, VoiceConnectionStatus.Ready, VOICE_TIMEOUT_MS);
    return existing;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: VOICE_SELF_DEAF,
    selfMute: false,
  });

  q.connection = connection;
  connection.subscribe(q.player);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch (_) {
      try { connection.destroy(); } catch (_) {}
      if (q.connection === connection) q.connection = null;
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, VOICE_TIMEOUT_MS);
  return connection;
}

function requireSameVoice(interaction, q) {
  const memberVoiceId = interaction.member?.voice?.channelId;
  if (!q.voiceChannelId) return null;
  if (!memberVoiceId) return 'Debes estar en el canal de voz para usar este control.';
  if (memberVoiceId !== q.voiceChannelId) return 'Debes estar en el mismo canal de voz que el bot para controlar la música.';
  return null;
}

async function playNext(guildId) {
  const q = getQueue(guildId);
  if (q.locked) return;
  if (q.current) return;

  const next = q.tracks.shift();
  if (!next) {
    refreshPresence();
    return;
  }

  q.locked = true;
  q.current = next;

  try {
    if (!q.connection || q.connection.state.status === VoiceConnectionStatus.Destroyed) {
      if (!q.voiceChannelId) throw new Error('No hay canal de voz guardado. Usa /play desde un canal de voz.');
      const channel = await client.channels.fetch(q.voiceChannelId);
      if (!channel) throw new Error('No encontré el canal de voz.');
      q.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: VOICE_SELF_DEAF,
        selfMute: false,
      });
      q.connection.subscribe(q.player);
      await entersState(q.connection, VoiceConnectionStatus.Ready, VOICE_TIMEOUT_MS);
    }

    const resource = await createYtDlpAudioResource(next);
    if (resource.volume) resource.volume.setVolume(q.volume);
    next.startedAt = Date.now();
    q.player.play(resource);
    refreshPresence();

    if (q.textChannel && ANNOUNCE_NOW_PLAYING) {
      q.textChannel.send({ embeds: [nowPlayingEmbed(next, q)], components: [playerControlsRow()] }).catch(() => {});
    }
  } catch (error) {
    q.lastError = error;
    console.error('[JUANPLAY] No pude iniciar canción:', error);
    if (q.textChannel) {
      q.textChannel.send({
        embeds: [errEmbed('No pude reproducir esa canción', buildPlaybackError(error))],
      }).catch(() => {});
    }
    stopTrackProcess(next);
    q.current = null;
    q.locked = false;
    refreshPresence();
    setTimeout(() => playNext(guildId).catch(console.error), 800);
    return;
  }

  q.locked = false;
}

function buildPlaybackError(error) {
  const message = String(error?.message || error || 'Error desconocido');
  if (/429|Too Many Requests/i.test(message)) {
    return 'YouTube bloqueó la IP del hosting con **429**.\n\n✅ Solución: agrega una **YOUTUBE_COOKIE nueva** en Railway usando una cuenta secundaria y haz redeploy.\n\nTambién puedes probar SoundCloud o un link directo `.mp3/.m4a/.wav`.';
  }
  if (/signalling|aborted|VoiceConnection|timed out|Ready/i.test(message)) {
    return `No pude conectar a Discord Voice.\n\nRevisa permisos del canal: **Ver canales, Conectarse y Hablar**.\nSi estás en Railway y queda en \`signalling\`, el hosting puede estar bloqueando Discord Voice/UDP.\n\nDetalle: \`${cut(message, 500)}\``;
  }
  return `Detalle: \`${cut(message, 900)}\``;
}

async function createYtDlpAudioResource(track) {
  const flags = commonYtDlpFlags({
    output: '-',
    format: 'bestaudio[ext=webm][acodec=opus]/bestaudio[acodec=opus]/bestaudio/best',
    noPlaylist: true,
    quiet: true,
  });

  const proc = ytdlp.exec(track.url, flags, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 50,
  });

  track.process = proc;

  let stderr = '';
  proc.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 4000) stderr = stderr.slice(-4000);
  });

  proc.on('close', (code) => {
    if (code && code !== 0) console.warn(`[JUANPLAY] yt-dlp cerró con código ${code}: ${cut(stderr, 700)}`);
  });

  proc.on('error', (error) => {
    console.warn('[JUANPLAY] Error lanzando yt-dlp:', error.message);
  });

  return createAudioResource(proc.stdout, {
    inputType: StreamType.Arbitrary,
    inlineVolume: true,
    metadata: track,
  });
}

async function resolveInput(input, limit = 1) {
  const query = cleanInput(input);
  if (!query) return [];

  if (isUrl(query)) {
    if (isMusicServiceThatNeedsSearch(query)) {
      const metaQuery = await queryFromMusicServiceLink(query);
      return searchYouTube(metaQuery || query, limit);
    }

    if (youtubePlaylistUrl(query)) {
      const list = await readPlaylist(query, Math.min(MAX_PLAYLIST_ITEMS, limit || MAX_PLAYLIST_ITEMS));
      if (list.length) return list;
    }

    const info = await readUrlInfo(query).catch((error) => {
      console.warn('[JUANPLAY] No pude leer link con yt-dlp, intento buscar por título:', error.message);
      return null;
    });

    if (info) {
      if (Array.isArray(info.entries) && info.entries.length) {
        return info.entries.slice(0, Math.min(MAX_PLAYLIST_ITEMS, limit || MAX_PLAYLIST_ITEMS)).map(normalizeInfo).filter(Boolean);
      }
      const normalized = normalizeInfo(info, query);
      if (normalized) return [normalized];
    }

    const metaQuery = await queryFromHtml(query);
    if (metaQuery && !directAudioUrl(query)) return searchYouTube(metaQuery, limit);

    if (directAudioUrl(query)) {
      return [{
        title: path.basename(new URL(query).pathname) || 'Audio directo',
        url: query,
        duration: 'directo',
        thumbnail: null,
        source: 'audio directo',
      }];
    }

    throw new Error('No pude leer ese link. Prueba otro link o escribe el nombre de la canción.');
  }

  return searchYouTube(query, limit);
}

async function readUrlInfo(url) {
  return ytdlp(url, commonYtDlpFlags({
    dumpSingleJson: true,
    skipDownload: true,
    noPlaylist: false,
    playlistEnd: MAX_PLAYLIST_ITEMS,
    quiet: true,
  }));
}

async function readPlaylist(url, limit) {
  const data = await ytdlp(url, commonYtDlpFlags({
    dumpSingleJson: true,
    skipDownload: true,
    flatPlaylist: true,
    yesPlaylist: true,
    playlistEnd: limit,
    quiet: true,
  })).catch((error) => {
    console.warn('[JUANPLAY] Error leyendo playlist:', error.message);
    return null;
  });
  if (!data?.entries?.length) return [];
  return data.entries.slice(0, limit).map(normalizeInfo).filter(Boolean);
}

function normalizeInfo(info, fallbackUrl = null) {
  if (!info) return null;
  const id = info.id || info.url;
  let url = info.webpage_url || info.original_url || fallbackUrl || info.url;
  if (!/^https?:\/\//i.test(String(url || '')) && id && /youtube|ytsearch/i.test(String(info.extractor || info.ie_key || ''))) {
    url = `https://www.youtube.com/watch?v=${id}`;
  }
  if (!/^https?:\/\//i.test(String(url || ''))) return null;

  return {
    title: info.title || info.fulltitle || info.alt_title || 'Canción sin título',
    url,
    duration: formatDuration(info.duration) || info.duration_string || info.timestamp || 'desconocida',
    thumbnail: info.thumbnail || (Array.isArray(info.thumbnails) ? info.thumbnails.at(-1)?.url : null),
    source: info.extractor_key || info.extractor || info.ie_key || 'yt-dlp',
  };
}

async function searchYouTube(query, limit = 1) {
  const clean = cleanSearchText(query);
  if (!clean) return [];

  const fast = await searchYouTubeFast(clean, limit).catch(() => []);
  if (fast.length) return fast;

  const data = await ytdlp(`ytsearch${limit}:${clean}`, commonYtDlpFlags({
    dumpSingleJson: true,
    skipDownload: true,
    flatPlaylist: true,
    quiet: true,
  })).catch((error) => {
    console.warn('[JUANPLAY] Error buscando con yt-dlp:', error.message);
    return null;
  });

  if (!data?.entries?.length) return [];
  return data.entries.map(normalizeInfo).filter(Boolean).slice(0, limit);
}

async function searchYouTubeFast(query, limit = 10) {
  const result = await withTimeout(yts.search(query), 5500);
  return (result?.videos || []).slice(0, limit).map((v) => ({
    title: v.title,
    url: v.url,
    duration: v.timestamp || formatDuration(v.seconds),
    thumbnail: v.thumbnail,
    source: 'YouTube',
  })).filter((v) => v.title && v.url);
}

async function queryFromMusicServiceLink(url) {
  const htmlTitle = await queryFromHtml(url).catch(() => null);
  if (htmlTitle) return htmlTitle;
  return null;
}

async function queryFromHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' },
    });
    const html = await res.text();
    const ogTitle = matchMeta(html, 'property', 'og:title') || matchMeta(html, 'name', 'twitter:title') || matchTitle(html);
    const artist = matchMeta(html, 'property', 'music:musician') || matchMeta(html, 'name', 'music:musician');
    const text = cleanSearchText(`${ogTitle || ''} ${artist || ''}`);
    return text || null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function matchMeta(html, attr, key) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${escapeRegex(key)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escapeRegex(key)}["'][^>]*>`, 'i');
  return decodeHtml((html.match(re)?.[1] || html.match(re2)?.[1] || '').trim());
}

function matchTitle(html) {
  return decodeHtml((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim());
}

function cleanSearchText(text) {
  return decodeHtml(String(text || ''))
    .replace(/\s+/g, ' ')
    .replace(/\s*[-|–—]\s*(Spotify|Apple Music|Deezer|TIDAL|YouTube Music|Official Music Video|Official Video|Lyrics|Letra).*$/i, '')
    .replace(/\((Official|Video Oficial|Lyrics|Letra|Audio|Visualizer)[^)]*\)/ig, '')
    .replace(/\[[^\]]*(Official|Lyrics|Letra|Audio|Visualizer)[^\]]*\]/ig, '')
    .trim();
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDurationSeconds(value) {
  const raw = String(value || '').trim();
  if (!raw || /desconocida|directo|live/i.test(raw)) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number(raw));
  const parts = raw.split(':').map((n) => Number(n));
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return null;
  const s = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildProgressBar(elapsed, total) {
  if (!total || total <= 0) return '';
  const size = 14;
  const safeElapsed = Math.max(0, Math.min(total, elapsed));
  const filled = Math.max(0, Math.min(size, Math.round((safeElapsed / total) * size)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
}

function cut(text, max = 1000) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, Number(number) || 0));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function getQueuePages(q) {
  return Math.max(1, Math.ceil(q.tracks.length / QUEUE_ITEMS_PER_PAGE));
}

function getPlayerStatusText(q) {
  const status = q.player.state.status;
  if (status === AudioPlayerStatus.Playing) return '🟢 Estado: **Reproduciendo**';
  if (status === AudioPlayerStatus.Paused) return '🟡 Estado: **Pausado**';
  if (status === AudioPlayerStatus.Buffering) return '🔵 Estado: **Cargando audio**';
  if (status === AudioPlayerStatus.AutoPaused) return '🟠 Estado: **Auto-pausado**';
  return '⚪ Estado: **En espera**';
}

function getActiveQueue() {
  for (const q of queues.values()) {
    if (q.current) return q;
  }
  return null;
}

function refreshPresence(force = false) {
  if (!client.user) return;
  const active = getActiveQueue();
  const paused = active?.player?.state?.status === AudioPlayerStatus.Paused;
  const text = active?.current
    ? `${paused ? '⏸️' : '🎶'} ${cut(active.current.title, 95)}`
    : `${BOT_NAME} • /play /buscar`;

  if (!force && text === lastPresenceText) return;

  const now = Date.now();
  const apply = () => {
    try {
      client.user.setActivity(text, { type: ActivityType.Listening });
      lastPresenceText = text;
      lastPresenceAt = Date.now();
    } catch (error) {
      console.warn('[JUANPLAY] No pude actualizar actividad:', error.message);
    }
  };

  if (force || now - lastPresenceAt > 12000) {
    clearTimeout(pendingPresenceTimer);
    pendingPresenceTimer = null;
    apply();
  } else {
    clearTimeout(pendingPresenceTimer);
    pendingPresenceTimer = setTimeout(apply, 12000 - (now - lastPresenceAt));
  }
}

function checkCommandCooldown(interaction) {
  if (!COMMAND_COOLDOWN_MS) return 0;
  const exempt = new Set(['queue', 'cola', 'nowplaying', 'np', 'diagnostico', 'help', 'ping']);
  if (exempt.has(interaction.commandName)) return 0;
  const key = `${interaction.guildId || 'dm'}:${interaction.user.id}:${interaction.commandName}`;
  const now = Date.now();
  const last = commandCooldowns.get(key) || 0;
  const remaining = COMMAND_COOLDOWN_MS - (now - last);
  if (remaining > 0) return remaining;
  commandCooldowns.set(key, now);
  return 0;
}

function cleanCommandCooldowns() {
  const now = Date.now();
  for (const [key, time] of commandCooldowns.entries()) {
    if (now - time > 30 * 60 * 1000) commandCooldowns.delete(key);
  }
}

async function handlePlay(interaction, query, fromButtonTrack = null) {
  await interaction.deferReply().catch(() => {});
  const q = getQueue(interaction.guild.id);

  try {
    await ensureVoice(interaction, q);

    let tracks;
    if (fromButtonTrack) {
      tracks = [fromButtonTrack];
    } else {
      tracks = await resolveInput(query, youtubePlaylistUrl(cleanInput(query)) ? MAX_PLAYLIST_ITEMS : 1);
    }

    if (!tracks.length) {
      return interaction.editReply({ embeds: [errEmbed('Sin resultados', 'No encontré esa canción. Prueba otro nombre o un link directo.')] });
    }

    const availableSlots = Math.max(0, MAX_QUEUE_SIZE - q.tracks.length);
    if (tracks.length > availableSlots) {
      tracks = tracks.slice(0, availableSlots);
      if (!tracks.length) {
        return interaction.editReply({ embeds: [warnEmbed('Cola llena', `La cola llegó al límite de **${MAX_QUEUE_SIZE}** canciones. Usa \`/clearqueue\` o espera que avance.`)] });
      }
    }

    for (const track of tracks) {
      track.requestedBy = interaction.user.username;
      track.requestedById = interaction.user.id;
      q.tracks.push(track);
    }

    const first = tracks[0];
    const description = tracks.length === 1
      ? [
        '╭─ **Agregada a la cola**',
        `│ 💿 **[${escapeMd(first.title)}](${first.url})**`,
        `│ 👤 Pedido por: **${escapeMd(interaction.user.username)}**`,
        `│ ⏱️ ${first.duration || 'desconocida'} • 🌐 ${first.source || 'YouTube'}`,
        `╰─ 📜 Posición: **${q.current ? q.tracks.length : 'reproduciendo ahora'}**`,
      ].join('\n')
      : [
        `╭─ **Playlist agregada**`,
        `│ Agregué **${tracks.length} canciones** a la cola.`,
        `│ Primera: **[${escapeMd(first.title)}](${first.url})**`,
        `╰─ Límite actual: **${MAX_QUEUE_SIZE}** canciones.`,
      ].join('\n');

    const embed = musicEmbed('Música agregada', description);
    if (first.thumbnail) embed.setThumbnail(first.thumbnail);

    await interaction.editReply({ embeds: [embed], components: [playerControlsRow()] });

    if (!q.current && q.player.state.status !== AudioPlayerStatus.Playing && q.player.state.status !== AudioPlayerStatus.Paused) {
      await playNext(interaction.guild.id);
    }
  } catch (error) {
    console.error('[JUANPLAY] Error en handlePlay:', error);
    const embed = errEmbed('No pude usar /play', buildPlaybackError(error));
    if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
    else await interaction.reply({ embeds: [embed], flags: EPHEMERAL }).catch(() => {});
  }
}

async function handleSearch(interaction) {
  const query = interaction.options.getString('busqueda', true);
  await interaction.deferReply();
  const results = await searchYouTube(query, 10);
  if (!results.length) return interaction.editReply({ embeds: [errEmbed('Sin recomendados', 'No encontré resultados para esa búsqueda.')] });

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  searchCache.set(id, { createdAt: Date.now(), results });

  const embed = musicEmbed('Recomendados premium', [
    `✨ Resultados para: **${escapeMd(query)}**`,
    '',
    results.map(trackLine).join('\n'),
    '',
    'Toca un botón para agregar la canción a la cola.',
  ].join('\n'));
  if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);

  return interaction.editReply({ embeds: [embed], components: searchPickRows(results, id) });
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'busqueda') return interaction.respond([]).catch(() => {});

  const query = cleanInput(focused.value);
  if (!query || query.length < 2 || isUrl(query)) {
    return interaction.respond([
      { name: 'Pega un link o escribe una canción', value: query || 'Paulo Londra No Puedo' },
    ]).catch(() => {});
  }

  try {
    const results = await withTimeout(searchYouTubeFast(query, 10), 2400);
    const choices = results.slice(0, 10).map((track) => ({
      name: cut(`🎵 ${track.title} • ${track.duration || '??'}`, 100),
      value: cut(track.title, 100),
    }));
    return interaction.respond(choices.length ? choices : [{ name: `Buscar: ${cut(query, 90)}`, value: cut(query, 100) }]).catch(() => {});
  } catch (_) {
    return interaction.respond([{ name: `Buscar: ${cut(query, 90)}`, value: cut(query, 100) }]).catch(() => {});
  }
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith('jp_pick:')) return handlePickButton(interaction);
  if (interaction.customId.startsWith('jp_ctrl:')) return handleControlButton(interaction);
  if (interaction.customId.startsWith('jp_queue:')) return handleQueueButton(interaction);
}

async function handlePickButton(interaction) {
  const [, id, indexRaw] = interaction.customId.split(':');
  const cached = searchCache.get(id);
  const index = Number(indexRaw);
  const track = cached?.results?.[index];
  if (!track) return interaction.reply({ embeds: [errEmbed('Botón expirado', 'Haz `/buscar` otra vez para generar recomendados nuevos.')], flags: EPHEMERAL });
  await handlePlay(interaction, track.title, { ...track });
}

async function handleControlButton(interaction) {
  const [, action] = interaction.customId.split(':');
  const q = getQueue(interaction.guild.id);

  if (action === 'queue') {
    return interaction.reply({ embeds: [queueEmbed(q, 0)], components: queueComponents(q, 0), flags: EPHEMERAL });
  }

  const sameVoiceError = requireSameVoice(interaction, q);
  if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });

  if (action === 'pause') {
    const ok = q.player.pause(true);
    refreshPresence(true);
    return interaction.reply({ embeds: [ok ? okEmbed('Pausado', 'La música quedó pausada.') : warnEmbed('No pude pausar', 'No hay música sonando.')], flags: EPHEMERAL });
  }

  if (action === 'resume') {
    const ok = q.player.unpause();
    refreshPresence(true);
    return interaction.reply({ embeds: [ok ? okEmbed('Reanudado', 'La música sigue sonando.') : warnEmbed('No pude reanudar', 'No hay música pausada.')], flags: EPHEMERAL });
  }

  if (action === 'skip') {
    if (!q.current) return interaction.reply({ embeds: [warnEmbed('Sin canción', 'No hay nada para saltar.')], flags: EPHEMERAL });
    q.player.stop(true);
    return interaction.reply({ embeds: [okEmbed('Saltado', 'Pasando a la siguiente canción.')], flags: EPHEMERAL });
  }

  if (action === 'stop') {
    q.tracks = [];
    stopTrackProcess(q.current);
    q.current = null;
    q.player.stop(true);
    refreshPresence(true);
    return interaction.reply({ embeds: [okEmbed('Detenido', 'Música detenida y cola limpiada.')], flags: EPHEMERAL });
  }
}

async function handleQueueButton(interaction) {
  const [, pageRaw, action] = interaction.customId.split(':');
  const q = getQueue(interaction.guild.id);
  let page = clamp(Number(pageRaw) || 0, 0, getQueuePages(q) - 1);

  if (action === 'clear') {
    const sameVoiceError = requireSameVoice(interaction, q);
    if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
    q.tracks = [];
    page = 0;
  } else if (action === 'next') {
    page += 1;
  } else if (action === 'prev') {
    page -= 1;
  }

  page = clamp(page, 0, getQueuePages(q) - 1);
  const title = action === 'clear' ? 'Cola vaciada' : 'Cola completa';
  const embed = queueEmbed(q, page).setTitle(`🎧 ${title}`);
  return interaction.update({ embeds: [embed], components: queueComponents(q, page) }).catch(() => {
    return interaction.reply({ embeds: [embed], components: queueComponents(q, page), flags: EPHEMERAL });
  });
}

function cleanSearchCache() {
  const now = Date.now();
  for (const [id, data] of searchCache.entries()) {
    if (now - data.createdAt > 15 * 60 * 1000) searchCache.delete(id);
  }
}

function buildCommands() {
  const playOption = (option) => option
    .setName('busqueda')
    .setDescription('Nombre o link: YouTube, SoundCloud, Spotify, Apple Music, Deezer, mp3, etc.')
    .setRequired(true)
    .setAutocomplete(true);

  const pageOption = (option) => option
    .setName('pagina')
    .setDescription('Número de página de la cola')
    .setRequired(false)
    .setMinValue(1);

  return [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('🎵 Reproduce música por nombre o link con JUANPLAY')
      .addStringOption(playOption),

    new SlashCommandBuilder()
      .setName('juanplay')
      .setDescription('🔥 Comando principal personalizado de DEVJUANCHO')
      .addStringOption(playOption),

    new SlashCommandBuilder()
      .setName('buscar')
      .setDescription('🔎 Muestra recomendados con botones para elegir canción')
      .addStringOption(playOption),

    new SlashCommandBuilder()
      .setName('recomendados')
      .setDescription('🎯 Recomendados bonitos para elegir rápido')
      .addStringOption(playOption),

    new SlashCommandBuilder().setName('queue').setDescription('📜 Muestra toda la cola por páginas').addIntegerOption(pageOption),
    new SlashCommandBuilder().setName('cola').setDescription('📜 Muestra toda la cola por páginas').addIntegerOption(pageOption),
    new SlashCommandBuilder().setName('nowplaying').setDescription('💿 Muestra la canción actual'),
    new SlashCommandBuilder().setName('np').setDescription('💿 Muestra la canción actual'),
    new SlashCommandBuilder().setName('panel').setDescription('🎛️ Panel bonito de música con controles'),
    new SlashCommandBuilder().setName('skip').setDescription('⏭️ Salta la canción actual'),
    new SlashCommandBuilder().setName('stop').setDescription('⏹️ Detiene la música y limpia la cola'),
    new SlashCommandBuilder().setName('clearqueue').setDescription('🧹 Vacía la cola sin detener la canción actual'),
    new SlashCommandBuilder().setName('limpiarcola').setDescription('🧹 Vacía la cola sin detener la canción actual'),
    new SlashCommandBuilder().setName('pause').setDescription('⏸️ Pausa la canción'),
    new SlashCommandBuilder().setName('resume').setDescription('▶️ Reanuda la canción'),
    new SlashCommandBuilder().setName('leave').setDescription('👋 Saca a JUANPLAY del canal de voz'),
    new SlashCommandBuilder()
      .setName('volume')
      .setDescription('🔊 Cambia el volumen')
      .addIntegerOption((option) => option.setName('numero').setDescription('Volumen 1 a 200').setRequired(true).setMinValue(1).setMaxValue(200)),
    new SlashCommandBuilder().setName('testvoz').setDescription('🧪 Prueba conexión al canal de voz'),
    new SlashCommandBuilder().setName('diagnostico').setDescription('🛠️ Revisa variables y estado del bot'),
    new SlashCommandBuilder().setName('plataformas').setDescription('🌐 Plataformas y links compatibles'),
    new SlashCommandBuilder().setName('setup').setDescription('⚙️ Muestra configuración recomendada'),
    new SlashCommandBuilder().setName('creditos').setDescription('👑 Créditos de JUANPLAY'),
    new SlashCommandBuilder().setName('invite').setDescription('🔗 Muestra el enlace para invitar el bot'),
    new SlashCommandBuilder().setName('help').setDescription('📘 Lista de comandos JUANPLAY'),
    new SlashCommandBuilder().setName('ping').setDescription('🏓 Latencia del bot'),
  ].map((command) => command.setDMPermission(false));
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = buildCommands().map((command) => command.toJSON());
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body });
    console.log(`[JUANPLAY] Comandos slash registrados en el servidor: ${GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    console.log('[JUANPLAY] Comandos slash globales registrados. Pueden tardar en aparecer.');
  }
}

client.once('clientReady', async () => {
  console.log(`✅ ${BOT_NAME} conectado como ${client.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${client.user.id}`);
  console.log('🎵 Usa /help, /buscar, /panel o /juanplay en Discord.');
  refreshPresence(true);
  try {
    await registerCommands();
    console.log('✅ Comandos slash listos. Reinvita con scopes bot + applications.commands si no aparecen.');
  } catch (error) {
    console.error('❌ No pude registrar comandos slash:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isChatInputCommand()) return;

    const remaining = checkCommandCooldown(interaction);
    if (remaining > 0) {
      return interaction.reply({
        embeds: [warnEmbed('Anti-spam activo', `Espera **${Math.ceil(remaining / 1000)}s** antes de volver a usar este comando.`)],
        flags: EPHEMERAL,
      });
    }

    const name = interaction.commandName;

    if (name === 'play' || name === 'juanplay') {
      return handlePlay(interaction, interaction.options.getString('busqueda', true));
    }

    if (name === 'buscar' || name === 'recomendados') return handleSearch(interaction);

    if (name === 'ping') {
      return interaction.reply({ embeds: [okEmbed('Pong', `Latencia: **${Math.round(client.ws.ping)} ms**`)] });
    }

    if (name === 'help') return interaction.reply({ embeds: [helpEmbed()] });
    if (name === 'plataformas') return interaction.reply({ embeds: [platformsEmbed()] });
    if (name === 'creditos') return interaction.reply({ embeds: [creditsEmbed()] });
    if (name === 'setup') return interaction.reply({ embeds: [setupEmbed()], flags: EPHEMERAL });
    if (name === 'invite') {
      if (BOT_INVITE_URL) return interaction.reply({ embeds: [inviteEmbed()] });
      return interaction.reply({ embeds: [inviteEmbed()], flags: EPHEMERAL });
    }
    if (name === 'diagnostico') return handleDiagnostico(interaction);
    if (name === 'testvoz') return handleTestVoice(interaction);

    const q = getQueue(interaction.guild.id);

    if (name === 'queue' || name === 'cola') {
      const pageInput = interaction.options.getInteger('pagina') || 1;
      const page = clamp(pageInput - 1, 0, getQueuePages(q) - 1);
      return interaction.reply({ embeds: [queueEmbed(q, page)], components: queueComponents(q, page) });
    }

    if (name === 'panel') {
      if (q.current) return interaction.reply({ embeds: [nowPlayingEmbed(q.current, q)], components: [playerControlsRow()] });
      return interaction.reply({ embeds: [queueEmbed(q, 0)], components: queueComponents(q, 0) });
    }

    if (name === 'nowplaying' || name === 'np') {
      if (!q.current) return interaction.reply({ embeds: [warnEmbed('Nada sonando', 'Usa `/play nombre o link` para empezar.')] });
      return interaction.reply({ embeds: [nowPlayingEmbed(q.current, q)], components: [playerControlsRow()] });
    }

    if (name === 'skip') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      if (!q.current) return interaction.reply({ embeds: [warnEmbed('Sin canción', 'No hay nada para saltar.')] });
      q.player.stop(true);
      return interaction.reply({ embeds: [okEmbed('Saltado', 'Pasando a la siguiente canción.')] });
    }

    if (name === 'stop') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      q.tracks = [];
      stopTrackProcess(q.current);
      q.current = null;
      q.player.stop(true);
      refreshPresence(true);
      return interaction.reply({ embeds: [okEmbed('Detenido', 'Música detenida y cola limpiada.')] });
    }

    if (name === 'clearqueue' || name === 'limpiarcola') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      const removed = q.tracks.length;
      q.tracks = [];
      return interaction.reply({ embeds: [okEmbed('Cola vaciada', `Quité **${removed}** canciones de la cola. La canción actual ${q.current ? 'sigue sonando' : 'no estaba activa'}.`)] });
    }

    if (name === 'pause') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      const ok = q.player.pause(true);
      refreshPresence(true);
      return interaction.reply({ embeds: [ok ? okEmbed('Pausado', 'La música quedó pausada.') : warnEmbed('No pude pausar', 'No hay música sonando.')] });
    }

    if (name === 'resume') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      const ok = q.player.unpause();
      refreshPresence(true);
      return interaction.reply({ embeds: [ok ? okEmbed('Reanudado', 'La música sigue sonando.') : warnEmbed('No pude reanudar', 'No hay música pausada.')] });
    }

    if (name === 'volume') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      const num = interaction.options.getInteger('numero', true);
      q.volume = Math.max(1, Math.min(200, num)) / 100;
      if (q.player.state.resource?.volume) q.player.state.resource.volume.setVolume(q.volume);
      return interaction.reply({ embeds: [okEmbed('Volumen actualizado', `Volumen: **${num}%**`)] });
    }

    if (name === 'leave') {
      const sameVoiceError = requireSameVoice(interaction, q);
      if (sameVoiceError) return interaction.reply({ embeds: [warnEmbed('Control protegido', sameVoiceError)], flags: EPHEMERAL });
      q.tracks = [];
      stopTrackProcess(q.current);
      q.current = null;
      q.player.stop(true);
      try { q.connection?.destroy(); } catch (_) {}
      q.connection = null;
      q.voiceChannelId = null;
      refreshPresence(true);
      return interaction.reply({ embeds: [okEmbed('Me fui del canal', `${BOT_NAME} salió del canal de voz.`)] });
    }
  } catch (error) {
    console.error('[JUANPLAY] Error ejecutando comando:', error);
    const embed = errEmbed('Ocurrió un error interno', buildPlaybackError(error));
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
    }
    return interaction.reply({ embeds: [embed], flags: EPHEMERAL }).catch(() => {});
  }
});

async function handleTestVoice(interaction) {
  await interaction.deferReply({ flags: EPHEMERAL });
  const q = getQueue(interaction.guild.id);
  try {
    const connection = await ensureVoice(interaction, q);
    return interaction.editReply({ embeds: [okEmbed('Voz lista', `${BOT_NAME} conectó al canal de voz.\nEstado: **${connection.state.status}**`)] });
  } catch (error) {
    return interaction.editReply({ embeds: [errEmbed('No pude conectar a voz', buildPlaybackError(error))] });
  }
}

async function handleDiagnostico(interaction) {
  const q = getQueue(interaction.guild.id);
  const lines = [
    `🤖 Bot: **${client.user.tag}**`,
    `🧩 Node: **${process.version}**`,
    `🎚️ FFmpeg: **${ffmpegPath ? 'incluido' : 'no detectado'}**`,
    `🎙️ Opus: **${hasModule('opusscript') || hasModule('@discordjs/opus') ? 'instalado' : 'no instalado'}**`,
    `🍪 YOUTUBE_COOKIE: **${cookieFile ? 'configurada' : 'no configurada'}**`,
    `🏠 GUILD_ID: **${GUILD_ID ? GUILD_ID : 'no configurado, comandos globales'}**`,
    `🔊 Volumen: **${Math.round(q.volume * 100)}%**`,
    `📡 Voice timeout: **${VOICE_TIMEOUT_MS}ms**`,
    `🛡️ Anti-spam: **${COMMAND_COOLDOWN_MS}ms**`,
    `🔕 Anuncios automáticos: **${ANNOUNCE_NOW_PLAYING ? 'activados' : 'desactivados'}**`,
    `📌 Estado voz: **${q.connection?.state?.status || 'sin conexión'}**`,
    `🎧 Actual: **${q.current ? escapeMd(q.current.title) : 'nada'}**`,
    `📜 Cola: **${q.tracks.length}/${MAX_QUEUE_SIZE}**`,
    `🎶 Actividad: **${lastPresenceText || 'no definida'}**`,
  ];
  if (q.lastError) lines.push(`\nÚltimo error: \`${cut(q.lastError.message || q.lastError, 700)}\``);
  return interaction.reply({ embeds: [musicEmbed('Diagnóstico JUANPLAY', lines.join('\n'))], flags: EPHEMERAL });
}

function startHealthServer() {
  const port = process.env.PORT;
  if (!port) return;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      bot: BOT_NAME,
      brand: BRAND,
      version: BOT_VERSION,
      user: client.user?.tag || null,
      guilds: client.guilds?.cache?.size || 0,
      activeQueues: queues.size,
    }));
  });
  server.listen(port, () => console.log(`🌐 Health server activo en puerto ${port}`));
}

process.on('unhandledRejection', (error) => console.error('[JUANPLAY] Unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('[JUANPLAY] Uncaught exception:', error));

startHealthServer();
client.login(TOKEN);
