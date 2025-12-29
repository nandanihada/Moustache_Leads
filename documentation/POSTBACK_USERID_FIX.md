# ✅ POSTBACK FIX - USER_ID FROM CLICK LOOKUP

## Problem Identified

Partner was receiving:
```
System: has just completed the offer ml656 worth 0 points
```

**Root Cause:** Upstream partner doesn't send `user_id` in the postback, so we were getting:
- `user_id = None` → Username becomes "Unknown" or "System:"
- Points calculation worked, but without user_id

## Solution Implemented

Modified `postback_receiver.py` to **look up user_id from click record** when not provided in postback:

### The New Flow:

```
1. Check if user_id in postback params ❌ (not sent by upstream)
   ↓
2. Get click_id from postback ✅
   ↓
3. Look up click record in database
   ↓
4. Get user_id from click.user_id or click.sub2
   ↓
5. Get username from users collection
   ↓
6. Calculate points from offer
   ↓
7. Forward with correct username and points ✅
```

### Code Changes:

```python
# Try to get user_id from postback params first
user_id = get_param_value('user_id') or get_param_value('username')

# If user_id not in postback, look it up from click record
if not user_id and click_id:
    logger.info(f"   🔍 user_id not in postback, looking up from click: {click_id}")
    clicks_collection = get_collection('clicks')
    if clicks_collection is not None:
        click = clicks_collection.find_one({'click_id': click_id})
        if click:
            user_id = click.get('user_id') or click.get('username') or click.get('sub2')
            if user_id:
                logger.info(f"   ✅ Found user_id from click: {user_id}")
```

---

## What Partner Will Receive Now

**Before:**
```
System: has just completed the offer ml656 worth 0 points
```

**After:**
```
john_doe: has just completed the offer ml656 worth 150 points
```

With macros replaced:
- `{username}` = `john_doe` (actual username from database)
- `{payout}` = `150` (calculated from offer.payout + bonus)
- `{status}` = `approved`

---

## Backend Logs You'll See

```
📤 Sending to placement: My Rewards
   🔍 user_id not in postback, looking up from click: CLK-ABC123
   ✅ Found user_id from click: test_user
   💰 Offer: ML-00656
   User ID: test_user
   Username: john_doe
   Base points: 150
   Bonus: 20.0% (SUMMER20) = 30 points
   Total points: 180
   📤 URL: https://surveytitans.com/postback/...?username=john_doe&payout=180
   ✅ Sent! Status: 200
```

---

## Deploy to Production

```bash
cd d:\pepeleads\ascend\lovable-ascend

git add .
git commit -m "Fix: Get user_id from click record when not in postback"
git push origin main
```

Wait 2-3 minutes for Render to deploy.

---

## Testing

After deployment, trigger a conversion and check:

1. **Backend logs** should show:
   - ✅ Looking up user_id from click
   - ✅ Found user_id
   - ✅ Username resolved
   - ✅ Points calculated

2. **Partner receives:**
   - ✅ Actual username (not "System:")
   - ✅ Calculated points (not 0)

---

**Deploy this fix now!** 🚀
