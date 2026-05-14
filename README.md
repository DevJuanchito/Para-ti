# 🎧 JUANPLAY DEVJUANCHO PÚBLICO v8.1

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

Esta versión está pensada para usarla con público: más decorada, menos spam, con cola completa, botones y actividad dinámica que muestra la canción que está sonando.

## ✅ Qué mejoró en v8.1

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
```

Opcional para `/invite`:

```env
BOT_INVITE_URL=TU_LINK_DE_INVITACION
SUPPORT_SERVER=TU_LINK_DE_SOPORTE
WEBSITE_URL=TU_WEB
```

Opcional cuando YouTube bloquea en Railway con 429 o `Sign in to confirm you’re not a bot`:

```env
YOUTUBE_COOKIE=TU_COOKIE_NUEVA_DE_YOUTUBE
YOUTUBE_COOKIE_BASE64=OPCIONAL_SI_LA_COOKIE_ESTA_EN_BASE64
```

## 🎨 Perfil del bot

Desde el código se actualiza la **actividad** del bot, por ejemplo:

```txt
Listening to 🎶 Nombre de la canción
```

El **avatar**, **banner** y **descripción/About Me** del bot se cambian en **Discord Developer Portal**, no dentro de `index.js`.

## 🍪 ¿Se puede sin cookie?

### Cómo resolver el error `Sign in to confirm you’re not a bot`

1. Usa una cuenta secundaria de YouTube.
2. Exporta cookies de YouTube en formato Netscape o copia el header `Cookie:`.
3. En Railway entra a **Variables** y agrega `YOUTUBE_COOKIE`.
4. Haz **Redeploy** del bot.
5. Ejecuta `/diagnostico`; debe decir `YOUTUBE_COOKIE: configurada`.

JUANPLAY v8.1 también evita el `Unhandled rejection` de yt-dlp y reduce spam: si YouTube bloquea sin cookie, solo avisa una vez por ventana de tiempo y limpia canciones de YouTube pendientes para no llenar el chat.


Sí. Primero prueba sin `YOUTUBE_COOKIE`. Si Railway muestra **429 / Too Many Requests** o **Sign in to confirm you’re not a bot**, YouTube bloqueó o limitó la IP del host y ahí sí necesitas una cookie nueva o usar otro hosting/IP.

No pegues cookies ni tokens en chats/capturas. Si ya los compartiste, cierra sesión o cambia contraseña y genera uno nuevo.

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
- Si YouTube bloquea con 429 o `Sign in to confirm you’re not a bot`, agrega `YOUTUBE_COOKIE` nueva en Railway, haz redeploy o usa otro hosting/IP.

---

👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v8.1**
