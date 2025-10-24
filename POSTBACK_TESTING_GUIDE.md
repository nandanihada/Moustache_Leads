# 🧪 Postback Testing Guide

## Quick Testing Steps

### Method 1: Using Test Script (Recommended)

1. **Set up a webhook receiver:**
   - Go to https://webhook.site
   - Copy your unique URL (e.g., `https://webhook.site/abc-123`)

2. **Configure partner:**
   - Go to Admin → Partners
   - Add/Edit partner
   - Postback URL: `https://webhook.site/YOUR-ID?click_id={click_id}&payout={payout}&status={status}&offer_id={offer_id}&conversion_id={conversion_id}&transaction_id={transaction_id}`
   - Method: GET
   - Status: Active
   - Save

3. **Map offer to partner:**
   - Go to Admin → Offers
   - Edit an offer
   - In "Tracking Setup" section, select your partner
   - Save

4. **Run test script:**
   ```bash
   cd backend
   python test_postback.py
   ```

5. **Check results:**
   - Go to Admin → Postback Logs (in your app)
   - Go to webhook.site (in browser)
   - You should see the postback request with all macros replaced

---

### Method 2: Manual Database Insert

If you want to manually test without the script:

1. **Open MongoDB/Database:**
   ```python
   from database import db_instance
   from datetime import datetime
   import uuid
   
   # Get your offer
   offers = db_instance.get_collection('offers')
   offer = offers.find_one({'partner_id': {'$exists': True, '$ne': ''}})
   
   # Create test click
   clicks = db_instance.get_collection('clicks')
   click_id = str(uuid.uuid4())
   clicks.insert_one({
       'click_id': click_id,
       'offer_id': offer['offer_id'],
       'affiliate_id': 'test_user',
       'ip_address': '127.0.0.1',
       'user_agent': 'Test',
       'country': 'US',
       'sub_ids': {'sub1': '', 'sub2': '', 'sub3': '', 'sub4': '', 'sub5': ''},
       'status': 'pending',
       'clicked_at': datetime.utcnow(),
       'conversion_window_expires': datetime.utcnow(),
       'created_at': datetime.utcnow()
   })
   
   # Create test conversion
   conversions = db_instance.get_collection('conversions')
   conversion_id = str(uuid.uuid4())
   transaction_id = str(uuid.uuid4())
   
   conversion = {
       'conversion_id': conversion_id,
       'transaction_id': transaction_id,
       'click_id': click_id,
       'offer_id': offer['offer_id'],
       'partner_id': offer['partner_id'],
       'affiliate_id': 'test_user',
       'payout': 10.00,
       'currency': 'USD',
       'status': 'approved',
       'conversion_time': datetime.utcnow(),
       'ip_address': '127.0.0.1',
       'user_agent': 'Test',
       'country': 'US',
       'sub_ids': {'sub1': '', 'sub2': '', 'sub3': '', 'sub4': '', 'sub5': ''},
       'response_data': {},
       'created_at': datetime.utcnow()
   }
   
   conversions.insert_one(conversion)
   
   # Queue postback
   from services.tracking_service import TrackingService
   ts = TrackingService()
   ts._queue_postback(offer, conversion)
   
   print(f"✅ Test conversion created: {conversion_id}")
   print(f"✅ Postback queued!")
   ```

2. **Wait 30 seconds** for the postback processor to run

3. **Check Postback Logs** in Admin panel

---

### Method 3: Real User Flow (Production Testing)

1. **Get tracking link:**
   - Go to your offer in the dashboard
   - Copy the tracking link

2. **Simulate user journey:**
   - Open tracking link in browser
   - Complete the offer action
   - Submit conversion

3. **Monitor:**
   - Admin → Postback Logs
   - webhook.site

---

## 🔍 How to Verify Postback Was Sent

### Check 1: Postback Logs UI
- Go to **Admin → Postback Logs**
- Look for your conversion
- Status should be "Success" (green)
- Response code should be 200

### Check 2: Webhook Receiver
- Go to your webhook.site URL
- You should see a GET request with parameters:
  ```
  click_id=abc-123-def
  payout=10.00
  status=approved
  offer_id=OFF-001
  conversion_id=xyz-789
  transaction_id=txn-456
  ```

### Check 3: Database
```python
from database import db_instance

# Check postback logs
logs = db_instance.get_collection('postback_logs')
recent_logs = list(logs.find().sort('created_at', -1).limit(5))

for log in recent_logs:
    print(f"Partner: {log['partner_name']}")
    print(f"Status: {log['status']}")
    print(f"Response: {log['response_code']}")
    print(f"URL: {log['url']}")
    print("---")
```

---

## 🐛 Troubleshooting

### Postback Not Sending?

1. **Check partner is active:**
   - Admin → Partners
   - Status should be "Active"

2. **Check offer has partner_id:**
   ```python
   from database import db_instance
   offers = db_instance.get_collection('offers')
   offer = offers.find_one({'offer_id': 'YOUR_OFFER_ID'})
   print(f"Partner ID: {offer.get('partner_id')}")
   ```

3. **Check postback queue:**
   ```python
   from database import db_instance
   queue = db_instance.get_collection('postback_queue')
   pending = list(queue.find({'status': 'pending'}))
   print(f"Pending postbacks: {len(pending)}")
   ```

4. **Manually trigger postback processor:**
   ```python
   from services.tracking_service import TrackingService
   ts = TrackingService()
   ts.process_postback_queue()
   ```

### Postback Failing?

1. **Check URL is valid:**
   - Test in browser or Postman
   - Should return 200 OK

2. **Check macros are replaced:**
   - Look in Postback Logs
   - URL should have actual values, not `{click_id}`

3. **Retry failed postback:**
   - Admin → Postback Logs
   - Find failed postback
   - Click "Retry" button

---

## 📊 Expected Results

### Successful Postback:
```
✅ Status: Success
✅ Response Code: 200
✅ URL: https://webhook.site/abc?click_id=123&payout=10.00&...
✅ Response Body: "ok" or similar
```

### Failed Postback:
```
❌ Status: Failed
❌ Response Code: 404 or 500
❌ Error Message: "Connection timeout" or similar
❌ Attempts: 1/3 (will retry)
```

---

## 🎯 Testing Checklist

- [ ] Partner created with valid postback URL
- [ ] Partner status is "Active"
- [ ] Offer mapped to partner (partner_id set)
- [ ] Test conversion created
- [ ] Postback appears in queue
- [ ] Postback sent within 30 seconds
- [ ] Postback logged in Postback Logs
- [ ] Webhook receiver shows incoming request
- [ ] All macros replaced with actual values
- [ ] Response code is 200

---

## 🚀 Next Steps

Once testing is successful:
1. Replace webhook.site with your real partner postback URL
2. Configure all your offers with appropriate partners
3. Monitor Postback Logs regularly
4. Set up alerts for failed postbacks (future feature)

---

## 📞 Support

If postbacks are still not working:
1. Check backend logs for errors
2. Verify MongoDB connection
3. Ensure postback processor is running
4. Check network/firewall settings
