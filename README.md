# JUANPLAY DEVJUANCHO v4

Bot de música para Discord personalizado para **DEVJUANCHO / JuanStudio**.

## Comandos

- `/juanplay busqueda` - reproduce por nombre o link.
- `/play busqueda` - igual que `/juanplay`.
- `/buscar busqueda` - muestra resultados antes de reproducir.
- `/testvoz` - prueba conexión al canal de voz.
- `/queue` - muestra la cola.
- `/nowplaying` - canción actual.
- `/skip`, `/pause`, `/resume`, `/stop`, `/leave`.
- `/volume nivel` - cambia volumen de 1 a 150.
- `/plataformas` - muestra plataformas soportadas.
- `/diagnostico` - revisa variables y estado.
- `/creditos` - créditos DEVJUANCHO.

## Variables para Railway

Obligatorias:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
```

Muy recomendado si YouTube da error `Status code: 429` en Railway:

```env
YOUTUBE_COOKIE=SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...;
```

Ese error 429 no es del código: YouTube está bloqueando o limitando la IP del hosting. Esta versión acepta cookies para reducir ese bloqueo.

## Invitar bot

En Discord Developer Portal > OAuth2 > URL Generator marca:

Scopes:

```txt
bot
applications.commands
```

Permisos:

```txt
Ver canales
Enviar mensajes
Insertar enlaces
Leer historial de mensajes
Usar comandos de barra diagonal
Conectarse
Hablar
Usar sonidos externos
```

## Plataformas

- YouTube: links, búsquedas por nombre y playlists.
- SoundCloud: links directos; si falla, busca por nombre.
- Spotify / Apple Music / Deezer: lee metadata pública cuando puede y busca la canción para reproducirla.
- Links directos de audio: mp3, wav, ogg, opus, flac, m4a, webm.

Nota: Spotify, Apple Music y Deezer no entregan audio completo para bots por DRM/licencias; el bot los convierte a búsqueda reproducible.
