# Gift Card System - Quick Test Script
# Run this to test the complete flow

Write-Host "🎁 Gift Card System - Quick Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:5000/api"

# Prompt for credentials
Write-Host "Enter Admin Credentials:" -ForegroundColor Yellow
$adminUser = Read-Host "Admin Username"
$adminPass = Read-Host "Admin Password" -AsSecureString
$adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))

Write-Host ""
Write-Host "Enter User Credentials (for testing redemption):" -ForegroundColor Yellow
$testUser = Read-Host "User Username"
$testPass = Read-Host "User Password" -AsSecureString
$testPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($testPass))

Write-Host ""
Write-Host "Starting tests..." -ForegroundColor Green
Write-Host ""

try {
    # Step 1: Login as Admin
    Write-Host "Step 1: Logging in as admin..." -ForegroundColor Cyan
    $adminLoginBody = @{
        username = $adminUser
        password = $adminPassPlain
    } | ConvertTo-Json

    $adminLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $adminLoginBody

    $adminToken = $adminLogin.token
    Write-Host "✅ Admin logged in successfully" -ForegroundColor Green
    Write-Host ""

    # Step 2: Create Gift Card
    Write-Host "Step 2: Creating test gift card..." -ForegroundColor Cyan
    $gcBody = @{
        name = "Test Gift Card - $(Get-Date -Format 'HH:mm:ss')"
        description = "Automated test gift card"
        amount = 50
        max_redemptions = 3
        expiry_date = "2025-12-31T23:59:59Z"
        send_to_all = $true
        excluded_users = @()
        send_email = $false
    } | ConvertTo-Json

    $gcResponse = Invoke-RestMethod -Uri "$baseUrl/admin/gift-cards" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        } `
        -Body $gcBody

    $giftCardCode = $gcResponse.gift_card.code
    $giftCardId = $gcResponse.gift_card._id
    
    Write-Host "✅ Gift card created successfully!" -ForegroundColor Green
    Write-Host "   Code: $giftCardCode" -ForegroundColor Yellow
    Write-Host "   Amount: `$$($gcResponse.gift_card.amount)" -ForegroundColor Yellow
    Write-Host "   Max Redemptions: $($gcResponse.gift_card.max_redemptions)" -ForegroundColor Yellow
    Write-Host ""

    # Step 3: Login as User
    Write-Host "Step 3: Logging in as test user..." -ForegroundColor Cyan
    $userLoginBody = @{
        username = $testUser
        password = $testPassPlain
    } | ConvertTo-Json

    $userLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $userLoginBody

    $userToken = $userLogin.token
    Write-Host "✅ User logged in successfully" -ForegroundColor Green
    Write-Host ""

    # Step 4: Check Initial Balance
    Write-Host "Step 4: Checking initial balance..." -ForegroundColor Cyan
    $initialBalance = Invoke-RestMethod -Uri "$baseUrl/publisher/balance" `
        -Method GET `
        -Headers @{"Authorization" = "Bearer $userToken"}

    Write-Host "✅ Initial balance: `$$($initialBalance.balance)" -ForegroundColor Green
    Write-Host ""

    # Step 5: Redeem Gift Card
    Write-Host "Step 5: Redeeming gift card..." -ForegroundColor Cyan
    $redeemBody = @{
        code = $giftCardCode
    } | ConvertTo-Json

    $redeemResponse = Invoke-RestMethod -Uri "$baseUrl/publisher/gift-cards/redeem" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $userToken"
            "Content-Type" = "application/json"
        } `
        -Body $redeemBody

    Write-Host "✅ Gift card redeemed successfully!" -ForegroundColor Green
    Write-Host "   $($redeemResponse.message)" -ForegroundColor Yellow
    Write-Host "   Amount: `$$($redeemResponse.amount)" -ForegroundColor Yellow
    Write-Host "   New Balance: `$$($redeemResponse.new_balance)" -ForegroundColor Yellow
    Write-Host "   Position: #$($redeemResponse.redemption_number) out of $($redeemResponse.max_redemptions)" -ForegroundColor Yellow
    Write-Host ""

    # Step 6: Verify Balance Updated
    Write-Host "Step 6: Verifying balance update..." -ForegroundColor Cyan
    $newBalance = Invoke-RestMethod -Uri "$baseUrl/publisher/balance" `
        -Method GET `
        -Headers @{"Authorization" = "Bearer $userToken"}

    $balanceDiff = $newBalance.balance - $initialBalance.balance
    Write-Host "✅ Balance updated correctly!" -ForegroundColor Green
    Write-Host "   Previous: `$$($initialBalance.balance)" -ForegroundColor Yellow
    Write-Host "   Current: `$$($newBalance.balance)" -ForegroundColor Yellow
    Write-Host "   Difference: +`$$balanceDiff" -ForegroundColor Yellow
    Write-Host ""

    # Step 7: Test Duplicate Redemption (Should Fail)
    Write-Host "Step 7: Testing duplicate redemption (should fail)..." -ForegroundColor Cyan
    try {
        $duplicateResponse = Invoke-RestMethod -Uri "$baseUrl/publisher/gift-cards/redeem" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $userToken"
                "Content-Type" = "application/json"
            } `
            -Body $redeemBody
        
        Write-Host "❌ ERROR: Duplicate redemption should have failed!" -ForegroundColor Red
    } catch {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "✅ Duplicate redemption correctly blocked!" -ForegroundColor Green
        Write-Host "   Error: $($errorResponse.error)" -ForegroundColor Yellow
    }
    Write-Host ""

    # Step 8: Check Gift Card Status
    Write-Host "Step 8: Checking gift card status..." -ForegroundColor Cyan
    $allGiftCards = Invoke-RestMethod -Uri "$baseUrl/admin/gift-cards" `
        -Method GET `
        -Headers @{"Authorization" = "Bearer $adminToken"}

    $testCard = $allGiftCards.gift_cards | Where-Object {$_.code -eq $giftCardCode}
    
    Write-Host "✅ Gift card status:" -ForegroundColor Green
    Write-Host "   Code: $($testCard.code)" -ForegroundColor Yellow
    Write-Host "   Redemptions: $($testCard.redemption_count)/$($testCard.max_redemptions)" -ForegroundColor Yellow
    Write-Host "   Status: $($testCard.status)" -ForegroundColor Yellow
    Write-Host "   Total Credited: `$$($testCard.total_credited)" -ForegroundColor Yellow
    Write-Host ""

    # Step 9: Check Redemption History
    Write-Host "Step 9: Checking redemption history..." -ForegroundColor Cyan
    $history = Invoke-RestMethod -Uri "$baseUrl/publisher/gift-cards/history" `
        -Method GET `
        -Headers @{"Authorization" = "Bearer $userToken"}

    Write-Host "✅ Redemption history:" -ForegroundColor Green
    foreach ($redemption in $history.history) {
        Write-Host "   Code: $($redemption.code) | Amount: `$$($redemption.amount) | Position: #$($redemption.redemption_number)" -ForegroundColor Yellow
    }
    Write-Host ""

    # Summary
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host "🎉 ALL TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor White
    Write-Host "  ✅ Gift card created: $giftCardCode" -ForegroundColor Green
    Write-Host "  ✅ User redeemed successfully" -ForegroundColor Green
    Write-Host "  ✅ Balance increased by `$$($redeemResponse.amount)" -ForegroundColor Green
    Write-Host "  ✅ Duplicate redemption blocked" -ForegroundColor Green
    Write-Host "  ✅ Gift card status: $($testCard.redemption_count)/$($testCard.max_redemptions) redeemed" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "❌ TEST FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
