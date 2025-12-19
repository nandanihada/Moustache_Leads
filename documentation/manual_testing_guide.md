# Manual Testing Guide - Subadmin Management

## Prerequisites
- ✅ Backend running on `http://localhost:5000`
- ✅ Frontend running on `http://localhost:8081`
- ✅ Admin account credentials ready

---

## Test 1: Admin Login & Sidebar Verification ✅

**Objective**: Verify admin can login and see all tabs

**Steps**:
1. Navigate to `http://localhost:8081`
2. Click "Sign In"
3. Login with admin credentials:
   - Username: `admin`
   - Password: `admin123`
4. After login, click "Admin Dashboard" in sidebar
5. Navigate to Admin Panel

**Expected Results**:
- ✅ Login successful
- ✅ Admin sidebar shows **all 22 tabs**:
  - Overview
  - Offers
  - Promo Codes
  - Bonus Management
  - Offer Access Requests
  - Placement Approval
  - Offerwall Analytics
  - Comprehensive Analytics
  - Click Tracking
  - Login Logs
  - Active Users
  - **Subadmin Management** ← Should be visible
  - Fraud Management
  - Reports
  - Tracking
  - Test Tracking
  - Partners
  - Postback Receiver
  - Postback Logs
  - Users
  - Analytics
  - Settings

---

## Test 2: Create Subadmin with Limited Permissions

**Objective**: Create a subadmin with only specific tab access

**Steps**:
1. In Admin Panel, click **"Subadmin Management"** in sidebar
2. On Subadmin Management page, click the **user dropdown**
3. Select a **non-admin user** from the list
4. You'll see checkboxes for all available tabs
5. **Select ONLY these 3 tabs** (uncheck all others):
   - ✅ Login Logs
   - ✅ Partners
   - ✅ Analytics
6. Click **"Create Subadmin"** button
7. Wait for success toast notification

**Expected Results**:
- ✅ Success message: "Subadmin permissions saved successfully"
- ✅ User appears in "Existing Subadmins" list below
- ✅ Shows badge "Subadmin"
- ✅ Shows allowed tabs: "Login Logs", "Partners", "Analytics"

**Take Note**: Remember the username/email of the subadmin you created for Test 3

---

## Test 3: Verify UI Tab Filtering (Subadmin Login)

**Objective**: Verify subadmin only sees permitted tabs

**Steps**:
1. **Logout** from admin account (click Logout in sidebar)
2. **Login** with the subadmin credentials you created in Test 2
3. Click "Admin Dashboard" in sidebar
4. Navigate to Admin Panel
5. **Observe the sidebar menu**

**Expected Results**:
- ✅ Sidebar shows **ONLY 3 tabs**:
  - Login Logs
  - Partners
  - Analytics
- ✅ All other tabs are **completely hidden** (not just disabled)
- ✅ No "Subadmin Management" tab visible
- ✅ No "Offers" tab visible
- ✅ No "Settings" tab visible

**Critical**: Tabs should be HIDDEN, not grayed out or disabled

---

## Test 4: Verify Backend Permission Enforcement

**Objective**: Ensure backend blocks unauthorized API access

**Steps**:
1. While logged in as **subadmin** (from Test 3)
2. **Test Permitted Access**:
   - Click "Login Logs" in sidebar
   - Page should load successfully ✅
   - Click "Partners" in sidebar
   - Page should load successfully ✅
   - Click "Analytics" in sidebar
   - Page should load successfully ✅

3. **Test Blocked Access** (Direct URL):
   - In browser address bar, navigate to: `http://localhost:8081/admin/offers`
   - **Expected**: Should see error or be redirected
   - Open browser DevTools (F12) → Network tab
   - Look for API calls - should see **403 Forbidden** errors

