const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const customerEmail = session.customer_details.email;
    const { albumName, packageType, photoName, quantity } = session.metadata;

    const packages = {
      single: '1 Photo',
      four:   '4 Photos',
      eight:  '8 Photos',
      full:   'Full Album'
    };

    const packageName = packages[packageType] || packageType;
    const isFullAlbum = packageType === 'full';

    let emailContent;

    if (isFullAlbum) {
      emailContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1c1b;">
          <div style="text-align:center;padding:2rem 0;border-bottom:1px solid #e8e7e2;">
            <h1 style="font-size:1.8rem;font-weight:400;letter-spacing:0.1em;margin:0;">JOFLIKS</h1>
            <p style="font-size:0.75rem;letter-spacing:0.2em;color:#737370;margin:0.3rem 0 0;">PHOTOGRAPHY</p>
          </div>
          <div style="padding:2rem;">
            <h2 style="font-weight:400;font-size:1.4rem;margin-bottom:1rem;">Thank you for your purchase!</h2>
            <p style="color:#4a4a47;line-height:1.7;">You purchased the <strong>Full Album</strong> from <strong>${albumName}</strong>.</p>
            <p style="color:#4a4a47;line-height:1.7;margin-top:1rem;">Your full album zip file will be sent to this email within <strong>24 hours</strong>.</p>
            <p style="color:#4a4a47;line-height:1.7;margin-top:1rem;">If you have any questions, reply to this email or contact us at <a href="mailto:joflikss@gmail.com" style="color:#1c1c1b;">joflikss@gmail.com</a></p>
            <div style="margin-top:2rem;padding:1.2rem;background:#f7f5f0;border-left:3px solid #1c1c1b;">
              <p style="margin:0;font-size:0.85rem;color:#737370;"><strong>Order Reference:</strong> ${session.id}</p>
              <p style="margin:0.4rem 0 0;font-size:0.85rem;color:#737370;"><strong>Album:</strong> ${albumName}</p>
              <p style="margin:0.4rem 0 0;font-size:0.85rem;color:#737370;"><strong>Package:</strong> Full Album</p>
            </div>
          </div>
          <div style="text-align:center;padding:1.5rem;border-top:1px solid #e8e7e2;">
            <p style="font-size:0.75rem;color:#a8a8a4;">© 2025 JoFliks Photography · Boston, MA</p>
            <p style="font-size:0.75rem;color:#a8a8a4;margin-top:0.3rem;">
              <a href="https://www.instagram.com/jo.flikss_/" style="color:#a8a8a4;">@jo.flikss_</a>
            </p>
          </div>
        </div>
      `;
    } else {
      emailContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1c1b;">
          <div style="text-align:center;padding:2rem 0;border-bottom:1px solid #e8e7e2;">
            <h1 style="font-size:1.8rem;font-weight:400;letter-spacing:0.1em;margin:0;">JOFLIKS</h1>
            <p style="font-size:0.75rem;letter-spacing:0.2em;color:#737370;margin:0.3rem 0 0;">PHOTOGRAPHY</p>
          </div>
          <div style="padding:2rem;">
            <h2 style="font-weight:400;font-size:1.4rem;margin-bottom:1rem;">Thank you for your purchase!</h2>
            <p style="color:#4a4a47;line-height:1.7;">You purchased the <strong>${packageName} package</strong> from <strong>${albumName}</strong>.</p>

            <div style="margin:1.5rem 0;padding:1.4rem;background:#f7f5f0;border-left:3px solid #1c1c1b;">
              <p style="margin:0 0 0.8rem;font-weight:600;font-size:0.9rem;">Next steps to receive your photos:</p>
              <ol style="margin:0;padding-left:1.2rem;color:#4a4a47;line-height:1.9;font-size:0.9rem;">
                <li>Go back to the gallery and note the <strong>filenames</strong> of the ${quantity} photos you want (shown on hover, e.g. <strong>JOF_8398</strong>)</li>
                <li>Reply to this email with your chosen filenames</li>
                <li>Your high-resolution photos will be sent within <strong>24 hours</strong></li>
              </ol>
            </div>

            <div style="margin-top:1.5rem;padding:1.2rem;background:#fdfcfa;border:1px solid #e8e7e2;">
              <p style="margin:0;font-size:0.85rem;color:#737370;"><strong>Order Reference:</strong> ${session.id}</p>
              <p style="margin:0.4rem 0 0;font-size:0.85rem;color:#737370;"><strong>Album:</strong> ${albumName}</p>
              <p style="margin:0.4rem 0 0;font-size:0.85rem;color:#737370;"><strong>Package:</strong> ${packageName}</p>
              <p style="margin:0.4rem 0 0;font-size:0.85rem;color:#737370;"><strong>Photos included:</strong> ${quantity}</p>
            </div>

            <p style="margin-top:1.5rem;color:#4a4a47;line-height:1.7;font-size:0.88rem;">
              Questions? Email us at <a href="mailto:joflikss@gmail.com" style="color:#1c1c1b;">joflikss@gmail.com</a> or find us on Instagram 
              <a href="https://www.instagram.com/jo.flikss_/" style="color:#1c1c1b;">@jo.flikss_</a>
            </p>
          </div>
          <div style="text-align:center;padding:1.5rem;border-top:1px solid #e8e7e2;">
            <p style="font-size:0.75rem;color:#a8a8a4;">© 2025 JoFliks Photography · Boston, MA</p>
          </div>
        </div>
      `;
    }

    // Send confirmation email to buyer
    await sgMail.send({
      to: customerEmail,
      from: { email: 'joflikss@gmail.com', name: 'JoFliks Photography' },
      subject: `Your JoFliks Photography Purchase — ${packageName} from ${albumName}`,
      html: emailContent,
    });

    // Send notification to you
    await sgMail.send({
      to: 'joflikss@gmail.com',
      from: { email: 'joflikss@gmail.com', name: 'JoFliks Photography' },
      subject: `New Sale! ${packageName} — ${albumName}`,
      html: `
        <p><strong>New purchase!</strong></p>
        <p><strong>Customer:</strong> ${customerEmail}</p>
        <p><strong>Package:</strong> ${packageName}</p>
        <p><strong>Album:</strong> ${albumName}</p>
        <p><strong>Order ID:</strong> ${session.id}</p>
        <p>${isFullAlbum ? 'Send the full album zip to the customer.' : `Customer needs ${quantity} photos — reply to their confirmation email with the files.`}</p>
      `,
    });
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
