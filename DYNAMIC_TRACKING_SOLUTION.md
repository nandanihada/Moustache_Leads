# Dynamic Tracking Parameters - Complete Solution Guide

## 🎯 Problem Statement

You need to integrate with multiple upward partners (LeadAds, CPALead, etc.) who each have different requirements for tracking users. Each partner needs to know which user completed their offer, but they use different parameter names (`aff_sub`, `subid`, `s1`, etc.).

## ✅ The Solution: Dynamic URL Macros

Instead of hardcoding user IDs, we use **macros** (placeholders) in the offer URLs that get replaced with actual values when a user clicks.

### Example Flow

**1. Admin adds offer with macro:**
```
Target URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
```

**2. User "john123" (ID: 507f1f77bcf86cd799439011) clicks offer:**
```
System generates: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub=507f1f77bcf86cd799439011
```

**3. User completes offer, LeadAds sends postback:**
```
GET https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
```

**4. System matches conversion:**
```
- Extracts aff_sub=507f1f77bcf86cd799439011
- Finds user with that ID
- Credits conversion to user
```

---

## 📋 Supported Macros

### User Macros
| Macro | Description | Example Value |
|-------|-------------|---------------|
| `{user_id}` | MongoDB user ID | `507f1f77bcf86cd799439011` |
| `{username}` | User's username | `john123` |
| `{user_email}` | User's email | `john@example.com` |

### Click Macros
| Macro | Description | Example Value |
|-------|-------------|---------------|
| `{click_id}` | Our unique click ID | `CLK-ABC123` |
| `{session_id}` | Offerwall session ID | `sess-xyz789` |
| `{timestamp}` | Unix timestamp | `1735574400` |

### Placement Macros
| Macro | Description | Example Value |
|-------|-------------|---------------|
| `{placement_id}` | Offerwall placement | `wall-001` |
| `{publisher_id}` | Publisher ID | `pub-123` |

### Device/Geo Macros
| Macro | Description | Example Value |
|-------|-------------|---------------|
| `{country}` | Country code | `US` |
| `{device_type}` | Device type | `mobile` |
| `{ip_address}` | User's IP | `192.168.1.1` |

---

## 🔧 How to Use: Manual Offer Creation

### Step 1: Get Partner's URL Template
Partner gives you: `https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub=UNIQUE_USER_ID`

### Step 2: Replace Their Placeholder with Our Macro
Change `UNIQUE_USER_ID` to `{user_id}`:
```
https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
```

### Step 3: Add Offer in Admin Panel
- **Target URL**: `https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}`
- **Campaign ID**: `75999` (their offer ID)
- **Payout**: `$10.00`
- **Partner**: LeadAds

### Step 4: Configure Partner Postback
Give LeadAds your postback URL with their macros:
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

---

## 📊 How to Use: Bulk Upload

### CSV Format

```csv
campaign_id,title,url,country,payout,description,platform
75999,LeadAds Survey,https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id},US,$10.00,Complete survey,LeadAds
12345,CPALead Offer,https://cpalead.com/offer?id=12345&subid={user_id}&s2={click_id},US,$5.00,Install app,CPALead
67890,Generic Partner,https://partner.com/offer?oid=67890&s1={user_id}&s2={placement_id},GB,£3.50,Sign up,GenericNet
```

### Key Points
1. ✅ **Keep macros in the URL** - Don't replace them with actual values
2. ✅ **Use curly braces** - `{user_id}` not `USER_ID`
3. ✅ **Multiple macros OK** - You can use several in one URL
4. ✅ **Works with all upload methods** - CSV, Excel, Google Sheets

---

## 🔄 Partner-Specific Examples

### LeadAds
```
Target URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
Postback URL: https://your-backend.com/postback/YOUR_KEY?aff_sub={aff_sub}&status={status}&payout={payout}
Partner Config:
  - user_param: "aff_sub"
  - postback_user_param: "aff_sub"
```

### CPALead
```
Target URL: https://cpalead.com/offer?id=12345&subid={user_id}&s2={click_id}
Postback URL: https://your-backend.com/postback/YOUR_KEY?subid={subid}&status={status}&payout={payout}
Partner Config:
  - user_param: "subid"
  - postback_user_param: "subid"
```

### OfferToro
```
Target URL: https://offertoro.com/ifr/show/123?user_id={user_id}&pub_id=456
Postback URL: https://your-backend.com/postback/YOUR_KEY?user_id={user_id}&status={status}&amount={amount}
Partner Config:
  - user_param: "user_id"
  - postback_user_param: "user_id"
```

