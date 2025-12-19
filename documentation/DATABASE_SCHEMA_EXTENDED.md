# Extended MongoDB Offer Schema Documentation

## Overview

This document describes the extended MongoDB schema for the `offers` collection, which now includes **Schedule** and **Smart Rules** subdocuments to support advanced offer scheduling and intelligent traffic routing.

## Schema Version 2.0

The extended schema maintains backward compatibility while adding powerful new features:

- **Schedule Management**: Time-based offer activation with recurring patterns
- **Smart Rules Engine**: Dynamic traffic routing with GEO, backup, rotation, and time-based rules
- **Enhanced Indexing**: Optimized queries for real-time offer serving
- **Migration Support**: Seamless upgrade from existing schema

---

## 📋 Schema Structure

### Core Document Structure

```javascript
{
  // Existing fields (maintained for compatibility)
  "offer_id": "ML-00123",
  "campaign_id": "PARAM-PLUS-2024",
  "name": "Paramount+ Premium Streaming",
  "status": "Active",
  // ... all existing fields ...
  
  // NEW: Schedule Subdocument
  "schedule": {
    "startAt": ISODate("2024-10-16T00:00:00Z"),
    "endAt": ISODate("2024-12-31T23:59:59Z"),
    "recurringDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "status": "Active",
    "timezone": "EST",
    "isRecurring": true
  },
  
  // NEW: Smart Rules Array
  "smartRules": [
    {
      "_id": ObjectId("..."),
      "type": "GEO",
      "url": "https://example.com/us-landing",
      "geo": ["US"],
      "percentage": 70,
      "cap": 300,
      "priority": 1,
      "active": true,
      "createdAt": ISODate("2024-10-16T10:00:00Z")
    }
  ],
  
  // System fields
  "schema_version": "2.0",
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

---

## 🗓️ Schedule Subdocument

### Fields

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| `startAt` | Date | Offer activation start time | No | null |
| `endAt` | Date | Offer expiration time | No | null |
| `recurringDays` | Array[String] | Days of week for recurring offers | No | [] |
| `status` | String | Schedule status: "Active" or "Paused" | No | "Active" |
| `timezone` | String | Timezone for schedule calculations | No | "UTC" |
| `isRecurring` | Boolean | Whether offer repeats weekly | No | false |

### Validation Rules

- `endAt` must be after `startAt` if both are provided
- `recurringDays` values must be valid day names
- `status` must be "Active" or "Paused"
- `timezone` should be valid timezone identifier

### Examples

```javascript
// One-time scheduled offer
"schedule": {
  "startAt": ISODate("2024-11-01T09:00:00Z"),
  "endAt": ISODate("2024-11-30T23:59:59Z"),
  "status": "Active",
  "timezone": "EST",
  "isRecurring": false
}

// Recurring weekday offer
"schedule": {
  "recurringDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "status": "Active",
  "timezone": "PST",
  "isRecurring": true
}
```

---

## ⚡ Smart Rules Array

### Rule Types

1. **GEO**: Geographic traffic routing
2. **Backup**: Fallback destination when primary fails
3. **Rotation**: Traffic distribution across multiple URLs
4. **Time**: Time-based routing rules

### Fields

| Field | Type | Description | Required | Validation |
|-------|------|-------------|----------|------------|
| `_id` | ObjectId | Unique rule identifier | Yes | Auto-generated |
| `type` | String | Rule type (GEO/Backup/Rotation/Time) | Yes | Enum validation |
| `url` | String | Destination URL for this rule | Yes | Valid HTTP/HTTPS URL |
| `geo` | Array[String] | Target country codes (ISO 2-letter) | No | Valid country codes |
| `percentage` | Number | Traffic split percentage (0-100) | No | 0-100 range |
| `cap` | Number | Maximum conversions for this rule | No | >= 0 |
| `priority` | Number | Rule execution priority (1=highest) | Yes | >= 1, unique per offer |
| `active` | Boolean | Whether rule is currently active | No | true |
| `createdAt` | Date | Rule creation timestamp | Yes | Auto-generated |

### Examples

```javascript
// GEO-based routing
{
  "_id": ObjectId("..."),
  "type": "GEO",
  "url": "https://example.com/us-landing?aff={aff_id}",
  "geo": ["US", "CA"],
  "percentage": 80,
  "cap": 500,
  "priority": 1,
  "active": true
}

