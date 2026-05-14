import http from 'node:http';
import { Readable } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';
import ytpl from 'ytpl';
import * as playdlModule from 'play-dl';
import {
  ActivityType,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} from 'discord.js';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} from '@discordjs/voice';
import { config, getYtdlRequestOptions, requireToken } from './config.js';
import { slashCommandData } from './commands.js';

const play = playdlModule.default ?? playdlModule;
if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;
requireToken();

const BRAND_COLOR = 0x9b59ff;
const ERROR_COLOR = 0xff315a;
const OK_COLOR = 0x2ecc71;
const WARN_COLOR = 0xf1c40f;
const DIRECT_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.opus', '.flac', '.m4a', '.aac', '.webm', '.mp4'];

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates
];

if (config.enablePrefixCommands) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });
const queues = new Map();

class UserError extends Error {}

function startHealthServer() {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('JUANPLAY DEVJUANCHO v5 online ✅');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Health server listo en puerto ${port}`);
  });
}

function avatarUrl() {
  return client.user?.displayAvatarURL?.({ size: 128 }) ?? undefined;
}

function brandEmbed(title, description, color = BRAND_COLOR) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'DEVJUANCHO • JuanStudio • JUANPLAY v5' })
    .setTimestamp();

  const icon = avatarUrl();
  if (icon) embed.setAuthor({ name: 'JUANPLAY MUSIC', iconURL: icon });
  return embed;
}

function errorEmbed(message) {
  return brandEmbed('🚫 JUANPLAY aviso', `**${message}**`, ERROR_COLOR);
}

function cleanTitle(title) {
  return decodeHtml(String(title || 'Cancion sin titulo'))
    .replace(/\s+/g, ' ')
    .replace(/\s*[|•]\s*(Spotify|Apple Music|Deezer|SoundCloud|YouTube).*$/i, '')
    .trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function bestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  return thumbnails[thumbnails.length - 1]?.url ?? thumbnails[0]?.url ?? null;
}

function formatDuration(secondsOrString) {
  if (!secondsOrString) return 'Desconocida';
  if (typeof secondsOrString === 'string') return secondsOrString;

  const seconds = Number(secondsOrString);
  if (!Number.isFinite(seconds)) return 'Desconocida';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function isProbablyUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function urlHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isDirectAudioUrl(value) {
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    return DIRECT_AUDIO_EXTENSIONS.some(ext => path.endsWith(ext));
  } catch {
    return false;
  }
}

function isSoundCloudUrl(value) {
  const host = urlHost(value);
  return host === 'soundcloud.com' || host.endsWith('.soundcloud.com') || host === 'on.soundcloud.com';
}

function isSpotifyUrl(value) {
  const host = urlHost(value);
  return host === 'open.spotify.com' || host === 'spotify.link';
}

function isAppleMusicUrl(value) {
  const host = urlHost(value);
  return host.includes('music.apple.com') || host === 'apple.co';
}

function isDeezerUrl(value) {
  const host = urlHost(value);
  return host === 'deezer.page.link' || host === 'deezer.com' || host.endsWith('.deezer.com');
}

function isRateLimitError(error) {
  const text = `${error?.message || ''} ${error?.statusCode || ''} ${error?.code || ''}`;
  return text.includes('429') || /too many requests/i.test(text);
}

function errorText(error) {
  return `${error?.message || ''} ${error?.statusCode || ''} ${error?.code || ''}`.trim();
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
    if (host.endsWith('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      const known = ['shorts', 'embed', 'live'];
      if (known.includes(parts[0]) && parts[1]) return parts[1];
    }
  } catch {}
  return null;
}

function isYouTubeUrl(value) {
  const host = urlHost(value);
  return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'music.youtube.com';
}

function ytdlOptions() {
  return {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    dlChunkSize: 0,
    ...getYtdlRequestOptions()
  };
}

function infoOptions() {
  return getYtdlRequestOptions();
}

function requestedByName(user) {
  return user?.tag || user?.globalName || user?.username || 'Usuario';
}

function songBase(requestedBy, source) {
  return {
    requestedBy: requestedByName(requestedBy),
    source,
    streamUrl: null,
    duration: 'Desconocida',
    thumbnail: null
  };
}

function songFromYtdlDetails(details, requestedBy) {
  return {
    ...songBase(requestedBy, 'YouTube'),
    title: cleanTitle(details.title),
    url: details.video_url || details.videoUrl || details.url,
    streamUrl: details.video_url || details.videoUrl || details.url,
    duration: formatDuration(details.lengthSeconds ? Number(details.lengthSeconds) : details.durationRaw),
    thumbnail: bestThumbnail(details.thumbnails)
  };
}

function songFromSearchVideo(video, requestedBy, source = 'YouTube Search') {
  return {
    ...songBase(requestedBy, source),
    title: cleanTitle(video.title),
    url: video.url,
    streamUrl: video.url,
    duration: video.timestamp || formatDuration(video.seconds),
    thumbnail: video.thumbnail || bestThumbnail(video.thumbnails)
  };
}

function songFromPlaylistItem(item, requestedBy) {
  return {
    ...songBase(requestedBy, 'YouTube Playlist'),
    title: cleanTitle(item.title),
    url: item.shortUrl || item.url,
    streamUrl: item.shortUrl || item.url,
    duration: item.duration || 'Desconocida',
    thumbnail: item.bestThumbnail?.url || item.thumbnail || null
  };
}

function songFromDirectAudio(url, requestedBy) {
  const decoded = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Audio directo');
  return {
    ...songBase(requestedBy, 'Audio directo'),
    title: cleanTitle(decoded.replace(/\.[a-z0-9]+$/i, '')),
    url,
    streamUrl: url
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.youtubeUserAgent,
      'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchPageTitle(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.youtubeUserAgent,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const match = html.slice(0, 200_000).match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match) throw new Error('No title tag');
  return cleanTitle(match[1]);
}

async function resolveMetadataTitle(url) {
  const encoded = encodeURIComponent(url);
  const endpoints = [];

  if (isSpotifyUrl(url)) endpoints.push(`https://open.spotify.com/oembed?url=${encoded}`);
  if (isSoundCloudUrl(url)) endpoints.push(`https://soundcloud.com/oembed?format=json&url=${encoded}`);
  if (isAppleMusicUrl(url)) endpoints.push(`https://embed.music.apple.com/oembed?url=${encoded}`);
  if (isDeezerUrl(url)) endpoints.push(`https://www.deezer.com/oembed?url=${encoded}`);

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      if (data?.title) return cleanTitle(data.title);
    } catch (error) {
      console.warn('[JUANPLAY] oEmbed fallo:', endpoint, error.message);
    }
  }

  try {
    return await fetchPageTitle(url);
  } catch (error) {
    console.warn('[JUANPLAY] No pude leer titulo HTML:', error.message);
    return '';
  }
}

