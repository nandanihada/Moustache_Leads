# Test Postback Feature - Corrected Implementation

## ✅ What Was Fixed

### 1. **Correct Partner Source**
- **Before**: Sending to upward partners in `partners` collection
- **After**: Sending to registered users/publishers (downward partners) with `postback_url` configured

### 2. **Simplified Configuration**
- **Before**: Multiple individual postback entries with separate delays
- **After**: Single configuration with:
  - Select ONE publisher
  - Enter test data once
  - Specify **how many times** to send (count)
  - Specify **interval between each** (minutes)

## 📋 New Configuration

### Form Fields:
1. **Publisher** - Select from registered users/publishers with postback URLs
2. **Username** - Test user (e.g., "Don1")
3. **Offer Name** - Test offer (e.g., "Zen Offer")
4. **Points** - Reward amount (e.g., 30)
5. **How Many Postbacks** - Count (1-100)
6. **Interval Between Each** - Minutes between postbacks

### Example:
```
Publisher: surveytitan
Username: Don1
Offer Name: Zen Offer
Points: 30
How Many: 5
Interval: 10 minutes
```

**Result**: Sends 5 postbacks to surveytitan:
- Postback #1: Immediate
- Postback #2: After 10 minutes
- Postback #3: After 20 minutes
- Postback #4: After 30 minutes
- Postback #5: After 40 minutes

**Total Time**: 40 minutes

## 🔧 Technical Changes

### Backend (`backend/routes/test_postback.py`)

**New Endpoint**:
```python
GET /api/admin/test-postback/publishers
```
Returns registered users/publishers with postback URLs configured.

**Updated Endpoint**:
```python
POST /api/admin/test-postback/send
Body: {
  "user_id": "publisher_id",
  "username": "Don1",
  "offer_name": "Zen Offer",
  "points": 30,
  "count": 5,
  "interval_minutes": 10
}
```

**Key Changes**:
- Fetches from `users` collection instead of `partners` collection
- Filters users with `postback_url` configured
- Excludes admin users
- Sends to user's `postback_url` (their downstream endpoint)
- Creates iterations based on count and interval
- Logs include iteration number

### Frontend (`src/pages/AdminTestPostback.tsx`)

**Key Changes**:
- Single form instead of dynamic array
- Publisher dropdown from `/test-postback/publishers` endpoint
- Shows publisher's postback URL
- Count and interval fields
- Timeline preview showing total time
- Results show iteration number (#1, #2, etc.)

## 📊 Database Schema Update

### test_postback_logs Collection

```javascript
{
  _id: ObjectId,
  test_id: String,           // Batch identifier
  user_id: String,           // Publisher/user ID (not partner_id)
  username: String,          // Test username
  offer_name: String,        // Test offer name
  points: Number,            // Test points
  success: Boolean,          // Success status
  error: String,             // Error message (if any)
  status_code: Number,       // HTTP status code
  response_body: String,     // Response body (truncated)
  response_time: Number,     // Response time in seconds
  iteration: Number,         // NEW: Which iteration (1, 2, 3, etc.)
  timestamp: Date            // When postback was sent
}
```

## 🎯 Use Cases

### Use Case 1: Single Publisher Test
```
Publisher: surveytitan
Username: TestUser1
Offer: Test Offer
Points: 10
Count: 1
Interval: 0
```
Sends 1 postback immediately to test basic connectivity.

### Use Case 2: Multiple Postbacks with Intervals
```
Publisher: PepperAds
Username: Don1
Offer: Zen Offer
Points: 30
Count: 5
Interval: 10
```
Sends 5 postbacks over 40 minutes to test sustained traffic handling.

### Use Case 3: Rapid Fire Test
```
Publisher: surveytitan
Username: Arjun
Offer: Rovan Offer
Points: 40
Count: 10
Interval: 1
```
Sends 10 postbacks with 1-minute intervals to test rate limiting.

## 🔍 Understanding Publishers vs Partners

### Upward Partners (partners collection)
- **Purpose**: Networks/advertisers who send conversions TO us
- **Postback URL**: We generate for THEM to call
- **Example**: OfferToro, AdGate, etc.
- **Flow**: They → Our postback receiver → We process

### Downward Partners (users collection with postback_url)
- **Purpose**: Publishers/affiliates who receive conversions FROM us
- **Postback URL**: THEY provide for US to call
- **Example**: surveytitan, PepperAds, etc.
- **Flow**: We receive conversion → We call their postback URL

**Test Postback Feature**: Tests DOWNWARD partners (publishers)

## 📝 API Examples

### Get Publishers
```bash
GET /api/admin/test-postback/publishers
Authorization: Bearer <token>

Response:
{
  "publishers": [
    {
      "user_id": "507f1f77bcf86cd799439011",
      "username": "surveytitan",
      "email": "survey@example.com",
      "postback_url": "https://surveytitan.com/postback",
      "postback_method": "GET",
      "status": "active"
    }
  ],
  "total": 1
}
```

### Send Test Postbacks
```bash
POST /api/admin/test-postback/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "username": "Don1",
  "offer_name": "Zen Offer",
  "points": 30,
  "count": 5,
  "interval_minutes": 10
}

Response:
{
  "message": "Test postbacks scheduled successfully",
  "test_id": "test_1737033827",
  "total_postbacks": 5,
  "interval_minutes": 10,
  "user_id": "507f1f77bcf86cd799439011",
  "username_target": "surveytitan"
}
```

### Get Test Logs
```bash
GET /api/admin/test-postback/logs/test_1737033827
Authorization: Bearer <token>

Response:
{
  "test_id": "test_1737033827",
  "logs": [
    {
      "_id": "...",
      "test_id": "test_1737033827",
      "user_id": "507f1f77bcf86cd799439011",
      "username": "Don1",
      "offer_name": "Zen Offer",
      "points": 30,
      "success": true,
      "status_code": 200,
      "response_time": 0.45,
      "iteration": 1,
      "timestamp": "2026-01-16T12:00:00Z"
    },
    {
      "iteration": 2,
      "timestamp": "2026-01-16T12:10:00Z",
      ...
    }
  ],
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  }
}
```

## ✅ Testing Checklist

- [ ] Can see list of publishers with postback URLs
- [ ] Can select a publisher
- [ ] Can enter test data
- [ ] Can specify count (1-100)
- [ ] Can specify interval (0+)
- [ ] Timeline preview shows correctly
- [ ] First postback sends immediately
- [ ] Subsequent postbacks respect interval
- [ ] Results show iteration numbers
- [ ] Success/failure status displays correctly
- [ ] Can view response bodies
- [ ] Auto-refresh works (3 seconds)

## 🚀 Ready to Use

The corrected implementation is complete and ready for testing!

**Access**: Admin Dashboard → Integration → Test Postback

---

**Date**: January 16, 2026
**Version**: 2.0.0 (Corrected)
