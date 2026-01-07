# API Import Production Fix

## Issue
"Failed to fetch" error when importing offers on live website.

## Root Causes
1. **API URL Configuration**: Frontend wasn't using correct API URL in production
2. **CORS**: Need to ensure production domain is in CORS whitelist
3. **Error Handling**: Poor error messages didn't explain the issue

## Fixes Applied

### 1. Frontend API Service (`src/services/apiImportService.ts`)

**Changed:**
```typescript
// OLD - hardcoded localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// NEW - smart detection
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:5000'
    : '' // Use relative URL in production
);
```

**Added:**
- `credentials: 'include'` to all fetch requests for CORS
- Better error handling with descriptive messages
- Specific handling for "Failed to fetch" errors

### 2. Duplicate Detection Default

**Changed:**
```typescript
// OLD - skip duplicates by default
const [skipDuplicates, setSkipDuplicates] = useState(true);

// NEW - import all by default
const [skipDuplicates, setSkipDuplicates] = useState(false);
```

Now all offers are imported every time unless you check the "Skip duplicates" box.

### 3. Network Name Fix

**Changed:**
- Network field now uses actual network_id (e.g., "cpamerchant") instead of generic "HasOffers"
- Makes it easier to filter and identify offers by network

## Production Checklist

### Backend (Render/Your Server)

1. **Verify CORS includes your production domain:**
   ```python
   # In backend/app.py, ensure your domain is listed:
   "origins": [
       "https://moustache-leads.vercel.app",
       "https://theinterwebsite.space",
       "https://www.theinterwebsite.space",
       # Add your actual production domain here if different
   ]
   ```

2. **Environment Variables:**
   - Make sure backend is deployed and running
   - Check backend logs for any errors

### Frontend (Vercel/Your Host)

1. **Environment Variable:**
   ```
   VITE_API_URL=https://moustacheleads-backend.onrender.com
   ```
   - Set this in Vercel dashboard under Settings > Environment Variables
   - Redeploy after setting

2. **Build and Deploy:**
   ```bash
   npm run build
   # Deploy the dist folder
   ```

## Testing on Production

1. **Open browser console** (F12)
2. **Go to Network tab**
3. **Try API Import**
4. **Check:**
   - Request URL should be `https://moustacheleads-backend.onrender.com/api/admin/offers/api-import/test`
   - Status should be 200 OK
   - Response should have offer data

## Common Issues

### Issue: "Failed to fetch"
**Cause:** Backend not accessible or CORS not configured
**Fix:** 
- Check backend is running: Visit `https://moustacheleads-backend.onrender.com/api/health`
- Add your domain to CORS whitelist in `backend/app.py`

### Issue: "Network error"
**Cause:** Wrong API URL
**Fix:**
- Check `VITE_API_URL` environment variable
- Should be: `https://moustacheleads-backend.onrender.com`

### Issue: 401 Unauthorized
**Cause:** Token not being sent
**Fix:**
- Already fixed with `credentials: 'include'`
- Make sure you're logged in

### Issue: 0 offers imported
**Cause:** Duplicate detection was skipping all offers
**Fix:**
- Already fixed - duplicates are now imported by default
- Or uncheck "Skip duplicate offers" before importing

## Files Modified

1. `src/services/apiImportService.ts` - Better error handling, CORS support
2. `src/components/ApiImportModal.tsx` - Default to import all (no duplicate skip)
3. `backend/services/network_field_mapper.py` - Use actual network_id
4. `backend/services/network_api_service.py` - Fixed nested data parsing
5. `backend/routes/admin_offers.py` - Pass network_id to mapper

## Deployment Steps

1. **Backend:**
   ```bash
   git add .
   git commit -m "Fix API import for production"
   git push
   # Render will auto-deploy
   ```

2. **Frontend:**
   ```bash
   npm run build
   # Deploy to Vercel
   ```

3. **Test:**
   - Clear browser cache
   - Try API import on production
   - Should work now!

## Support

If still having issues:
1. Check browser console for exact error
2. Check backend logs on Render
3. Verify CORS includes your domain
4. Verify VITE_API_URL is set correctly
