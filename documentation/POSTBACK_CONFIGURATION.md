# 🔗 Postback Configuration Guide

## For Survey Partners & Network Providers

This document explains how to configure your postback URL to send conversion data to our system.

---

## 📡 **Postback Endpoint**

```
http://YOUR-DOMAIN.com/api/analytics/postback
```

**For Local Testing:**
```
http://localhost:5000/api/analytics/postback
```

---

## 🔑 **Required Parameters**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `click_id` | Our unique click identifier (REQUIRED) | `CLK-ABC123DEF456` |

**Alternative names accepted:**
- `click_id` ✅ (preferred)
- `clickid` ✅
- `subid` ✅
- `s1` ✅

---

## 💰 **Standard Optional Parameters**

| Parameter | Description | Example | Default |
|-----------|-------------|---------|---------|
| `status` | Conversion status | `approved`, `pending`, `rejected` | `approved` |
| `payout` | Amount earned | `90.01` | `0` |
| `transaction_id` | Your transaction ID | `TXN-12345` | Auto-generated |
| `currency` | Currency code | `USD`, `EUR` | `USD` |

---

## ✨ **Custom Survey Data (UNLIMITED!)**

**You can send ANY additional parameters!** Our system will automatically capture ALL fields you send.

**Examples:**
```
&user_age=25
&user_gender=Male
&user_country=United States
&survey_duration=120
&completion_percentage=100
&user_email=test@example.com
&phone_verified=true
&reward_type=points
&custom_field_1=value1
&custom_field_2=value2
... ANY field you want!
```

**All custom data will be:**
- ✅ Stored in database
- ✅ Visible in conversion reports
- ✅ Available for analysis
- ✅ Exportable to CSV

---

## 🎯 **Complete Example URLs**

### **Basic Conversion (Minimum)**
```
GET http://localhost:5000/api/analytics/postback?click_id=CLK-ABC123
```

### **Standard Conversion**
```
GET http://localhost:5000/api/analytics/postback
  ?click_id=CLK-ABC123
  &status=approved
  &payout=90.01
  &transaction_id=TXN-54321
```

### **With Survey Responses (FULL DATA)**
```
GET http://localhost:5000/api/analytics/postback
  ?click_id=CLK-ABC123
  &status=approved
  &payout=90.01
  &transaction_id=TXN-54321
  &survey_id=1234
  &survey_name=Health%20Survey%202024
  &user_age=28
  &user_gender=Male
  &user_country=United%20States
  &user_state=California
  &survey_duration=145
  &completion_time=2025-11-10T12:30:00Z
  &user_email=user@example.com
  &phone_verified=true
  &reward_points=500
  &quality_score=95
  &session_id=abc-def-123
  &partner_id=3120
  &offer_id=7745
```

---

## 🔐 **Security & Best Practices**

### **1. Server-to-Server (S2S)**
**✅ CORRECT:**
```
Survey Server → HTTP GET → Your Postback URL
```

**❌ WRONG:**
```
User Browser → Redirect → Your Postback URL
```

**Why?** Users should never see the postback URL!

---

### **2. URL Encoding**
Always URL-encode special characters:
```
✅ user_name=John%20Doe
❌ user_name=John Doe
```

---

### **3. HTTPS in Production**
```
✅ https://yourdomain.com/api/analytics/postback
❌ http://yourdomain.com/api/analytics/postback
```

---

### **4. Response Handling**

**Success Response:**
```
HTTP 200 OK
Body: "OK"
```

**Error Responses:**
```
HTTP 400: "ERROR: click_id required"
HTTP 404: "ERROR: Click not found"
HTTP 500: "ERROR"
```

---

## 🧪 **Testing Your Postback**

### **Step 1: Get a Click ID**
1. Go to your offers page
2. Copy a tracking link
3. Click it in browser
4. Copy the `click_id` from the URL

**Example:** `CLK-ABC123DEF456`

---

### **Step 2: Test Postback**

**Method 1: Browser**
```
http://localhost:5000/api/analytics/postback?click_id=CLK-ABC123DEF456&status=approved&payout=90.01&transaction_id=TEST-001&user_age=25&survey_id=123
```

**Method 2: cURL (Windows PowerShell)**
```powershell
curl "http://localhost:5000/api/analytics/postback?click_id=CLK-ABC123DEF456&status=approved&payout=90.01"
```

**Method 3: Python**
```python
import requests
response = requests.get('http://localhost:5000/api/analytics/postback', params={
    'click_id': 'CLK-ABC123DEF456',
    'status': 'approved',
    'payout': 90.01,
    'transaction_id': 'TEST-001',
    'user_age': 25,
    'user_gender': 'Male',
    'survey_completed': 'true'
})
print(response.text)  # Should print "OK"
```

