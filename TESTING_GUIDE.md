# Complete Postback Distribution System - Testing Guide

## System Overview

Your system works as a **mediator** between external platforms and your partners:
1. External platforms send postbacks to your system
2. Your system automatically forwards them to ALL registered partners
3. Partners receive postbacks with their configured URLs and macros

## Prerequisites

### Backend Setup
```bash
cd backend
python app.py
# Backend should run on http://localhost:5000
```

### Frontend Setup
```bash
npm run dev
# Frontend should run on http://localhost:5173
```

---

## Test Flow - Step by Step

### Step 1: Register Partner Accounts

#### Partner 1:
1. Go to `http://localhost:5173/register`
2. Fill in the form:
   - **First Name:** John
   - **Last Name:** Doe
   - **Company Name:** Test Company 1
   - **Website:** https://example1.com
   - **Email:** partner1@test.com
   - **Postback URL:** `https://webhook.site/YOUR-UNIQUE-ID-1?click_id={click_id}&status={status}&payout={payout}`
   - **Password:** test123
3. Click "Create Account"
4. You should be logged in automatically

**Get a webhook.site URL:**
- Go to https://webhook.site
- Copy your unique URL
- Use it in the Postback URL field with macros

#### Partner 2 (Optional - to test multiple partners):
1. Logout from Partner 1
2. Register another partner with different email and webhook.site URL
3. **Postback URL:** `https://webhook.site/YOUR-UNIQUE-ID-2?click_id={click_id}&status={status}`

---

### Step 2: Verify Partner Registration

#### Check Database:
```javascript
// In MongoDB, check users collection
db.users.find({ role: 'partner' })
```

You should see:
- `role: 'partner'`
- `is_active: true`
- `postback_url: 'https://webhook.site/...'`
- `postback_method: 'GET'` (default)

#### Check Partner Profile:
1. Login as partner
2. Go to Profile (click user icon → Profile)
3. Verify all details are saved
4. Test the postback URL using "Test Postback" button
5. Check webhook.site - you should see a test request

---

### Step 3: Generate Postback Receiver URL

#### As Admin:
1. Login as admin (or create admin account)
2. Go to `/admin/postback-receiver`
3. Click "Generate Quick Postback URL"
4. Select parameters you want to track:
   - click_id
   - status
   - payout
   - offer_id
5. Copy the generated URL

**Example URL:**
```
https://your-backend.com/postback/abc123xyz?click_id={click_id}&status={status}&payout={payout}
```

---

### Step 4: Send Test Postback

#### Option A: Using Browser/Postman
Send a GET request to your postback receiver URL with actual values:
```
http://localhost:5000/postback/abc123xyz?click_id=TEST001&status=approved&payout=10.50&offer_id=OFFER123
```

#### Option B: Using cURL
```bash
curl "http://localhost:5000/postback/abc123xyz?click_id=TEST001&status=approved&payout=10.50&offer_id=OFFER123"
```

#### Option C: Using Postman
1. Create new GET request
2. URL: `http://localhost:5000/postback/abc123xyz`
3. Add query params:
   - click_id: TEST001
   - status: approved
   - payout: 10.50
   - offer_id: OFFER123
4. Send

---

### Step 5: Verify Distribution

#### Check Webhook.site:
1. Go to your webhook.site URLs for both partners
2. You should see incoming requests with:
   - Replaced macros (TEST001, approved, 10.50, OFFER123)
   - Timestamp of request
   - User-Agent: PepeLeads-Postback-Distributor/1.0

#### Check Backend Logs:
Look for these log messages:
```
📥 Postback received: key=abc123xyz
✅ Postback logged: {log_id}
📋 Found 2 active partners with postback URLs
📤 Sending postback to John Doe (GET): https://webhook.site/...
✅ Postback sent successfully to John Doe - Status: 200
📊 Distribution summary: 2/2 partners notified
```

#### Check Database:

**received_postbacks collection:**
```javascript
db.received_postbacks.find().sort({timestamp: -1}).limit(1)
```
Should show your incoming postback

**partner_postback_logs collection:**
```javascript
db.partner_postback_logs.find().sort({timestamp: -1}).limit(10)
```
Should show 2 entries (one per partner) with:
- success: true
- status_code: 200
- response_time: ~0.5s
- postback_url with replaced macros

---

### Step 6: Check Partner Statistics

1. Login as Partner 1
2. Go to Profile → Statistics tab
3. You should see:
   - Total Postbacks: 1
   - Successful: 1
   - Failed: 0
   - Success Rate: 100%

