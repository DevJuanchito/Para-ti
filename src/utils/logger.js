function time() {
  return new Date().toISOString();
}

function info(message, ...extra) {
  console.log(`[${time()}] [INFO] ${message}`, ...extra);
}

function warn(message, ...extra) {
  console.warn(`[${time()}] [WARN] ${message}`, ...extra);
}

function error(message, ...extra) {
  console.error(`[${time()}] [ERROR] ${message}`, ...extra);
}

module.exports = { info, warn, error };
