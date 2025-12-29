# 🧪 Testing Guide - Manual Testing Steps

## Prerequisites

Before testing, make sure:
1. ✅ Backend server is running (restart if needed)
2. ✅ Frontend is running
3. ✅ You have a user account to test with

---

## Test #1: Placement Lookup Fix

### What We Fixed
- Placement lookup errors that caused registration failures
- Auto-approval bugs

### How to Test

#### Step 1: Register a New Account
1. Go to your live website
2. Click "Register" or "Sign Up"
3. Fill in the registration form
4. Submit

**Expected Result:**
- ✅ Registration should complete WITHOUT errors
- ✅ No error about "missing publisher_id"
- ✅ You should be redirected to dashboard/login

**What to Check in Backend Logs:**
Look for these messages:
```
✅ Found placement by ObjectId _id: [placement_id]
OR
✅ Found placement by placement_id field: [placement_id]
OR
✅ Found placement by _id as string: [placement_id]
```

**If You See Errors:**
- ❌ "Placement.get_placement_by_id() missing 1 required positional argument"
  → The fix didn't apply, need to restart backend

---

#### Step 2: Create a Placement
1. Login to your account
2. Go to Placements page
3. Click "Create New Placement"
4. Fill in the form:
   - Platform Type: Website/iOS/Android
   - Offerwall Title: "Test Offerwall"
   - Currency Name: "Coins"
   - Exchange Rate: 1
   - Postback URL: https://yoursite.com/postback
5. Submit

**Expected Result:**
- ✅ Placement created successfully
- ✅ Shows "Pending Approval" status
- ✅ No errors in console

**What to Check in Backend Logs:**
```
✅ Found placement, publisher_id: [your_publisher_id]
```

---

## Test #2: Tracking URL Fix

### What We Fixed
- Tracking URLs had `:5000` port in production
- Now they should be clean URLs

### How to Test

#### Step 1: Open Offerwall
1. Login to your account
2. Navigate to the offerwall page
3. Wait for offers to load

#### Step 2: Inspect Offer Links
1. Right-click on any offer card
2. Select "Inspect Element" (or press F12)
3. Look at the HTML for the offer button
4. Find the `onclick` or `href` attribute

**Expected Result:**
The tracking URL should look like:
```
✅ CORRECT: https://moustacheleads-backend.onrender.com/track/ML-00065?user_id=...
❌ WRONG:   https://moustacheleads-backend.onrender.com:5000/track/ML-00065?user_id=...
```

**Alternative Method - Check Network Tab:**
1. Open DevTools (F12)
2. Go to Network tab
3. Click on an offer
4. Look at the request to `/api/offerwall/offers`
5. Check the response JSON
6. Find the `click_url` field

**Expected in Response:**
```json
{
  "offers": [
    {
      "id": "ML-00065",
      "title": "Some Offer",
      "click_url": "https://moustacheleads-backend.onrender.com/track/ML-00065?user_id=..."
    }
  ]
}
```

#### Step 3: Test Offer Click
1. Click on an offer
2. It should redirect to the offer page

**Expected Result:**
- ✅ Redirects successfully
- ✅ No 404 or connection errors
- ✅ Offer page loads

**What to Check in Backend Logs:**
```
✅ Generated tracking URL: https://moustacheleads-backend.onrender.com/track/ML-00065...
```
(Should NOT have `:5000`)

---

## Test #3: Performance Reports Fix

### What We Fixed
- Reports were using hardcoded 'test-user'
- Now they use the actual logged-in user
- Authentication is enabled

### How to Test

#### Step 1: Login
1. Go to your website
2. Login with your account
3. Make sure you're logged in (check if token is in localStorage)

**Check Token:**
1. Open DevTools (F12)
2. Go to Console tab
3. Type: `localStorage.getItem('token')`
4. Press Enter

**Expected Result:**
- ✅ Should show a JWT token string
- ❌ If null, you're not logged in

#### Step 2: Access Performance Reports
1. Navigate to Performance Reports page
2. Wait for data to load

**Expected Result:**
- ✅ Page loads without 500 error
- ✅ Shows your actual data (not empty)
- ✅ Date range selector works
- ✅ Filters work

