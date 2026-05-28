# SSBForge — Free SSB Defence Preparation Website

**Live site:** `https://smariangit.github.io/SSBForge`

Hosted free on GitHub Pages. No server required.

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


---

Jai Hind 🇮🇳 | Built by [@smariangit](https://github.com/smariangit)

---