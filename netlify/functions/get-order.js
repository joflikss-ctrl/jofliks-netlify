/**
 * get-order.js
 * Lets the success page show download links right after payment,
 * so buyers get their photos even if the email never arrives.
 *
 * GET /.netlify/functions/get-order?session_id=cs_...
 * Only returns photos for checkouts Stripe confirms as paid.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CLOUD_BASE = 'https://res.cloudinary.com/dxthbasef/image/upload/';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

// Same format create-checkout.js writes: photo IDs split across
// photos_0, photos_1, ... (older orders used a JSON list in photoUrls).
function photoUrlsFromMetadata(meta) {
  const urls = [];
  const chunks = parseInt(meta.photos_chunks || '0');
  if (chunks > 0) {
    for (let i = 0; i < chunks; i++) {
      (meta[`photos_${i}`] || '').split('|').filter(Boolean).forEach(id => urls.push(CLOUD_BASE + id));
    }
  } else if (meta.photoUrls) {
    try { urls.push(...JSON.parse(meta.photoUrls)); } catch {}
  }
  if (!urls.length && meta.photoUrl) urls.push(meta.photoUrl);
  return urls.filter(u => typeof u === 'string' && u.startsWith(CLOUD_BASE));
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const sessionId = (event.queryStringParameters || {}).session_id || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return json(400, { error: 'Invalid order link.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return json(402, { error: 'This order has not been paid yet.' });
    }

    const meta = session.metadata || {};
    const photos = photoUrlsFromMetadata(meta).map(url => ({
      name: url.split('/').pop().replace(/\.[^.]+$/, ''),
      preview: url.replace('/upload/', '/upload/w_600,c_limit,f_auto,q_auto/'),
      download: url.replace('/upload/', '/upload/fl_attachment/'),
    }));

    if (!photos.length) return json(404, { error: 'No photos found for this order.' });

    return json(200, {
      photos,
      albumName: meta.albumName || '',
      email: maskEmail(session.customer_details && session.customer_details.email),
    });
  } catch (err) {
    console.error('get-order error:', err.message);
    return json(404, { error: 'Order not found.' });
  }
};
