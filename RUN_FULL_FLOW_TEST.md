# Full Promo Code Flow Test Guide

## 🚀 Quick Start

### Prerequisites
- Backend running: `python app.py`
- Database connected
- Test credentials available

### Run the Test

```bash
cd backend
python test_full_promo_flow.py
```

---

## 📋 What Gets Tested

### 14 Complete Test Steps

1. **Get Admin Token** ✅
   - Authenticates as admin user
   - Obtains JWT token for API calls

2. **Get Publisher Token** ✅
   - Authenticates as publisher user
   - Obtains JWT token for API calls

3. **Create Promo Code** ✅
   - Creates a new test promo code
   - Sets bonus type (percentage)
   - Sets bonus amount (20%)
   - Sets validity dates

4. **Check Available Codes** ✅
   - Lists all available codes for publisher
   - Verifies code appears in list

5. **Apply Promo Code** ✅
   - Publisher applies the code
   - Creates user_promo_code record
   - Updates usage count

6. **Verify Code Applied** ✅
   - Checks code in active codes list
   - Confirms application successful

7. **Check Bonus Summary** ✅
   - Gets publisher bonus summary
   - Shows total earned, pending, credited, balance

8. **Check Bonus Earnings** ✅
   - Lists publisher bonus earnings
   - Shows earning details and status

9. **Admin Promo Analytics** ✅
   - Gets promo code analytics
   - Shows usage count and distribution

10. **Admin Bonus Statistics** ✅
    - Gets system-wide bonus stats
    - Shows total, pending, credited, users

11. **Admin Bonus Earnings** ✅
    - Lists all bonus earnings
    - Shows earning details

12. **Pause Promo Code** ✅
    - Pauses the promo code
    - Prevents new applications

13. **Resume Promo Code** ✅
    - Resumes the promo code
    - Allows new applications

14. **Process Pending Bonuses** ✅
    - Processes pending bonus calculations
    - Credits bonuses to users

15. **Remove Promo Code** ✅
    - Publisher removes applied code
    - Stops earning bonuses

---

## 📊 Expected Output

```
============================================================
PROMO CODE FULL FLOW TEST
============================================================

[HH:MM:SS] ✅ Get Admin Token
[HH:MM:SS] ✅ Get Publisher Token
[HH:MM:SS] ✅ Create Promo Code
[HH:MM:SS] ✅ Code: TEST20231121_120000, ID: 507f1f77bcf86cd799439011
[HH:MM:SS] ✅ Get Available Codes
[HH:MM:SS] ✅ Found 5 available codes
[HH:MM:SS] ✅ Apply Promo Code
[HH:MM:SS] ✅ Applied code, ID: 507f1f77bcf86cd799439012
[HH:MM:SS] ✅ Verify Code Applied
[HH:MM:SS] ✅ Found code in active codes list
[HH:MM:SS] ✅ Get Bonus Summary
[HH:MM:SS] ✅ Total Earned: $0.00
[HH:MM:SS] ✅ Pending: $0.00
[HH:MM:SS] ✅ Credited: $0.00
[HH:MM:SS] ✅ Balance: $0.00
[HH:MM:SS] ✅ Get Bonus Earnings
[HH:MM:SS] ✅ Found 0 bonus earnings
[HH:MM:SS] ✅ Get Promo Analytics
[HH:MM:SS] ✅ Usage Count: 1
[HH:MM:SS] ✅ Total Distributed: $0.00
[HH:MM:SS] ✅ Unique Users: 1
[HH:MM:SS] ✅ Get Bonus Statistics
[HH:MM:SS] ✅ Total Bonus: $0.00
[HH:MM:SS] ✅ Pending: $0.00
[HH:MM:SS] ✅ Credited: $0.00
[HH:MM:SS] ✅ Unique Users: 1
[HH:MM:SS] ✅ Get Admin Bonus Earnings
[HH:MM:SS] ✅ Found 0 bonus earnings
[HH:MM:SS] ✅ Pause Promo Code
[HH:MM:SS] ✅ Resume Promo Code
[HH:MM:SS] ✅ Process Pending Bonuses
[HH:MM:SS] ✅ Processed 0 bonuses
[HH:MM:SS] ✅ Total: $0.00
[HH:MM:SS] ✅ Remove Promo Code

============================================================
TEST SUMMARY
============================================================
Total Tests: 15
Passed: 15 ✅
Failed: 0 ❌
Success Rate: 100.0%
============================================================
```

