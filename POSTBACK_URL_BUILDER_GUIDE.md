# Postback URL Builder - User Guide

## 🎯 What Problem Does This Solve?

**Before (Confused):**
```
❌ "LeadAds needs aff_sub... what do I put?"
❌ "CPALead uses subid... how do I map it?"
❌ "I keep forgetting which parameter goes where"
❌ "How do I generate the postback URL?"
```

**After (Clear):**
```
✅ Visual UI shows OUR parameters → THEIR parameters
✅ Select partner template (LeadAds, CPALead, etc.)
✅ See the mapping clearly
✅ Copy generated URL with one click
✅ No more confusion!
```

---

## 📋 How to Use the Postback URL Builder

### Step 1: Access the Builder

Go to: **Admin Panel → Integration → Postback URL Builder**

(Or add it to your Partners page)

### Step 2: Select Partner Template

```
┌─────────────────────────────────┐
│ Select Partner Template         │
│ [LeadAds ▼]                     │
└─────────────────────────────────┘
```

Choose from:
- **LeadAds** - Pre-configured for LeadAds
- **CPALead** - Pre-configured for CPALead
- **OfferToro** - Pre-configured for OfferToro
- **AdGate Media** - Pre-configured for AdGate
- **Custom** - Create your own mapping

### Step 3: Enter Your Postback Key

```
┌─────────────────────────────────────────┐
│ Your Postback Key                       │
│ [-3YJWcgL-TnlNnscehd5j23IbVZRJHUY]     │
└─────────────────────────────────────────┘
```

This is the unique key for this specific partner.

### Step 4: Review/Edit Parameter Mapping

```
┌──────────────────────────────────────────────────────┐
│ ☑ | Our Parameter  →  Their Parameter  | Actions   │
├──────────────────────────────────────────────────────┤
│ ☑ | user_id        →  aff_sub          | [Delete]  │
│ ☑ | status         →  status           | [Delete]  │
│ ☑ | payout         →  payout           | [Delete]  │
│ ☑ | transaction_id →  transaction_id   | [Delete]  │
└──────────────────────────────────────────────────────┘
```

