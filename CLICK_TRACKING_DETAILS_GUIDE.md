# 📊 COMPREHENSIVE CLICK TRACKING - DETAILED INFORMATION GUIDE

## 🎯 WHERE TO CHECK CLICK DETAILS

You now have **7 different ways** to view detailed click information:

---

## 1️⃣ **VIEW ALL CLICKS IN SYSTEM**

### Endpoint
```
GET /api/admin/offerwall/click-history?limit=50&skip=0
```

### What You See
- All clicks from all users and publishers
- Latest clicks first
- Pagination support (limit + skip)
- Each click shows:
  - Click ID
  - User ID
  - Publisher ID
  - Offer name and ID
  - Timestamp
  - Device type
  - Country
  - IP address

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/click-history?limit=50&skip=0"
```

### Example Response
```json
{
  "success": true,
  "total": 15,
  "limit": 50,
  "skip": 0,
  "data": [
    {
      "click_id": "66b27eca-acc7-475e-8360-0653a33f514d",
      "user_id": "real_user_123",
      "publisher_id": "pub_001",
      "offer_id": "ML-00057",
      "offer_name": "Complete Survey",
      "placement_id": "4hN81lEwE7Fw1hnI",
      "timestamp": "2025-12-01T09:55:36.800000",
      "device": {
        "type": "mobile",
        "model": "iPhone 14",
        "os": "iOS",
        "browser": "Safari"
      },
      "network": {
        "ip_address": "192.168.1.100",
        "asn": "AS7922",
        "isp": "Comcast"
      },
      "geo": {
        "country": "United States",
        "city": "New York",
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "fraud_indicators": {
        "fraud_status": "clean",
        "fraud_score": 0.1
      }
    }
  ]
}
```

---

## 2️⃣ **VIEW CLICKS BY SPECIFIC USER**

### Endpoint
```
GET /api/admin/offerwall/click-history?user_id=USER_ID&limit=50
```

### What You See
- All clicks from a specific user
- Shows which offers they clicked
- Shows which publishers they interacted with
- Timestamps of each click
- Device and location info

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/click-history?user_id=real_user_123&limit=50"
```

### Use Case
- Check if a user is clicking too many offers (fraud detection)
- See user's activity pattern
- Verify user engagement

---

## 3️⃣ **VIEW CLICKS BY SPECIFIC PUBLISHER**

### Endpoint
```
GET /api/admin/offerwall/click-history?publisher_id=PUB_ID&limit=50
```

### What You See
- All clicks from a specific publisher's placements
- Which users are clicking
- Which offers are being clicked
- Click timestamps
- Fraud status of each click

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/click-history?publisher_id=pub_001&limit=50"
```

### Use Case
- Monitor publisher traffic
- Check publisher performance
- Identify suspicious patterns

---

## 4️⃣ **VIEW CLICKS BY SPECIFIC OFFER**

### Endpoint
```
GET /api/admin/offerwall/click-history?offer_id=OFFER_ID&limit=50
```

### What You See
- All clicks on a specific offer
- Which users clicked
- Which publishers drove the clicks
- Click timestamps
- Device and location diversity

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/click-history?offer_id=ML-00057&limit=50"
```

### Use Case
- Check offer performance
- See which publishers drive clicks for this offer
- Identify offer popularity

---

## 5️⃣ **VIEW USER CLICK TIMELINE**

### Endpoint
```
GET /api/admin/offerwall/user-click-timeline/USER_ID?limit=100
```

### What You See
- Chronological timeline of all clicks by a user
- Newest clicks first
- Shows:
  - Exact timestamp of each click
  - Offer clicked
  - Publisher
  - Device type
  - Location (city, country)
  - IP address
  - Fraud status

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/user-click-timeline/real_user_123?limit=100"
```

### Example Response
```json
{
  "success": true,
  "user_id": "real_user_123",
  "total_clicks": 5,
  "timeline": [
    {
      "click_id": "click_123",
      "offer_id": "ML-00057",
      "offer_name": "Complete Survey",
      "publisher_id": "pub_001",
      "timestamp": "2025-12-01T10:30:45.123456",
      "device_type": "mobile",
      "country": "United States",
      "city": "New York",
      "ip_address": "192.168.1.100",
      "fraud_status": "clean"
    },
    {
      "click_id": "click_122",
      "offer_id": "ML-00058",
      "offer_name": "Video Ad",
      "publisher_id": "pub_002",
      "timestamp": "2025-12-01T10:25:30.654321",
      "device_type": "mobile",
      "country": "United States",
      "city": "New York",
      "ip_address": "192.168.1.100",
      "fraud_status": "clean"
    }
  ]
}
```

### Use Case
- See user's activity pattern over time
- Detect suspicious behavior (too many clicks in short time)
- Verify user engagement

---

## 6️⃣ **VIEW PUBLISHER CLICK TIMELINE**

### Endpoint
```
GET /api/admin/offerwall/publisher-click-timeline/PUB_ID?limit=100
```

### What You See
- Chronological timeline of all clicks for a publisher
- Shows:
  - User who clicked
  - Offer clicked
  - Exact timestamp
  - Device type
  - Location
  - IP address
  - Fraud status

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/publisher-click-timeline/pub_001?limit=100"
```

### Use Case
- Monitor publisher traffic in real-time
- See which users are most active
- Identify traffic patterns
- Detect anomalies

---

## 7️⃣ **VIEW DETAILED CLICK INFORMATION**

### Endpoint
```
GET /api/admin/offerwall/click-details/CLICK_ID
```

### What You See
**Complete detailed information about a single click:**

#### Basic Info
- Click ID
- User ID
- Publisher ID
- Offer ID and name
- Placement ID
- Session ID
- Exact timestamp

#### Device Information
- Device type (mobile, desktop, tablet)
- Device model
- Operating system and version
- Browser and version
- Screen resolution
- Screen DPI
- Timezone
- Language

#### Device Fingerprinting
- User Agent hash
- Canvas fingerprint
- WebGL fingerprint
- Fonts fingerprint
- Plugins fingerprint

#### Network Information
- IP address (IPv4/IPv6)
- ASN (Autonomous System Number)
- ISP (Internet Service Provider)
- Organization
- Proxy detected (yes/no)
- VPN detected (yes/no)
- Tor detected (yes/no)
- Datacenter detected (yes/no)
- Connection type

#### Geo-Location
- Country and country code
- Region/State
- City
- Postal code
- Latitude and longitude
- Timezone

#### Fraud Indicators
- Fraud status (clean, suspicious, blocked)
- Fraud score (0-100)
- Duplicate detected (yes/no)
- Fast click detected (yes/no)
- Bot-like behavior (yes/no)

### Example Request
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/offerwall/click-details/66b27eca-acc7-475e-8360-0653a33f514d"
```

### Example Response
```json
{
  "success": true,
  "data": {
    "click_id": "66b27eca-acc7-475e-8360-0653a33f514d",
    "user_id": "real_user_123",
    "publisher_id": "pub_001",
    "offer_id": "ML-00057",
    "offer_name": "Complete Survey",
    "timestamp": "2025-12-01T10:30:45.123456",
    
    "device": {
      "type": "mobile",
      "model": "iPhone 14",
      "os": "iOS",
      "os_version": "17.1",
      "browser": "Safari",
      "browser_version": "17.1",
      "screen_resolution": "390x844",
      "screen_dpi": 460,
      "timezone": "America/New_York",
      "language": "en-US"
    },
    
    "fingerprint": {
      "user_agent_hash": "abc123def456",
      "canvas": "canvas_fp_001",
      "webgl": "webgl_fp_001",
      "fonts": "fonts_fp_001",
      "plugins": "plugins_fp_001"
    },
    
    "network": {
      "ip_address": "192.168.1.100",
      "ip_version": "IPv4",
      "asn": "AS7922",
      "isp": "Comcast",
      "organization": "Comcast",
      "proxy_detected": false,
      "vpn_detected": false,
      "tor_detected": false,
      "datacenter_detected": false,
      "connection_type": "mobile"
    },
    
    "geo": {
      "country": "United States",
      "country_code": "US",
      "region": "New York",
      "city": "New York",
      "postal_code": "10001",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timezone": "America/New_York"
    },
    
    "fraud_indicators": {
      "duplicate_detected": false,
      "fast_click": false,
      "vpn_proxy": false,
      "bot_like": false,
      "fraud_score": 0.1,
      "fraud_status": "clean"
    }
  }
}
```

### Use Case
- Investigate suspicious clicks
- Verify click legitimacy
- Check for fraud patterns
- Audit specific user activity

---

## 📱 QUICK REFERENCE - WHICH ENDPOINT TO USE

| Question | Endpoint |
|----------|----------|
| Show me all recent clicks | `/api/admin/offerwall/click-history` |
| Show me clicks from user X | `/api/admin/offerwall/click-history?user_id=X` |
| Show me clicks from publisher Y | `/api/admin/offerwall/click-history?publisher_id=Y` |
| Show me clicks on offer Z | `/api/admin/offerwall/click-history?offer_id=Z` |
| Show me user X's activity timeline | `/api/admin/offerwall/user-click-timeline/X` |
| Show me publisher Y's activity timeline | `/api/admin/offerwall/publisher-click-timeline/Y` |
| Show me all details about click C | `/api/admin/offerwall/click-details/C` |

---

## 🔍 INFORMATION AVAILABLE FOR EACH CLICK

✅ **User Information**
- User ID
- User's activity history
- User's fraud score

✅ **Publisher Information**
- Publisher ID
- Publisher's traffic
- Publisher's performance

✅ **Offer Information**
- Offer ID
- Offer name
- Offer category
- Offer network

✅ **Timing Information**
- Exact timestamp of click
- Date and time
- Timezone

✅ **Device Information**
- Device type (mobile, desktop, tablet)
- Device model
- Operating system
- Browser
- Screen resolution
- Device fingerprints

✅ **Network Information**
- IP address
- ASN (Autonomous System Number)
- ISP (Internet Service Provider)
- Organization
- Connection type

✅ **Security Information**
- VPN detection
- Proxy detection
- Tor detection
- Datacenter detection
- Fraud score
- Fraud status

✅ **Location Information**
- Country
- Region/State
- City
- Postal code
- Coordinates (latitude/longitude)
- Timezone

---

## 🚀 HOW TO USE IN YOUR DASHBOARD

### Option 1: Display Click History Table
```javascript
// Fetch click history
const response = await fetch(
  'http://localhost:5000/api/admin/offerwall/click-history?limit=50',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const data = await response.json();

// Display in table
data.data.forEach(click => {
  console.log(`${click.user_id} clicked ${click.offer_name} at ${click.timestamp}`);
});
```

### Option 2: Display User Timeline
```javascript
// Fetch user's click timeline
const response = await fetch(
  'http://localhost:5000/api/admin/offerwall/user-click-timeline/real_user_123',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const data = await response.json();

// Display timeline
data.timeline.forEach(click => {
  console.log(`${click.timestamp}: ${click.offer_name} from ${click.publisher_id}`);
});
```

### Option 3: Display Click Details Modal
```javascript
// Fetch detailed click info
const response = await fetch(
  'http://localhost:5000/api/admin/offerwall/click-details/CLICK_ID',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const click = await response.json();

// Display in modal
console.log(`User: ${click.data.user_id}`);
console.log(`Device: ${click.data.device.type} - ${click.data.device.os}`);
console.log(`Location: ${click.data.geo.city}, ${click.data.geo.country}`);
console.log(`IP: ${click.data.network.ip_address}`);
console.log(`Fraud Status: ${click.data.fraud_indicators.fraud_status}`);
```

---

## 📊 SUMMARY

You now have **complete visibility** into:
- ✅ **Who clicked** (user ID)
- ✅ **When they clicked** (exact timestamp)
- ✅ **What they clicked** (offer name)
- ✅ **Which publisher** (publisher ID)
- ✅ **What device** (type, model, OS, browser)
- ✅ **Where from** (country, city, coordinates)
- ✅ **Network details** (IP, ASN, ISP, VPN/Proxy detection)
- ✅ **Fraud indicators** (fraud score, suspicious patterns)

**All information is available through simple API calls!**
