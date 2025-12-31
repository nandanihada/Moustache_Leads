# 🎯 URL Format Explained - Why aff_sub={aff_sub}?

## Your Concern

You're seeing in the URL preview:
```
?aff_sub={aff_sub}
```

And you're thinking: "Why aff_sub to aff_sub? I mapped user_id to aff_sub!"

## The Answer

**This is CORRECT!** Let me explain why.

## The Mapping You Created

In the UI, you mapped:
```
OUR Parameter:   user_id
THEIR Parameter: aff_sub
```

This means:
- **YOUR database field** is called `user_id`
- **THEIR parameter name** is called `aff_sub`

## The URL Format

The URL shows:
```
?aff_sub={aff_sub}
```

### Breaking It Down

```
aff_sub = {aff_sub}
│       │ │       │
│       │ │       └─ Placeholder/macro that LeadAds will replace
│       │ └───────── Curly braces indicate it's a macro
│       └─────────── Equals sign
└─────────────────── Parameter name (what LeadAds expects)
```

## Why Not user_id={user_id}?

If the URL was:
```
?user_id={user_id}
```

**LeadAds would be confused!** They don't know what `user_id` means. They only understand `aff_sub`.

## The Complete Flow

### 1. You Create the Mapping
```
┌─────────────────────────────────┐
│ OUR Parameter  →  THEIR Parameter│
├─────────────────────────────────┤
│ user_id        →  aff_sub        │
└─────────────────────────────────┘
```

**Meaning:** "My field user_id should be sent as aff_sub to LeadAds"

### 2. Backend Generates URL
```
https://moustacheleads-backend.onrender.com/postback/[KEY]?aff_sub={aff_sub}
```

**Why aff_sub?** Because that's what LeadAds expects!

### 3. You Share URL with LeadAds
```
LeadAds receives:
https://moustacheleads-backend.onrender.com/postback/[KEY]?aff_sub={aff_sub}

LeadAds thinks:
"Oh! I know aff_sub! That's my parameter!"
"I'll replace {aff_sub} with the actual user ID"
```

### 4. User Clicks Your Offer
```
Your offer URL:
https://leadads.com/offer?id=75999&aff_sub={user_id}

Your system replaces {user_id}:
https://leadads.com/offer?id=75999&aff_sub=507f1f77bcf86cd799439011

LeadAds receives:
"User 507f1f77bcf86cd799439011 clicked offer 75999"
```

### 5. User Completes Offer
```
LeadAds prepares postback:
- Takes your URL: ?aff_sub={aff_sub}
- Replaces {aff_sub} with: 507f1f77bcf86cd799439011
- Result: ?aff_sub=507f1f77bcf86cd799439011

LeadAds sends:
https://moustacheleads-backend.onrender.com/postback/[KEY]?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
```

### 6. Your Backend Receives Postback
```
Incoming parameters:
  aff_sub = 507f1f77bcf86cd799439011
  status = approved
  payout = 10.00

Backend checks mapping:
  "aff_sub" → "user_id"

Backend converts:
  user_id = 507f1f77bcf86cd799439011

Backend credits:
  User 507f1f77bcf86cd799439011 gets $10.00 ✅
```

## Visual Comparison

### What You See in URL
```
?aff_sub={aff_sub}
```

### What It Means
```
Parameter name: aff_sub      (what LeadAds understands)
Placeholder:    {aff_sub}    (what LeadAds will replace)
Maps to:        user_id      (what your database uses)
```

### When LeadAds Sends Postback
```
Before: ?aff_sub={aff_sub}
After:  ?aff_sub=507f1f77bcf86cd799439011
```

### When Your Backend Processes
```
Receives:  aff_sub=507f1f77bcf86cd799439011
Mapping:   aff_sub → user_id
Stores as: user_id=507f1f77bcf86cd799439011
```

## The Key Insight

### The URL Uses THEIR Language
```
?aff_sub={aff_sub}
```
This is in **LeadAds' language** because they need to understand it!

### Your Backend Uses YOUR Language
```
user_id = 507f1f77bcf86cd799439011
```
This is in **your database's language** because that's how you store it!

### The Mapping Bridges the Gap
```
THEIR Language  →  YOUR Language
    aff_sub     →     user_id
```

## Why It's Not Wrong

### You Might Think
"The URL should show user_id={aff_sub} to show the mapping"

### But That Would Be Wrong!
```
?user_id={aff_sub}
         ↓
LeadAds receives this:
"What is user_id? I don't have that parameter!"
❌ FAILS
```

### The Correct Way
```
?aff_sub={aff_sub}
         ↓
LeadAds receives this:
"Oh! aff_sub! I know that!"
"Let me replace {aff_sub} with the actual value"
✅ WORKS
```

## Real Example

### Your Mapping
```
user_id → aff_sub
```

### Generated URL
```
?aff_sub={aff_sub}
```

### What LeadAds Sends
```
?aff_sub=507f1f77bcf86cd799439011
```

### What Your Backend Does
```
1. Receives: aff_sub=507f1f77bcf86cd799439011
2. Checks mapping: aff_sub → user_id
3. Converts: user_id=507f1f77bcf86cd799439011
4. Credits user: 507f1f77bcf86cd799439011
```

## The Mapping Is Stored Correctly

In your database, the mapping is stored as:
```json
{
  "parameter_mapping": {
    "aff_sub": "user_id"
  }
}
```

This means:
- **Key (aff_sub)**: The parameter name in the URL (what LeadAds uses)
- **Value (user_id)**: Your internal field name (what your database uses)

## How to Verify It's Working

### 1. Check the URL Preview
Look at the new explanation box below the URL that shows:
```
aff_sub in URL maps to user_id in your database
```

### 2. Check Browser Console
When you create a partner, check the browser console (F12) for:
```
📤 Sending parameter mapping to backend: { "aff_sub": "user_id" }
```

### 3. Test the Postback
Send a test postback:
```bash
curl "https://moustacheleads-backend.onrender.com/postback/[YOUR_KEY]?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00"
```

Check if the user gets credited.

## Summary

### The URL Format
```
?aff_sub={aff_sub}
```

### What It Means
- **aff_sub** = Parameter name (LeadAds' language)
- **{aff_sub}** = Placeholder (LeadAds will replace)
- **Maps to user_id** = Your database field (your language)

### Why It's Correct
- URL uses THEIR parameter names (aff_sub)
- Backend uses YOUR field names (user_id)
- Mapping bridges the gap

### The Flow
```
1. You map: user_id → aff_sub
2. URL shows: ?aff_sub={aff_sub}
3. LeadAds sends: ?aff_sub=507f1f77...
4. Backend maps: aff_sub → user_id
5. User credited: 507f1f77...
```

**The URL format is CORRECT! It's showing aff_sub={aff_sub} because that's what LeadAds expects!** ✅

## New UI Feature

I've added an explanation box below the URL preview that shows:
```
📌 How the mapping works:
aff_sub in URL maps to user_id in your database
```

This makes it crystal clear that the mapping is working correctly!

**Test it now and you'll see the explanation!** 🎉
