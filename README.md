# 🎧 JUANPLAY DEVJUANCHO DEFINITIVO v7

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

## ✅ Qué trae

- `/play` y `/juanplay` por nombre o link
- `/buscar` y `/recomendados` con botones
- YouTube por nombre, link y playlist
- SoundCloud y links directos de audio
- Spotify / Apple Music / Deezer: toma el título del link y busca la canción
- `/diagnostico`, `/testvoz`, `/plataformas`, `/creditos`
- Arreglo incluido para **Cannot find module @discordjs/opus / opusscript**

## 🚀 Variables en Railway

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
```

Opcional para YouTube 429:

```env
YOUTUBE_COOKIE=TU_COOKIE_NUEVA_DE_YOUTUBE
```

## 🍪 ¿Se puede sin cookie?

Sí. Primero prueba sin `YOUTUBE_COOKIE`. Si Railway muestra **429 / Too Many Requests**, YouTube bloqueó la IP del host y ahí sí necesitas una cookie nueva o usar otro hosting/IP.

No pegues cookies ni tokens en chats/capturas. Si ya los compartiste, cierra sesión o cambia contraseña y genera uno nuevo.

## 🧪 Orden recomendado de prueba

```txt
/diagnostico
/testvoz
/recomendados paulo londra no puedo
/play paulo londra no puedo
```

## 🔧 Si no suena

- El bot debe tener permisos en el canal: Ver canales, Conectarse, Hablar.
- Usa un canal de voz normal, no Stage/Escenario.
- Si `/diagnostico` dice Opus no instalado, Railway no instaló dependencias; usa este ZIP v7 completo.

---
👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v7**
