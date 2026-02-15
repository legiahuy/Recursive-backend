# Resend Email Setup Guide

## Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up with your email
3. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to **API Keys** section
2. Click **Create API Key**
3. Give it a name like "Recursive Recordings Production"
4. Select **Full Access** (or **Sending Access** if you only need to send emails)
5. Click **Create**
6. **Copy the API key** - it starts with `re_` (you won't be able to see it again!)

## Step 3: Add Domain (Optional but Recommended)

For better deliverability and to use your own domain in the "from" address:

1. Go to **Domains** section
2. Click **Add Domain**
3. Enter your domain (e.g., `recursiverecordings.com`)
4. Add the DNS records shown to your domain provider (Vercel, Cloudflare, etc.)
5. Wait for verification (usually takes a few minutes)

**If you skip this step:** You can still send emails, but they'll come from `onboarding@resend.dev` instead of your domain.

## Step 4: Update Environment Variables

### Local Development (.env file)

Already updated! Just replace `re_YOUR_RESEND_API_KEY_HERE` with your actual API key.

### Production (Render)

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Update these variables:
   ```
   EMAIL_USER=noreply@yourdomain.com
   EMAIL_PASS=re_your_actual_api_key_here
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   ```
5. Click **Save Changes**
6. Render will automatically redeploy

## Step 5: Test It!

1. Restart your backend server locally:
   ```bash
   npm run dev
   ```
2. Go to your admin dashboard
3. Try accepting or rejecting a demo submission
4. Check the Resend dashboard **Emails** section to see if it was sent

## Troubleshooting

### Error: "Invalid API key"

- Make sure your API key starts with `re_`
- Check for extra spaces in the `.env` file
- Regenerate the API key if needed

### Error: "Domain not verified"

- If using a custom domain, make sure DNS records are added
- Or use the default `onboarding@resend.dev` as EMAIL_USER

### Emails going to spam

- Add domain verification (Step 3)
- Add SPF, DKIM records from Resend
- Warm up your domain by sending gradually

## Free Tier Limits

- **3,000 emails/month**
- **100 emails/day**
- Perfect for demo submissions!

## Support

If you need help: https://resend.com/docs
