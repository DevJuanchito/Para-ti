import 'dotenv/config';

const API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = process.env.ROBLOX_DATASTORE_NAME || 'LiveCodesV1';
const INDEX_KEY = process.env.ROBLOX_INDEX_KEY || 'CODE_INDEX';
const CODE_PREFIX = process.env.ROBLOX_CODE_PREFIX || 'CODE_';

if (!API_KEY) throw new Error('ROBLOX_API_KEY is missing in .env');
if (!UNIVERSE_ID) throw new Error('ROBLOX_UNIVERSE_ID is missing in .env');

const BASE_URL = `https://apis.roblox.com/cloud/v2/universes/${encodeURIComponent(UNIVERSE_ID)}/data-stores/${encodeURIComponent(DATASTORE_NAME)}/entries`;

function normalizeCode(rawCode) {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

function codeEntryId(code) {
  return `${CODE_PREFIX}${normalizeCode(code)}`;
}

function defaultIndex() {
  return { Codes: [] };
}

function normalizeIndex(value) {
  const data = value && typeof value === 'object' ? value : defaultIndex();
  if (!Array.isArray(data.Codes)) data.Codes = [];
  data.Codes = [...new Set(data.Codes.map(normalizeCode).filter(Boolean))].sort();
  return data;
}

function normalizeCodeEntry(value, code) {
  const now = Math.floor(Date.now() / 1000);
  const normalized = normalizeCode(code || value?.Code);
  const data = value && typeof value === 'object' ? value : {};
  return {
    Code: normalized,
    RewardType: data.RewardType === 'Gems' ? 'Gems' : 'Cash',
    Amount: Number(data.Amount) || 0,
    MaxUses: Number(data.MaxUses) || 1,
    CurrentUses: Number(data.CurrentUses) || 0,
    Active: data.Active !== false,
    CreatedBy: data.CreatedBy || 'DiscordBot',
    CreatedAt: Number(data.CreatedAt) || now,
    UpdatedAt: now,
    ExpiresAt: Number(data.ExpiresAt) || 0,
    RedeemedUsers: data.RedeemedUsers && typeof data.RedeemedUsers === 'object' ? data.RedeemedUsers : {},
  };
}

async function robloxRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = text; }
  }

  return { response, body: json, raw: text };
}

export async function getEntry(entryId, fallbackValue = null) {
  const url = `${BASE_URL}/${encodeURIComponent(entryId)}`;
  const { response, body, raw } = await robloxRequest(url, { method: 'GET' });

  if (response.status === 404) return fallbackValue;
  if (!response.ok) {
    throw new Error(`Roblox GET ${entryId} failed: ${response.status} ${raw}`);
  }

  // Open Cloud v2 returns an object with a value property for data store entries.
  if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'value')) {
    return body.value;
  }
  return body ?? fallbackValue;
}

async function createEntry(entryId, value) {
  const url = `${BASE_URL}?id=${encodeURIComponent(entryId)}`;
  const payload = { value };
  const { response, raw } = await robloxRequest(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Roblox CREATE ${entryId} failed: ${response.status} ${raw}`);
  }

  if (response.status === 409) {
    return updateEntry(entryId, value, false);
  }
  return true;
}

export async function updateEntry(entryId, value, createIfMissing = true) {
  const url = `${BASE_URL}/${encodeURIComponent(entryId)}`;
  const payload = { value };
  const { response, raw } = await robloxRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (response.status === 404 && createIfMissing) {
    return createEntry(entryId, value);
  }

  if (!response.ok) {
    throw new Error(`Roblox PATCH ${entryId} failed: ${response.status} ${raw}`);
  }
  return true;
}

export async function getIndex() {
  return normalizeIndex(await getEntry(INDEX_KEY, defaultIndex()));
}

export async function saveIndex(index) {
  return updateEntry(INDEX_KEY, normalizeIndex(index), true);
}

export async function addCodeToIndex(code) {
  const normalized = normalizeCode(code);
  const index = await getIndex();
  if (!index.Codes.includes(normalized)) index.Codes.push(normalized);
  index.Codes.sort();
  await saveIndex(index);
  return index;
}

export async function removeCodeFromIndex(code) {
  const normalized = normalizeCode(code);
  const index = await getIndex();
  index.Codes = index.Codes.filter((c) => c !== normalized);
  await saveIndex(index);
  return index;
}

export async function getCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const data = await getEntry(codeEntryId(normalized), null);
  return data ? normalizeCodeEntry(data, normalized) : null;
}

export async function saveCode(codeData) {
  const normalized = normalizeCode(codeData.Code);
  if (!normalized) throw new Error('Invalid code name.');
  const data = normalizeCodeEntry(codeData, normalized);
  await updateEntry(codeEntryId(normalized), data, true);
  await addCodeToIndex(normalized);
  return data;
}

export async function deleteCode(code) {
  // Open Cloud v2 delete can be added if desired. For safety, we soft-delete/disable and remove from index.
  const normalized = normalizeCode(code);
  const existing = await getCode(normalized);
  if (existing) {
    existing.Active = false;
    existing.Deleted = true;
    existing.UpdatedAt = Math.floor(Date.now() / 1000);
    await updateEntry(codeEntryId(normalized), existing, true);
  }
  await removeCodeFromIndex(normalized);
  return existing;
}

export async function listCodes({ includeDisabled = false } = {}) {
  const index = await getIndex();
  const codes = [];
  for (const code of index.Codes) {
    const entry = await getCode(code);
    if (!entry) continue;
    if (!includeDisabled && !entry.Active) continue;
    codes.push(entry);
  }
  codes.sort((a, b) => a.Code.localeCompare(b.Code));
  return codes;
}

export { normalizeCode, codeEntryId, INDEX_KEY, CODE_PREFIX, DATASTORE_NAME };
