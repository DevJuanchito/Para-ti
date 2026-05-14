# JUANPLAY DEVJUANCHO v5

Bot de música personalizado para Discord, decorado al estilo **JUANPLAY / DEVJUANCHO / JuanStudio**.

## Comandos

- `/juanplay busqueda`
- `/play busqueda`
- `/buscar busqueda`
- `/plataformas`
- `/permisos`
- `/testvoz`
- `/diagnostico`
- `/setup`
- `/skip`
- `/stop`
- `/pause`
- `/resume`
- `/queue`
- `/nowplaying`
- `/volume nivel`
- `/leave`
- `/creditos`
- `/ping`

## Plataformas

- YouTube links, nombres y playlists.
- SoundCloud links.
- Spotify / Apple Music / Deezer links por metadata: JUANPLAY busca la canción reproducible.
- Audio directo: `.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus`, `.flac`, `.aac`, `.webm`, `.mp4`.

## Variables en Railway

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
YOUTUBE_COOKIE=OPCIONAL_PARA_ERROR_429
STREAM_BACKEND=auto
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
```

## Importante sobre YouTube 429

Si Railway muestra `Status code: 429`, YouTube está bloqueando la IP del host. El bot ya prueba varios backends, pero si la IP está bloqueada necesitas `YOUTUBE_COOKIE`, una IP limpia/proxy, o probar SoundCloud/audio directo.

## Importante sobre voz / signalling

Si `/testvoz` queda en `signalling`, revisa:

1. El bot tiene permisos en ese canal: **Ver canales**, **Conectarse**, **Hablar**.
2. El canal es voz normal, no Stage/Escenario.
3. La región del canal está en Automático.
4. Si el host no permite Discord Voice/UDP, usa un host/VPS que sí lo permita.

## OAuth2

Scopes:

```txt
bot
applications.commands
```

Permisos mínimos:

```txt
Ver canales
Enviar mensajes
Leer historial de mensajes
Usar comandos de barra diagonal
Conectarse
Hablar
Insertar enlaces
Añadir reacciones
Usar sonidos externos
```

Créditos: **DEVJUANCHO • JuanStudio**
