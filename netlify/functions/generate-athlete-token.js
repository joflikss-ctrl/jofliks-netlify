/**
 * generate-athlete-token.js
 * Creates and checks athlete links. Links last 48 hours.
 *
 * POST /          — generate link   { albumId, albumLabel, password }
 * POST /auth      — check owner password (used by the gallery importer) { password }
 * GET  /verify    — check a link    ?token=xxx&album=xxx
 *
 * Needs the ATHLETE_PASSWORD environment variable set in Netlify.
 */

const { isConfigured, checkPassword, createToken, verifyToken } = require('../lib/athlete-token');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const path = event.path
    .replace('/.netlify/functions/generate-athlete-token', '')
    .replace(/\/$/, '');

  if (!isConfigured()) {
    return reply(500, { valid: false, error: 'ATHLETE_PASSWORD is not set in Netlify environment variables.' });
  }

  // ── POST — generate a link, or just check the password ────────────────────
  if (event.httpMethod === 'POST' && (path === '' || path === '/auth')) {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return reply(400, { error: 'Invalid JSON' }); }

    if (!checkPassword(body.password)) return reply(401, { error: 'Incorrect password' });
    if (path === '/auth') return reply(200, { ok: true });

    const { albumId, albumLabel } = body;
    if (!albumId || !albumLabel) return reply(400, { error: 'albumId and albumLabel required' });

    const { token, expiresAt } = createToken(albumId, albumLabel);
    const siteUrl = process.env.URL || 'https://jofliks.com';
    const url = `${siteUrl}/athlete.html?token=${encodeURIComponent(token)}&album=${encodeURIComponent(albumId)}`;

    return reply(200, { token, url, albumId, albumLabel, expiresAt, expiresIn: '48 hours' });
  }

  // ── GET /verify — check a link ────────────────────────────────────────────
  if (event.httpMethod === 'GET' && path === '/verify') {
    const { token, album } = event.queryStringParameters || {};
    if (!token || !album) return reply(400, { valid: false, reason: 'Missing token or album' });
    return reply(200, verifyToken(token, album));
  }

  return reply(404, { error: 'Not found' });
};
