# JUANPLAY Bot v3 listo para Railway

Esta version corrige el error donde el bot mostraba **Ocurrio un error interno** al usar `/play` o `/juanplay`.
Ahora usa busqueda por nombre con `yt-search`, enlaces de YouTube con `@distube/ytdl-core`, y trae mensajes de error mas claros si Railway o Discord no dejan entrar al canal de voz.

## Comandos

```txt
/help
/juanplay busqueda
/play busqueda
/testvoz
/skip
/stop
/pause
/resume
/queue
/nowplaying
/leave
/ping
```

Ejemplos:

```txt
/juanplay never gonna give you up
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
/testvoz
```

## 1. Variables obligatorias en Railway

En Railway > tu servicio > Variables agrega:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
```

Recomendado para que los comandos aparezcan rapido:

```env
GUILD_ID=ID_DE_TU_SERVIDOR
```

Para copiar el ID del servidor:
Discord > Ajustes de usuario > Avanzado > activar **Modo desarrollador** > clic derecho al servidor > **Copiar ID**.

## 2. Invitar el bot correctamente

En Discord Developer Portal > OAuth2 > URL Generator marca:

```txt
bot
applications.commands
```

Permisos recomendados:

```txt
Ver canales
Enviar mensajes
Insertar enlaces
Leer el historial de mensajes
Usar comandos de barra diagonal
Conectarse
Hablar
Usar sonidos externos
```

Luego copia la URL generada e invita el bot otra vez.

## 3. Si `/play` falla con voz

Primero prueba:

```txt
/testvoz
```

Si dice que no pudo conectarse:

1. Entra tu primero a un canal de voz normal.
2. Revisa que el bot tenga **Ver canales**, **Conectarse** y **Hablar** en ese canal.
3. En Discord, cambia la region del canal de voz a **Automatico**.
4. Si Railway sigue mostrando `AbortError` en `@discordjs/voice`, el problema es conexion de voz/UDP del hosting. El bot esta bien, pero ese host no esta logrando abrir la conexion de voz de Discord.

## 4. Si YouTube bloquea canciones

Puedes agregar opcionalmente en Railway:

```env
YOUTUBE_COOKIE=TU_COOKIE_DE_YOUTUBE
```

No es obligatorio. Usalo solo si los logs dicen que YouTube bloqueo o pidio verificacion.

## 5. Comandos con ! opcionales

Si quieres `!play`, `!help`, etc., agrega en Railway:

```env
ENABLE_PREFIX_COMMANDS=true
PREFIX=!
```

Y en Developer Portal > Bot activa:

```txt
Intent de contenido de mensajes
```