**What to Check in Browser Console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any errors

**Expected:**
- ✅ No errors
- ✅ API call to `/api/reports/performance` returns 200

**What to Check in Network Tab:**
1. Open DevTools (F12)
2. Go to Network tab
3. Find the request to `/api/reports/performance`
4. Check the response

**Expected Response:**
```json
{
  "success": true,
  "report": {
    "data": [...],
    "summary": {
      "total_clicks": 123,
      "total_conversions": 45,
      "total_payout": 678.90,
      ...
    },
    "pagination": {...}
  }
}
```

#### Step 3: Check Conversion Reports
1. Navigate to Conversion Reports page
2. Wait for data to load

**Expected Result:**
- ✅ Page loads without 500 error
- ✅ Shows your conversions (if any)
- ✅ Date filtering works

---

## Test #4: End-to-End Offer Flow

### Complete Flow Test

#### Step 1: View Offers
1. Login to your account
2. Go to offerwall
3. See list of offers

**Expected:**
- ✅ Offers load
- ✅ Images/titles show correctly
- ✅ Reward amounts visible

#### Step 2: Click an Offer
1. Click on any offer
2. Should open in new tab

**Expected:**
- ✅ Redirects to offer page
- ✅ URL is correct (no :5000)
- ✅ Offer loads

**What to Check in Backend Logs:**
```
📊 Tracking click: offer=ML-00065, user=your_user_id
✅ Click tracked: CLK-XXXXXX for offer ML-00065
```

#### Step 3: Check Click was Tracked
1. Go back to your dashboard
2. Check if click appears in reports
3. Or check backend database

**Expected:**
- ✅ Click is recorded in database
- ✅ Click appears in performance reports (after refresh)

---

## 🔍 Debugging Tips

### If Performance Reports Still Show 500 Error:

1. **Check Backend Logs:**
   ```
   Look for: "Error in get_performance_report: ..."
   ```

2. **Check Authentication:**
   - Open DevTools → Application → Local Storage
   - Verify `token` exists
   - Try logging out and back in

3. **Check API Call:**
   - DevTools → Network tab
   - Find `/api/reports/performance` request
   - Check if Authorization header is sent
   - Check response body for error details

### If Tracking URLs Still Have :5000:

1. **Clear Browser Cache:**
   - Ctrl+Shift+Delete
   - Clear cached images and files

2. **Hard Refresh:**
   - Ctrl+F5 or Cmd+Shift+R

3. **Check Backend Logs:**
   ```
   Look for: "Generated tracking URL: ..."
   Should NOT contain :5000
   ```

### If Placement Creation Fails:

1. **Check Backend Logs:**
   ```
   Look for: "Error fetching placement: ..."
   Should see: "✅ Found placement by..."
   ```

2. **Check Browser Console:**
   - F12 → Console
   - Look for JavaScript errors

---

## ✅ Success Criteria Summary

After testing, you should have:

### Placement Fix:
- ✅ Can register new accounts
- ✅ Can create placements
- ✅ No "missing publisher_id" errors
- ✅ Backend logs show "✅ Found placement by..."

### Tracking URL Fix:
- ✅ Offer URLs don't have `:5000`
- ✅ Offers redirect correctly
- ✅ Backend logs show clean URLs

### Performance Reports Fix:
- ✅ Reports load without 500 error
- ✅ Shows your actual data
- ✅ Authentication works
- ✅ Date filtering works

---

## 📊 What to Share with Me

After testing, please share:

1. **Screenshots** of:
   - Performance Reports page (working or error)
   - Browser Console (F12 → Console)
   - Network tab showing API calls

2. **Backend Logs** showing:
   - Placement lookup messages
   - Tracking URL generation
   - Any errors

3. **Results:**
   - ✅ What worked
   - ❌ What didn't work
   - 🤔 What's unclear

---

## 🚀 Next Steps After Testing

Once current fixes are verified:
1. **Deploy to production** (if testing locally)
2. **Fix postback processing** (so conversions appear in reports)
3. **Implement postback sending** (to partners)
4. **Add real conversion tracking**

Let me know the results! 🎯

