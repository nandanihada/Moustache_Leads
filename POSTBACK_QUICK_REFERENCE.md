# Postback Quick Reference

## Your Postback URL

```
https://moustacheleads-backend.onrender.com/postback/{YOUR_UNIQUE_KEY}
```

Replace `{YOUR_UNIQUE_KEY}` with the unique key provided by admin.

---

## Complete URL with Parameters

```
https://moustacheleads-backend.onrender.com/postback/{YOUR_KEY}?click_id={click_id}&status={status}&payout={payout}&offer_id={offer_id}&transaction_id={transaction_id}
```

---

## Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `click_id` | Our unique click identifier | `CLK-ABC123` |

---

## Recommended Parameters

| Parameter | Description | Example | Default |
|-----------|-------------|---------|---------|
| `status` | Conversion status | `approved`, `pending`, `rejected` | `approved` |
| `payout` | Amount earned (USD) | `42.50` | `0` |
| `offer_id` | Your offer identifier | `SURVEY-123` | - |
| `survey_id` | Alternative to offer_id | `VBFS6` | - |
| `transaction_id` | Your transaction ID | `TXN-XYZ789` | Auto-generated |

---

## All Supported Parameters

### Standard Parameters
- `click_id` ⭐ (required)
- `status` (approved/pending/rejected)
- `payout` (decimal amount)
- `offer_id` or `survey_id`
- `transaction_id`
- `conversion_id`
- `currency` (default: USD)
- `user_id`
- `affiliate_id`
- `campaign_id`

### Sub IDs (for tracking)
- `sub_id`, `sub_id1`, `sub_id2`, `sub_id3`, `sub_id4`, `sub_id5`

### Additional Info
- `country`
- `device_id`
- `ip`
- `user_agent`

### Custom Parameters
- **Any other parameter** you send will be captured in `custom_data`

---

## HTTP Methods

Both **GET** and **POST** are supported.

### GET Example
```
GET https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=CLK123&status=approved&payout=50.00
```

### POST Example (JSON)
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

## Response Codes

- `200 OK` - Success
- `400 Bad Request` - Missing click_id
- `404 Not Found` - Invalid key or click not found
- `500 Internal Server Error` - Server error

---

## Success Response

```json
{
  "status": "success",
  "message": "Postback received and distributed",
  "log_id": "507f1f77bcf86cd799439011"
}
```

---

## Testing

Test your integration:
```
GET https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=TEST-123&status=test&payout=1.00
```

---

## Important Notes

1. **Click ID is required** - Must match a click we generated
2. **Send actual payout** - We'll calculate revenue share automatically
3. **Survey ID mapping** - If you send `survey_id`, we'll match it to our offer's `campaign_id`
4. **Timing** - Send postbacks immediately after conversion
5. **Security** - Keep your unique key confidential

---

## Need Help?

Contact your account manager with:
- Your unique postback key
- Example postback URL
- Any error messages
