# Gift Card System - Updated Requirements (First-Come-First-Served Model)

## 🎯 **New Requirements from Manager**

### **Key Changes:**
1. ✅ Send email to **ALL users** (or selected users with exclusion list)
2. ✅ **First N users** (e.g., 10, 15, 20) can redeem - configurable `max_redemptions`
3. ✅ Auto-deactivate after N redemptions
4. ✅ **Exclude specific users** from receiving emails
5. ✅ **Expiry date/time** when creating gift card

---

## 🎁 **Updated Gift Card Flow**

### **Admin Side:**
1. Admin creates gift card with:
   - **Name**: e.g., "Holiday Bonus"
   - **Amount**: e.g., $100
   - **Max Redemptions**: e.g., 15 (first 15 users can redeem)
   - **Image**: Upload/provide URL
   - **Description**: Optional message
   - **Expiry Date**: When it expires (required)
   - **Send to All**: true/false
   - **Excluded Users**: List of user IDs to exclude from email
   - **Code**: Auto-generated (e.g., GIFT12345678) or custom

2. Admin clicks "Send Email":
   - If **send_to_all = true**: Sends to ALL users EXCEPT excluded ones
   - If **send_to_all = false**: Sends to specific user list

3. System sends beautiful HTML email to selected users

### **User Side:**
1. User receives email with gift card code
2. User logs in and goes to "Avail Gift Card"
3. User pastes code
4. System checks:
   - ✅ Is code valid?
   - ✅ Has it expired?
   - ✅ Has user already redeemed?
   - ✅ **Is max redemptions reached?** (NEW)
5. If all checks pass:
   - **🎉 Celebration animation**
   - Balance increases instantly
   - User sees: "You were #5 out of 15 lucky users!"
6. If max redemptions reached:
   - Error: "Sorry! This gift card has been fully redeemed by other users"

---

## 📊 **Updated Database Schema**

### **`gift_cards` Collection**
```javascript
{
  _id: ObjectId,
  code: "GIFT12345678",
  name: "Holiday Bonus",
  description: "Special holiday gift",
  amount: 100,
  max_redemptions: 15,  // NEW: First 15 users can redeem
  image_url: "https://...",
  expiry_date: ISODate("2025-12-31T23:59:59Z"),
  send_to_all: true,  // NEW: Send to all users
  excluded_users: [ObjectId("user1"), ObjectId("user2")],  // NEW: Users to exclude
  redeemed_by: [ObjectId("user3"), ObjectId("user4")],  // Users who redeemed
  status: "active",  // active, expired, cancelled, fully_redeemed
  created_by: ObjectId("admin_id"),
  created_at: ISODate,
  updated_at: ISODate,
  redemption_count: 2,  // Current number of redemptions
  total_credited: 200,  // Total amount credited
  email_sent_to: [ObjectId("user1"), ObjectId("user2"), ...]  // Track emails
}
```

