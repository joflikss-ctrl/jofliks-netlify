const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyToken, checkPassword } = require('../lib/athlete-token');

// Only photos hosted in the JoFliks Cloudinary account can be sold.
const CLOUD_BASE = 'https://res.cloudinary.com/dxthbasef/image/upload/';

// Athlete bundle tiers. The server picks the price from the photo count,
// so the browser can't choose a cheaper tier than it qualifies for.
const ATHLETE_TIERS = [
  { label: '1 photo',      min: 1,  max: 1,  amount: 500  }, // $5
  { label: '2 photos',     min: 2,  max: 2,  amount: 700  }, // $7
  { label: '3-4 photos',   min: 3,  max: 4,  amount: 1000 }, // $10
  { label: '5-10 photos',  min: 5,  max: 10, amount: 1500 }, // $15
  { label: '10-20 photos', min: 11, max: 20, amount: 3000 }, // $30 (10 is covered by the $15 tier)
];
const MAX_ATHLETE_PHOTOS = 20;
const STANDARD_PRICE = 1500; // $15 per photo in the regular gallery

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Stripe limits each metadata value to 500 characters, so long lists of
// photos are split across several keys (photos_0, photos_1, ...).
function chunkPhotoIds(urls) {
  const ids = urls.map(u => u.slice(CLOUD_BASE.length));
  const chunks = [];
  let current = '';
  for (const id of ids) {
    const next = current ? `${current}|${id}` : id;
    if (next.length > 490) { chunks.push(current); current = id; }
    else current = next;
  }
  if (current) chunks.push(current);
  const meta = {};
  chunks.forEach((c, i) => { meta[`photos_${i}`] = c; });
  meta.photos_chunks = String(chunks.length);
  return meta;
}

const clip = (s, n = 490) => String(s || '').slice(0, n);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { photoUrl, photoName, albumName, sport, isAthlete, token, albumId } = body;

    // Owner-only $0 test purchase: only works with the owner password.
    const isTest = Boolean(body.ownerTestPassword);
    if (isTest && !checkPassword(body.ownerTestPassword)) {
      return json(401, { error: 'Incorrect owner password.' });
    }

    let unitAmount, bundle, urls, productName, description, cancelUrl;
    const site = process.env.URL || 'https://jofliks.com';

    if (isAthlete) {
      // ── Athlete purchase: requires a valid, unexpired athlete link ─────────
      const check = verifyToken(token, albumId);
      if (!check.valid) return json(403, { error: check.reason });

      urls = Array.isArray(body.photoUrls) ? [...new Set(body.photoUrls)] : [];
      if (!urls.length) return json(400, { error: 'No photos selected' });
      if (urls.length > MAX_ATHLETE_PHOTOS) {
        return json(400, { error: `You can buy up to ${MAX_ATHLETE_PHOTOS} photos per checkout.` });
      }
      if (!urls.every(u => typeof u === 'string' && u.startsWith(CLOUD_BASE))) {
        return json(400, { error: 'Invalid photo' });
      }

      const tier = ATHLETE_TIERS.find(t => urls.length >= t.min && urls.length <= t.max);
      unitAmount = tier.amount;
      bundle = tier.label;

      const count = urls.length;
      productName = count > 1
        ? `JoFliks Photography — ${count} Photos (${bundle})`
        : `JoFliks Photography — ${clip(photoName, 200)}`;
      description = `${count} photo${count > 1 ? 's' : ''} from ${clip(check.albumLabel, 200)}. High-res files delivered to your email right after purchase.`;
      cancelUrl = `${site}/athlete.html?token=${encodeURIComponent(token)}&album=${encodeURIComponent(albumId)}`;
    } else {
      // ── Standard gallery purchase: one photo, $15 ─────────────────────────
      if (!photoUrl || !photoName) return json(400, { error: 'Missing photo info' });
      if (!photoUrl.startsWith(CLOUD_BASE)) return json(400, { error: 'Invalid photo' });
      urls = [photoUrl];
      unitAmount = STANDARD_PRICE;
      bundle = 'single';
      productName = `JoFliks Photography — ${clip(photoName, 200)}`;
      description = `${sport || 'Sports'} photo from ${clip(albumName, 200)}. High-resolution file delivered to your email right after purchase.`;
      cancelUrl = `${site}/gallery.html`;
    }

    if (isTest) {
      unitAmount = 0;
      productName = `[TEST] ${productName}`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: productName, description, images: [urls[0]] },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${site}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        photoUrl: urls[0],
        photoName: clip(isAthlete && urls.length > 1 ? `${urls.length} photos` : photoName),
        albumName: clip(albumName),
        sport: clip(sport),
        bundle,
        cartCount: String(urls.length),
        isAthlete: isAthlete ? 'true' : 'false',
        test: isTest ? 'true' : 'false',
        ...chunkPhotoIds(urls),
      },
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return json(500, { error: err.message });
  }
};