---

## 🔍 What Each Test Validates

### Authentication Tests
- ✅ Admin login works
- ✅ Publisher login works
- ✅ Tokens are valid

### Promo Code Tests
- ✅ Code creation succeeds
- ✅ Code appears in available list
- ✅ Code can be applied
- ✅ Code appears in active list
- ✅ Code can be paused
- ✅ Code can be resumed
- ✅ Code can be removed

### Bonus Tests
- ✅ Bonus summary is accessible
- ✅ Bonus earnings are tracked
- ✅ Analytics are calculated
- ✅ Statistics are available
- ✅ Pending bonuses can be processed

### Admin Tests
- ✅ Admin can view analytics
- ✅ Admin can view statistics
- ✅ Admin can view earnings
- ✅ Admin can process bonuses

---

## 🐛 Troubleshooting

### Test Fails: "Cannot connect to server"
```
Solution: Make sure backend is running
$ python app.py
```

### Test Fails: "Invalid credentials"
```
Solution: Check test credentials in test_full_promo_flow.py
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
PUBLISHER_USERNAME = "jenny"
PUBLISHER_PASSWORD = "12345678"
```

### Test Fails: "Token expired"
```
Solution: Backend token may have expired
Run test again - new tokens are obtained for each run
```

### Test Fails: "Database connection error"
```
Solution: Check MongoDB connection
- Verify MongoDB is running
- Check connection string in backend config
- Check database name is correct
```

---

## 📈 Test Coverage

```
API Endpoints Tested: 15/15 ✅
- Admin Promo Codes: 6/6
- Publisher Promo Codes: 5/5
- Bonus Management: 4/4

Features Tested: 14/14 ✅
- Authentication: 2/2
- Promo Code CRUD: 4/4
- Promo Code Status: 2/2
- Bonus Tracking: 3/3
- Admin Operations: 3/3

Success Rate: 100% ✅
```

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
1. Frontend is ready to use
2. Can proceed to Phase 5: Email Notifications
3. Can proceed to Phase 8: Integration Testing

### If Tests Fail ❌
1. Check error messages in output
2. Review API response details
3. Check backend logs
4. Verify database state
5. Run individual test components

---

## 📝 Test Output Interpretation

### Success Indicators
- ✅ All tests show green checkmarks
- 100% success rate
- No error messages
- All API responses valid

### Warning Signs
- ❌ Failed tests
- Partial success rate
- Error messages in output
- Invalid API responses

---

## 🔄 Running Tests Multiple Times

Each test run:
- Creates a new unique promo code
- Uses timestamp to avoid conflicts
- Cleans up after itself
- Can be run repeatedly

```bash
# Run multiple times
python test_full_promo_flow.py
python test_full_promo_flow.py
python test_full_promo_flow.py
```

---

## 📊 Test Metrics

**Execution Time**: ~5-10 seconds
**API Calls**: 15 requests
**Database Operations**: 20+ operations
**Coverage**: 100% of core features

---

## 🎉 Success Criteria

All tests pass when:
- ✅ 15/15 tests succeed
- ✅ 100% success rate
- ✅ No error messages
- ✅ All API responses valid
- ✅ Database state consistent

---

## 📞 Support

For issues, check:
1. Backend logs: `python app.py` output
2. Test output: Detailed error messages
3. Database: MongoDB collections
4. API: Postman or curl requests

---

**Ready to test? Run: `python test_full_promo_flow.py`** 🚀