### **`gift_card_redemptions` Collection**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  gift_card_id: ObjectId,
  code: "GIFT12345678",
  amount: 100,
  redeemed_at: ISODate,
  status: "credited",
  redemption_number: 5  // NEW: This user was the 5th to redeem
}
```

---

## 🔄 **Auto-Deactivation Logic**

When a user redeems:
1. Check current `redemption_count`
2. If `redemption_count >= max_redemptions`:
   - Return error: "Gift card fully redeemed"
3. Credit user balance
4. Increment `redemption_count`
5. If `redemption_count == max_redemptions`:
   - **Auto-deactivate**: Set `status = 'fully_redeemed'`
   - Log: "🔒 Gift card auto-deactivated after 15 redemptions"

---

## 📧 **Email Sending Logic**

### **Scenario 1: Send to All Users**
```json
{
  "send_to_all": true,
  "excluded_users": ["user_id_1", "user_id_2"]
}
```
- Sends to **ALL users** in database
- **Excludes** users in `excluded_users` list

### **Scenario 2: Send to Specific Users**
```json
{
  "send_to_all": false,
  "user_ids": ["user_id_3", "user_id_4", "user_id_5"]
}
```
- Sends only to specified `user_ids`

---

## ✅ **Updated Backend Implementation**

### **Files Modified:**

1. **`backend/models/gift_card.py`**
   - ✅ Added `max_redemptions` field (required)
   - ✅ Added `send_to_all` field (default: true)
   - ✅ Added `excluded_users` field (list of user IDs)
   - ✅ Removed `assigned_users` (no longer needed)
   - ✅ Updated `create_gift_card()` to validate `max_redemptions`
   - ✅ Updated `send_gift_card_email()` to support send_to_all and exclusions
   - ✅ Updated `redeem_gift_card()` to:
     - Check max redemptions limit
     - Auto-deactivate when limit reached
     - Return redemption number (e.g., "You were #5 out of 15")
   - ✅ Updated `get_user_gift_cards()` to return all active cards (no user assignment)
   - ✅ Added `redemption_number` to redemption records

2. **`backend/routes/gift_cards.py`**
   - ✅ Updated `create_gift_card` endpoint documentation
   - ✅ Updated email sending logic to support send_to_all
   - ✅ Updated `redeem_gift_card` response to include redemption stats
   - ✅ Updated success message: "You were #5 out of 15 lucky users!"

---

## 🎯 **API Request Examples**

### **Create Gift Card (Send to All)**
```json
POST /api/admin/gift-cards
{
  "name": "Holiday Bonus",
  "amount": 100,
  "max_redemptions": 15,
  "image_url": "https://example.com/gift.jpg",
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "excluded_users": ["675e123...", "675e456..."],
  "send_email": true
}
```

### **Create Gift Card (Send to Specific Users)**
```json
POST /api/admin/gift-cards
{
  "name": "VIP Bonus",
  "amount": 50,
  "max_redemptions": 10,
  "image_url": "https://example.com/vip.jpg",
  "expiry_date": "2025-12-25T23:59:59Z",
  "send_to_all": false,
  "user_ids": ["675e789...", "675eabc..."],
  "send_email": true
}
```

### **Redeem Gift Card**
```json
POST /api/publisher/gift-cards/redeem
{
  "code": "GIFT12345678"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "🎉 Congratulations! You redeemed $100.00! You were #5 out of 15 lucky users!",
  "amount": 100,
  "new_balance": 250,
  "gift_card_name": "Holiday Bonus",
  "redemption_number": 5,
  "max_redemptions": 15
}
```

**Error Response (Fully Redeemed):**
```json
{
  "success": false,
  "error": "Sorry! This gift card has been fully redeemed (limit: 15 users)"
}
```

---

## 🚀 **Frontend Implementation Needed**

### **Admin Panel:**
1. Gift card creation form:
   - ✅ Name input
   - ✅ Amount input
   - ✅ **Max Redemptions input** (e.g., 10, 15, 20)
   - ✅ Image upload/URL
   - ✅ **Expiry Date/Time picker** (required)
   - ✅ **"Send to All Users" checkbox**
   - ✅ **"Exclude Users" multi-select** (if send_to_all is checked)
   - ✅ "Send Email" checkbox

2. Gift card management table:
   - Show: Code, Name, Amount, **Max Redemptions**, **Redeemed Count**, Status
   - Example: "GIFT123 | Holiday Bonus | $100 | 5/15 Redeemed | Active"

### **User Panel:**
1. "Avail Gift Card" page:
   - Input for code
   - Redeem button
   - **Celebration animation** on success
   - Show message: "You were #5 out of 15 lucky users!"

2. "Available Gift Cards" page:
   - Show all active gift cards
   - Display: Image, Name, Amount, **Remaining Slots** (e.g., "10/15 remaining")
   - Show if user already redeemed
   - Show if fully redeemed

---

## 📝 **Key Differences from Previous Version**

| Feature | Old Version | New Version |
|---------|-------------|-------------|
| **User Assignment** | Assigned to specific users | **Anyone can redeem** (first-come-first-served) |
| **Redemption Limit** | One per user | **First N users** (configurable) |
| **Email Sending** | To assigned users only | **To all users** with exclusion list |
| **Status** | active, expired, cancelled | active, expired, cancelled, **fully_redeemed** |
| **Auto-Deactivation** | On expiry only | **On max redemptions** + expiry |
| **User Feedback** | "Redeemed successfully" | **"You were #5 out of 15!"** |

---

## ✅ **Backend Status: 100% COMPLETE**

All backend changes are implemented and ready for testing:
- ✅ First-come-first-served model
- ✅ Max redemptions with auto-deactivation
- ✅ Send to all users with exclusion list
- ✅ Expiry date validation
- ✅ Redemption number tracking
- ✅ Updated API responses

---

## 🎉 **Ready for Frontend!**

The backend is fully updated and ready. You can now build the frontend with:
1. Max redemptions input
2. Send to all users checkbox
3. Exclude users multi-select
4. Expiry date/time picker
5. Redemption stats display ("5/15 redeemed")
6. Celebration animation with "You were #5 out of 15!" message

🚀 **Let's make this amazing!**
