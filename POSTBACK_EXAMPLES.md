# Postback Integration Examples

## Real-World Scenarios

---

## Scenario 1: Simple Survey Completion

### What Happened
- User clicked on survey offer "VBFS6"
- User completed the survey
- Partner pays $5.00 for completion

### Postback URL to Send
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-789ABC&status=approved&payout=5.00&survey_id=VBFS6&transaction_id=TXN-12345
```

### What Our System Does
1. ✅ Receives postback and logs it
2. 🔍 Finds the click record for `CLK-789ABC`
3. 💰 Calculates payout (if 80% revenue share: $5.00 × 80% = $4.00)
4. 📤 Forwards to the publisher with $4.00
5. ⭐ Updates user points (+4 points)

---

## Scenario 2: Pending Conversion (Needs Review)

### What Happened
- User completed offer but needs manual review
- Partner sends pending status

### Postback URL to Send
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-456DEF&status=pending&payout=10.00&offer_id=OFFER-123&transaction_id=TXN-67890
```

### What Our System Does
1. ✅ Receives postback and logs it
2. 🔍 Creates conversion with `status: pending`
3. ⏸️ Does NOT update user points yet
4. 📤 Forwards to publisher with pending status
5. ⏳ Waits for approval postback

### Later: Approval Postback
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-456DEF&status=approved&payout=10.00&offer_id=OFFER-123&transaction_id=TXN-67890
```

---

## Scenario 3: Survey with Custom Data

### What Happened
- User completed demographic survey
- Partner wants to send survey responses
- Partner pays $3.50

### Postback URL to Send (POST)
```
POST https://moustacheleads-backend.onrender.com/postback/abc123xyz
Content-Type: application/json

{
  "click_id": "CLK-999XYZ",
  "status": "approved",
  "payout": 3.50,
  "survey_id": "DEMO-001",
  "transaction_id": "TXN-DEMO-123",
  "user_age": 28,
  "user_gender": "female",
  "user_country": "US",
  "user_state": "CA",
  "completion_time_seconds": 180,
  "survey_responses": "{\"q1\":\"yes\",\"q2\":\"no\",\"q3\":\"maybe\"}"
}
```

### What Our System Does
1. ✅ Receives postback with all custom data
2. 💾 Stores everything in `custom_data` field
3. 💰 Calculates payout (e.g., $3.50 × 80% = $2.80)
4. 📤 Forwards to publisher with $2.80
5. ⭐ Updates user points (+2.80 points)
6. 📊 Custom data available for reporting

---

## Scenario 4: Multiple Conversions Same User

### What Happened
- Same user completed 3 different offers
- Each has different click_id

### Postback URLs to Send
```
# Offer 1
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-001&status=approved&payout=5.00&offer_id=OFFER-A

# Offer 2
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-002&status=approved&payout=8.00&offer_id=OFFER-B

# Offer 3
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-003&status=approved&payout=12.00&offer_id=OFFER-C
```

### What Our System Does
- Each postback is processed independently
- Each click_id is matched to its own click record
- User gets points for all 3 conversions
- Publisher gets 3 separate postback forwards

---

## Scenario 5: Rejected/Fraudulent Conversion

### What Happened
- User completed offer but failed fraud check
- Partner rejects the conversion

### Postback URL to Send
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-FRAUD-123&status=rejected&payout=0&offer_id=OFFER-456&transaction_id=TXN-REJECT-789&reason=fraud_detected
```

### What Our System Does
1. ✅ Receives postback and logs it
2. 🔍 Creates conversion with `status: rejected`
3. ❌ Does NOT update user points
4. 📤 Forwards to publisher with rejected status
5. 🚫 Publisher can block user if needed

---

## Scenario 6: No Click ID (Fallback Matching)

### What Happened
- Partner doesn't have click_id
- But has offer_id and recent timestamp

