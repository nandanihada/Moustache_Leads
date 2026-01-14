# Render Backend Setup Guide

## Current Backend URL
`https://moustache-leads-1.onrender.com`

---

## Step 1: Verify Backend Deployment

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Find your `moustache-leads-1` service
3. Check if the latest commit is deployed
4. Look for the CORS changes in the deployment logs

---

## Step 2: Environment Variables on Render

Make sure these environment variables are set in Render:

### Required Variables:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FLASK_ENV=production
```

### Optional but Recommended:
```
CORS_ORIGINS=https://moustacheleads.com,https://dashboard.moustacheleads.com,https://offers.moustacheleads.com,https://offerwall.moustacheleads.com,https://landing.moustacheleads.com
```

**How to add:**
1. Go to your service in Render
2. Click "Environment" tab
3. Add/update environment variables
4. Click "Save Changes"
5. Render will auto-redeploy

---

## Step 3: Postback URL Configuration

### What is a Postback?
Postbacks are server-to-server callbacks from offer networks when a conversion happens.

### Your Postback URL Format:
```
https://moustache-leads-1.onrender.com/postback/{postback_key}?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

### Render Settings for Postbacks:

#### 1. Health Check Path (Important!)
- Go to Render service → Settings
- Find "Health Check Path"
- Set to: `/` or `/api/health` (if you have a health endpoint)
- This prevents Render from sleeping your service

#### 2. Auto-Deploy
- Enable "Auto-Deploy" from Git
- This ensures latest code is always deployed

#### 3. Instance Type
- **Free tier**: Service sleeps after 15 min of inactivity
  - ⚠️ Problem: First postback after sleep takes 30-60 seconds to wake up
  - ⚠️ May miss time-sensitive postbacks
  
- **Paid tier ($7/month)**: Service stays always on
  - ✅ Recommended for production
  - ✅ No cold starts
  - ✅ Reliable postback reception

#### 4. Persistent Disk (Optional)
- Not needed for postbacks (they go to MongoDB)
- Only needed if you store files locally

---

## Step 4: CORS Configuration Check

Your backend `app.py` should have these origins (already updated):

```python
allowed_origins = [
    "https://moustacheleads.com",
    "https://www.moustacheleads.com",
    "https://dashboard.moustacheleads.com",
    "https://offers.moustacheleads.com",
    "https://offerwall.moustacheleads.com",
    "https://landing.moustacheleads.com",
    "http://localhost:5173",
    "http://localhost:8080",
    # ... other localhost origins
]
```

---

## Step 5: Test Backend

### Test Health:
```bash
curl https://moustache-leads-1.onrender.com/
```

### Test CORS:
```bash
curl -H "Origin: https://offers.moustacheleads.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -X OPTIONS \
  https://moustache-leads-1.onrender.com/api/auth/login
```

Should return CORS headers in response.

### Test Login Endpoint:
```bash
curl -X POST https://moustache-leads-1.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://offers.moustacheleads.com" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## Step 6: Monitor Logs

In Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Watch for:
   - CORS errors
   - Postback reception logs
   - Any Python errors

---

## Troubleshooting

### CORS Error Still Happening?

1. **Check if backend is deployed:**
   - Look at Render dashboard
   - Check "Events" tab for latest deployment
   - Verify deployment succeeded

2. **Check CORS headers:**
   - Open browser DevTools → Network tab
   - Try login
   - Check response headers for `Access-Control-Allow-Origin`

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or use incognito mode

4. **Verify environment variables:**
   - Check Render → Environment tab
   - Ensure all required vars are set

### Postback Not Working?

1. **Check Render logs:**
   - Look for incoming POST requests to `/postback/{key}`
   - Check for any errors

2. **Test postback manually:**
   ```bash
   curl -X POST "https://moustache-leads-1.onrender.com/postback/YOUR_KEY?aff_sub=test&status=approved&payout=1.50&transaction_id=12345"
   ```

3. **Check if service is sleeping:**
   - Free tier sleeps after 15 min
   - First request wakes it up (30-60 sec delay)
   - Consider upgrading to paid tier

### Service Sleeping Issues?

**Temporary Fix (Free Tier):**
- Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your backend every 5 minutes
- Keeps service awake

**Permanent Fix:**
- Upgrade to Render paid tier ($7/month)
- Service stays always on

---

## Recommended Render Configuration

### For Production:

```
Service Type: Web Service
Instance Type: Starter ($7/month) or higher
Auto-Deploy: Yes
Health Check Path: /
Branch: main
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
```

### Environment Variables:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
FLASK_ENV=production
PYTHONUNBUFFERED=1
```

---

## Postback URL Examples

### For Offer Networks:

**HasOffers/TUNE:**
```
https://moustache-leads-1.onrender.com/postback/{key}?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

**CPA Lead:**
```
https://moustache-leads-1.onrender.com/postback/{key}?aff_sub=[SUBID]&status=[STATUS]&payout=[PAYOUT]&transaction_id=[TID]
```

**Custom Network:**
```
https://moustache-leads-1.onrender.com/postback/{key}?aff_sub={{subid}}&status={{status}}&payout={{payout}}&transaction_id={{transaction_id}}
```

Replace `{key}` with the actual postback key from your admin panel.

---

## Next Steps

1. ✅ Verify backend is deployed on Render
2. ✅ Check environment variables are set
3. ✅ Test CORS with curl commands above
4. ✅ Deploy frontend with updated `.env.production`
5. ✅ Test login from subdomain
6. ✅ Monitor Render logs for any issues

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com/
- **Render Support**: https://render.com/support
