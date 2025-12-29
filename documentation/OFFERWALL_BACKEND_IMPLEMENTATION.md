# 🔧 OFFERWALL BACKEND - IMPLEMENTATION PLAN

**Status**: ✅ READY FOR IMPLEMENTATION
**Date**: Nov 26, 2025
**Priority**: HIGH

---

## 🎯 REQUIREMENTS

### 1. **Real Data for Offer Cards**
Currently: Mock/dummy data
Needed: Real offers from database

### 2. **Activity Tracking on Completion**
Currently: Click tracking only
Needed: When offer is completed → User gets activity record

### 3. **User Stats & Activity Display**
Currently: Basic stats
Needed: Real-time activity with completion details

---

## 📊 CURRENT BACKEND STRUCTURE

### Existing Collections
- `placements` - Publisher placements
- `offers` - Admin offers
- `offerwall_sessions` - Session tracking
- `offerwall_clicks` - Click tracking
- `offerwall_conversions` - Conversion tracking
- `offerwall_impressions` - Impression tracking

### Existing Endpoints
```
GET  /api/offerwall/offers              - Get offers (mock data)
POST /api/offerwall/track/click         - Track click
POST /api/offerwall/track/conversion    - Track conversion
GET  /api/offerwall/stats/<placement>   - Get stats
POST /api/offerwall/track/impression    - Track impression
```

---

## 🔨 IMPLEMENTATION TASKS

### Task 1: Fetch Real Offers from Database

**Current Code** (lines 1876-1961):
```python
@offerwall_bp.route('/api/offerwall/offers')
def get_offers():
    # Currently returns mock offers from OffersService
```

**What Needs to Change**:
```python
# Instead of mock data, fetch from 'offers' collection:
- Query offers collection with filters
- Apply placement-specific rules
- Return real offer data with:
  * offer_id
  * title
  * description
  * reward_amount
  * category
  * image_url
  * click_url
  * requirements
  * estimated_time
```

**Database Query**:
```python
offers_col = db_instance.get_collection('offers')
offers = offers_col.find({
    'status': 'active',
    'category': category if category else {'$exists': True}
}).limit(limit)
```

---

### Task 2: Track Offer Completion & Create Activity

**Current Code** (lines 2224-2265):
```python
@offerwall_bp.route('/api/offerwall/track/conversion', methods=['POST'])
def track_offerwall_conversion():
    # Records conversion but doesn't create activity
```

**What Needs to Change**:
```python
# When conversion is tracked:
1. Record conversion (existing)
2. Create activity record with:
   - offer_id
   - user_id
   - placement_id
   - completion_time (datetime)
   - reward_amount
   - status: 'completed'
   - activity_type: 'offer_completed'
```

**New Collection**: `offerwall_activities`
```python
{
    'activity_id': str,
    'user_id': str,
    'placement_id': str,
    'offer_id': str,
    'offer_title': str,
    'reward_amount': float,
    'activity_type': 'offer_completed',
    'status': 'completed',
    'completed_at': datetime,
    'created_at': datetime
}
```

---

### Task 3: Get User Activity

**New Endpoint**:
```python
@offerwall_bp.route('/api/offerwall/user/activity', methods=['GET'])
def get_user_activity():
    # Parameters: user_id, placement_id, limit
    # Returns: List of completed offers with details
```

**Response Format**:
```json
{
    "activities": [
        {
            "activity_id": "...",
            "offer_id": "...",
            "offer_title": "Survey Title",
            "reward_amount": 100,
            "completed_at": "2025-11-26T10:30:00Z",
            "status": "completed"
        }
    ],
    "total_completed": 5,
    "total_earned": 500
}
```

---

### Task 4: Get User Stats

**Existing Endpoint** (needs enhancement):
```python
@offerwall_bp.route('/api/offerwall/stats/<placement_id>')
def get_placement_stats(placement_id):
    # Should return real stats from activities
```

**Enhanced Response**:
```json
{
    "total_earned": 500,
    "today_earned": 100,
    "offers_clicked": 10,
    "offers_completed": 5,
    "pending_offers": 2,
    "completed_offers": [
        {
            "offer_id": "...",
            "title": "...",
            "reward": 100,
            "completed_at": "..."
        }
    ]
}
```

---

## 🔄 IMPLEMENTATION FLOW

### When User Opens Offerwall
```
1. GET /api/offerwall/offers
   ↓
   Fetch from 'offers' collection (real data)
   ↓
   Return offers with real data
```

### When User Clicks Offer
```
1. POST /api/offerwall/track/click
   ↓
   Record click in 'offerwall_clicks'
   ↓
   Return redirect URL
```

### When Offer is Completed
```
1. POST /api/offerwall/track/conversion
   ↓
   Record conversion in 'offerwall_conversions'
   ↓
   Create activity in 'offerwall_activities'
   ↓
   Return success
```

### When User Views Activity
```
1. GET /api/offerwall/user/activity?user_id=...&placement_id=...
   ↓
   Query 'offerwall_activities' collection
   ↓
   Return completed offers list
```

