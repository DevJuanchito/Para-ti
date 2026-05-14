# JUANPLAY Bot listo para Railway

Bot de musica para Discord con comandos slash. El nombre unico principal es:

```txt
/juanplay
```

Tambien incluye:

```txt
/help
/play
/skip
/stop
/pause
/resume
/queue
/nowplaying
/leave
/ping
```

## 1. Subir a Railway

1. Sube este proyecto a GitHub o a Railway.
2. En Railway, abre tu servicio.
3. Ve a **Variables**.
4. Agrega esta variable:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
```

5. Deploy / redeploy.

El bot registra los comandos slash automaticamente al iniciar.

## 2. Invitar el bot correctamente

En Discord Developer Portal > tu app > OAuth2 > URL Generator marca:

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

Copia la URL generada, abre el enlace e invita el bot otra vez.

## 3. Si los comandos no aparecen

En Railway agrega tambien esta variable opcional:

```env
GUILD_ID=ID_DE_TU_SERVIDOR
```

Luego redeploy. Los comandos se registran directo en ese servidor y aparecen mucho mas rapido.

Para copiar el ID del servidor: Discord > Ajustes de usuario > Avanzado > activa **Modo desarrollador**. Despues clic derecho al servidor > **Copiar ID**.

## 4. Comando principal

Entra a un canal de voz y escribe en un canal de texto:

```txt
/juanplay nombre de la cancion
```

Ejemplos:

```txt
/juanplay never gonna give you up
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
/queue
/skip
/stop
```

## 5. Comandos con ! opcionales

Por seguridad vienen apagados porque requieren activar **Message Content Intent** en Developer Portal.

Si quieres comandos tipo `!play`, activa en Railway:

```env
ENABLE_PREFIX_COMMANDS=true
PREFIX=!
```

Y en Discord Developer Portal > Bot activa:

```txt
Intent de contenido de mensajes
```

## 6. Notas

- No pegues tu token en chats ni en GitHub.
- No subas `config.json` si tiene token real.
- Si Railway dice `Falta configurar DISCORD_TOKEN`, la variable esta mal escrita o vacia.