async function searchYouTube(query, requestedBy, source = 'YouTube Search') {
  const results = await ytSearch(query);
  const video = results.videos.find(item => item?.url && !item.live) || results.videos.find(item => item?.url);

  if (!video) throw new UserError('No encontre esa cancion. Prueba con otro nombre o con un enlace directo.');
  return songFromSearchVideo(video, requestedBy, source);
}

async function resolveYouTubeUrl(url, requestedBy) {
  const videoId = getYouTubeVideoId(url);

  // Primero intento con yt-search por ID para NO gastar requests de ytdl antes del stream.
  if (videoId) {
    try {
      const video = await ytSearch({ videoId });
      if (video?.url || video?.title) {
        return {
          ...songBase(requestedBy, 'YouTube Link'),
          title: cleanTitle(video.title || `YouTube ${videoId}`),
          url: video.url || `https://www.youtube.com/watch?v=${videoId}`,
          streamUrl: video.url || url,
          duration: video.timestamp || formatDuration(video.seconds),
          thumbnail: video.thumbnail || bestThumbnail(video.thumbnails)
        };
      }
    } catch (error) {
      console.warn('[JUANPLAY] yt-search por videoId fallo, intento ytdl info:', error.message);
    }
  }

  try {
    const info = await ytdl.getBasicInfo(url, infoOptions());
    return songFromYtdlDetails(info.videoDetails, requestedBy);
  } catch (error) {
    console.warn('[JUANPLAY] No pude leer metadata de YouTube; usare el link directo:', errorText(error));
    // Aunque la metadata falle por 429, dejamos que el backend de stream pruebe play-dl/ytdl.
    return {
      ...songBase(requestedBy, 'YouTube Link'),
      title: videoId ? `YouTube ${videoId}` : 'Link de YouTube',
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      streamUrl: url,
      duration: 'Desconocida',
      thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
    };
  }
}

async function topYouTubeResults(query, limit = 5) {
  const results = await ytSearch(query);
  return results.videos
    .filter(item => item?.url && !item.live)
    .slice(0, limit)
    .map(item => ({
      title: cleanTitle(item.title),
      url: item.url,
      duration: item.timestamp || formatDuration(item.seconds),
      thumbnail: item.thumbnail || bestThumbnail(item.thumbnails)
    }));
}

async function resolveSoundCloud(url, requestedBy) {
  try {
    const validation = await play.validate?.(url);
    if (validation && String(validation).startsWith('so_')) {
      const info = await play.soundcloud?.(url);
      return [{
        ...songBase(requestedBy, 'SoundCloud'),
        title: cleanTitle(info?.name || info?.title || info?.user?.name || 'SoundCloud'),
        url,
        streamUrl: url,
        duration: formatDuration(info?.durationInSec || info?.durationInMs ? Number(info.durationInMs) / 1000 : undefined),
        thumbnail: info?.thumbnail || null
      }];
    }
  } catch (error) {
    console.warn('[JUANPLAY] SoundCloud directo fallo, intento por metadata:', error.message);
  }

  const title = await resolveMetadataTitle(url);
  if (!title) throw new UserError('No pude leer ese enlace de SoundCloud. Prueba escribiendo el nombre de la cancion.');
  return [await searchYouTube(`${title} audio`, requestedBy, 'SoundCloud → YouTube')];
}

