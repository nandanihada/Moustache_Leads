# 🔍 PROMO CODE DEBUG GUIDE

## Database Schema Check

### **Offer Collection Schema**

The offer document should have these promo code fields:

```javascript
{
  // ... other fields ...
  
  // SECTION 12: PROMO CODE ASSIGNMENT
  promo_code_id: ObjectId("..."),           // ID of promo code
  promo_code: "SUMMER20",                   // Code name
  bonus_amount: 20,                         // Bonus amount
  bonus_type: "percentage",                 // percentage or fixed
  promo_code_assigned_at: ISODate("..."),   // When assigned
  promo_code_assigned_by: ObjectId("..."),  // Admin who assigned
  
  // ... other fields ...
}
```

---

## Step-by-Step Verification

### **Step 1: Check Offer Document in MongoDB**

```javascript
// Connect to MongoDB
use lovable_ascend

// Find an offer and check promo code fields
db.offers.findOne({offer_id: "PL-00001"})

// Expected output:
{
  _id: ObjectId("..."),
  offer_id: "PL-00001",
  name: "Finance App",
  payout: 10,
  promo_code_id: ObjectId("..."),
  promo_code: "SUMMER20",
  bonus_amount: 20,
  bonus_type: "percentage",
  promo_code_assigned_at: ISODate("2025-11-21T..."),
  promo_code_assigned_by: ObjectId("..."),
  // ... other fields ...
}
```

**If promo_code fields are NULL or missing:**
- Issue: Promo code not being saved
- Solution: Check backend logs for errors

---

### **Step 2: Check Backend Logs**

When creating/editing offer with promo code, look for these log messages:

```
✅ Promo code SUMMER20 will be assigned to new offer
✅ Promo code SUMMER20 assigned to offer PL-00001
📧 Emails sent to X publishers
```

**If you see errors:**
```
❌ Error fetching promo code details: ...
```

**Possible causes:**
- Invalid promo_code_id format
- Promo code doesn't exist in database
- Database connection issue

---

### **Step 3: Check API Response**

**Test 1: Create Offer with Promo Code**

```bash
curl -X POST http://localhost:5000/api/admin/offers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Offer",
    "network": "PepperAds",
    "payout": 10,
    "target_url": "https://example.com",
    "promo_code_id": "ObjectId_of_promo_code"
  }'
```

**Expected response:**
```json
{
  "message": "Offer created successfully",
  "offer": {
    "offer_id": "PL-00001",
    "name": "Test Offer",
    "promo_code": "SUMMER20",
    "bonus_amount": 20,
    "bonus_type": "percentage",
    ...
  }
}
```

**Test 2: Get Publisher Offers**

```bash
curl -X GET http://localhost:5000/api/publisher/offers/available \
  -H "Authorization: Bearer <token>"
```

**Expected response:**
```json
{
  "success": true,
  "offers": [
    {
      "offer_id": "PL-00001",
      "name": "Test Offer",
      "promo_code": "SUMMER20",
      "bonus_amount": 20,
      "bonus_type": "percentage",
      ...
    }
  ]
}
```

---

## Common Issues & Solutions

### **Issue 1: Promo code fields are NULL in database**

**Symptoms:**
- Offer created but promo_code field is NULL
- No bonus visible on offer card

**Debugging:**
1. Check backend logs for "Error fetching promo code details"
2. Verify promo_code_id is being sent from frontend
3. Verify promo code exists in promo_codes collection

**Solution:**
```javascript
// Check if promo code exists
db.promo_codes.findOne({_id: ObjectId("...")})

// If not found, create one:
db.promo_codes.insertOne({
  code: "SUMMER20",
  bonus_amount: 20,
  bonus_type: "percentage",
  status: "active",
  created_at: new Date(),
  created_by: ObjectId("...")
})
```

---

### **Issue 2: Promo code not visible on publisher offer card**

**Symptoms:**
- Offer created with promo code
- Publisher doesn't see blue bonus box

**Debugging:**
1. Check if offer has promo_code field in database
2. Check if publisher offers endpoint returns promo_code
3. Check browser console for errors

