# JUANVOICE

JUANVOICE es un bot de Discord TTS para leer en voz alta mensajes escritos por usuarios en canales de voz.

No usa música, YouTube, yt-dlp, cookies ni extractores. Solo convierte texto a voz y lo reproduce en Discord Voice.

## Características

- Slash commands registrados automáticamente con `GUILD_ID`.
- Comandos `/join`, `/leave`, `/decir`, `/hablar`, `/voces`, `/setvoz`, `/autotts`, `/stop`, `/cola`, `/limpiarcola`, `/panel`, `/diagnostico` y `/help`.
- Cola TTS por servidor.
- Cooldown por usuario.
- Límite configurable de texto.
- Limpieza de markdown, menciones, URLs, `@everyone` y `@here`.
- Limpieza de archivos temporales MP3.
- Health server para Railway usando `PORT`.
- Embeds y botones con estilo profesional.
- Fallback TTS gratuito con `google-tts-api`.
- Reintentos y timeout configurable para conexión de voz.
- Diagnóstico de Node.js, FFmpeg, dependencia de voz, ping, uptime y estado de conexión.

## Requisitos

- Node.js 20.
- Bot de Discord con permisos:
  - View Channel
  - Send Messages
  - Use Slash Commands
  - Connect
  - Speak
- En Discord Developer Portal activa:
  - Server Members Intent no es obligatorio para lo básico.
  - Message Content Intent es necesario para `/autotts canal`.

## Instalación local

```bash
npm install
cp .env.example .env
npm run check
npm start
```

## Railway

1. Sube este proyecto a GitHub.
2. Crea un nuevo proyecto en Railway desde el repositorio.
3. Agrega las variables de entorno.
4. Deploy.
5. Revisa los Deploy Logs y prueba `/diagnostico`.

## Variables ENV

```env
DISCORD_TOKEN=token_del_bot
GUILD_ID=id_del_servidor
DEFAULT_VOICE=es-LA-female
BOT_COLOR=#ff2f7d
COMMAND_COOLDOWN_MS=3000
MAX_TEXT_LENGTH=250
MAX_QUEUE_SIZE=50
VOICE_TIMEOUT_MS=120000
VOICE_JOIN_TIMEOUT_MS=45000
VOICE_JOIN_RETRIES=2
AUTO_TTS_ENABLED=false
TTS_PROVIDER=auto
DEBUG_VOICE=false
PORT=3000
```

### Variables importantes

- `VOICE_JOIN_TIMEOUT_MS`: tiempo máximo para que Discord Voice llegue a estado `Ready`. En Railway conviene usar `45000` o `60000`.
- `VOICE_JOIN_RETRIES`: cantidad de reintentos para entrar al canal de voz. Recomendado: `2`.
- `DEBUG_VOICE`: ponlo en `true` temporalmente si el bot entra pero no habla. Verás transiciones como `signalling -> connecting -> ready`.
- `TTS_PROVIDER`: usa `auto`, `edge` o `google`. Si Edge falla, `auto` intenta Google.

## Comandos

### `/join`
El bot entra al canal de voz donde está el usuario.

### `/leave`
El bot sale del canal de voz y limpia cola.

### `/decir texto voz`
Lee un texto con voz opcional.

### `/hablar texto`
Lee un texto con la voz predeterminada.

### `/voces`
Muestra voces disponibles.

### `/setvoz voz`
Configura la voz predeterminada del servidor.

### `/autotts canal`
Activa lectura automática en un canal de texto.

### `/autotts off`
Desactiva lectura automática.

### `/stop`
Detiene audio actual y limpia cola.

### `/cola`
Muestra la cola.

### `/limpiarcola`
Vacía la cola pendiente sin detener el audio actual.

### `/panel`
Muestra botones: Entrar, Salir, Detener, Limpiar cola y Ver cola.

### `/diagnostico`
Muestra estado del bot, canal actual, cola, voz, Node, FFmpeg, ping, uptime, motor TTS y dependencia de voz.

### `/help`
Muestra ayuda decorada.

## Pruebas rápidas

```txt
/diagnostico
/join
/decir texto:hola mundo
/panel
/leave
```

## Si aparece `AbortError: The operation was aborted`

Ese error no es del TTS. Significa que Discord Voice no llegó al estado `Ready` antes del timeout.

Pasos recomendados:

1. En Railway agrega:

```env
VOICE_JOIN_TIMEOUT_MS=60000
VOICE_JOIN_RETRIES=3
DEBUG_VOICE=true
```

2. Redeploy.
3. Cambia la región del canal de voz a **Automático** o prueba otra región.
4. Verifica que el bot tenga permisos `Connect` y `Speak`.
5. Prueba primero `/join`; si `/join` no conecta, `/decir` tampoco podrá hablar.

## GitHub

```bash
git init
git add .
git commit -m "JUANVOICE TTS voice connection fix"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/JUANVOICE.git
git push -u origin main
```

## Scripts

```json
{
  "start": "node index.js",
  "check": "node --check index.js"
}
```

## Footer

DEVJUANCHO • JuanStudio • JUANVOICE
