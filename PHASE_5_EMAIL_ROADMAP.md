# Phase 5: Email Notification System - Implementation Roadmap

## 📧 Overview

After testing the full promo code flow, we'll implement the email notification system to send notifications for:
- Promo code availability
- Bonus earned notifications
- Bonus credited notifications
- Code expiration reminders

---

## 🎯 Phase 5 Objectives

### Email Triggers
1. **Code Available Email**
   - When admin creates new promo code
   - Send to eligible publishers
   - Include code details and bonus info

2. **Bonus Earned Email**
   - When publisher earns bonus from conversion
   - Show bonus amount and code
   - Include balance update

3. **Bonus Credited Email**
   - When bonus is credited to balance
   - Show total credited amount
   - Include new balance

4. **Code Expiration Reminder**
   - 7 days before code expires
   - Show expiration date
   - Encourage usage

---

## 🏗️ Implementation Plan

### Step 1: Email Service Setup (1-2 hours)
```python
# Create: backend/services/email_service.py
- EmailService class
- SMTP configuration
- Email template system
- Retry logic
```

### Step 2: Email Templates (30 minutes)
```
- Code Available Template
- Bonus Earned Template
- Bonus Credited Template
- Expiration Reminder Template
```

### Step 3: Notification Triggers (1-2 hours)
```python
# Modify: backend/routes/admin_promo_codes.py
- Add email trigger on code creation

# Modify: backend/services/bonus_calculation_service.py
- Add email trigger on bonus earned
- Add email trigger on bonus credited

# Create: backend/services/notification_scheduler.py
- Schedule expiration reminders
- Run hourly checks
```

### Step 4: Email Preferences (1 hour)
```python
# Modify: backend/models/user.py
- Add email_preferences field
- Support opt-in/opt-out

# Create: backend/routes/email_preferences.py
- GET /api/user/email-preferences
- PUT /api/user/email-preferences
```

### Step 5: Email Logs (30 minutes)
```python
# Create: backend/models/email_log.py
- Track sent emails
- Track delivery status
- Track bounces

# Create: backend/routes/email_logs.py
- Admin view email logs
- Track delivery metrics
```

### Step 6: Testing (1-2 hours)
```python
# Create: backend/test_email_system.py
- Test email sending
- Test templates
- Test triggers
- Test preferences
```

---

## 📊 Database Changes

### Add to users Collection
```javascript
{
  email_preferences: {
    promo_codes: true,           // Receive code notifications
    bonus_earned: true,          // Receive bonus earned emails
    bonus_credited: true,        // Receive bonus credited emails
    expiration_reminders: true,  // Receive expiration reminders
    marketing: false             // Receive marketing emails
  }
}
```

### Create email_logs Collection
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  email_type: "promo_code_available",
  recipient: "publisher@example.com",
  subject: "New Promo Code Available",
  status: "sent",  // sent, failed, bounced
  sent_at: ISODate,
  delivered_at: ISODate,
  error: null,
  metadata: {
    code: "SUMMER20",
    bonus_amount: 20,
    bonus_type: "percentage"
  }
}
```

---

## 🔌 API Endpoints to Add

### Email Preferences
```
GET    /api/user/email-preferences      - Get user preferences
PUT    /api/user/email-preferences      - Update preferences
```

### Admin Email Management
```
GET    /api/admin/email-logs            - View email logs
GET    /api/admin/email-logs/stats      - Email statistics
POST   /api/admin/email-logs/resend     - Resend email
```

---

## 📧 Email Templates

### 1. Promo Code Available
```
Subject: New Promo Code Available: SUMMER20 (20% Bonus)

Hi [Publisher Name],

A new promo code is now available for you!

Code: SUMMER20
Bonus: 20% of earnings
Valid Until: December 20, 2025

Apply this code to your account to start earning bonuses on all conversions.

[Apply Code Button]

Best regards,
Moustache Leads Team
```

### 2. Bonus Earned
```
Subject: You Earned $50.00 Bonus! 🎉

Hi [Publisher Name],

Great news! You just earned a bonus from a conversion!

Code: SUMMER20
Bonus Amount: $50.00
Bonus Type: 20% of earnings
Status: Pending

Your bonus will be credited within 24-48 hours.

[View Details Button]

Best regards,
Moustache Leads Team
```

### 3. Bonus Credited
```
Subject: Bonus Credited: $50.00 Added to Your Balance ✅

Hi [Publisher Name],

Your bonus has been credited to your account!

Code: SUMMER20
Bonus Amount: $50.00
New Balance: $500.00
Credited At: November 21, 2025

[View Balance Button]

