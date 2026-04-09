const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { photoUrl, photoName, albumName, sport, price, bundle, cartCount, photoUrls, isAthlete } = JSON.parse(event.body);

    if (!photoUrl || !photoName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing photo info' }) };
    }

    // ── PRICE LOGIC ────────────────────────────────────────────────────────
    // For athlete purchases: use the price sent from the cart (already in cents)
    // For regular purchases: use $15 per photo (default)
    // Never trust the frontend blindly for regular purchases — validate athlete flag server-side
    // via the presence of a valid bundle label.

    let unitAmount;

    if (isAthlete && price && bundle) {
      // Athlete bundle pricing — validate it's a known tier
      const VALID_ATHLETE_PRICES = {
        '1 photo':      500,   // $5
        '2 photos':     700,   // $7
        '3 photos':     1000,  // $10
        '5-10 photos':  1500,  // $15
        '10-20 photos': 3000,  // $30
      };
      unitAmount = VALID_ATHLETE_PRICES[bundle];
      if (!unitAmount) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid bundle selected' }) };
      }
    } else {
      // Standard gallery purchase — $15 per photo
      unitAmount = 1500;
    }

    // ── BUILD PRODUCT DESCRIPTION ──────────────────────────────────────────
    let productName, description;

    if (isAthlete && cartCount > 1) {
      productName = `JoFliks Photography — ${cartCount} Photos (${bundle})`;
      description = `${cartCount} ${sport || 'sports'} photos from ${albumName}. High-res files delivered to your email instantly after purchase. Watermarks removed.`;
    } else {
      productName = `JoFliks Photography — ${photoName}`;
      description = `${sport || 'Sports'} photo from ${albumName}. High-resolution file delivered to your email instantly after purchase.`;
    }

    // ── CREATE STRIPE SESSION ──────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description,
            images: [photoUrl],
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/gallery.html`,
      metadata: {
        photoUrl,
        photoName,
        albumName,
        sport: sport || '',
        bundle: bundle || 'single',
        cartCount: cartCount ? String(cartCount) : '1',
        isAthlete: isAthlete ? 'true' : 'false',
        // Store all photo URLs if it's a multi-photo athlete purchase
        photoUrls: photoUrls ? JSON.stringify(photoUrls.slice(0, 20)) : JSON.stringify([photoUrl]),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Checkout error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
