# 🏗️ Offerwall Architecture & Technical Details

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLISHER'S WEBSITE/APP                   │
│                                                               │
│  <iframe src="/offerwall?placement_id=X&user_id=Y">         │
│    ┌──────────────────────────────────────────────────────┐ │
│    │         OFFERWALL IFRAME (React Component)           │ │
│    │                                                       │ │
│    │  1. Detect Device Info (browser, OS, device type)   │ │
│    │  2. Create Session (unique session_id)              │ │
│    │  3. Load Offers (fetch from /api/offerwall/offers)  │ │
│    │  4. Display Offer Grid (responsive layout)          │ │
│    │  5. Track Clicks (POST to /api/offerwall/track)     │ │
│    │  6. Handle Conversions (postback from networks)     │ │
│    │                                                       │ │
│    └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER                         │
│                                                               │
│  POST /api/offerwall/session/create                         │
│  POST /api/offerwall/track/impression                       │
│  POST /api/offerwall/track/click                            │
│  POST /api/offerwall/track/conversion                       │
│  GET  /api/offerwall/analytics/<placement_id>              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         OfferwallTracker Service Class                 │ │
│  │                                                         │ │
│  │  - create_session()                                    │ │
│  │  - record_impression()                                 │ │
│  │  - record_click() + duplicate detection               │ │
│  │  - record_conversion() + fraud detection              │ │
│  │  - get_publisher_stats()                              │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  MONGODB COLLECTIONS                         │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ offerwall_       │  │ offerwall_       │                │
│  │ sessions         │  │ clicks           │                │
│  │                  │  │                  │                │
│  │ - session_id     │  │ - click_id       │                │
│  │ - user_id        │  │ - session_id     │                │
│  │ - placement_id   │  │ - offer_id       │                │
│  │ - device_info    │  │ - timestamp      │                │
│  │ - geo_info       │  │ - fraud_score    │                │
│  │ - metrics {}     │  │ - is_duplicate   │                │
│  │ - fraud_flags[]  │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ offerwall_       │  │ offerwall_       │                │
│  │ conversions      │  │ impressions      │                │
│  │                  │  │                  │                │
│  │ - conversion_id  │  │ - impression_id  │                │
│  │ - click_id       │  │ - session_id     │                │
│  │ - offer_id       │  │ - timestamp      │                │
│  │ - payout_amount  │  │ - referrer       │                │
│  │ - status         │  │ - user_agent     │                │
│  │ - fraud_flags[]  │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Session Creation Flow
```
User loads iframe with placement_id & user_id
         ↓
Frontend: Create session (OfferwallIframe.tsx)
         ↓
Detect device info (browser, OS, device_type)
         ↓
POST /api/offerwall/session/create
         ↓
Backend: OfferwallTracker.create_session()
         ↓
Insert into offerwall_sessions collection
         ↓
Return session_id to frontend
```

### 2. Impression Tracking Flow
```
Iframe loads successfully
         ↓
Frontend: POST /api/offerwall/track/impression
         ↓
Backend: OfferwallTracker.record_impression()
         ↓
Insert into offerwall_impressions collection
         ↓
Update session metrics.impressions += 1
```

### 3. Click Tracking Flow
```
User clicks offer
         ↓
Frontend: POST /api/offerwall/track/click
         ↓
Backend: OfferwallTracker.record_click()
         ↓
Check for duplicate clicks (5-second window)
         ↓
Insert into offerwall_clicks collection
         ↓
Update session metrics.clicks += 1
         ↓
Open offer in new window
```

### 4. Conversion Tracking Flow
```
Offer network sends postback (user completed offer)
         ↓
Backend: POST /api/offerwall/track/conversion
         ↓
OfferwallTracker.record_conversion()
         ↓
Check for duplicate conversions (24-hour window)
         ↓
Check fraud indicators
         ↓
Insert into offerwall_conversions collection
         ↓
Update session metrics.conversions += 1
         ↓
Update session metrics.total_earned += payout
```

