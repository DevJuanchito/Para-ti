# Roblox Live Codes Discord Bot

Este bot crea códigos canjeables para Roblox usando slash commands de Discord y Roblox Open Cloud DataStores.

## Comandos

- `/code-create code:UPDATE1 reward:Cash amount:500 maxuses:100`
- `/code-create code:FREEGEMS reward:Gems amount:50 maxuses:500 expires_days:7`
- `/code-list`
- `/code-info code:UPDATE1`
- `/code-disable code:UPDATE1`
- `/code-delete code:UPDATE1`

## Instalación

1. Instala Node.js 22.12 o más nuevo.
2. Copia `.env.example` como `.env`.
3. Llena `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `ROBLOX_API_KEY` y `ROBLOX_UNIVERSE_ID`.
4. En Roblox Open Cloud, tu API key necesita permisos para leer/crear/actualizar entries del DataStore `LiveCodesV1`.
5. Ejecuta:

```bash
npm install
npm run deploy
npm start
```

## Datos que usa Roblox

DataStore: `LiveCodesV1`

Entry index: `CODE_INDEX`

Cada código se guarda en una entry separada:

- `CODE_UPDATE1`
- `CODE_FREEGEMS`

Esto evita mezclar todos los códigos en una sola key y hace más seguro el canje con `UpdateAsync` desde Roblox.
