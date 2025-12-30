# Complete End-to-End Testing Guide

## 🎯 Goal
Test the complete flow from adding an offer with macros to receiving a postback and crediting the user.

---

## 📋 Prerequisites

Before starting, make sure you have:
- [ ] Backend server running
- [ ] Frontend admin panel accessible
- [ ] At least one test user account in your system
- [ ] Access to backend logs

---

## 🧪 Test Scenario: LeadAds Integration

We'll test with a fake LeadAds offer to verify the complete flow.

---

## Step 1: Get a Test User ID

### Option A: From Database
```bash
# Connect to MongoDB
mongosh "your_mongodb_connection_string"

# Find a test user
use your_database_name
db.users.findOne({}, {_id: 1, username: 1, email: 1})
```

Copy the `_id` value (e.g., `507f1f77bcf86cd799439011`)

### Option B: From Admin Panel
1. Go to Users section in admin panel
2. Click on any user
3. Copy their User ID from the URL or user details

### Option C: Create a Test User
```python
# Run this in Python shell
from database import db_instance
from bson import ObjectId

users = db_instance.get_collection('users')
test_user = {
    '_id': ObjectId(),
    'username': 'test_macro_user',
    'email': 'test@example.com',
    'points': 0,
    'created_at': datetime.utcnow()
}
users.insert_one(test_user)
print(f"Test User ID: {test_user['_id']}")
```

**Save this User ID - you'll need it!**

---

## Step 2: Add Test Offer with Macros

### Method 1: Manual Entry (Recommended for First Test)

1. **Go to Admin Panel** → Offers → Add New Offer

2. **Fill in the form:**
   ```
   Campaign ID: TEST-LEADADS-001
   Title: Test LeadAds Survey with Macros
   Target URL: https://httpbin.org/get?offer_id=75999&aff_id=10843&aff_sub={user_id}&click={click_id}
   Country: US
   Payout: $10.00
   Description: Test offer to verify macro replacement
   Platform: LeadAds
   Status: Active
   ```

   **Important:** We're using `httpbin.org/get` which will echo back all parameters so we can verify the macro replacement worked!

3. **Save the offer**

### Method 2: Bulk Upload

1. **Create a test CSV file** (`test_macro_offer.csv`):
   ```csv
   campaign_id,title,url,country,payout,description,platform
   TEST-LEADADS-001,Test LeadAds Survey,https://httpbin.org/get?offer_id=75999&aff_id=10843&aff_sub={user_id}&click={click_id},US,$10.00,Test offer with macros,LeadAds
   ```

2. **Upload via Admin Panel** → Bulk Upload

3. **Verify upload succeeded**

---

## Step 3: Verify Offer Was Created

### Check in Admin Panel
1. Go to Offers list
2. Find "TEST-LEADADS-001"
3. Click to view details
4. **Verify Target URL still contains `{user_id}` and `{click_id}`** (not replaced yet!)

### Check in Database
```python
from database import db_instance

offers = db_instance.get_collection('offers')
test_offer = offers.find_one({'campaign_id': 'TEST-LEADADS-001'})

print(f"Offer ID: {test_offer['offer_id']}")
print(f"Target URL: {test_offer['target_url']}")
print(f"Has macros: {{user_id}} in URL = {'{user_id}' in test_offer['target_url']}")
```

**Expected:** Target URL should contain `{user_id}` and `{click_id}`

---

## Step 4: Simulate User Click

Now we'll simulate a user clicking the offer.

### Get the Tracking URL

The tracking URL format is:
```
http://localhost:5000/track/TEST-LEADADS-001?user_id=YOUR_TEST_USER_ID
```

Replace `YOUR_TEST_USER_ID` with the user ID from Step 1.

### Option A: Click in Browser

1. **Start backend server** (if not running):
   ```bash
   cd backend
   python app.py
   ```

2. **Open browser** and go to:
   ```
   http://localhost:5000/track/TEST-LEADADS-001?user_id=507f1f77bcf86cd799439011
   ```
   (Replace with your actual user ID)

3. **You should be redirected** to httpbin.org

4. **Check the httpbin response** - it will show all the parameters:
   ```json
   {
     "args": {
       "offer_id": "75999",
       "aff_id": "10843",
       "aff_sub": "507f1f77bcf86cd799439011",  ← YOUR USER ID!
       "click": "CLK-ABC123"  ← GENERATED CLICK ID!
     },
     "url": "https://httpbin.org/get?..."
   }
   ```

   **✅ SUCCESS if you see your actual user_id instead of `{user_id}`!**

### Option B: Use curl

```bash
curl -L "http://localhost:5000/track/TEST-LEADADS-001?user_id=507f1f77bcf86cd799439011"
```

Look for your user_id in the response.

### Option C: Use Python

