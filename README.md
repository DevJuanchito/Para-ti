# ✨ Embed Studio Bot GUI

Bot de Discord dedicado a crear, previsualizar, enviar y editar **embeds bonitos** con una interfaz rápida dentro de Discord.

Hecho para subir a **GitHub** y desplegar en **Railway**.

## Características

- `/embed panel` — abre un editor visual privado con botones, menú de plantillas y formularios.
- Selector de plantillas: anuncios, reglas, updates, eventos, sorteos, staff, tienda, mantenimiento, premium y neon.
- Botón **Texto** para editar título, descripción, contenido, footer y autor.
- Botón **Visual** para editar color, imagen/GIF, thumbnail, URL del título y timestamp.
- Botón **Botón** para agregar un botón con enlace.
- Botón **JSON/ENV** para pegar un embed completo rápidamente.
- `/embed importar` — envía un embed pegando JSON o formato ENV.
- `/embed crear` — crear embed por opciones slash.
- `/embed plantilla` — usar plantillas decoradas por comando.
- `/embed editar` — editar embeds que el bot ya envió.
- `/embed json` — pegar JSON avanzado.
- `/embed ayuda` — guía dentro de Discord.
- No usa MongoDB, base de datos ni archivos de guardado.
- Funciona en el canal actual si no eliges canal.

## Requisitos

- Node.js 20 o superior.
- Una aplicación de Discord con bot creado.
- Permisos recomendados del bot en el servidor:
  - `View Channels`
  - `Send Messages`
  - `Embed Links`
  - `Attach Files`
  - `Read Message History`
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

No necesitas MongoDB ni volumen porque este bot no guarda configuraciones permanentes.

## Uso rápido

### Editor visual

```text
/embed panel
```

Eso abre una interfaz privada con:

- Menú de plantillas.
- Botón `Texto`.
- Botón `Visual`.
- Botón `Botón`.
- Botón `JSON/ENV`.
- Botón `Enviar`.

### Formato ENV rápido

Puedes pegar esto en el botón `JSON/ENV` o usar `/embed importar`:

```env
TITLE=📢・ANUNCIO OFICIAL
DESCRIPTION=✨ Tenemos novedades para {server}\n\n> Gracias por estar aquí.
COLOR=premium
IMAGE=https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif
THUMBNAIL=https://i.imgur.com/AfFp7pu.png
FOOTER={server} • Anuncios
CONTENT=@everyone
BUTTON_TEXT=Ver más
BUTTON_URL=https://discord.com
TIMESTAMP=true
```

### JSON rápido

```json
{
  "content": "@everyone",
  "embeds": [
    {
      "title": "📢・ANUNCIO OFICIAL",
      "description": "✨ Tenemos novedades para {server}",
      "color": "premium",
      "image": { "url": "https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif" },
      "footer": { "text": "{server} • Anuncios" }
    }
  ],
  "button": {
    "label": "Ver más",
    "url": "https://discord.com"
  }
}
```

### Crear por comando

```text
/embed crear titulo:📢 Anuncio descripcion:Hoy hay novedades color:premium
```

### Plantillas bonitas

```text
/embed plantilla tipo:💎 Premium mensaje:Nuevo evento hoy a las 7PM
```

### Editar un embed

Activa el modo desarrollador en Discord, copia el ID del mensaje y usa:

```text
/embed editar mensaje_id:123456789 titulo:Nuevo título descripcion:Nueva descripción
```

## Notas

- La interfaz usa mensajes privados/efímeros, así que solo tú ves la previsualización mientras editas.
- Las imágenes y GIFs deben ser URLs `http://` o `https://`.
- Los embeds tienen límite total combinado de 6000 caracteres.
- Las variables `.env` reales son para configurar el bot. El formato ENV del editor es solo para crear embeds rápido.