**Solution:**
1. Verify offer document has promo_code field
2. Restart backend server
3. Clear browser cache (Ctrl+Shift+Delete)
4. Refresh page

---

### **Issue 3: Promo code disappears after refresh**

**Symptoms:**
- Promo code visible initially
- After F5 refresh, bonus box gone

**Debugging:**
1. Check if data is persisted in database
2. Check if publisher endpoint returns promo_code

**Solution:**
```javascript
// Verify data is in database
db.offers.findOne({offer_id: "PL-00001"}, {promo_code: 1, bonus_amount: 1})

// Should show:
{
  _id: ObjectId("..."),
  promo_code: "SUMMER20",
  bonus_amount: 20
}
```

---

### **Issue 4: Email not sent when promo code assigned**

**Symptoms:**
- Offer created with promo code
- No email received by publishers

**Debugging:**
1. Check backend logs for email sending
2. Check email service configuration
3. Check if publishers have valid emails

**Solution:**
1. Check backend logs for "Emails sent to X publishers"
2. Verify email service is configured
3. Check if publishers have email addresses

---

## Testing Workflow

### **Complete Test Flow**

**1. Create Promo Code**
```bash
# Admin creates promo code
POST /api/admin/promo-codes
{
  "code": "SUMMER20",
  "bonus_amount": 20,
  "bonus_type": "percentage",
  "status": "active"
}
```

**2. Create Offer with Promo Code**
```bash
# Admin creates offer with promo code
POST /api/admin/offers
{
  "name": "Finance App",
  "network": "PepperAds",
  "payout": 10,
  "target_url": "https://example.com",
  "promo_code_id": "ObjectId_from_step_1"
}

# Check response has promo_code field
```

**3. Verify in Database**
```javascript
db.offers.findOne({offer_id: "PL-00001"})
// Should have promo_code, bonus_amount, bonus_type
```

**4. Publisher Views Offer**
```bash
# Publisher gets offers
GET /api/publisher/offers/available

# Check response includes promo_code, bonus_amount, bonus_type
```

**5. Frontend Displays Bonus**
- Publisher sees blue box on offer card
- Shows: "🎉 Bonus Code Available"
- Shows: "Code: SUMMER20"
- Shows: "+20% Extra Bonus"

**6. Refresh Page**
- F5
- Bonus still visible

---

## Logs to Check

### **Backend Logs**

When creating offer with promo code, look for:

```
📥 CREATE OFFER - Full payload keys: [...]
✅ Promo code SUMMER20 will be assigned to new offer
✅ Offer created successfully
📧 Emails sent to X publishers
✅ Promo code SUMMER20 assigned to offer PL-00001
```

### **Browser Console**

Open DevTools (F12) → Console tab

Look for:
- No errors
- Successful API responses
- Promo code data in response

### **Network Tab**

Open DevTools (F12) → Network tab

Check:
- POST /api/admin/offers - Response has promo_code
- GET /api/publisher/offers/available - Response has promo_code

---

## Quick Checklist

- [ ] Promo code exists in database
- [ ] Promo code is "active" status
- [ ] Offer document has promo_code field
- [ ] Offer document has bonus_amount field
- [ ] Offer document has bonus_type field
- [ ] Publisher endpoint returns promo code fields
- [ ] Frontend displays blue bonus box
- [ ] Bonus visible after page refresh
- [ ] Email sent to publishers
- [ ] Backend logs show success messages

---

## If Still Not Working

1. **Restart backend server**
   ```bash
   # Stop: Ctrl+C
   # Start: python app.py
   ```

2. **Clear browser cache**
   - Ctrl+Shift+Delete
   - Clear all cache

3. **Check MongoDB connection**
   ```javascript
   db.adminCommand("ping")
   // Should return: { ok: 1 }
   ```

4. **Check logs for errors**
   - Look for red error messages
   - Check database connection errors
   - Check email service errors

5. **Verify promo code exists**
   ```javascript
   db.promo_codes.find({status: "active"})
   ```

---

## Support

If issues persist:
1. Check backend logs for error messages
2. Verify database has promo codes
3. Verify offer document structure
4. Check browser console for errors
5. Verify API responses in Network tab

