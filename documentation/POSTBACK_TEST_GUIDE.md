# 🧪 Postback System Testing Guide

## Overview
Test the complete postback flow from conversion to partner notification.

---

## 🎯 Test Flow:

```
User Clicks Offer → Conversion Happens → System Sends Postback → Partner Receives
```

---

## 📋 Prerequisites:

1. ✅ Backend deployed: https://moustacheleads-backend.onrender.com
2. ✅ Frontend deployed: https://moustache-leads.vercel.app
3. ✅ MongoDB connected
4. ✅ Postback processor running

---

## 🔧 Step 1: Set Up Webhook Receiver

### Option A: Use Webhook.site (Easiest)

1. Go to https://webhook.site
2. You'll get a unique URL like: `https://webhook.site/abc-123-def`
3. **Copy this URL** - this is your test partner postback URL

### Option B: Use RequestBin

1. Go to https://requestbin.com
2. Create a new bin
3. Copy the URL

---

## 🎯 Step 2: Create Test Partner

1. **Login to your admin panel:**
   ```
   https://moustache-leads.vercel.app
   ```

2. **Go to Admin → Partners**

3. **Click "Add Partner"**

4. **Fill in details:**
   ```
   Partner Name: Test Partner
   Partner ID: test_partner_001
   Postback URL: https://webhook.site/YOUR-UNIQUE-ID?click_id={click_id}&payout={payout}&status={status}&offer_id={offer_id}&conversion_id={conversion_id}&transaction_id={transaction_id}
   Method: GET
   Status: Active
   Description: Test partner for postback verification
   ```

5. **Click Save**

---

## 🎯 Step 3: Create Test Offer with Partner

1. **Go to Admin → Offers**

2. **Click "Add Offer" or Edit existing offer**

3. **Fill in offer details:**
   ```
   Offer Name: Test Postback Offer
   Offer ID: test_offer_001
   Status: Active
   Payout: 5.00
   Partner: Select "Test Partner" (the one you just created)
   ```

4. **Important:** Make sure **Partner** field is set to your test partner

5. **Click Save**

---

## 🎯 Step 4: Simulate a Conversion

### Option A: Via Backend API (Recommended)

Open PowerShell and run:

```powershell
# Create a test conversion
$body = @{
    click_id = "test_click_" + (Get-Date -Format "yyyyMMddHHmmss")
    offer_id = "test_offer_001"
    payout = 5.00
    status = "approved"
    conversion_id = "conv_" + (Get-Date -Format "yyyyMMddHHmmss")
    transaction_id = "txn_" + (Get-Date -Format "yyyyMMddHHmmss")
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Invoke-WebRequest -Uri "https://moustacheleads-backend.onrender.com/api/track/conversion" -Method POST -Body $body -Headers $headers
```

### Option B: Via Browser Console

Open browser console on your frontend and run:

```javascript
fetch('https://moustacheleads-backend.onrender.com/api/track/conversion', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    click_id: 'test_click_' + Date.now(),
    offer_id: 'test_offer_001',
    payout: 5.00,
    status: 'approved',
    conversion_id: 'conv_' + Date.now(),
    transaction_id: 'txn_' + Date.now()
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### Option C: Create Test Script

Create a file `test_postback_production.py`:

```python
import requests
import time

# Production backend URL
API_URL = "https://moustacheleads-backend.onrender.com"

def test_postback():
    # Create conversion data
    conversion_data = {
        "click_id": f"test_click_{int(time.time())}",
        "offer_id": "test_offer_001",
        "payout": 5.00,
        "status": "approved",
        "conversion_id": f"conv_{int(time.time())}",
        "transaction_id": f"txn_{int(time.time())}"
    }
    
    print(f"📤 Sending conversion: {conversion_data}")
    
    # Send conversion
    response = requests.post(
        f"{API_URL}/api/track/conversion",
        json=conversion_data
    )
    
    print(f"✅ Response: {response.status_code}")
    print(f"📄 Data: {response.json()}")
    
    return response.json()

if __name__ == "__main__":
    test_postback()
```

Run it:
```bash
python test_postback_production.py
```

---

## 🎯 Step 5: Verify Postback Sent

### Check 1: Webhook.site

1. Go back to your webhook.site URL
2. You should see a **new request** appear
3. Check the request details:
   ```
   URL: https://webhook.site/YOUR-ID?click_id=test_click_123&payout=5.00&status=approved...
   Method: GET
   Status: 200 OK
   ```

### Check 2: Admin Panel - Postback Logs

1. Go to **Admin → Postback Logs** in your frontend
2. You should see a new log entry:
   ```
   Partner: Test Partner
   Offer ID: test_offer_001
   Status: success (200)
   Response Time: ~500ms
   ```

### Check 3: Backend Logs (Render Dashboard)

1. Go to https://dashboard.render.com
2. Select your backend service
3. Click **"Logs"** tab
4. Look for:
   ```
   ✅ Postback sent successfully
   Partner: test_partner_001
   Response: 200
   ```

---

## ✅ Expected Results:

### 1. Webhook.site Shows:
```
GET https://webhook.site/YOUR-ID
Query Parameters:
  click_id: test_click_1234567890
  payout: 5.00
  status: approved
  offer_id: test_offer_001
  conversion_id: conv_1234567890
  transaction_id: txn_1234567890
