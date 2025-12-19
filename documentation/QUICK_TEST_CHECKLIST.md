# 🎯 Quick Testing Checklist

## Before You Start
- [ ] Backend server is running
- [ ] Frontend is running  
- [ ] You have a test account

---

## Test 1: Placement Fix (5 min)

### Register New Account
1. Go to website → Register
2. Fill form → Submit

**✅ Expected:** Registration succeeds, no errors
**❌ If fails:** Check backend logs for "missing publisher_id"

### Create Placement
1. Login → Placements → Create New
2. Fill form → Submit

**✅ Expected:** Placement created, shows "Pending Approval"
**❌ If fails:** Check console for errors

---

## Test 2: Tracking URL Fix (3 min)

### Check Offer URLs
1. Login → Open Offerwall
2. F12 → Network tab
3. Click any offer
4. Check the redirect URL

**✅ Expected:** URL is `https://moustacheleads-backend.onrender.com/track/...`
**❌ Wrong:** URL has `:5000` like `https://...onrender.com:5000/track/...`

### Quick Check
- Right-click offer → Inspect
- Look at `onclick` or `href`
- Should NOT contain `:5000`

---

## Test 3: Performance Reports Fix (5 min)

### Access Reports
1. Login to your account
2. Go to Performance Reports page

**✅ Expected:** Page loads, shows data, no 500 error
**❌ If 500:** Check if you're logged in (token in localStorage)

### Check in DevTools
1. F12 → Network tab
2. Find `/api/reports/performance` request
3. Check status code

**✅ Expected:** Status 200, response has `"success": true`
**❌ If 500:** Check response body for error message

### Verify Data
- Reports should show YOUR data (not empty)
- Date range selector should work
- Filters should work

---

## Test 4: End-to-End Flow (10 min)

### Complete Offer Click Flow
1. Login → Offerwall
2. Click an offer
3. Check if redirects correctly
4. Go back → Check if click is tracked

**✅ Expected at each step:**
- Offers load ✅
- Click redirects to offer ✅
- No :5000 in URL ✅
- Click appears in reports ✅

---

## 🔍 Quick Debugging

### If Performance Reports = 500 Error:
```
1. Check: localStorage.getItem('token') in console
2. If null → Login again
3. Check Network tab → Authorization header sent?
4. Check backend logs for error details
```

### If URLs Still Have :5000:
```
1. Hard refresh: Ctrl+F5
2. Clear cache: Ctrl+Shift+Delete
3. Check backend logs: "Generated tracking URL"
4. Should NOT contain :5000
```

### If Placement Creation Fails:
```
1. F12 → Console → Look for errors
2. Backend logs → Look for "Found placement by..."
3. If "missing publisher_id" → Backend not restarted
```

---

## ✅ Success Checklist

After testing, you should have:

- [ ] ✅ Registration works
- [ ] ✅ Placement creation works
- [ ] ✅ Offer URLs don't have :5000
- [ ] ✅ Offers redirect correctly
- [ ] ✅ Performance reports load (no 500)
- [ ] ✅ Reports show your data
- [ ] ✅ Clicks are tracked

---

## 📸 What to Share

If something doesn't work, share:
1. Screenshot of the error
2. Browser console (F12 → Console)
3. Network tab (F12 → Network)
4. Backend logs

---

## 🚀 Ready?

Start with Test #3 (Performance Reports) - it's the quickest to verify!

Then do Test #2 (Tracking URLs).

Test #1 (Placements) only if you need to create new accounts/placements.

**Good luck! Let me know the results! 🎯**

