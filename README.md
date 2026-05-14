# JUANPLAY DEVJUANCHO PUBLICO v10

Bot de música listo para Railway, decorado para servidor público y con menos spam.

## Desarrollador

**DEVJUANCHO**

## Lo nuevo en v10

- Música por nombre y por link.
- Sistema de audio más estable con **yt-dlp + FFmpeg + opusscript**.
- Actividad automática: cuando suena una canción, el perfil del bot muestra lo que se está escuchando.
- Panel público único: se edita en vez de mandar muchos mensajes.
- Recomendaciones privadas: solo las ve quien pulsa el botón o usa `/recomendados`.
- `/perfil` con el texto recomendado para el perfil/descripción.
- Diagnóstico con `/diagnostico` para revisar FFmpeg, yt-dlp, Opus, conexión y cola.

## Variables Railway

Pon estas variables en Railway → servicio del bot → Variables:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
MAX_QUEUE_SIZE=80
COMMAND_COOLDOWN_MS=2500
PRIVATE_COMMAND_RESPONSES=true
PUBLIC_NOWPLAYING_PANEL=true
AUTO_RECOMMEND_AFTER_END=true
RECOMMENDATION_COUNT=5
BOT_COLOR=#ff2f7d
DEFAULT_EMOJI=🐵
DEVELOPER_NAME=DEVJUANCHO
BOT_BRAND=JUANPLAY
```

No pongas `YOUTUBE_COOKIE` si ya reproduce bien. Solo úsala si YouTube devuelve error 429.

## Comandos

```txt
/play
/juanplay
/buscar
/recomendados
/similares
/queue
/nowplaying
/pause
/resume
/skip
/stop
/leave
/volume
/testvoz
/diagnostico
/perfil
/creditos
/help
/ping
```

## Perfil del bot

La descripción real del bot se cambia manualmente en Discord Developer Portal:

Discord Developer Portal → Applications → tu bot → General Information / Bot.

Texto recomendado:

```txt
🎵 JUANPLAY — música con comandos slash, búsqueda, cola, recomendados privados y panel limpio para servidores públicos.
Desarrollador único: DEVJUANCHO.
Usa /play, /buscar, /recomendados y /help.
```

La actividad de Discord sí la cambia el código automáticamente. Cuando reproduce, aparece la canción actual.

## Si no se escucha

1. Usa `/diagnostico`.
2. Usa `/testvoz`.
3. Revisa que el bot tenga permisos en el canal de voz:
   - Ver canal
   - Conectarse
   - Hablar
   - Usar actividad de voz
4. Asegúrate de usar este ZIP completo con Dockerfile. Railway instalará FFmpeg y yt-dlp.
