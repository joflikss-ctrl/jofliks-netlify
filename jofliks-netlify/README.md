# JoFliks Photography — Website

A complete 5-page photography business website.
Sports & Event Photography | Boston, MA

---

## Pages
- `index.html`     → Home
- `portfolio.html` → Portfolio with category filter
- `gallery.html`   → Gallery with Sports/Events tabs + buy buttons
- `pricing.html`   → Booking packages, digital download pricing, FAQ
- `contact.html`   → Contact form

---

## Setup Checklist

### 1. Add Your Photos
Replace the placeholder `.ph-sport1`, `.ph-event1` etc. divs with real `<img>` tags.
Or host images on Cloudinary (free tier, 25GB) and use their URLs.

```html
<!-- BEFORE (placeholder) -->
<div class="photo-bg ph-sport1"></div>

<!-- AFTER (real image) -->
<img src="https://res.cloudinary.com/YOUR_CLOUD/image/upload/v1/jofliks/sprint.jpg"
     alt="Championship Sprint" class="photo-bg" style="object-fit:cover;" />
```

### 2. Set Up Digital Sales (Gumroad — Free)
1. Go to https://gumroad.com and create a free account
2. For each photo, click "New Product" → type "Digital"
3. Upload the full-res JPEG, set your price ($15 or $20)
4. Copy the product link
5. In `gallery.html`, replace every `YOUR_GUMROAD_LINK_HERE` with your actual links

```html
<a href="https://yourname.gumroad.com/l/sprint-photo" class="btn-buy" target="_blank">Buy Digital</a>
```

### 3. Set Up Contact Form (Formspree — Free)
1. Go to https://formspree.io and sign up free
2. Click "New Form", name it "JoFliks Contact"
3. Copy your form ID (looks like: xpzvwabk)
4. In `contact.html`, update this line:
```html
<form action="https://formspree.io/f/YOUR_FORMSPREE_ID" ...>
```

### 4. Deploy to Vercel (Free Hosting)
1. Create a free GitHub account at https://github.com
2. Create a new repository called "jofliks-photography"
3. Upload all files (drag & drop on GitHub web interface)
4. Go to https://vercel.com → "Add New Project" → Import from GitHub
5. Click Deploy — your site is live at yourname.vercel.app

### 5. Custom Domain (~$12/year)
1. Buy domain at https://namecheap.com (e.g., jofliksphotography.com)
2. In Vercel dashboard → your project → Settings → Domains
3. Add your domain and Vercel shows you DNS records to copy
4. In Namecheap → Manage Domain → Advanced DNS → paste the records
5. Wait 10–30 mins → your site is live at your custom domain (HTTPS free)

### 6. Update Your Info
- `contact.html`: Replace `hello@jofliksphotography.com` with your real email
- `contact.html`: Replace `@jofliksphotography` with your Instagram
- All pages footer: Update social media links
- `index.html`: Update stats (events covered, photos delivered, years experience)

---

## Pricing (Change Anytime)
All prices are in the HTML. Search for `$5`, `$250`, `$500`, `$1,899` to update.

- Individual photo download: **$5**
- Half Day (3 hrs): **$250**
- Full Day (7 hrs): **$500**
- Season Package: **$1,899**

---

## Your Details Already Set
- Email: joflikss@gmail.com
- Instagram: https://www.instagram.com/jo.flikss_/
- Location: Boston, MA

---

## File Structure
```
jofliks/
├── index.html
├── portfolio.html
├── gallery.html
├── pricing.html
├── contact.html
├── css/
│   └── style.css
└── js/
    └── main.js
```

---

## Monthly Running Cost
| Item | Cost |
|------|------|
| Domain (Namecheap) | ~$1/mo ($12/yr) |
| Hosting (Vercel) | Free |
| Photo storage (Cloudinary free tier) | Free |
| Contact forms (Formspree free tier) | Free |
| Sales platform (Gumroad) | Free + ~10% per sale |
| **Total** | **~$1/mo** |