async function resolveSongs(query, requestedBy) {
  const search = query.trim();
  if (!search) throw new UserError('Escribe el nombre o URL de una cancion.');

  if (isDirectAudioUrl(search)) {
    return [songFromDirectAudio(search, requestedBy)];
  }

  const playlistId = (() => {
    try {
      const url = new URL(search);
      return url.searchParams.get('list');
    } catch {
      return null;
    }
  })();

  if ((playlistId || ytpl.validateID(search)) && !String(search).includes('/watch?')) {
    try {
      const playlist = await ytpl(playlistId || search, { limit: config.maxPlaylistSongs });
      const songs = playlist.items
        .filter(item => item?.url || item?.shortUrl)
        .map(item => songFromPlaylistItem(item, requestedBy));

      if (songs.length === 0) throw new UserError('No encontre canciones reproducibles en esa playlist.');
      return songs;
    } catch (error) {
      if (error instanceof UserError) throw error;
      console.error('[JUANPLAY] Error leyendo playlist:', error);
      if (isRateLimitError(error)) throw youtube429Error();
      throw new UserError('No pude leer esa playlist. Prueba con una cancion individual o con otro enlace.');
    }
  }

  if (isYouTubeUrl(search) || ytdl.validateURL(search)) {
    return [await resolveYouTubeUrl(search, requestedBy)];
  }

  if (isSoundCloudUrl(search)) {
    return resolveSoundCloud(search, requestedBy);
  }

  if (isProbablyUrl(search)) {
    const title = await resolveMetadataTitle(search);
    if (!title) {
      throw new UserError('No pude leer ese enlace. Si es Spotify/Apple/Deezer, prueba escribiendo el nombre de la cancion.');
    }

    const source = isSpotifyUrl(search)
      ? 'Spotify → YouTube'
      : isAppleMusicUrl(search)
        ? 'Apple Music → YouTube'
        : isDeezerUrl(search)
          ? 'Deezer → YouTube'
          : 'Link → YouTube';

    return [await searchYouTube(`${title} audio`, requestedBy, source)];
  }

  try {
    return [await searchYouTube(search, requestedBy, 'Nombre → YouTube')];
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error('[JUANPLAY] Error buscando en YouTube:', error);
    if (isRateLimitError(error)) throw youtube429Error();
    throw new UserError('No pude buscar ahora mismo. Prueba con un enlace directo o con otro nombre.');
  }
}

function youtube429Error() {
  return new UserError(
    'YouTube esta bloqueando la IP de Railway con error **429**. JUANPLAY v5 intenta varios backends, pero si YouTube bloquea la IP necesitas agregar **YOUTUBE_COOKIE** en Railway o usar un host/proxy con IP limpia. Mientras tanto prueba SoundCloud o un link directo `.mp3/.m4a/.wav`.'
  );
}

function getState(guild) {
  let state = queues.get(guild.id);

  if (!state) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    state = {
      guildId: guild.id,
      player,
      connection: null,
      current: null,
      songs: [],
      textChannel: null,
      leaveTimer: null,
      volume: config.defaultVolume / 100,
      isConnecting: false
    };

    player.on(AudioPlayerStatus.Idle, () => {
      playNext(guild.id).catch(error => {
        console.error('[JUANPLAY] Error al reproducir la siguiente cancion:', error);
      });
    });

    player.on('error', error => {
      console.error('[JUANPLAY] Error del reproductor:', error);
      const message = isRateLimitError(error)
        ? '🚫 YouTube mando **429**. Agrega `YOUTUBE_COOKIE` en Railway o prueba SoundCloud/audio directo.'
        : '⚠️ Error reproduciendo la cancion. Saltando a la siguiente...';
      sendToTextChannel(state, errorEmbed(message)).catch(() => {});
      state.current = null;
      playNext(guild.id).catch(console.error);
    });

    queues.set(guild.id, state);
  }

  return state;
}

async function sendToTextChannel(state, contentOrEmbed) {
  const channel = state.textChannel;
  if (!channel || !channel.isTextBased?.()) return;

  if (typeof contentOrEmbed === 'string') {
    await channel.send({ content: contentOrEmbed }).catch(() => {});
    return;
  }

  await channel.send({ embeds: [contentOrEmbed] }).catch(() => {});
}

function scheduleLeave(guildId) {
  const state = queues.get(guildId);
  if (!state) return;

  clearTimeout(state.leaveTimer);
  state.leaveTimer = setTimeout(() => {
    const latestState = queues.get(guildId);
    if (!latestState || latestState.current || latestState.songs.length > 0) return;
    destroyQueue(guildId, false);
  }, Math.max(10, config.staySeconds) * 1000);
}

function destroyQueue(guildId, notify = true) {
  const state = queues.get(guildId);
  const connection = getVoiceConnection(guildId) || state?.connection;

  if (state) {
    clearTimeout(state.leaveTimer);
    state.songs = [];
    state.current = null;
    state.isConnecting = false;
    state.player.stop(true);
  }

  if (connection) {
    try {
      connection.destroy();
    } catch {}
  }

  if (notify && state) {
    sendToTextChannel(state, brandEmbed('👋 JUANPLAY salio', 'Me desconecte del canal de voz.', WARN_COLOR)).catch(() => {});
  }

  queues.delete(guildId);
}

async function getGuildMember(context) {
  if (context.member?.voice) return context.member;
  try {
    return await context.guild.members.fetch(context.user.id);
  } catch {
    return context.member;
  }
}

