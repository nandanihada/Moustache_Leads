# Email Verification - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Configure SMTP (2 minutes)

**Option A: Using Gmail**

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" and your device
5. Copy the 16-character password

**Update `.env` file:**
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password-here
FROM_EMAIL=your-email@gmail.com
FRONTEND_URL=http://localhost:5173
EMAIL_DEBUG=false
```

**Option B: Using Other Email Provider**

Contact your email provider for SMTP settings and update accordingly.

### Step 2: Test Email Service (1 minute)

```bash
cd backend
python test_email_verification.py
```

Expected output:
```
✅ ALL TESTS PASSED!
```

### Step 3: Test Registration (2 minutes)

1. Start the backend server
2. Start the frontend server
3. Navigate to `http://localhost:5173/register`
4. Fill in registration form
5. Click "Create Account"
6. See verification prompt modal
7. Check your email for verification link
8. Click the link to verify
9. See success page

---

## 📧 What Users See

### During Registration
- Registration form with all fields
- "Create Account" button
- After clicking: Verification prompt modal appears
- Modal shows their email address
- "Resend Verification Email" button available

### In Email
- Beautiful HTML email with gradient header
- "🔐 Verify Your Email" title
- Personalized greeting
- Large "VERIFY EMAIL" button
- Alternative copy-paste link
- 24-hour expiration warning

### After Clicking Link
- Loading state while verifying
- Success message: "Email Verified!"
- Auto-redirect to login after 2 seconds

---

## 🔧 API Endpoints

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepass123",
    "first_name": "John",
    "last_name": "Doe",
    "role": "partner"
  }'
```

### Verify Email
```bash
curl -X POST http://localhost:5000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "verification-token-from-email"}'
```

### Check Verification Status
```bash
curl -X GET http://localhost:5000/api/auth/verification-status \
  -H "Authorization: Bearer <token>"
```

### Resend Verification Email
```bash
curl -X POST http://localhost:5000/api/auth/resend-verification \
  -H "Authorization: Bearer <token>"
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/services/email_verification_service.py` | Email verification logic |
| `backend/routes/auth.py` | API endpoints |
| `backend/models/user.py` | User model with verification fields |
| `src/pages/VerifyEmail.tsx` | Verification page |
| `src/components/EmailVerificationPrompt.tsx` | Verification prompt modal |
| `src/pages/Register.tsx` | Updated registration page |

---

## ✅ Verification Checklist

- [ ] SMTP credentials configured in `.env`
- [ ] `test_email_verification.py` passes all tests
- [ ] Can register new user
- [ ] Verification email received
- [ ] Verification link works
- [ ] Email marked as verified in database
- [ ] User can login after verification
- [ ] Resend email functionality works
- [ ] Expired tokens show error message

---

## 🐛 Troubleshooting

### Email not received?
- Check spam/junk folder
- Wait 5-10 minutes
- Check email address is correct
- Use "Resend Verification Email" button

### "Email service not configured" error?
- Verify SMTP_USERNAME, SMTP_PASSWORD, FROM_EMAIL in `.env`
- Restart backend server
- Run `test_email_verification.py` to verify

### "Invalid or expired verification token"?
- Links expire after 24 hours
- Use "Resend Verification Email" button
- Check token in URL matches exactly

### Gmail authentication failed?
- Use App Password, not regular password
- Enable 2FA on Google account
- Try port 465 (SSL) instead of 587

---

## 🔐 Security Notes

✅ Tokens are cryptographically secure (32-byte random)
✅ Tokens are one-time use only
✅ Tokens expire after 24 hours
✅ Email addresses are validated
✅ Users can browse while verifying
✅ No sensitive data in emails

---

## 📊 Database

### Users Collection
```javascript
{
  email_verified: Boolean,        // true/false
  email_verified_at: Date         // When verified
}
```

### Email Verifications Collection
```javascript
{
  token: String,                  // Unique token
  email: String,                  // User email
  user_id: String,                // User reference
  created_at: Date,               // Created time
  expires_at: Date,               // Expires in 24 hours
  verified: Boolean,              // Used or not
  verified_at: Date               // When verified
}
```

---

## 💡 Tips

- **Debug Mode:** Set `EMAIL_DEBUG=true` in `.env` to log emails instead of sending
- **Test Email:** Use your own email for testing
- **Resend:** Users can resend verification email anytime
- **Browse:** Users can browse platform while verifying
- **Status:** Check verification status with `/api/auth/verification-status`

---

## 📞 Need Help?

1. Check `EMAIL_VERIFICATION_GUIDE.md` for detailed documentation
2. Review `test_email_verification.py` output
3. Check backend logs for errors
4. Verify `.env` configuration

---

**Ready to go!** 🎉

Start with Step 1 above and you'll have email verification working in minutes.