Best regards,
Moustache Leads Team
```

### 4. Code Expiration Reminder
```
Subject: Reminder: SUMMER20 Expires in 7 Days

Hi [Publisher Name],

Your promo code SUMMER20 will expire in 7 days!

Code: SUMMER20
Expires: December 20, 2025
Current Earnings: $250.00

Don't miss out on earning bonuses. Use this code while it's still active!

[View Code Button]

Best regards,
Moustache Leads Team
```

---

## 🔧 Implementation Code Examples

### Email Service
```python
# backend/services/email_service.py

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER')
        self.smtp_port = int(os.getenv('SMTP_PORT'))
        self.sender_email = os.getenv('SENDER_EMAIL')
        self.sender_password = os.getenv('SENDER_PASSWORD')
    
    def send_promo_code_available(self, user_email, code_data):
        """Send promo code available notification"""
        subject = f"New Promo Code Available: {code_data['code']}"
        template = self.render_template('promo_code_available', code_data)
        return self.send_email(user_email, subject, template)
    
    def send_bonus_earned(self, user_email, bonus_data):
        """Send bonus earned notification"""
        subject = f"You Earned ${bonus_data['amount']:.2f} Bonus!"
        template = self.render_template('bonus_earned', bonus_data)
        return self.send_email(user_email, subject, template)
    
    def send_bonus_credited(self, user_email, bonus_data):
        """Send bonus credited notification"""
        subject = f"Bonus Credited: ${bonus_data['amount']:.2f}"
        template = self.render_template('bonus_credited', bonus_data)
        return self.send_email(user_email, subject, template)
    
    def send_expiration_reminder(self, user_email, code_data):
        """Send code expiration reminder"""
        subject = f"Reminder: {code_data['code']} Expires Soon"
        template = self.render_template('expiration_reminder', code_data)
        return self.send_email(user_email, subject, template)
```

### Notification Trigger
```python
# In bonus_calculation_service.py

def calculate_and_record_bonus(self, conversion_data):
    """Calculate bonus and send notification"""
    
    # ... existing bonus calculation code ...
    
    # Send bonus earned email
    if user_preferences.get('bonus_earned'):
        email_service.send_bonus_earned(
            user_email=user.email,
            bonus_data={
                'amount': bonus_amount,
                'code': code,
                'bonus_type': bonus_type
            }
        )
    
    # ... rest of code ...
```

---

## 📋 Testing Plan

### Unit Tests
- [ ] Email template rendering
- [ ] Email sending
- [ ] Preference checking
- [ ] Error handling

### Integration Tests
- [ ] Email on code creation
- [ ] Email on bonus earned
- [ ] Email on bonus credited
- [ ] Email on expiration

### End-to-End Tests
- [ ] Full flow with emails
- [ ] Email delivery verification
- [ ] Preference respect
- [ ] Error recovery

---

## 🔐 Configuration Required

### Environment Variables
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=noreply@moustacheleads.com
SENDER_PASSWORD=your_app_password
SENDER_NAME=Moustache Leads
```

### Email Provider Options
- Gmail (free)
- SendGrid (recommended for production)
- AWS SES
- Mailgun

---

## 📊 Timeline

| Task | Duration | Status |
|------|----------|--------|
| Email Service Setup | 1-2 hours | ⏳ Pending |
| Email Templates | 30 minutes | ⏳ Pending |
| Notification Triggers | 1-2 hours | ⏳ Pending |
| Email Preferences | 1 hour | ⏳ Pending |
| Email Logs | 30 minutes | ⏳ Pending |
| Testing | 1-2 hours | ⏳ Pending |
| **Total** | **5-8 hours** | ⏳ Pending |

---

## 🎯 Success Criteria

✅ **Phase 5 Complete When**:
- Email service is implemented
- All 4 email types send correctly
- User preferences are respected
- Email logs are tracked
- All tests pass
- Documentation is complete

---

## 📚 Related Documentation

- `PHASE_6_7_FRONTEND_IMPLEMENTATION.md` - Frontend implementation
- `PROMO_CODE_FEATURE_COMPLETE.md` - Feature overview
- `RUN_FULL_FLOW_TEST.md` - Testing guide

---

## 🚀 Next After Phase 5

### Phase 8: Integration & Testing
- End-to-end testing with emails
- Edge case handling
- Performance optimization

### Phase 9: Documentation & Deployment
- User guides
- Admin guides
- Deployment checklist

---

## 📞 Support

For implementation details, refer to:
- Email service patterns
- SMTP configuration
- Template rendering
- Error handling

---

**Phase 5 Ready to Start After Testing! 📧**

Current Status: Testing Phase 6-7 → Phase 5 Email Notifications
