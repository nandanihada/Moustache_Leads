# Country-Based Offer Access Control - Testing Guide

## 🎯 Feature Overview

This feature implements IP-based country detection to control access to offers based on geographic location.

### Key Features Implemented:
1. ✅ **Allowed Countries** field in offer creation/editing
2. ✅ **Non-Access URL** field for restricted users
3. ✅ **IP-based country detection** using IP2Location service
4. ✅ **Country check** when opening offer
5. ✅ **Access blocking** for non-permitted countries
6. ✅ **Non-Access URL display** for mismatched countries
7. ✅ **External URL blocking** (e.g., facebook.com)
8. ✅ **Access logging** with country mismatch tracking

---

## 🧪 Testing Scenarios

### Test 1: Create Geo-Restricted Offer

**Endpoint:** `POST /api/admin/offers`

**Request Body:**
```json
{
  "campaign_id": "GEO-TEST-001",
  "name": "US-Only Test Offer",
  "description": "This offer is only available in the United States",
  "payout": 10.00,
  "network": "Test Network",
  "target_url": "https://www.google.com",
  "preview_url": "https://www.google.com",
  "allowed_countries": ["US"],
  "non_access_url": "https://www.example.com/not-available",
  "status": "active"
}
```

**Expected Result:**
- Offer created successfully with `allowed_countries: ["US"]`
- `non_access_url` set to the fallback URL

---

### Test 2: Access from Allowed Country (US)

**Endpoint:** `GET /api/click/{offer_id}`

**Test with US IP:** Use a VPN or proxy to simulate US IP, or test locally (most local IPs default to US in testing)

