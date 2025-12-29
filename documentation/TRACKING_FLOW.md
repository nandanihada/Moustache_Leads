# 🎯 Complete Tracking Flow

## Flow: Click → Conversion → Reports

### 1️⃣ **User Clicks Tracking Link**

**Link format:**
```
http://localhost:5000/track/ML-00057?user_id=690b2edcfc6eb6aae822ce0b&sub1=twitter
```

**Backend records (automatic):**
```json
{
  "click_id": "CLK-ABC123",
  "offer_id": "ML-00057",
  "user_id": "690b2edcfc6eb6aae822ce0b",
  "country": "US",
  "device_type": "mobile",
  "sub_id1": "twitter",
  "click_time": "2025-11-10T10:30:00Z"
}
```

**User redirected to:**
```
https://survey.com?offer_id=VBFS6&click_id=CLK-ABC123
```

---

### 2️⃣ **User Completes Offer**

**Survey sends postback:**
```
GET http://localhost:5000/api/analytics/postback?click_id=CLK-ABC123&status=approved&payout=90.01&transaction_id=TXN-123
```

**Backend records:**
```json
{
  "conversion_id": "CONV-XYZ789",
  "click_id": "CLK-ABC123",
  "transaction_id": "TXN-123",
  "status": "approved",
  "payout": 90.01,
  "conversion_time": "2025-11-10T10:35:00Z"
}
```

---

### 3️⃣ **Shows in Reports**

**Performance Report:**
- Total clicks: 1
- Total conversions: 1
- Payout: $90.01
- CR: 100%

**Conversion Report:**
- Transaction: TXN-123
- Status: ✅ Approved
- Payout: $90.01

---

## 🧪 Test It:

### **Step 1: Click Tracking Link**
```bash
# Get link from frontend, click it
http://localhost:5000/track/ML-00057?user_id=YOUR_ID&sub1=test
```

### **Step 2: Check Click Recorded**
```bash
python -c "
from database import db_instance
clicks = db_instance.get_collection('clicks')
print('Clicks:', clicks.count_documents({}))
latest = list(clicks.find().sort('click_time', -1).limit(1))
if latest:
    print('Latest click_id:', latest[0]['click_id'])
"
```

### **Step 3: Simulate Conversion**
```bash
# Replace YOUR_CLICK_ID with actual click_id from step 2
curl "http://localhost:5000/api/analytics/postback?click_id=YOUR_CLICK_ID&status=approved&payout=90.01&transaction_id=TEST-123"
```

### **Step 4: Check Reports**
```
http://localhost:8080/dashboard/performance-report
http://localhost:8080/dashboard/conversion-report
```

---

## 📊 Database Collections:

### **clicks:**
- Every click recorded here
- Fields: click_id, offer_id, user_id, country, device, sub_ids

### **conversions:**
- Every conversion recorded here
- Fields: conversion_id, click_id, status, payout, transaction_id

---

## 🔗 Survey Integration:

**Your survey needs to send postback when user completes:**

```
http://localhost:5000/api/analytics/postback
  ?click_id={CLICK_ID}
  &status=approved
  &payout=90.01
  &transaction_id={UNIQUE_TXN_ID}
```

Replace `{CLICK_ID}` with the click_id from URL parameter.
