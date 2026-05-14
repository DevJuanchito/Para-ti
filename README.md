# 🎧 JUANPLAY DEVJUANCHO PÚBLICO v8.2 SIN COOKIE

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

Esta versión está pensada para usarla con público: más decorada, menos spam, con cola completa, botones y actividad dinámica que muestra la canción que está sonando.

## ✅ Qué mejoró en v8.2

- 🚫 **Sin cookie obligatoria:** no tienes que poner ninguna cookie personal en Railway.
- 🔁 **Reintentos YouTube:** si Railway rechaza un modo, intenta `default`, `android`, `ios`, `mweb` y `web` automáticamente.
- 🎶 **Actividad dinámica:** el estado del bot cambia a la canción actual.
- 🎨 **Embeds premium:** mensajes más decorados con marca, footer, mini paneles y thumbnails.
- 📜 **Cola completa paginada:** `/queue` y `/cola` muestran toda la cola con botones de página.
- 🧹 **Vaciar cola:** `/clearqueue` y `/limpiarcola` limpian la cola sin parar la canción actual.
- 🎛️ **Panel con botones:** `/panel`, `/nowplaying`, `/np` traen botones para pausar, seguir, saltar, ver cola y detener.
- 🛡️ **Anti-spam:** cooldown configurable con `COMMAND_COOLDOWN_MS`.
- 🔕 **Menos spam automático:** `ANNOUNCE_NOW_PLAYING=false` evita que el bot mande un mensaje nuevo por cada canción.
- 🔒 **Controles protegidos:** solo usuarios en el mismo canal de voz pueden pausar, saltar, detener, limpiar cola o cambiar volumen.
- 🌐 **Listo para público:** límite de cola configurable con `MAX_QUEUE_SIZE`.

## 📘 Comandos

### Música

```txt
/play busqueda
/juanplay busqueda
/buscar busqueda
/recomendados busqueda
/nowplaying
/np
/panel
```

### Cola y controles

```txt
/queue pagina
/cola pagina
/clearqueue
/limpiarcola
/skip
/stop
/pause
/resume
/volume numero
/leave
```

### Configuración y ayuda

```txt
/help
/setup
/diagnostico
/testvoz
/plataformas
/invite
/creditos
/ping
```

## 🚀 Variables en Railway

Obligatorias:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
```

Recomendadas:

```env
BOT_NAME=JUANPLAY
BOT_BRAND=DEVJUANCHO • JuanStudio
BOT_COLOR=#ff2f7d
COMMAND_COOLDOWN_MS=2500
ANNOUNCE_NOW_PLAYING=false
MAX_QUEUE_SIZE=500
QUEUE_ITEMS_PER_PAGE=10
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
YOUTUBE_PLAYER_CLIENTS=default,android,ios,mweb,web
YOUTUBE_FORCE_IPV4=true
```

Opcional para `/invite`:

```env
BOT_INVITE_URL=TU_LINK_DE_INVITACION
SUPPORT_SERVER=TU_LINK_DE_SOPORTE
WEBSITE_URL=TU_WEB
```

## 🎨 Perfil del bot

Desde el código se actualiza la **actividad** del bot, por ejemplo:

```txt
Listening to 🎶 Nombre de la canción
```

El **avatar**, **banner** y **descripción/About Me** del bot se cambian en **Discord Developer Portal**, no dentro de `index.js`.

## 🍪 Sobre cookies

Esta versión **no te pide cookie** y no trae variable `YOUTUBE_COOKIE` en el `.env.example`.

Si YouTube rechaza un video en Railway, JUANPLAY intenta varios clientes alternativos sin cookie. Si aun así un video falla, prueba otro resultado, otro link, SoundCloud o un link directo de audio.

## 🧪 Orden recomendado de prueba

```txt
/diagnostico
/testvoz
/recomendados paulo londra no puedo
/play paulo londra no puedo
/nowplaying
/queue
/clearqueue
```

## 🔧 Si no suena

- El bot debe tener permisos en el canal: Ver canales, Conectarse, Hablar.
- Usa un canal de voz normal, no Stage/Escenario.
- Si `/diagnostico` dice Opus no instalado, Railway no instaló dependencias; revisa `package.json`.
- Si un video de YouTube falla, prueba otro resultado, otro link o SoundCloud/link directo.
- Para probar otros modos puedes cambiar `YOUTUBE_PLAYER_CLIENTS`, por ejemplo:

```env
YOUTUBE_PLAYER_CLIENTS=android,ios,mweb,web,default
```

---

👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v8.2**
