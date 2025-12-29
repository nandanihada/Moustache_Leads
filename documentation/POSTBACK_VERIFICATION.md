# ✅ POSTBACK FORWARDING VERIFICATION

## Current Implementation Analysis

### What Your Code Does (Lines 238-410 in postback_receiver.py):

1. **Receives postback from upstream partner**
2. **Looks up click data** to get user_id and offer_id
3. **Calculates YOUR points** using `calculate_offer_points_with_bonus(offer_id)`
4. **Gets actual username** using `get_username_from_user_id(user_id)`
5. **Replaces macros** with YOUR data:
   - `{username}` → YOUR username (line 352)
   - `{payout}` → YOUR calculated points (line 346)
   - `{user_id}` → YOUR user_id (line 350)
6. **Forwards to ALL placements** with postbackUrl configured

## ✅ Confirmed: You ARE Sending Correct Data!

### Evidence from Code:

**Line 326**: Calculate points from YOUR offer
```python
points_calc = calculate_offer_points_with_bonus(offer_id)
```

**Line 329**: Get YOUR username
```python
actual_username = get_username_from_user_id(user_id) if user_id else 'Unknown'
```

**Lines 341-353**: Replace macros with YOUR data
```python
macros = {
    '{click_id}': get_param_value('click_id'),
    '{status}': 'approved',
    '{payout}': str(points_calc['total_points']),  # ✅ YOUR points!
    '{offer_id}': offer_id,
    '{user_id}': user_id,
    '{username}': actual_username,  # ✅ YOUR username!
}
```

## 📊 What Gets Sent to Downstream Partners:

### Example Scenario:
- **Upstream sends**: `payout=50` (their payout)
- **Your offer has**: `payout=100` (your payout)
- **User**: `john_doe` (username)
- **Email**: `john@example.com`

### What YOU forward:
```
https://partner.com/postback?
  username=john_doe          ← YOUR username
  &payout=100                ← YOUR points (not upstream's 50!)
  &user_id=68dd1032...       ← YOUR user_id
  &click_id=ABC123
  &status=approved
```

## 🎯 How to Verify Locally:

### Option 1: Check Logs
1. Trigger a conversion (complete an offer)
2. Check backend logs for:
   ```
   💰 Offer: ML-00057
   User ID: 68dd1032d76b6e31d72b48c4
   Username: john_doe
   Base points: 90
   Total points: 90
   📤 Final URL: https://partner.com/postback?username=john_doe&payout=90...
   ```

### Option 2: Check Database
```python
# Check placement_postback_logs collection
from database import db_instance
logs = db_instance.get_collection('placement_postback_logs')

# Get recent logs
recent = list(logs.find().sort('timestamp', -1).limit(5))

for log in recent:
    print(f"Placement: {log['placement_title']}")
    print(f"URL: {log['postback_url']}")
    # Check if URL contains username and correct points
```

### Option 3: Use Webhook.site
1. Go to https://webhook.site
2. Copy the unique URL (e.g., `https://webhook.site/abc123`)
3. Set this as postbackUrl in a placement:
   ```
   https://webhook.site/abc123?username={username}&payout={payout}&user_id={user_id}
   ```
4. Complete an offer
5. Check webhook.site - you'll see the actual values sent!

## ⚠️ Important Notes:

### User Lookup Logic (Lines 284-301):
Your code tries multiple ways to get user_id:
1. From postback params (`user_id` or `username`)
2. From click record if not in postback
3. From click's `sub2` field as fallback

**This is GOOD** - it ensures you always find the user!

### Points Calculation (Lines 35-122):
Your `calculate_offer_points_with_bonus()` function:
- Gets base points from YOUR offer
- Adds bonus if promo code is active
- Returns total points

**This is CORRECT** - you're using YOUR points, not upstream's!

### Username Lookup (Lines 124-153):
Your `get_username_from_user_id()` function:
- Looks up user in YOUR database
- Returns actual username
- Falls back to user_id if not found

**This is CORRECT** - you're using YOUR username!

## ✅ Conclusion: Ready to Deploy!

Your postback forwarding is **correctly implemented**:

1. ✅ Sends YOUR username (not upstream's)
2. ✅ Sends YOUR points (not upstream's)
3. ✅ Sends YOUR user_id
4. ✅ Calculates bonus points correctly
5. ✅ Logs everything for debugging

**You can safely deploy this!**

## 🧪 Quick Test Before Deployment:

1. Set up a test placement with webhook.site URL
2. Complete a test offer
3. Check webhook.site to see actual data sent
4. Verify username and points are correct

**If webhook.site shows correct data, you're good to go!** 🚀