**What each column means:**
- **☑ Checkbox**: Enable/disable this parameter
- **Our Parameter**: What WE call it internally
- **→ Arrow**: Visual mapping indicator
- **Their Parameter**: What THEY call it (partner's name)
- **Actions**: Delete this mapping

### Step 5: Copy Generated URL

```
┌────────────────────────────────────────────────────┐
│ Generated Postback URL                             │
│ ┌────────────────────────────────────────────────┐ │
│ │ https://moustacheleads.com/postback/KEY?       │ │
│ │ aff_sub={aff_sub}&                             │ │
│ │ status={status}&                               │ │
│ │ payout={payout}&                               │ │
│ │ transaction_id={transaction_id}                │ │
│ └────────────────────────────────────────────────┘ │
│                                          [Copy 📋] │
└────────────────────────────────────────────────────┘
```

Click **Copy** button to copy the URL to clipboard.

### Step 6: Give URL to Partner

Send the copied URL to your partner (LeadAds, CPALead, etc.)

---

## 💡 Real Examples

### Example 1: LeadAds

**Partner Template:** LeadAds

**Mapping:**
```
user_id        →  aff_sub
status         →  status
payout         →  payout
transaction_id →  transaction_id
```

**Generated URL:**
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

**What LeadAds Does:**
They replace `{aff_sub}` with the actual user_id they received from your offer URL.

**Example Postback from LeadAds:**
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00&transaction_id=TXN-123
```

✅ Your system extracts `aff_sub=507f1f77bcf86cd799439011` and credits that user!

---

### Example 2: CPALead

**Partner Template:** CPALead

**Mapping:**
```
user_id   →  subid
click_id  →  s2
status    →  status
payout    →  payout
```

**Generated URL:**
```
https://moustacheleads-backend.onrender.com/postback/KEY?subid={subid}&s2={s2}&status={status}&payout={payout}
```

**What CPALead Does:**
They replace `{subid}` with user_id and `{s2}` with click_id.

**Example Postback from CPALead:**
```
https://moustacheleads-backend.onrender.com/postback/KEY?subid=507f1f77bcf86cd799439011&s2=CLK-ABC123&status=approved&payout=5.00
```

✅ Your system extracts `subid=507f1f77bcf86cd799439011` and credits that user!

---

### Example 3: Custom Partner

**Partner Template:** Custom

**Mapping (you create):**
```
user_id        →  uid
click_id       →  cid
payout         →  amount
status         →  conv_status
transaction_id →  txn
```

**Generated URL:**
```
https://moustacheleads-backend.onrender.com/postback/KEY?uid={uid}&cid={cid}&amount={amount}&conv_status={conv_status}&txn={txn}
```

---

## 🎨 UI Features

### 1. Partner Templates
Pre-configured mappings for common partners:
- ✅ LeadAds (aff_sub)
- ✅ CPALead (subid)
- ✅ OfferToro (user_id)
- ✅ AdGate Media (subid)
- ✅ Custom (create your own)

### 2. Visual Mapping
See the parameter mapping clearly:
```
user_id  →  aff_sub
```
No more confusion about which parameter maps to what!

### 3. Enable/Disable Parameters
Use checkboxes to enable/disable specific parameters without deleting them.

### 4. Add/Remove Parameters
- Click **+ Add Parameter** to add more mappings
- Click **🗑️ Delete** to remove a mapping

### 5. One-Click Copy
Click **Copy** button to copy the generated URL to clipboard.

### 6. Save Configuration
Click **Save Partner Config** to save the mapping for future use.

---

## 🔄 Complete Workflow

### 1. You Configure Mapping
```
In UI:
user_id → aff_sub
```

### 2. You Generate Postback URL
```
https://moustacheleads.com/postback/KEY?aff_sub={aff_sub}&status={status}&payout={payout}
```

### 3. You Give URL to Partner
Send the URL to LeadAds

### 4. You Add Offer with Macro
```
Offer URL: https://leadads.com/offer?id=123&aff_sub={user_id}
```

### 5. User Clicks Offer
```
System generates: https://leadads.com/offer?id=123&aff_sub=507f1f77bcf86cd799439011
```

### 6. Partner Sends Postback
```
https://moustacheleads.com/postback/KEY?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
```

### 7. System Credits User
```
Extract aff_sub=507f1f77bcf86cd799439011
Find user with that ID
Credit $10.00
✅ Done!
```

---

## 📊 Available Parameters

### Our Parameters (Left Side)

| Parameter | Description |
|-----------|-------------|
| `user_id` | User's MongoDB ID (most important!) |
| `click_id` | Unique click identifier |
| `payout` | Conversion payout amount |
| `status` | Conversion status (approved/pending/rejected) |
| `transaction_id` | Transaction identifier |
| `offer_id` | Offer identifier |
| `conversion_id` | Conversion identifier |
| `currency` | Currency code (USD, EUR, etc.) |

### Their Parameters (Right Side)

You enter what the partner calls it:
- `aff_sub` (LeadAds)
- `subid` (CPALead, AdGate)
- `user_id` (OfferToro)
- `s1`, `s2`, `s3` (Generic)
- Any custom name

---

## 🎯 Benefits

### Before This UI:
❌ Manual URL construction
❌ Easy to make mistakes
❌ Hard to remember partner-specific parameters
❌ Confusion about parameter names
❌ No visual confirmation

### After This UI:
✅ Visual parameter mapping
✅ Partner templates
✅ One-click copy
✅ No mistakes
✅ Clear understanding
✅ Save configurations

---

## 🚀 How to Add to Your Admin Panel

### Option 1: Standalone Page

Add a new route in your admin panel:
```tsx
// In your router
<Route path="/integration/postback-builder" element={<PostbackURLBuilder />} />
```

### Option 2: Add to Partners Page

Import and use in your Partners management page:
```tsx
import PostbackURLBuilder from '@/components/PostbackURLBuilder';

// In your Partners page
<PostbackURLBuilder />
```

### Option 3: Modal/Popup

Show as a modal when creating a new partner:
```tsx
<Dialog>
  <PostbackURLBuilder />
</Dialog>
```

---

## 💡 Tips

1. **Use Templates First**: Start with a partner template (LeadAds, CPALead) before creating custom mappings

2. **Test the URL**: Copy the generated URL and test it with curl to verify it works

3. **Save Configurations**: Click "Save Partner Config" to reuse the mapping later

4. **Document It**: Keep a note of which parameter names each partner uses

5. **Check Partner Docs**: Verify the parameter names in the partner's documentation

---

## 🐛 Troubleshooting

### Issue: "Partner not sending postbacks"
**Solution:** Verify the postback URL you gave them is correct. Copy it again from the builder.

### Issue: "Wrong parameter name"
**Solution:** Check the partner's documentation for their exact parameter names (case-sensitive!)

### Issue: "User not credited"
**Solution:** Check if the parameter mapping is correct. The partner must send back the value they received.

---

## 📞 Next Steps

1. ✅ Add PostbackURLBuilder component to your admin panel
2. ✅ Create postback URL for LeadAds using the builder
3. ✅ Give the URL to LeadAds
4. ✅ Test with a real conversion
5. ✅ Save the configuration for future use

---

**This UI eliminates all confusion about postback URL generation!** 🎉