4. **Test API Directly** (Optional - Advanced):
   - Open browser DevTools → Console
   - Get your auth token from localStorage:
     ```javascript
     localStorage.getItem('token')
     ```
   - Try to call a non-permitted API:
     ```javascript
     fetch('http://localhost:5000/api/admin/offers', {
       headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected**: Response should be `{"error": "Access denied. You do not have permission to access offers"}` with status 403

**Expected Results**:
- ✅ Permitted tabs load successfully
- ✅ Non-permitted tabs show 403 Forbidden
- ✅ Direct API calls to non-permitted endpoints return 403
- ✅ Error message: "Access denied. You do not have permission to access [tab-name]"

---

## Test 5: Update Subadmin Permissions

**Objective**: Verify permission changes reflect immediately

**Steps**:
1. **Logout** from subadmin account
2. **Login** as admin again
3. Navigate to **Subadmin Management**
4. Find the subadmin you created
5. Click **"Edit"** button on that subadmin
6. The user dropdown should auto-select that user
7. **Add 2 more tabs**:
   - ✅ Postback Logs
   - ✅ Reports
8. Click **"Update Permissions"** button
9. Wait for success message

10. **Verify Changes**:
    - Logout from admin
    - Login as the subadmin again
    - Navigate to Admin Panel
    - Check sidebar

**Expected Results**:
- ✅ Success message: "Subadmin permissions saved successfully"
- ✅ Subadmin now sees **5 tabs**:
  - Login Logs
  - Partners
  - Analytics
  - Postback Logs
  - Reports
- ✅ Changes apply immediately (no cache issues)

---

## Test 6: Remove Subadmin Role

**Objective**: Verify subadmin role can be revoked

**Steps**:
1. **Login** as admin
2. Navigate to **Subadmin Management**
3. Find the subadmin you created
4. Click **"Remove"** button (trash icon)
5. Confirm the removal in the popup dialog
6. Wait for success message

7. **Verify Removal**:
    - Logout from admin
    - Login as the user whose subadmin role was removed
    - Try to access Admin Panel

**Expected Results**:
- ✅ Success message: "Subadmin role removed successfully"
- ✅ User removed from "Existing Subadmins" list
- ✅ User role changed back to "user"
- ✅ User can no longer access Admin Panel
- ✅ If they try to access `/admin`, they should be redirected or see "Access Denied"

---

## Test 7: Admin Bypass Verification

**Objective**: Confirm admin users bypass all permission checks

**Steps**:
1. **Login** as admin
2. Navigate to any admin tab (e.g., Offers, Partners, etc.)
3. Verify all pages load without permission errors
4. Check browser DevTools → Network tab
5. API calls should return **200 OK**, not 403

**Expected Results**:
- ✅ Admin can access ALL tabs
- ✅ No permission errors
- ✅ All API calls succeed
- ✅ No 403 Forbidden responses

---

## Test 8: Login Logs Enhancement Verification

**Objective**: Verify Login Logs shows all required fields

**Steps**:
1. **Login** as admin
2. Navigate to **"Login Logs"** tab
3. Click on any login log entry to expand details

**Expected Results**:
- ✅ IP Address displayed
- ✅ Country displayed
- ✅ Region displayed (if available)
- ✅ City displayed
- ✅ ISP displayed (if available)
- ✅ VPN/Proxy detection status shown
- ✅ Fraud indicators displayed (if any)
- ✅ Risk level badges shown
- ✅ Device fingerprint information

---

## Troubleshooting

### Issue: Subadmin sees all tabs instead of filtered tabs
**Solution**: 
- Clear browser cache and localStorage
- Logout and login again
- Check browser console for errors

### Issue: 403 errors not appearing for non-permitted routes
**Solution**:
- Verify backend is running with updated code
- Check that route files were updated with `subadmin_or_admin_required` decorator
- Restart backend server

### Issue: Cannot create subadmin
**Solution**:
- Ensure you selected a non-admin user
- Ensure at least one tab is selected
- Check browser console for API errors
- Verify backend `/api/admin/subadmins` endpoint is working

---

## Success Criteria

All tests should pass with these results:

| Test | Status | Critical |
|------|--------|----------|
| Test 1: Admin Login | ✅ | Yes |
| Test 2: Create Subadmin | ✅ | Yes |
| Test 3: UI Tab Filtering | ✅ | **Critical** |
| Test 4: Backend Enforcement | ✅ | **Critical** |
| Test 5: Update Permissions | ✅ | Yes |
| Test 6: Remove Subadmin | ✅ | Yes |
| Test 7: Admin Bypass | ✅ | Yes |
| Test 8: Login Logs Fields | ✅ | Yes |

**Overall Status**: 🎯 All features implemented and ready for testing

---

## Quick Test Checklist

- [ ] Admin can see all 22 tabs
- [ ] Subadmin Management tab is visible for admin
- [ ] Can create subadmin with specific permissions
- [ ] Subadmin sees ONLY permitted tabs (hidden, not disabled)
- [ ] Subadmin can access permitted routes
- [ ] Subadmin gets 403 on non-permitted routes
- [ ] Can update subadmin permissions
- [ ] Changes reflect immediately after update
- [ ] Can remove subadmin role
- [ ] Admin bypasses all permission checks
- [ ] Login Logs shows IP, Country, City, ISP, VPN detection

---

## Notes

- **Test Duration**: ~15-20 minutes for all tests
- **Required**: 1 admin account + 1 regular user account
- **Browser**: Use Chrome/Firefox with DevTools for best results
- **Network Tab**: Keep DevTools open to monitor API responses
