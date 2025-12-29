# Promo Code Enhancement - Testing Guide

## 🚀 Quick Start Testing

### Prerequisites:
1. Backend server running
2. Frontend dev server running
3. Admin account credentials
4. MongoDB connected

---

## Step-by-Step Testing Instructions

### **Step 1: Start the Application**

#### Backend:
```bash
cd backend
python app.py
```
**Expected:** Server starts on port 5000 (or configured port)

#### Frontend:
```bash
npm run dev
```
**Expected:** Dev server starts (usually port 5173)

---

### **Step 2: Test Time-Based Validity (Active Hours)**

#### A. Create a Promo Code with Active Hours

1. **Login as Admin**
   - Navigate to: `http://localhost:5173` (or your frontend URL)
   - Login with admin credentials

2. **Go to Promo Code Management**
   - Click on "Promo Codes" in admin menu

3. **Create New Promo Code**
   - Click "Create Promo Code" button
   - Fill in basic details:
     ```
     Code: MORNING10
     Name: Morning 10% Bonus
     Description: 10% extra bonus during morning hours
     Bonus Type: Percentage
     Bonus Amount: 10
     Max Uses: 100
     ```

4. **Enable Active Hours**
   - Toggle "Time-Based Validity" switch to ON
   - Set Start Time: `06:00`
   - Set End Time: `09:00`
   - Select Timezone: `Asia/Kolkata (IST)`

5. **Enable Auto-Deactivation**
   - Check "Auto-deactivate when max uses reached" ✓

6. **Submit**
   - Click "Create Promo Code"
   - **Expected:** Success toast message
   - **Expected:** Code appears in the list

#### B. Verify in Database

Open MongoDB and check:
```javascript
db.promo_codes.findOne({code: "MORNING10"})
```

**Expected Output:**
```javascript
{
  code: "MORNING10",
  active_hours: {
    enabled: true,
    start_time: "06:00",
    end_time: "09:00",
    timezone: "Asia/Kolkata"
  },
  auto_deactivate_on_max_uses: true,
  // ... other fields
}
```

#### C. Test Time Validation

**Method 1: Using API (Postman/curl)**

```bash
# Get your auth token first (login as publisher)
# Then try to apply the code

# If current time is OUTSIDE 6 AM - 9 AM:
curl -X POST http://localhost:5000/api/publisher/promo-codes/apply \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "MORNING10"}'
```

**Expected Response (if outside hours):**
```json
{
  "error": "Promo code is only valid between 06:00 and 09:00 Asia/Kolkata"
}
```

**Expected Response (if within hours):**
```json
{
  "message": "Promo code applied successfully",
  "user_promo_code": { ... }
}
```

**Method 2: Temporarily Change Times for Testing**

Edit the promo code to have current time range:
- Start Time: Current time - 1 hour
- End Time: Current time + 1 hour
- Test application (should succeed)

---

### **Step 3: Test Auto-Deactivation**

#### A. Create Test Code with Low Max Uses

1. **Create New Promo Code**
   ```
   Code: TEST10
   Name: Test Auto-Deactivate
   Bonus Type: Fixed
   Bonus Amount: 5
   Max Uses: 3  ← Set to 3 for easy testing
   Auto-deactivate: ✓ Enabled
   ```

2. **Apply Code 3 Times**

   **Option 1: Using Multiple User Accounts**
   - Login as Publisher 1 → Apply "TEST10"
   - Login as Publisher 2 → Apply "TEST10"
   - Login as Publisher 3 → Apply "TEST10"

   **Option 2: Using Database (Quick Test)**
   ```javascript
   // Manually increment usage_count
   db.promo_codes.updateOne(
     {code: "TEST10"},
     {$set: {usage_count: 3}}
   )
   
   // Trigger auto-deactivation by recording a bonus
   // (This happens automatically when a user completes an offer)
   ```

3. **Verify Auto-Deactivation**

   Check database:
   ```javascript
   db.promo_codes.findOne({code: "TEST10"})
   ```

   **Expected:**
   ```javascript
   {
     code: "TEST10",
     usage_count: 3,
     max_uses: 3,
     status: "expired",  ← Should be expired
     auto_deactivated_at: ISODate("..."),  ← Should have timestamp
     // ...
   }
   ```

4. **Try to Apply Again**
   - Try applying "TEST10" with a new user
   - **Expected Error:** "Promo code has reached maximum uses"

---

### **Step 4: Test Offer Tracking**

#### A. Setup

1. **Ensure you have offers in the system**
   - Go to Admin → Offers
   - Note down an offer ID (e.g., "PL-00001")

2. **Create or use existing promo code**
   - Code: "SUMMER20"

#### B. Simulate User Flow

1. **User applies promo code**
   ```bash
   POST /api/publisher/promo-codes/apply
   {
     "code": "SUMMER20"
   }
   ```

2. **User completes an offer**
   - This happens via postback
   - Simulate by calling the bonus calculation endpoint
   
   **Check backend logs for:**
   ```
   ✅ Tracked offer application: User {user_id} used promo on offer {offer_name}
   ```

