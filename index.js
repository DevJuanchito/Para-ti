/*
  🎧 JUANPLAY DEVJUANCHO DEFINITIVO v7
  Creado para DEVJUANCHO / JuanStudio
  Discord Music Bot con comandos slash, recomendaciones, yt-dlp y diseño personalizado.
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
const BOT_COLOR = process.env.BOT_COLOR || '#ff2f7d';
const BRAND = 'DEVJUANCHO • JuanStudio • JUANPLAY v7';
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
setInterval(cleanSearchCache, 5 * 60 * 1000).unref();

function makeEmbed(title, description, color = BOT_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || '')
    .setFooter({ text: BRAND })
    .setTimestamp();
}

function okEmbed(title, description) {
  return makeEmbed(`✅ ${title}`, description, '#2ecc71');
}

function warnEmbed(title, description) {
  return makeEmbed(`⚠️ ${title}`, description, '#f1c40f');
}

function errEmbed(title, description) {
  return makeEmbed(`❌ ${title}`, description, '#ff2f7d');
}

function musicEmbed(title, description) {
  return makeEmbed(`🎧 ${title}`, description, BOT_COLOR);
}

function nowPlayingEmbed(track) {
  const embed = musicEmbed('JUANPLAY está sonando', `**[${escapeMd(track.title)}](${track.url})**\n\n👤 Pedido por: **${escapeMd(track.requestedBy || 'alguien')}**\n⏱️ Duración: **${track.duration || 'desconocida'}**\n🌐 Fuente: **${track.source || 'yt-dlp'}**`);
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function trackLine(track, index) {
  return `**${index}.** [${escapeMd(track.title)}](${track.url}) — \`${track.duration || '??'}\``;
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
    volume: DEFAULT_VOLUME,
    locked: false,
    lastError: null,
  };

  player.on(AudioPlayerStatus.Idle, () => {
    stopTrackProcess(q.current);
    q.current = null;
    setTimeout(() => playNext(guildId).catch(console.error), 350);
  });

  player.on('error', (error) => {
    q.lastError = error;
    console.error('[JUANPLAY] Error del reproductor:', error);
    if (q.textChannel) {
      q.textChannel.send({
        embeds: [errEmbed('Error reproduciendo', `Falló el stream actual. Paso a la siguiente canción.\n\n\`${cut(error.message || error, 900)}\``)],
      }).catch(() => {});
    }
    stopTrackProcess(q.current);
    q.current = null;
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

async function playNext(guildId) {
  const q = getQueue(guildId);
  if (q.locked) return;
  if (q.current) return;

  const next = q.tracks.shift();
  if (!next) return;

  q.locked = true;
  q.current = next;

  try {
    if (!q.connection || q.connection.state.status === VoiceConnectionStatus.Destroyed) {
      if (!q.voiceChannelId) throw new Error('No hay canal de voz guardado. Usa /play desde un canal de voz.');
      const channel = await client.channels.fetch(q.voiceChannelId);
      if (!channel) throw new Error('No encontré el canal de voz.');
      q.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: VOICE_SELF_DEAF,
        selfMute: false,
      });
      q.connection.subscribe(q.player);
      await entersState(q.connection, VoiceConnectionStatus.Ready, VOICE_TIMEOUT_MS);
    }

    const resource = await createYtDlpAudioResource(next);
    if (resource.volume) resource.volume.setVolume(q.volume);
    q.player.play(resource);

    if (q.textChannel) {
      q.textChannel.send({ embeds: [nowPlayingEmbed(next)] }).catch(() => {});
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
    duration: formatDuration(info.duration) || info.duration_string || 'desconocida',
    thumbnail: info.thumbnail || (Array.isArray(info.thumbnails) ? info.thumbnails.at(-1)?.url : null),
    source: info.extractor_key || info.extractor || 'yt-dlp',
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
  // Primero prueba metadatos públicos de la página. Sirve para Spotify, Apple Music, Deezer, Tidal, etc.
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

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return null;
  const s = Math.round(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function cut(text, max = 1000) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
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

    for (const track of tracks) {
      track.requestedBy = interaction.user.username;
      q.tracks.push(track);
    }

    const first = tracks[0];
    const description = tracks.length === 1
      ? `Agregué a la cola:\n\n**[${escapeMd(first.title)}](${first.url})**\n\n⏱️ ${first.duration || 'desconocida'} • 🌐 ${first.source || 'YouTube'}`
      : `Agregué **${tracks.length} canciones** a la cola.\n\nPrimera: **[${escapeMd(first.title)}](${first.url})**`;

    const embed = musicEmbed('JUANPLAY agregado', description);
    if (first.thumbnail) embed.setThumbnail(first.thumbnail);

    await interaction.editReply({ embeds: [embed] });

    if (!q.current && q.player.state.status !== AudioPlayerStatus.Playing && q.player.state.status !== AudioPlayerStatus.Paused) {
      await playNext(interaction.guild.id);
    }
  } catch (error) {
    console.error('[JUANPLAY] Error en handlePlay:', error);
    const embed = errEmbed('No pude usar /play', buildPlaybackError(error));
    if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed] }).catch(() => {});
    else await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
  }
}

async function handleSearch(interaction) {
  const query = interaction.options.getString('busqueda', true);
  await interaction.deferReply();
  const results = await searchYouTube(query, 10);
  if (!results.length) return interaction.editReply({ embeds: [errEmbed('Sin recomendados', 'No encontré resultados para esa búsqueda.')] });

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  searchCache.set(id, { createdAt: Date.now(), results });

  const embed = musicEmbed('Recomendados para ti', results.map(trackLine).join('\n'));
  if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);

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

  return interaction.editReply({ embeds: [embed], components: rows });
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'busqueda') return interaction.respond([]).catch(() => {});

  const query = cleanInput(focused.value);
  if (!query || query.length < 2 || isUrl(query)) {
    return interaction.respond([
      { name: 'Pega un link de YouTube, SoundCloud, Spotify, Apple Music, Deezer o escribe un nombre', value: query || 'Paulo Londra No Puedo' },
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
  const [prefix, id, indexRaw] = interaction.customId.split(':');
  if (prefix !== 'jp_pick') return;
  const cached = searchCache.get(id);
  const index = Number(indexRaw);
  const track = cached?.results?.[index];
  if (!track) return interaction.reply({ embeds: [errEmbed('Botón expirado', 'Haz `/buscar` otra vez para generar recomendados nuevos.')], ephemeral: true });
  await handlePlay(interaction, track.title, track);
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

    new SlashCommandBuilder().setName('queue').setDescription('📜 Muestra la cola de música'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('💿 Muestra la canción actual'),
    new SlashCommandBuilder().setName('skip').setDescription('⏭️ Salta la canción actual'),
    new SlashCommandBuilder().setName('stop').setDescription('⏹️ Detiene la música y limpia la cola'),
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
    new SlashCommandBuilder().setName('help').setDescription('📘 Lista de comandos JUANPLAY'),
    new SlashCommandBuilder().setName('ping').setDescription('🏓 Latencia del bot'),
  ];
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
  console.log(`✅ JUANPLAY conectado como ${client.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${client.user.id}`);
  console.log('🎵 Usa /help, /buscar, /testvoz o /juanplay en Discord.');
  client.user.setActivity('JUANPLAY • DEVJUANCHO', { type: ActivityType.Listening });
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
    if (name === 'setup') return interaction.reply({ embeds: [setupEmbed()], ephemeral: true });
    if (name === 'diagnostico') return handleDiagnostico(interaction);
    if (name === 'testvoz') return handleTestVoice(interaction);

    const q = getQueue(interaction.guild.id);

    if (name === 'queue') {
      const lines = [];
      if (q.current) lines.push(`🎧 **Actual:** [${escapeMd(q.current.title)}](${q.current.url})`);
      if (q.tracks.length) lines.push(q.tracks.slice(0, 10).map(trackLine).join('\n'));
      return interaction.reply({ embeds: [musicEmbed('Cola JUANPLAY', lines.join('\n\n') || 'La cola está vacía. Usa `/play` o `/buscar`.')] });
    }

    if (name === 'nowplaying') {
      if (!q.current) return interaction.reply({ embeds: [warnEmbed('Nada sonando', 'Usa `/play nombre o link` para empezar.')] });
      return interaction.reply({ embeds: [nowPlayingEmbed(q.current)] });
    }

    if (name === 'skip') {
      if (!q.current) return interaction.reply({ embeds: [warnEmbed('Sin canción', 'No hay nada para saltar.')] });
      q.player.stop(true);
      return interaction.reply({ embeds: [okEmbed('Saltado', 'Pasando a la siguiente canción.')] });
    }

    if (name === 'stop') {
      q.tracks = [];
      stopTrackProcess(q.current);
      q.current = null;
      q.player.stop(true);
      return interaction.reply({ embeds: [okEmbed('Detenido', 'Música detenida y cola limpiada.')] });
    }

    if (name === 'pause') {
      const ok = q.player.pause(true);
      return interaction.reply({ embeds: [ok ? okEmbed('Pausado', 'La música quedó pausada.') : warnEmbed('No pude pausar', 'No hay música sonando.')] });
    }

    if (name === 'resume') {
      const ok = q.player.unpause();
      return interaction.reply({ embeds: [ok ? okEmbed('Reanudado', 'La música sigue sonando.') : warnEmbed('No pude reanudar', 'No hay música pausada.')] });
    }

    if (name === 'volume') {
      const num = interaction.options.getInteger('numero', true);
      q.volume = Math.max(1, Math.min(200, num)) / 100;
      if (q.player.state.resource?.volume) q.player.state.resource.volume.setVolume(q.volume);
      return interaction.reply({ embeds: [okEmbed('Volumen actualizado', `Volumen: **${num}%**`)] });
    }

    if (name === 'leave') {
      q.tracks = [];
      stopTrackProcess(q.current);
      q.current = null;
      q.player.stop(true);
      try { q.connection?.destroy(); } catch (_) {}
      q.connection = null;
      return interaction.reply({ embeds: [okEmbed('Me fui del canal', 'JUANPLAY salió del canal de voz.')] });
    }
  } catch (error) {
    console.error('[JUANPLAY] Error ejecutando comando:', error);
    const embed = errEmbed('Ocurrió un error interno', buildPlaybackError(error));
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
    }
    return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
  }
});

async function handleTestVoice(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const q = getQueue(interaction.guild.id);
  try {
    const connection = await ensureVoice(interaction, q);
    return interaction.editReply({ embeds: [okEmbed('Voz lista', `JUANPLAY conectó al canal de voz.\nEstado: **${connection.state.status}**`)] });
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
    `📌 Estado voz: **${q.connection?.state?.status || 'sin conexión'}**`,
    `🎧 Actual: **${q.current ? escapeMd(q.current.title) : 'nada'}**`,
    `📜 Cola: **${q.tracks.length}**`,
  ];
  if (q.lastError) lines.push(`\nÚltimo error: \`${cut(q.lastError.message || q.lastError, 700)}\``);
  return interaction.reply({ embeds: [musicEmbed('Diagnóstico JUANPLAY', lines.join('\n'))], ephemeral: true });
}

function helpEmbed() {
  return musicEmbed('Comandos JUANPLAY', [
    '`/play busqueda` — reproduce por nombre o link.',
    '`/juanplay busqueda` — comando principal personalizado.',
    '`/buscar busqueda` — muestra recomendados con botones.',
    '`/recomendados busqueda` — igual que buscar, con resultados bonitos.',
    '`/queue` — cola.',
    '`/nowplaying` — canción actual.',
    '`/skip` `/stop` `/pause` `/resume` — controles.',
    '`/volume numero` — volumen 1 a 200.',
    '`/testvoz` — prueba conexión de voz.',
    '`/diagnostico` — revisa variables/estado.',
    '`/plataformas` — plataformas compatibles.',
    '`/creditos` — créditos DEVJUANCHO.',
  ].join('\n'));
}

function platformsEmbed() {
  return musicEmbed('Plataformas compatibles', [
    '✅ **YouTube** por nombre, link y playlist.',
    '✅ **SoundCloud** por link.',
    '✅ **Links directos** `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`, `.webm`.',
    '✅ **Spotify / Apple Music / Deezer**: toma el nombre del link y busca la canción en YouTube.',
    '✅ Muchas páginas soportadas por **yt-dlp**.',
    '',
    '⚠️ Puede funcionar **sin cookie**. Si YouTube tira **429**, agrega `YOUTUBE_COOKIE` nueva en Railway.',
  ].join('\n'));
}

function setupEmbed() {
  return musicEmbed('Setup recomendado para Discord + Railway', [
    '**OAuth2 scopes:** `bot` y `applications.commands`.',
    '**Permisos Discord:** Ver canales, Enviar mensajes, Insertar enlaces, Leer historial, Usar comandos de barra diagonal, Conectarse, Hablar, Usar actividad de voz, Usar sonidos externos.',
    '',
    '**Variables Railway:**',
    '`DISCORD_TOKEN` obligatorio.',
    '`GUILD_ID` recomendado para comandos instantáneos.',
    '`YOUTUBE_COOKIE` opcional: solo úsala si YouTube bloquea con 429.',
    '`VOICE_TIMEOUT_MS=120000` recomendado.',
  ].join('\n'));
}

function creditsEmbed() {
  return musicEmbed('Créditos', [
    '👑 **DEVJUANCHO**',
    '🏗️ **JuanStudio**',
    '🎧 **JUANPLAY Music Bot Definitivo v7**',
    '',
    'Personalizado, decorado y optimizado para música con comandos slash.',
  ].join('\n'));
}

function startHealthServer() {
  const port = process.env.PORT;
  if (!port) return;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bot: 'JUANPLAY', version: '6.0.0', user: client.user?.tag || null }));
  });
  server.listen(port, () => console.log(`🌐 Health server activo en puerto ${port}`));
}

process.on('unhandledRejection', (error) => console.error('[JUANPLAY] Unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('[JUANPLAY] Uncaught exception:', error));

startHealthServer();
client.login(TOKEN);
