# Sending emails to your leads (no domain required)

## Option 1: Gmail (easiest — no domain)

1. **Enable 2-Step Verification** on your Google account: [myaccount.google.com/security](https://myaccount.google.com/security)
2. **Create an App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → choose "Mail" → copy the 16-character password.
3. In your project `.env` add:
   ```
   GMAIL_USER="yourname@gmail.com"
   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
   ```
   (Remove spaces from the app password if you prefer.)
4. **Restart** `npm run dev`.

Emails will be sent from your Gmail to your leads. No domain needed.

---

## Option 2: Resend with a verified domain

When using Resend's default address, emails only go to your signup email. To send to leads:

1. **Verify a domain** at [resend.com/domains](https://resend.com/domains) (add DNS records they give you).
2. In `.env` set: `RESEND_FROM_EMAIL="OutreachAI <outreach@yourdomain.com>"`
3. In the app **Settings** page, set the same in "Sender (From) email" and save.
4. Restart `npm run dev`.
