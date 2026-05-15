# 🎧 JUANPLAY DEVJUANCHO PÚBLICO v9.1

Versión basada en **tu código que sí funciona y sí se escucha**.

## ✅ Qué se conservó

- Motor de reproducción con `youtube-dl-exec` / `yt-dlp`.
- Búsqueda rápida con `yt-search`.
- Reproducción por nombre, link de YouTube, playlist, SoundCloud y links directos.
- Dependencias del bot original: `discord.js`, `@discordjs/voice`, `ffmpeg-static`, `opusscript`, etc.
- **Sin cookie obligatoria**. No tienes que poner tu cookie en Railway.

## ✨ Qué se mejoró

- Actividad dinámica del bot: muestra la canción que está sonando.
- `/panel` con botones: pausar, reanudar, saltar, detener y ver cola.
- `/queue` y `/cola` con cola completa paginada.
- Botón para vaciar cola.
- `/clearqueue` y `/limpiarcola`.
- Anti-spam con `COMMAND_COOLDOWN_MS`.
- Menos spam automático con `ANNOUNCE_NOW_PLAYING=false`.
- Embeds más decorados para público.
- Comandos extra: `/np`, `/invite`, `/remove`.
- Diagnóstico más completo.

## 🚀 Variables Railway

Obligatorias:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
```

Recomendadas:

```env
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
MAX_QUEUE_SIZE=500
QUEUE_PAGE_SIZE=10
COMMAND_COOLDOWN_MS=2500
ANNOUNCE_NOW_PLAYING=false
```

Personalización:

```env
BOT_NAME=JUANPLAY
BOT_BRAND=DEVJUANCHO • JuanStudio
BOT_COLOR=#ff2f7d
BOT_INVITE_URL=
SUPPORT_SERVER=
WEBSITE_URL=
```

## 🧪 Orden recomendado de prueba

```txt
/diagnostico
/testvoz
/panel
/recomendados paulo londra no puedo
/play paulo londra no puedo
/cola
```

## 🎨 Perfil del bot

El avatar, banner y descripción/About Me se cambian en **Discord Developer Portal**.  
Desde el código esta versión controla la **actividad dinámica** y todos los mensajes decorados.

---
👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v9.1**


## ✅ Fix v9.1 sin cookie

Esta versión conserva el motor de tu código que ya reproduce: `youtube-dl-exec` + `yt-dlp` directo, sin `YOUTUBE_COOKIE` obligatoria.

Si YouTube bloquea un video específico con `Sign in to confirm you’re not a bot`, el bot no se cae: intenta buscar una alternativa automática por el título de la canción y la pone al frente de la cola.

Variables importantes:

```env
DISCORD_TOKEN=TU_TOKEN
GUILD_ID=1201996939437289583
ANNOUNCE_NOW_PLAYING=false
COMMAND_COOLDOWN_MS=2500
```
