# How to Get Your Unique Postback Key

## For Upward Partners

Your unique postback key is required to receive conversion notifications. Here's how to get it:

---

## Option 1: Request from Admin

Contact your account manager or admin team and request:
- **Unique Postback Key** for your partner account
- **Complete Postback URL** with your key

They will provide you with:
```
Unique Key: abc123xyz456
Postback URL: https://moustacheleads-backend.onrender.com/postback/abc123xyz456
```

---

## Option 2: Admin Panel (For Admins)

If you have admin access to the system:

### Generate Key for Partner

1. **Login to Admin Panel**
   - Navigate to Partners section

2. **Select Partner**
   - Find the partner who needs a postback key

3. **Generate Unique Key**
   ```
   POST /api/admin/postback-receiver/generate-key
   Authorization: Bearer {admin_token}
   Content-Type: application/json

   {
     "partner_id": "PARTNER-123"
   }
   ```

4. **Response**
   ```json
   {
     "success": true,
     "unique_key": "abc123xyz456",
     "postback_url": "https://moustacheleads-backend.onrender.com/postback/abc123xyz456"
   }
   ```

### Generate Quick Postback (No Partner Required)

For testing or standalone integrations:

```
POST /api/admin/postback-receiver/generate-quick
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "parameters": ["click_id", "status", "payout", "offer_id"],
  "custom_params": ["transaction_id", "user_age"]
}
```

**Response:**
```json
{
  "success": true,
  "unique_key": "xyz789abc123",
  "base_url": "https://moustacheleads-backend.onrender.com/postback/xyz789abc123",
  "full_url": "https://moustacheleads-backend.onrender.com/postback/xyz789abc123?click_id={click_id}&status={status}&payout={payout}&offer_id={offer_id}&transaction_id={transaction_id}&user_age={user_age}",
  "parameters": ["click_id", "status", "payout", "offer_id", "transaction_id", "user_age"]
}
```

---

## Option 3: Database Direct (For Developers)

If you have database access:

### Check Existing Key

```javascript
// MongoDB query
db.partners.findOne(
  { partner_id: "PARTNER-123" },
  { unique_postback_key: 1, postback_receiver_url: 1 }
)
```

### Generate and Save Key

```python
import secrets

# Generate unique key
unique_key = secrets.token_urlsafe(24)

# Update partner
partners_collection.update_one(
    {'partner_id': 'PARTNER-123'},
    {
        '$set': {
            'unique_postback_key': unique_key,
            'postback_receiver_url': f'https://moustacheleads-backend.onrender.com/postback/{unique_key}',
            'updated_at': datetime.utcnow()
        }
    }
)

print(f"Unique Key: {unique_key}")
print(f"Postback URL: https://moustacheleads-backend.onrender.com/postback/{unique_key}")
```

---

## Testing Your Key

Once you have your unique key, test it:

### Test Request
```bash
curl "https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=TEST-123&status=test&payout=1.00"
```

### Expected Response
```json
{
  "status": "success",
  "message": "Postback received and distributed",
  "log_id": "507f1f77bcf86cd799439011"
}
```

### Check Logs (Admin Only)
```
GET /api/admin/received-postbacks?unique_key=YOUR_KEY
Authorization: Bearer {admin_token}
```

---

## Security Best Practices

### Keep Your Key Secret
- ✅ Store in environment variables
- ✅ Use HTTPS only
- ✅ Don't commit to version control
- ❌ Don't share publicly
- ❌ Don't log in plain text

### Key Rotation
If your key is compromised:
1. Contact admin immediately
2. Request new key generation
3. Update your integration
4. Old key will be deactivated

### Example: Secure Storage
```python
# .env file
POSTBACK_KEY=abc123xyz456
POSTBACK_URL=https://moustacheleads-backend.onrender.com/postback/abc123xyz456

# In your code
import os
postback_key = os.getenv('POSTBACK_KEY')
postback_url = os.getenv('POSTBACK_URL')
```

---

## Multiple Keys

You can have multiple keys for different purposes:

### Production Key
```
Key: prod_abc123xyz
URL: https://moustacheleads-backend.onrender.com/postback/prod_abc123xyz
Use: Live conversions
```

### Staging Key
```
Key: staging_def456uvw
URL: https://moustacheleads-backend.onrender.com/postback/staging_def456uvw
Use: Testing and development
```

### Backup Key
```
Key: backup_ghi789rst
URL: https://moustacheleads-backend.onrender.com/postback/backup_ghi789rst
Use: Failover if primary fails
```

---

## Troubleshooting

### "Invalid postback key" Error
- ✅ Verify you're using the correct key
- ✅ Check for typos or extra spaces
- ✅ Confirm key hasn't been deactivated
- ✅ Contact admin to verify key status

### "Postback not received" Issue
- ✅ Check your firewall/network settings
- ✅ Verify HTTPS is being used
- ✅ Test with curl command
- ✅ Check admin logs for received postbacks

### Key Not Working After Generation
- ✅ Wait 1-2 minutes for propagation
- ✅ Clear any caches
- ✅ Test with simple GET request
- ✅ Contact support if still failing

---

## API Endpoints Reference

### Generate Key for Partner
```
POST /api/admin/postback-receiver/generate-key
```

### Generate Quick Postback
```
POST /api/admin/postback-receiver/generate-quick
```

### View Received Postbacks
```
GET /api/admin/received-postbacks
GET /api/admin/received-postbacks?unique_key={key}
GET /api/admin/received-postbacks?partner_id={partner_id}
```

### View Postback Details
```
GET /api/admin/received-postbacks/{log_id}
```

### Test Postback
```
POST /api/admin/postback-receiver/test
```

All admin endpoints require:
```
Authorization: Bearer {admin_token}
```

---

## Next Steps

After getting your unique key:

1. ✅ Test with sample postback
2. ✅ Review parameter documentation
3. ✅ Implement in your system
4. ✅ Test with real conversion
5. ✅ Monitor logs for issues
6. ✅ Set up error handling

---

## Support

Need help getting your key?

**Contact:**
- Account Manager: [Your account manager's contact]
- Technical Support: [Support email/phone]
- Documentation: See `POSTBACK_INTEGRATION_GUIDE.md`

**Provide:**
- Your partner ID
- Company name
- Integration timeline
- Any special requirements
