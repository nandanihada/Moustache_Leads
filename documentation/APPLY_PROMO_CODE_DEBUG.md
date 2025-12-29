# 🔍 Apply Promo Code - Debug Guide

## Issue
- Apply promo code button not visible on offer cards
- OR button visible but getting 400 error when clicking

## Root Causes & Fixes

### **Cause 1: Promo Code Fields Null in Database**

**Check**: Run this in backend:
```bash
python check_offer_schema.py
```

**Expected Output**:
```
✅ promo_code_id: ObjectId(...)
✅ promo_code: SUMMER20
✅ bonus_amount: 20
✅ bonus_type: percentage
```

**If NOT showing**:
1. Admin needs to create NEW offer with promo code
2. Make sure to add schedule or smartRules (triggers OfferExtended)
3. Save offer

---

### **Cause 2: Button Not Showing**

**Check**: Open browser console (F12) and check:
```javascript
// In console, check if offer has promo_code
console.log(offer)
```

**Expected**: Should show `promo_code: "SUMMER20"`

**If missing**:
1. Backend endpoint not returning promo_code field
2. Check: `backend/routes/publisher_offers.py` line 121-124
3. Should include: `'promo_code': offer.get('promo_code')`

---

### **Cause 3: 400 Error When Applying**

**Check**: Backend logs when clicking "Apply Code"

**Expected Log**:
```
🔍 Apply promo code request: offer_id=ML-00093, data={'promo_code_id': '...'}
✅ Publisher admin applied code SUMMER20 to offer My first offer
```

**If Error**:
```
❌ Missing promo_code_id in request
```

**Fix**: Frontend not sending promo_code_id
- Check: `src/components/OfferCardWithApproval.tsx` line 90
- Should send: `{ promo_code_id: selectedPromoCode }`

---

## Step-by-Step Testing

### **Step 1: Verify Offer Has Promo Code in Database**

```bash
cd backend
python check_offer_schema.py
```

Look for:
```
✅ promo_code_id: ObjectId(...)
✅ promo_code: SUMMER20
```

If NOT found:
1. Go to admin dashboard
2. Create NEW offer with:
   - Name: "Test Offer"
   - Payout: $10
   - Add schedule (any date range)
   - Select promo code
   - Save

---

### **Step 2: Verify Offer Data in API Response**

Open browser console and run:
```javascript
// Check what the API returns
fetch('http://localhost:5000/api/publisher/offers/available', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(r => r.json())
.then(d => {
  console.log('Offers:', d.offers);
  d.offers.forEach(o => {
    console.log(`${o.offer_id}: promo_code=${o.promo_code}, promo_code_id=${o.promo_code_id}`);
  });
});
```

Expected output:
```
ML-00093: promo_code=SUMMER20, promo_code_id=507f1f77bcf86cd799439011
```

If promo_code is null:
- Backend not returning it
- Check: `backend/routes/publisher_offers.py` line 121-124

---

### **Step 3: Verify Button Shows**

1. Go to Publisher → Offers
2. Find offer with promo code
3. Should see:
   - Blue box: "🎉 Bonus Code Available"
   - Button: "Apply Code"
   - Payout: ~~$10~~ **$12** (with bonus)

If button NOT showing:
- Check browser console for errors
- Verify promo_code field exists in offer object

---

### **Step 4: Test Apply Promo Code**

1. Click "Apply Code" button
2. Dialog opens showing code details
3. Select code from dropdown
4. Click "Apply Code" button
5. Should see success message

If getting 400 error:
- Check backend logs
- Should show: `🔍 Apply promo code request: offer_id=ML-00093, data={...}`
- If not showing, frontend not sending request

---

## Backend Endpoint Details

**Endpoint**: `POST /api/publisher/offers/{offer_id}/apply-promo-code`

**Request**:
```json
{
  "promo_code_id": "507f1f77bcf86cd799439011"
}
```

**Response (Success)**:
```json
{
  "message": "Promo code applied successfully",
  "offer_id": "ML-00093",
  "promo_code": "SUMMER20",
  "bonus_amount": 20,
  "bonus_type": "percentage"
}
```

**Response (Error)**:
```json
{
  "error": "Promo code ID is required"
}
```

---

## Files to Check

1. **Backend**:
   - `backend/routes/publisher_promo_codes_management.py` - Apply endpoint
   - `backend/routes/publisher_offers.py` - Get offers endpoint

2. **Frontend**:
   - `src/components/OfferCardWithApproval.tsx` - Button & dialog
   - `src/pages/PublisherOffers.tsx` - Offers page

---

## Quick Fixes

### **If button not showing**:
```bash
# 1. Restart backend
# 2. Create new offer with promo code
# 3. Refresh browser
# 4. Check if button appears
```

### **If 400 error**:
```bash
# 1. Check backend logs
# 2. Verify promo_code_id is being sent
# 3. Verify offer exists in database
# 4. Check if promo code is active
```

### **If nothing works**:
```bash
# 1. Clear browser cache (Ctrl+Shift+Delete)
# 2. Restart backend (Ctrl+C, then python app.py)
# 3. Refresh browser (Ctrl+F5)
# 4. Try again
```

---

## Expected Behavior

### **Admin Side**:
1. Create promo code: "SUMMER20" with 20% bonus
2. Create offer with $10 payout
3. Assign promo code to offer
4. Save

### **Publisher Side**:
1. Go to Offers
2. Find offer with blue "🎉 Bonus Code Available" box
3. See payout: ~~$10~~ **$12**
4. Click "Apply Code" button
5. Dialog opens
6. Select code
7. Click "Apply Code"
8. Success message shown
9. Code applied to offer

---

## Status

✅ Backend endpoint fixed to accept offer_id (not just _id)
✅ Frontend button added with dialog
✅ Payout calculation added
✅ Logging added for debugging

**Next**: Restart backend and test!