// Backup rule
{
  "_id": ObjectId("..."),
  "type": "Backup",
  "url": "https://backup.example.com/landing?aff={aff_id}",
  "geo": [],
  "percentage": 100,
  "cap": 0,
  "priority": 99,
  "active": true
}
```

---

## 🔍 Indexes for Performance

### Primary Indexes

```javascript
// Basic offer queries
db.offers.createIndex({ "offer_id": 1 })
db.offers.createIndex({ "status": 1 })
db.offers.createIndex({ "network": 1 })
db.offers.createIndex({ "category": 1 })

// Schedule-based queries
db.offers.createIndex({ "schedule.startAt": 1 })
db.offers.createIndex({ "schedule.endAt": 1 })
db.offers.createIndex({ "schedule.status": 1 })

// Smart rules queries
db.offers.createIndex({ "smartRules.active": 1 })
db.offers.createIndex({ "smartRules.type": 1 })
db.offers.createIndex({ "smartRules.geo": 1 })
```

### Compound Indexes

```javascript
// Active offers with schedules
db.offers.createIndex({ 
  "status": 1, 
  "schedule.status": 1, 
  "is_active": 1 
})

// Time-based offer serving
db.offers.createIndex({ 
  "schedule.startAt": 1, 
  "schedule.endAt": 1, 
  "status": 1 
})

// Geographic targeting
db.offers.createIndex({ 
  "smartRules.geo": 1, 
  "smartRules.type": 1, 
  "smartRules.active": 1 
})
```

### Text Search Index

```javascript
db.offers.createIndex({
  "name": "text",
  "description": "text",
  "campaign_id": "text",
  "offer_id": "text",
  "keywords": "text"
})
```

---

## 📊 Common Query Patterns

### 1. Find Currently Active Offers

```javascript
const now = new Date();
db.offers.find({
  status: 'Active',
  is_active: true,
  'schedule.status': 'Active',
  $or: [
    { 'schedule.startAt': { $exists: false } },
    { 'schedule.startAt': { $lte: now } }
  ],
  $and: [
    {
      $or: [
        { 'schedule.endAt': { $exists: false } },
        { 'schedule.endAt': { $gte: now } }
      ]
    }
  ]
})
```

### 2. Find GEO-Targeted Offers

```javascript
db.offers.find({
  status: 'Active',
  'smartRules': {
    $elemMatch: {
      type: 'GEO',
      geo: 'US',
      active: true
    }
  }
})
```

### 3. Find Offers Starting Soon

```javascript
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

