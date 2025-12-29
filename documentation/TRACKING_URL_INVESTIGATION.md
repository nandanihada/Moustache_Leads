# Investigation Results - Tracking URL Issue

## ✅ Database is Clean!

I ran comprehensive checks on your database:
- **0 offers** have `:5000` in `masked_url`
- **0 offers** have `:5000` in any URL field (`target_url`, `tracking_url`, `click_url`, etc.)
- Total offers: 32
- Active offers: 28

## 🔍 So Where is `:5000` Coming From?

Since the database is clean, the `:5000` must be added **dynamically** when:
1. The backend generates tracking URLs in the `/api/offerwall/offers` endpoint
2. OR the frontend is somehow adding it

## 📍 The Tracking URL Generation Code

In `backend/routes/offerwall.py` around line 1985-2010:

```python
# Determine the correct base URL based on the request
if 'localhost' in request.host or '127.0.0.1' in request.host:
    base_url = "http://localhost:5000"  # Local development URL
else:
    # Use the same protocol and host as the request
    protocol = request.scheme
    host = request.host.split(':')[0]  # Remove port if present
    
    # Map frontend domains to backend domains
    if 'theinterwebsite.space' in host:
        base_url = "https://api.theinterwebsite.space"
    elif 'vercel.app' in host:
        base_url = "https://moustacheleads-backend.onrender.com"  # ✅ CORRECT - NO PORT
    else:
        base_url = f"{protocol}://{host}:5000"  # ⚠️ THIS LINE MIGHT BE THE ISSUE
```

## 🎯 The Problem

When the request comes from a domain that's NOT:
- localhost
- vercel.app
- theinterwebsite.space

It falls into the `else` block which adds `:5000`!

## 🔧 Possible Scenarios

### Scenario 1: Request from Render.com itself
If the request is coming from `moustacheleads-backend.onrender.com` (backend calling itself), it would:
- Not match localhost ❌
- Not match vercel.app ❌
- Not match theinterwebsite.space ❌
- Fall into else block ✅
- Result: `https://moustacheleads-backend.onrender.com:5000` ⚠️

### Scenario 2: Direct API calls
If someone is calling the API directly from Postman, curl, or another domain.

## ✅ The Fix

Update line 2002 in `backend/routes/offerwall.py`:

**Current:**
```python
else:
    base_url = f"{protocol}://{host}:5000"  # Assume backend on same host with port 5000
```

**Should be:**
```python
else:
    # Check if it's the Render backend itself
    if 'onrender.com' in host:
        base_url = f"{protocol}://{host}"  # No port for Render
    else:
        base_url = f"{protocol}://{host}:5000"  # Assume backend on same host with port 5000
```

## 🧪 How to Test

1. Make the fix above
2. Deploy to production
3. Open the offerwall on your live site
4. Check the tracking URLs in the offers
5. They should NOT have `:5000` anymore

## 📝 Alternative: More Robust Fix

Instead of checking domains, check if we're in production:

```python
import os

# At the top of the function
is_production = os.getenv('ENVIRONMENT') == 'production' or 'onrender.com' in request.host

# Then in the URL generation:
if 'localhost' in request.host or '127.0.0.1' in request.host:
    base_url = "http://localhost:5000"
elif 'vercel.app' in host or 'moustache-leads' in host:
    base_url = "https://moustacheleads-backend.onrender.com"
elif 'theinterwebsite.space' in host:
    base_url = "https://api.theinterwebsite.space"
elif is_production or 'onrender.com' in host:
    # Production - no port
    base_url = f"{protocol}://{host}"
else:
    # Development - with port
    base_url = f"{protocol}://{host}:5000"
```

## 🚀 Next Steps

1. Apply the fix to `backend/routes/offerwall.py`
2. Deploy to production
3. Test the tracking URLs
4. Verify they work correctly

Would you like me to apply this fix now?