### 5. Analytics Flow
```
Publisher requests analytics
         ↓
GET /api/offerwall/analytics/<placement_id>
         ↓
Backend: OfferwallTracker.get_publisher_stats()
         ↓
Query offerwall_sessions collection
         ↓
Query offerwall_conversions collection
         ↓
Calculate metrics:
  - Total impressions
  - Total clicks
  - CTR = (clicks / impressions) * 100
  - Total conversions
  - Conversion rate = (conversions / clicks) * 100
  - Total earnings
  - EPC = earnings / clicks
         ↓
Return analytics JSON
```

---

## Component Details

### Frontend: OfferwallIframe.tsx

#### Props
```typescript
interface OfferwallIframeProps {
  placementId: string;      // Required: placement ID
  userId: string;           // Required: end user ID
  subId?: string;          // Optional: external tracking ID
  country?: string;        // Optional: force country
}
```

#### Lifecycle
```
1. Mount
   ├─ getDeviceInfo() - Detect browser, OS, device type
   ├─ Create session_id
   └─ POST /api/offerwall/session/create

2. Session Created
   ├─ POST /api/offerwall/track/impression
   └─ GET /api/offerwall/offers

3. Offers Loaded
   ├─ Render offer grid
   └─ Attach click handlers

4. User Clicks Offer
   ├─ POST /api/offerwall/track/click
   └─ window.open(offer.click_url)

5. Unmount
   └─ Close session (optional)
```

#### Device Detection
```typescript
getDeviceInfo() {
  // Device Type
  if (/mobile/i.test(ua)) device_type = 'mobile'
  if (/tablet/i.test(ua)) device_type = 'tablet'
  else device_type = 'web'
  
  // Browser
  if (/chrome/i.test(ua)) browser = 'chrome'
  if (/firefox/i.test(ua)) browser = 'firefox'
  if (/safari/i.test(ua)) browser = 'safari'
  if (/edge/i.test(ua)) browser = 'edge'
  
  // OS
  if (/windows/i.test(ua)) os = 'windows'
  if (/mac/i.test(ua)) os = 'macos'
  if (/linux/i.test(ua)) os = 'linux'
  if (/android/i.test(ua)) os = 'android'
  if (/iphone|ipad/i.test(ua)) os = 'ios'
}
```

### Backend: OfferwallTracker Class

#### Methods

**create_session(placement_id, user_id, publisher_id, device_info, geo_info, sub_id)**
- Creates unique session_id (UUID)
- Stores device and geo information
- Initializes metrics object
- Returns session_id

**record_impression(session_id, placement_id, publisher_id, user_id, impression_data)**
- Creates impression_id (UUID)
- Records timestamp, referrer, user_agent
- Increments session.metrics.impressions
- Returns impression_id

**record_click(session_id, offer_id, placement_id, publisher_id, user_id, click_data)**
- Creates click_id (UUID)
- Checks for duplicate clicks (5-second window)
- Records click with fraud_score = 0
- Increments session.metrics.clicks
- Returns click_id

**record_conversion(click_id, session_id, offer_id, placement_id, publisher_id, user_id, payout_amount, conversion_data)**
- Creates conversion_id (UUID)
- Checks for duplicate conversions (24-hour window)
- Records payout_amount
- Increments session.metrics.conversions
- Increments session.metrics.total_earned
- Returns conversion_id

**get_publisher_stats(publisher_id, placement_id, start_date, end_date)**
- Queries offerwall_sessions
- Queries offerwall_conversions
- Calculates:
  - total_impressions
  - total_clicks
  - CTR = (clicks / impressions) * 100
  - total_conversions
  - conversion_rate = (conversions / clicks) * 100
  - total_earnings
  - epc = earnings / clicks
- Returns stats object

---

## Fraud Detection Mechanisms

### 1. Duplicate Click Detection
```python
_check_duplicate_click(session_id, offer_id, time_window_seconds=5)
- Query: same session_id, same offer_id, within 5 seconds
- If found: is_duplicate = True
- Prevents: Rapid-fire clicking
```

### 2. Duplicate Conversion Detection
```python
_check_duplicate_conversion(user_id, offer_id, placement_id, time_window_hours=24)
- Query: same user_id, same offer_id, same placement_id, within 24 hours
- If found: is_duplicate = True
- Prevents: Multiple rewards for same offer
```

