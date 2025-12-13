# How to See User Applications in Admin Panel

## ✅ System is Working Correctly!

The analytics system is functioning properly. Here's what you need to know:

---

## Why You're Not Seeing Users:

**The codes you're viewing have NO applications yet!**

When you click Analytics on a code that nobody has applied, you'll see:
- Overview: 0 uses, 0 users
- Offer Breakdown: "No offer usage data available yet"
- User Applications: "No user applications yet"

**This is correct behavior!**

---

## How to See User Applications:

### Step 1: Check Which Codes Have Applications

Run this command to see which codes have users:

```bash
cd backend
python check_promo_users.py
```

**Look for codes with "Users Applied: 1" or more**

Example output:
```
📋 Code: TEST20
   Usage Count: 1
   Users Applied: 1  ← This code has applications!
   
   👥 User Details:
      1. Username: jenny
         Applied At: 2025-12-11
```

### Step 2: View Analytics for Codes With Applications

1. Go to Admin Panel → Promo Codes
2. Find a code with `Usage > 0` (e.g., "1 / 100")
3. Click Analytics (📊) button
4. Go to "User Applications" tab
5. ✅ You'll see the users!

---

## Test It Yourself:

### Quick Test (5 minutes):

1. **Create a new test code:**
   - Admin Panel → Create Promo Code
   - Code: `TESTUSER`
   - Bonus: 10%
   - Max uses: 100

2. **Apply it as a publisher:**
   - Logout from admin
   - Login as a publisher
   - Go to Promo Codes
   - Apply `TESTUSER`

3. **Check analytics:**
   - Login as admin again
   - Find `TESTUSER` code
   - Click Analytics
   - Go to "User Applications" tab
   - ✅ You'll see the publisher who applied it!

---

## What the Analytics Shows:

### When Code Has Applications:

```
User Applications Tab:

| Username | Offer          | Bonus Earned | Date     |
|----------|----------------|--------------|----------|
| jenny    | Not used yet   | $0.00        | 12/11/24 |
| john     | Survey Offer 1 | $5.00        | 12/10/24 |
| sarah    | Not used yet   | $0.00        | 12/09/24 |
```

### When Code Has NO Applications:

```
User Applications Tab:

No user applications yet
```

---

## Current Status of Your Codes:

Based on the check, here's what you have:

| Code      | Status  | Usage | Users Applied |
|-----------|---------|-------|---------------|
| SUMMER20  | Expired | 0     | 0 ❌          |
| SUMMER21  | Expired | 0     | 0 ❌          |
| TEST20    | Active  | 1     | 1 ✅          |
| TEST8466  | Active  | 0     | 1 ✅          |
| TEST8717  | Active  | 0     | 1 ✅          |

**Codes with ✅ will show users in analytics!**
**Codes with ❌ will show "No user applications yet"**

---

## Why Usage Count Might Be 0:

For old codes (TEST8466, TEST8717):
- Users applied BEFORE the fix was implemented
- The `usage_count` wasn't incremented at that time
- But the users ARE in the database
- Analytics will still show them!

For new codes (TEST20):
- Applied AFTER the fix
- `usage_count` increments correctly
- Everything works perfectly!

---

## To Fix Old Codes' Usage Count:

Run this to update usage counts for old codes:

```python
# In MongoDB or via script
from database import db_instance

promo_codes = db_instance.get_collection('promo_codes')
user_promo_codes = db_instance.get_collection('user_promo_codes')

# For each code
for code in promo_codes.find():
    # Count active applications
    count = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    
    # Update usage_count
    promo_codes.update_one(
        {'_id': code['_id']},
        {'$set': {'usage_count': count}}
    )
```

---

## Summary:

✅ **System is working correctly**
✅ **Analytics shows users who applied codes**
✅ **You need to view codes that have applications**

**Next Steps:**
1. Check `TEST20`, `TEST8466`, or `TEST8717` analytics
2. You should see "jenny" in User Applications
3. For other codes, have publishers apply them first!

---

**The feature is working! You just need to look at codes that have been applied.** 🎉
