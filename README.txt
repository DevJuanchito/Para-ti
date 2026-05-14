JUANPLAY - Bot de música para Discord
Créditos únicos: DEVJUANCHO
Versión: 1.0.0 Railway

============================
ARCHIVOS INCLUIDOS
============================
- package.json
- index.js
- Dockerfile
- README.txt
- PERFIL_BOT_DEVJUANCHO.txt

============================
SUBIR A RAILWAY
============================
1. Sube este ZIP a Railway como nuevo proyecto.
2. Agrega las variables de entorno sin comillas.
3. Haz Redeploy.
4. En Discord prueba:
   /diagnostico
   /testvoz
   /testaudio
   /play

============================
VARIABLES DE RAILWAY
============================
DISCORD_TOKEN=token_nuevo_del_bot
GUILD_ID=id_del_servidor
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
MAX_QUEUE_SIZE=80
COMMAND_COOLDOWN_MS=2500
PRIVATE_COMMAND_RESPONSES=true
PUBLIC_NOWPLAYING_PANEL=true
AUTO_RECOMMEND_AFTER_END=true
END_RECOMMENDATIONS_MODE=button
RECOMMENDATION_COUNT=5
BOT_COLOR=#ff2f7d
DEFAULT_EMOJI=🐵
DEVELOPER_NAME=DEVJUANCHO
BOT_BRAND=JUANPLAY

Opcional solo si YouTube bloquea temporalmente la IP del hosting:
YOUTUBE_COOKIE=contenido_cookie_netscape

NO uses comillas en Railway.

============================
COMANDOS
============================
/play
/juanplay
/buscar
/recomendados
/similares
/queue
/nowplaying
/skip
/stop
/pause
/resume
/volume
/leave
/testvoz
/testaudio
/diagnostico
/perfil
/creditos
/help

============================
FUNCIONES IMPORTANTES
============================
- Reproduce por nombre de canción o link.
- Busca en YouTube por nombre usando yt-dlp.
- Soporta links de YouTube y SoundCloud cuando yt-dlp pueda extraerlos.
- Detecta Spotify, Apple Music y Deezer, e intenta convertirlos a búsqueda por título cuando yt-dlp pueda leer los metadatos.
- Autocomplete en opciones de canción.
- /buscar muestra resultados con botones privados.
- /recomendados y /similares son privados para evitar spam.
- Usa un panel público de reproducción que se edita.
- Botones del panel: Pausar, Reanudar, Saltar, Cola privada, Recomendados privados y Stop.
- Cooldown anti-spam.
- Límite de cola.
- Manejo bonito de errores.
- Diagnóstico con token, GUILD_ID, ffmpeg, yt-dlp, voz, permisos y versión.

============================
PERMISOS RECOMENDADOS
============================
- Ver canales
- Enviar mensajes
- Insertar enlaces
- Leer historial de mensajes
- Usar comandos de aplicación
- Conectarse
- Hablar
- Usar actividad de voz

============================
NOTA SOBRE YOUTUBE 429
============================
El bot no usa cookie de YouTube por defecto.
Si YouTube bloquea temporalmente la IP del hosting con error 429, el bot mostrará un mensaje claro.
Solo en ese caso puedes agregar la variable opcional YOUTUBE_COOKIE.

============================
DESARROLLADOR
============================
JUANPLAY fue creado para servidor público de Discord con diseño profesional.
Créditos únicos: DEVJUANCHO
