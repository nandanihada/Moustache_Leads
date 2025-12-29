# 🚀 Simple Postback Test for PepperAds + ML-00050

## ✅ Prerequisites Check:

1. **Offer ML-00050 exists and is active** ✓
2. **Partner "pepperAds" exists** ✓
3. **Offer ML-00050 is assigned to pepperAds partner** ← **VERIFY THIS!**

---

## 🎯 Quick Test Method (Browser Console)

### Step 1: Open Admin Panel
Go to: https://moustache-leads.vercel.app

### Step 2: Verify Offer-Partner Assignment

1. Go to **Admin → Offers**
2. Find offer **ML-00050**
3. Click **Edit**
4. **IMPORTANT:** Check if **Partner** field shows "pepperAds"
5. If not, select "pepperAds" from dropdown and **Save**

### Step 3: Get PepperAds Postback URL

1. Go to **Admin → Partners**
2. Find "pepperAds"
3. Note the **Postback URL**
4. If you don't have one, set it to: `https://webhook.site/YOUR-UNIQUE-ID?click_id={click_id}&payout={payout}&status={status}`

**To get webhook.site URL:**
- Go to https://webhook.site
- Copy your unique URL
- Keep the tab open

### Step 4: Create Test Conversion via Browser

Open browser console (F12) on your admin panel and run:

```javascript
// Test conversion for ML-00050 with pepperAds
fetch('https://moustacheleads-backend.onrender.com/api/analytics/track-click', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    offer_id: 'ML-00050',
    user_id: 'test_user_001',
    subid: 'test_' + Date.now(),
    ip_address: '1.2.3.4',
    user_agent: navigator.userAgent
  })
})
.then(r => r.json())
.then(clickData => {
  console.log('✅ Click created:', clickData);
  
  // Now create conversion
  return fetch('https://moustacheleads-backend.onrender.com/api/analytics/track-conversion', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      subid: clickData.subid || ('test_' + Date.now()),
      payout: 5.00,
      status: 'approved'
    })
  });
})
.then(r => r.json())
.then(convData => {
  console.log('✅ Conversion created:', convData);
  console.log('🎉 Now check webhook.site and Postback Logs!');
})
.catch(e => console.error('❌ Error:', e));
```

### Step 5: Verify Postback

**Check 3 places:**

1. **Webhook.site** (if you set it up)
   - Should show new GET request
   - With parameters: click_id, payout=5.00, status=approved

2. **Admin → Postback Logs**
   - Should show new entry
   - Partner: pepperAds
   - Offer: ML-00050
   - Status: success (200)

3. **Render Logs**
   - Go to https://dashboard.render.com
   - Select backend service
   - Look for: "Postback sent successfully"

---

## 🔧 Alternative: Direct Database Test

If the above doesn't work, we can test postback directly by inserting a conversion in MongoDB.

### Option A: Use MongoDB Compass

1. Connect to your MongoDB
2. Go to `conversions` collection
3. Insert document:
```json
{
  "offer_id": "ML-00050",
  "user_id": "test_user_001",
  "payout": 5.00,
  "status": "approved",
  "timestamp": new Date(),
  "click_id": ObjectId()
}
```

### Option B: Create Simple Test Endpoint

Add this to your backend for testing (temporary):

```python
@app.route('/test/trigger-postback', methods=['POST'])
def test_trigger_postback():
    """Test endpoint to manually trigger postback"""
    from services.tracking_service import TrackingService
    from models.offer import Offer
    
    tracking = TrackingService()
    offer_model = Offer()
    
    # Get offer
    offer = offer_model.get_offer_by_id('ML-00050')
    
    if not offer:
        return jsonify({'error': 'Offer not found'}), 404
    
    # Create fake conversion
    conversion = {
        '_id': ObjectId(),
        'offer_id': 'ML-00050',
        'payout': 5.00,
        'status': 'approved',
        'click_id': ObjectId(),
        'timestamp': datetime.utcnow()
    }
    
    # Queue postback
    tracking._queue_postback(offer, conversion)
    
    return jsonify({'message': 'Postback queued'}), 200
```

---

## 🐛 Troubleshooting

### Issue: "Offer not found"
- Check offer ID is exactly "ML-00050" (case-sensitive)
- Verify offer exists in Admin → Offers

### Issue: "Partner not assigned"
- Edit offer ML-00050
- Set Partner field to "pepperAds"
- Save

### Issue: "No postback sent"
**Check:**
1. Partner status is "Active"
2. Partner has postback URL configured
3. Offer has partner_id field set
4. Postback processor is running (check Render logs for "Tracking service started")

### Issue: "Postback failed"
**Check Postback Logs for error:**
- 404: Partner URL is wrong
- 500: Partner server error
- Timeout: Partner server too slow

---

## ✅ Success Indicators

You'll know it worked when you see:

1. **Webhook.site shows:**
   ```
   GET https://webhook.site/YOUR-ID?click_id=...&payout=5.00&status=approved
   ```

2. **Postback Logs shows:**
   ```
   Partner: pepperAds
   Offer: ML-00050
   Status: success
   HTTP Code: 200
   ```

3. **Render logs show:**
   ```
   INFO - Processing postback for offer: ML-00050
   INFO - Partner: pepperAds
   INFO - ✅ Postback sent successfully (200)
   ```

---

## 🎯 Quickest Test (30 seconds)

1. Set pepperAds postback URL to: `https://webhook.site/YOUR-ID?p={payout}`
2. Assign pepperAds to offer ML-00050
3. Run browser console code above
4. Check webhook.site for request
5. Done! ✅

---

**Need help?** Check:
- Offer has partner assigned
- Partner has postback URL
- Backend logs show "Tracking service started"
