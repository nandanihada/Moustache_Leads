# Postback Integration Guide for Upward Partners

## Overview
This document provides the postback URL and parameters that upward partners need to send conversion notifications to our system.

---

## Postback URL Format

### Base URL
```
https://moustacheleads-backend.onrender.com/postback/{unique_key}
```

Replace `{unique_key}` with your unique postback key provided by our admin team.

### Complete Example URL
```
https://moustacheleads-backend.onrender.com/postback/YOUR_UNIQUE_KEY?click_id={click_id}&status={status}&payout={payout}&offer_id={offer_id}&transaction_id={transaction_id}
```

---

## Supported Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `click_id` | String | Unique click identifier we provided in the tracking URL | `CLK-ABC123` |

### Standard Optional Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | String | Conversion status: `approved`, `pending`, `rejected` | `approved` |
| `payout` | Decimal | Amount earned from this conversion (in USD or specified currency) | `42.50` |
| `offer_id` | String | Your offer/survey identifier | `SURVEY-123` |
| `survey_id` | String | Alternative to offer_id for survey partners | `VBFS6` |
| `transaction_id` | String | Your unique transaction identifier | `TXN-XYZ789` |
| `conversion_id` | String | Your conversion identifier | `CONV-456` |
| `currency` | String | Currency code (default: USD) | `USD` |
| `user_id` | String | End user identifier | `USER-123` |
| `affiliate_id` | String | Affiliate identifier | `AFF-456` |
| `campaign_id` | String | Campaign identifier | `CAMP-789` |

### Sub ID Parameters (for tracking)

| Parameter | Type | Description |
|-----------|------|-------------|
| `sub_id` | String | General sub ID |
| `sub_id1` | String | Sub ID 1 (placement_id) |
| `sub_id2` | String | Sub ID 2 (username) |
| `sub_id3` | String | Sub ID 3 |
| `sub_id4` | String | Sub ID 4 |
| `sub_id5` | String | Sub ID 5 |

### Additional Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `country` | String | User's country code |
| `device_id` | String | Device identifier |
| `ip` | String | User's IP address |
| `user_agent` | String | User's browser user agent |

### Custom Parameters
You can send **any additional parameters** you want - they will all be captured in our system under `custom_data`. This is useful for:
- Survey responses
- User demographics
- Session information
- Any partner-specific data

---

## HTTP Methods Supported

Both **GET** and **POST** methods are supported:

### GET Request (Query Parameters)
```
GET https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=CLK123&status=approved&payout=50.00
```

### POST Request (Form Data or JSON)
```
POST https://moustacheleads-backend.onrender.com/postback/YOUR_KEY
Content-Type: application/x-www-form-urlencoded

click_id=CLK123&status=approved&payout=50.00
```

Or with JSON:
```
POST https://moustacheleads-backend.onrender.com/postback/YOUR_KEY
Content-Type: application/json

{
  "click_id": "CLK123",
  "status": "approved",
  "payout": 50.00,
  "offer_id": "SURVEY-456"
}
```

---

## Parameter Macros

When setting up your postback URL, use these macros that will be replaced with actual values:

| Macro | Description |
|-------|-------------|
| `{click_id}` | Our unique click identifier |
| `{status}` | Conversion status |
| `{payout}` | Payout amount |
| `{offer_id}` | Offer/survey identifier |
| `{transaction_id}` | Transaction identifier |
| `{user_id}` | User identifier |
| `{conversion_id}` | Conversion identifier |

### Example with Macros
```
https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id={click_id}&status={status}&payout={payout}&offer_id={offer_id}&transaction_id={transaction_id}
```

---

## Response Codes

| Status Code | Meaning |
|-------------|---------|
| `200 OK` | Postback received and processed successfully |
| `400 Bad Request` | Missing required parameters |
| `404 Not Found` | Invalid unique key or click not found |
| `500 Internal Server Error` | Server error processing postback |
| `503 Service Unavailable` | Database connection issue |

### Success Response
```json
{
  "status": "success",
  "message": "Postback received and distributed",
  "log_id": "507f1f77bcf86cd799439011"
}
```

---

## Revenue Share Model

Our system supports two payout models:

### 1. Percentage-Based Revenue Share
If an offer has `revenue_share_percent` configured (e.g., 80%), we calculate:
```
Downward Payout = Upward Payout × (Revenue Share % / 100)
Example: $100 × 80% = $80 to affiliate
```

### 2. Fixed Payout
If no revenue share is configured, we use the offer's fixed payout amount regardless of what you send.

**Important:** Always send the actual payout amount you're paying us in the `payout` parameter. Our system will automatically calculate what to pay downstream based on the offer's revenue share settings.

---

## Integration Examples

### Example 1: Basic Conversion
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-789&status=approved&payout=25.00&offer_id=SURVEY-001
```

### Example 2: Survey with Custom Data
```
POST https://moustacheleads-backend.onrender.com/postback/abc123xyz
Content-Type: application/json

{
  "click_id": "CLK-789",
  "status": "approved",
  "payout": 30.00,
  "survey_id": "VBFS6",
  "transaction_id": "TXN-12345",
  "user_age": 25,
  "user_country": "US",
  "completion_time": "180",
  "survey_responses": "{\"q1\":\"yes\",\"q2\":\"no\"}"
}
```

### Example 3: Pending Conversion
```
GET https://moustacheleads-backend.onrender.com/postback/abc123xyz?click_id=CLK-789&status=pending&payout=15.00&offer_id=OFFER-456
```

---

## Testing Your Integration

### Test Endpoint
```
GET https://moustacheleads-backend.onrender.com/api/analytics/postback/test
```

This returns information about the postback endpoint to verify it's online.

### Test Postback
Send a test postback with `status=test` to verify your integration:
```
GET https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=TEST-123&status=test&payout=1.00
```

---

## What Happens When You Send a Postback?

1. **Received & Logged**: Your postback is logged in `received_postbacks` collection
2. **Conversion Created**: A conversion record is automatically created
3. **Click Updated**: The original click is marked as converted
4. **Payout Calculated**: Revenue share is calculated based on offer settings
5. **Forwarded**: Postback is forwarded to the specific publisher whose offerwall was used
6. **Points Updated**: User points are updated if the conversion is approved

---

## Important Notes

### Click ID Matching
- The `click_id` parameter MUST match a click_id we generated when the user clicked the offer
- Click IDs are unique and can only be used once
- If no click_id is provided, we'll try to match using `offer_id` + recent timestamp

### Survey ID Mapping
- If you send `survey_id` instead of our `offer_id`, we'll look up the offer by matching `survey_id` to `campaign_id` in our offers table
- Make sure the offer's `campaign_id` field is set to your survey ID

### Timing
- Postbacks should be sent as soon as the conversion occurs
- We look for clicks within the last 1 hour when matching by offer_id
- Older clicks may not be matched automatically

### Security
- Your unique postback key should be kept confidential
- Each partner gets a unique key
- Keys can be regenerated if compromised

---

## Support

If you have questions or need assistance with integration:
1. Contact your account manager
2. Provide your unique postback key
3. Share example postback URLs you're sending
4. Include any error messages you receive

---

## Changelog

- **v1.0** - Initial postback system with basic parameters
- **v2.0** - Added revenue share calculation
- **v2.1** - Added support for survey_id → campaign_id mapping
- **v2.2** - Enhanced custom data capture for all parameters
