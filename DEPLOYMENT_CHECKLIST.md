# 🔧 Deployment Issue Checklist

## Current Status:
- ✅ Backend is running: https://moustacheleads-backend.onrender.com
- ✅ Frontend is deployed: https://moustache-leads.vercel.app
- ❌ CORS is blocking requests from Vercel to Render

## Problem:
Backend CORS is not allowing requests from your Vercel domain.

---

## 🚀 Solution Steps:

### Step 1: Verify Latest Code is Pushed to GitHub
```bash
git status
git log --oneline -3
```

Should show:
- "fix all API services to use environment variable for production"
- "configure production URLs for deployment"

### Step 2: Check Render Deployment Status

1. Go to https://dashboard.render.com
2. Select your backend service
3. Check "Events" tab - should show latest deployment
4. If not deploying automatically:
   - Click "Manual Deploy" → "Deploy latest commit"

### Step 3: Verify Vercel Environment Variable

1. Go to https://vercel.com/dashboard
2. Select `moustache-leads` project
3. Settings → Environment Variables
4. Verify `VITE_API_URL` = `https://moustacheleads-backend.onrender.com`
5. If missing or wrong:
   - Add/Update it
   - Go to Deployments → Redeploy

### Step 4: Test Backend CORS

After Render redeploys, test CORS:

**Windows PowerShell:**
```powershell
$headers = @{
    "Origin" = "https://moustache-leads.vercel.app"
    "Content-Type" = "application/json"
}
Invoke-WebRequest -Uri "https://moustacheleads-backend.onrender.com/health" -Headers $headers -Method GET
```

**Expected:** Should see `access-control-allow-origin: https://moustache-leads.vercel.app` in headers

### Step 5: Test Login Flow

Open browser console on https://moustache-leads.vercel.app

```javascript
// Check API URL
console.log(import.meta.env.VITE_API_URL)
// Should show: https://moustacheleads-backend.onrender.com

// Test backend connection
fetch('https://moustacheleads-backend.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

---

## 🐛 Common Issues:

### Issue 1: "CORS Error" in Browser Console
**Cause:** Backend hasn't deployed latest code with Vercel URL in CORS
**Fix:** 
1. Check Render deployment logs
2. Manually trigger deploy if needed
3. Wait 2-3 minutes for deployment

### Issue 2: "Failed to fetch" / "Network Error"
**Cause:** Frontend using wrong API URL
**Fix:**
1. Check Vercel environment variable
2. Redeploy frontend after adding variable
3. Hard refresh browser (Ctrl+Shift+R)

### Issue 3: Backend shows "Unhealthy"
**Cause:** MongoDB connection failed
**Fix:**
1. Check Render environment variables
2. Verify `MONGODB_URI` is correct
3. Check MongoDB Atlas allows connections from anywhere (0.0.0.0/0)

### Issue 4: "404 Not Found" on API calls
**Cause:** Wrong API endpoint path
**Fix:**
1. Login endpoint is `/login` not `/api/auth/login`
2. Check backend logs for actual routes

---

## ✅ Verification Steps:

### 1. Backend Health
```
https://moustacheleads-backend.onrender.com/health
```
Should return: `{"status": "healthy"}`

### 2. Backend Root
```
https://moustacheleads-backend.onrender.com/
```
Should return API info with available endpoints

### 3. Frontend Loads
```
https://moustache-leads.vercel.app
```
Should show login page without errors

### 4. Login Works
- Enter credentials
- Should NOT see CORS error
- Should connect to backend
- Should redirect on success

---

## 📊 Current Code Status:

### Backend CORS Configuration (app.py line 60-72):
```python
CORS(app, origins=[
    "http://localhost:3000", 
    "http://localhost:5173", 
    "https://moustache-leads.vercel.app",  # ← Your production URL
    "https://*.vercel.app",
    # ... other origins
])
```

### Frontend API Configuration:
All services now use:
```typescript
const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/...`;
```

---

## 🎯 Next Actions:

1. ✅ Code is ready and committed
2. ⏳ Push to GitHub (if not done)
3. ⏳ Wait for Render auto-deploy (or manual deploy)
4. ⏳ Add Vercel environment variable
5. ⏳ Redeploy Vercel
6. ✅ Test the flow

---

## 📞 Quick Test Commands:

### Test Backend (PowerShell):
```powershell
# Health check
Invoke-WebRequest https://moustacheleads-backend.onrender.com/health

# Test CORS
$headers = @{"Origin" = "https://moustache-leads.vercel.app"}
Invoke-WebRequest -Uri "https://moustacheleads-backend.onrender.com/health" -Headers $headers
```

### Test Frontend (Browser Console):
```javascript
// Check environment
console.log('API URL:', import.meta.env.VITE_API_URL)

// Test connection
fetch('https://moustacheleads-backend.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log('Backend:', d))
```

---

## 🔐 Environment Variables Needed:

### Render (Backend):
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
FLASK_ENV=production
```

### Vercel (Frontend):
```
VITE_API_URL=https://moustacheleads-backend.onrender.com
```

---

## ✨ Expected Final Result:

1. Open: https://moustache-leads.vercel.app
2. See login page
3. Enter credentials
4. No CORS errors
5. Successful login
6. Redirect to dashboard
7. All features working

---

**Status:** Ready to deploy! Just need to ensure Render has latest code and Vercel has environment variable.
