# Email Verification System Guide

## Overview

The email verification system ensures that users register with valid email addresses. When a user registers, they receive a verification email with a unique link. They must click this link to verify their email before gaining full access to the platform.

## Features

✅ **Automatic Email Verification on Registration**
- Verification email sent automatically after registration
- 24-hour expiration on verification links
- Resend functionality for expired or missed emails

✅ **Secure Token Generation**
- Cryptographically secure tokens using `secrets.token_urlsafe()`
- Tokens stored in database with expiration time
- One-time use tokens (cannot be reused)

✅ **Email Verification UI**
- Beautiful verification page with status indicators
- Email verification prompt modal during registration
- Resend email functionality with user feedback

✅ **Backend API Endpoints**
- `/api/auth/register` - Register with automatic email verification
- `/api/auth/verify-email` - Verify email using token
- `/api/auth/verification-status` - Check verification status
- `/api/auth/resend-verification` - Resend verification email

## Setup Instructions

### Step 1: Configure SMTP Settings

Update your `.env` file with SMTP credentials:

```env
# Gmail Example
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FRONTEND_URL=http://localhost:5173

# Optional: Enable debug mode (logs emails instead of sending)
EMAIL_DEBUG=false
```

### Step 2: Gmail Setup (if using Gmail)

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
   - Use this as `SMTP_PASSWORD` in `.env`

### Step 3: Test Email Verification Service

Run the test script:

```bash
cd backend
python test_email_verification.py
```

Expected output:
```
✅ ALL TESTS PASSED!
```

## API Endpoints

### 1. Register User (with Email Verification)

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepass123",
  "first_name": "John",
  "last_name": "Doe",
  "company_name": "Acme Corp",
  "website": "https://acme.com",
  "postback_url": "https://acme.com/postback",
  "role": "partner"
}
```

**Response:**
```json
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "token": "eyJhbGc...",
  "email_verification_required": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "email_verified": false,
    "role": "partner"
  }
}
```

### 2. Verify Email

**Endpoint:** `POST /api/auth/verify-email`

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response:**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "email_verified": true,
    "role": "partner"
  }
}
```

### 3. Get Verification Status

**Endpoint:** `GET /api/auth/verification-status`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "email": "john@example.com",
  "email_verified": false,
  "verification_status": {
    "verified": false,
    "pending": true,
    "expires_at": "2024-12-20T10:30:00",
    "message": "Verification pending"
  }
}
```

### 4. Resend Verification Email

**Endpoint:** `POST /api/auth/resend-verification`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Verification email resent successfully",
  "email": "john@example.com"
}
```

## Frontend Components

### 1. VerifyEmail Page

**Location:** `src/pages/VerifyEmail.tsx`

Displays when user clicks verification link from email. Shows:
- Loading state while verifying
- Success message with redirect to login
- Error message with retry options

**Route:** `/verify-email?token=<token>`

### 2. EmailVerificationPrompt Modal

**Location:** `src/components/EmailVerificationPrompt.tsx`

Shows after registration with:
- Email address confirmation
- Resend email button
- Helpful tips about spam folder
- 24-hour expiration warning

## Database Schema

### Users Collection

New fields added to user documents:

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: Bytes,
  role: String,
  email_verified: Boolean,           // ✅ NEW
  email_verified_at: Date,           // ✅ NEW
  created_at: Date,
  updated_at: Date,
  is_active: Boolean
}
```

### Email Verifications Collection

New collection for tracking verification tokens:

```javascript
{
  _id: ObjectId,
  token: String,                     // Unique verification token
  email: String,                     // User email
  user_id: String,                   // Reference to user
  created_at: Date,                  // When token was created
  expires_at: Date,                  // When token expires (24 hours)
  verified: Boolean,                 // Whether token was used
  verified_at: Date,                 // When email was verified
  attempts: Number                   // Verification attempts
}
```

## Email Template

The verification email includes:

- **Header:** "🔐 Verify Your Email" with gradient background
- **Message:** Welcome message with personalized greeting
- **CTA Button:** "VERIFY EMAIL" button with verification link
- **Alternative Link:** Copy-paste link for email clients that don't support buttons
- **Security Note:** Warning about 24-hour expiration
- **Footer:** Support contact information

## User Flow

### Registration Flow

```
1. User fills registration form
   ↓
