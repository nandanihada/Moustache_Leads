# Email Notification System - Quick Reference

## 🚀 Quick Start

### Backend is Ready ✅
All backend code is implemented and ready to use.

### API Endpoints

```bash
# Get preferences
GET /api/publisher/settings/email-preferences

# Update preferences
PUT /api/publisher/settings/email-preferences
Body: {
  "new_offers": true,
  "offer_updates": true,
  "system_notifications": true,
  "marketing_emails": false
}

# Toggle single preference
POST /api/publisher/settings/email-preferences/toggle
Body: {
  "preference_type": "new_offers",
  "enabled": false
}

# Get all settings
GET /api/publisher/settings
```

---

## 📧 Sending Emails

### New Offer Notification
```python
from services.email_service import get_email_service
from models.user import User

# Get publishers who want new offer emails
user_model = User()
publishers = user_model.collection.find({
    'role': 'partner',
    'email_preferences.new_offers': True
})
emails = [pub['email'] for pub in publishers]

# Send notification
email_service = get_email_service()
email_service.send_new_offer_notification_async(
    offer_data=offer_dict,
    recipients=emails
)
```

### Offer Update Notification
```python
# Get publishers who want offer update emails
publishers = user_model.collection.find({
    'role': 'partner',
    'email_preferences.offer_updates': True
})
emails = [pub['email'] for pub in publishers]

# Send update (promo_code, payout_increase, or general_update)
email_service.send_offer_update_notification_async(
    offer_data=offer_dict,
    recipients=emails,
    update_type='promo_code'
)
```

---

## 🎨 Frontend Components to Create

### 1. EmailPreferencesPopup
```typescript
// Show after registration
// Toggle switches for each preference
// Save button
```

### 2. PublisherSettings
```typescript
// Email preferences tab
// Real-time toggles
// Confirmation messages
```

### 3. Integration Points
```typescript
// Register.tsx - Show popup after registration
// PublisherOffers.tsx - Add settings tab
// Dashboard.tsx - Add settings link
```

---

## 📊 Database

### Email Preferences Fields
```javascript
email_preferences: {
  new_offers: Boolean,           // New offer emails
  offer_updates: Boolean,        // Offer update emails
  system_notifications: Boolean, // System emails
  marketing_emails: Boolean,     // Marketing emails
  updated_at: DateTime
}
```

---

## 🔧 User Model Methods

```python
# Get preferences
prefs = user_model.get_email_preferences(user_id)

# Update preferences
success = user_model.update_email_preferences(user_id, prefs)

# Check if should send
should_send = user_model.should_receive_email(user_id, 'new_offers')
```

---

## 📧 Email Service Methods

```python
# New offer notification (async)
email_service.send_new_offer_notification_async(
    offer_data=offer,
    recipients=emails
)

# Offer update notification (async)
email_service.send_offer_update_notification_async(
    offer_data=offer,
    recipients=emails,
    update_type='promo_code'  # or 'payout_increase', 'general_update'
)
```

---

## 🎯 Implementation Checklist

### Backend ✅
- [x] User model with email preferences
- [x] Publisher settings API routes
- [x] Email service offer update methods
- [x] Blueprint registration

### Frontend ⏳
- [ ] EmailPreferencesPopup component
- [ ] PublisherSettings component
- [ ] API service methods
- [ ] Integration into registration
- [ ] Integration into settings page

### Admin ⏳
- [ ] Send update notification button
- [ ] Promo code field
- [ ] Update type selection
- [ ] Notification results display

---

## 📋 Default Preferences

```javascript
{
  new_offers: true,              // Enabled by default
  offer_updates: true,           // Enabled by default
  system_notifications: true,    // Enabled by default
  marketing_emails: false        // Disabled by default
}
```

---

## 🧪 Test Commands

```bash
# Get preferences
curl -X GET http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update preferences
curl -X PUT http://localhost:5000/api/publisher/settings/email-preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_offers": false,
    "offer_updates": true,
    "system_notifications": true,
    "marketing_emails": false
  }'

# Toggle preference
curl -X POST http://localhost:5000/api/publisher/settings/email-preferences/toggle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preference_type": "new_offers",
    "enabled": false
  }'
```

---

## 📁 Files Modified

1. `backend/models/user.py` - Email preferences fields + methods
2. `backend/services/email_service.py` - Offer update email methods
3. `backend/app.py` - Blueprint registration
4. `backend/routes/publisher_settings.py` - NEW - API endpoints

---

## 🎯 Next: Frontend Development

### Step 1: Create EmailPreferencesPopup
- Show after registration
- 4 toggle switches
- Save button

### Step 2: Create PublisherSettings
- Display preferences
- Real-time updates
- Confirmation messages

### Step 3: Integrate
- Add to registration flow
- Add to settings page
- Add API calls

---

## 📞 Support

**Documentation:**
- `EMAIL_NOTIFICATION_SYSTEM_GUIDE.md` - Full guide
- `EMAIL_NOTIFICATION_IMPLEMENTATION_SUMMARY.md` - Summary

**Backend Status:** ✅ READY
**Frontend Status:** ⏳ PENDING

---

**Last Updated:** November 19, 2025
