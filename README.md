# 🎧 JUANPLAY DEVJUANCHO DEFINITIVO v8

Bot de música personalizado para **DEVJUANCHO / JuanStudio**.

## ✅ Novedades v8

- Diseño más bonito en embeds: títulos grandes, separadores, miniaturas y créditos.
- Muestra **quién está usando el comando** y quién pidió cada canción.
- Botones premium: pausar, seguir, saltar, cola y stop.
- Cuando termina una canción y la cola queda vacía, recomienda canciones parecidas.
- Botón **Más similares** para seguir buscando canciones del mismo estilo.
- Nuevo comando `/similares` para recomendar según la canción actual o la última reproducida.
- Nuevo comando `/historial` para ver lo último que sonó.

## 🎵 Comandos

```txt
/play
/juanplay
/buscar
/recomendados
/similares
/historial
/queue
/nowplaying
/skip
/stop
/pause
/resume
/volume
/testvoz
/diagnostico
/plataformas
/creditos
/leave
/ping
```

## 🚀 Variables en Railway

Obligatorias:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
GUILD_ID=ID_DE_TU_SERVIDOR
```

Recomendadas:

```env
VOICE_TIMEOUT_MS=120000
VOICE_SELF_DEAF=true
DEFAULT_VOLUME=85
MAX_PLAYLIST_ITEMS=25
AUTO_RECOMMEND_AFTER_END=true
RECOMMENDATION_COUNT=5
DEFAULT_EMOJI=🐵
BOT_COLOR=#ff2f7d
```

Opcional para YouTube 429:

```env
YOUTUBE_COOKIE=TU_COOKIE_NUEVA_DE_YOUTUBE
```

## 🧪 Orden recomendado de prueba

```txt
/diagnostico
/testvoz
/play Paulo Londra No Puedo
/similares
```

Cuando termine la canción, JUANPLAY enviará recomendadas similares con botones.

---
👑 Créditos: **DEVJUANCHO • JuanStudio • JUANPLAY v8**
