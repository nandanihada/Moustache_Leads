# Subdomain Setup - Quick Start

## 🎯 Goal
Set up 4 subdomains for MoustacheLeads:
1. `dashboard.moustacheleads.com` → Admin panel
2. `offers.moustacheleads.com` → Publisher offers
3. `offerwall.moustacheleads.com` → User offerwall
4. `landing.moustacheleads.com` → Landing page

**Note:** Postback URLs stay on backend: `https://moustacheleads-backend.onrender.com/postback/{key}`

---

## ⚡ Quick Setup (15 minutes)

### Step 1: GoDaddy DNS (5 min)
1. Login to GoDaddy
2. Go to DNS settings for `moustacheleads.com`
3. Add 4 CNAME records:

```
dashboard  → cname.vercel-dns.com
offers     → cname.vercel-dns.com
offerwall  → cname.vercel-dns.com
landing    → cname.vercel-dns.com
```

### Step 2: Vercel Domains (5 min)
1. Go to Vercel project settings
2. Click "Domains"
3. Add these 4 domains:
   - `dashboard.moustacheleads.com`
   - `offers.moustacheleads.com`
   - `offerwall.moustacheleads.com`
   - `landing.moustacheleads.com`

### Step 3: Deploy Code (5 min)
```bash
git add .
git commit -m "Add subdomain routing"
git push origin main
```

Wait for Vercel to deploy automatically.

---

## ✅ Test It

After 10 minutes (DNS propagation):

1. Visit `https://dashboard.moustacheleads.com` → Should show admin panel
2. Visit `https://offers.moustacheleads.com` → Should show publisher offers
3. Visit `https://offerwall.moustacheleads.com/offerwall?placement_id=test&user_id=test` → Should show offerwall
4. Visit `https://landing.moustacheleads.com` → Should show landing page

---

## 📋 What Was Changed

### Frontend Files Created/Updated:
- ✅ `src/config/subdomains.ts` - Subdomain configuration
- ✅ `src/middleware/subdomainRouter.tsx` - Routing logic
- ✅ `src/App.tsx` - Added SubdomainRouter wrapper
- ✅ `vercel.json` - Vercel configuration

### Backend Files Updated:
- ✅ `backend/app.py` - Added subdomain origins to CORS

### Documentation Created:
- ✅ `SUBDOMAIN_SETUP_GUIDE.md` - Detailed setup guide
- ✅ `SUBDOMAIN_DEPLOYMENT_CHECKLIST.md` - Deployment checklist
- ✅ `SUBDOMAIN_MAPPING.md` - URL mapping reference
- ✅ `SUBDOMAIN_QUICK_START.md` - This file

---

## 🔧 How It Works

### Automatic Routing
When you visit a subdomain, the app automatically routes to the correct page:

- `dashboard.moustacheleads.com` → `/admin`
- `offers.moustacheleads.com` → `/dashboard/offers`
- `offerwall.moustacheleads.com` → `/offerwall?params...`
- `landing.moustacheleads.com` → `/`

### Cross-Subdomain Links
Links automatically redirect to the correct subdomain:

```typescript
// Click link to /admin from any subdomain
// → Redirects to dashboard.moustacheleads.com/admin

// Click link to /dashboard/offers from any subdomain
// → Redirects to offers.moustacheleads.com/dashboard/offers
```

### Query Parameters
Offerwall query parameters are preserved:
```
offerwall.moustacheleads.com/offerwall?placement_id=xxx&user_id=yyy
// ✅ Parameters stay intact during routing
```

---

## 🚨 Troubleshooting

### DNS Not Working?
```bash
# Check DNS propagation
nslookup dashboard.moustacheleads.com

# Should return Vercel's IP
```
Wait 10-30 minutes for full propagation.

### SSL Certificate Issues?
- Vercel auto-provisions SSL (takes 5-10 min)
- Check domain status in Vercel dashboard
- Should show "Valid Configuration"

### CORS Errors?
- Backend CORS is already updated
- Check browser console for specific errors
- Verify backend is deployed with latest changes

### Subdomain Not Redirecting?
- Clear browser cache
- Try incognito mode
- Check browser console for errors
- Verify Vercel deployment completed

---

## 📱 Local Development

During development (localhost):
- Subdomains are ignored
- All routes work normally
- Use full paths: `http://localhost:8080/admin`, etc.

---

## 🎉 Done!

Once DNS propagates and Vercel deploys:
- All 4 subdomains will be live
- SSL certificates will be active
- Routing will work automatically
- Users can access via clean subdomain URLs

---

## 📚 More Info

- **Detailed Setup**: See `SUBDOMAIN_SETUP_GUIDE.md`
- **Deployment Checklist**: See `SUBDOMAIN_DEPLOYMENT_CHECKLIST.md`
- **URL Mappings**: See `SUBDOMAIN_MAPPING.md`
