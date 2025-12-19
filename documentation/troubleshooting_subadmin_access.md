# Subadmin Dashboard Access - Troubleshooting Guide

## Issue: Admin Dashboard Button Not Working for Subadmin

The "Admin Dashboard" button appears but clicking it just reloads the page instead of navigating to `/admin`.

### Possible Causes & Solutions

#### 1. **Check User Role in Browser**

Open browser console (F12) and run:
```javascript
// Check stored user data
const user = JSON.parse(localStorage.getItem('user'));
console.log('User role:', user?.role);
console.log('Full user data:', user);
```

**Expected**: `role: "subadmin"`  
**If different**: The user's role wasn't updated to subadmin in the database

---

#### 2. **Hard Refresh the Browser**

The React app might be cached:
1. Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. Or clear browser cache and reload

---

#### 3. **Logout and Login Again**

The user object in localStorage might be stale:
1. Click "Logout"
2. Login again with subadmin credentials
3. Check if role is now "subadmin"

---

#### 4. **Verify Database Role**

Check MongoDB to ensure the user's role was actually changed:

```javascript
// In MongoDB or backend
db.users.findOne({ email: "subadmin@example.com" })
// Should show: { role: "subadmin", ... }
```

---

#### 5. **Check Browser Console for Errors**

Open browser console (F12) → Console tab:
- Look for any JavaScript errors
- Look for navigation errors
- Look for permission errors

---

#### 6. **Verify Subadmin Permissions Exist**

Check if subadmin permissions were actually created:

```javascript
// In MongoDB
db.subadmin_permissions.findOne({ user_id: "USER_ID_HERE" })
// Should return: { allowed_tabs: [...], ... }
```

---

#### 7. **Check Network Tab**

When clicking "Admin Dashboard":
1. Open DevTools (F12) → Network tab
2. Click "Admin Dashboard"
3. Look for any API calls or redirects
4. Check if there's a 403 Forbidden response

---

## Quick Fix Steps

### Step 1: Verify Role
```javascript
// In browser console
localStorage.getItem('user')
```

### Step 2: Force Logout/Login
1. Logout completely
2. Clear localStorage: `localStorage.clear()`
3. Login again as subadmin

### Step 3: Check Navigation
```javascript
// In browser console, try manual navigation
window.location.href = '/admin'
```

If manual navigation works, it's a React Router issue.  
If it doesn't work, it's a permission/role issue.

---

## Expected Behavior

When clicking "Admin Dashboard":
1. URL should change to `/admin`
2. Admin sidebar should appear
3. Only permitted tabs should be visible
4. No errors in console

---

## Debug Commands

Run these in browser console:

```javascript
// 1. Check auth context
const user = JSON.parse(localStorage.getItem('user'));
console.log('Role:', user?.role);
console.log('Is subadmin?', user?.role === 'subadmin');

// 2. Check if isAdminOrSubadmin would be true
console.log('isAdminOrSubadmin:', user?.role === 'admin' || user?.role === 'subadmin');

// 3. Try manual navigation
window.location.href = '/admin';

// 4. Check current location
console.log('Current URL:', window.location.href);
```

---

## Most Likely Issue

**The user's role in localStorage is still "user" instead of "subadmin"**

### Solution:
1. Logout
2. Login again
3. The login API should return the updated user object with `role: "subadmin"`

---

## If Still Not Working

Please provide:
1. Output of `localStorage.getItem('user')` from browser console
2. Any errors in browser console
3. Network tab showing the response from login API
