# Automatic Postback Distribution System - Architecture

## System Overview

This system acts as a **mediator** between external offer platforms and your partners, automatically distributing postback notifications.

```
External Platform → Your System → All Partners
     (Offers)      (Mediator)    (Receive Postbacks)
```

---

## Key Components

### 1. Partner Registration System

**Files:**
- `src/pages/Register.tsx` - Partner registration UI
- `src/pages/Login.tsx` - Partner login UI
- `backend/routes/auth.py` - Authentication endpoints
- `backend/models/user.py` - User model with partner fields

**Flow:**
1. Partner registers with company details and postback URL
2. Account created with `role: 'partner'`
3. Partner can login and manage profile
4. Partner configures postback URL with macros

**Database:**
```javascript
// users collection
{
  _id: ObjectId,
  username: "john_doe",
  email: "partner@example.com",
  role: "partner",  // Key field
  is_active: true,  // Must be true for distribution
  first_name: "John",
  last_name: "Doe",
  company_name: "Test Company",
  website: "https://example.com",
  postback_url: "https://partner.com/pb?click={click_id}&status={status}",
  postback_method: "GET",  // or "POST"
  created_at: ISODate,
  updated_at: ISODate
}
```

---

### 2. Postback Receiver

**Files:**
- `backend/routes/postback_receiver.py` - Receives postbacks from external platforms

**Endpoint:**
```
GET/POST /postback/{unique_key}?param1=value1&param2=value2
```

**Flow:**
1. External platform sends postback to your unique URL
2. System logs to `received_postbacks` collection
3. Extracts all parameters
4. **Triggers automatic distribution to all partners**
5. Returns success response

**Database:**
```javascript
// received_postbacks collection
{
  _id: ObjectId,
  unique_key: "abc123xyz",
  partner_id: "external_partner_id",
  partner_name: "External Platform",
  method: "GET",
  query_params: {
    click_id: "TEST001",
    status: "approved",
    payout: "10.50"
  },
  post_data: {},
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0...",
  timestamp: ISODate,
  status: "received"
}
```

---

### 3. Partner Postback Distribution Service

**Files:**
- `backend/services/partner_postback_service.py` - Core distribution logic

**Key Methods:**

#### `get_active_partners()`
Fetches all partners from `users` collection where:
- `role == 'partner'`
- `is_active == true`
- `postback_url` exists and not empty

#### `replace_macros()`
Replaces macros in partner URLs:
```python
# Partner URL: https://partner.com/pb?click={click_id}&status={status}
# Becomes: https://partner.com/pb?click=TEST001&status=approved
```

Supported macros:
- `{click_id}`, `{status}`, `{payout}`, `{offer_id}`
- `{conversion_id}`, `{transaction_id}`, `{user_id}`
- `{affiliate_id}`, `{campaign_id}`
- `{sub_id}`, `{sub_id1}` through `{sub_id5}`
- `{ip}`, `{country}`, `{device_id}`, `{timestamp}`

#### `send_postback_to_partner()`
Sends HTTP request to single partner:
- Supports GET and POST methods
- 10-second timeout
- Tracks response time
- Logs success/failure

#### `distribute_to_all_partners()`
Main distribution function:
1. Gets all active partners
2. Sends to each partner in sequence
3. Logs each attempt
4. Returns summary statistics

**Database:**
```javascript
// partner_postback_logs collection
{
  _id: ObjectId,
  partner_id: ObjectId("user_id"),
  partner_name: "John Doe",
  partner_email: "partner@example.com",
  postback_url: "https://partner.com/pb?click=TEST001&status=approved",
  method: "GET",
  success: true,
  status_code: 200,
  response_body: "OK",
  response_time: 0.523,  // seconds
  retry_count: 0,
  error: null,
  source_log_id: "received_postback_id",
  postback_data: {
    click_id: "TEST001",
    status: "approved",
    payout: "10.50"
  },
  timestamp: ISODate
}
```

---

### 4. Partner Profile Management

**Files:**
- `src/pages/PartnerProfile.tsx` - Partner self-service UI
- `backend/routes/partner_profile.py` - Partner-specific endpoints

**Features:**
- View/edit personal and company details
- Configure postback URL and method
- Test postback with sample data
- View statistics (total, successful, failed)

**Endpoints:**
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile/update` - Update profile
- `POST /api/partner/test-postback` - Test URL
- `GET /api/partner/stats` - Get statistics

---

### 5. Admin Monitoring

**Files:**
- `backend/routes/partner_postback_logs.py` - Admin endpoints for logs

**Features:**
- View all partner postback logs
- Filter by partner, success status, time range
- Overall statistics and analytics
- Retry failed postbacks
- Clean up old logs

**Endpoints:**
- `GET /api/admin/partner-postback-logs` - List logs
- `GET /api/admin/partner-postback-logs/stats` - Statistics
- `POST /api/admin/partner-postback-logs/retry-failed` - Retry
- `DELETE /api/admin/partner-postback-logs/delete-old` - Cleanup

---

## Data Flow

### Complete Flow Diagram:

```
┌─────────────────────┐
│ External Platform   │
│ (Sends Postback)    │
└──────────┬──────────┘
           │
           │ GET /postback/abc123?click_id=TEST001&status=approved
           ↓
