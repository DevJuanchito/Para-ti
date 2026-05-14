# 🎧 JUANPLAY DEVJUANCHO DEFINITIVO v6

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

## ✅ Qué trae

- `/play` y `/juanplay` por **nombre** o **link**.
- Autocomplete/recomendados al escribir canciones.
- `/buscar` con resultados y botones para elegir.
- Soporta YouTube, SoundCloud, links directos y muchas plataformas soportadas por `yt-dlp`.
- Spotify / Apple Music / Deezer: toma el nombre del link y lo busca en YouTube.
- Mensajes decorados, créditos DEVJUANCHO, cola, volumen, pause/resume/skip/stop.
- Dockerfile incluido para Railway con Python + FFmpeg + yt-dlp.

## 🚀 Variables en Railway

En Railway → servicio del bot → Variables:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
```

Para evitar bloqueo 429 de YouTube en Railway:

```env
YOUTUBE_COOKIE=TU_COOKIE_NUEVA_DE_YOUTUBE
```

**Usa una cuenta secundaria para la cookie. No pegues la cookie en chats ni capturas.**

## 🔗 Invitación del bot

En Discord Developer Portal → OAuth2 → URL Generator:

Scopes:

```txt
bot
applications.commands
```

Permisos:

```txt
Ver canales
Enviar mensajes
Insertar enlaces
Leer historial de mensajes
Usar comandos de barra diagonal
Conectarse
Hablar
Usar actividad de voz
Usar sonidos externos
```

## 🎮 Comandos

```txt
/help
/play busqueda
/juanplay busqueda
/buscar busqueda
/recomendados busqueda
/nowplaying
/queue
/skip
/stop
/pause
/resume
/volume numero
/testvoz
/diagnostico
/plataformas
/creditos
/leave
/ping
```

## 🛠️ Si falla

- Si sale `429`, YouTube bloqueó la IP del hosting. Agrega `YOUTUBE_COOKIE` nueva.
- Si sale `signalling` o no entra a voz, revisa permisos del canal de voz o usa un hosting que permita Discord Voice/UDP.
- Prueba primero `/diagnostico` y `/testvoz`.
