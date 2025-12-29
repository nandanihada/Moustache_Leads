# 🧪 OFFERWALL - TESTING GUIDE

**Status**: ✅ READY FOR TESTING
**Date**: Nov 26, 2025

---

## 🚀 QUICK START

### 1. Start Backend
```bash
cd backend
python app.py
```
✅ Should start without errors

### 2. Start Frontend
```bash
npm run dev
```
✅ Should start and connect to backend

---

## 📋 TESTING CHECKLIST

### ✅ UI Layout Test
1. Open offerwall: `http://localhost:5173/offerwall?placement_id=4hN81lEwE7Fw1hnI&user_id=test_user`
2. **Expected**: Clean, spacious layout
3. **Check**:
   - Cards have proper spacing (1.5rem gaps)
   - Header is not congested
   - Container max-width is 1400px
   - Responsive on mobile

### ✅ Tracking Links Test
1. Click any "Start Offer" button
2. **Expected**: Opens real offer URL in new tab
3. **Check**:
   - New tab opens with offer URL
   - Not a "Not Found" page
   - Backend logs show click tracking

### ✅ Activity Tracking Test
1. Complete an offer (simulate with API call)
2. Open Activity Modal (click chart icon)
3. **Expected**: Shows completed offers with details
4. **Check**:
   - Offer title and reward amount
   - Completion time (formatted)
   - "2 hours ago" relative time
   - Transaction details

---

## 🔧 API TESTING

### Test 1: Get Offers
```bash
curl "http://localhost:5000/api/offerwall/offers?placement_id=4hN81lEwE7Fw1hnI&user_id=test_user"
```
✅ Should return offers with proper click URLs

### Test 2: Track Conversion
```bash
curl -X POST "http://localhost:5000/api/offerwall/track/conversion" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess_123",
    "click_id": "click_456",
    "offer_id": "SURVEY_001",
    "placement_id": "4hN81lEwE7Fw1hnI",
    "user_id": "test_user",
    "payout_amount": 100,
    "offer_name": "Test Survey"
  }'
```
✅ Should create activity record

### Test 3: Get Activity
```bash
curl "http://localhost:5000/api/offerwall/user/activity?user_id=test_user&placement_id=4hN81lEwE7Fw1hnI"
```
✅ Should show completed offers with formatted times

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: "Not Found" Page
**Cause**: Offers don't have URL fields
**Solution**:
1. Check backend logs for "Click URL: #"
2. Update offers in database with proper URLs
3. Fields to check: `masked_url`, `target_url`, `click_url`, `url`

### Issue: No Activity Showing
**Cause**: Conversion not tracked
**Solution**:
1. Verify conversion API is called
2. Check `offerwall_activities` collection
3. Look for "Activity recorded" logs

### Issue: UI Still Congested
**Cause**: CSS not loading
**Solution**:
1. Clear browser cache
2. Hard refresh (Ctrl+F5)
3. Check network tab for CSS loading

---

## 📊 EXPECTED BEHAVIOR

### UI Layout
- ✅ Spacious grid layout
- ✅ 1.5rem gaps between cards
- ✅ Clean header with proper spacing
- ✅ Responsive on all devices

### Tracking Links
- ✅ Real offer URLs open
- ✅ New tab opens correctly
- ✅ Click tracking logged
- ✅ No "Not Found" pages

### Activity Tracking
- ✅ Shows completed offers
- ✅ Formatted timestamps
- ✅ Relative time display
- ✅ Detailed completion info

---

## 🔍 DEBUGGING

### Check Backend Logs:
```bash
# Look for these messages:
✅ Offer: [Title], Click URL: [url]
✅ Activity recorded for user [user_id]
📊 Fetching activity for user [user_id]
✅ Found [count] completed offers
```

### Browser Console:
```javascript
// Check for:
// Click tracking errors
// API call failures
// JavaScript errors
```

### Network Tab:
```javascript
// Check:
// /api/offerwall/offers - 200 OK
// /api/offerwall/user/activity - 200 OK
// /api/offerwall/track/click - 200 OK
```

---

## ✅ SUCCESS CRITERIA

### Layout Test
- [ ] Cards not congested
- [ ] Proper spacing visible
- [ ] Responsive works
- [ ] Header looks clean

### Links Test
- [ ] Real URLs open
- [ ] No 404 errors
- [ ] New tab opens
- [ ] Tracking works

### Activity Test
- [ ] Shows completed offers
- [ ] Times formatted correctly
- [ ] Relative times work
- [ ] Details visible

---

## 🚀 READY TO TEST

All fixes have been implemented. The offerwall should now:

1. **Look clean and spacious** ✅
2. **Open real offer links** ✅  
3. **Track detailed activity** ✅

**Start testing now!** 🎉
