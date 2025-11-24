# Email Notification System - Complete Implementation Guide

## 🎯 Overview

A comprehensive email notification system that allows publishers to control when they receive emails about new offers and offer updates (like promo codes). Publishers can manage their email preferences through a settings interface.

---

## ✨ Features Implemented

### 1. **Email Notification Preferences**
- Publishers can toggle email notifications on/off
- Separate controls for:
  - **New Offers** - Receive emails when new offers are added
  - **Offer Updates** - Receive emails when offers are updated (promo codes, payout changes, etc)
  - **System Notifications** - Receive system/admin notifications
  - **Marketing Emails** - Receive marketing communications

### 2. **Publisher Settings Management**
- API endpoints to get/update email preferences
- Toggle individual preferences
- View all settings in one place

### 3. **Offer Update Notifications**
- Send emails when offers are updated
- Support for different update types:
  - **Promo Code** - "🎉 New Promo Code Available!"
  - **Payout Increase** - "💰 Payout Increased!"
  - **General Update** - "📢 Offer Updated"

### 4. **Preference-Based Email Sending**
- System checks user preferences before sending emails
- Respects user's notification settings
- Defaults to sending if preferences not found

---

## 📊 Database Schema

### User Model - Email Preferences

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  // ... other fields ...
  email_preferences: {
    new_offers: Boolean,           // Default: true
    offer_updates: Boolean,        // Default: true
    system_notifications: Boolean, // Default: true
    marketing_emails: Boolean,     // Default: false
    updated_at: DateTime
  }
}
```

---

## 🔌 API Endpoints

### 1. Get Email Preferences
```
GET /api/publisher/settings/email-preferences
Authorization: Bearer <token>

Response:
{
  "email": "publisher@example.com",
  "preferences": {
    "new_offers": true,
    "offer_updates": true,
    "system_notifications": true,
    "marketing_emails": false,
    "updated_at": "2025-11-19T11:00:00"
  }
}
```

### 2. Update Email Preferences
```
PUT /api/publisher/settings/email-preferences
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "new_offers": true,
  "offer_updates": true,
  "system_notifications": true,
  "marketing_emails": false
}

Response:
{
  "message": "Email preferences updated successfully",
  "preferences": {
    "new_offers": true,
    "offer_updates": true,
    "system_notifications": true,
    "marketing_emails": false,
    "updated_at": "2025-11-19T11:00:00"
  }
}
```

### 3. Toggle Specific Preference
```
POST /api/publisher/settings/email-preferences/toggle
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "preference_type": "new_offers",
  "enabled": false
}

Response:
{
  "message": "new_offers has been disabled",
  "preference_type": "new_offers",
  "enabled": false,
  "preferences": {
    "new_offers": false,
    "offer_updates": true,
    "system_notifications": true,
    "marketing_emails": false,
    "updated_at": "2025-11-19T11:00:00"
  }
}
```

### 4. Get All Publisher Settings
```
GET /api/publisher/settings
Authorization: Bearer <token>

Response:
{
  "email": "publisher@example.com",
  "username": "john_doe",
  "company_name": "Acme Corp",
  "website": "https://acme.com",
  "email_verified": true,
  "email_preferences": {
    "new_offers": true,
    "offer_updates": true,
    "system_notifications": true,
    "marketing_emails": false,
    "updated_at": "2025-11-19T11:00:00"
  }
}
```

---

## 📧 Email Templates

### New Offer Notification
- **Header:** "Hey All! 👋 Happy [Day]!"
- **Message:** "🚀 Please push more traffic on this offer!"
- **Color:** Purple gradient (#6366f1 → #8b5cf6)
- **Button:** "CHECK NOW →"

### Offer Update Notification
- **Header:** Varies by update type
  - Promo Code: "🎉 New Promo Code Available!"
  - Payout Increase: "💰 Payout Increased!"
  - General: "📢 Offer Updated"
- **Color:** Orange gradient (#f59e0b → #d97706)
- **Button:** "VIEW OFFER →"

---

## 🔧 Backend Implementation

### User Model Methods

```python
# Get user's email preferences
preferences = user_model.get_email_preferences(user_id)

# Update user's email preferences
success = user_model.update_email_preferences(user_id, preferences)

# Check if user should receive specific email type
should_send = user_model.should_receive_email(user_id, 'new_offers')
```

### Email Service Methods

```python
# Send new offer notification (async)
email_service.send_new_offer_notification_async(
    offer_data=offer_dict,
    recipients=email_list
)

# Send offer update notification (async)
email_service.send_offer_update_notification_async(
    offer_data=offer_dict,
    recipients=email_list,
    update_type='promo_code'  # or 'payout_increase', 'general_update'
)
```

### Publisher Settings Routes

```python
# GET /api/publisher/settings/email-preferences
# PUT /api/publisher/settings/email-preferences
# POST /api/publisher/settings/email-preferences/toggle
# GET /api/publisher/settings
```

---

## 🚀 Usage Examples

### Sending New Offer Notification

```python
from services.email_service import get_email_service
from models.user import User

