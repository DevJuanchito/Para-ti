# ✨ Embed Studio Bot

Bot de Discord dedicado a crear, previsualizar, enviar y editar **embeds bonitos** en cualquier canal donde tenga permisos.

Hecho para subir a **GitHub** y desplegar en **Railway**.

## Características

- `/embed crear` — crea un embed personalizado.
- `/embed plantilla` — usa plantillas decoradas para anuncios, reglas, updates, eventos, sorteos, staff, tienda y mantenimiento.
- `/embed editar` — edita un embed enviado por el bot usando el ID del mensaje.
- `/embed json` — pega JSON avanzado para crear embeds.
- `/embed ayuda` — muestra ayuda rápida.
- Previsualización privada antes de enviar.
- Botones con enlace.
- Imágenes y GIFs animados usando URL.
- Placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`, `{channel}`.
- Sin MongoDB, sin base de datos, sin archivos de configuración obligatorios.
- Funciona en el canal actual si no eliges canal.

## Requisitos

- Node.js 20 o superior.
- Una aplicación de Discord con bot creado.
- Permisos del bot en el servidor:
  - `Send Messages`
  - `Embed Links`
  - `Read Message History` si quieres usar `/embed editar`
  - `Use Slash Commands`

## Variables de entorno

Copia `.env.example` a `.env` para pruebas locales:

```env
DISCORD_TOKEN=PEGA_TU_TOKEN_AQUI
CLIENT_ID=PEGA_EL_CLIENT_ID_AQUI
GUILD_ID=
AUTO_DEPLOY_COMMANDS=true
BOT_BRAND=Embed Studio
```

### GUILD_ID

- Con `GUILD_ID` lleno: los comandos aparecen rápido solo en ese servidor.
- Con `GUILD_ID` vacío: los comandos son globales para todos los servidores donde invites el bot.

## Instalación local

```bash
npm install
npm run deploy
npm start
```

También puedes dejar `AUTO_DEPLOY_COMMANDS=true` y solo ejecutar:

```bash
npm start
```

## Deploy en Railway

1. Sube este proyecto a GitHub.
2. Entra a Railway.
3. Crea un nuevo proyecto desde tu repo de GitHub.
4. Agrega estas variables en Railway:

```env
DISCORD_TOKEN=tu_token_real
CLIENT_ID=id_de_tu_aplicacion
GUILD_ID=
AUTO_DEPLOY_COMMANDS=true
BOT_BRAND=Embed Studio
```

5. Railway ejecutará `npm start` usando `railway.json`.

No necesitas MongoDB ni volumen para este bot, porque no guarda configuración permanente.

## Cómo usarlo

### Crear embed personalizado

```text
/embed crear titulo:📢 Anuncio descripcion:Hoy hay novedades color:premium
```

### Enviar al canal actual

No pongas `canal` y se enviará donde ejecutaste el comando.

### Enviar a otro canal

Usa la opción `canal`.

### Plantillas bonitas

```text
/embed plantilla tipo:📢 Anuncio mensaje:Nuevo evento hoy a las 7PM
```

### GIF animado

Pon una URL `.gif` en `imagen` o `thumbnail`.

### Botón con enlace

Usa `boton_texto` y `boton_url` juntos.

```text
/embed crear titulo:Visita la web descripcion:Toca el botón boton_texto:Abrir boton_url:https://example.com
```

### Editar un embed

Activa el modo desarrollador en Discord, copia el ID del mensaje y usa:

```text
/embed editar mensaje_id:123456789 titulo:Nuevo título descripcion:Nueva descripción
```

## JSON avanzado

Puedes pegar un embed simple:

```json
{
  "title": "📢 Anuncio",
  "description": "Mensaje bonito",
  "color": 5793266
}
```

O un mensaje completo:

```json
{
  "content": "Texto fuera del embed",
  "embeds": [
    {
      "title": "✨ Embed avanzado",
      "description": "Creado desde JSON",
      "color": 16741370
    }
  ]
}
```

## Seguridad

Nunca subas tu `.env` ni tu token a GitHub. El archivo `.gitignore` ya bloquea `.env`.

## Nota

Discord no permite animar un embed como una página web, pero sí puedes usar GIFs, emojis, imágenes, thumbnails y botones para que se vea más premium.