function voiceConnectionErrorMessage(status) {
  return [
    'No pude conectarme al canal de voz.',
    `Estado de conexion: **${status || 'desconocido'}**.`,
    '',
    'Revisa esto:',
    '1. El bot debe tener **Ver canales**, **Conectarse** y **Hablar** en ese canal de voz.',
    '2. Usa un canal de voz normal, no Stage/escenario.',
    '3. Cambia la region del canal a **Automatico**.',
    '4. Si Railway no deja voz/UDP, prueba otro host que permita Discord Voice.'
  ].join('\n');
}

async function connectToUserVoice(context) {
  const member = await getGuildMember(context);
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    throw new UserError('Primero entra a un canal de voz y vuelve a usar el comando.');
  }

  if (voiceChannel.type === ChannelType.GuildStageVoice) {
    throw new UserError('Estoy detectando un canal Stage/escenario. Prueba en un canal de voz normal.');
  }

  const me = await voiceChannel.guild.members.fetchMe();
  const permissions = voiceChannel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    throw new UserError('No tengo permiso para ver tu canal de voz.');
  }

  if (!permissions?.has(PermissionFlagsBits.Connect)) {
    throw new UserError('No tengo permiso para conectarme a tu canal de voz.');
  }

  if (!permissions?.has(PermissionFlagsBits.Speak)) {
    throw new UserError('No tengo permiso para hablar en tu canal de voz.');
  }

  const state = getState(context.guild);
  state.textChannel = context.channel;
  clearTimeout(state.leaveTimer);

  if (state.connection && state.connection.joinConfig.channelId === voiceChannel.id) {
    state.connection.subscribe(state.player);
    return state;
  }

  const oldConnection = getVoiceConnection(context.guild.id);
  if (oldConnection) {
    try {
      oldConnection.destroy();
    } catch {}
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: context.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: config.voiceSelfDeaf,
    selfMute: false
  });

  state.connection = connection;
  state.isConnecting = true;

  connection.on('error', error => console.error('[JUANPLAY] Error de conexion de voz:', error));
  connection.on(VoiceConnectionStatus.Signalling, () => console.log('[JUANPLAY] Voz: signalling... esperando Discord Voice Server Update'));
  connection.on(VoiceConnectionStatus.Connecting, () => console.log('[JUANPLAY] Voz: connecting...'));
  connection.on(VoiceConnectionStatus.Ready, () => console.log('[JUANPLAY] Voz: ready ✅'));

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      ]);
    } catch {
      destroyQueue(context.guild.id, false);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, config.voiceTimeoutMs);
    connection.subscribe(state.player);
    state.isConnecting = false;
    return state;
  } catch (error) {
    const status = connection.state?.status;
    console.error('[JUANPLAY] No pude entrar a voz:', { status, error });
    try {
      connection.destroy();
    } catch {}
    state.connection = null;
    state.isConnecting = false;
    throw new UserError(voiceConnectionErrorMessage(status));
  }
}

async function createAudioResourceFromStream(stream, streamType, song) {
  return createAudioResource(stream, {
    inputType: streamType ?? StreamType.Arbitrary,
    metadata: song,
    inlineVolume: true
  });
}

async function createYouTubeResource(song) {
  const url = song.streamUrl || song.url;
  const errors = [];
  const backend = config.streamBackend || 'auto';

  if (backend === 'auto' || backend === 'playdl') {
    try {
      console.log(`[JUANPLAY] Stream YouTube con play-dl: ${url}`);
      const stream = await play.stream(url, {
        discordPlayerCompatibility: true,
        quality: 2
      });
      return createAudioResourceFromStream(stream.stream, stream.type ?? StreamType.Arbitrary, song);
    } catch (error) {
      errors.push(`play-dl: ${errorText(error)}`);
      console.warn('[JUANPLAY] play-dl fallo, probando ytdl:', errorText(error));
    }
  }

  if (backend === 'auto' || backend === 'ytdl') {
    try {
      console.log(`[JUANPLAY] Stream YouTube con ytdl: ${url}`);
      const stream = ytdl(url, ytdlOptions());
      stream.on('error', error => {
        console.error('[JUANPLAY] Error del stream de YouTube:', error);
      });
      return createAudioResourceFromStream(stream, StreamType.Arbitrary, song);
    } catch (error) {
      errors.push(`ytdl: ${errorText(error)}`);
      console.warn('[JUANPLAY] ytdl fallo:', errorText(error));
    }
  }

  const combined = errors.join(' | ');
  const finalError = new Error(combined || 'No se pudo crear stream de YouTube');
  if (combined.includes('429')) finalError.statusCode = 429;
  throw finalError;
}

async function createResourceForSong(song) {
  if (song.source === 'SoundCloud') {
    try {
      const stream = await play.stream(song.streamUrl || song.url, { discordPlayerCompatibility: true });
      return createAudioResource(stream.stream, {
        inputType: stream.type ?? StreamType.Arbitrary,
        metadata: song,
        inlineVolume: true
      });
    } catch (error) {
      console.error('[JUANPLAY] Error stream SoundCloud:', error);
      throw error;
    }
  }

  if (song.source === 'Audio directo') {
    const response = await fetch(song.streamUrl || song.url, {
      headers: { 'User-Agent': config.youtubeUserAgent },
      signal: AbortSignal.timeout(20_000)
    });

    if (!response.ok || !response.body) throw new Error(`No pude abrir audio directo: HTTP ${response.status}`);
    const stream = Readable.fromWeb(response.body);
    return createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      metadata: song,
      inlineVolume: true
    });
  }

  return createYouTubeResource(song);
}

