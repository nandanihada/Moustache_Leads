# 🚀 Complete Deployment Guide

## Overview
- **Frontend**: Vercel
- **Backend**: Render
- **Database**: MongoDB Atlas (already configured)

---

## 📋 Pre-Deployment Checklist

- [x] Remove hardcoded secrets
- [ ] Push code to GitHub
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Configure environment variables
- [ ] Test postback system

---

## Part 1: Push Code to GitHub

### Step 1: Push to GitHub
```bash
git push origin main
```

If it fails, check for any remaining secrets and remove them.

---

## Part 2: Deploy Backend to Render

### Step 1: Sign up for Render
1. Go to https://render.com
2. Sign up with GitHub account
3. Connect your GitHub repository

### Step 2: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `nandanihada/Moustache_Leads`
3. Select the repository

### Step 3: Configure Backend Service

**Basic Settings:**
- **Name**: `ascend-backend` (or any name you prefer)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Python 3`
- **Build Command**: 
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command**: 
  ```bash
  gunicorn app:app
  ```

### Step 4: Add Environment Variables

Click "Environment" tab and add these variables:

```
MONGODB_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/ascend_db
JWT_SECRET=your_jwt_secret_key_here
FLASK_ENV=production
PORT=5000
```

**Important:** Replace with your actual MongoDB connection string!

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait 5-10 minutes for deployment
3. Note your backend URL: `https://ascend-backend.onrender.com`

---

## Part 3: Deploy Frontend to Vercel

### Step 1: Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

Or use Vercel Dashboard (easier)

### Step 2: Deploy via Vercel Dashboard

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Select `nandanihada/Moustache_Leads`

### Step 3: Configure Frontend

**Framework Preset**: Vite
**Root Directory**: `./` (leave as root)
**Build Command**: 
```bash
npm run build
```
**Output Directory**: 
```bash
dist
```

### Step 4: Add Environment Variables

In Vercel project settings, add:

```
VITE_API_URL=https://ascend-backend.onrender.com
```

**Important:** Replace with your actual Render backend URL!

### Step 5: Deploy
1. Click "Deploy"
2. Wait 2-3 minutes
3. Note your frontend URL: `https://your-project.vercel.app`

---

## Part 4: Update Frontend API URLs

### Step 1: Create Environment File

Create `.env.production` in root:

```env
VITE_API_URL=https://ascend-backend.onrender.com
```

### Step 2: Update API Services

All your API services should use:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

This is already configured in your services!

---

## Part 5: Configure CORS on Backend

### Update `backend/app.py`

Make sure CORS allows your Vercel domain:

```python
from flask_cors import CORS

# Update CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "https://your-project.vercel.app",  # Add your Vercel URL
            "https://*.vercel.app"  # Allow all Vercel preview deployments
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})
```

---

## Part 6: Install Gunicorn for Render

### Add to `backend/requirements.txt`:

```
gunicorn==21.2.0
```

Commit and push:
```bash
git add backend/requirements.txt
git commit -m 'add gunicorn for production'
git push origin main
```

Render will auto-redeploy.

---

## Part 7: Test Deployment

### Step 1: Test Backend Health
```bash
curl https://ascend-backend.onrender.com/api/health
```

Should return: `{"status": "healthy"}`

### Step 2: Test Frontend
1. Open your Vercel URL
2. Try to login
3. Check browser console for errors

### Step 3: Test API Connection
Open browser console on your Vercel site:
```javascript
fetch('https://ascend-backend.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
```

---

## Part 8: Test Postback System

### Step 1: Set Up Webhook Receiver
1. Go to https://webhook.site
2. Copy your unique URL

### Step 2: Create Partner
1. Login to your deployed app
2. Go to Admin → Partners
3. Create partner with webhook.site URL:
   ```
   https://webhook.site/YOUR-ID?click_id={click_id}&payout={payout}&status={status}&offer_id={offer_id}&conversion_id={conversion_id}&transaction_id={transaction_id}
   ```

### Step 3: Create Offer with Partner
1. Go to Admin → Offers
2. Create/Edit offer
3. Select your test partner
4. Save

### Step 4: Create Test Conversion

**Option A: Use deployed backend**
```bash
# SSH into Render or use Render Shell
python test_postback.py
```

**Option B: Use local script pointing to production**
Update `test_postback.py`:
```python
API_BASE_URL = "https://ascend-backend.onrender.com"
```

Then run:
```bash
cd backend
python test_postback.py
```

### Step 5: Verify Postback
1. Check webhook.site for incoming request
2. Check Admin → Postback Logs in your app
3. Should see successful postback with 200 response

---

## 🔧 Troubleshooting

### Backend Issues

**Problem: Backend not starting**
- Check Render logs
- Verify MongoDB connection string
- Check all dependencies installed

**Problem: 502 Bad Gateway**
- Backend is starting (wait 1-2 minutes)
- Check Render logs for errors

**Problem: Database connection failed**
- Verify MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Check MongoDB URI is correct

### Frontend Issues

**Problem: API calls failing**
- Check VITE_API_URL is set correctly
- Verify CORS is configured on backend
- Check browser console for errors

**Problem: 404 on refresh**
- Vercel should handle this automatically for Vite
- Check vercel.json if needed

### Postback Issues

**Problem: Postbacks not sending**
- Check backend logs
- Verify postback processor is running
- Check partner is active
- Verify offer has partner_id

---

## 📊 Monitoring

### Render Dashboard
- View logs: https://dashboard.render.com
- Monitor CPU/Memory usage
- Check deployment status

### Vercel Dashboard
- View deployment logs
- Monitor function invocations
- Check build status

### MongoDB Atlas
- Monitor database connections
- Check query performance
- View slow queries

---

## 🔐 Security Checklist

- [ ] All secrets in environment variables
- [ ] CORS configured properly
- [ ] MongoDB Atlas IP whitelist configured
- [ ] JWT secret is strong and unique
- [ ] No API keys in code
- [ ] HTTPS enabled (automatic on Vercel/Render)

---

## 💰 Cost Estimate

### Free Tier:
- **Render**: Free tier (750 hours/month)
  - Sleeps after 15 min inactivity
  - Wakes up on request (30s delay)
  
- **Vercel**: Free tier
  - 100GB bandwidth/month
  - Unlimited deployments

- **MongoDB Atlas**: Free tier (M0)
  - 512MB storage
  - Shared CPU

**Total: $0/month** (Free tier)

### Paid Tier (Recommended for production):
- **Render**: $7/month (Starter)
  - Always on
  - No sleep
  
- **Vercel**: Free tier sufficient
  
- **MongoDB Atlas**: $9/month (M2)
  - 2GB storage
  - Better performance

**Total: ~$16/month**

---

## 🚀 Post-Deployment Steps

1. **Update DNS** (if using custom domain)
2. **Set up monitoring** (UptimeRobot, etc.)
3. **Configure backups** (MongoDB Atlas automatic)
4. **Set up error tracking** (Sentry, etc.)
5. **Test all features** thoroughly
6. **Document API endpoints**
7. **Train team** on postback system

---

## 📞 Support

If you encounter issues:
1. Check Render logs
2. Check Vercel logs
3. Check browser console
4. Check MongoDB Atlas metrics
5. Review this guide again

---

## ✅ Deployment Complete!

Once deployed:
- Frontend: `https://your-project.vercel.app`
- Backend: `https://ascend-backend.onrender.com`
- Database: MongoDB Atlas

Your postback system is now live and ready to use! 🎉