**Expected Result:**
- ✅ Access ALLOWED
- User redirected to `target_url` (https://www.google.com)
- Log shows: `✅ GEO-CHECK PASSED: {offer_id} - Country: US`

---

### Test 3: Access from Blocked Country (India)

**Endpoint:** `GET /api/click/{offer_id}`

**Test with Indian IP:** Access from India or use Indian VPN

**Expected Result:**
- 🚫 Access DENIED
- User redirected to `non_access_url` (https://www.example.com/not-available)
- OR shown geo-blocked error page with:
  - User's detected country (IN - India)
  - List of allowed countries (US)
  - Offer ID
- Log shows: `🚫 GEO-BLOCKED: {offer_id} - Country: IN`

---

### Test 4: View Geo-Restriction Logs

**Endpoint:** `GET /api/admin/geo-restrictions/logs`

**Query Parameters:**
- `offer_id` (optional): Filter by specific offer
- `country_code` (optional): Filter by country
- `limit` (default: 100): Number of logs
- `skip` (default: 0): Pagination offset

**Expected Result:**
```json
{
  "success": true,
  "logs": [
    {
      "offer_id": "ML-00001",
      "user_ip": "103.x.x.x",
      "user_country_code": "IN",
      "user_country_name": "India",
      "allowed_countries": ["US"],
      "non_access_url": "https://www.example.com/not-available",
      "blocked_at": "2025-12-26T09:43:15.123Z",
      "user_context": {...},
      "ip_data": {
        "city": "Mumbai",
        "region": "Maharashtra",
        "isp": "Jio",
        "vpn_detected": false,
        "proxy_detected": false,
        "fraud_score": 0
      }
    }
  ],
  "count": 1
}
```

---

### Test 5: View Geo-Restriction Statistics

**Endpoint:** `GET /api/admin/geo-restrictions/stats`

**Query Parameters:**
- `offer_id` (optional): Filter by specific offer
- `days` (default: 7): Number of days to look back

**Expected Result:**
```json
{
  "success": true,
  "stats": {
    "total_blocked": 15,
    "by_country": [
      {
        "_id": "IN",
        "count": 10,
        "country_name": "India"
      },
      {
        "_id": "AU",
        "count": 3,
        "country_name": "Australia"
      },
      {
        "_id": "DE",
        "count": 2,
        "country_name": "Germany"
      }
    ],
    "by_offer": [
      {
        "_id": "ML-00001",
        "count": 8
      },
      {
        "_id": "ML-00002",
        "count": 7
      }
    ],
    "period_days": 7,
    "generated_at": "2025-12-26T09:43:15.123Z"
  }
}
```

---

### Test 6: Test Geo-Restriction (Admin Tool)

**Endpoint:** `POST /api/admin/geo-restrictions/test`

**Request Body:**
```json
{
  "offer_id": "ML-00001",
  "ip_address": "8.8.8.8"
}
```

**Expected Result:**
```json
{
  "success": true,
  "offer_id": "ML-00001",
  "ip_address": "8.8.8.8",
  "access_check": {
    "allowed": true,
    "country_code": "US",
    "country_name": "United States",
    "reason": "Country is in allowed list",
    "redirect_url": null
  },
  "offer_settings": {
    "allowed_countries": ["US"],
    "non_access_url": "https://www.example.com/not-available"
  }
}
```

---

### Test 7: Offer with No Restrictions

**Create offer with empty `allowed_countries`:**
```json
{
  "campaign_id": "GLOBAL-001",
  "name": "Global Offer",
  "payout": 5.00,
  "network": "Test Network",
  "target_url": "https://www.google.com",
  "allowed_countries": [],
  "status": "active"
}
```

**Expected Result:**
- Access allowed from ANY country
- No geo-blocking applied
- No logs created for this offer

---

### Test 8: Update Geo-Restrictions

**Endpoint:** `PUT /api/admin/offers/{offer_id}`

**Request Body:**
```json
{
  "allowed_countries": ["US", "CA", "GB"],
  "non_access_url": "https://www.example.com/north-america-uk-only"
}
```

**Expected Result:**
- Offer updated with new country list
- Future access checks use new restrictions

---

## 🧪 Browser Testing Steps

### Step 1: Start Backend Server
```bash
cd /home/rishabhg/Downloads/lovable-ascend/backend
source venv/bin/activate  # if using venv
python app.py
```

### Step 2: Create Test Offer via API

Use Postman, curl, or browser console:

```bash
curl -X POST http://localhost:5000/api/admin/offers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "campaign_id": "GEO-TEST-001",
    "name": "US-Only Test Offer",
    "payout": 10.00,
    "network": "Test Network",
    "target_url": "https://www.google.com",
    "allowed_countries": ["US"],
    "non_access_url": "https://www.example.com/not-available",
    "status": "active"
  }'
```

### Step 3: Test Offer Access

**From Allowed Country (US):**
```
http://localhost:5000/api/click/ML-00001
```
→ Should redirect to Google

**From Blocked Country (use VPN to India/Australia):**
```
http://localhost:5000/api/click/ML-00001
```
→ Should show geo-blocked error page or redirect to non-access URL

### Step 4: View Logs

```bash
curl http://localhost:5000/api/admin/geo-restrictions/logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 5: View Statistics

```bash
curl http://localhost:5000/api/admin/geo-restrictions/stats?days=7 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Expected Log Entries

When a user from a blocked country tries to access an offer, a log entry is created:

```json
{
  "offer_id": "ML-00001",
  "user_ip": "103.x.x.x",
  "user_country_code": "IN",
  "user_country_name": "India",
  "allowed_countries": ["US"],
  "non_access_url": "https://www.example.com/not-available",
  "blocked_at": "2025-12-26T09:43:15.123Z",
  "user_context": {
    "subid": "direct",
    "source": "unknown",
    "campaign": "",
    "user_agent": "Mozilla/5.0...",
    "referrer": ""
  },
  "ip_data": {
    "city": "Mumbai",
    "region": "Maharashtra",
    "isp": "Reliance Jio",
    "vpn_detected": false,
    "proxy_detected": false,
    "fraud_score": 0
  }
}
```

---

## 🎨 Geo-Blocked Error Page

When a user from a blocked country accesses an offer without a `non_access_url`, they see:

```
🌍🚫

Not Available in Your Region

Sorry, this offer is not available in your country.

Your Location:
[India (IN)]

This offer is only available in:
[US]

Offer ID: ML-00001
```

---

## 🔍 Testing with Different IPs

### Test IPs for Different Countries:

- **US:** `8.8.8.8` (Google DNS)
- **Australia:** `1.1.1.1` (Cloudflare DNS)
- **US:** `208.67.222.222` (OpenDNS)

### Using Test Endpoint:

```bash
curl -X POST http://localhost:5000/api/admin/geo-restrictions/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "offer_id": "ML-00001",
    "ip_address": "8.8.8.8"
  }'
```

---

## ✅ Success Criteria

- [x] Offers can be created with `allowed_countries` field
- [x] Offers can be created with `non_access_url` field
- [x] IP address is correctly detected from user request
- [x] Country is correctly identified from IP using IP2Location
- [x] Access is allowed when user's country is in `allowed_countries`
- [x] Access is blocked when user's country is NOT in `allowed_countries`
- [x] User is redirected to `non_access_url` when blocked
- [x] Geo-blocked error page is shown when no `non_access_url` is set
- [x] Blocked access attempts are logged to database
- [x] Logs include IP data, country, and user context
- [x] Admin can view geo-restriction logs
- [x] Admin can view geo-restriction statistics
- [x] Admin can test geo-restrictions with specific IPs

---

## 🐛 Troubleshooting

### Issue: IP2Location not working
**Solution:** Check if `IP2LOCATION_API_KEY` is set in `.env` file

### Issue: All countries are blocked
**Solution:** Check if `allowed_countries` is an empty array (should allow all)

### Issue: Logs not appearing
**Solution:** Check MongoDB connection and `geo_access_logs` collection

### Issue: Wrong country detected
**Solution:** Verify IP2Location API is working correctly with test endpoint

---

## 📝 Notes

- IP2Location service uses caching (24 hours default) to reduce API calls
- Local IPs (127.0.0.1) may default to "Unknown" country
- VPN/Proxy detection is included in IP data
- Fraud score is calculated based on VPN/proxy/datacenter detection