async function playNext(guildId) {
  const state = queues.get(guildId);
  if (!state) return;

  clearTimeout(state.leaveTimer);

  const next = state.songs.shift();
  if (!next) {
    state.current = null;
    scheduleLeave(guildId);
    return;
  }

  state.current = next;

  try {
    const resource = await createResourceForSong(next);
    resource.volume?.setVolume(state.volume);
    state.player.play(resource);

    const embed = brandEmbed('🎧 JUANPLAY está sonando', `[${next.title}](${next.url})`, OK_COLOR)
      .addFields(
        { name: '⏱️ Duración', value: next.duration || 'Desconocida', inline: true },
        { name: '📡 Fuente', value: next.source || 'Desconocida', inline: true },
        { name: '👑 Pedido por', value: next.requestedBy || 'Usuario', inline: true },
        { name: '🔊 Volumen', value: `${Math.round(state.volume * 100)}%`, inline: true },
        { name: '📜 En cola', value: String(state.songs.length), inline: true },
        { name: '💎 Créditos', value: 'DEVJUANCHO', inline: true }
      );

    if (next.thumbnail) embed.setThumbnail(next.thumbnail);
    await sendToTextChannel(state, embed);
  } catch (error) {
    console.error('[JUANPLAY] No pude reproducir:', error);
    const msg = isRateLimitError(error)
      ? 'YouTube bloqueo el stream con **429**. Agrega `YOUTUBE_COOKIE` en Railway o usa un host/proxy con IP limpia. También puedes probar SoundCloud o audio directo `.mp3/.m4a`.'
      : `No pude reproducir **${next.title}**. Saltando a la siguiente...`;
    await sendToTextChannel(state, errorEmbed(msg));
    state.current = null;
    await playNext(guildId);
  }
}

function makeSongList(songs) {
  return songs
    .slice(0, 10)
    .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) • ${song.duration || 'Desconocida'} • ${song.source || 'Fuente'}`)
    .join('\n');
}

async function safeReply(context, payload) {
  if (context.type === 'interaction') {
    if (context.interaction.deferred || context.interaction.replied) {
      return context.interaction.editReply(payload);
    }
    return context.interaction.reply(payload);
  }

  return context.message.reply(payload);
}

async function safeDefer(context) {
  if (context.type === 'interaction' && !context.interaction.deferred && !context.interaction.replied) {
    await context.interaction.deferReply();
  }
}

async function commandHelp(context) {
  const prefixLine = config.enablePrefixCommands
    ? `\nTambién puedes usar: \`${config.prefix}play\`, \`${config.prefix}skip\`, \`${config.prefix}help\`.`
    : '';

  const embed = brandEmbed(
    '💿 JUANPLAY DEVJUANCHO v5 • Comandos',
    [
      '🎵 `/juanplay busqueda` - reproduce por nombre o link.',
      '🎵 `/play busqueda` - igual que `/juanplay`.',
      '🔎 `/buscar busqueda` - mira resultados por nombre.',
      '🎙️ `/testvoz` - prueba conexión de voz.',
      '⏭️ `/skip` - salta canción.',
      '⏸️ `/pause` - pausa.',
      '▶️ `/resume` - continúa.',
      '📜 `/queue` - mira la cola.',
      '🎧 `/nowplaying` - canción actual.',
      '🔊 `/volume nivel` - volumen 1 a 150.',
      '🧹 `/stop` - detiene y limpia todo.',
      '👋 `/leave` - sale del canal.',
      '🌐 `/plataformas` - plataformas soportadas.',
      '🛠️ `/diagnostico` - revisa configuración.',
      '🔐 `/permisos` - revisa permisos de voz.',
      '⚙️ `/setup` - guía de instalación.',
      '👑 `/creditos` - DEVJUANCHO.',
      prefixLine
    ].filter(Boolean).join('\n'),
    BRAND_COLOR
  );

  await safeReply(context, { embeds: [embed] });
}

async function commandPlay(context, query) {
  await safeDefer(context);

  const songs = await resolveSongs(query, context.user);
  const state = await connectToUserVoice(context);
  state.songs.push(...songs);

  const wasIdle = !state.current && state.player.state.status !== AudioPlayerStatus.Playing;
  if (wasIdle) await playNext(context.guild.id);

  const embed = brandEmbed(
    songs.length > 1 ? '✅ Playlist agregada a JUANPLAY' : '✅ Canción agregada a JUANPLAY',
    songs.length > 1
      ? `Agregué **${songs.length}** canciones a la cola. Máximo configurado: **${config.maxPlaylistSongs}**.`
      : `[${songs[0].title}](${songs[0].url})`,
    OK_COLOR
  ).addFields(
    { name: '📡 Fuente', value: songs.length === 1 ? songs[0].source : 'Playlist', inline: true },
    { name: '📜 En cola', value: String(state.songs.length), inline: true },
    { name: '👑 Marca', value: 'DEVJUANCHO', inline: true }
  );

  if (songs.length === 1 && songs[0].thumbnail) embed.setThumbnail(songs[0].thumbnail);
  await safeReply(context, { embeds: [embed] });
}