db.offers.find({
  'schedule.startAt': {
    $gte: now,
    $lte: tomorrow
  },
  status: 'Active'
})
```

### 4. Aggregation: Rule Performance Stats

```javascript
db.offers.aggregate([
  { $match: { status: 'Active', 'smartRules.active': true } },
  { $unwind: '$smartRules' },
  { $match: { 'smartRules.active': true } },
  {
    $group: {
      _id: '$smartRules.type',
      totalOffers: { $sum: 1 },
      avgPercentage: { $avg: '$smartRules.percentage' },
      totalHits: { $sum: '$hits' }
    }
  },
  { $sort: { totalOffers: -1 } }
])
```

---

## 🔄 Migration Guide

### Step 1: Run Migration Script

```bash
cd backend
node migrations/add_schedule_smart_rules.js
```

### Step 2: Verify Migration

```javascript
// Check migrated offers
db.offers.countDocuments({
  schedule: { $exists: true },
  smartRules: { $exists: true },
  schema_version: '2.0'
})
```

### Step 3: Create Indexes

```bash
node database/indexes_and_queries.js
```

### Rollback (if needed)

```bash
node migrations/add_schedule_smart_rules.js rollback
```

---

## 🛠️ Implementation Files

### Backend Files

1. **`models/offer_schema.js`** - Mongoose schema definition
2. **`models/offer_extended.py`** - Python model with validation
3. **`migrations/add_schedule_smart_rules.js`** - Migration script
4. **`database/indexes_and_queries.js`** - Index definitions and query examples

### Frontend Integration

The schema integrates with the existing frontend "Schedule + Rules" tab:

- **Schedule data** maps to `schedule` subdocument
- **Smart rules** map to `smartRules` array
- **Form validation** matches backend validation rules

---

## 📈 Performance Considerations

### Query Optimization

1. **Use compound indexes** for multi-field queries
2. **Limit result sets** with proper pagination
3. **Project only needed fields** to reduce bandwidth
4. **Use aggregation pipelines** for complex analytics

### Scaling Recommendations

1. **Shard by offer_id** for horizontal scaling
2. **Use read replicas** for analytics queries
3. **Implement caching** for frequently accessed offers
4. **Monitor index usage** and optimize regularly

### Memory Usage

- **Smart rules array**: Typically 1-10 rules per offer
- **Schedule subdocument**: Fixed small size (~200 bytes)
- **Total overhead**: ~1-5KB per offer for new fields

---

## 🔒 Security & Validation

### Input Validation

- **URL validation**: All URLs must be valid HTTP/HTTPS
- **Date validation**: Proper ISO date format required
- **Range validation**: Percentages (0-100), priorities (>=1)
- **Enum validation**: Rule types, statuses, day names

### Access Control

- **Admin-only creation**: Only admins can create/modify offers
- **User isolation**: Users see only their assigned offers
- **Audit logging**: All changes tracked with timestamps

### Data Integrity

- **Unique priorities**: No duplicate priorities within offer
- **Referential integrity**: Valid country codes, timezones
- **Constraint validation**: End date after start date

---

## 🧪 Testing

### Unit Tests

```python
# Test schedule validation
def test_schedule_validation():
    schedule = {
        'startAt': '2024-01-01T00:00:00Z',
        'endAt': '2023-12-31T23:59:59Z'  # Invalid: end before start
    }
    is_valid, error = validate_schedule(schedule)
    assert not is_valid
    assert 'End date must be after start date' in error
```

### Integration Tests

```javascript
// Test offer creation with schedule and rules
const offerData = {
  // ... basic offer fields ...
  schedule: {
    startAt: new Date('2024-11-01'),
    endAt: new Date('2024-11-30'),
    status: 'Active'
  },
  smartRules: [{
    type: 'GEO',
    url: 'https://example.com',
    geo: ['US'],
    percentage: 100,
    priority: 1
  }]
};

const result = await createOfferExtended(offerData, 'admin_user');
assert(result.success);
assert(result.offer.schedule.startAt);
assert(result.offer.smartRules.length === 1);
```

---

## 📚 API Documentation

### Create Offer with Schedule & Rules

```http
POST /api/admin/offers
Content-Type: application/json
Authorization: Bearer {token}

{
  "campaign_id": "EXAMPLE-2024",
  "name": "Test Offer with Schedule",
  "payout": 10.00,
  "network": "TestNetwork",
  "target_url": "https://example.com",
  "schedule": {
    "startAt": "2024-11-01T00:00:00Z",
    "endAt": "2024-11-30T23:59:59Z",
    "status": "Active"
  },
  "smartRules": [
    {
      "type": "GEO",
      "url": "https://example.com/us",
      "geo": ["US"],
      "percentage": 70,
      "priority": 1,
      "active": true
    }
  ]
}
```

### Update Smart Rule

```http
PUT /api/admin/offers/{offer_id}/smart-rules/{rule_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "GEO",
  "url": "https://updated-example.com/us",
  "geo": ["US", "CA"],
  "percentage": 80,
  "priority": 1,
  "active": true
}
```

---

## 🎯 Summary

The extended MongoDB schema provides:

✅ **Flexible Scheduling** - Time-based offer activation with recurring patterns  
✅ **Intelligent Routing** - Dynamic traffic distribution with multiple rule types  
✅ **High Performance** - Optimized indexes for real-time offer serving  
✅ **Backward Compatible** - Seamless migration from existing schema  
✅ **Scalable Design** - Supports high-volume affiliate marketing operations  
✅ **Developer Friendly** - Comprehensive validation, examples, and documentation  

The schema is production-ready and supports the advanced offer management features implemented in the frontend "Schedule + Rules" tab.