### AdGate Media
```
Target URL: https://adgatemedia.com/wall/123?subid={user_id}&subid2={placement_id}
Postback URL: https://your-backend.com/postback/YOUR_KEY?subid={subid}&status={status}&payout={payout}
Partner Config:
  - user_param: "subid"
  - postback_user_param: "subid"
```

---

## 🏗️ Implementation Plan

### Phase 1: Core Macro System ✅ (Spec Created)
- [x] Create requirements document
- [ ] Design macro replacement engine
- [ ] Implement macro parser
- [ ] Add macro validation
- [ ] Test with sample URLs

### Phase 2: Bulk Upload Integration
- [ ] Update bulk upload parser to preserve macros
- [ ] Add macro examples to CSV template
- [ ] Update validation to allow macros in URLs
- [ ] Add macro documentation to bulk upload guide
- [ ] Test bulk upload with macro URLs

### Phase 3: Postback Parameter Mapping
- [ ] Create partner configuration model
- [ ] Implement custom parameter extraction
- [ ] Add fallback matching logic (user_id + offer_id)
- [ ] Log all postback parameters for debugging
- [ ] Test with multiple partner formats

### Phase 4: Admin UI
- [ ] Add macro helper in offer creation form
- [ ] Create partner configuration page
- [ ] Add macro testing tool
- [ ] Display postback logs in admin panel
- [ ] Add partner integration wizard

### Phase 5: Documentation & Testing
- [ ] Complete macro documentation
- [ ] Create partner integration guides
- [ ] Add test mode for URL generation
- [ ] Create troubleshooting guide
- [ ] Test with real partners

---

## 🎓 Best Practices

### For Admins

1. **Always use macros for user tracking**
   - ❌ Bad: `url=https://partner.com?user=12345`
   - ✅ Good: `url=https://partner.com?user={user_id}`

2. **Include click_id when possible**
   - ✅ `url=https://partner.com?uid={user_id}&cid={click_id}`
   - This provides a backup matching method

3. **Document partner requirements**
   - Note which parameter they use for user tracking
   - Note which parameter they send in postbacks
   - Save example URLs

4. **Test before going live**
   - Use test mode to verify URL generation
   - Send test postback to verify matching
   - Check postback logs for issues

### For Developers

1. **URL-encode all macro values**
   - Prevents injection attacks
   - Handles special characters

2. **Log everything**
   - Log macro replacements
   - Log postback parameters
   - Log matching attempts

3. **Provide fallback matching**
   - Primary: click_id
   - Secondary: user_id + offer_id + timestamp
   - Tertiary: Custom parameter extraction

4. **Validate partner configs**
   - Ensure required fields are present
   - Test postback parameter extraction
   - Verify user_id format

---

## 🐛 Troubleshooting

### Issue: "User not found in postback"
**Cause:** Partner sent back a parameter we don't recognize
**Solution:** 
1. Check postback logs for all received parameters
2. Verify partner configuration has correct `postback_user_param`
3. Ensure the parameter value matches a real user_id

### Issue: "Macro not replaced in URL"
**Cause:** Macro name is misspelled or not supported
**Solution:**
1. Check macro spelling: `{user_id}` not `{userid}`
2. Verify macro is in supported list
3. Check logs for macro replacement warnings

### Issue: "Conversion not credited"
**Cause:** Postback matching failed
**Solution:**
1. Check if click_id was sent in postback
2. Verify user_id format matches MongoDB ObjectId
3. Check if click record exists in database
4. Review postback logs for matching attempts

### Issue: "Bulk upload rejects URLs with macros"
**Cause:** URL validation is too strict
**Solution:**
1. Update URL regex to allow `{` and `}` characters
2. Skip macro validation during bulk upload
3. Validate macros after URL structure is confirmed

---

## 📞 Next Steps

1. **Review the requirements document**: `.kiro/specs/dynamic-tracking-parameters/requirements.md`
2. **Approve the requirements**: Confirm this approach works for your needs
3. **Move to design phase**: Create detailed technical design
4. **Implement in phases**: Start with core macro system
5. **Test with real partners**: Verify with LeadAds first

---

## 🎯 Summary

**The Solution:**
- Use `{user_id}` and other macros in offer URLs
- System replaces macros when user clicks
- Partner sends back the value in postback
- System matches conversion to user

**Benefits:**
- ✅ Works with ANY partner
- ✅ Supports bulk upload
- ✅ No code changes per partner
- ✅ Flexible and scalable
- ✅ Easy to test and debug

**Your LeadAds Example:**
```
Offer URL: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}
Postback URL: https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub={aff_sub}&status={status}&payout={payout}
```

This will work perfectly! 🎉
