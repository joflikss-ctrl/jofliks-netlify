/**
 * athlete-token.js — shared helper for athlete links.
 *
 * Tokens are self-contained and signed (no database needed), so they can't
 * vanish when a function restarts. Each token carries its album and an expiry
 * time, and is signed with a secret only the server knows.
 *
 * Required Netlify environment variable:
 *   ATHLETE_PASSWORD  — owner password for generating links / the importer
 * Optional:
 *   TOKEN_SECRET      — signing key (defaults to ATHLETE_PASSWORD)
 */

const crypto = require('crypto');

const LINK_LIFETIME_MS = 48 * 60 * 60 * 1000; // 48 hours

function getPassword() {
  return process.env.ATHLETE_PASSWORD || '';
}

function getSecret() {
  return process.env.TOKEN_SECRET || process.env.ATHLETE_PASSWORD || '';
}

function isConfigured() {
  return Boolean(getPassword() && getSecret());
}

function b64url(str) {
  return Buffer.from(str, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('hex').slice(0, 32);
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function checkPassword(password) {
  const real = getPassword();
  return Boolean(real) && typeof password === 'string' && safeEqual(password, real);
}

function createToken(albumId, albumLabel) {
  const expiresAt = Date.now() + LINK_LIFETIME_MS;
  const payload = b64url(JSON.stringify({ a: albumId, l: albumLabel, e: expiresAt }));
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

/**
 * Returns { valid: true, albumId, albumLabel, expiresAt }
 *      or { valid: false, reason }
 */
function verifyToken(token, albumId) {
  if (!isConfigured()) return { valid: false, reason: 'Athlete links are not set up yet.' };
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'This link is invalid.' };
  }
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) {
    return { valid: false, reason: 'This link is invalid.' };
  }
  let data;
  try { data = JSON.parse(fromB64url(payload)); }
  catch { return { valid: false, reason: 'This link is invalid.' }; }

  if (albumId && data.a !== albumId) return { valid: false, reason: 'This link is for a different album.' };
  if (!data.e || Date.now() > data.e) {
    return { valid: false, reason: 'This link has expired. Ask JoFliks for a new one.' };
  }
  return { valid: true, albumId: data.a, albumLabel: data.l, expiresAt: data.e };
}

module.exports = { LINK_LIFETIME_MS, isConfigured, checkPassword, createToken, verifyToken };
