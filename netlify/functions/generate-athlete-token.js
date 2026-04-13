/**
 * generate-vip-token.js
 * Generates secure VIP links that NEVER expire.
 * Uses Netlify Blobs for persistent storage — tokens survive deploys and restarts.
 *
 * POST / — generate token  { albumId, albumLabel, password }
 * GET  /verify — verify token  ?token=xxx&album=xxx
 */

const crypto = require('crypto');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const OWNER_PASSWORD = process.env.ATHLETE_PASSWORD || 'CCypress7!';
const TOKEN_SECRET   = process.env.TOKEN_SECRET     || 'jofliks-secret-change-in-prod';

// ─── STORAGE: Netlify Blobs ───────────────────────────────────────────────────
// Netlify Blobs persists across cold starts and deploys — tokens last forever.
let blobStore;
async function getStore() {
  if (blobStore) return blobStore;
  try {
    const { getStore } = await import('@netlify/blobs');
    blobStore = getStore('vip-tokens');
    return blobStore;
  } catch {
    // Fallback to in-memory if Blobs not available (local dev)
    console.warn('Netlify Blobs unavailable — using in-memory store (local dev only)');
    return null;
  }
}

// In-memory fallback for local development
const memStore = {};

async function saveToken(token, data) {
  const store = await getStore();
  if (store) {
    await store.setJSON(token, data);
  } else {
    memStore[token] = data;
  }
}

async function loadToken(token) {
  const store = await getStore();
  if (store) {
    return await store.get(token, { type: 'json' });
  }
  return memStore[token] || null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function createToken(albumId) {
  const random = crypto.randomBytes(24).toString('hex');
  const hmac   = crypto.createHmac('sha256', TOKEN_SECRET)
                       .update(`${random}:${albumId}`)
                       .digest('hex')
                       .slice(0, 16);
  return `${random}.${hmac}`;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ─── HANDLER ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/generate-vip-token', '');

  // ── POST / — Generate token ──────────────────────────────────────────────
  if (event.httpMethod === 'POST' && (path === '' || path === '/')) {
    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { albumId, albumLabel, password } = body;

    if (!albumId || !albumLabel) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'albumId and albumLabel required' }) };
    }
    if (password !== OWNER_PASSWORD) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    const token    = createToken(albumId);
    const siteUrl  = process.env.URL || 'https://jofliks.com';
    const url      = `${siteUrl}/athlete.html?token=${token}&album=${encodeURIComponent(albumId)}`;
    const tokenData = {
      albumId,
      albumLabel,
      uses: 0,
      createdAt: Date.now(),
      expiresAt: null, // null = never expires
    };

    await saveToken(token, tokenData);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ token, url, albumId, albumLabel, expiresIn: 'never — permanent' }),
    };
  }

  // ── GET /verify — Validate token ─────────────────────────────────────────
  if (event.httpMethod === 'GET' && path === '/verify') {
    const { token, album } = event.queryStringParameters || {};
    if (!token || !album) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ valid: false, reason: 'Missing token or album' }) };
    }

    const entry = await loadToken(token);

    if (!entry) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, reason: 'Token not found' }) };
    }
    if (entry.albumId !== album) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, reason: 'Album mismatch' }) };
    }
    // No expiry check — tokens last forever

    // Increment use counter
    entry.uses = (entry.uses || 0) + 1;
    await saveToken(token, entry);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        valid: true,
        albumId:    entry.albumId,
        albumLabel: entry.albumLabel,
        uses:       entry.uses,
        expiresAt:  null,
      }),
    };
  }

  return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
};
