# Test Postback Feature - Final Implementation

## ✅ Complete Feature Overview

Send test postbacks to multiple registered publishers/partners with customizable intervals in seconds.

## 🎯 Key Features

### 1. Multiple Publishers
- Add/remove publisher configurations dynamically
- Each publisher can have different test data
- Minimum 1 configuration required

### 2. Flexible Configuration Per Publisher
- **Publisher**: Select from registered users with postback URLs
- **Username**: Test user (e.g., "Don1")
- **Offer Name**: Test offer (e.g., "Zen Offer")
- **Points**: Reward amount (e.g., 30)
- **Count**: How many postbacks to send (1-100)
- **Interval**: Seconds between each postback (0+)

### 3. Real-Time Results
- Auto-refresh every 3 seconds
- Shows iteration number (#1, #2, #3...)
- Success/failure status with details
- Response codes and timing
- Expandable response bodies

## 📋 Example Configuration

### Scenario: Test 2 Publishers with Different Intervals

**Publisher 1: surveytitan**
- Username: Don1
- Offer: Zen Offer
- Points: 30
- Count: 5
- Interval: 10 seconds

**Publisher 2: PepperAds**
- Username: Arjun
- Offer: Rovan Offer
- Points: 40
- Count: 3
- Interval: 20 seconds

### Result Timeline

**surveytitan** (5 postbacks, 10s interval):
- 0s: Postback #1
- 10s: Postback #2
- 20s: Postback #3
- 30s: Postback #4
- 40s: Postback #5

**PepperAds** (3 postbacks, 20s interval):
- 0s: Postback #1
- 20s: Postback #2
- 40s: Postback #3

**Total**: 8 postbacks sent to 2 publishers

## 🔧 Technical Details

### Backend API

**Endpoint**: `POST /api/admin/test-postback/send`

**Request Body**:
```json
{
  "postbacks": [
    {
      "user_id": "507f1f77bcf86cd799439011",
      "username": "Don1",
      "offer_name": "Zen Offer",
      "points": 30,
      "count": 5,
      "interval_seconds": 10
    },
    {
      "user_id": "507f1f77bcf86cd799439012",
      "username": "Arjun",
      "offer_name": "Rovan Offer",
      "points": 40,
      "count": 3,
      "interval_seconds": 20
    }
  ]
}
```

**Response**:
```json
{
  "message": "Test postbacks scheduled successfully",
  "test_id": "test_1737033827",
  "total_postbacks": 8,
  "publishers_count": 2
}
```

### Key Changes from Previous Version

1. **Interval Unit**: Changed from minutes to **seconds**
2. **Multiple Publishers**: Support for adding/removing multiple publisher configurations
3. **Array-based API**: Backend accepts array of postback configurations
4. **Timeline Preview**: Shows total time per publisher configuration

### Database Schema

```javascript
{
  _id: ObjectId,
  test_id: String,           // Batch identifier
  user_id: String,           // Publisher/user ID
  username: String,          // Test username
  offer_name: String,        // Test offer name
  points: Number,            // Test points
  success: Boolean,          // Success status
  error: String,             // Error message (if any)
  status_code: Number,       // HTTP status code
  response_body: String,     // Response body (truncated)
  response_time: Number,     // Response time in seconds
  iteration: Number,         // Iteration number (1, 2, 3...)
  timestamp: Date            // When postback was sent
}
```

## 🎨 UI Features

### Add/Remove Publishers
- Click "Add Another Publisher" to add more configurations
- Click trash icon to remove (minimum 1 required)
- Each configuration is independent

### Timeline Preview
Shows below each configuration:
```
Will send 5 postbacks to surveytitan over 40 seconds
```

### Results Display
- Grouped by test ID
- Shows iteration number and publisher name
- Color-coded: Green (success), Red (failure)
- Expandable response details

## 📊 Use Cases

### Use Case 1: Single Publisher, Multiple Postbacks
```
Publisher: surveytitan
Username: TestUser1
Offer: Test Offer
Points: 10
Count: 10
Interval: 5 seconds
```
Sends 10 postbacks over 45 seconds to test sustained traffic.

### Use Case 2: Multiple Publishers, Same Data
```
Publisher 1: surveytitan (5 postbacks, 10s interval)
Publisher 2: PepperAds (5 postbacks, 10s interval)
Publisher 3: OfferWall (5 postbacks, 10s interval)
```
Tests 3 publishers simultaneously with same configuration.

### Use Case 3: Different Intervals
```
Publisher 1: surveytitan (10 postbacks, 1s interval) - Rapid fire
Publisher 2: PepperAds (5 postbacks, 60s interval) - Slow test
```
Tests different traffic patterns.

## ✅ Validation Rules

- At least 1 publisher configuration required
- Publisher must be selected
- Username, offer name, and points are required
- Points must be > 0
- Count must be between 1 and 100
- Interval must be >= 0 seconds
- Publisher must have postback URL configured

## 🚀 Access

**Location**: Admin Dashboard → Integration → Test Postback

**URL**: `/admin/test-postback`

**Permission**: Admin only

## 📝 Testing Checklist

- [ ] Can add multiple publisher configurations
- [ ] Can remove configurations (except last one)
- [ ] Can select different publishers
- [ ] Can enter different test data per publisher
- [ ] Interval is in seconds (not minutes)
- [ ] Timeline preview shows correctly
- [ ] All postbacks send at correct intervals
- [ ] Results show iteration numbers
- [ ] Results show correct publisher names
- [ ] Success/failure status displays correctly
- [ ] Can view response bodies
- [ ] Auto-refresh works

## 🎯 Benefits

1. **Flexibility**: Test multiple publishers in one batch
2. **Precision**: Second-level interval control
3. **Efficiency**: No need to run separate tests
4. **Visibility**: Real-time results for all publishers
5. **Scalability**: Support up to 100 postbacks per publisher

---

**Status**: ✅ Complete and Ready
**Date**: January 16, 2026
**Version**: 3.0.0 (Final)