### When User Views Stats
```
1. GET /api/offerwall/stats/<placement_id>?user_id=...
   ↓
   Query 'offerwall_activities' for user
   ↓
   Calculate totals and return stats
```

---

## 📝 CODE CHANGES NEEDED

### File: `backend/routes/offerwall.py`

#### Change 1: Update get_offers() (lines 1876-1961)
```python
# BEFORE: Uses OffersService with mock data
offers_service = OffersService()
offers_data = offers_service.get_offers(...)

# AFTER: Query real offers from database
offers_col = db_instance.get_collection('offers')
offers = list(offers_col.find({
    'status': 'active',
    'category': category if category else {'$exists': True}
}).limit(limit))
```

#### Change 2: Update track_offerwall_conversion() (lines 2224-2265)
```python
# AFTER conversion is tracked, also create activity:
activity_col = db_instance.get_collection('offerwall_activities')
activity_col.insert_one({
    'activity_id': str(uuid.uuid4()),
    'user_id': data['user_id'],
    'placement_id': data['placement_id'],
    'offer_id': data['offer_id'],
    'reward_amount': float(data['payout_amount']),
    'activity_type': 'offer_completed',
    'status': 'completed',
    'completed_at': datetime.utcnow(),
    'created_at': datetime.utcnow()
})
```

#### Change 3: Add new endpoint get_user_activity()
```python
@offerwall_bp.route('/api/offerwall/user/activity', methods=['GET'])
def get_user_activity():
    user_id = request.args.get('user_id')
    placement_id = request.args.get('placement_id')
    limit = int(request.args.get('limit', 50))
    
    activity_col = db_instance.get_collection('offerwall_activities')
    activities = list(activity_col.find({
        'user_id': user_id,
        'placement_id': placement_id,
        'status': 'completed'
    }).sort('completed_at', -1).limit(limit))
    
    return jsonify({
        'activities': activities,
        'total_completed': len(activities)
    }), 200
```

#### Change 4: Update get_placement_stats() (lines 2077-2092)
```python
# Query activities instead of generic stats
activity_col = db_instance.get_collection('offerwall_activities')
activities = list(activity_col.find({
    'user_id': user_id,
    'placement_id': placement_id
}))

total_earned = sum(a['reward_amount'] for a in activities)
today_activities = [a for a in activities if is_today(a['completed_at'])]
today_earned = sum(a['reward_amount'] for a in today_activities)

return jsonify({
    'total_earned': total_earned,
    'today_earned': today_earned,
    'offers_completed': len(activities),
    'completed_offers': activities
}), 200
```

---

## 🗄️ NEW COLLECTION SCHEMA

### `offerwall_activities`
```javascript
{
    "_id": ObjectId,
    "activity_id": "uuid",
    "user_id": "string",
    "placement_id": "string",
    "offer_id": "string",
    "offer_title": "string",
    "reward_amount": number,
    "activity_type": "offer_completed",
    "status": "completed",
    "completed_at": datetime,
    "created_at": datetime,
    "updated_at": datetime
}
```

### Indexes Needed
```python
# For fast queries
db.offerwall_activities.create_index([("user_id", 1), ("placement_id", 1)])
db.offerwall_activities.create_index([("completed_at", -1)])
db.offerwall_activities.create_index([("offer_id", 1)])
```

---

## 🧪 TESTING ENDPOINTS

### Test 1: Get Real Offers
```bash
curl "http://localhost:5000/api/offerwall/offers?placement_id=test&user_id=user1&limit=10"
```

Expected: Real offers from database

### Test 2: Track Completion
```bash
curl -X POST "http://localhost:5000/api/offerwall/track/conversion" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "...",
    "click_id": "...",
    "offer_id": "SURVEY_001",
    "placement_id": "test",
    "user_id": "user1",
    "payout_amount": 100
  }'
```

Expected: Conversion recorded + Activity created

### Test 3: Get User Activity
```bash
curl "http://localhost:5000/api/offerwall/user/activity?user_id=user1&placement_id=test"
```

Expected: List of completed offers

### Test 4: Get User Stats
```bash
curl "http://localhost:5000/api/offerwall/stats/test?user_id=user1"
```

Expected: Real stats with completed offers

---

## ✅ VERIFICATION CHECKLIST

- [ ] Offers fetched from database (not mock)
- [ ] Real offer data displayed on cards
- [ ] Conversion tracking creates activity
- [ ] Activity endpoint returns completed offers
- [ ] Stats endpoint returns real data
- [ ] User sees completed offers in activity
- [ ] Reward amounts are correct
- [ ] Timestamps are accurate
- [ ] No errors in console
- [ ] Database queries are efficient

---

## 📊 SUMMARY

**Current State**:
- ❌ Mock offer data
- ❌ No activity tracking
- ❌ No real stats

**After Implementation**:
- ✅ Real offer data from database
- ✅ Activity tracking on completion
- ✅ Real-time user stats
- ✅ Completed offers list
- ✅ Professional backend

---

**Ready to implement!** 🚀
