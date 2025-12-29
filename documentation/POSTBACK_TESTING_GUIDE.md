# ✅ POSTBACK FORWARDING - READY TO TEST

## Current Status

✅ **Backend is running** (I can see it serving requests)
✅ **Postback forwarding code is deployed**
✅ **Ready to test**

---

## How to Test Locally

### Option 1: Wait for Real Conversion

1. Have a user complete an offer on your live site
2. When the offer network sends you a postback, check your backend logs
3. You should see:
   ```
   🚀 Forwarding postback to ALL placements with postbackUrl configured...
   📋 Found X placements with postbackUrl configured
   📤 Sending to placement: My Rewards
      URL: https://surveytitans.com/postback/...
      ✅ Sent! Status: 200
   ```

### Option 2: Manual Test with curl

Send a test postback manually:

```bash
curl "http://localhost:5000/postback/KWhO4xAMLjJns51ri6a_OVQUzMKD7xvL?click_id=TEST123&status=approved&payout=1.50&offer_id=ML-00065&conversion_id=TESTCONV&username=testuser"
```

Then check backend logs.

### Option 3: Check Database

Run this to see current status:

```bash
cd backend
python check_postback_status.py
```

This will show:
- How many placements have postbackUrl configured
- Recent postback forwarding logs
- Recent received postbacks

---

## What to Look For

### In Backend Logs:

**When postback is received:**
```
📥 Postback received: key=XXX, method=GET, params={...}
✅ Postback logged: [log_id]
✅ Auto-created conversion: CONV-XXX
🚀 Forwarding postback to ALL placements with postbackUrl configured...
📋 Found 3 placements with postbackUrl configured
📤 Sending to placement: My Rewards (6931051d8aa3abcf92678f36)
   URL: https://surveytitans.com/postback/d8e1bff1f46a956173cc91e51de5db63?username=testuser&status=approved
   ✅ Sent! Status: 200
   Response: OK
✅ Finished forwarding to 3 placements
```

### In Database:

**Collection: `placement_postback_logs`**
```
{
  placement_id: "6931051d8aa3abcf92678f36",
  placement_title: "My Rewards",
  postback_url: "https://surveytitans.com/postback/...?username=testuser&status=approved",
  status: "success",
  response_code: 200,
  response_body: "OK",
  timestamp: ISODate("2025-12-04T..."),
  conversion_id: "CONV-XXX"
}
```

---

## Troubleshooting

### If no placements have postbackUrl:

1. Login to your admin panel
2. Go to Placements
3. Edit each placement
4. Set the Postback URL field
5. For surveytitans.com, use:
   ```
   https://surveytitans.com/postback/d8e1bff1f46a956173cc91e51de5db63?username={username}&status={status}
   ```

### If postbacks aren't being forwarded:

1. Check backend logs for errors
2. Run `python check_postback_status.py`
3. Verify placements have postbackUrl configured
4. Check `placement_postback_logs` for error messages

### If partner doesn't receive postback:

1. Check if the URL is correct
2. Check if their server is accessible
3. Check `placement_postback_logs` for response_code
4. If response_code is not 200, there's an issue on their end

---

## Quick Commands

**Check status:**
```bash
cd backend
python check_postback_status.py
```

**View backend logs:**
```bash
# Backend is already running, just watch the terminal
```

**Check database logs:**
```bash
cd backend
python -c "
from database import db_instance
logs = db_instance.get_collection('placement_postback_logs')
for log in logs.find().sort('timestamp', -1).limit(3):
    print(f'{log.get(\"placement_title\")}: {log.get(\"status\")} - {log.get(\"response_code\")}')
"
```

---

## Next Steps

1. **Test with real conversion** - Have a user complete an offer
2. **Check backend logs** - Look for the forwarding messages
3. **Verify with partner** - Ask surveytitans.com if they received it
4. **Check database** - Query `placement_postback_logs` collection

---

**The system is ready! Just need a real conversion to test it.** 🚀

