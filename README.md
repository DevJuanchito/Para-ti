# Juan Music Bot

Bot de musica para Discord hecho en JavaScript con comandos slash.

## Archivos incluidos

- `package.json`: dependencias y comandos de Node.js.
- `config.example.json`: ejemplo de configuracion. No pongas tu token real en GitHub.
- `config.js`: carga variables desde el hosting o desde `config.json` local.
- `deploy-commands.js`: registra los comandos slash en tu servidor.
- `index.js`: inicia el bot.
- `commands.js`: contiene los comandos de musica.
- `INSTRUCCIONES.txt`: pasos rapidos.
- `SEGURIDAD_TOKEN.txt`: aviso para proteger tu token.
- `gitignore.txt`: contenido recomendado para crear tu `.gitignore`.

## Requisitos

- Node.js 20 o superior.
- Un bot creado en Discord Developer Portal.
- Permisos del bot: View Channels, Send Messages, Use Slash Commands, Connect y Speak.

## Como usarlo en tu PC

1. Descomprime la carpeta.
2. Abre la terminal dentro de la carpeta.
3. Instala dependencias:

```bash
npm install
```

4. Copia `config.example.json` y renombralo a `config.json`.
5. En `config.json`, pega tu token, application/client ID y server/guild ID.
6. Registra los comandos slash:

```bash
npm run deploy
```

7. Prende el bot:

```bash
npm start
```

## Comandos

- `/play cancion:<link o nombre>`
- `/skip`
- `/pause`
- `/resume`
- `/stop`
- `/queue`
- `/nowplaying`

## Importante

No subas `config.json` con tu token real a GitHub. Sube solo `config.example.json`.
Para protegerte, crea un archivo `.gitignore` usando el contenido de `gitignore.txt`.
