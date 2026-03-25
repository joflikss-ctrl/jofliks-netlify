const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { photoUrl, photoName, albumName, sport } = JSON.parse(event.body);

    if (!photoUrl || !photoName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing photo info' }) };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `JoFliks Photography — ${photoName}`,
            description: `${sport} photo from ${albumName}. High-resolution file delivered to your email instantly after purchase.`,
            images: [photoUrl],
          },
          unit_amount: 1500,
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
        sport,
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
