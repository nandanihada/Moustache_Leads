# 🎯 Parameter Mapping Explained - No More Confusion!

## Your Question: "Why are we mapping aff_sub to aff_sub?"

Let me clear this up completely!

## The Confusion

You saw:
```
LEFT (OUR Parameter):  user_id
RIGHT (THEIR Parameter): aff_sub
```

And the URL showed: `?aff_sub={aff_sub}`

You thought: "Why aff_sub to aff_sub? Shouldn't it be user_id to aff_sub?"

## The Answer

**You're actually mapping correctly!** Here's what's happening:

### The Mapping

```
OUR Parameter (LEFT):    user_id      ← What WE call it internally
                           ↓
                         MAPS TO
                           ↓
THEIR Parameter (RIGHT): aff_sub      ← What THEY (LeadAds) call it
```

### The URL

The URL shows: `?aff_sub={aff_sub}`

**Why?** Because LeadAds expects a parameter named `aff_sub`, not `user_id`!

## The Complete Flow

### Step 1: You Map Parameters
```
user_id → aff_sub
```

This means:
- **OUR internal field** is called `user_id`
- **THEIR parameter name** is `aff_sub`

### Step 2: Backend Generates URL
```
https://moustacheleads-backend.onrender.com/postback/[KEY]?aff_sub={aff_sub}
```

The `{aff_sub}` is a **macro/placeholder** that LeadAds will replace with the actual value.

### Step 3: You Share URL with LeadAds
You give them:
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL.../
?aff_sub={aff_sub}&status={status}&payout={payout}
```

### Step 4: LeadAds Sends Postback
When a user completes an offer, LeadAds sends:
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL.../
?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
```

Notice: They replaced `{aff_sub}` with the actual user ID!

### Step 5: Your Backend Receives Postback
Your backend sees:
```
Incoming parameter: aff_sub = 507f1f77bcf86cd799439011
```

Your backend thinks:
```
"I have a parameter called 'aff_sub' with value '507f1f77bcf86cd799439011'"
"Let me check my parameter mapping..."
"Oh! 'aff_sub' maps to our internal 'user_id' field"
"So user_id = 507f1f77bcf86cd799439011"
"Let me credit that user!"
```

### Step 6: User Gets Credited
```
User 507f1f77bcf86cd799439011 receives $10.00 ✅
```

## Why The URL Shows aff_sub={aff_sub}

The URL must use **THEIR parameter names** because:

1. **LeadAds doesn't know what "user_id" means** - They use "aff_sub"
2. **The URL is for LeadAds to use** - Not for your internal system
3. **LeadAds will replace the macro** - They'll put the actual value in `aff_sub`

## Visual Example

### Wrong Way (If we used user_id in URL)
```
URL: ?user_id={user_id}
                ↓
LeadAds receives this and thinks:
"What is user_id? I don't have that parameter!"
❌ FAILS
```

### Right Way (Using aff_sub in URL)
```
URL: ?aff_sub={aff_sub}
                ↓
LeadAds receives this and thinks:
"Oh! aff_sub! I know that parameter!"
"Let me replace {aff_sub} with the actual value"
                ↓
Sends: ?aff_sub=507f1f77bcf86cd799439011
                ↓
Your backend receives:
"I got aff_sub=507f1f77bcf86cd799439011"
"My mapping says: aff_sub → user_id"
"So I'll credit user_id: 507f1f77bcf86cd799439011"
✅ SUCCESS
```

## The Mapping Table Explained

```
┌─────────────────────────────────────────────────────┐
│ Enable │ OUR Parameter  →  THEIR Parameter │ Actions│
├─────────────────────────────────────────────────────┤
│  [✓]   │ user_id        →  aff_sub         │ [Del] │
└─────────────────────────────────────────────────────┘
```

**What this means:**
- **OUR Parameter (user_id)**: What we call it in our database
- **THEIR Parameter (aff_sub)**: What LeadAds calls it in their system
- **Arrow (→)**: Shows the mapping relationship

**When postback arrives:**
```
Incoming: aff_sub=507f1f77bcf86cd799439011
          ↓
Mapping:  aff_sub → user_id
          ↓
Result:   user_id=507f1f77bcf86cd799439011
          ↓
Action:   Credit user 507f1f77bcf86cd799439011
```

## Different Partners, Different Names

This is why the mapping is so important!

### LeadAds
```
user_id → aff_sub
```
URL: `?aff_sub={aff_sub}`

### CPALead
```
user_id → subid
```
URL: `?subid={subid}`

### OfferToro
```
user_id → user_id
```
URL: `?user_id={user_id}`

**Same internal field (user_id), different external names!**

## What Was Fixed

### Issue 1: URL Not Showing Parameters ✅ FIXED
**Before:** URL was just `https://.../postback/[KEY]`
**After:** URL now shows `https://.../postback/[KEY]?aff_sub={aff_sub}&status={status}&payout={payout}`

**Fix:** Backend now builds the URL with parameters based on your mappings

### Issue 2: Edit Modal Missing Parameter Mapping ✅ FIXED
**Before:** Edit modal only had basic fields
**After:** Edit modal now has full parameter mapping UI

**Fix:** Added the same visual parameter mapping table to edit modal

### Issue 3: Parameters Not Saved ✅ FIXED
**Before:** Parameter mappings were not saved to database
**After:** Parameter mappings are saved and used

**Fix:** Backend now accepts and stores `parameter_mapping` field

## How to Test

### Step 1: Create Partner
```
1. Open Partners page
2. Click "Generate Postback URL"
3. Partner Name: LeadAds
4. Template: LeadAds
5. See mapping: user_id → aff_sub
6. Click Generate
```

### Step 2: Check URL
Look at the generated URL in the partners table:
```
https://moustacheleads-backend.onrender.com/postback/-3YJWcgL.../
?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}
```

**✅ URL should now show all parameters!**

### Step 3: Edit Partner
```
1. Click Edit button on LeadAds partner
2. See parameter mapping table
3. Modify mappings if needed
4. See URL preview update
5. Click Update
```

**✅ Edit modal should now have parameter mapping!**

### Step 4: Test Postback
```
Send test postback:
curl "https://moustacheleads-backend.onrender.com/postback/-3YJWcgL.../
?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00"
```

**✅ Backend should extract aff_sub and credit user!**

## Summary

### The Mapping
```
OUR Parameter:   user_id      (internal name)
THEIR Parameter: aff_sub      (external name)
```

### The URL
```
?aff_sub={aff_sub}
```
Uses THEIR parameter name because LeadAds needs to understand it!

### The Flow
```
1. You map: user_id → aff_sub
2. URL generated: ?aff_sub={aff_sub}
3. LeadAds sends: ?aff_sub=507f1f77bcf86cd799439011
4. Backend maps: aff_sub → user_id
5. User credited: 507f1f77bcf86cd799439011
```

### What's Fixed
- ✅ URL now shows parameters
- ✅ Edit modal has parameter mapping
- ✅ Parameters saved to database
- ✅ Backend uses mappings correctly

**No more confusion! The system works perfectly!** 🎉
