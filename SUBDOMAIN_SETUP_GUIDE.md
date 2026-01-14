# Subdomain Setup Guide for MoustacheLeads

## Overview
This guide will help you set up subdomains for your MoustacheLeads application:
- `dashboard.moustacheleads.com` → Admin dashboard (`/admin`)
- `offers.moustacheleads.com` → Publisher offers (`/dashboard/offers`)
- `offerwall.moustacheleads.com` → User offerwall (`/offerwall?placement_id=xxx&user_id=xxx`)
- `landing.moustacheleads.com` → Landing page (`/`)

**Note:** Postback URLs remain on the backend domain:
- `https://moustache-leads-1.onrender.com/postback/{key}?params...`

---

## Step 1: Configure DNS in GoDaddy

1. Log in to your GoDaddy account
2. Go to **My Products** → **DNS** for moustacheleads.com
3. Click **Add** to create new DNS records
4. Add the following CNAME records:

| Type  | Name       | Value                  | TTL  |
|-------|------------|------------------------|------|
| CNAME | dashboard  | cname.vercel-dns.com   | 600  |
| CNAME | offers     | cname.vercel-dns.com   | 600  |
| CNAME | offerwall  | cname.vercel-dns.com   | 600  |
| CNAME | landing    | cname.vercel-dns.com   | 600  |

5. Save all records
6. Wait 5-10 minutes for DNS propagation

---

## Step 2: Add Domains in Vercel

1. Go to your Vercel dashboard
2. Select your **moustacheleads** project
3. Navigate to **Settings** → **Domains**
4. Add each subdomain one by one:
   - Click **Add Domain**
   - Enter: `dashboard.moustacheleads.com`
   - Click **Add**
   - Repeat for:
     - `offers.moustacheleads.com`
     - `offerwall.moustacheleads.com`
     - `landing.moustacheleads.com`

5. Vercel will automatically verify and provision SSL certificates
6. Wait for all domains to show "Valid Configuration" status

---

## Step 3: Deploy Updated Code

The code has been updated with:
- ✅ Subdomain configuration (`src/config/subdomains.ts`)
- ✅ Subdomain routing middleware (`src/middleware/subdomainRouter.tsx`)
- ✅ Updated App.tsx with subdomain router
- ✅ Vercel configuration (`vercel.json`)

**Deploy to Vercel:**
```bash
git add .
git commit -m "Add subdomain routing support"
git push origin main
```

Vercel will automatically deploy your changes.

---

## Step 4: Update Backend CORS Settings

Update your backend (Render) to allow requests from all subdomains:

In your backend `app.py` or CORS configuration:

```python
from flask_cors import CORS

CORS(app, origins=[
    "https://moustacheleads.com",
    "https://dashboard.moustacheleads.com",
    "https://offers.moustacheleads.com",
    "https://offerwall.moustacheleads.com",
    "https://landing.moustacheleads.com",
    "http://localhost:5173",  # For local development
    "http://localhost:3000"
], supports_credentials=True)
```

Or use a wildcard pattern:
```python
CORS(app, origins=[
    "https://*.moustacheleads.com",
    "https://moustacheleads.com",
    "http://localhost:*"
], supports_credentials=True)
```

---

## Step 5: Test Your Subdomains

After DNS propagation and deployment:

1. **Test Admin Dashboard:**
   - Visit: `https://dashboard.moustacheleads.com`
   - Should redirect to `/admin` route
   - Test admin functionality

2. **Test Publisher Offers:**
   - Visit: `https://offers.moustacheleads.com`
   - Should redirect to `/dashboard/offers` route
   - Test offers listing and management

3. **Test User Offerwall:**
   - Visit: `https://offerwall.moustacheleads.com/offerwall?placement_id=test&user_id=test_user`
   - Should show offerwall with query parameters preserved
   - Test offer clicks and tracking

4. **Test Landing Page:**
   - Visit: `https://landing.moustacheleads.com`
   - Should show main landing page
   - Test navigation and CTAs

5. **Test Postback URLs:**
   - Postback URLs remain on backend: `https://moustacheleads-backend.onrender.com/postback/{key}`
   - No frontend subdomain needed
   - Test postback reception in admin panel

---

## How It Works

### Automatic Routing
The `SubdomainRouter` component automatically:
- Detects which subdomain the user is on
- Redirects to the appropriate route
- Ensures users stay on the correct subdomain
- Preserves query parameters (important for offerwall)

### Cross-Subdomain Navigation
When navigating between sections:
- Links to `/admin` routes → Redirects to `dashboard.moustacheleads.com`
- Links to `/dashboard/offers` routes → Redirects to `offers.moustacheleads.com`
- Links to `/offerwall` routes → Redirects to `offerwall.moustacheleads.com`
- Landing page → `landing.moustacheleads.com`

### Postback URLs
Postback URLs are backend endpoints and don't need a frontend subdomain:
- Format: `https://moustacheleads-backend.onrender.com/postback/{key}?params...`
- These are API endpoints, not user-facing pages
- CORS is configured to accept requests from all frontend subdomains

### Local Development
During local development (localhost):
- Subdomains are ignored
- All routes work normally at `http://localhost:5173`

---

## Troubleshooting

### DNS Not Resolving
- Wait 10-30 minutes for full DNS propagation
- Check DNS with: `nslookup dashboard.moustacheleads.com`
- Clear your browser cache

### SSL Certificate Issues
- Vercel automatically provisions SSL
- May take 5-10 minutes after adding domain
- Check domain status in Vercel dashboard

### CORS Errors
- Ensure backend allows subdomain origins
- Check browser console for specific errors
- Verify credentials are being sent correctly

### Subdomain Not Redirecting
- Check browser console for errors
- Verify deployment completed successfully
- Clear browser cache and cookies

---

## Optional: Update Environment Variables

If you have API URLs in environment variables, update them:

```env
VITE_API_URL=https://your-backend.onrender.com
VITE_MAIN_DOMAIN=moustacheleads.com
```

---

## Rollback Plan

If you need to rollback:
1. Remove subdomain CNAME records from GoDaddy
2. Remove subdomain domains from Vercel
3. Revert code changes:
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## Next Steps

After successful setup:
1. Update any external links to use new subdomains
2. Set up redirects from old URLs if needed
3. Update documentation and user guides
4. Monitor analytics for any issues
5. Consider adding subdomain-specific analytics tracking

---

## Support

If you encounter issues:
- Check Vercel deployment logs
- Check browser console for errors
- Verify DNS records in GoDaddy
- Test with different browsers/devices
