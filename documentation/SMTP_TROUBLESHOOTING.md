# SMTP Email Configuration Troubleshooting

## ❌ Error: "Username and Password not accepted"

This is the error you're seeing:
```
(535, b'5.7.8 Username and Password not accepted. For more information, go to
5.7.8  https://support.google.com/mail/?p=BadCredentials d9443c01a7336-2985c242003sm189382765ad.24 - gsmtp')
```

### Root Cause
Your SMTP password had **spaces in it**: `zwpw buyo cvwi rypx`

Gmail app passwords should **NOT have spaces**. The correct format is: `zwpwbyocvwirypx`

---

## ✅ Solution Applied

The `.env` file has been updated to remove spaces:

```env
# BEFORE (❌ WRONG)
SMTP_PASSWORD=zwpw buyo cvwi rypx

# AFTER (✅ CORRECT)
SMTP_PASSWORD=zwpwbyocvwirypx
```

---

## 🧪 Test SMTP Connection

Run this to verify the fix works:

```bash
cd backend
python test_smtp_connection.py
```

Expected output:
```
✅ SMTP CONNECTION TEST PASSED!
📧 EMAIL SENDING TEST
✅ Email sent successfully!
✅ ALL TESTS PASSED!
```

---

## 🔍 Common SMTP Issues & Solutions

### Issue 1: "Username and Password not accepted"

**Cause:** 
- Wrong app password
- Spaces in password
- 2FA not enabled
- Using regular Gmail password instead of app password

**Solution:**
1. Go to https://myaccount.google.com/security
2. Verify 2-Step Verification is **enabled**
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" and "Windows Computer" (or your device)
5. Copy the 16-character password
6. **Remove all spaces** from the password
7. Update `.env`:
   ```env
   SMTP_PASSWORD=your16charapppassword
   ```
8. Restart backend server

### Issue 2: "Connection timeout"

**Cause:**
- Wrong SMTP server
- Wrong port
- Firewall blocking port 587

**Solution:**
```env
# Try these settings:
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587          # TLS
# OR
SMTP_PORT=465          # SSL (alternative)
```

### Issue 3: "TLS negotiation failed"

**Cause:**
- Port 465 requires SSL, not TLS
- Port 587 requires TLS, not SSL

**Solution:**
- Use port 587 with TLS (current configuration)
- Or use port 465 with SSL

### Issue 4: "Email sent but not received"

**Cause:**
- Email going to spam folder
- Wrong recipient email
- Email service not configured

**Solution:**
1. Check spam/junk folder
2. Verify FROM_EMAIL is correct
3. Wait 5-10 minutes for delivery
4. Check backend logs for errors

---

## 📋 Verification Checklist

- [ ] SMTP_PASSWORD has **NO spaces**
- [ ] Gmail 2-Factor Authentication is **enabled**
- [ ] App Password is **16 characters**
- [ ] SMTP_SERVER is `smtp.gmail.com`
- [ ] SMTP_PORT is `587`
- [ ] SMTP_USERNAME is your Gmail address
- [ ] FROM_EMAIL is your Gmail address
- [ ] Backend server **restarted** after .env changes
- [ ] `test_smtp_connection.py` passes all tests

---

## 🚀 Next Steps

1. **Restart Backend Server**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart:
   python app.py
   ```

2. **Test SMTP Connection**
   ```bash
   python test_smtp_connection.py
   ```

3. **Test Email Verification**
   - Go to http://localhost:5173/register
   - Register a new user
   - Check email for verification link
   - Click link to verify

4. **Monitor Logs**
   - Watch backend console for email sending logs
   - Check for "✅ Email sent successfully" messages

---

## 📧 Current Configuration

Your `.env` file is now configured as:

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=nandani.h@pepeleads.com
SMTP_PASSWORD=zwpwbyocvwirypx
FROM_EMAIL=nandani.h@pepeleads.com
EMAIL_DEBUG=false
```

---

## 🔐 Security Notes

⚠️ **Important:**
- Never commit `.env` file to Git
- Keep app passwords secret
- Use different app passwords for different services
- Regenerate app passwords if compromised

---

## 📞 Additional Help

### Gmail Support
- https://support.google.com/mail/?p=BadCredentials
- https://myaccount.google.com/security
- https://myaccount.google.com/apppasswords

### Alternative Email Providers

If Gmail doesn't work, try:

**SendGrid:**
```env
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.your-sendgrid-api-key
FROM_EMAIL=your-email@example.com
```

**Mailgun:**
```env
SMTP_SERVER=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@your-domain.com
SMTP_PASSWORD=your-mailgun-password
FROM_EMAIL=noreply@your-domain.com
```

**AWS SES:**
```env
SMTP_SERVER=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-ses-username
SMTP_PASSWORD=your-ses-password
FROM_EMAIL=verified-email@example.com
```

---

## ✅ Status

**Fixed:** SMTP password spaces removed
**Next:** Restart backend and test email sending

---

**Last Updated:** November 2025
