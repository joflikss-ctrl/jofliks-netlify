/**
 * generate-athlete-token.js
 * Netlify serverless function — generates a secure, time-limited athlete token
 * 
 * POST /api/generate-athlete-token
 * Body: { albumId, albumLabel, password }
 * Returns: { token, url, expiresAt }
 */

const crypto = require('crypto');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const OWNER_PASSWORD  = process.env.ATHLETE_PASSWORD || 'CCypress7!';
const TOKEN_SECRET    = process.env.TOKEN_SECRET      || 'jofliks-secret-key-change-in-prod';
const TOKEN_TTL_HOURS = 72; // links expire after 72 hours

// In-memory store for tokens (resets on cold start).
// For production persistence, swap this with a KV store (e.g. Netlify Blobs,
// Upstash Redis, or Fauna DB). Structure: { token -> { albumId, albumLabel, uses, expiresAt } }
const tokenStore = {};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random token string.
 * Format: <random-hex>.<hmac-signature>
 * The HMAC ties the token to the albumId so it can't be reused for other albums.
 */
function createToken(albumId) {
  const random   = crypto.randomBytes(24).toString('hex');
  const hmac     = crypto.createHmac('sha256', TOKEN_SECRET)
                         .update(`${random}:${albumId}`)
                         .digest('hex')
                         .slice(0, 16);
  return `${random}.${hmac}`;
}

/**
 * Verify a token is valid, unexpired, and belongs to the claimed album.
 */
function verifyToken(token, albumId) {
  const entry = tokenStore[token];
  if (!entry) return { valid: false, reason: 'Token not found' };
  if (entry.albumId !== albumId) return { valid: false, reason: 'Album mismatch' };
  if (Date.now() > entry.expiresAt) return { valid: false, reason: 'Token expired' };
  return { valid: true, entry };
}

// ─── CORS HEADERS ────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ─── HANDLER ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/generate-athlete-token', '');

  // ── POST / — Generate a new token ──────────────────────────────────────────
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

    const token      = createToken(albumId);
    const expiresAt  = Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000;
    const siteUrl    = process.env.URL || 'https://jofliks.com';
    const url        = `${siteUrl}/athlete.html?token=${token}&album=${encodeURIComponent(albumId)}`;

    tokenStore[token] = { albumId, albumLabel, uses: 0, expiresAt, createdAt: Date.now() };

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        token,
        url,
        albumId,
        albumLabel,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresIn: `${TOKEN_TTL_HOURS} hours`,
      }),
    };
  }

  // ── GET /verify — Validate a token (called by athlete.html on load) ─────────
  if (event.httpMethod === 'GET' && path === '/verify') {
    const { token, album } = event.queryStringParameters || {};
    if (!token || !album) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ valid: false, reason: 'Missing token or album' }) };
    }

    const result = verifyToken(token, album);
    if (result.valid) {
      // Increment use counter
      tokenStore[token].uses += 1;
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          valid: true,
          albumId:    result.entry.albumId,
          albumLabel: result.entry.albumLabel,
          uses:       result.entry.uses,
          expiresAt:  new Date(result.entry.expiresAt).toISOString(),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ valid: false, reason: result.reason }),
    };
  }

  return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
};
