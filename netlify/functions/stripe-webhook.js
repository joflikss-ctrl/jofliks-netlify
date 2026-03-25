const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || 'there';
    const { photoUrl, photoName, albumName, sport } = session.metadata;

    // Build a Cloudinary download URL (force download)
    const downloadUrl = photoUrl.replace('/upload/', '/upload/fl_attachment/');

    // Email to buyer with direct download link
    const buyerEmail = {
      to: customerEmail,
      from: { email: 'joflikss@gmail.com', name: 'JoFliks Photography' },
      replyTo: 'joflikss@gmail.com',
      subject: `Your photo from JoFliks Photography — ${photoName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1c1b;background:#fdfcfa;padding:0;">

          <div style="text-align:center;padding:2.5rem 2rem 1.5rem;border-bottom:1px solid #e8e7e2;">
            <div style="font-size:1.6rem;font-weight:400;letter-spacing:0.15em;margin-bottom:0.2rem;">JOFLIKS</div>
            <div style="font-size:0.65rem;letter-spacing:0.3em;color:#737370;text-transform:uppercase;">Photography</div>
          </div>

          <div style="padding:2rem 2.5rem;">
            <h2 style="font-weight:400;font-size:1.3rem;margin-bottom:0.5rem;">Hi ${customerName},</h2>
            <p style="color:#4a4a47;line-height:1.8;margin-bottom:1.5rem;">
              Thank you for your purchase! Your photo is ready to download below.
            </p>

            <div style="text-align:center;margin:2rem 0;">
              <img src="${photoUrl}" alt="${photoName}" style="max-width:100%;max-height:400px;object-fit:cover;border:1px solid #e8e7e2;" />
            </div>

            <div style="background:#f7f5f0;border-left:3px solid #1c1c1b;padding:1.2rem 1.5rem;margin:1.5rem 0;">
              <p style="margin:0 0 0.3rem;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;color:#a8a8a4;">Your photo</p>
              <p style="margin:0;font-weight:600;color:#1c1c1b;">${photoName}</p>
              <p style="margin:0.2rem 0 0;font-size:0.85rem;color:#737370;">${sport} — ${albumName}</p>
            </div>

            <div style="text-align:center;margin:2rem 0;">
              <a href="${downloadUrl}"
                 style="display:inline-block;padding:0.9rem 2.5rem;background:#1c1c1b;color:white;text-decoration:none;font-size:0.78rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;">
                Download Your Photo
              </a>
            </div>

            <p style="font-size:0.8rem;color:#a8a8a4;text-align:center;margin-top:0.5rem;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${downloadUrl}" style="color:#737370;word-break:break-all;">${downloadUrl}</a>
            </p>

            <p style="font-size:0.82rem;color:#737370;line-height:1.8;margin-top:2rem;border-top:1px solid #e8e7e2;padding-top:1.2rem;">
              Questions or issues? Reply to this email or contact us at
              <a href="mailto:joflikss@gmail.com" style="color:#1c1c1b;">joflikss@gmail.com</a><br/>
              Follow us on Instagram: <a href="https://www.instagram.com/jo.flikss_/" style="color:#1c1c1b;">@jo.flikss_</a>
            </p>
          </div>

          <div style="text-align:center;padding:1.5rem;border-top:1px solid #e8e7e2;background:#f7f5f0;">
            <p style="font-size:0.7rem;color:#a8a8a4;margin:0;">
              © 2025 JoFliks Photography · Boston, MA<br/>
              Order ID: ${session.id}
            </p>
          </div>

        </div>
      `,
    };

    // Notification email to you
    const ownerEmail = {
      to: 'joflikss@gmail.com',
      from: { email: 'joflikss@gmail.com', name: 'JoFliks Photography' },
      subject: `💰 New Sale! ${photoName} — $15`,
      html: `
        <p><strong>New photo sale!</strong></p>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        <p><strong>Photo:</strong> ${photoName}</p>
        <p><strong>Album:</strong> ${albumName}</p>
        <p><strong>Sport:</strong> ${sport}</p>
        <p><strong>Amount:</strong> $15.00</p>
        <p><strong>Order ID:</strong> ${session.id}</p>
        <p><em>Download link has been automatically sent to the customer.</em></p>
      `,
    };

    await sgMail.send(buyerEmail);
    await sgMail.send(ownerEmail);

    console.log(`Photo delivered to ${customerEmail}: ${photoName}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