3. **Verify in Database**
   ```javascript
   db.user_promo_codes.findOne({code: "SUMMER20"})
   ```

   **Expected:**
   ```javascript
   {
     code: "SUMMER20",
     offer_applications: [
       {
         offer_id: "...",
         offer_name: "Survey Offer 1",
         applied_at: ISODate("..."),
         bonus_earned: 5.0,
         conversion_id: "..."
       }
     ]
   }
   ```

---

### **Step 5: Test Enhanced Analytics**

#### A. View Analytics in Admin UI

1. **Go to Promo Code Management**
2. **Click Analytics button** (📊 icon) on any promo code
3. **Verify 3 Tabs Appear:**
   - Overview
   - Offer Breakdown
   - User Applications

#### B. Test Overview Tab

**Expected to see:**
- Total Uses: (number)
- Users Applied: (number)
- Total Bonus: $(amount)

#### C. Test Offer Breakdown Tab

1. **Click "Offer Breakdown" tab**

**If code has been used on offers:**
```
Offers where "SUMMER20" was used:

| Offer Name    | Uses | Total Bonus | Unique Users |
|---------------|------|-------------|--------------|
| Survey Offer 1|  25  | $125.00     | 20           |
| Survey Offer 2|  15  | $75.00      | 12           |
```

**If no data:**
```
No offer usage data available yet
```

#### D. Test User Applications Tab

1. **Click "User Applications" tab**

**If users have applied code:**
```
User Applications:

| Username | Offer          | Bonus Earned | Date     |
|----------|----------------|--------------|----------|
| john_doe | Survey Offer 1 | $5.00        | 12/11/24 |
| jane_doe | Survey Offer 2 | $4.00        | 12/10/24 |
```

**If no data:**
```
No user applications yet
```

---

### **Step 6: Test API Endpoints Directly**

#### A. Get Offer Analytics

```bash
curl -X GET http://localhost:5000/api/admin/promo-codes/{CODE_ID}/offer-analytics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "analytics": {
    "code": "SUMMER20",
    "total_uses": 50,
    "offer_breakdown": [
      {
        "offer_id": "...",
        "offer_name": "Survey Offer 1",
        "uses": 25,
        "total_bonus": 125.0,
        "unique_users": 20
      }
    ]
  }
}
```

#### B. Get User Applications

```bash
curl -X GET http://localhost:5000/api/admin/promo-codes/{CODE_ID}/user-applications \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "applications": [
    {
      "user_id": "...",
      "username": "john_doe",
      "email": "john@example.com",
      "offer_id": "...",
      "offer_name": "Survey Offer 1",
      "applied_at": "2024-12-11T10:00:00Z",
      "bonus_earned": 5.0,
      "conversion_id": "..."
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

## 🐛 Troubleshooting

### Issue: "Module 'pytz' not found"

**Solution:**
```bash
cd backend
pip install pytz
```

### Issue: "Checkbox component not found"

**Solution:**
```bash
# Install shadcn checkbox component
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add switch
```

### Issue: Active hours validation not working

**Check:**
1. Verify timezone is correct
2. Check server time vs. your local time
3. Look at backend logs for validation errors

### Issue: Analytics tabs not showing data

**Check:**
1. Ensure promo code has been used
2. Check browser console for API errors
3. Verify API endpoints are returning data (use curl)

---

## ✅ Complete Test Checklist

### Backend Tests:

- [ ] Migration script ran successfully
- [ ] Promo codes have new fields in database
- [ ] Time validation works (inside/outside hours)
- [ ] Auto-deactivation triggers at max uses
- [ ] Offer applications are tracked
- [ ] Offer analytics endpoint returns data
- [ ] User applications endpoint returns data

### Frontend Tests:

- [ ] Create dialog shows new fields
- [ ] Time pickers work correctly
- [ ] Timezone selector works
- [ ] Auto-deactivate checkbox works
- [ ] Form submits with new fields
- [ ] Analytics dialog opens
- [ ] All 3 tabs are visible
- [ ] Overview tab shows data
- [ ] Offer breakdown tab shows data
- [ ] User applications tab shows data
- [ ] Empty states display correctly

### Integration Tests:

- [ ] Create code → Apply → Complete offer → Check analytics
- [ ] Time restriction prevents application outside hours
- [ ] Auto-deactivation prevents use after max uses
- [ ] Offer tracking shows correct offer names
- [ ] User applications show correct usernames

---

## 🎯 Quick Test Scenario

**5-Minute End-to-End Test:**

1. **Create code "QUICKTEST"**
   - Active hours: Current time ± 1 hour
   - Max uses: 2
   - Auto-deactivate: ON

2. **Apply as Publisher**
   - Should succeed (within hours)

3. **Simulate 2 uses**
   - Manually set usage_count to 2 in database

4. **Check status**
   - Should be "expired"

5. **View analytics**
   - Should show in all 3 tabs

**If all steps work → Implementation is successful! ✅**

---

## 📝 Notes

- Test with current time for active hours (easier than waiting)
- Use low max_uses values (2-3) for quick auto-deactivation testing
- Check backend logs for detailed error messages
- Use browser DevTools Network tab to inspect API calls

---

**Need help with any specific test?** Let me know!
