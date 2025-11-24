# How Bonuses Work with Offers - Quick Guide

## 🎯 Simple Explanation

**Bonuses are extra earnings that publishers get when they use a promo code on an offer.**

---

## 📊 Three Ways Bonuses Are Applied

### **Method 1: Promo Code Applied to Offer (Admin)**
```
Admin creates offer
    ↓
Admin assigns promo code to offer
    ↓
Publishers see offer with bonus
    ↓
When conversion happens:
  - Publisher earns normal payout
  - Publisher earns EXTRA bonus (from promo code)
```

**Example**:
- Offer payout: $10
- Promo code bonus: 20%
- Publisher earns: $10 + $2 = $12

### **Method 2: Publisher Applies Code to Offer**
```
Publisher goes to Promo Codes
    ↓
Selects available code
    ↓
Applies to any offer
    ↓
When conversion happens:
  - Publisher earns normal payout
  - Publisher earns EXTRA bonus (from code)
```

### **Method 3: Automatic Bonus Calculation**
```
Conversion happens
    ↓
System checks:
  - Does offer have promo code? 
  - Did publisher apply code?
    ↓
If YES:
  - Calculate bonus (percentage or fixed)
  - Add to publisher's balance
  - Mark as "pending" or "credited"
```

---

## 💰 Bonus Types

### **Percentage Bonus**
```
Bonus Amount: 20%
Conversion Payout: $100
Bonus Earned: $100 × 20% = $20
Total Earned: $100 + $20 = $120
```

### **Fixed Bonus**
```
Bonus Amount: $5
Conversion Payout: $100
Bonus Earned: $5 (fixed)
Total Earned: $100 + $5 = $105
```

---

## 🔄 Bonus Lifecycle

### **Step 1: Bonus Recorded**
```
Conversion happens
    ↓
System calculates bonus
    ↓
Bonus saved in database
    ↓
Status: "pending"
```

### **Step 2: Bonus Pending**
```
Bonus waiting to be credited
    ↓
Admin can view in:
  - /admin/bonus-management
  - /api/admin/bonus/earnings
    ↓
Status: "pending"
```

### **Step 3: Bonus Credited**
```
Admin processes pending bonuses
    ↓
System credits to publisher balance
    ↓
Status: "credited"
    ↓
Publisher can withdraw
```

---

## 📱 Where to See Bonuses

### **Admin Dashboard**
```
/admin/bonus-management
    ↓
Shows:
  - Total bonus earned
  - Pending bonuses
  - Credited bonuses
  - Bonus by publisher
  - Bonus by code
```

### **Publisher Dashboard**
```
/dashboard/promo-codes
    ↓
Shows:
  - My bonus summary
  - Total earned
  - Pending amount
  - Credited amount
  - Bonus by code
```

---

## 🚀 How to Apply Bonus to Offer

### **Option 1: When Creating Offer**
```
1. Admin Dashboard → Offers → Create
2. Fill in offer details
3. Go to "Access" tab
4. Scroll to "Assign Promo Code"
5. Select code from dropdown
6. Save offer
7. ✅ Publishers get email notification
```

### **Option 2: When Editing Offer**
```
1. Admin Dashboard → Offers → Edit
2. Go to "Access" tab
3. Scroll to "Assign Promo Code"
4. Select code from dropdown
5. Save offer
6. ✅ Publishers get email notification
```

### **Option 3: Publisher Applies Code**
```
1. Publisher Dashboard → Promo Codes
2. Click "Available Codes" tab
3. Click "Apply" on code
4. Select offer
5. Click "Apply"
6. ✅ Code applied to offer
7. ✅ Bonus earned on conversions
```

---

## 📊 Bonus Calculation Flow

```
Conversion Happens
    ↓
System checks:
  ├─ Offer has promo code? → YES
  ├─ Publisher applied code? → YES
  └─ Code is active? → YES
    ↓
Calculate Bonus:
  ├─ If percentage: payout × (bonus_amount / 100)
  └─ If fixed: bonus_amount
    ↓
Save Bonus:
  ├─ user_id: Publisher ID
  ├─ promo_code_id: Code ID
  ├─ offer_id: Offer ID
  ├─ bonus_amount: Calculated amount
  ├─ bonus_type: "percentage" or "fixed"
  └─ status: "pending"
    ↓
Bonus Recorded ✅
```