async function commandBuscar(context, query) {
  await safeDefer(context);
  const results = await topYouTubeResults(query, 5);
  if (results.length === 0) throw new UserError('No encontré resultados para esa búsqueda.');

  const lines = results.map((item, index) => `**${index + 1}.** [${item.title}](${item.url}) • ${item.duration}`).join('\n');
  const embed = brandEmbed(
    '🔎 Resultados JUANPLAY',
    `${lines}\n\nPara reproducir usa: \`/juanplay ${query}\``,
    BRAND_COLOR
  );
  if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);
  await safeReply(context, { embeds: [embed] });
}

async function commandTestVoice(context) {
  await safeDefer(context);
  await connectToUserVoice(context);
  await safeReply(context, {
    embeds: [brandEmbed('✅ JUANPLAY voz lista', 'Me conecté bien al canal de voz. Ahora prueba `/juanplay nombre de canción`.', OK_COLOR)]
  });
  scheduleLeave(context.guild.id);
}

async function commandSkip(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna canción sonando ahora.');

  const skipped = state.current;
  state.player.stop(true);
  await safeReply(context, { embeds: [brandEmbed('⏭️ JUANPLAY saltó la canción', `Saltada: **${skipped.title}**`, WARN_COLOR)] });
}

async function commandStop(context) {
  const state = queues.get(context.guild.id);
  if (!state) throw new UserError('JUANPLAY no está reproduciendo nada.');

  destroyQueue(context.guild.id, false);
  await safeReply(context, { embeds: [brandEmbed('⏹️ JUANPLAY detenido', 'Limpié la cola y salí del canal de voz.', WARN_COLOR)] });
}

async function commandPause(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna canción para pausar.');

  const paused = state.player.pause(true);
  if (!paused) throw new UserError('No pude pausar la canción ahora mismo.');

  await safeReply(context, { embeds: [brandEmbed('⏸️ JUANPLAY pausado', `Pausado: **${state.current.title}**`, WARN_COLOR)] });
}

async function commandResume(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna canción para continuar.');

  const resumed = state.player.unpause();
  if (!resumed) throw new UserError('No pude continuar la canción ahora mismo.');

  await safeReply(context, { embeds: [brandEmbed('▶️ JUANPLAY continúa', `Sonando: **${state.current.title}**`, OK_COLOR)] });
}

async function commandQueue(context) {
  const state = queues.get(context.guild.id);

  if (!state?.current && (!state || state.songs.length === 0)) {
    throw new UserError('La cola está vacía. Usa `/juanplay` o `/play` para poner música.');
  }

  const currentLine = state.current ? `🎧 Ahora: [${state.current.title}](${state.current.url})` : '🎧 Ahora: nada';
  const nextLines = state.songs.length > 0 ? makeSongList(state.songs) : 'No hay más canciones en cola.';
  const extra = state.songs.length > 10 ? `\n\nY **${state.songs.length - 10}** canciones más...` : '';

  await safeReply(context, {
    embeds: [brandEmbed('📜 Cola de JUANPLAY', `${currentLine}\n\n${nextLines}${extra}`, BRAND_COLOR)]
  });
}

async function commandNowPlaying(context) {
  const state = queues.get(context.guild.id);
  if (!state?.current) throw new UserError('No hay ninguna canción sonando ahora.');

  const song = state.current;
  const embed = brandEmbed('🎶 Sonando ahora en JUANPLAY', `[${song.title}](${song.url})`, OK_COLOR)
    .addFields(
      { name: '⏱️ Duración', value: song.duration || 'Desconocida', inline: true },
      { name: '📡 Fuente', value: song.source || 'Desconocida', inline: true },
      { name: '👑 Pedido por', value: song.requestedBy || 'Usuario', inline: true },
      { name: '📜 En cola', value: String(state.songs.length), inline: true },
      { name: '🔊 Volumen', value: `${Math.round(state.volume * 100)}%`, inline: true },
      { name: '💎 Créditos', value: 'DEVJUANCHO', inline: true }
    );

  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  await safeReply(context, { embeds: [embed] });
}

async function commandLeave(context) {
  const state = queues.get(context.guild.id);
  const connection = getVoiceConnection(context.guild.id);

  if (!state && !connection) throw new UserError('JUANPLAY no está en ningún canal de voz.');

  destroyQueue(context.guild.id, false);
  await safeReply(context, { embeds: [brandEmbed('👋 JUANPLAY salió', 'Me desconecté del canal de voz.', WARN_COLOR)] });
}

async function commandVolume(context, level) {
  const state = getState(context.guild);
  state.volume = Math.max(0.01, Math.min(1.5, Number(level) / 100));

  const resource = state.player.state?.resource;
  resource?.volume?.setVolume(state.volume);

  await safeReply(context, {
    embeds: [brandEmbed('🔊 Volumen JUANPLAY', `Volumen cambiado a **${Math.round(state.volume * 100)}%**.`, OK_COLOR)]
  });
}