---

### Step 7: Test Failed Postback & Retry

#### Simulate Failure:
1. In Partner Profile, change postback URL to invalid URL:
   - `https://invalid-domain-that-does-not-exist.com/postback`
2. Save
3. Send another test postback
4. Check logs - should show failed delivery

#### Retry Failed Postbacks:
As admin, call the retry endpoint:
```bash
curl -X POST http://localhost:5000/api/admin/partner-postback-logs/retry-failed \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hours": 24}'
```

---

## Expected Results Summary

### ✅ Success Indicators:

1. **Partner Registration:**
   - Partner account created with role='partner'
   - Postback URL saved
   - Can login and view profile

2. **Postback Reception:**
   - Incoming postback logged to `received_postbacks`
   - Returns 200 OK response

3. **Automatic Distribution:**
   - All active partners receive postback
   - Macros correctly replaced
   - Each delivery logged to `partner_postback_logs`

4. **Partner Receives:**
   - Webhook.site shows incoming request
   - All parameters present
   - Values match what was sent

5. **Logging:**
   - Backend logs show distribution summary
   - Database has complete audit trail
   - Partner statistics update

---

## Troubleshooting

### Partners Not Receiving Postbacks?

**Check 1: Partner is Active**
```javascript
db.users.findOne({ email: 'partner1@test.com' })
// Verify: is_active: true, role: 'partner'
```

**Check 2: Postback URL Configured**
```javascript
db.users.findOne({ email: 'partner1@test.com' }, { postback_url: 1 })
// Should not be empty
```

**Check 3: Backend Logs**
Look for error messages in backend console

**Check 4: Database Connection**
Verify MongoDB is running and connected

### Postback Receiver Not Working?

**Check 1: Correct URL**
- Should be: `/postback/{unique_key}`
- Not: `/api/postback/{unique_key}`

**Check 2: Backend Running**
```bash
curl http://localhost:5000/health
```

**Check 3: CORS Issues**
- Frontend and backend on different ports
- Check browser console for CORS errors

### Macros Not Replaced?

**Check 1: Macro Format**
- Use: `{click_id}` (with curly braces)
- Not: `{{click_id}}` or `$click_id`

**Check 2: Parameter Sent**
- Verify parameter exists in incoming postback
- Check `received_postbacks` collection

---

## Advanced Testing

### Test Multiple Parameters:
```
http://localhost:5000/postback/abc123xyz?click_id=TEST001&status=approved&payout=10.50&offer_id=OFFER123&sub_id1=campaign1&sub_id2=source2&country=US&ip=192.168.1.1
```

### Test POST Method:
1. Change partner postback_method to 'POST'
2. Send test postback
3. Partner should receive POST request with JSON body

### Test Concurrent Partners:
1. Register 5+ partners
2. Send one postback
3. All should receive within seconds
4. Check response times in logs

### Test Retry Mechanism:
1. Set partner URL to fail
2. Send postback (will fail)
3. Fix partner URL
4. Call retry endpoint
5. Should succeed on retry

---

## Production Checklist

Before going live:

- [ ] MongoDB properly configured with indexes
- [ ] Backend deployed and accessible
- [ ] Environment variables set (MONGODB_URI, JWT_SECRET)
- [ ] Partner registration tested
- [ ] Postback distribution tested with real partners
- [ ] Logging verified
- [ ] Retry mechanism tested
- [ ] Error handling verified
- [ ] Performance tested with multiple partners
- [ ] Security: Rate limiting considered
- [ ] Monitoring: Set up alerts for failed postbacks

---

## API Endpoints Reference

### Public Endpoints:
- `POST /api/auth/register` - Register partner
- `POST /api/auth/login` - Login
- `GET /postback/{unique_key}` - Receive postback (public)

### Partner Endpoints:
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile/update` - Update profile
- `POST /api/partner/test-postback` - Test postback URL
- `GET /api/partner/stats` - Get statistics

### Admin Endpoints:
- `GET /api/admin/partner-postback-logs` - View logs
- `GET /api/admin/partner-postback-logs/stats` - Statistics
- `POST /api/admin/partner-postback-logs/retry-failed` - Retry failed
- `POST /api/admin/postback-receiver/generate-quick` - Generate URL

---

## Support

If you encounter issues:
1. Check backend logs
2. Check browser console
3. Verify database collections
4. Test with webhook.site first
5. Check this guide's troubleshooting section

**System is ready for testing!** 🚀