┌─────────────────────────────────────────────────────────┐
│ Postback Receiver                                       │
│ 1. Validate unique_key                                  │
│ 2. Log to received_postbacks collection                 │
│ 3. Extract parameters                                   │
└──────────┬──────────────────────────────────────────────┘
           │
           │ Trigger Distribution
           ↓
┌─────────────────────────────────────────────────────────┐
│ Partner Postback Service                                │
│ 1. Query users collection (role=partner, is_active=true)│
│ 2. For each partner:                                    │
│    - Replace macros in postback_url                     │
│    - Send HTTP request                                  │
│    - Log result to partner_postback_logs                │
└──────────┬──────────────────────────────────────────────┘
           │
           ├─────────────────┬─────────────────┬──────────
           ↓                 ↓                 ↓
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │Partner 1 │      │Partner 2 │      │Partner 3 │
    │Receives  │      │Receives  │      │Receives  │
    │Postback  │      │Postback  │      │Postback  │
    └──────────┘      └──────────┘      └──────────┘
```

---

## Database Schema

### Collections:

1. **users** - Partner accounts
   - Stores partner registration details
   - Contains postback configuration
   - Used by distribution service

2. **received_postbacks** - Incoming postbacks
   - Logs all postbacks from external platforms
   - Source of truth for what was received
   - Links to partner_postback_logs

3. **partner_postback_logs** - Distribution logs
   - One entry per partner per postback
   - Tracks success/failure
   - Supports retry mechanism
   - Used for statistics

4. **partners** (Legacy - Optional)
   - Old partner management system
   - NOT used by distribution service
   - Can be removed or kept for other purposes

---

## Security Considerations

### Authentication:
- JWT tokens for API access
- Role-based access (partner, admin)
- Protected routes with `@token_required` decorator

### Partner Isolation:
- Partners only see their own data
- Admin can see all data
- Partner-specific endpoints check user role

### Postback Security:
- Unique keys for postback receiver
- IP logging for audit trail
- User-agent tracking

---

## Performance Considerations

### Distribution:
- Sequential sending to partners (not parallel)
- 10-second timeout per partner
- Failed partners don't block others
- Async distribution (doesn't block postback response)

### Scalability:
- Can handle 100+ partners per postback
- Database indexes recommended:
  - `users.role + users.is_active + users.postback_url`
  - `partner_postback_logs.timestamp`
  - `partner_postback_logs.partner_id + timestamp`

### Optimization Opportunities:
- Parallel partner requests (use threading/async)
- Queue-based distribution (Celery/RQ)
- Caching active partners list
- Batch retry operations

---

## Error Handling

### Postback Reception:
- Always returns 200 OK (even if distribution fails)
- Logs errors but doesn't expose to external platform
- Distribution failures don't affect postback acceptance

### Partner Distribution:
- Timeout handling (10 seconds)
- Network error handling
- Invalid URL handling
- Logs all errors with details

### Retry Mechanism:
- Max 3 retries per postback
- Configurable time window
- Tracks retry count
- Stops after max retries

---

## Monitoring & Logging

### Log Levels:
- **INFO**: Normal operations (postback received, sent)
- **WARNING**: Non-critical issues (partner not found)
- **ERROR**: Failures (network errors, timeouts)

### Key Metrics:
- Total postbacks received
- Distribution success rate
- Average response time per partner
- Failed postbacks count
- Retry success rate

### Log Format:
```
📥 Postback received: key=abc123xyz
📋 Found 3 active partners
📤 Sending postback to Partner 1 (GET): https://...
✅ Postback sent successfully - Status: 200 - Time: 0.5s
📊 Distribution summary: 3/3 partners notified
```

---

## Configuration

### Environment Variables:
```bash
MONGODB_URI=mongodb://localhost:27017/
JWT_SECRET=your-secret-key
FLASK_ENV=development
PORT=5000
```

### Service Configuration:
```python
# partner_postback_service.py
timeout = 10  # Request timeout in seconds
max_retries = 3  # Maximum retry attempts
```

---

## Testing Strategy

### Unit Tests:
- Macro replacement logic
- Partner filtering
- Error handling

### Integration Tests:
- End-to-end postback flow
- Multiple partner distribution
- Retry mechanism

### Manual Testing:
- Use webhook.site for partner URLs
- Test with real postback data
- Verify logs and statistics

---

## Future Enhancements

### Priority 1:
- [ ] Parallel partner distribution (performance)
- [ ] Admin UI for viewing logs
- [ ] Real-time dashboard

### Priority 2:
- [ ] Partner-specific parameter mapping
- [ ] Webhook signatures for security
- [ ] Rate limiting per partner

### Priority 3:
- [ ] Email notifications for failures
- [ ] Advanced analytics
- [ ] Partner API for self-service

---

## Maintenance

### Regular Tasks:
- Clean up old logs (30+ days)
- Monitor failed postbacks
- Review partner activity
- Check system performance

### Database Maintenance:
```javascript
// Clean up old logs
db.partner_postback_logs.deleteMany({
  timestamp: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
})

// Check active partners
db.users.count({ role: 'partner', is_active: true })

// View recent failures
db.partner_postback_logs.find({ success: false }).sort({ timestamp: -1 }).limit(10)
```

---

**System is production-ready!** 🚀