async function commandPlatforms(context) {
  const embed = brandEmbed(
    '🌐 Plataformas JUANPLAY',
    [
      '✅ **YouTube**: links, nombres y playlists. v5 prueba play-dl + ytdl automáticamente.',
      '✅ **SoundCloud**: links directos y fallback por búsqueda.',
      '✅ **Spotify**: links de track/album/playlist por metadata → búsqueda reproducible.',
      '✅ **Apple Music**: links por metadata → búsqueda reproducible.',
      '✅ **Deezer**: links por metadata → búsqueda reproducible.',
      '✅ **Audio directo**: `.mp3`, `.wav`, `.ogg`, `.opus`, `.flac`, `.m4a`, `.aac`, `.webm`.',
      '',
      '⚠️ Spotify/Apple/Deezer no entregan audio completo para bots; JUANPLAY convierte esos links a búsqueda reproducible.',
      '⚠️ Si Railway recibe 429 de YouTube, usa `YOUTUBE_COOKIE` o prueba SoundCloud/audio directo.'
    ].join('\n'),
    BRAND_COLOR
  );
  await safeReply(context, { embeds: [embed] });
}

async function commandDiagnostico(context) {
  const state = queues.get(context.guild.id);
  const connection = getVoiceConnection(context.guild.id) || state?.connection;
  const embed = brandEmbed('🛠️ Diagnóstico JUANPLAY', 'Estado técnico del bot en este servidor.', BRAND_COLOR)
    .addFields(
      { name: '🤖 Bot', value: client.user?.tag || 'Online', inline: true },
      { name: '📡 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: '🎙️ Voz', value: connection?.state?.status || 'desconectado', inline: true },
      { name: '🎵 Sonando', value: state?.current?.title || 'Nada', inline: false },
      { name: '📜 Cola', value: String(state?.songs?.length || 0), inline: true },
      { name: '🔊 Volumen', value: `${Math.round((state?.volume ?? config.defaultVolume / 100) * 100)}%`, inline: true },
      { name: '🍪 YOUTUBE_COOKIE', value: config.youtubeCookie ? 'Configurada ✅' : 'No configurada ⚠️', inline: true },
      { name: '🆔 GUILD_ID', value: config.guildId ? 'Configurado ✅' : 'No configurado ⚠️', inline: true },
      { name: '🎚️ STREAM_BACKEND', value: config.streamBackend || 'auto', inline: true },
      { name: '🔇 VOICE_SELF_DEAF', value: config.voiceSelfDeaf ? 'true ✅' : 'false', inline: true },
      { name: '👑 Versión', value: config.botVersion || 'v5', inline: true }
    );

  await safeReply(context, { embeds: [embed] });
}

async function commandPermisos(context) {
  await safeDefer(context);
  const member = await getGuildMember(context);
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    throw new UserError('Entra primero a un canal de voz y usa `/permisos`.');
  }

  const me = await voiceChannel.guild.members.fetchMe();
  const perms = voiceChannel.permissionsFor(me);
  const checks = [
    ['Ver canales', PermissionFlagsBits.ViewChannel],
    ['Conectarse', PermissionFlagsBits.Connect],
    ['Hablar', PermissionFlagsBits.Speak],
    ['Usar actividad de voz', PermissionFlagsBits.UseVAD],
    ['Usar sonidos externos', PermissionFlagsBits.UseExternalSounds]
  ];

  const lines = checks.map(([name, flag]) => `${perms?.has(flag) ? '✅' : '❌'} **${name}**`).join('\n');
  const embed = brandEmbed(
    '🔐 Permisos de JUANPLAY',
    `Canal: **${voiceChannel.name}**\nTipo: **${voiceChannel.type === ChannelType.GuildStageVoice ? 'Stage/Escenario ⚠️' : 'Voz normal ✅'}**\n\n${lines}\n\nSi sale ❌ en Ver canales/Conectarse/Hablar, dale esos permisos al rol del bot en ese canal.`,
    perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.Connect) && perms?.has(PermissionFlagsBits.Speak) ? OK_COLOR : WARN_COLOR
  );

  await safeReply(context, { embeds: [embed] });
}

async function commandSetup(context) {
  const embed = brandEmbed(
    '⚙️ Setup JUANPLAY DEVJUANCHO v5',
    [
      '**Railway Variables:**',
      '`DISCORD_TOKEN=tu_token`',
      '`GUILD_ID=id_de_tu_servidor`',
      '`YOUTUBE_COOKIE=opcional_para_error_429`',
      '`STREAM_BACKEND=auto`',
      '',
      '**Discord Developer Portal → OAuth2:**',
      'Scopes: `bot` + `applications.commands`',
      'Permisos: Ver canales, Enviar mensajes, Leer historial, Usar comandos de barra diagonal, Conectarse, Hablar.',
      '',
      '**Pruebas:**',
      '`/permisos` → revisa permisos del canal',
      '`/testvoz` → prueba conexión de voz',
      '`/juanplay nombre o link` → reproduce música',
      '',
      '⚠️ Si queda en **signalling**, casi siempre es permiso de canal/region/host. Si YouTube da **429**, es bloqueo de IP y se arregla con `YOUTUBE_COOKIE` o IP limpia.'
    ].join('\n'),
    BRAND_COLOR
  );
  await safeReply(context, { embeds: [embed] });
}

async function commandCredits(context) {
  const embed = brandEmbed(
    '👑 Créditos JUANPLAY',
    [
      '💎 **Bot personalizado:** JUANPLAY',
      '👑 **Créditos:** DEVJUANCHO',
      '🏷️ **Marca:** JuanStudio',
      '🎧 **Tipo:** Music bot slash commands',
      '✨ **Estilo:** personalizado, decorado y listo para Railway'
    ].join('\n'),
    BRAND_COLOR
  );
  await safeReply(context, { embeds: [embed] });
}

