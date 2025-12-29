# ⚡ Quick Commands Reference

## 🧪 Test Scripts

### Run Complete Email Workflow Test
```bash
cd backend
python test_complete_email_workflow.py
```
**Tests:** Create offer + send emails, Approve access + send email, Approve placement + send email

### Run Debug Email Issue Script
```bash
cd backend
python debug_email_issue.py
```
**Tests:** Email config, Database connection, Publishers count, Email sending

### Run Email Sending Test
```bash
cd backend
python test_email_sending.py
```
**Tests:** Email service configuration and basic email sending

---

## 🚀 Restart Backend Server

### Stop Current Server
```
Press Ctrl+C in terminal
```

### Start Backend Server
```bash
cd backend
python app.py
```

---

## 📊 Check Backend Logs

### Look for Email Sending Logs
```
Search for: "📧 Found X publisher emails"
Search for: "✅ Email notification process started"
Search for: "✅ Email sent successfully to:"
```

### Look for Errors
```
Search for: "❌ Failed to send email"
Search for: "❌ Error in background email sending"
Search for: "Email service not configured"
```

---

## 🔍 Database Checks

### Check Publishers with Email
```bash
# In MongoDB shell
db.users.find({role: 'publisher', email: {$exists: true}})
```

### Check Offer Access Requests
```bash
# In MongoDB shell
db.affiliate_requests.find({status: 'pending'})
```

### Check Placements
```bash
# In MongoDB shell
db.placements.find({approvalStatus: 'pending'})
```

---

## 📧 Manual Email Tests

### Test 1: Create Offer & Send Emails
```
1. Go to Admin → Offers
2. Click "Create New Offer"
3. Fill details and click "Create"
4. Check backend logs for email sending
5. Check publisher inbox
```

### Test 2: Approve Offer Access & Send Email
```
1. Go to Admin → Offer Access Requests
2. Find pending request
3. Click "Approve"
4. Check backend logs for email sending
5. Check publisher inbox
```

### Test 3: Approve Placement & Send Email
```
1. Go to Admin → Placements
2. Find pending placement
3. Click "Approve"
4. Check backend logs for email sending
5. Check publisher inbox
```

---

## 🐛 Troubleshooting

### If No Emails Sent
```bash
# 1. Run debug script
python debug_email_issue.py

# 2. Check if publishers have email
# 3. Check backend logs
# 4. Verify SMTP config in .env
```

### If Emails Sent But Not Received
```bash
# 1. Check spam/junk folder
# 2. Verify email address is correct
# 3. Check SMTP credentials
# 4. Check backend logs for SMTP errors
```

### If Access Control Not Working
```bash
# 1. Verify offer has affiliates: 'request'
# 2. Check approval status in database
# 3. Verify access control logic
# 4. Run test script
```

---

## 📋 Files Modified

### Backend
- `backend/routes/admin_offers.py` - Added detailed logging
- `backend/services/email_service.py` - Changed to non-daemon threads

### Test Scripts (New)
- `backend/test_complete_email_workflow.py` - Complete workflow test
- `backend/debug_email_issue.py` - Debug email issues

### Documentation (New)
- `TESTING_AND_FIXES_GUIDE.md` - Complete testing guide
- `QUICK_COMMANDS.md` - This file

---

## ✅ Verification Checklist

- [ ] Backend server restarted
- [ ] Run `debug_email_issue.py` - all checks pass
- [ ] Run `test_complete_email_workflow.py` - all tests pass
- [ ] Create offer manually - emails sent
- [ ] Approve access manually - email sent
- [ ] Approve placement manually - email sent
- [ ] Check publisher inbox - all emails received

---

## 🎯 Expected Results

### Test 1: Create Offer & Send Emails
✅ Emails sent to all publishers
✅ Backend logs show recipients
✅ Publishers receive email

### Test 2: Approve Offer Access & Send Email
✅ Approval email sent
✅ Publisher can see tracking link
✅ Email in inbox

### Test 3: Approve Placement & Send Email
✅ Approval email sent
✅ Publisher receives notification
✅ Email in inbox

---

## 📞 Quick Help

**Q: No emails being sent?**
A: Run `python debug_email_issue.py` to diagnose

**Q: Publishers getting full access without approval?**
A: Verify offer has `affiliates: 'request'` set

**Q: Need to test manually?**
A: Follow manual testing steps in TESTING_AND_FIXES_GUIDE.md

**Q: Tests failing?**
A: Check backend logs and run debug script

---

**Last Updated:** November 19, 2025
**Status:** ✅ READY TO USE
