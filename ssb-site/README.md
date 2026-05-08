# SSBForge — Free SSB Defence Preparation Website

**Live site:** `https://smariangit.github.io/ssbforge`

Hosted free on GitHub Pages. No server required.

---

## 🚀 Quick Start (GitHub Pages Hosting)

1. **Fork or upload** this entire folder to a new GitHub repository named `ssbforge`
2. Go to **Settings → Pages → Source → main branch / root**
3. Your site will be live at `https://smariangit.github.io/ssbforge`
4. Share this URL with aspirants!

---

## 📄 Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with motivational quotes |
| SSB Guide | `ssb.html` | Complete SSB interview guide — OLQs, stages, tips |
| Practice | `practice.html` | TAT, WAT, PPDT, Lecturette, OIR with timers |
| Forum | `forum.html` | Premium-only community chat |
| Current Affairs | `current-affairs.html` | Daily newspaper summaries |
| AI Trainer | `ai-trainer.html` | Coming soon page |
| Premium | `premium.html` | ₹51/mo upgrade with Razorpay |

---

## 💳 Razorpay Setup (Premium Payments)

**Your name/UPI is NOT shown to customers.** Only your "Business Name" in Razorpay settings is visible — set it to "SSBForge".

1. Create free account at [razorpay.com](https://razorpay.com)
2. Complete KYC (1-2 days)
3. Settings → API Keys → Generate Key
4. In `premium.html`, replace: `key: 'YOUR_RAZORPAY_KEY_ID'`

---

## 📧 EmailJS Setup (Free Confirmation Emails)

Free tier: 200 emails/month. No server needed.

1. Sign up at [emailjs.com](https://emailjs.com)
2. Add Gmail as email service → copy **Service ID**
3. Create email template with variables: `{{to_name}}`, `{{to_email}}`, `{{payment_id}}`, `{{expiry_date}}`, `{{amount}}` → copy **Template ID**
4. Account → API Keys → copy **Public Key**
5. In `premium.html`, replace:
   - `YOUR_EMAILJS_PUBLIC_KEY`
   - `YOUR_SERVICE_ID`
   - `YOUR_TEMPLATE_ID`

---

## 🔐 About Password Storage

Currently passwords are stored in each user's **browser localStorage** — meaning they only exist on the user's own device. This is fine for a free GitHub Pages site with no server, but means users can't log in from a different device.

**For real cross-device auth (free):** Set up [Supabase](https://supabase.com) (free tier: 500MB, unlimited auth). Replace `js/auth.js` with Supabase client calls.

---

## 💬 Forum — Upgrading to Real Chat

The current forum stores messages in localStorage (local to each user's device). To enable real cross-user chat, see the comment block inside `forum.html`. Recommended option: **Firebase Realtime Database** (free tier, 1GB storage, real-time sync, Google auth). Setup takes about 30-45 minutes following Firebase docs.

---

## ➕ Adding Content (Drag & Drop)

### TAT / PPDT Images
1. Drag `.jpg` into `content/tat/` on GitHub
2. Add entry to `content/tat/index.json`:
```json
{ "id": "tat_008", "label": "Scene 8", "src": "content/tat/tat_008.jpg", "free": false }
```

### WAT Words
Add to `content/wat/index.json`:
```json
{ "id": "wat_36", "label": "ENDURANCE", "word": "ENDURANCE", "free": false }
```

### OIR Papers
Upload to `content/oir/`, add to `content/oir/index.json`:
```json
{ "id": "oir_6", "label": "OIR Paper 6", "src": "content/oir/oir_paper_6.jpg", "free": false, "timeSeconds": 1020 }
```

### Lecturette Topics
Add to `content/lecturette/index.json`:
```json
{ "id": "lec_21", "label": "India's Semiconductor Policy", "topic": "India's Semiconductor Policy", "free": false }
```

### Current Affairs Summaries
Add to `content/current-affairs/index.json`:
```json
{
  "date": "2025-01-17",
  "label": "Jan 17, 2025",
  "category": "defence",
  "headline": "Your headline here",
  "summary": "2-3 sentence summary...",
  "gd_angle": "How to use this in a GD/interview...",
  "keywords": ["keyword1", "keyword2"]
}
```
Categories: `defence`, `foreign`, `national`, `economy`, `science`

### Newspaper PDFs (if needed)
Add to `content/newspaper/index.json` with Google Drive file ID (file shared as "Anyone with link"):
```json
{ "date": "2025-01-16", "label": "Jan 16, 2025", "driveId": "YOUR_FILE_ID" }
```

---

Jai Hind 🇮🇳 | Built by [@smariangit](https://github.com/smariangit)


---

## 🚀 Quick Start (GitHub Pages Hosting)

1. **Fork or upload** this entire folder to a new GitHub repository
2. Go to **Settings → Pages → Source → main branch / root**
3. Your site will be live at `https://your-username.github.io/your-repo-name`
4. Update `_config.yml` with your repo name if using a subdirectory

---

## 📁 Folder Structure

```
ssb-site/
├── index.html              ← Homepage
├── practice.html           ← All practice modules
├── newspaper.html          ← Newspaper archive
├── premium.html            ← Premium upgrade
├── css/style.css           ← All styles
├── js/
│   ├── auth.js             ← User login/register
│   ├── content.js          ← Content loading engine
│   ├── practice.js         ← Slideshow + timer engine
│   └── main.js             ← UI (nav, modals)
└── content/
    ├── tat/
    │   ├── index.json      ← List of TAT images
    │   └── tat_001.jpg     ← Image files (drag & drop here)
    ├── wat/
    │   └── index.json      ← Word list
    ├── ppdt/
    │   ├── index.json
    │   └── *.jpg
    ├── lecturette/
    │   └── index.json      ← Topic list
    ├── oir/
    │   ├── index.json
    │   └── *.jpg           ← OIR paper scans
    └── newspaper/
        └── index.json      ← Newspaper entries (linked to Google Drive)
```

---

## ➕ Adding New Content (Drag & Drop on GitHub)

### Adding TAT / PPDT Images
1. Go to `content/tat/` or `content/ppdt/` in your GitHub repo
2. Drag & drop your `.jpg` or `.png` images directly into the folder
3. Open `content/tat/index.json` and add an entry:
```json
{ "id": "tat_008", "label": "Scene 8 — Forest", "src": "content/tat/tat_008.jpg", "free": false }
```
Set `"free": true` for free-tier content, `false` for premium-only.

### Adding WAT Words
Open `content/wat/index.json` and add entries:
```json
{ "id": "wat_36", "label": "ENDURANCE", "word": "ENDURANCE", "free": false }
```

### Adding OIR Papers
1. Scan or photograph OIR papers as `.jpg` files
2. Upload to `content/oir/`
3. Add to `content/oir/index.json`:
```json
{ "id": "oir_6", "label": "OIR Paper 6", "src": "content/oir/oir_paper_6.jpg", "free": false, "timeSeconds": 1020 }
```

### Adding Lecturette Topics
Open `content/lecturette/index.json` and add:
```json
{ "id": "lec_21", "label": "India's Semiconductor Policy", "topic": "India's Semiconductor Policy", "free": false }
```

---

## 📰 Adding Daily Newspaper (The Hindu from Google Drive)

**Your workflow:** Receive PDF on WhatsApp → Upload to your shared Google Drive folder → Add entry to `index.json`

### Steps:
1. Upload the PDF to your **Google Drive**
2. Right-click the file → **Share → Anyone with the link → Viewer**
3. Copy the file ID from the link:
   `https://drive.google.com/file/d/`**`THIS_IS_THE_FILE_ID`**`/view`
4. Open `content/newspaper/index.json` and add:
```json
{
  "date": "2025-01-16",
  "label": "Jan 16, 2025",
  "driveId": "YOUR_FILE_ID_HERE"
}
```
5. Save and commit — the paper appears on the site immediately.

**Tip:** Keep entries sorted newest first, or the site will sort them automatically.

---

## 💳 Setting Up Razorpay (Premium Payments)

1. Create a **free account** at [razorpay.com](https://razorpay.com)
2. Complete KYC (takes 1-2 days)
3. Go to **Settings → API Keys → Generate Key**
4. Open `premium.html` and find this line:
```javascript
key: 'YOUR_RAZORPAY_KEY_ID',
```
5. Replace with your actual key: `key: 'rzp_live_xxxxxxxx'`
6. Use `rzp_test_xxxxxxxx` for testing without real payments

**Note:** For production, you should verify payments on a backend. For this simple version, payment is trusted client-side. See Razorpay docs for webhook verification.

---

## 🔒 Supabase Backend (Optional — for real auth)

Currently uses `localStorage` for user accounts. For proper auth:
1. Create free [Supabase](https://supabase.com) project
2. Replace `js/auth.js` with Supabase client calls
3. Store premium status in Supabase users table

---

## ✏️ Customisation

- **Site name:** Find/replace `SSBForge` in all HTML files
- **Contact email:** Replace `contact@ssbforge.in`
- **Domain:** Add `CNAME` file with your domain (e.g. `ssbforge.in`)
- **Motivational images:** Add real photos to `assets/images/soldier1.jpg` etc.

---

## 📄 License

Free to use for defence aspirants. Please don't monetise without contributing back.

Jai Hind 🇮🇳
