const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail  = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── FIX 1: Stripe requires the RAW request body (not parsed) to verify the
  // webhook signature. Netlify Functions receive it as a base64 string when
  // the content-type is application/json, so we must decode it properly.
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Netlify may base64-encode the body — decode it back to the raw string
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // ── Only act on completed checkouts ───────────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const customerEmail = session.customer_details?.email;
    const customerName  = session.customer_details?.name || 'Athlete';

    if (!customerEmail) {
      console.error('No customer email on session:', session.id);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    const {
      photoUrl,
      photoName,
      albumName,
      sport,
      bundle,
      cartCount,
      isAthlete,
      photoUrls: photoUrlsJson,
    } = session.metadata;

    // ── FIX 2: Support multi-photo athlete orders ─────────────────────────
    // Parse all photo URLs if this is a bundle purchase
    let allPhotoUrls = [];
    try {
      allPhotoUrls = photoUrlsJson ? JSON.parse(photoUrlsJson) : [photoUrl];
    } catch {
      allPhotoUrls = [photoUrl];
    }

    // Build Cloudinary force-download URLs
    const downloadLinks = allPhotoUrls.map(url => ({
      url,
      download: url.replace('/upload/', '/upload/fl_attachment/'),
      name: url.split('/').pop().replace(/\.[^.]+$/, ''),
    }));

    // ── FIX 3: Handle single vs multi-photo email content ─────────────────
    const isBundle    = isAthlete === 'true' && parseInt(cartCount || '1') > 1;
    const amountPaid  = (session.amount_total / 100).toFixed(2);
    const photoCount  = parseInt(cartCount || '1');

    // Build download section for email
    const downloadSection = isBundle
      ? downloadLinks.map((p, i) => `
          <div style="margin:0.8rem 0;padding:0.8rem 1rem;background:#f7f5f0;border-left:3px solid #1c1c1b;">
            <p style="margin:0;font-weight:600;font-size:0.85rem;">${i + 1}. ${p.name}</p>
            <a href="${p.download}"
               style="display:inline-block;margin-top:0.5rem;padding:0.4rem 1rem;background:#1c1c1b;color:white;text-decoration:none;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;">
              Download
            </a>
          </div>`).join('')
      : `
          <div style="text-align:center;margin:2rem 0;">
            <img src="${photoUrl}" alt="${photoName}" style="max-width:100%;max-height:400px;object-fit:cover;border:1px solid #e8e7e2;" />
          </div>
          <div style="text-align:center;margin:2rem 0;">
            <a href="${downloadLinks[0]?.download || photoUrl.replace('/upload/', '/upload/fl_attachment/')}"
               style="display:inline-block;padding:0.9rem 2.5rem;background:#1c1c1b;color:white;text-decoration:none;font-size:0.78rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;">
              Download Your Photo
            </a>
          </div>`;

    const subjectLine = isBundle
      ? `Your ${photoCount} photos from JoFliks Photography`
      : `Your photo from JoFliks Photography — ${photoName}`;

    // ── Buyer email ────────────────────────────────────────────────────────
    const buyerEmail = {
      to: customerEmail,
      from: { email: 'noreply@jofliks.com', name: 'JoFliks Photography' },
      replyTo: 'joflikss@gmail.com',
      subject: subjectLine,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c1c1b;background:#fdfcfa;">

          <div style="text-align:center;padding:2.5rem 2rem 1.5rem;border-bottom:1px solid #e8e7e2;">
            <div style="font-size:1.6rem;font-weight:400;letter-spacing:0.15em;margin-bottom:0.2rem;">JOFLIKS</div>
            <div style="font-size:0.65rem;letter-spacing:0.3em;color:#737370;text-transform:uppercase;">Photography</div>
          </div>

          <div style="padding:2rem 2.5rem;">
            <h2 style="font-weight:400;font-size:1.3rem;margin-bottom:0.5rem;">Hi ${customerName},</h2>
            <p style="color:#4a4a47;line-height:1.8;margin-bottom:1.5rem;">
              Thank you for your purchase! Your ${isBundle ? photoCount + ' photos are' : 'photo is'} ready to download below.
            </p>

            <div style="background:#f7f5f0;border-left:3px solid #1c1c1b;padding:1rem 1.5rem;margin-bottom:1.5rem;">
              <p style="margin:0 0 0.2rem;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#a8a8a4;">Order details</p>
              <p style="margin:0;font-weight:600;">${isBundle ? photoCount + ' photos' : photoName}</p>
              <p style="margin:0.2rem 0 0;font-size:0.82rem;color:#737370;">${sport || 'Sports'} — ${albumName}</p>
              <p style="margin:0.2rem 0 0;font-size:0.82rem;color:#737370;">Amount paid: $${amountPaid}</p>
            </div>

            ${downloadSection}

            <p style="font-size:0.8rem;color:#a8a8a4;text-align:center;margin-top:0.5rem;">
              Links expire after 7 days. Reply to this email if you have any issues.
            </p>

            <p style="font-size:0.82rem;color:#737370;line-height:1.8;margin-top:2rem;border-top:1px solid #e8e7e2;padding-top:1.2rem;">
              Questions? Reply to this email or contact us at
              <a href="mailto:joflikss@gmail.com" style="color:#1c1c1b;">joflikss@gmail.com</a><br/>
              Follow us: <a href="https://www.instagram.com/jo.flikss_/" style="color:#1c1c1b;">@jo.flikss_</a>
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

    // ── Owner notification ─────────────────────────────────────────────────
    const ownerEmail = {
      to: 'joflikss@gmail.com',
      from: { email: 'noreply@jofliks.com', name: 'JoFliks Photography' },
      subject: `💰 New Sale! ${isBundle ? photoCount + ' photos' : photoName} — $${amountPaid}`,
      html: `
        <p><strong>New photo sale!</strong></p>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        <p><strong>Photos:</strong> ${isBundle ? photoCount + ' photos (' + bundle + ')' : photoName}</p>
        <p><strong>Album:</strong> ${albumName}</p>
        <p><strong>Sport:</strong> ${sport || 'N/A'}</p>
        <p><strong>Amount:</strong> $${amountPaid}</p>
        <p><strong>Athlete purchase:</strong> ${isAthlete === 'true' ? 'Yes' : 'No'}</p>
        <p><strong>Order ID:</strong> ${session.id}</p>
        <p><em>Download link has been automatically sent to the customer.</em></p>
      `,
    };

    try {
      await sgMail.send(buyerEmail);
      console.log(`✅ Email sent to buyer: ${customerEmail}`);
    } catch (emailErr) {
      console.error('❌ Failed to send buyer email:', emailErr.response?.body || emailErr.message);
      // Don't throw — still send owner notification and return 200
    }

    try {
      await sgMail.send(ownerEmail);
      console.log(`✅ Owner notification sent`);
    } catch (emailErr) {
      console.error('❌ Failed to send owner email:', emailErr.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
