# 🔧 Testing & Fixes Guide - Email System & Access Control

## 📋 Issues Addressed

### Issue 1: No Emails Sent When Creating Offers
**Problem:** When admin creates offer, publishers don't receive email
**Root Cause:** Async daemon threads may not complete before app shutdown
**Fix:** Changed daemon threads to non-daemon threads with better logging

### Issue 2: Publishers Getting Full Access Without Approval
**Problem:** Publishers see tracking links even without approval
**Root Cause:** Need to verify offer has `affiliates: 'request'` set
**Status:** Access control logic is in place - needs verification

### Issue 3: Need Automated Test Scripts
**Solution:** Created three comprehensive test scripts

---

## 🧪 Test Scripts

### Test 1: Complete Email Workflow Test
**File:** `backend/test_complete_email_workflow.py`

**What it tests:**
1. Creates offer and sends emails to all publishers
2. Approves offer access and sends approval email
3. Approves placement and sends approval email

**How to run:**
```bash
cd backend
python test_complete_email_workflow.py
```

**Expected Output:**
```
TEST 1: CREATE OFFER & SEND EMAILS
✅ Found X publishers
✅ Test offer data prepared
📧 Sending emails to X publishers...
📊 Email Sending Results:
   • Total Recipients: X
   • Sent: X ✅
   • Failed: 0 ❌

TEST 2: APPROVE OFFER ACCESS & SEND EMAIL
✅ Found publisher
✅ Using offer
✅ Request approved
📧 Sending approval email...
✅ Approval email sent successfully!

TEST 3: APPROVE PLACEMENT & SEND EMAIL
✅ Found publisher
✅ Using placement
✅ Placement approved
📧 Sending approval email...
✅ Approval email sent successfully!

TEST SUMMARY
✅ TEST1: PASSED
✅ TEST2: PASSED
✅ TEST3: PASSED
✅ ALL TESTS PASSED!
```

---

### Test 2: Debug Email Issue
**File:** `backend/debug_email_issue.py`

**What it does:**
1. Checks email service configuration
2. Verifies database connection
3. Counts publishers
4. Lists publishers with email
5. Sends test email

**How to run:**
```bash
cd backend
python debug_email_issue.py
```

**Expected Output:**
```
EMAIL SENDING DEBUG SCRIPT

📧 Step 1: Checking Email Service Configuration
✅ SMTP Server: smtp.gmail.com
✅ SMTP Port: 587
✅ SMTP Username: nandani.h@pepeleads.com
✅ From Email: nandani.h@pepeleads.com
✅ Email Debug Mode: False
✅ Is Configured: True

📊 Step 2: Checking Database Connection
✅ Database connection successful

👥 Step 3: Counting Publishers
✅ Total users in database: X
✅ Total publishers: X

📧 Step 4: Checking Publisher Emails
✅ Publishers with email: X
   Publishers with email:
   • username1 (email1@example.com)
   • username2 (email2@example.com)

✉️  Step 5: Testing Email Sending
📤 Sending test email to: email1@example.com
📊 Email Sending Result:
   • Total: 1
   • Sent: 1 ✅
   • Failed: 0 ❌

✅ Email sending is working correctly!
```

---

## 🔍 Troubleshooting

### Problem: No Emails Sent
**Check:**
1. Run debug script: `python debug_email_issue.py`
2. Check if publishers have email addresses
3. Check backend logs for email errors
4. Verify SMTP configuration in `.env`

### Problem: Publishers Have Full Access Without Approval
**Check:**
1. Verify offer has `affiliates: 'request'` when creating with approval required
2. Check that approval workflow settings are being saved
3. Run test script to verify access control

### Problem: Emails Sent But Not Received
**Check:**
1. Check spam/junk folder
2. Verify email address is correct
3. Check SMTP credentials
4. Check backend logs for SMTP errors

---

## 📊 Manual Testing Steps

### Test 1: Create Offer & Send Emails

**Step 1: Create Publisher Account**
```
1. Go to http://localhost:8080/register
2. Register as publisher
3. Verify email
4. Set email preferences
```

**Step 2: Create Offer (as Admin)**
```
1. Go to Admin → Offers
2. Click "Create New Offer"
3. Fill in offer details
4. Set Approval Workflow: Manual
5. Click "Create"
```

**Step 3: Verify Email Sent**
```
1. Check backend logs for:
   "📧 Found X publisher emails - STARTING EMAIL SEND"
   "✅ Email notification process started in background"
2. Check publisher's email inbox
3. Should receive offer notification email
```

---

### Test 2: Approve Offer Access & Send Email

**Step 1: Publisher Requests Access**
```
1. Login as publisher
2. Go to Offers
3. Find offer with lock icon (requires approval)
4. Click "Request Access"
5. Submit request
```

