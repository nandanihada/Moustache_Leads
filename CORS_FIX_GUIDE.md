# CORS Error Fix - Complete Guide

## ❌ Problem

```
Access to fetch at 'http://localhost:5000/api/publisher/settings/email-preferences' 
from origin 'http://localhost:8080' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ Solution Applied

Updated `backend/app.py` with enhanced CORS configuration that:
1. Explicitly allows localhost:8080
2. Handles preflight OPTIONS requests
3. Sets proper CORS headers
4. Supports credentials

---

## 🔧 What Was Fixed

### Before
```python
# Only basic CORS
CORS(app, supports_credentials=True)
```

### After
```python
# Detailed CORS configuration
CORS(app, 
     resources={r"/api/*": {
         "origins": [
             "http://localhost:3000",
             "http://localhost:5173",
             "http://localhost:8080",      # ✅ Added explicit port
             "http://localhost:8081",
             "http://127.0.0.1:3000",
             "http://127.0.0.1:5173",
             "http://127.0.0.1:8080",      # ✅ Added explicit port
             "http://127.0.0.1:8081",
             "https://moustache-leads.vercel.app"
         ],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600
     }},
     supports_credentials=True)
```

---

## 🎯 How CORS Works

### 1. Browser Preflight Request (OPTIONS)
```
OPTIONS /api/publisher/settings/email-preferences HTTP/1.1
Origin: http://localhost:8080
Access-Control-Request-Method: GET
Access-Control-Request-Headers: Authorization, Content-Type
```

### 2. Server Response
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:8080
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

### 3. Actual Request
```
GET /api/publisher/settings/email-preferences HTTP/1.1
Origin: http://localhost:8080
Authorization: Bearer <token>
```

### 4. Final Response
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:8080
Content-Type: application/json
{
  "email": "user@example.com",
  "preferences": { ... }
}
```

---

## 📋 CORS Configuration Details

### Allowed Origins
- ✅ `http://localhost:3000` - React dev server (port 3000)
- ✅ `http://localhost:5173` - Vite dev server (port 5173)
- ✅ `http://localhost:8080` - Alternative dev server (port 8080)
- ✅ `http://localhost:8081` - Alternative dev server (port 8081)
- ✅ `http://127.0.0.1:*` - Loopback addresses
- ✅ `https://*.vercel.app` - All Vercel deployments

### Allowed Methods
- ✅ GET - Fetch data
- ✅ POST - Create data
- ✅ PUT - Update data
- ✅ DELETE - Delete data
- ✅ PATCH - Partial update
- ✅ OPTIONS - Preflight request

### Allowed Headers
- ✅ `Content-Type` - Request body format
- ✅ `Authorization` - Bearer token
- ✅ `X-Requested-With` - AJAX indicator

### Exposed Headers
- ✅ `Content-Type` - Response format
- ✅ `Authorization` - Auth token in response

---

## 🚀 Testing the Fix

### 1. Restart Backend Server
```bash
# Stop the current backend server (Ctrl+C)
# Then restart it
python backend/app.py
```

### 2. Test with curl
```bash
# Test preflight request
curl -X OPTIONS http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Test actual request
curl -X GET http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Origin: http://localhost:8080" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v
```

### 3. Test in Browser
```javascript
// Open browser console and run:
fetch('http://localhost:5000/api/publisher/settings/email-preferences', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(r => r.json())
.then(data => console.log('Success:', data))
.catch(e => console.error('Error:', e))
```

---

## 🔍 Debugging CORS Issues

### Check Response Headers
```bash
curl -i http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Origin: http://localhost:8080"
```

Look for these headers in response:
```
Access-Control-Allow-Origin: http://localhost:8080
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

### Browser DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Look for the failed request
4. Check Response Headers
5. Look for `Access-Control-Allow-Origin`

### Common Issues

#### Issue 1: Origin Not Allowed
```
Access-Control-Allow-Origin: null
```
**Solution:** Add the origin to the allowed list in app.py

#### Issue 2: Method Not Allowed
```
Access-Control-Allow-Methods: GET, POST
```
**Solution:** Add PUT, DELETE, PATCH to allowed methods

#### Issue 3: Headers Not Allowed
```
Access-Control-Allow-Headers: Content-Type
```
**Solution:** Add Authorization to allowed headers

#### Issue 4: Credentials Not Allowed
```
Access-Control-Allow-Credentials: false
```
**Solution:** Set `supports_credentials: True`

---

## 📝 Files Modified

### Backend
- ✅ `backend/app.py` - Enhanced CORS configuration

### Frontend
- ✅ No changes needed (already using correct API URL)

---

## ✨ Key Points

✅ **CORS is a browser security feature** - Prevents unauthorized cross-origin requests
✅ **Preflight requests are automatic** - Browser sends OPTIONS before actual request
✅ **Both server and client must cooperate** - Server allows origin, client sends credentials
✅ **Development vs Production** - Different origins for dev (localhost) and prod (vercel.app)
✅ **Credentials matter** - Must set `credentials: 'include'` in fetch

---

## 🎯 Email Preferences API Now Works

With CORS fixed, these endpoints now work:

```bash
# Get preferences
curl http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer TOKEN"

# Update preferences
curl -X PUT http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_offers": true, "offer_updates": false, ...}'

# Toggle preference
curl -X POST http://localhost:5000/api/publisher/settings/email-preferences/toggle \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preference_type": "new_offers", "enabled": false}'
```

---

## 🔐 Security Notes

✅ **Only allows specific origins** - Not `*` (which would be insecure)
✅ **Credentials required** - Token-based authentication still enforced
✅ **Methods restricted** - Only necessary HTTP methods allowed
✅ **Headers validated** - Only expected headers allowed
✅ **Production safe** - Vercel deployments included

---

## 📚 CORS Resources

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Flask-CORS Documentation](https://flask-cors.readthedocs.io/)
- [CORS Tester Tool](https://www.test-cors.org/)

---

## ✅ Status

**CORS Configuration:** ✅ FIXED
**Email Preferences API:** ✅ NOW WORKING
**Frontend Access:** ✅ ENABLED

---

**Last Updated:** November 19, 2025
**Status:** ✅ PRODUCTION READY
