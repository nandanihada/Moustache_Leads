# Gift Card System - Testing Guide

## 🧪 **Backend Testing Checklist**

### **1. Gift Card Creation**

#### **Test 1.1: Create with Send to All**
```bash
POST /api/admin/gift-cards
{
  "name": "Test Gift Card - All Users",
  "amount": 50,
  "max_redemptions": 5,
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "excluded_users": [],
  "send_email": true
}
```
**Expected:** 
- ✅ Gift card created
- ✅ Emails sent to all users
- ✅ Status: active

#### **Test 1.2: Create with Excluded Users**
```bash
POST /api/admin/gift-cards
{
  "name": "Test Gift Card - Excluded",
  "amount": 100,
  "max_redemptions": 10,
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "excluded_users": ["<user_id_1>", "<user_id_2>"],
  "send_email": true
}
```
**Expected:**
- ✅ Gift card created
- ✅ Emails sent to all EXCEPT excluded users
- ✅ Excluded users don't receive email

#### **Test 1.3: Create with Custom Code**
```bash
POST /api/admin/gift-cards
{
  "name": "Custom Code Test",
  "amount": 25,
  "max_redemptions": 3,
  "code": "CUSTOM123",
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true
}
```
**Expected:**
- ✅ Gift card created with code "CUSTOM123"
- ✅ No auto-generated code

#### **Test 1.4: Validation - Missing Required Fields**
```bash
POST /api/admin/gift-cards
{
  "name": "Invalid Test"
}
```
**Expected:**
- ❌ Error: "Field 'amount' is required"
- ❌ Error: "Field 'max_redemptions' is required"

#### **Test 1.5: Validation - Invalid Expiry Date**
```bash
POST /api/admin/gift-cards
{
  "name": "Expired Test",
  "amount": 50,
  "max_redemptions": 5,
  "expiry_date": "2020-01-01T00:00:00Z"
}
```
**Expected:**
- ❌ Error: "Expiry date must be in the future"

---

### **2. Gift Card Redemption**

#### **Test 2.1: Successful Redemption**
```bash
POST /api/publisher/gift-cards/redeem
{
  "code": "GIFT12345678"
}
```
**Expected:**
- ✅ Success message with redemption number
- ✅ Balance increased
- ✅ Redemption count incremented
- ✅ User added to redeemed_by array

#### **Test 2.2: Duplicate Redemption**
```bash
# Same user tries to redeem again
POST /api/publisher/gift-cards/redeem
{
  "code": "GIFT12345678"
}
```
**Expected:**
- ❌ Error: "You have already redeemed this gift card"

#### **Test 2.3: Max Redemptions Reached**
```bash
# After 5 users redeem (max_redemptions = 5)
POST /api/publisher/gift-cards/redeem
{
  "code": "GIFT12345678"
}
```
**Expected:**
- ❌ Error: "Sorry! This gift card has been fully redeemed (limit: 5 users)"
- ✅ Gift card status changed to "fully_redeemed"

#### **Test 2.4: Expired Gift Card**
```bash
POST /api/publisher/gift-cards/redeem
{
  "code": "EXPIRED123"
}
```
**Expected:**
- ❌ Error: "Gift card has expired"
- ✅ Status auto-changed to "expired"

#### **Test 2.5: Invalid Code**
```bash
POST /api/publisher/gift-cards/redeem
{
  "code": "INVALID999"
}
```
**Expected:**
- ❌ Error: "Gift card not found"

---

### **3. Auto-Deactivation**

#### **Test 3.1: Auto-Deactivate on Max Redemptions**
**Steps:**
1. Create gift card with max_redemptions = 3
2. Have 3 different users redeem
3. Check gift card status

**Expected:**
- ✅ After 3rd redemption, status = "fully_redeemed"
- ✅ 4th user gets error: "fully redeemed"

#### **Test 3.2: Auto-Expire on Date**
**Steps:**
1. Create gift card with expiry_date in past (manually in DB)
2. Try to redeem

**Expected:**
- ✅ Status auto-changed to "expired"
- ❌ Error: "Gift card has expired"

---

### **4. Email Sending**

#### **Test 4.1: Send to All Users**
**Steps:**
1. Create gift card with send_to_all = true
2. Check email logs

**Expected:**
- ✅ All users in database receive email
- ✅ Email contains: code, amount, image, expiry

#### **Test 4.2: Exclude Users**
**Steps:**
1. Create gift card with excluded_users = [user1, user2]
2. Check email logs

**Expected:**
- ✅ user1 and user2 do NOT receive email
- ✅ All other users receive email

#### **Test 4.3: Email Content**
**Check email contains:**
- ✅ Gift card image
- ✅ Gift card code (large, prominent)
- ✅ Amount ($X.XX)
- ✅ Expiry date
- ✅ "Redeem Now" button
- ✅ Redemption instructions

---

### **5. Gift Card Listing**

#### **Test 5.1: Admin - Get All Gift Cards**
```bash
GET /api/admin/gift-cards?skip=0&limit=20
```
**Expected:**
- ✅ Returns all gift cards
- ✅ Shows: code, name, amount, max_redemptions, redemption_count, status