---

### **Step 3: Verify in Reports**

1. Go to Conversion Report:
   ```
   http://localhost:8080/dashboard/conversion-report
   ```

2. You should see:
   - ✅ Conversion row
   - ✅ Transaction ID
   - ✅ Payout amount
   - ✅ Status badge
   - ✅ Click "View Details" to see ALL custom fields

---

## 📊 **What Data is Captured**

### **Automatically Captured:**
- ✅ Click ID
- ✅ Offer ID
- ✅ Publisher ID
- ✅ Country
- ✅ Device Type
- ✅ IP Address
- ✅ Sub IDs (campaign tracking)
- ✅ Timestamp

### **From Postback:**
- ✅ Status
- ✅ Payout
- ✅ Transaction ID
- ✅ Currency
- ✅ **ALL custom parameters you send**

### **Survey-Specific (if you send):**
- ✅ survey_id
- ✅ survey_name
- ✅ user responses
- ✅ completion_time
- ✅ session_id
- ✅ quality_score
- ✅ **Literally ANY field**

---

## 🎨 **Frontend Display**

### **Conversion Report Shows:**
```
┌──────────┬─────────┬──────────┬────────┬──────────────┬─────────┐
│   Time   │  Offer  │  Status  │ Payout │ Transaction  │ Details │
├──────────┼─────────┼──────────┼────────┼──────────────┼─────────┤
│ 12:30 PM │Survey X │✅Approved│ $90.01 │ TXN-12345    │  [View] │
└──────────┴─────────┴──────────┴────────┴──────────────┴─────────┘
```

**Click "View Details":**
```json
{
  "standard_fields": {
    "click_id": "CLK-ABC123",
    "status": "approved",
    "payout": 90.01,
    "transaction_id": "TXN-12345"
  },
  "survey_data": {
    "user_age": 25,
    "user_gender": "Male",
    "survey_duration": 145,
    "completion_percentage": 100,
    "quality_score": 95
  },
  "all_custom_fields": {
    "... every field you sent ..."
  }
}
```

---

## 🔧 **Common Integration Patterns**

### **Pattern 1: SuperRewards / OfferToro**
```
https://yourdomain.com/api/analytics/postback
  ?click_id={subid}
  &status={status}
  &payout={amount}
  &transaction_id={transaction_id}
  &survey_id={offer_id}
```

### **Pattern 2: CPALead / AdGate**
```
https://yourdomain.com/api/analytics/postback
  ?subid={subid}
  &status={status}
  &payout={payout}
  &txn_id={transaction_id}
```

### **Pattern 3: Custom Survey Platform**
```
https://yourdomain.com/api/analytics/postback
  ?click_id={YOUR_CLICK_ID}
  &status=approved
  &payout={CALCULATED_PAYOUT}
  &transaction_id={YOUR_TXN_ID}
  &user_age={USER_AGE}
  &user_country={USER_COUNTRY}
  &survey_score={SURVEY_SCORE}
  ... add as many fields as you want ...
```

---

## 📞 **Support & Troubleshooting**

### **Postback Not Working?**

**Check these:**
1. ✅ Backend server is running
2. ✅ Using correct postback URL
3. ✅ Including `click_id` parameter
4. ✅ Click exists in database
5. ✅ URL-encoded properly
6. ✅ Server-to-server (not browser redirect)

### **Check Backend Logs:**
```bash
# Look for these log messages:
📥 POSTBACK RECEIVED: {...}
✅ Conversion: CONV-XXX | $90.01 | 5 custom fields
```

### **Test Script:**
```bash
cd backend
python -c "
import requests
r = requests.get('http://localhost:5000/api/analytics/postback', params={
    'click_id': 'CLK-YOUR-CLICK-ID',
    'status': 'approved',
    'payout': 90.01,
    'test_field': 'test_value'
})
print(r.text)
"
```

---

## ✅ **Integration Checklist**

- [ ] Postback URL configured in partner dashboard
- [ ] click_id parameter mapped correctly
- [ ] Test conversion sent successfully
- [ ] Conversion visible in reports
- [ ] Custom data visible in "View Details"
- [ ] S2S (server-to-server) confirmed
- [ ] HTTPS enabled (production)
- [ ] Error handling configured
- [ ] Monitoring/logging enabled

---

## 🚀 **You're Ready!**

Your postback system is now configured to:
- ✅ Accept conversions from ANY partner
- ✅ Capture ALL survey responses
- ✅ Display all data in reports
- ✅ Export to CSV with all fields
- ✅ Support unlimited custom parameters

**Send your postback URL to your partners and start tracking!** 🎉
