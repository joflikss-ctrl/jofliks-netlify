/**
 * generate-athlete-token.js
 * Generates permanent JoFliks VIP links.
 *
 * Tokens are HMAC-signed so they are self-verifying —
 * no database or Netlify Blobs needed. Links never expire.
 *
 * POST /.netlify/functions/generate-athlete-token
 *   body: { albumId, albumLabel, password }
 *   returns: { url, token, albumId, albumLabel }
 *
 * GET /.netlify/functions/generate-athlete-token/verify
 *   ?token=xxx&album=xxx
 *   returns: { valid, albumId, albumLabel }
 */

const crypto = require('crypto');

const OWNER_PASSWORD = process.env.ATHLETE_PASSWORD || 'CCypress7!';
const TOKEN_SECRET   = process.env.TOKEN_SECRET     || 'jofliks-vip-secret-2025';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Create a signed token encoding the albumId
function createToken(albumId) {
  const payload = Buffer.from(albumId).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return `${payload}.${sig}`;
}

// Verify and decode a token — returns albumId or null
function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  if (sig !== expected) return null;
  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Strip function name from path to get the sub-route
  const subpath = (event.path || '')
    .replace('/.netlify/functions/generate-athlete-token', '')
    .replace(/\/$/, '');

  // ── POST / — Generate a VIP link ─────────────────────────────────────────
  if (event.httpMethod === 'POST' && (subpath === '' || subpath === '/')) {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { albumId, albumLabel, password } = body;

    if (!albumId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'albumId required' }) };
    }
    if (password !== OWNER_PASSWORD) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    const token   = createToken(albumId);
    const siteUrl = process.env.URL || 'https://jofliks.com';
    const url     = `${siteUrl}/athlete.html?token=${token}&album=${encodeURIComponent(albumId)}`;

    console.log(`VIP link generated for album: ${albumId}`);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        token,
        url,
        albumId,
        albumLabel: albumLabel || albumId,
        expiresIn: 'never',
      }),
    };
  }

  // ── GET /verify — Validate a VIP token ───────────────────────────────────
  if (event.httpMethod === 'GET' && subpath === '/verify') {
    const params = event.queryStringParameters || {};
    const { token, album } = params;

    if (!token || !album) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ valid: false, reason: 'Missing token or album' }),
      };
    }

    const decodedAlbumId = verifyToken(token);

    if (!decodedAlbumId) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ valid: false, reason: 'Invalid token signature' }),
      };
    }

    if (decodedAlbumId !== album) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ valid: false, reason: 'Token does not match album' }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        valid: true,
        albumId: decodedAlbumId,
        expiresAt: null,
      }),
    };
  }

  // Unknown route
  return {
    statusCode: 404,
    headers: CORS,
    body: JSON.stringify({ error: 'Not found' }),
  };
};
