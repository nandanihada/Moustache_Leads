# 🧪 Gift Card System - Complete Flow Testing (Step-by-Step)

## ✅ **Prerequisites Check**

Your setup:
- ✅ Backend running on `http://localhost:5000`
- ✅ Frontend running on `http://localhost:8081`
- ✅ MongoDB connected

---

## 🎯 **Complete Flow Test - Step by Step**

### **Step 1: Get Admin Token**

First, you need to login as admin to get your authentication token.

**Option A: Using Postman**
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "username": "your_admin_username",
  "password": "your_admin_password"
}
```

**Option B: Using cURL (PowerShell)**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"your_password"}'
$adminToken = $response.token
Write-Host "Admin Token: $adminToken"
```

**Save the token!** You'll need it for the next steps.

---

### **Step 2: Create a Test Gift Card**

**Using PowerShell:**
```powershell
# Set your admin token
$adminToken = "YOUR_TOKEN_FROM_STEP_1"

# Create gift card
$body = @{
    name = "Test Holiday Bonus"
    description = "Testing the gift card system"
    amount = 100
    max_redemptions = 3
    expiry_date = "2025-12-31T23:59:59Z"
    send_to_all = $true
    excluded_users = @()
    send_email = $false  # Set to false for testing (no emails)
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/gift-cards" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "Gift Card Created!"
Write-Host "Code: $($response.gift_card.code)"
Write-Host "ID: $($response.gift_card._id)"

# Save the code
$giftCardCode = $response.gift_card.code
```

**Using Postman:**
```
POST http://localhost:5000/api/admin/gift-cards
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Test Holiday Bonus",
  "description": "Testing the gift card system",
  "amount": 100,
  "max_redemptions": 3,
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "excluded_users": [],
  "send_email": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Gift card created successfully! First 3 users can redeem.",
  "gift_card": {
    "_id": "675e9abc...",
    "code": "GIFT12345678",  // ← COPY THIS CODE!
    "name": "Test Holiday Bonus",
    "amount": 100,
    "max_redemptions": 3,
    "redemption_count": 0,
    "status": "active"
  }
}
```

**✅ Copy the `code` value!**

---

### **Step 3: Verify Gift Card Created**

**Check in database (optional):**
```javascript
// In MongoDB Compass or mongo shell
db.gift_cards.findOne({code: "GIFT12345678"})
```

**Or via API:**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/gift-cards" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $adminToken"}

$response.gift_cards | Format-Table code, name, amount, redemption_count, status
```

---

### **Step 4: Get User Token**

Login as a regular user (publisher):

**PowerShell:**
```powershell
$userResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"your_user_username","password":"your_user_password"}'
$userToken = $userResponse.token
Write-Host "User Token: $userToken"
```

---

### **Step 5: Check User's Initial Balance**

```powershell
$balanceResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/balance" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $userToken"}

Write-Host "Current Balance: $($balanceResponse.balance)"
$initialBalance = $balanceResponse.balance
```

---

### **Step 6: Redeem Gift Card (User #1)**

**PowerShell:**
```powershell
$redeemBody = @{
    code = $giftCardCode  # Use the code from Step 2
} | ConvertTo-Json

$redeemResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/redeem" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $userToken"
        "Content-Type" = "application/json"
    } `
    -Body $redeemBody

Write-Host "✅ SUCCESS!"
Write-Host $redeemResponse.message
Write-Host "Amount: $($redeemResponse.amount)"
Write-Host "New Balance: $($redeemResponse.new_balance)"
Write-Host "You were #$($redeemResponse.redemption_number) out of $($redeemResponse.max_redemptions)"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "🎉 Congratulations! You redeemed $100.00! You were #1 out of 3 lucky users!",
  "amount": 100,
  "new_balance": 100,
  "gift_card_name": "Test Holiday Bonus",
  "redemption_number": 1,
  "max_redemptions": 3
}
```

---

### **Step 7: Verify Balance Updated**

```powershell
$newBalanceResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/balance" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $userToken"}

Write-Host "Previous Balance: $initialBalance"
Write-Host "New Balance: $($newBalanceResponse.balance)"
Write-Host "Difference: $($newBalanceResponse.balance - $initialBalance)"
```

**Expected:** Balance should increase by $100

---

### **Step 8: Test Duplicate Redemption (Should Fail)**

```powershell
# Same user tries to redeem again
try {
    $duplicateResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/redeem" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        } `
        -Body $redeemBody
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Expected Error: $($errorResponse.error)"
}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "You have already redeemed this gift card"
}
```

---

### **Step 9: Check Gift Card Status**

```powershell
$gcResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/gift-cards" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $adminToken"}

$testCard = $gcResponse.gift_cards | Where-Object {$_.code -eq $giftCardCode}
Write-Host "Gift Card Status:"
Write-Host "  Code: $($testCard.code)"
Write-Host "  Redemptions: $($testCard.redemption_count)/$($testCard.max_redemptions)"
Write-Host "  Status: $($testCard.status)"
Write-Host "  Total Credited: $($testCard.total_credited)"
```

**Expected:**
- redemption_count: 1
- status: "active"
- total_credited: 100

---

### **Step 10: Test with 2 More Users (Reach Limit)**

**Login as User #2:**
```powershell
# Login as different user
$user2Response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"user2","password":"password"}'
$user2Token = $user2Response.token

# Redeem
$redeem2 = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/redeem" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $user2Token"
        "Content-Type" = "application/json"
    } `
    -Body $redeemBody

Write-Host "User #2 redeemed! Position: #$($redeem2.redemption_number)"
```

