function normalizeHexColor(input, fallback = '#ff77dd') {
  if (!input) return fallback;
  const value = input.trim();
  const normalized = value.startsWith('#') ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
}

function isValidUrl(input) {
  if (!input) return true;
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { normalizeHexColor, isValidUrl };