### Postback URL to Send
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?offer_id=SURVEY-789&status=approved&payout=7.00&transaction_id=TXN-NOCLICKID
```

### What Our System Does
1. ⚠️ No click_id provided
2. 🔍 Searches for recent clicks (last 1 hour) with `offer_id=SURVEY-789`
3. ✅ Finds most recent matching click
4. 💰 Processes normally
5. 📝 Logs warning about missing click_id

**Note:** This is a fallback - always send click_id when possible!

---

## Scenario 7: Revenue Share vs Fixed Payout

### Offer A: 80% Revenue Share
```
Upward Partner Pays: $100
Revenue Share: 80%
Downward Payout: $100 × 80% = $80
User Gets: 80 points
```

**Postback:**
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-REV-001&status=approved&payout=100.00&offer_id=OFFER-REV
```

### Offer B: Fixed $50 Payout
```
Upward Partner Pays: $100
Fixed Payout: $50
Downward Payout: $50 (regardless of upward)
User Gets: 50 points
```

**Postback:**
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-FIXED-001&status=approved&payout=100.00&offer_id=OFFER-FIXED
```

---

## Scenario 8: International Currency

### What Happened
- Offer pays in EUR
- Partner sends currency code

### Postback URL to Send
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-EUR-001&status=approved&payout=42.50&currency=EUR&offer_id=OFFER-EU&transaction_id=TXN-EUR-123
```

### What Our System Does
1. ✅ Receives postback with EUR currency
2. 💾 Stores currency code
3. 💰 Calculates payout in EUR
4. 📤 Forwards to publisher with EUR amount
5. ⭐ Updates user points (42.50 points)

**Note:** Points are 1:1 with currency amount. Currency conversion is handled separately if needed.

---

## Scenario 9: Batch Postbacks

### What Happened
- Partner sends multiple conversions at once
- Each needs separate postback

### Postback URLs to Send (in sequence)
```bash
# Conversion 1
curl "https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-BATCH-001&status=approved&payout=5.00&offer_id=OFFER-1"

# Conversion 2
curl "https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-BATCH-002&status=approved&payout=8.00&offer_id=OFFER-2"

# Conversion 3
curl "https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-BATCH-003&status=approved&payout=12.00&offer_id=OFFER-3"
```

### What Our System Does
- Processes each postback independently
- No rate limiting (within reason)
- Each gets logged and forwarded separately

---

## Scenario 10: Testing Integration

### Test Postback
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=TEST-INTEGRATION-001&status=test&payout=1.00&offer_id=TEST-OFFER
```

### Expected Response
```json
{
  "status": "success",
  "message": "Postback received and distributed",
  "log_id": "507f1f77bcf86cd799439011"
}
```

### Check Test Endpoint
```
GET https://moustacheleads-backend.onrender.com/api/analytics/postback/test
```

### Expected Response
```json
{
  "status": "online",
  "endpoint": "/api/analytics/postback",
  "methods": ["GET", "POST"],
  "required_params": ["click_id"],
  "optional_params": ["status", "payout", "transaction_id", "+ any custom fields"]
}
```

---

## Common Mistakes to Avoid

### ❌ Wrong: Missing click_id
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?status=approved&payout=5.00
```
**Error:** `400 Bad Request - click_id required`

### ✅ Correct: Include click_id
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-123&status=approved&payout=5.00
```

---

### ❌ Wrong: Using literal macros
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id={click_id}&payout={payout}
```
**Problem:** System receives literal `{click_id}` string

### ✅ Correct: Replace macros with actual values
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-789ABC&payout=5.00
```

---

### ❌ Wrong: Invalid unique key
```
GET https://moustacheleads-backend.onrender.com/postback/wrong-key?click_id=CLK-123
```
**Error:** `404 Not Found - Invalid postback key`

### ✅ Correct: Use your assigned key
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-123
```

---

## Integration Checklist

- [ ] Received unique postback key from admin
- [ ] Tested postback URL with test parameters
- [ ] Confirmed 200 OK response
- [ ] Verified click_id is being sent correctly
- [ ] Confirmed payout amount is accurate
- [ ] Tested with real conversion
- [ ] Verified user received points
- [ ] Set up error handling for failed postbacks
- [ ] Implemented retry logic for 5xx errors
- [ ] Documented integration for your team

---

## Need More Help?

See the complete documentation:
- `POSTBACK_INTEGRATION_GUIDE.md` - Full technical documentation
- `POSTBACK_QUICK_REFERENCE.md` - Quick parameter reference

Contact your account manager for:
- Unique postback key
- Testing assistance
- Custom integration requirements
