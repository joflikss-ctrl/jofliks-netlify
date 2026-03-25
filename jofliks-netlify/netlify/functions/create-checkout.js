const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { photoUrl, photoName, albumName, packageType, price, quantity } = JSON.parse(event.body);

    // Package details
    const packages = {
      single: { name: '1 Photo', price: 1500, quantity: 1 },
      four:   { name: '4 Photos', price: 5000, quantity: 4 },
      eight:  { name: '8 Photos', price: 6500, quantity: 8 },
      full:   { name: 'Full Album', price: 9000, quantity: 0 }
    };

    const pkg = packages[packageType];
    if (!pkg) return { statusCode: 400, body: 'Invalid package' };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `JoFliks Photography — ${pkg.name}`,
            description: packageType === 'full'
              ? `Full album download: ${albumName}`
              : `${pkg.name} from ${albumName} — You will receive an email with download instructions after purchase.`,
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/gallery.html`,
      metadata: {
        albumName,
        packageType,
        photoName: photoName || '',
        quantity: pkg.quantity.toString()
      },
      customer_email: null,
      billing_address_collection: 'auto',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
