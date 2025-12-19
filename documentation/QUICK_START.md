# 🚀 Quick Start - Test Postback in 3 Minutes

## ⚡ Super Fast Test

### Step 1: Assign Partner (30 seconds)
1. Go to https://moustache-leads.vercel.app
2. Login → Admin → Offers
3. Edit offer **ML-00050**
4. Click **"Tracking Setup"** tab
5. Select **"pepperAds"** from Partner dropdown
6. Click **Save**

### Step 2: Run Test (30 seconds)
Open browser console (F12) and paste:

```javascript
fetch('https://moustacheleads-backend.onrender.com/api/analytics/track-click', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    offer_id: 'ML-00050',
    user_id: 'test_user',
    subid: 'test_' + Date.now(),
    ip_address: '1.2.3.4'
  })
})
.then(r => r.json())
.then(click => {
  return fetch('https://moustacheleads-backend.onrender.com/api/analytics/track-conversion', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      subid: click.subid,
      payout: 5.00,
      status: 'approved'
    })
  });
})
.then(r => r.json())
.then(conv => console.log('✅ Done! Check Postback Logs'))
.catch(e => console.error('❌ Error:', e));
```

### Step 3: Verify (30 seconds)
1. Go to **Admin → Postback Logs**
2. Should see new entry with:
   - Partner: pepperAds
   - Offer: ML-00050
   - Status: success (200)

---

## ✅ That's It!

If you see the postback in logs, your system is working! 🎉

---

## 🔧 If It Doesn't Work

### Check 1: Partner Assigned?
- Edit offer ML-00050
- Verify Partner field shows "pepperAds"

### Check 2: Partner Has URL?
- Go to Admin → Partners
- Find pepperAds
- Check Postback URL is set

### Check 3: Backend Running?
- Visit: https://moustacheleads-backend.onrender.com/health
- Should return: `{"status": "healthy"}`

---

**Need more help?** See `FIXES_COMPLETED.md` for detailed guide.
