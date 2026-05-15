# 💖 JUANVOICE

JUANVOICE es un bot de Discord **solo TTS**: entra a un canal de voz y lee en voz alta lo que los usuarios escriben.

No usa música, no usa YouTube, no usa `yt-dlp`, no usa cookies y no necesita una API de pago para TTS.

## ✨ Funciones

- `/join` entra al canal de voz donde está el usuario.
- `/leave` sale del canal de voz.
- `/decir texto voz` lee texto con voz opcional.
- `/hablar texto` lee texto con la voz predeterminada.
- `/voces` muestra voces disponibles.
- `/setvoz voz` configura la voz predeterminada del servidor.
- `/autotts canal` activa lectura automática en un canal de texto.
- `/autotts off` desactiva AutoTTS.
- `/stop` detiene el audio actual y limpia la cola.
- `/cola` muestra la cola TTS.
- `/limpiarcola` vacía la cola sin detener el audio actual.
- `/panel` muestra botones: Entrar, Salir, Detener, Limpiar cola, Ver cola.
- `/diagnostico` muestra conexión, canal, cola, voz, Node.js, FFmpeg, motor TTS, dependencias de voz, ping y uptime.
- `/help` muestra ayuda completa.

## 🧠 TTS usado

Este proyecto usa `edge-tts-universal`, una librería gratuita que genera audio con voces neurales de Microsoft Edge TTS desde Node.js. Además incluye fallback con `google-tts-api` para que, si Edge TTS falla temporalmente, el bot intente generar el MP3 por otra ruta gratuita.

No requiere API key ni variable ENV de pago. Puedes controlar el motor con `TTS_PROVIDER=auto`, `edge` o `google`.

Voces incluidas:

- `es-LA-female` — Español latino femenino
- `es-LA-male` — Español latino masculino
- `es-ES-female` — Español España femenino
- `es-ES-male` — Español España masculino
- `en-US-female` — Inglés femenino
- `en-US-male` — Inglés masculino

## 📦 Requisitos

- Node.js 20
- Un bot de Discord creado en el Discord Developer Portal
- Permisos del bot:
  - View Channels
  - Send Messages
  - Use Slash Commands
  - Connect
  - Speak
  - Read Message History
- Para `/autotts`, activa **Message Content Intent** en el portal de Discord.

## 📁 Archivos del proyecto

```txt
JUANVOICE/
├─ index.js
├─ package.json
├─ README.md
├─ .env.example
├─ nixpacks.toml
└─ Dockerfile
```

## ⚙️ Variables ENV

Copia esto en Railway o en tu archivo `.env` local:

```env
DISCORD_TOKEN=token_del_bot
GUILD_ID=id_del_servidor
DEFAULT_VOICE=es-LA-female
BOT_COLOR=#ff2f7d
COMMAND_COOLDOWN_MS=3000
MAX_TEXT_LENGTH=250
MAX_QUEUE_SIZE=50
VOICE_TIMEOUT_MS=120000
AUTO_TTS_ENABLED=false
TTS_PROVIDER=auto
PORT=3000
```

### Explicación rápida

- `DISCORD_TOKEN`: token del bot.
- `GUILD_ID`: ID del servidor donde se registran los slash commands.
- `DEFAULT_VOICE`: voz inicial del bot.
- `BOT_COLOR`: color de los embeds.
- `COMMAND_COOLDOWN_MS`: cooldown por usuario.
- `MAX_TEXT_LENGTH`: máximo de caracteres por mensaje TTS.
- `MAX_QUEUE_SIZE`: máximo de mensajes pendientes en cola.
- `VOICE_TIMEOUT_MS`: tiempo para salir del canal si queda inactivo.
- `AUTO_TTS_ENABLED`: valor base del modo automático.
- `TTS_PROVIDER`: `auto` usa Edge TTS y fallback Google; `edge` fuerza Edge; `google` fuerza Google TTS.
- `PORT`: puerto usado por el health server de Railway.

## 🚀 Instalación local

```bash
npm install
cp .env.example .env
npm run check
npm start
```

Edita `.env` con tu token real y el ID de tu servidor.

## 🧪 Comandos para probar

```txt
/diagnostico
/join
/decir texto:hola mundo
/panel
/leave
```

También puedes probar:

```txt
/voces
/setvoz voz:es-LA-male
/hablar texto:probando juanvoice
/autotts canal:#general
/autotts off
```


## 🔧 Si el bot entra pero no habla

Usa este orden:

```txt
/diagnostico
/join
/decir texto:hola mundo
```

Revisa en `/diagnostico`:

- **Voz** debe decir `Conectado`.
- **FFmpeg** debe aparecer detectado.
- **Dependencias voz** debe mostrar `@discordjs/voice`, `prism-media` y `opusscript` disponibles.
- **Motor TTS** debe decir `auto`, `edge` o `google`.

Si Edge TTS no genera audio en Railway, cambia la variable:

```env
TTS_PROVIDER=google
```

Luego redeploy en Railway.

## 🚂 Subir a Railway

1. Sube este proyecto a GitHub.
2. En Railway, crea un nuevo proyecto desde el repositorio.
3. Agrega las variables ENV del bloque anterior.
4. Railway detectará `package.json` y usará `nixpacks.toml`.
5. El bot abrirá un health server usando `PORT`.

`nixpacks.toml` instala:

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "ffmpeg"]
```

## 🐳 Docker opcional

También se incluye `Dockerfile` por si quieres desplegar con Docker.

```bash
docker build -t juanvoice .
docker run --env-file .env -p 3000:3000 juanvoice
```

## ⬆️ Subir a GitHub

Desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "JUANVOICE bot TTS inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/JUANVOICE.git
git push -u origin main
```

## 🔐 Importante

Nunca subas tu `.env` real ni tu token a GitHub. Solo sube `.env.example`.

## 🛡️ Anti-spam y seguridad

JUANVOICE incluye:

- Cooldown por usuario.
- Límite de caracteres configurable.
- Tamaño máximo de cola configurable.
- Bloqueo de `@everyone` y `@here`.
- Limpieza de markdown, menciones, emojis raros y enlaces antes de leer.
- Borrado automático de audios temporales.
- Manejo de errores para evitar que el bot se apague por fallos normales.

---

DEVJUANCHO • JuanStudio • JUANVOICE
