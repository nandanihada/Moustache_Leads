# Approval/Rejection Email Notifications

## ✅ Status: COMPLETE

Publishers now receive email notifications when their offers or placements are approved, rejected, or updated.

---

## 📧 Email Types

### 1. **Offer Approved** ✅
- **Icon:** ✅ (Green header)
- **Subject:** "✅ Your Offer '[Offer Name]' Has Been Approved!"
- **Message:** "Great news! Your offer has been approved and is now live."
- **Button:** "VIEW OFFER"
- **Color:** Green gradient (#10b981 → #059669)

### 2. **Offer Rejected** ✅
- **Icon:** ❌ (Red header)
- **Subject:** "❌ Your Offer '[Offer Name]' Was Not Approved"
- **Message:** "Unfortunately, your offer was not approved."
- **Button:** "EDIT OFFER"
- **Color:** Red gradient (#ef4444 → #dc2626)
- **Includes:** Rejection reason (if provided)

### 3. **Offer Under Review** ✅
- **Icon:** ⏳ (Amber header)
- **Subject:** "⏳ Your Offer '[Offer Name]' Is Under Review"
- **Message:** "Your offer is currently under review."
- **Button:** "VIEW STATUS"
- **Color:** Amber gradient (#f59e0b → #d97706)

---

## 🔧 Implementation

### Backend Email Service
**File:** `backend/services/email_service.py`

#### New Methods
```python
def _create_approval_email_html(
    self, 
    offer_name: str, 
    status: str,  # 'approved', 'rejected', 'pending'
    reason: str = '',
    offer_id: str = ''
) -> str:
    """Create HTML email template for approval notification"""

def send_approval_notification(
    self,
    recipient_email: str,
    offer_name: str,
    status: str,
    reason: str = '',
    offer_id: str = ''
) -> bool:
    """Send approval notification (blocking)"""

def send_approval_notification_async(
    self,
    recipient_email: str,
    offer_name: str,
    status: str,
    reason: str = '',
    offer_id: str = ''
) -> None:
    """Send approval notification (non-blocking)"""
```

### Admin Routes Integration
**File:** `backend/routes/admin_offer_requests.py`

#### Approve Endpoint
```python
@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_access_request(request_id):
    # ... approval logic ...
    
    # Send approval email
    email_service.send_approval_notification_async(
        recipient_email=publisher['email'],
        offer_name=offer_name,
        status='approved',
        reason='',
        offer_id=str(offer_id)
    )
```

#### Reject Endpoint
```python
@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/reject', methods=['POST'])
@token_required
@admin_required
def reject_access_request(request_id):
    # ... rejection logic ...
    
    # Send rejection email with reason
    email_service.send_approval_notification_async(
        recipient_email=publisher['email'],
        offer_name=offer_name,
        status='rejected',
        reason=reason,  # Admin's rejection reason
        offer_id=str(offer_id)
    )
```

---

## 📊 Email Template Structure

### Approval Email
```
┌─────────────────────────────────────┐
│  ✅ Offer Approved!                 │
│  (Green gradient header)            │
├─────────────────────────────────────┤
│                                     │
│  Great news! Your offer has been    │
│  approved and is now live.          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Offer Name                  │   │
│  │ [Offer Name Here]           │   │
│  └─────────────────────────────┘   │
│                                     │
│  [VIEW OFFER →]                     │
│                                     │
│  Next Steps:                        │
│  • Review the offer details         │
│  • Make any necessary updates       │
│  • Monitor performance              │
│                                     │
└─────────────────────────────────────┘
```

### Rejection Email (with reason)
```
┌─────────────────────────────────────┐
│  ❌ Offer Rejected                  │
│  (Red gradient header)              │
├─────────────────────────────────────┤
│                                     │
│  Unfortunately, your offer was      │
│  not approved.                      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Offer Name                  │   │
│  │ [Offer Name Here]           │   │
│  │                             │   │
│  │ Reason:                     │   │
│  │ [Rejection reason provided] │   │
│  └─────────────────────────────┘   │
│                                     │
│  [EDIT OFFER →]                     │
│                                     │
│  Next Steps:                        │
│  • Review the offer details         │
│  • Make any necessary updates       │
│  • Monitor performance              │
│                                     │
└─────────────────────────────────────┘
```

---

## 🎯 User Flow

### Approval Flow
```
1. Publisher requests access to offer
   ↓
2. Admin reviews request
   ↓
3. Admin clicks "Approve"
   ↓
4. Approval email sent to publisher
   ↓
5. Publisher receives: "✅ Your Offer Has Been Approved!"
   ↓
6. Publisher can now access offer
```

### Rejection Flow
```
1. Publisher requests access to offer
   ↓
2. Admin reviews request
   ↓
3. Admin clicks "Reject" with reason
   ↓
4. Rejection email sent to publisher
   ↓
5. Publisher receives: "❌ Your Offer Was Not Approved"
   ↓
6. Email includes rejection reason
   ↓
7. Publisher can edit and resubmit
```

---

## 💻 Usage Examples

### Sending Approval Notification
```python
from services.email_service import get_email_service

email_service = get_email_service()

# Send approval email (async - non-blocking)
email_service.send_approval_notification_async(
    recipient_email='publisher@example.com',
    offer_name='Premium Offer',
    status='approved',
    reason='',
    offer_id='offer_123'
)
```

### Sending Rejection Notification
```python
# Send rejection email with reason
email_service.send_approval_notification_async(
    recipient_email='publisher@example.com',
    offer_name='Premium Offer',
    status='rejected',
    reason='Offer does not meet quality standards',
    offer_id='offer_123'
)
```

---

## 🔌 API Integration

### Approve Request
```
POST /api/admin/offer-access-requests/<request_id>/approve
Authorization: Bearer <admin_token>
Content-Type: application/json

Request:
{
  "notes": "Optional approval notes"
}

Response:
{
  "message": "Access request approved successfully",
  "request_id": "req_123"
}

Side Effect:
✅ Approval email sent to publisher
```

### Reject Request
```
POST /api/admin/offer-access-requests/<request_id>/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

Request:
{
  "reason": "Offer does not meet quality standards"
}

Response:
{
  "message": "Access request rejected successfully",
  "request_id": "req_123"
}

Side Effect:
❌ Rejection email sent to publisher with reason
```

---

## 📧 Email Features

✅ **Status-Specific Design**
- Different colors for approved (green), rejected (red), pending (amber)
- Appropriate icons and messaging

✅ **Rejection Reason**
- Displays admin's rejection reason in email
- Helps publisher understand why offer was rejected

✅ **Call-to-Action Buttons**
- Approved: "VIEW OFFER" - links to offers page
- Rejected: "EDIT OFFER" - links to offers page
- Pending: "VIEW STATUS" - links to offers page

✅ **Next Steps Section**
- Helpful guidance for publisher
- Encourages engagement

✅ **Professional Design**
- MustacheLeads branding
- Responsive layout
- Clean, modern styling

✅ **Async Sending**
- Non-blocking email delivery
- Doesn't delay API response
- Background thread processing

---

## 🔐 Security

✅ **Authentication** - Only admins can approve/reject
✅ **Authorization** - Only offer admins can manage requests
✅ **Email Validation** - Publisher email verified before sending
✅ **Error Handling** - Graceful error messages
✅ **Logging** - All email sends logged

---

## 📋 Files Modified

### Backend
1. ✅ `backend/services/email_service.py` - Added approval email methods
2. ✅ `backend/routes/admin_offer_requests.py` - Integrated email sending

### No Frontend Changes Required
- Existing admin interface already has approve/reject buttons
- Email sending happens automatically in background

---

## 🧪 Testing

### Test Approval Email
```bash
1. Go to Admin → Offer Access Requests
2. Find a pending request
3. Click "Approve"
4. Check publisher's email for approval notification
5. Verify email contains:
   - ✅ icon and "Approved!" message
   - Green header
   - Offer name
   - "VIEW OFFER" button
```

### Test Rejection Email
```bash
1. Go to Admin → Offer Access Requests
2. Find a pending request
3. Click "Reject"
4. Enter rejection reason
5. Check publisher's email for rejection notification
6. Verify email contains:
   - ❌ icon and "Rejected" message
   - Red header
   - Offer name
   - Rejection reason
   - "EDIT OFFER" button
```

---

## 📊 Email Preferences

Publishers can control if they receive approval emails through:
- **Settings → Email Preferences → System Notifications**
- When disabled, no approval/rejection emails are sent

---

## 🎯 Complete Email Notification System

### Email Types Now Supported
1. ✅ Email Verification - On registration
2. ✅ New Offer Notification - When new offers added
3. ✅ Offer Update Notification - Promo codes, payouts
4. ✅ **Approval Notification** - When offer approved
5. ✅ **Rejection Notification** - When offer rejected

---

## 📝 Documentation

Complete documentation available in:
- `EMAIL_NOTIFICATION_SYSTEM_COMPLETE.md` - Full system overview
- `APPROVAL_NOTIFICATION_EMAILS.md` - This file

---

## ✨ Key Features

✅ Automatic email on approval/rejection
✅ Status-specific design and messaging
✅ Rejection reason included in email
✅ Non-blocking async sending
✅ Professional MustacheLeads branding
✅ Responsive email design
✅ Respects publisher email preferences
✅ Comprehensive logging

---

## 🎉 Status

**Implementation:** ✅ COMPLETE
**Testing:** ✅ READY
**Production:** ✅ READY

---

**Last Updated:** November 19, 2025
**Version:** 1.0
**Status:** ✅ PRODUCTION READY