async function commandPing(context) {
  await safeReply(context, {
    embeds: [brandEmbed('🏓 JUANPLAY ping', `Latencia: **${Math.round(client.ws.ping)}ms**`, OK_COLOR)]
  });
}

async function runCommand(context, commandName, args = []) {
  const command = commandName.toLowerCase();

  try {
    switch (command) {
      case 'help':
      case 'ayuda':
        return await commandHelp(context);
      case 'juanplay':
      case 'play': {
        const query = context.type === 'interaction'
          ? context.interaction.options.getString('busqueda', true)
          : args.join(' ');
        return await commandPlay(context, query);
      }
      case 'buscar':
      case 'search': {
        const query = context.type === 'interaction'
          ? context.interaction.options.getString('busqueda', true)
          : args.join(' ');
        return await commandBuscar(context, query);
      }
      case 'testvoz':
      case 'voice':
        return await commandTestVoice(context);
      case 'skip':
      case 'saltar':
        return await commandSkip(context);
      case 'stop':
      case 'parar':
        return await commandStop(context);
      case 'pause':
      case 'pausa':
        return await commandPause(context);
      case 'resume':
      case 'continuar':
        return await commandResume(context);
      case 'queue':
      case 'cola':
        return await commandQueue(context);
      case 'nowplaying':
      case 'np':
        return await commandNowPlaying(context);
      case 'leave':
      case 'salir':
        return await commandLeave(context);
      case 'volume':
      case 'volumen': {
        const level = context.type === 'interaction'
          ? context.interaction.options.getInteger('nivel', true)
          : Number(args[0]);
        if (!Number.isFinite(level)) throw new UserError('Escribe un volumen válido de 1 a 150.');
        return await commandVolume(context, level);
      }
      case 'plataformas':
      case 'platforms':
        return await commandPlatforms(context);
      case 'diagnostico':
      case 'diagnóstico':
      case 'diag':
        return await commandDiagnostico(context);
      case 'permisos':
      case 'perms':
        return await commandPermisos(context);
      case 'setup':
      case 'configurar':
        return await commandSetup(context);
      case 'creditos':
      case 'créditos':
      case 'credits':
        return await commandCredits(context);
      case 'ping':
        return await commandPing(context);
      default:
        throw new UserError('Comando no reconocido. Usa `/help`.');
    }
  } catch (error) {
    const message = error instanceof UserError
      ? error.message
      : 'Ocurrió un error interno. Revisa los logs de Railway.';

    if (!(error instanceof UserError)) console.error('[JUANPLAY] Error ejecutando comando:', error);
    await safeReply(context, { embeds: [errorEmbed(message)] }).catch(console.error);
  }
}

async function registerCommandsForGuild(guild) {
  await guild.commands.set(slashCommandData);
  console.log(`[JUANPLAY] Comandos slash registrados en: ${guild.name} (${guild.id})`);
}

async function registerSlashCommands() {
  if (config.guildId) {
    const guild = await client.guilds.fetch(config.guildId);
    await registerCommandsForGuild(guild);
    return;
  }

  const guilds = await client.guilds.fetch();
  for (const [, partialGuild] of guilds) {
    const guild = await partialGuild.fetch();
    await registerCommandsForGuild(guild);
  }
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`✅ JUANPLAY DEVJUANCHO v5 conectado como ${readyClient.user.tag}`);
  console.log(`🔗 ID de la app/bot: ${readyClient.user.id}`);
  console.log('🎵 Usa /help, /plataformas, /testvoz o /juanplay en Discord.');

  readyClient.user.setPresence({
    activities: [{ name: 'JUANPLAY v5 • DEVJUANCHO', type: ActivityType.Listening }],
    status: 'online'
  });

  try {
    await registerSlashCommands();
    console.log('✅ Comandos slash listos. Si no aparecen, reinvita el bot con bot + applications.commands.');
  } catch (error) {
    console.error('[JUANPLAY] No pude registrar comandos slash:', error);
  }
});

client.on(Events.GuildCreate, async guild => {
  try {
    await registerCommandsForGuild(guild);
  } catch (error) {
    console.error('[JUANPLAY] No pude registrar comandos en nuevo servidor:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  await runCommand({
    type: 'interaction',
    interaction,
    guild: interaction.guild,
    member: interaction.member,
    user: interaction.user,
    channel: interaction.channel
  }, interaction.commandName);
});

if (config.enablePrefixCommands) {
  client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(config.prefix)) return;

    const withoutPrefix = message.content.slice(config.prefix.length).trim();
    if (!withoutPrefix) return;

    const [commandName, ...args] = withoutPrefix.split(/\s+/);

    await runCommand({
      type: 'message',
      message,
      guild: message.guild,
      member: message.member,
      user: message.author,
      channel: message.channel
    }, commandName, args);
  });
}

process.on('unhandledRejection', error => {
  console.error('[JUANPLAY] Promesa rechazada:', error);
});

process.on('uncaughtException', error => {
  console.error('[JUANPLAY] Error no capturado:', error);
});

startHealthServer();
client.login(config.token);
