# Dynamic Macro Tracking - Implementation Guide

## ✅ Implementation Complete!

The dynamic macro tracking system is now implemented and ready to use!

## 🎯 What Was Implemented

### 1. Macro Replacement Service
- **File**: `backend/services/macro_replacement_service.py`
- Replaces macros like `{user_id}`, `{click_id}` in URLs
- URL-encodes values for security
- Logs all replacements for debugging
- Validates macro names

### 2. Bulk Upload Support
- **File**: `backend/utils/bulk_offer_upload.py`
- Updated URL validation to allow macros
- Preserves `{macro}` patterns in URLs
- Works with CSV, Excel, and Google Sheets

### 3. Offerwall Integration
- **File**: `backend/routes/simple_tracking.py`
- Automatically replaces macros when users click offers
- Generates unique click_id for each click
- Logs macro replacements

### 4. Sample CSV with Macros
- **File**: `backend/sample_bulk_upload_with_macros.csv`
- Examples for LeadAds, CPALead, OfferToro, AdGate
- Shows different macro patterns

### 5. Testing Script
- **File**: `backend/test_macro_replacement.py`
- Tests all macro replacement scenarios
- Validates macro detection and validation

---

## 🚀 How to Use

### Step 1: Test the Macro System

Run the test script to verify everything works:

```bash
cd backend
python test_macro_replacement.py
```

You should see output showing macro replacements working correctly.

### Step 2: Add Offers with Macros

#### Option A: Manual Entry
In your admin panel, add an offer with macros in the URL:

```
Campaign ID: 75999
Title: LeadAds Test Survey
Target URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
Payout: $10.00
Country: US
```

#### Option B: Bulk Upload
Upload the sample CSV:

```bash
# Use the sample file
backend/sample_bulk_upload_with_macros.csv
```

Or create your own CSV with macros:

```csv
campaign_id,title,url,country,payout,description,platform
75999,Survey,https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id},US,$10.00,Survey,LeadAds
```

### Step 3: Test with Real User

1. **Add the offer** (with macros in URL)
2. **Have a user click** the offer in your offerwall
3. **Check the logs** to see macro replacement:

```bash
# Check backend logs
tail -f backend/logs/app.log | grep "Macro"
```

You should see:
```
🔄 Replacing macros in URL for offer 75999
   {user_id} → 507f1f77bcf86cd799439011
✅ Macros replaced. Final URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub=507f1f77bcf86cd799439011
```

### Step 4: Configure Partner Postback

Give your partner (e.g., LeadAds) this postback URL:

```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

**Explain to them:**
- `{aff_sub}` - They should pass back the value they received in `aff_sub` parameter
- `{status}` - approved/pending/rejected
- `{payout}` - Amount they're paying
- `{transaction_id}` - Their transaction ID

---

## 📋 Supported Macros

| Macro | Description | Example Value |
|-------|-------------|---------------|
| `{user_id}` | MongoDB user ID | `507f1f77bcf86cd799439011` |
| `{username}` | User's username | `john123` |
| `{user_email}` | User's email | `john@example.com` |
| `{click_id}` | Unique click ID | `CLK-ABC123` |
| `{session_id}` | Offerwall session | `sess-xyz789` |
| `{placement_id}` | Placement ID | `wall-001` |
| `{publisher_id}` | Publisher ID | `pub-123` |
| `{timestamp}` | Unix timestamp | `1735574400` |
| `{country}` | Country code | `US` |
| `{device_type}` | Device type | `mobile` |
| `{ip_address}` | User's IP | `192.168.1.1` |
| `{offer_id}` | Offer ID | `OFFER-123` |

---

## 🔄 Complete Flow Example

### 1. You Add Offer
```csv
75999,LeadAds Survey,https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id},US,$10.00,Survey,LeadAds
```

### 2. User "Alice" (ID: 507f1f77bcf86cd799439011) Clicks
System generates:
```
https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub=507f1f77bcf86cd799439011
```

### 3. Alice Completes Offer

### 4. LeadAds Sends Postback
```
GET https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
```

### 5. Your System Credits Alice
- Extracts `aff_sub=507f1f77bcf86cd799439011`
- Finds user with that ID
- Credits $10.00 to Alice
- ✅ Done!

---

## 🧪 Testing Checklist

- [ ] Run `python backend/test_macro_replacement.py` - All tests pass
- [ ] Upload sample CSV with macros - No validation errors
- [ ] Add offer manually with `{user_id}` in URL - Saves successfully
- [ ] User clicks offer - Logs show macro replacement
- [ ] Check final URL - Contains actual user_id, not `{user_id}`
- [ ] Partner sends postback - Conversion credited to correct user

---

## 🐛 Troubleshooting

### Issue: "Unreplaced macros found in URL"
**Cause:** Typo in macro name or unsupported macro
**Solution:** Check spelling - use `{user_id}` not `{userid}`

### Issue: "URL validation failed"
**Cause:** Bulk upload validator rejecting macros
**Solution:** Already fixed! Validator now allows `{` and `}` characters

### Issue: "User not found in postback"
**Cause:** Partner not sending back the parameter
**Solution:** 
1. Check postback logs for received parameters
2. Verify partner is using correct postback URL
3. Confirm they're passing back the value they received

### Issue: "Macro not replaced"
**Cause:** Macro service not imported or context missing value
**Solution:**
1. Check logs for macro replacement messages
2. Verify context has the required value
3. Ensure `macro_service` is imported in the route

---

## 📊 Monitoring

### Check Macro Replacements
```bash
# See all macro replacements
tail -f backend/logs/app.log | grep "🔄 Macro"
```

### Check Postback Parameters
```bash
# See postback parameters received
tail -f backend/logs/app.log | grep "postback"
```

### Check Click Records
```python
# In Python shell
from database import db_instance
clicks = db_instance.get_collection('clicks')

# Get recent clicks
recent = clicks.find().sort('timestamp', -1).limit(10)
for click in recent:
    print(f"User: {click['user_id']}, Offer: {click['offer_id']}, Click ID: {click['click_id']}")
```

---

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Bulk upload accepts URLs with `{user_id}`
2. ✅ Logs show "🔄 Replacing macros in URL"
3. ✅ Final redirect URL has actual user_id, not `{user_id}`
4. ✅ Partner postback contains the user_id
5. ✅ Conversion is credited to the correct user

---

## 🔗 Partner-Specific Examples

### LeadAds
```
Offer URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
Postback: https://your-backend.com/postback/KEY?aff_sub={aff_sub}&status={status}&payout={payout}
```

### CPALead
```
Offer URL: https://cpalead.com/offer?id=12345&subid={user_id}&s2={click_id}
Postback: https://your-backend.com/postback/KEY?subid={subid}&status={status}&payout={payout}
```

### OfferToro
```
Offer URL: https://offertoro.com/ifr/show/67890?user_id={user_id}&pub_id=456
Postback: https://your-backend.com/postback/KEY?user_id={user_id}&status={status}&amount={amount}
```

### AdGate Media
```
Offer URL: https://adgatemedia.com/wall/123?subid={user_id}&subid2={placement_id}
Postback: https://your-backend.com/postback/KEY?subid={subid}&status={status}&payout={payout}
```

---

## 📞 Next Steps

1. **Test the system** with the test script
2. **Upload sample CSV** to verify bulk upload works
3. **Add one real offer** from LeadAds with macros
4. **Have a test user click** and verify macro replacement
5. **Configure LeadAds postback** and test end-to-end
6. **Scale up** - add all 100 offers with confidence!

---

## 🎯 Summary

**What you can do now:**
- ✅ Add offers with `{user_id}` in URLs (manual or bulk)
- ✅ System automatically replaces macros when users click
- ✅ Works with ANY partner (LeadAds, CPALead, etc.)
- ✅ Supports multiple macros in one URL
- ✅ Secure (URL-encodes all values)
- ✅ Debuggable (logs all replacements)

**The system is ready to use!** 🚀