#### **Test 5.2: User - Get Available Gift Cards**
```bash
GET /api/publisher/gift-cards
```
**Expected:**
- ✅ Returns all active & not-fully-redeemed cards
- ✅ Shows remaining_redemptions
- ✅ Shows is_redeemed (for current user)

#### **Test 5.3: User - Get Redemption History**
```bash
GET /api/publisher/gift-cards/history
```
**Expected:**
- ✅ Returns user's redeemed gift cards
- ✅ Shows: code, amount, redeemed_at, redemption_number

---

### **6. Balance Management**

#### **Test 6.1: Get User Balance**
```bash
GET /api/publisher/balance
```
**Expected:**
- ✅ Returns current balance
- ✅ Balance reflects all gift card redemptions

#### **Test 6.2: Balance Update on Redemption**
**Steps:**
1. Get initial balance
2. Redeem $50 gift card
3. Get new balance

**Expected:**
- ✅ new_balance = initial_balance + 50

---

### **7. Edge Cases**

#### **Test 7.1: Concurrent Redemptions**
**Steps:**
1. Create gift card with max_redemptions = 1
2. Have 2 users try to redeem simultaneously

**Expected:**
- ✅ Only 1 user succeeds
- ❌ 2nd user gets "fully redeemed" error

#### **Test 7.2: Large Excluded List**
**Steps:**
1. Create gift card excluding 100 users
2. Send emails

**Expected:**
- ✅ All users except 100 receive email
- ✅ No performance issues

#### **Test 7.3: Special Characters in Code**
```bash
POST /api/admin/gift-cards
{
  "code": "GIFT@#$%",
  ...
}
```
**Expected:**
- ❌ Error: "Code must be alphanumeric"

---

## 🎯 **Manual Testing Scenarios**

### **Scenario 1: Complete Flow**
1. **Admin creates gift card:**
   - Name: "New Year Bonus"
   - Amount: $100
   - Max redemptions: 5
   - Expiry: 2025-12-31
   - Send to all: Yes
   - Exclude: 2 users

2. **Verify emails sent:**
   - Check all users received email
   - Check excluded users didn't receive

3. **User 1 redeems:**
   - Paste code
   - See: "You were #1 out of 5!"
   - Balance increases by $100

4. **User 1 tries again:**
   - Error: "Already redeemed"

5. **Users 2, 3, 4, 5 redeem:**
   - Each sees their number (#2, #3, #4, #5)

6. **User 6 tries to redeem:**
   - Error: "Fully redeemed"
   - Gift card status = "fully_redeemed"

---

### **Scenario 2: Expiry Flow**
1. Create gift card expiring in 1 hour
2. Wait 1 hour
3. Try to redeem
4. Verify auto-expiry

---

### **Scenario 3: Admin Management**
1. Create multiple gift cards
2. View list in admin panel
3. Check redemption stats (X/Y redeemed)
4. Cancel a gift card
5. Verify cancelled card can't be redeemed

---

## 📊 **Database Verification**

### **Check Gift Card Document**
```javascript
db.gift_cards.findOne({code: "GIFT12345678"})
```
**Verify:**
- ✅ max_redemptions field exists
- ✅ redemption_count accurate
- ✅ redeemed_by array correct
- ✅ status updates correctly
- ✅ excluded_users array present

### **Check Redemption Records**
```javascript
db.gift_card_redemptions.find({gift_card_id: ObjectId("...")})
```
**Verify:**
- ✅ redemption_number sequential (1, 2, 3...)
- ✅ All redemptions recorded
- ✅ Timestamps correct

### **Check User Balance**
```javascript
db.users.findOne({_id: ObjectId("...")})
```
**Verify:**
- ✅ balance field updated
- ✅ Balance = sum of all gift card redemptions

---

## 🐛 **Known Issues to Test**

1. **Race Condition:**
   - Multiple users redeeming at exact same time
   - Should handle gracefully with atomic operations

2. **Email Failures:**
   - What happens if email service is down?
   - Gift card should still be created

3. **Large User Base:**
   - Sending to 10,000+ users
   - Should batch emails or use queue

---

## ✅ **Success Criteria**

- [ ] All gift cards created successfully
- [ ] Emails sent to correct users
- [ ] Excluded users don't receive emails
- [ ] Max redemptions enforced
- [ ] Auto-deactivation works
- [ ] Duplicate redemption prevented
- [ ] Expiry validation works
- [ ] Balance updates correctly
- [ ] Redemption number tracking accurate
- [ ] All error messages clear and helpful

---

## 🚀 **Performance Benchmarks**

- Gift card creation: < 500ms
- Email sending (100 users): < 30s
- Redemption: < 200ms
- Balance query: < 100ms
- List gift cards: < 300ms

---

## 📝 **Test Report Template**

```
Test Date: ___________
Tester: ___________

| Test Case | Status | Notes |
|-----------|--------|-------|
| Create with send_to_all | ✅/❌ | |
| Create with exclusions | ✅/❌ | |
| Successful redemption | ✅/❌ | |
| Duplicate redemption | ✅/❌ | |
| Max redemptions reached | ✅/❌ | |
| Auto-deactivation | ✅/❌ | |
| Email sending | ✅/❌ | |
| Balance update | ✅/❌ | |

Overall Status: PASS / FAIL
```

---

**Ready to test! 🎉**