2. User clicks "Create Account"
   ↓
3. Backend creates user with email_verified = false
   ↓
4. Verification token generated
   ↓
5. Verification email sent
   ↓
6. User logged in (can browse while verifying)
   ↓
7. EmailVerificationPrompt modal shown
   ↓
8. User checks email and clicks verification link
   ↓
9. Redirected to /verify-email?token=<token>
   ↓
10. Token verified and email_verified set to true
    ↓
11. Success message and redirect to login
```

### Verification Flow

```
1. User receives verification email
   ↓
2. User clicks "VERIFY EMAIL" button
   ↓
3. Browser navigates to /verify-email?token=<token>
   ↓
4. VerifyEmail component extracts token from URL
   ↓
5. POST /api/auth/verify-email with token
   ↓
6. Backend validates token:
   - Token exists in database
   - Token not already verified
   - Token not expired
   ↓
7. If valid:
   - Mark email as verified in users collection
   - Mark token as verified in email_verifications collection
   - Return success response
   ↓
8. Frontend shows success message
   ↓
9. Auto-redirect to login after 2 seconds
```

## Troubleshooting

### Issue: "Email service not configured"

**Solution:**
- Check that all SMTP variables are set in `.env`
- Verify SMTP_USERNAME, SMTP_PASSWORD, FROM_EMAIL are not empty
- Restart the backend server after updating `.env`

### Issue: "Authentication failed" when sending email

**Solution (Gmail):**
- Use App Password, not regular password
- Verify 2FA is enabled on Google account
- Check username/password are correct
- Try port 465 (SSL) instead of 587 (TLS)

### Issue: Verification email not received

**Solution:**
- Check spam/junk folder
- Wait 5-10 minutes for email delivery
- Use resend functionality if link expired
- Check email address is correct in registration form

### Issue: "Invalid or expired verification token"

**Solution:**
- Verification links expire after 24 hours
- Use "Resend Verification Email" button to get new link
- Check that token in URL matches exactly

### Issue: User can't login after verification

**Solution:**
- Verify email_verified field is set to true in database
- Check user account is active (is_active = true)
- Try logging in with correct username/password
- Check browser console for error messages

## Testing

### Manual Testing

1. **Test Registration with Email Verification:**
   ```
   1. Go to /register
   2. Fill in all required fields
   3. Click "Create Account"
   4. See EmailVerificationPrompt modal
   5. Check email for verification link
   6. Click verification link
   7. See success page
   8. Redirect to login
   ```

2. **Test Resend Email:**
   ```
   1. In EmailVerificationPrompt modal
   2. Click "Resend Verification Email"
   3. See success message
   4. Check email for new verification link
   ```

3. **Test Expired Token:**
   ```
   1. Wait 24+ hours
   2. Try to use old verification link
   3. See "Invalid or expired verification token" error
   4. Use resend functionality to get new link
   ```

### Automated Testing

Run the test script:

```bash
python backend/test_email_verification.py
```

Tests include:
- ✅ Token generation
- ✅ Token verification
- ✅ Token expiration
- ✅ Email sending
- ✅ Resend functionality
- ✅ User model integration

## Security Considerations

🔒 **Token Security:**
- Tokens are 32-byte URL-safe random strings
- Tokens are one-time use (marked as verified after use)
- Tokens expire after 24 hours
- Tokens are stored in database (not sent in response)

🔒 **Email Security:**
- Verification emails sent over SMTP with TLS encryption
- Email addresses validated before sending
- No sensitive information in email body
- Links use secure token format

🔒 **User Security:**
- Users can still browse platform while verifying email
- Email verification doesn't grant additional permissions
- Unverified users can still access offers
- Email verification is optional for browsing

## Performance

⚡ **Optimization:**
- Email sending is non-blocking (background thread)
- Token verification is O(1) database lookup
- No impact on registration performance
- Email delivery doesn't delay user login

## Future Enhancements

📋 **Planned Features:**
- Email verification reminders (after 7 days)
- Bulk email verification for admins
- Email verification analytics dashboard
- Custom email templates per brand
- Multi-language email support
- SMS verification as alternative

## Support

For issues or questions:
- Check troubleshooting section above
- Review test script output
- Check backend logs for errors
- Contact support@pepeleads.com

---

**Last Updated:** December 2024
**Version:** 1.0
