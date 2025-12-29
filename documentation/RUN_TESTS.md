# How to Run Promo Code Tests

## Quick Start (5 minutes)

### Step 1: Install Required Package
```bash
pip install requests
```

### Step 2: Update Test Credentials
Edit `backend/test_promo_codes.py` and update:

```python
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "your_admin_password"  # ← Change this
PUBLISHER_USERNAME = "publisher"
PUBLISHER_PASSWORD = "publisher_password"  # ← Change this
```

Use your actual admin and publisher usernames/passwords from your system.

### Step 3: Start Backend Server
```bash
cd d:\pepeleads\ascend\lovable-ascend\backend
python app.py
```

Wait for it to show:
```
✅ Registered blueprint: admin_promo_codes at 
✅ Registered blueprint: publisher_promo_codes at 
```

### Step 4: Run Tests (in another terminal)
```bash
cd d:\pepeleads\ascend\lovable-ascend\backend
python test_promo_codes.py
```

You should see:
```
============================================================
PROMO CODE FEATURE - COMPREHENSIVE TEST SUITE
============================================================

[SUCCESS] Admin token obtained
[SUCCESS] Publisher token obtained

[SUCCESS] Promo code created: TEST20
[SUCCESS] Found X promo codes
[SUCCESS] Code details retrieved
[SUCCESS] Found X available codes
[SUCCESS] Code applied successfully
[SUCCESS] Found X active codes
[SUCCESS] Bonus balance retrieved
[SUCCESS] Analytics retrieved
[SUCCESS] Code paused successfully
[SUCCESS] Code resumed successfully

============================================================
✅ ALL TESTS COMPLETED SUCCESSFULLY!
============================================================
```

---

## Manual Testing with Postman

### 1. Import Collection
Create a new Postman collection with these requests:

#### Request 1: Get Admin Token
```
POST http://localhost:5000/api/auth/login
Body (JSON):
{
  "username": "admin",
  "password": "your_password"
}
```
**Save the token as: {{admin_token}}**

#### Request 2: Create Promo Code
```
POST http://localhost:5000/api/admin/promo-codes
Headers:
  Authorization: Bearer {{admin_token}}
  Content-Type: application/json

Body (JSON):
{
  "code": "SUMMER20",
  "name": "Summer 20% Bonus",
  "description": "Get 20% bonus on all earnings",
  "bonus_type": "percentage",
  "bonus_amount": 20,
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-12-31T23:59:59Z",
  "max_uses": 1000,
  "max_uses_per_user": 1,
  "min_payout": 0
}
```
**Save the code ID as: {{code_id}}**

#### Request 3: List All Codes
```
GET http://localhost:5000/api/admin/promo-codes
Headers:
  Authorization: Bearer {{admin_token}}
```

#### Request 4: Get Code Details
```
GET http://localhost:5000/api/admin/promo-codes/{{code_id}}
Headers:
  Authorization: Bearer {{admin_token}}
```

#### Request 5: Get Publisher Token
```
POST http://localhost:5000/api/auth/login
Body (JSON):
{
  "username": "publisher",
  "password": "publisher_password"
}
```
**Save the token as: {{publisher_token}}**

#### Request 6: Get Available Codes
```
GET http://localhost:5000/api/publisher/promo-codes/available
Headers:
  Authorization: Bearer {{publisher_token}}
```

#### Request 7: Apply Code
```
POST http://localhost:5000/api/publisher/promo-codes/apply
Headers:
  Authorization: Bearer {{publisher_token}}
  Content-Type: application/json

Body (JSON):
{
  "code": "SUMMER20"
}
```

#### Request 8: Get Active Codes
```
GET http://localhost:5000/api/publisher/promo-codes/active
Headers:
  Authorization: Bearer {{publisher_token}}
```

#### Request 9: Get Bonus Balance
```
GET http://localhost:5000/api/publisher/promo-codes/balance
Headers:
  Authorization: Bearer {{publisher_token}}
```

#### Request 10: Get Analytics
```
GET http://localhost:5000/api/admin/promo-codes/{{code_id}}/analytics
Headers:
  Authorization: Bearer {{admin_token}}
```

