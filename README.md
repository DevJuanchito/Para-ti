# 🎧 JUANPLAY DEVJUANCHO PÚBLICO v13

Bot de música listo para servidor público. Desarrollador único: **DEVJUANCHO**.

## ✅ Arreglos de v13

- Audio mantenido con el sistema estable de v7 para que vuelva a sonar.
- Agregado `/testaudio` para comprobar con un tono real si Discord está escuchando audio.
- Agregado `libsodium-wrappers` y `prism-media` para mejorar compatibilidad de voz en Railway.
- Mantiene el diseño público decorado de v10.
- Panel público único: se edita en vez de spamear el canal.
- Recomendaciones privadas: solo las ve la persona que las pidió.
- Actividad dinámica: el bot aparece escuchando la canción actual.
- Respuestas privadas por defecto.
- Botones de control: pausar, seguir, saltar, cola privada, stop y recomendados.
- Créditos únicos: **DEVJUANCHO**.

## 🚨 Muy importante

Si pegaste tu `DISCORD_TOKEN` en un chat o captura, debes **resetearlo** en Discord Developer Portal:

`Developer Portal → Applications → tu bot → Bot → Reset Token`

Luego pon el token nuevo en Railway. No uses el token viejo.

## 🚀 Variables Railway

Pega estas variables en Railway → Servicio del bot → Variables:

```env
DISCORD_TOKEN=TU_TOKEN_NUEVO_DEL_BOT
GUILD_ID=1201996939437289583
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
```

No pongas comillas. Railway las acepta sin comillas.

## 🍪 Cookie de YouTube

No pongas cookie si el bot funciona. Solo agrega:

```env
YOUTUBE_COOKIE=TU_COOKIE_NUEVA
```

si aparece error **429 / Too Many Requests**.

## 🧪 Prueba después de subir

```txt
/diagnostico
/testvoz
/testaudio
/play paulo londra no puedo
/nowplaying
/recomendados
```

## 🎨 Perfil recomendado

El archivo `PERFIL_BOT_DEVJUANCHO.txt` trae el texto listo para copiar en el perfil/About Me del bot.

La descripción del perfil se cambia manualmente en Discord Developer Portal. El código sí cambia automáticamente la actividad del bot cuando hay música.
