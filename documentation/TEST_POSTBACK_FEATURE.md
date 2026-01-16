# Test Postback Feature

## Overview

The Test Postback feature allows administrators to send test conversion postbacks to downstream partners for integration testing. This eliminates the need for manual testing and ensures partner postback URLs are correctly configured before launching campaigns.

## Purpose

- **Integration Testing**: Verify partner postback URLs are working correctly
- **Multi-Partner Support**: Send test postbacks to different partners in a single test sequence
- **Scheduled Testing**: Configure time delays between postbacks to simulate real-world scenarios
- **Real-time Monitoring**: Track test results in real-time with detailed logs

## Access

**Location**: Admin Dashboard → Integration → Test Postback

**URL**: `/admin/test-postback`

**Required Role**: Admin only

## Features

### 1. Configure Test Postbacks

Each test postback entry includes:
- **Partner Selection**: Choose from active partners with configured postback URLs
- **Username**: The test user who "completed" the offer
- **Offer Name**: The name of the test offer
- **Points**: The reward amount (can be decimal)
- **Delay (minutes)**: Time to wait before sending this postback (default: 0)

### 2. Multi-Partner Testing

- Add multiple test postback entries
- Each entry can target a different partner
- Configure different timing delays for each entry
- Remove entries as needed (minimum 1 required)

### 3. Real-time Results

After sending test postbacks, view:
- **Test ID**: Unique identifier for the test batch
- **Summary**: Total, successful, and failed postbacks
- **Detailed Logs**: For each postback:
  - Partner name
  - User and offer details
  - Success/failure status
  - HTTP status code
  - Response time
  - Error messages (if any)
  - Response body (expandable)

## Usage Example

### Scenario: Testing Two Partners with Timed Delays

**Goal**: Send test postbacks to Partner A immediately, then to Partner B after 10 minutes.

**Configuration**:

1. **First Postback**:
   - Partner: Partner A
   - Username: Don1
   - Offer Name: Zen Offer
   - Points: 30
   - Delay: 0 minutes

2. **Second Postback**:
   - Partner: Partner B
   - Username: Arjun
   - Offer Name: Rovan Offer
   - Points: 40
   - Delay: 10 minutes

**Result**: 
- Don1's postback is sent immediately to Partner A
- After 10 minutes, Arjun's postback is sent to Partner B
- Both results appear in the test log with success/failure status

## API Endpoints

### Send Test Postbacks

```
POST /api/admin/test-postback/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "postbacks": [
    {
      "partner_id": "partner_123",
      "username": "Don1",
      "offer_name": "Zen Offer",
      "points": 30,
      "delay_minutes": 0
    },
    {
      "partner_id": "partner_456",
      "username": "Arjun",
      "offer_name": "Rovan Offer",
      "points": 40,
      "delay_minutes": 10
    }
  ]
}
```

**Response**:
```json
{
  "message": "Test postbacks scheduled successfully",
  "test_id": "test_1234567890",
  "total_postbacks": 2
}
```

### Get Test Logs

```
GET /api/admin/test-postback/logs/{test_id}
Authorization: Bearer <token>
```

**Response**:
```json
{
  "test_id": "test_1234567890",
  "logs": [
    {
      "_id": "log_id_1",
      "test_id": "test_1234567890",
      "partner_id": "partner_123",
      "username": "Don1",
      "offer_name": "Zen Offer",
      "points": 30,
      "success": true,
      "status_code": 200,
      "response_body": "OK",
      "response_time": 0.45,
      "timestamp": "2026-01-16T12:00:00Z"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

## Test Data Format

When sending test postbacks, the following data is included:

```json
{
  "user_id": "username",
  "username": "username",
  "offer_name": "offer_name",
  "offer_id": "test_offer_1234567890",
  "points": "30",
  "payout": "30",
  "status": "approved",
  "conversion_id": "test_conv_1234567890",
  "transaction_id": "test_txn_1234567890",
  "click_id": "test_click_1234567890",
  "timestamp": "1234567890",
  "test_mode": "true"
}
```

## Database Collections

### test_postback_logs

Stores all test postback attempts:

```javascript
{
  test_id: String,           // Batch test identifier
  partner_id: String,        // Partner ID
  username: String,          // Test username
  offer_name: String,        // Test offer name
  points: Number,            // Test points
  success: Boolean,          // Success status
  error: String,             // Error message (if failed)
  status_code: Number,       // HTTP status code
  response_body: String,     // Response body (truncated)
  response_time: Number,     // Response time in seconds
  timestamp: Date            // When postback was sent
}
```

## Technical Details

### Backend Implementation

- **File**: `backend/routes/test_postback.py`
- **Blueprint**: `test_postback_bp`
- **URL Prefix**: `/api/admin`
- **Threading**: Uses background threads for delayed postbacks
- **Timeout**: 10 seconds per request
- **User Agent**: `MoustacheLeads-Test-Postback/1.0`

### Frontend Implementation

- **File**: `src/pages/AdminTestPostback.tsx`
- **Route**: `/admin/test-postback`
- **Auto-refresh**: Polls for logs every 3 seconds when test is active
- **Validation**: Client-side validation before sending

## Best Practices

1. **Start Simple**: Test with one partner first before adding multiple
2. **Use Realistic Data**: Use usernames and offer names similar to production
3. **Check Partner Logs**: Verify postbacks appear in partner's system
4. **Test Both Methods**: If partner supports GET and POST, test both
5. **Monitor Response Times**: Slow responses may indicate partner issues
6. **Document Results**: Keep track of successful configurations

## Troubleshooting

### Postback Not Received

1. Check partner's postback URL is correct
2. Verify partner's server is accessible
3. Check firewall/security settings
4. Review error message in test log

### Timeout Errors

- Partner's server may be slow or down
- Network connectivity issues
- Increase timeout if needed (requires code change)

### Wrong Data Format

- Check partner's parameter mapping
- Verify macro replacements in postback URL
- Review partner's API documentation

## Security

- **Admin Only**: Only administrators can access this feature
- **Authentication Required**: All API calls require valid JWT token
- **Rate Limiting**: Consider implementing if needed
- **Logging**: All test attempts are logged for audit

## Future Enhancements

- [ ] Bulk import test configurations from CSV
- [ ] Save test templates for reuse
- [ ] Schedule recurring tests
- [ ] Email notifications for test results
- [ ] Export test results to PDF/CSV
- [ ] Compare test results over time
- [ ] Test postback retry logic

## Support

For issues or questions:
1. Check test logs for error details
2. Verify partner configuration
3. Review partner's API documentation
4. Contact technical support if needed