# Get all publishers who want new offer emails
user_model = User()
publishers = user_model.collection.find({
    'role': 'partner',
    'email_preferences.new_offers': True
})

# Extract emails
emails = [pub['email'] for pub in publishers]

# Send notification
email_service = get_email_service()
email_service.send_new_offer_notification_async(
    offer_data=offer_dict,
    recipients=emails
)
```

### Sending Offer Update Notification

```python
from services.email_service import get_email_service
from models.user import User

# Get all publishers who want offer update emails
user_model = User()
publishers = user_model.collection.find({
    'role': 'partner',
    'email_preferences.offer_updates': True
})

# Extract emails
emails = [pub['email'] for pub in publishers]

# Send promo code update notification
email_service = get_email_service()
email_service.send_offer_update_notification_async(
    offer_data=offer_dict,
    recipients=emails,
    update_type='promo_code'
)
```

---

## 🎨 Frontend Components Needed

### 1. Email Preferences Popup (Registration)
- Show after successful registration
- Ask if user wants to receive emails
- Options for different notification types
- "Save Preferences" button

### 2. Publisher Settings Tab
- Display current email preferences
- Toggle switches for each preference type
- Real-time updates
- Confirmation messages

### 3. Settings Page
- Integrate email preferences section
- Show all publisher settings
- Edit company info, website, etc.
- Manage email notifications

---

## 📋 Integration Checklist

### Backend
- [x] Add email_preferences to User model
- [x] Add methods to User model for managing preferences
- [x] Create publisher_settings routes
- [x] Add offer update email template to email service
- [x] Add send_offer_update_notification methods
- [x] Register publisher_settings blueprint in app.py

### Frontend (To Do)
- [ ] Create EmailPreferencesPopup component
- [ ] Create PublisherSettings component with email preferences tab
- [ ] Add API service methods for email preferences
- [ ] Integrate popup into registration flow
- [ ] Add settings page/tab to publisher dashboard

### Admin (To Do)
- [ ] Add option to send offer update notifications when editing offers
- [ ] Show notification status/results
- [ ] Add promo code field to offer edit form

---

## 🔄 Workflow

### New Offer Notification Flow
```
1. Admin creates new offer
   ↓
2. System fetches all publishers with email_preferences.new_offers = true
   ↓
3. Email service sends notification to all matching publishers
   ↓
4. Publishers receive email with offer details
   ↓
5. Publishers can click to view offer
```

### Offer Update Notification Flow
```
1. Admin edits offer (adds promo code, increases payout, etc)
   ↓
2. Admin chooses to send update notification
   ↓
3. System fetches all publishers with email_preferences.offer_updates = true
   ↓
4. Email service sends update notification with appropriate message
   ↓
5. Publishers receive email about the update
   ↓
6. Publishers can click to view updated offer
```

### Publisher Preference Management Flow
```
1. Publisher goes to Settings
   ↓
2. Finds Email Preferences section
   ↓
3. Toggles preferences on/off
   ↓
4. Changes saved to database
   ↓
5. Future emails respect new preferences
```

---

## 📊 Default Preferences

When a new user registers:
```javascript
{
  new_offers: true,              // Receive new offer emails
  offer_updates: true,           // Receive offer update emails
  system_notifications: true,    // Receive system emails
  marketing_emails: false        // Don't receive marketing emails
}
```

---

## 🧪 Testing

### Test Email Preferences API

```bash
# Get preferences
curl -X GET http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer <token>"

# Update preferences
curl -X PUT http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_offers": true,
    "offer_updates": false,
    "system_notifications": true,
    "marketing_emails": false
  }'

# Toggle preference
curl -X POST http://localhost:5000/api/publisher/settings/email-preferences/toggle \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "preference_type": "new_offers",
    "enabled": false
  }'
```

---

## 📝 Files Created/Modified

### Created
- ✅ `backend/routes/publisher_settings.py` - Publisher settings API routes

### Modified
- ✅ `backend/models/user.py` - Added email preferences fields and methods
- ✅ `backend/services/email_service.py` - Added offer update notification methods
- ✅ `backend/app.py` - Registered publisher_settings blueprint

---

## 🎯 Next Steps

1. **Frontend Components**
   - Create EmailPreferencesPopup for registration
   - Create PublisherSettings component
   - Add email preferences to publisher dashboard

2. **Admin Integration**
   - Add "Send Update Notification" button to offer edit form
   - Add promo code field
   - Show notification results

3. **Testing**
   - Test email sending with different preferences
   - Test preference updates
   - Test offer update notifications

4. **Monitoring**
   - Track email delivery rates
   - Monitor preference changes
   - Log notification sends

---

## 🔐 Security Considerations

✅ **Authentication:** All endpoints require token authentication
✅ **Authorization:** Users can only manage their own preferences
✅ **Validation:** Preference types are validated
✅ **Defaults:** Safe defaults if preferences not found

---

## 📞 Support

For issues or questions:
- Check backend logs for email sending errors
- Verify SMTP configuration
- Test API endpoints with curl
- Check database for preference records

---

**Status:** ✅ BACKEND COMPLETE
**Version:** 1.0
**Last Updated:** November 19, 2025
