# 🎧 JUANPLAY DEVJUANCHO PÚBLICO v9.3

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

Esta versión está basada en tu código que sí se escucha, pero trae mejoras para uso público:

- Motor `yt-dlp` directo conservado.
- Sin cookies obligatorias.
- Prueba varios clientes internos de YouTube: `default, android, ios, mweb, web`.
- Si YouTube bloquea un video, intenta alternativa por SoundCloud y luego otra búsqueda.
- `/panel` con botones.
- `/cola` y `/queue` con páginas.
- `/clearqueue` y `/limpiarcola` para vaciar cola.
- Actividad dinámica con la canción actual.
- Anti-spam con cooldown.
- Embeds decorados para público.

## Variables Railway listas

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=1201996939437289583

VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
MAX_QUEUE_SIZE=500
QUEUE_ITEMS_PER_PAGE=10
COMMAND_COOLDOWN_MS=2500
ANNOUNCE_NOW_PLAYING=false

YTDLP_PLAYER_CLIENTS=default,android,ios,mweb,web
YTDLP_FORCE_IPV4=true
YTDLP_STREAM_START_TIMEOUT_MS=2500
SOUNDCLOUD_FALLBACK=true

BOT_NAME=JUANPLAY
BOT_BRAND=DEVJUANCHO • JuanStudio
BOT_COLOR=#ff2f7d
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36
```

No agregues `YOUTUBE_COOKIE` si no quieres usar cookie.

## Prueba recomendada

```txt
/diagnostico
/testvoz
/play paulo londra no puedo
/panel
/cola
```

## Si Railway muestra `Sign in to confirm you're not a bot`

Eso significa que YouTube marcó la IP del hosting o ese video. El bot no se cae: intenta otros clientes, SoundCloud y alternativas. También puedes probar:

- Escribir el nombre de la canción en vez de pegar link.
- Usar SoundCloud.
- Usar link directo `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`, `.webm`.

---
👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v9.3**


## 🧯 Fix Railway Build

Esta versión no usa `postinstall`, para que Railway/Docker no fallen durante `npm install`.

Sube todos los archivos a la raíz del repo: `index.js`, `package.json`, `nixpacks.toml`, `Dockerfile`, `.env.example` y `README.md`.