```

### 2. Postback Logs Show:
```
Log ID: log_xxx
Partner: Test Partner
Offer: test_offer_001
Status: success
HTTP Code: 200
Response Time: 450ms
Timestamp: 2025-10-24 15:30:45
```

### 3. Backend Logs Show:
```
INFO - Processing postback for conversion: conv_xxx
INFO - Partner: test_partner_001
INFO - Postback URL: https://webhook.site/...
INFO - ✅ Postback sent successfully (200)
```

---

## 🐛 Troubleshooting:

### Issue 1: No Postback Received

**Check:**
1. Partner status is "Active"
2. Offer has partner_id assigned
3. Postback processor is running (check backend logs)
4. Webhook URL is correct

**Fix:**
```python
# Check if postback processor is running
# Look for this in backend logs:
"✅ Tracking service started - Postbacks will be processed"
```

### Issue 2: Postback Failed (Error in Logs)

**Common Errors:**

**A. "Partner not found"**
- Offer doesn't have partner_id
- Solution: Edit offer and assign partner

**B. "Invalid postback URL"**
- URL format is wrong
- Solution: Check URL has proper placeholders

**C. "Connection timeout"**
- Partner's server is down
- Solution: Use webhook.site for testing

### Issue 3: Postback Sent but Partner Didn't Receive

**Check:**
1. Webhook.site URL is correct
2. No typos in postback URL
3. Placeholders are correct: `{click_id}` not `{{click_id}}`

---

## 📊 Test Different Scenarios:

### Test 1: Approved Conversion
```json
{
  "status": "approved",
  "payout": 5.00
}
```
Expected: Postback sent with status=approved

### Test 2: Rejected Conversion
```json
{
  "status": "rejected",
  "payout": 0.00
}
```
Expected: Postback sent with status=rejected

### Test 3: Pending Conversion
```json
{
  "status": "pending",
  "payout": 5.00
}
```
Expected: Postback sent with status=pending

### Test 4: Multiple Conversions
Send 5 conversions in a row
Expected: All 5 postbacks received

---

## 🔍 Advanced Testing:

### Test Postback Retry Logic

1. **Use a failing URL:**
   ```
   https://httpstat.us/500
   ```

2. **Create conversion**

3. **Check logs:**
   - Should show retry attempts
   - Should eventually mark as failed

### Test Postback Variables

Create partner with all variables:
```
https://webhook.site/YOUR-ID?
  click_id={click_id}&
  offer_id={offer_id}&
  payout={payout}&
  status={status}&
  conversion_id={conversion_id}&
  transaction_id={transaction_id}&
  timestamp={timestamp}&
  ip={ip}&
  user_agent={user_agent}
```

Verify all variables are replaced correctly.

---

## 📈 Performance Testing:

### Test 1: Single Postback Latency
- Expected: < 1 second

### Test 2: Multiple Postbacks
- Send 10 conversions
- Expected: All processed within 30 seconds

### Test 3: Background Processing
- Postbacks should not block API responses
- Conversion API should return immediately

---

## ✅ Success Criteria:

- [x] Partner created successfully
- [x] Offer assigned to partner
- [x] Conversion created
- [x] Postback sent to webhook.site
- [x] Postback log created in database
- [x] All variables replaced correctly
- [x] Response time < 1 second
- [x] Status code 200 received

---

## 🎉 Next Steps After Testing:

1. **Test with Real Partner:**
   - Get their actual postback URL
   - Test with their system
   - Verify they receive data correctly

2. **Monitor Production:**
   - Check Postback Logs daily
   - Monitor success rate
   - Set up alerts for failures

3. **Optimize:**
   - Add retry logic if needed
   - Implement rate limiting
   - Add postback queuing for high volume

---

## 📞 Quick Test Command:

**One-liner to test postback:**

```powershell
# PowerShell
Invoke-WebRequest -Uri "https://moustacheleads-backend.onrender.com/api/track/conversion" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"click_id":"test_001","offer_id":"test_offer_001","payout":5.00,"status":"approved","conversion_id":"conv_001","transaction_id":"txn_001"}'
```

Then check webhook.site for the postback!

---

**Ready to test? Follow the steps above!** 🚀