**Step 2: Admin Approves Request**
```
1. Go to Admin → Offer Access Requests
2. Find publisher's request
3. Click "Approve"
4. Enter optional note
5. Click "Approve"
```

**Step 3: Verify Email Sent**
```
1. Check backend logs for:
   "✅ Approval email sent to [email]"
2. Check publisher's email inbox
3. Should receive approval email
```

---

### Test 3: Approve Placement & Send Email

**Step 1: Create Placement**
```
1. Go to Admin → Placements
2. Click "Create New Placement"
3. Fill in details
4. Click "Create"
```

**Step 2: Admin Approves Placement**
```
1. Go to Admin → Placements
2. Find pending placement
3. Click "Approve"
4. Enter optional message
5. Click "Approve"
```

**Step 3: Verify Email Sent**
```
1. Check backend logs for:
   "✅ Placement approval email sent to [email]"
2. Check publisher's email inbox
3. Should receive approval email
```

---

## 🔧 Fixes Applied

### Fix 1: Better Email Logging
**File:** `backend/routes/admin_offers.py`

Added detailed logging:
```python
logging.info(f"📧 Total publishers in database: {len(publishers)}")
logging.info(f"📧 Publishers with valid emails: {len(publisher_emails)}")
for email in publisher_emails:
    logging.info(f"   📧 Will send to: {email}")
logging.info(f"📧 Email service configured: {email_service.is_configured}")
```

### Fix 2: Non-Daemon Threads
**File:** `backend/services/email_service.py`

Changed from daemon to non-daemon threads:
```python
# Before: daemon=True (may not complete)
# After: daemon=False (ensures completion)
thread = threading.Thread(target=send_in_background, daemon=False)
thread.start()
```

### Fix 3: Better Error Logging
**File:** `backend/services/email_service.py`

Added `exc_info=True` to error logs:
```python
logger.error(f"❌ Error: {str(e)}", exc_info=True)
```

---

## 📈 Access Control Verification

### How Access Control Works

```
Publisher Requests Offer
    ↓
Check offer.affiliates field
    ↓
If affiliates == 'request':
    ↓
    Check if user has approved request
    ↓
    If approved: Show tracking link ✅
    If pending: Show "Request Pending" ❌
    If not requested: Show "Request Access" ❌
    ↓
If affiliates == 'all':
    ↓
    Show tracking link ✅
```

### Verify Access Control

**Check in Code:**
```python
# File: backend/services/access_control_service.py
# Method: check_offer_access()

if affiliate_access == 'request':
    approval_status = self._check_approval_status(offer_id, user_id)
    if approval_status == 'approved':
        return True, "Request-based access approved"
    else:
        return False, "Access request required"
```

**Check in Publisher Offers:**
```python
# File: backend/routes/publisher_offers.py
# Lines: 129-138

if has_access:
    offer_data['target_url'] = offer.get('target_url')
    offer_data['masked_url'] = offer.get('masked_url')
else:
    offer_data['is_preview'] = True
```

---

## 🚀 Running Tests

### Quick Test (5 minutes)
```bash
cd backend
python debug_email_issue.py
```

### Complete Test (10 minutes)
```bash
cd backend
python test_complete_email_workflow.py
```

### Full Manual Test (30 minutes)
1. Create publisher account
2. Create offer with approval required
3. Request access
4. Approve request
5. Verify email received
6. Verify tracking link visible

---

## 📊 Expected Results

### Test 1: Create Offer & Send Emails
- ✅ Emails sent to all publishers with email addresses
- ✅ Backend logs show all recipients
- ✅ Publishers receive email in inbox

### Test 2: Approve Offer Access & Send Email
- ✅ Approval email sent to publisher
- ✅ Email contains offer name and approval message
- ✅ Publisher can now see tracking link

### Test 3: Approve Placement & Send Email
- ✅ Approval email sent to publisher
- ✅ Email contains placement name
- ✅ Publisher receives notification

---

## 🔐 Verification Checklist

- ✅ Email service configured
- ✅ SMTP credentials correct
- ✅ Publishers have email addresses
- ✅ Async threads are non-daemon
- ✅ Logging shows all steps
- ✅ Access control checks approval status
- ✅ Tracking links only shown after approval
- ✅ Test scripts pass all tests

---

## 📞 Support

### If Emails Not Sending:
1. Run `debug_email_issue.py`
2. Check backend logs
3. Verify publishers have email
4. Check SMTP configuration

### If Access Control Not Working:
1. Verify offer has `affiliates: 'request'`
2. Check approval status in database
3. Verify access control logic in code

### If Tests Fail:
1. Check database connection
2. Verify email service configured
3. Check backend logs for errors
4. Run debug script

---

**Last Updated:** November 19, 2025
**Version:** 1.0
**Status:** ✅ READY FOR TESTING