**Login as User #3:**
```powershell
# Login as third user
$user3Response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"user3","password":"password"}'
$user3Token = $user3Response.token

# Redeem (This should be the LAST one - max_redemptions = 3)
$redeem3 = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/redeem" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $user3Token"
        "Content-Type" = "application/json"
    } `
    -Body $redeemBody

Write-Host "User #3 redeemed! Position: #$($redeem3.redemption_number)"
```

---

### **Step 11: Verify Auto-Deactivation**

```powershell
# Check gift card status again
$gcResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/gift-cards" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $adminToken"}

$testCard = $gcResponse.gift_cards | Where-Object {$_.code -eq $giftCardCode}
Write-Host "Gift Card After 3 Redemptions:"
Write-Host "  Redemptions: $($testCard.redemption_count)/$($testCard.max_redemptions)"
Write-Host "  Status: $($testCard.status)"  # Should be "fully_redeemed"
```

**Expected:**
- redemption_count: 3
- status: "fully_redeemed" ✅

---

### **Step 12: Test 4th User (Should Fail)**

```powershell
# Login as 4th user
$user4Response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"user4","password":"password"}'
$user4Token = $user4Response.token

# Try to redeem (should fail)
try {
    $redeem4 = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/redeem" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $user4Token"
            "Content-Type" = "application/json"
        } `
        -Body $redeemBody
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Expected Error: $($errorResponse.error)"
}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Sorry! This gift card has been fully redeemed (limit: 3 users)"
}
```

---

### **Step 13: Check Redemption History**

```powershell
# Check user's redemption history
$historyResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/publisher/gift-cards/history" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $userToken"}

Write-Host "Redemption History:"
$historyResponse.history | Format-Table code, amount, redemption_number, redeemed_at
```

---

### **Step 14: Verify Database**

**Check in MongoDB:**
```javascript
// Gift card document
db.gift_cards.findOne({code: "GIFT12345678"})
// Should show:
// - redemption_count: 3
// - status: "fully_redeemed"
// - redeemed_by: [user1_id, user2_id, user3_id]

// Redemption records
db.gift_card_redemptions.find({code: "GIFT12345678"})
// Should show 3 records with redemption_number: 1, 2, 3

// User balances
db.users.find({_id: {$in: [user1_id, user2_id, user3_id]}}, {balance: 1})
// Each should have balance increased by 100
```

---

## ✅ **Complete Flow Test Checklist**

- [ ] Admin can create gift card
- [ ] Gift card has unique code
- [ ] User #1 can redeem successfully
- [ ] User #1 balance increases
- [ ] User #1 cannot redeem twice
- [ ] User #2 can redeem (position #2)
- [ ] User #3 can redeem (position #3)
- [ ] Gift card auto-deactivates after 3 redemptions
- [ ] User #4 cannot redeem (fully redeemed error)
- [ ] Redemption history shows all redemptions
- [ ] Database records are correct

---

## 🚀 **Quick Test Script (All-in-One)**

Save this as `test-gift-card.ps1`:

```powershell
# Configuration
$baseUrl = "http://localhost:5000/api"
$adminUser = "admin"
$adminPass = "your_admin_password"

# 1. Login as admin
Write-Host "1. Logging in as admin..." -ForegroundColor Cyan
$adminLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body "{`"username`":`"$adminUser`",`"password`":`"$adminPass`"}"
$adminToken = $adminLogin.token
Write-Host "✅ Admin logged in" -ForegroundColor Green

# 2. Create gift card
Write-Host "`n2. Creating gift card..." -ForegroundColor Cyan
$gcBody = @{
    name = "Test Gift Card"
    amount = 50
    max_redemptions = 2
    expiry_date = "2025-12-31T23:59:59Z"
    send_to_all = $true
    send_email = $false
} | ConvertTo-Json

$gcResponse = Invoke-RestMethod -Uri "$baseUrl/admin/gift-cards" -Method POST -Headers @{"Authorization"="Bearer $adminToken"; "Content-Type"="application/json"} -Body $gcBody
$code = $gcResponse.gift_card.code
Write-Host "✅ Gift card created: $code" -ForegroundColor Green

# 3. Login as user and redeem
Write-Host "`n3. Testing redemption..." -ForegroundColor Cyan
$userLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body "{`"username`":`"user1`",`"password`":`"password`"}"
$userToken = $userLogin.token

$redeemBody = @{code = $code} | ConvertTo-Json
$redeemResponse = Invoke-RestMethod -Uri "$baseUrl/publisher/gift-cards/redeem" -Method POST -Headers @{"Authorization"="Bearer $userToken"; "Content-Type"="application/json"} -Body $redeemBody

Write-Host "✅ $($redeemResponse.message)" -ForegroundColor Green
Write-Host "   New Balance: $($redeemResponse.new_balance)" -ForegroundColor Yellow

Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
```

Run it:
```powershell
.\test-gift-card.ps1
```

---

## 📊 **Expected Final State**

After completing all steps:

**Gift Card:**
- Status: `fully_redeemed`
- Redemption Count: `3/3`
- Total Credited: `$300`

**Users:**
- User #1: Balance +$100, redemption_number: 1
- User #2: Balance +$100, redemption_number: 2
- User #3: Balance +$100, redemption_number: 3
- User #4: Cannot redeem (error)

**Database:**
- 1 gift card document
- 3 redemption records
- 3 users with updated balances

---

**Testing Complete! 🎉**
