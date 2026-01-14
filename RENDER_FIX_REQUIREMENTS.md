# Fix Render Requirements.txt Error

## Problem
Render is looking for `requirements.txt` in the root directory, but your backend code is in the `backend/` folder.

## Solution: Update Render Settings

### Step 1: Go to Render Dashboard
1. Visit https://dashboard.render.com/
2. Click on your `moustache-leads-1` service

### Step 2: Update Build & Start Commands

Click on **Settings** tab, then scroll to find these settings:

#### Root Directory
```
backend
```
Set this to tell Render your app is in the `backend` folder.

#### Build Command
```
pip install -r requirements.txt
```
This will now look for `requirements.txt` in the `backend` folder.

#### Start Command
```
gunicorn app:app --bind 0.0.0.0:$PORT
```
Or if you're using Flask's built-in server:
```
python run.py
```

### Step 3: Save Changes
1. Click **Save Changes** at the bottom
2. Render will automatically trigger a new deployment

---

## Alternative: If Root Directory Setting Doesn't Exist

If you don't see a "Root Directory" setting, update these instead:

#### Build Command
```
cd backend && pip install -r requirements.txt
```

#### Start Command
```
cd backend && gunicorn app:app --bind 0.0.0.0:$PORT
```

---

## What I Created

I've created `backend/requirements.txt` with all necessary dependencies:
- Flask and flask-cors
- pymongo for MongoDB
- PyJWT for authentication
- gunicorn for production server
- And more...

---

## Verify After Deployment

1. Wait for Render deployment to complete (2-5 minutes)
2. Check the logs - should see:
   ```
   Successfully installed Flask-3.0.0 flask-cors-4.0.0 ...
   Starting gunicorn ...
   ```
3. Test your backend:
   ```bash
   curl https://moustache-leads-1.onrender.com/
   ```

---

## If Still Having Issues

### Check Python Version
In Render Settings → Environment:
- Add environment variable: `PYTHON_VERSION` = `3.12.0`

### Check Logs
In Render dashboard:
1. Click on your service
2. Go to **Logs** tab
3. Look for specific error messages

### Common Issues

**Issue**: Module not found
**Fix**: Add the missing package to `backend/requirements.txt` and redeploy

**Issue**: Port binding error
**Fix**: Make sure start command includes `--bind 0.0.0.0:$PORT`

**Issue**: App not found
**Fix**: Verify your `app.py` has `app = create_app()` or similar

---

## Quick Test Commands

After deployment succeeds:

```bash
# Test health
curl https://moustache-leads-1.onrender.com/

# Test CORS
curl -H "Origin: https://offers.moustacheleads.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://moustache-leads-1.onrender.com/api/auth/login

# Should return CORS headers
```

---

## Next Steps

1. ✅ Update Render settings (Root Directory = `backend`)
2. ✅ Wait for deployment
3. ✅ Test backend endpoint
4. ✅ Test login from frontend
5. ✅ Verify CORS works

---

## Need to Add More Dependencies?

Edit `backend/requirements.txt` and add the package:
```
package-name==version
```

Then commit and push:
```bash
git add backend/requirements.txt
git commit -m "Add new dependency"
git push origin main
```

Render will auto-deploy with the new package.