---

## 🔌 API Endpoints

### **Get Bonus Statistics**
```
GET /api/admin/bonus/statistics
Authorization: Bearer {token}

Response:
{
  "total_bonus": 1500,
  "pending_bonus": 500,
  "credited_bonus": 1000,
  "unique_users_count": 5,
  "unique_codes_count": 3
}
```

### **List Bonus Earnings**
```
GET /api/admin/bonus/earnings?page=1&limit=50
Authorization: Bearer {token}

Response:
{
  "bonus_earnings": [
    {
      "_id": "...",
      "user_id": "...",
      "promo_code_id": "...",
      "offer_id": "...",
      "bonus_amount": 20,
      "bonus_type": "percentage",
      "status": "pending",
      "created_at": "2025-11-21T..."
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

### **Get Publisher Bonus Summary**
```
GET /api/publisher/bonus/summary
Authorization: Bearer {token}

Response:
{
  "total_earned": 1500,
  "pending": 500,
  "credited": 1000,
  "balance": 1000,
  "by_code": {
    "SUMMER20": 1000,
    "FALL15": 500
  }
}
```

### **Process Pending Bonuses**
```
POST /api/admin/bonus/process-pending?limit=100
Authorization: Bearer {token}

Response:
{
  "processed": 50,
  "credited": 50,
  "failed": 0
}
```

---

## ✅ Bonus Status Meanings

| Status | Meaning | Action |
|--------|---------|--------|
| `pending` | Bonus earned but not credited | Admin needs to process |
| `credited` | Bonus added to balance | Publisher can withdraw |
| `reversed` | Bonus removed (fraud/chargeback) | System auto-reversed |

---

## 🎯 Quick Checklist

- [x] Create promo code with bonus amount
- [x] Assign code to offer (admin)
- [x] Or publisher applies code to offer
- [x] Conversion happens
- [x] Bonus automatically calculated
- [x] Bonus saved as "pending"
- [x] Admin processes pending bonuses
- [x] Bonus credited to publisher
- [x] Publisher sees in dashboard

---

## 💡 Example Scenario

```
1. Admin creates code "SUMMER20" with 20% bonus
   ✅ Email sent to all publishers

2. Admin creates offer "Finance App" with $10 payout
   ✅ Offer created

3. Admin assigns "SUMMER20" to "Finance App"
   ✅ Email sent to all publishers: "New bonus on Finance App!"

4. Publisher Jenny applies code to offer
   ✅ Code now active for Jenny on Finance App

5. User clicks on Finance App from Jenny's link
   ✅ Click recorded

6. User completes offer (converts)
   ✅ Conversion recorded
   ✅ Payout: $10
   ✅ Bonus calculated: $10 × 20% = $2
   ✅ Bonus saved as "pending"

7. Admin processes pending bonuses
   ✅ Bonus credited to Jenny's balance
   ✅ Jenny now has $12 total ($10 + $2 bonus)

8. Jenny sees in dashboard:
   ✅ Total Earned: $12
   ✅ Bonus: $2
   ✅ Can withdraw $12
```

---

## 🔧 Troubleshooting

### **Bonus Not Showing**
- Check if code is active
- Check if publisher applied code
- Check if conversion happened
- Check bonus status (pending vs credited)

### **Bonus Not Calculated**
- Verify offer has promo code assigned
- Verify publisher applied code
- Check conversion was recorded
- Check bonus calculation service logs

### **Bonus Not Credited**
- Admin needs to process pending bonuses
- Use: `POST /api/admin/bonus/process-pending`
- Check status changed from "pending" to "credited"

---

## 📞 Support

**Need help?**
- Check `/admin/bonus-management` page
- View API logs for errors
- Check database `bonus_earnings` collection
- Review promo code configuration

---

**That's it! Bonuses are automatic once configured.** ✨