#### Request 11: Pause Code
```
POST http://localhost:5000/api/admin/promo-codes/{{code_id}}/pause
Headers:
  Authorization: Bearer {{admin_token}}
```

#### Request 12: Resume Code
```
POST http://localhost:5000/api/admin/promo-codes/{{code_id}}/resume
Headers:
  Authorization: Bearer {{admin_token}}
```

---

## Manual Testing with cURL

### Create a batch file: `test_promo.bat`

```batch
@echo off
setlocal enabledelayedexpansion

REM Get admin token
echo Getting admin token...
for /f "tokens=*" %%A in ('curl -s -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"your_password\"}" ^
  ^| findstr /R "token"') do (
  set admin_response=%%A
)
echo Admin response: !admin_response!

REM Create promo code
echo.
echo Creating promo code...
curl -X POST http://localhost:5000/api/admin/promo-codes ^
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"code\":\"SUMMER20\",\"name\":\"Summer 20%\",\"bonus_type\":\"percentage\",\"bonus_amount\":20,\"start_date\":\"2024-01-01T00:00:00Z\",\"end_date\":\"2024-12-31T23:59:59Z\",\"max_uses\":1000,\"max_uses_per_user\":1}"

REM List codes
echo.
echo Listing all codes...
curl -X GET http://localhost:5000/api/admin/promo-codes ^
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

REM Get publisher token
echo.
echo Getting publisher token...
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"publisher\",\"password\":\"publisher_password\"}"

REM Apply code
echo.
echo Applying code...
curl -X POST http://localhost:5000/api/publisher/promo-codes/apply ^
  -H "Authorization: Bearer YOUR_PUBLISHER_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"code\":\"SUMMER20\"}"

REM Get balance
echo.
echo Getting bonus balance...
curl -X GET http://localhost:5000/api/publisher/promo-codes/balance ^
  -H "Authorization: Bearer YOUR_PUBLISHER_TOKEN"

echo.
echo Tests completed!
pause
```

Run it:
```bash
test_promo.bat
```

---

## Verify in Database

### Check MongoDB Collections

```bash
# Connect to MongoDB
mongo

# Use your database
use ascend_db

# View all promo codes
db.promo_codes.find().pretty()

# View user promo codes
db.user_promo_codes.find().pretty()

# View bonus earnings
db.bonus_earnings.find().pretty()

# Count documents
db.promo_codes.countDocuments()
db.user_promo_codes.countDocuments()
db.bonus_earnings.countDocuments()
```

---

## Expected Results

### After Creating Promo Code:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "code": "SUMMER20",
  "name": "Summer 20% Bonus",
  "bonus_type": "percentage",
  "bonus_amount": 20,
  "status": "active",
  "usage_count": 0,
  "total_bonus_distributed": 0,
  "created_at": "2024-11-20T12:30:00Z"
}
```

### After Applying Code:
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "user_id": "507f1f77bcf86cd799439013",
  "code": "SUMMER20",
  "applied_at": "2024-11-20T12:35:00Z",
  "is_active": true,
  "total_bonus_earned": 0,
  "conversions_count": 0
}
```

### Bonus Balance (No conversions yet):
```json
{
  "bonus_balance": {
    "total_earned": 0,
    "pending": 0,
    "credited": 0,
    "available": 0
  }
}
```

---

## Troubleshooting

### Error: "Promo code not found"
- Make sure you created the code first
- Check the code is active (not paused)
- Verify the code hasn't expired

### Error: "You have already applied this promo code"
- Each user can only apply a code once (by default)
- Try with a different publisher account

### Error: "Database connection not available"
- Make sure MongoDB is running
- Check your connection string in `.env`
- Restart the backend server

### Error: "Unauthorized"
- Make sure you're using the correct token
- Token might have expired, get a new one
- Check Authorization header format: `Bearer TOKEN`

### Error: "Code must be 3-20 alphanumeric characters"
- Code must be uppercase letters and numbers only
- Must be between 3-20 characters long
- Example: SUMMER20, TEST10, PROMO2024

---

## Next Steps After Testing

1. **Phase 4**: Integrate with conversion tracking
2. **Phase 5**: Add email notifications
3. **Phase 6**: Build admin UI
4. **Phase 7**: Build publisher UI

All endpoints are working and ready for integration!
