# ✨ Discord Premium Welcome Bot

Bot de Discord en **Node.js + discord.js v14** para configurar:

- 🌸 Bienvenidas con embeds bonitos.
- 🌙 Despedidas configurables.
- 📢 Anuncios con embeds, rol mencionado y botón opcional.
- 🎨 Embeds personalizados para mensajes importantes.
- 💾 Configuración guardada en MongoDB para Railway.
- 🚀 Health server incluido para despliegue en Railway.

---

## 📁 Estructura

```txt
.
├─ package.json
├─ railway.json
├─ .env.example
├─ .gitignore
├─ README.md
└─ src/
   ├─ index.js
   ├─ deploy-commands.js
   ├─ commands/
   │  ├─ ayuda.js
   │  ├─ anuncio.js
   │  ├─ embed.js
   │  ├─ config-bienvenida.js
   │  ├─ config-despedida.js
   │  ├─ config-ver.js
   │  └─ config-reset.js
   ├─ lib/
   │  ├─ configHelpers.js
   │  ├─ database.js
   │  ├─ embedFactory.js
   │  ├─ placeholders.js
   │  ├─ registerCommands.js
   │  └─ validators.js
   └─ models/
      └─ GuildConfig.js
```

---

## 🔐 Variables de entorno

Copia `.env.example` como `.env` para desarrollo local.

```env
DISCORD_TOKEN=pon_tu_token_aqui
CLIENT_ID=id_de_tu_aplicacion
MONGO_URL=mongodb://usuario:password@host:puerto/database
GUILD_ID=id_de_tu_servidor
AUTO_DEPLOY_COMMANDS=false
PORT=3000
```

**No subas `.env` a GitHub.** Tu token es como una contraseña.

---

## 🤖 Crear el bot en Discord

1. Entra al Discord Developer Portal.
2. Crea una aplicación.
3. Ve a **Bot** y crea el bot.
4. Copia el token y úsalo como `DISCORD_TOKEN`.
5. Copia el **Application ID** y úsalo como `CLIENT_ID`.
6. En la pestaña **Bot**, activa **Server Members Intent** para que funcionen bienvenidas/despedidas.
7. Invita el bot con scopes:
   - `bot`
   - `applications.commands`
8. Permisos recomendados:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Use External Emojis

---

## 🧪 Ejecutar localmente

```bash
npm install
npm run deploy-commands
npm start
```

Para pruebas rápidas, pon `GUILD_ID` en `.env`. Los comandos de servidor aparecen mucho más rápido que los globales.

---

## 🚀 Subir a GitHub

```bash
git init
git add .
git commit -m "Initial Discord premium bot"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

---

## 🚂 Deploy en Railway

1. Crea un proyecto en Railway.
2. Selecciona **Deploy from GitHub repo**.
3. Elige tu repositorio.
4. Agrega una base de datos **MongoDB** en el mismo proyecto.
5. En el servicio del bot, abre **Variables** y agrega:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `MONGO_URL`
   - `AUTO_DEPLOY_COMMANDS=true` para registrar comandos al iniciar
   - `GUILD_ID` opcional para pruebas en un servidor concreto
6. Deploy.

Railway asigna `PORT` automáticamente, así que no tienes que crear esa variable en producción.

---

## 💬 Comandos

### `/config-bienvenida`

Configura el canal, título, descripción, color, imagen/GIF, thumbnail, footer y prueba.

Ejemplo de descripción:

```txt
꒰ঌ Hola {user} ໒꒱

✨ Bienvenid@ a **{server}**.
💫 Ahora somos **{memberCount}** miembros.
```

### `/config-despedida`

Configura el mensaje cuando alguien sale del servidor.

### `/anuncio`

Envía un anuncio premium con:

- Canal
- Mensaje
- Título
- Color
- Imagen o GIF
- Rol mencionado
- Botón con URL

### `/embed`

Crea un embed personalizado para reglas, información, eventos o mensajes decorativos.

### `/config-ver`

Muestra la configuración actual.

### `/config-reset`

Reinicia bienvenida, despedida o todo.

### `/ayuda`

Muestra una guía rápida dentro del servidor.

---

## 🪄 Placeholders disponibles

Puedes usarlos en títulos, descripciones y footers de bienvenida/despedida:

```txt
{user}
{user.mention}
{user.id}
{user.username}
{user.tag}
{server}
{server.id}
{memberCount}
{createdAt}
{joinedAt}
```

---

## 🎨 Ideas para que se vea más premium

- Usa GIFs en `imagen`.
- Usa colores como `#ff77dd`, `#b388ff`, `#00d4ff`, `#ffd166`.
- Usa emojis animados de tu servidor en los textos.
- Crea canales separados: `🌸・bienvenidas`, `🌙・despedidas`, `📢・anuncios`.
- Usa botones en anuncios para reglas, tienda, redes o formularios.

---

## 🧯 Problemas comunes

### No llegan bienvenidas o despedidas

Activa **Server Members Intent** en el Developer Portal y reinicia el bot.

### Los comandos no aparecen

Ejecuta:

```bash
npm run deploy-commands
```

O en Railway pon:

```env
AUTO_DEPLOY_COMMANDS=true
```

Para pruebas rápidas usa `GUILD_ID`.

### Railway reinicia y pierdo configuración

Este proyecto usa MongoDB. Asegúrate de tener `MONGO_URL` correcto en Railway.

---

## 📜 Licencia

MIT
