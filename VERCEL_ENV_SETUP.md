# Vercel Environment Variable Setup

## Critical: Set Backend URL in Vercel

Your frontend needs to know the backend URL. You must set this in Vercel's environment variables.

---

## Step 1: Add Environment Variable in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **moustacheleads** project
3. Go to **Settings** → **Environment Variables**
4. Add this variable:

```
Name: VITE_API_URL
Value: https://moustache-leads-1.onrender.com
Environment: Production, Preview, Development (select all)
```

5. Click **Save**

---

## Step 2: Redeploy

After adding the environment variable:

### Option A: Trigger Redeploy from Vercel
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Click **Redeploy**

### Option B: Push Code (Recommended)
```bash
git add .
git commit -m "Update backend URL to moustache-leads-1.onrender.com"
git push origin main
```

Vercel will automatically deploy with the new environment variable.

---

## Step 3: Verify Environment Variable

After deployment:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Scroll down to **Environment Variables**
4. Verify `VITE_API_URL` is set correctly

---

## Why This is Needed

- The `.env.production` file is used during **build time**
- But Vercel also needs the variable set in its dashboard
- This ensures the correct backend URL is used in production

---

## All Environment Variables You Should Have

In Vercel → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| VITE_API_URL | https://moustache-leads-1.onrender.com | Production, Preview, Development |

---

## Testing After Setup

1. Wait for Vercel deployment to complete
2. Visit `https://offers.moustacheleads.com`
3. Try to login
4. Check browser console - should see no CORS errors
5. Network tab should show requests going to `https://moustache-leads-1.onrender.com`

---

## Troubleshooting

### Still Getting CORS Errors?

1. **Check Vercel environment variable:**
   - Settings → Environment Variables
   - Verify `VITE_API_URL` is set

2. **Check backend is deployed:**
   - Go to Render dashboard
   - Verify latest deployment succeeded
   - Check logs for CORS configuration

3. **Hard refresh browser:**
   - Ctrl+Shift+R (Windows)
   - Cmd+Shift+R (Mac)
   - Or use incognito mode

4. **Check Network tab:**
   - Open DevTools → Network
   - Try login
   - Check which URL is being called
   - Should be `https://moustache-leads-1.onrender.com/api/auth/login`

### Wrong URL Being Called?

If you see requests going to the old URL:
1. Clear Vercel build cache:
   - Settings → General → Clear Build Cache
2. Redeploy
3. Hard refresh browser

---

## Quick Fix Commands

```bash
# Update and deploy frontend
cd Moustache_Leads
git add .
git commit -m "Fix backend URL and CORS"
git push origin main

# Wait for Vercel deployment
# Then test at https://offers.moustacheleads.com
```

---

## Expected Result

After setup:
- ✅ Login works from all subdomains
- ✅ No CORS errors in console
- ✅ API calls go to `https://moustache-leads-1.onrender.com`
- ✅ All features work normally
