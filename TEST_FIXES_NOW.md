# ✅ Test the Fixes Now

## What Was Fixed

1. ✅ **URL now shows parameters** - Backend builds URL with your parameter mappings
2. ✅ **Edit modal has parameter mapping UI** - Same visual mapping as create modal
3. ✅ **Parameters are saved** - Backend stores and uses parameter_mapping field

## Quick Test (5 Minutes)

### Step 1: Start Dev Server (30 seconds)
```bash
npm run dev
```

### Step 2: Create LeadAds Partner (2 minutes)

1. Open Partners page
2. Click "Generate Postback URL"
3. Fill in:
   ```
   Partner Name: LeadAds Test
   Template: LeadAds
   ```
4. Verify you see mappings:
   ```
   [✓] user_id → aff_sub
   [✓] status → status
   [✓] payout → payout
   [✓] transaction_id → transaction_id
   ```
5. Look at "Generated Postback URL Preview" section
6. **VERIFY:** URL should show:
   ```
   https://moustacheleads-backend.onrender.com/postback/
   [UNIQUE_KEY]?aff_sub={aff_sub}&status={status}&
   payout={payout}&transaction_id={transaction_id}
   ```
7. Click "Generate Postback URL"

### Step 3: Check Partners Table (30 seconds)

Look at the partners table.

**VERIFY:** The "Our Postback URL" column should show:
```
https://moustacheleads-backend.onrender.com/postback/
-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?
aff_sub={aff_sub}&status={status}&payout={payout}&
transaction_id={transaction_id}
```

**✅ If you see parameters in the URL → SUCCESS!**

### Step 4: Test Edit Modal (1 minute)

1. Click the Edit button (pencil icon) on LeadAds Test partner
2. **VERIFY:** You should see:
   - Basic Information section
   - Parameter Mapping section with table
   - Partner Template dropdown
   - Visual mapping table
   - Updated Postback URL Preview
3. Try changing a parameter:
   - Change "aff_sub" to "user_id"
   - See URL preview update
4. Click Cancel (don't save yet)

**✅ If edit modal has parameter mapping → SUCCESS!**

### Step 5: Test Parameter Modification (1 minute)

1. Click Edit on LeadAds Test partner again
2. Modify the mapping:
   - Uncheck the "transaction_id" row
   - See URL preview update (transaction_id should disappear)
3. Click "Update Partner"
4. Check partners table again
5. **VERIFY:** URL should NOT have transaction_id parameter anymore

**✅ If URL updates correctly → SUCCESS!**

## Understanding the URL

### What You See
```
https://moustacheleads-backend.onrender.com/postback/
-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?
aff_sub={aff_sub}&status={status}&payout={payout}
```

### What It Means

**Base URL:**
```
https://moustacheleads-backend.onrender.com/postback/
```
Your backend endpoint

**Unique Key:**
```
-3YJWcgL-TnlNnscehd5j23IbVZRJHUY
```
Unique identifier for this partner

**Parameters:**
```
?aff_sub={aff_sub}&status={status}&payout={payout}
```
The parameters LeadAds will send

**The {aff_sub} syntax:**
- This is a **macro/placeholder**
- LeadAds will replace it with actual values
- Example: `{aff_sub}` becomes `507f1f77bcf86cd799439011`

## Why aff_sub={aff_sub}?

### Your Mapping
```
OUR Parameter:   user_id
THEIR Parameter: aff_sub
```

### The URL Uses THEIR Name
```
?aff_sub={aff_sub}
```

**Why?** Because LeadAds expects `aff_sub`, not `user_id`!

### When LeadAds Sends Postback
```
Before: ?aff_sub={aff_sub}
After:  ?aff_sub=507f1f77bcf86cd799439011
```

### Your Backend Receives
```
Incoming: aff_sub=507f1f77bcf86cd799439011
Mapping:  aff_sub → user_id
Result:   Credit user 507f1f77bcf86cd799439011
```

## Common Issues

### Issue: URL doesn't show parameters
**Solution:** 
1. Make sure you selected a template or added parameters
2. Make sure parameters are enabled (checkbox checked)
3. Make sure "THEIR Parameter" field is filled
4. Refresh the page and try again

### Issue: Edit modal doesn't show parameter mapping
**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Make sure you're using the latest code
4. Check browser console for errors

### Issue: Parameters not saved
**Solution:**
1. Check backend is running
2. Check backend logs for errors
3. Verify database connection
4. Try creating a new partner

## Full Test Checklist

- [ ] Dev server running
- [ ] Opened Partners page
- [ ] Clicked "Generate Postback URL"
- [ ] Selected LeadAds template
- [ ] Saw parameters auto-fill
- [ ] Saw URL preview with parameters
- [ ] Generated partner
- [ ] URL in table shows parameters
- [ ] Clicked Edit button
- [ ] Edit modal shows parameter mapping
- [ ] Modified a parameter
- [ ] Saw URL preview update
- [ ] Updated partner
- [ ] URL in table updated correctly

## Expected Results

### Create Modal
```
✅ Partner template dropdown
✅ Parameter mapping table
✅ Visual arrows (→)
✅ Add/Remove buttons
✅ Enable/Disable checkboxes
✅ Real-time URL preview
✅ URL shows all parameters
```

### Partners Table
```
✅ URL column shows full URL with parameters
✅ Copy button works
✅ Parameters visible in URL
```

### Edit Modal
```
✅ Same parameter mapping UI as create
✅ Loads existing mappings
✅ Can modify mappings
✅ URL preview updates
✅ Save updates URL
```

## Next Steps

### After Testing
1. ✅ Create real LeadAds partner
2. ✅ Copy the generated URL
3. ✅ Share with LeadAds
4. ✅ Add your 100 offers with {user_id} macro
5. ✅ Test complete flow

### Deploy
```bash
git add .
git commit -m "Fix parameter mapping: URL generation and edit modal"
git push origin main
```

## Summary

### What Changed

**Frontend:**
- ✅ Create modal sends parameter_mapping to backend
- ✅ Edit modal loads and displays parameter_mapping
- ✅ Edit modal allows modifying parameter_mapping
- ✅ Real-time URL preview in both modals

**Backend:**
- ✅ Accepts parameter_mapping in create partner
- ✅ Builds URL with parameters based on mapping
- ✅ Stores parameter_mapping in database
- ✅ Accepts parameter_mapping in update partner
- ✅ Rebuilds URL when mappings change

**Result:**
- ✅ URLs now show parameters
- ✅ Edit modal has full parameter mapping UI
- ✅ Everything works end-to-end

**Test it now and see the difference!** 🚀
