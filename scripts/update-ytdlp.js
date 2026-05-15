const { spawnSync } = require('node:child_process');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');

try {
  console.log('[JUANPLAY] Revisando actualización de yt-dlp...');
  const result = spawnSync(bin, ['-U'], { stdio: 'inherit', timeout: 120000 });
  if (result.error) console.warn('[JUANPLAY] No se pudo actualizar yt-dlp:', result.error.message);
  if (typeof result.status === 'number' && result.status !== 0) console.warn('[JUANPLAY] yt-dlp -U terminó con código', result.status, '(no es fatal).');
} catch (error) {
  console.warn('[JUANPLAY] Actualización de yt-dlp omitida:', error.message);
}

process.exit(0);