```python
import requests

user_id = "507f1f77bcf86cd799439011"  # Your test user ID
tracking_url = f"http://localhost:5000/track/TEST-LEADADS-001?user_id={user_id}"

response = requests.get(tracking_url, allow_redirects=True)
print(f"Final URL: {response.url}")
print(f"Response: {response.text}")

# Check if user_id is in the final URL
if user_id in response.url:
    print("✅ SUCCESS: Macro replacement worked!")
else:
    print("❌ FAILED: Macro not replaced")
```

---

## Step 5: Check Backend Logs

### View Logs
```bash
# If using file logging
tail -f backend/logs/app.log | grep -E "Macro|track|CLK"

# Or check console output
```

### What to Look For

You should see logs like:
```
📊 Tracking click: offer=TEST-LEADADS-001, user=507f1f77bcf86cd799439011
🔄 Replacing macros in URL for offer TEST-LEADADS-001
   {user_id} → 507f1f77bcf86cd799439011
   {click_id} → CLK-ABC123
✅ Macros replaced. Final URL: https://httpbin.org/get?offer_id=75999&aff_id=10843&aff_sub=507f1f77bcf86cd799439011&click=CLK-ABC123
✅ Click tracked: CLK-ABC123 for offer TEST-LEADADS-001 by user 507f1f77bcf86cd799439011
↗️  Redirecting to: https://httpbin.org/get?...
```

**✅ If you see these logs, macro replacement is working!**

---

## Step 6: Verify Click Was Recorded

### Check Database
```python
from database import db_instance

clicks = db_instance.get_collection('clicks')

# Find the click
recent_click = clicks.find_one(
    {'offer_id': 'TEST-LEADADS-001'},
    sort=[('timestamp', -1)]
)

print(f"Click ID: {recent_click['click_id']}")
print(f"User ID: {recent_click['user_id']}")
print(f"Offer ID: {recent_click['offer_id']}")
print(f"Timestamp: {recent_click['timestamp']}")
```

**Expected:** You should see a click record with your test user's ID.

---

## Step 7: Simulate Partner Postback

Now we'll simulate LeadAds sending a postback to credit the conversion.

### Get Your Postback Key

From your postback URL:
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY
                                                      ↑
                                                This is your key
```

### Send Test Postback

#### Option A: Using curl
```bash
# Replace with your actual values
POSTBACK_KEY="-3YJWcgL-TnlNnscehd5j23IbVZRJHUY"
USER_ID="507f1f77bcf86cd799439011"
CLICK_ID="CLK-ABC123"  # From Step 5 logs

curl "http://localhost:5000/postback/${POSTBACK_KEY}?aff_sub=${USER_ID}&status=approved&payout=10.00&transaction_id=TEST-TXN-001"
```

#### Option B: Using Python
```python
import requests

postback_key = "-3YJWcgL-TnlNnscehd5j23IbVZRJHUY"
user_id = "507f1f77bcf86cd799439011"

postback_url = f"http://localhost:5000/postback/{postback_key}"
params = {
    'aff_sub': user_id,
    'status': 'approved',
    'payout': '10.00',
    'transaction_id': 'TEST-TXN-001'
}

response = requests.get(postback_url, params=params)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

#### Option C: Using Browser
Open this URL in your browser (replace values):
```
http://localhost:5000/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00&transaction_id=TEST-TXN-001
```

### Expected Response
```json
{
  "status": "success",
  "message": "Postback received and distributed",
  "log_id": "..."
}
```

---

## Step 8: Verify Conversion Was Credited

### Check User Points
```python
from database import db_instance
from bson import ObjectId

users = db_instance.get_collection('users')
user_id = "507f1f77bcf86cd799439011"

user = users.find_one({'_id': ObjectId(user_id)})
print(f"User: {user['username']}")
print(f"Points: {user.get('points', 0)}")
print(f"Expected: 10 points (from $10 payout)")
```

### Check Conversions Collection
```python
from database import db_instance

conversions = db_instance.get_collection('conversions')

conversion = conversions.find_one(
    {'affiliate_id': user_id, 'offer_id': 'TEST-LEADADS-001'},
    sort=[('created_at', -1)]
)

if conversion:
    print(f"✅ Conversion found!")
    print(f"   Conversion ID: {conversion['conversion_id']}")
    print(f"   User ID: {conversion['affiliate_id']}")
    print(f"   Payout: ${conversion['payout']}")
    print(f"   Status: {conversion['status']}")
else:
    print("❌ No conversion found")
```

### Check Postback Logs
```python
from database import db_instance

postback_logs = db_instance.get_collection('received_postbacks')

recent_postback = postback_logs.find_one(
    sort=[('created_at', -1)]
)

print(f"Postback received at: {recent_postback['created_at']}")
print(f"Parameters: {recent_postback['parameters']}")
print(f"User ID from aff_sub: {recent_postback['parameters'].get('aff_sub')}")
```

---

## ✅ Success Criteria

Your test is successful if:

1. ✅ **Offer created** with `{user_id}` in URL
2. ✅ **Click tracked** - logs show macro replacement
3. ✅ **Final URL** contains actual user_id (not `{user_id}`)
4. ✅ **Click record** saved in database
5. ✅ **Postback received** with correct user_id
6. ✅ **Conversion created** in database
7. ✅ **User points updated** (+10 points)

---

## 🐛 Troubleshooting

### Issue: Macros Not Replaced

**Check:**
```bash
# Verify macro service is imported
grep "macro_service" backend/routes/simple_tracking.py

# Check logs for errors
tail -f backend/logs/app.log | grep -i error
```

**Solution:** Restart backend server

### Issue: Postback Not Working

**Check:**
```python
# Verify postback route exists
from database import db_instance
postbacks = db_instance.get_collection('received_postbacks')
print(f"Total postbacks: {postbacks.count_documents({})}")
```

**Solution:** Check postback key is correct

### Issue: User Not Credited

**Check:**
```python
# Check if conversion was created
from database import db_instance
conversions = db_instance.get_collection('conversions')
recent = conversions.find_one(sort=[('created_at', -1)])
print(f"Latest conversion: {recent}")
```

**Solution:** Check postback parameters match expected format

---

## 🎉 Next Steps After Successful Test

Once your test passes:

1. ✅ **Add real LeadAds offer** with their actual URL
2. ✅ **Upload 100 offers** via bulk CSV
3. ✅ **Give LeadAds your postback URL**
4. ✅ **Go live!**

---

## 📊 Quick Test Script

Save this as `test_complete_flow.py`:

```python
#!/usr/bin/env python3
"""
Complete end-to-end test of macro tracking system
"""

import requests
import time
from database import db_instance
from bson import ObjectId

def test_complete_flow():
    print("=" * 60)
    print("COMPLETE MACRO TRACKING TEST")
    print("=" * 60)
    
    # Step 1: Get test user
    users = db_instance.get_collection('users')
    test_user = users.find_one()
    user_id = str(test_user['_id'])
    print(f"\n✅ Step 1: Test User ID: {user_id}")
    
    # Step 2: Check offer exists
    offers = db_instance.get_collection('offers')
    test_offer = offers.find_one({'campaign_id': 'TEST-LEADADS-001'})
    if not test_offer:
        print("❌ Test offer not found! Create it first.")
        return
    print(f"✅ Step 2: Test offer found: {test_offer['offer_id']}")
    print(f"   Target URL: {test_offer['target_url']}")
    print(f"   Has macros: {'{user_id}' in test_offer['target_url']}")
    
    # Step 3: Simulate click
    tracking_url = f"http://localhost:5000/track/TEST-LEADADS-001?user_id={user_id}"
    print(f"\n✅ Step 3: Simulating click...")
    print(f"   URL: {tracking_url}")
    
    try:
        response = requests.get(tracking_url, allow_redirects=True, timeout=5)
        print(f"   Final URL: {response.url}")
        
        if user_id in response.url:
            print("   ✅ Macro replacement worked!")
        else:
            print("   ❌ Macro not replaced!")
            return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 4: Check click was recorded
    time.sleep(1)
    clicks = db_instance.get_collection('clicks')
    recent_click = clicks.find_one(
        {'offer_id': 'TEST-LEADADS-001', 'user_id': user_id},
        sort=[('timestamp', -1)]
    )
    
    if recent_click:
        print(f"\n✅ Step 4: Click recorded")
        print(f"   Click ID: {recent_click['click_id']}")
        click_id = recent_click['click_id']
    else:
        print("❌ Click not recorded!")
        return
    
    # Step 5: Simulate postback
    postback_key = "-3YJWcgL-TnlNnscehd5j23IbVZRJHUY"  # Replace with your key
    postback_url = f"http://localhost:5000/postback/{postback_key}"
    params = {
        'aff_sub': user_id,
        'status': 'approved',
        'payout': '10.00',
        'transaction_id': f'TEST-TXN-{int(time.time())}'
    }
    
    print(f"\n✅ Step 5: Sending postback...")
    try:
        response = requests.get(postback_url, params=params, timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 6: Check conversion
    time.sleep(1)
    conversions = db_instance.get_collection('conversions')
    conversion = conversions.find_one(
        {'affiliate_id': user_id, 'offer_id': 'TEST-LEADADS-001'},
        sort=[('created_at', -1)]
    )
    
    if conversion:
        print(f"\n✅ Step 6: Conversion created")
        print(f"   Conversion ID: {conversion['conversion_id']}")
        print(f"   Payout: ${conversion['payout']}")
        print(f"   Status: {conversion['status']}")
    else:
        print("❌ Conversion not created!")
        return
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)

if __name__ == '__main__':
    test_complete_flow()
```

Run it:
```bash
cd backend
python test_complete_flow.py
```

---

**This guide covers the complete testing scenario from start to finish!** 🎉

Follow these steps and you'll verify that the entire macro tracking system works correctly.