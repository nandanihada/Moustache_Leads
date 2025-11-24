# Promo Code Feature - Quick Start Guide

## ✅ What's Done (Phase 1-3)

### Backend Implementation Complete ✅
- **Database Models**: 3 collections (promo_codes, user_promo_codes, bonus_earnings)
- **Admin API**: 9 endpoints for managing promo codes
- **Publisher API**: 6 endpoints for applying and tracking codes
- **Validation**: Complete input validation and security checks
- **Error Handling**: Comprehensive error messages

### Files Created
1. `backend/models/promo_code.py` - Core model (600+ lines)
2. `backend/routes/admin_promo_codes.py` - Admin endpoints (300+ lines)
3. `backend/routes/publisher_promo_codes.py` - Publisher endpoints (350+ lines)
4. `backend/app.py` - Updated with blueprint registrations

---

## API Endpoints Ready to Use

### Admin Endpoints (Require Admin Token)

#### 1. Create Promo Code
```bash
POST /api/admin/promo-codes
{
  "code": "SUMMER20",
  "name": "Summer Sale 20%",
  "description": "20% bonus on all offers",
  "bonus_type": "percentage",
  "bonus_amount": 20,
  "start_date": "2024-06-01T00:00:00Z",
  "end_date": "2024-08-31T23:59:59Z",
  "max_uses": 1000,
  "max_uses_per_user": 1,
  "min_payout": 0
}
```

#### 2. List All Codes
```bash
GET /api/admin/promo-codes?page=1&limit=20&status=active&search=SUMMER
```

#### 3. Get Code Details
```bash
GET /api/admin/promo-codes/{code_id}
```

#### 4. Update Code
```bash
PUT /api/admin/promo-codes/{code_id}
{
  "name": "Updated Name",
  "status": "paused"
}
```

#### 5. Pause Code
```bash
POST /api/admin/promo-codes/{code_id}/pause
```

#### 6. Resume Code
```bash
POST /api/admin/promo-codes/{code_id}/resume
```

#### 7. Get Analytics
```bash
GET /api/admin/promo-codes/{code_id}/analytics
```

#### 8. Get Users Who Applied Code
```bash
GET /api/admin/promo-codes/{code_id}/users?page=1&limit=20
```

#### 9. Bulk Apply to Offers
```bash
POST /api/admin/promo-codes/bulk-apply
{
  "code_id": "507f1f77bcf86cd799439011",
  "offer_ids": ["offer1", "offer2", "offer3"]
}
```

---

### Publisher Endpoints (Require Publisher Token)

#### 1. Apply Promo Code
```bash
POST /api/publisher/promo-codes/apply
{
  "code": "SUMMER20"
}
```

#### 2. Get Active Codes
```bash
GET /api/publisher/promo-codes/active
```

#### 3. Browse Available Codes
```bash
GET /api/publisher/promo-codes/available?page=1&limit=20
```

#### 4. Remove Code
```bash
POST /api/publisher/promo-codes/{code_id}/remove
```

#### 5. Get Bonus Earnings
```bash
GET /api/publisher/promo-codes/earnings?page=1&limit=20&status=credited
```

#### 6. Get Bonus Balance
```bash
GET /api/publisher/promo-codes/balance
```

---

## Testing the API

### Step 1: Get Admin Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### Step 2: Create a Promo Code
```bash
curl -X POST http://localhost:5000/api/admin/promo-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST10",
    "name": "Test 10% Bonus",
    "bonus_type": "percentage",
    "bonus_amount": 10,
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-12-31T23:59:59Z",
    "max_uses": 1000,
    "max_uses_per_user": 1
  }'
```

### Step 3: Get Publisher Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "publisher",
    "password": "your_password"
  }'
```

### Step 4: Apply Code as Publisher
```bash
curl -X POST http://localhost:5000/api/publisher/promo-codes/apply \
  -H "Authorization: Bearer YOUR_PUBLISHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST10"
  }'
```

### Step 5: Check Bonus Balance
```bash
curl -X GET http://localhost:5000/api/publisher/promo-codes/balance \
  -H "Authorization: Bearer YOUR_PUBLISHER_TOKEN"
```

---

## Next Phase: Bonus Calculation Engine (Phase 4)

### What Needs to Be Done:
1. **Hook into Conversion Tracking** - When conversion recorded, check if user has active promo codes
2. **Calculate Bonus** - Use `PromoCode.calculate_bonus()` method
3. **Record Bonus** - Use `PromoCode.record_bonus_earning()` method
4. **Update User Balance** - Add bonus to user's balance
5. **Send Email** - Notify user of bonus earned

### Integration Point:
Look for where conversions are tracked (likely in `tracking_service.py` or similar) and add:

```python
from models.promo_code import PromoCode

# After conversion recorded
promo_code_model = PromoCode()
user_codes = promo_code_model.get_user_active_codes(user_id)

for user_code in user_codes:
    code_obj = promo_code_model.get_promo_code_by_id(str(user_code['promo_code_id']))
    bonus_amount, total_earning = promo_code_model.calculate_bonus(base_earning, code_obj)
    
    # Record the bonus
    promo_code_model.record_bonus_earning(
        user_id=user_id,
        promo_code_id=str(code_obj['_id']),
        offer_id=offer_id,
        conversion_id=conversion_id,
        base_earning=base_earning,
        bonus_amount=bonus_amount
    )
    
    # Update user balance
    # ... add bonus_amount to user's balance
```

---

## Database Collections

### promo_codes
Stores all promo codes created by admins
- Fields: code, name, bonus_type, bonus_amount, dates, limits, status, stats

### user_promo_codes
Tracks which users applied which codes
- Fields: user_id, promo_code_id, applied_at, is_active, total_bonus_earned

### bonus_earnings
Records every bonus transaction
- Fields: user_id, promo_code_id, offer_id, base_earning, bonus_amount, status

---

## Key Features Implemented

✅ **Promo Code Management**
- Create codes with flexible bonus types (% or $)
- Set validity dates and usage limits
- Pause/resume codes
- Track usage statistics

✅ **Publisher Experience**
- Browse available codes
- Apply codes to account
- Track bonus earnings
- View bonus balance

✅ **Admin Control**
- Full CRUD operations
- Analytics dashboard
- Bulk operations
- User management

✅ **Validation & Security**
- Input validation on all fields
- Admin authentication required
- User authentication required
- Proper error handling

---

## Status Summary

| Phase | Status | Files | Lines |
|-------|--------|-------|-------|
| 1-3: Backend | ✅ Complete | 3 files | 1,250+ |
| 4: Bonus Calc | ⏳ Pending | - | - |
| 5: Emails | ⏳ Pending | - | - |
| 6: Admin UI | ⏳ Pending | - | - |
| 7: Publisher UI | ⏳ Pending | - | - |
| 8: Testing | ⏳ Pending | - | - |
| 9: Docs | ⏳ Pending | - | - |

**Time Completed: ~4-5 hours**
**Remaining: ~10-15 hours**

---

## Questions?

Refer to `PROMO_CODE_IMPLEMENTATION.md` for detailed documentation.
