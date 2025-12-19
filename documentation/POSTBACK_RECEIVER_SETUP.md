# 📥 Postback Receiver System

## ✅ What's Been Created

### Backend (Complete):
1. **`backend/routes/postback_receiver.py`** - Postback receiver routes
   - `/postback/<unique_key>` - Receives postbacks (GET/POST)
   - `/api/admin/postback-receiver/generate-key` - Generate unique URL
   - `/api/admin/received-postbacks` - View received postbacks
   - `/api/admin/received-postbacks/<log_id>` - View postback details

2. **`backend/app.py`** - Registered postback_receiver blueprint

### Frontend (Complete):
1. **`src/services/postbackReceiverApi.ts`** - API service for postback receiver

---

## 🎯 How It Works

### Step 1: Generate Unique Postback URL for Partner

**API Call:**
```javascript
POST /api/admin/postback-receiver/generate-key
Body: { "partner_id": "pepperAds" }

Response:
{
  "unique_key": "abc123xyz456...",
  "postback_url": "https://moustacheleads-backend.onrender.com/postback/abc123xyz456"
}
```

### Step 2: Partner Uses This URL

Partner configures their system to send postbacks to:
```
https://moustacheleads-backend.onrender.com/postback/abc123xyz456?username=john&status=approved&payout=5.00&transaction_id=txn_123
```

### Step 3: System Receives and Logs

When partner sends postback:
- System receives GET/POST request
- Logs all parameters
- Stores in `received_postbacks` collection
- Returns 200 OK

### Step 4: View Logs

**API Call:**
```javascript
GET /api/admin/received-postbacks?partner_id=pepperAds

Response:
{
  "logs": [
    {
      "_id": "...",
      "unique_key": "abc123xyz456",
      "partner_id": "pepperAds",
      "partner_name": "PepperAds",
      "method": "GET",
      "query_params": {
        "username": "john",
        "status": "approved",
        "payout": "5.00",
        "transaction_id": "txn_123"
      },
      "ip_address": "1.2.3.4",
      "timestamp": "2025-10-24T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

## 🚀 Quick Test

### Test 1: Generate Key for PepperAds

```javascript
// In browser console
fetch('https://moustacheleads-backend.onrender.com/api/admin/postback-receiver/generate-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ partner_id: 'test_partner_001' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Generated URL:', data.postback_url);
  console.log('📋 Unique Key:', data.unique_key);
})
```

### Test 2: Send Test Postback

```javascript
// Copy the postback_url from above, then:
const testUrl = 'https://moustacheleads-backend.onrender.com/postback/YOUR_UNIQUE_KEY?username=testuser&status=approved&payout=10.00&transaction_id=test_123';

fetch(testUrl)
.then(r => r.json())
.then(data => console.log('✅ Postback received:', data))
```

### Test 3: View Received Postbacks

```javascript
fetch('https://moustacheleads-backend.onrender.com/api/admin/received-postbacks', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('📥 Received postbacks:', data.logs);
  console.log('📊 Total:', data.total);
})
```

---

## 📋 Database Schema

### Collection: `received_postbacks`

```javascript
{
  "_id": ObjectId,
  "unique_key": "abc123xyz456",
  "partner_id": "pepperAds",
  "partner_name": "PepperAds",
  "method": "GET",
  "query_params": {
    "username": "john",
    "status": "approved",
    "payout": "5.00",
    "transaction_id": "txn_123"
  },
  "post_data": {},
  "ip_address": "1.2.3.4",
  "user_agent": "Mozilla/5.0...",
  "timestamp": ISODate("2025-10-24T10:30:00Z"),
  "status": "received"
}
```

### Collection: `partners` (Updated)

```javascript
{
  "_id": ObjectId,
  "partner_id": "test_partner_001",
  "partner_name": "PepperAds",
  "unique_postback_key": "abc123xyz456",  // NEW
  "postback_receiver_url": "https://moustacheleads-backend.onrender.com/postback/abc123xyz456",  // NEW
  "postback_url": "https://partner.com/postback",  // For sending TO partner
  "method": "GET",
  "status": "active"
}
```

---

## 🎯 Next Steps

### 1. Deploy Backend
```bash
git add .
git commit -m "add postback receiver system"
git push origin main
```

### 2. Wait for Render to Deploy (3-5 minutes)

### 3. Test the System

**A. Generate unique key for pepperAds:**
- Use browser console test above
- Or add UI button (coming next)

**B. Send test postback:**
- Use the generated URL
- Add any parameters you want
- System will log everything

**C. View received postbacks:**
- Check API endpoint
- Or view in admin panel (UI coming next)

---

## 🔧 What's Next

### Frontend UI (To Be Added):

1. **Partners Page:**
   - "Generate Postback URL" button
   - Show generated URL
   - Copy to clipboard

2. **Received Postbacks Page:**
   - Table showing all received postbacks
   - Filter by partner
   - View details
   - Test postback sender

---

## ✅ Current Status

- ✅ Backend routes created
- ✅ API service created
- ⏳ Frontend UI (next step)
- ⏳ Deploy and test

**Ready to deploy and test!** 🚀