### 3. Future Fraud Scoring
```
Planned fraud indicators:
- Multiple accounts on same device
- Unusual CTR (>50%)
- VPN/Proxy detection
- Bot detection (headless browsers)
- Too many conversions from one device (>10/day)
- Same IP using multiple publishers (>5)

Fraud Score Calculation:
- Each flag adds points (0-100 scale)
- Risk Levels:
  - 0-40: Low risk
  - 40-70: Medium risk
  - 70-100: High risk
```

---

## Performance Considerations

### Database Indexing
Recommended indexes for optimal performance:
```javascript
// offerwall_sessions
db.offerwall_sessions.createIndex({ "placement_id": 1 })
db.offerwall_sessions.createIndex({ "publisher_id": 1 })
db.offerwall_sessions.createIndex({ "created_at": 1 })
db.offerwall_sessions.createIndex({ "user_id": 1 })

// offerwall_clicks
db.offerwall_clicks.createIndex({ "session_id": 1 })
db.offerwall_clicks.createIndex({ "placement_id": 1 })
db.offerwall_clicks.createIndex({ "timestamp": 1 })

// offerwall_conversions
db.offerwall_conversions.createIndex({ "placement_id": 1 })
db.offerwall_conversions.createIndex({ "publisher_id": 1 })
db.offerwall_conversions.createIndex({ "timestamp": 1 })
```

### Query Optimization
- Use placement_id as primary filter
- Use timestamp ranges for date filtering
- Aggregate at application level for small datasets
- Use MongoDB aggregation pipeline for large datasets

---

## Security Measures

### Input Validation
- All required fields validated
- Data types checked
- String length limits enforced
- Numeric ranges validated

### Data Integrity
- Session IDs are UUIDs (cryptographically unique)
- Click IDs are UUIDs
- Conversion IDs are UUIDs
- Timestamps are server-side generated

### Access Control
- Placement validation before tracking
- Publisher ID derived from placement
- No direct user input for sensitive fields

---

## Scalability

### Current Architecture
- Single OfferwallTracker instance per process
- MongoDB for persistent storage
- In-memory session cache (optional)

### Future Enhancements
- Redis caching for hot data
- Message queue for async processing
- Sharding by placement_id
- Read replicas for analytics queries

---

## Monitoring & Logging

### Log Points
```
✅ Session creation: "✅ Created offerwall session: {session_id}"
✅ Click recording: "✅ Recorded click: {click_id} for offer: {offer_id}"
✅ Conversion recording: "✅ Recorded conversion: {conversion_id}"
❌ Errors: Full stack trace with context
```

### Metrics to Monitor
- Sessions created per minute
- Clicks per minute
- Conversions per minute
- Average CTR
- Average conversion rate
- Fraud flag rate
- API response times

---

## Testing Strategy

### Unit Tests
- Test OfferwallTracker methods
- Test duplicate detection logic
- Test analytics calculations

### Integration Tests
- Test API endpoints
- Test database operations
- Test session flow

### End-to-End Tests
- Test iframe embedding
- Test full user journey
- Test analytics accuracy

---

## Deployment Checklist

- [ ] Create MongoDB collections
- [ ] Create database indexes
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test iframe embedding
- [ ] Monitor logs for errors
- [ ] Verify analytics accuracy
- [ ] Set up monitoring/alerts

---

## Version History

### v1.0 (Current)
- ✅ Session management
- ✅ Impression tracking
- ✅ Click tracking
- ✅ Conversion tracking
- ✅ Basic analytics
- ✅ Duplicate detection

### v1.1 (Planned)
- [ ] Advanced fraud scoring
- [ ] Real-time dashboards
- [ ] Postback integration
- [ ] Webhook support
- [ ] Custom reporting

---

## Support & Maintenance

### Common Issues & Solutions
See OFFERWALL_QUICK_START.md for troubleshooting guide

### Performance Tuning
- Monitor database query times
- Optimize indexes as needed
- Cache frequently accessed data
- Use aggregation pipeline for complex queries

### Updates & Patches
- Regular security updates
- Performance optimizations
- New feature additions
- Bug fixes

---

**Last Updated**: 2025-11-25
**Version**: 1.0
**Status**: Production Ready ✅
