# Test API Import Enhancements - Quick Guide

## 🚀 Quick Start

### 0. Fix Existing Offers First! (IMPORTANT)

The enhancements only apply to **new imports**. Fix old offers first:

```bash
# Preview changes (safe, no modifications)
python backend/fix_existing_offers.py --preview

# Apply fixes
python backend/fix_existing_offers.py
```

This will:
- Clean HTML from descriptions
- Format offer names (remove underscores)
- Add missing fields

---

### 1. Run Tests
```bash
python backend/test_enhancements.py
```

**Expected Output:** All tests should pass ✅

---

### 2. Restart Backend
```bash
cd backend
python app.py
```

---

### 3. Test API Import

1. **Open Admin Offers Page**
   - Navigate to `/admin/offers`

2. **Click "API Import" Button**

3. **Enter Credentials:**
   - Network ID: `cpamerchant`
   - API Key: `[your key]`
   - Network Type: `HasOffers`

4. **Test Connection**
   - Should show: "Connection successful! Found X offers"

5. **Preview Offers**
   - Should show list of offers with:
     - ✅ Clean offer names (no underscores)
     - ✅ Multiple countries (not just US)
     - ✅ Payout types visible

6. **Import Offers**
   - Click "Import Offers"
   - Wait for completion

7. **View Imported Offers**
   - Click on any offer to view details
   - Verify:
     - ✅ Description is clean (no HTML tags)
     - ✅ Description has proper line breaks
     - ✅ Countries are correct
     - ✅ Payout type is shown
     - ✅ Protocol is visible

---

## 🔍 What to Look For

### Terminal Output
Look for these logs when importing:

```
🔍 Mapping offer: Papa Survey Router - Incent UK/DE/AU/US
   Campaign ID: 5404
   Target URL: https://...
   Payout: 2.50 USD
   Payout Type: CPA
   
🌍 Extracting countries:
   Type: <class 'dict'>
   Dict keys: ['840', '826', '276', '36']
   ✅ Added country code: US
   ✅ Added country code: GB
   ✅ Added country code: DE
   ✅ Added country code: AU
   Final countries: ['US', 'GB', 'DE', 'AU']
```

### Database Check
Verify these fields are populated:
- `name` - Formatted (no underscores)
- `description` - Clean (no HTML)
- `countries` - Multiple countries
- `offer_type` / `payout_model` - CPA, CPI, etc.
- `tracking_protocol` - pixel, server_postback, etc.
- `category` / `vertical` - Lifestyle, Finance, etc.
- `allowed_traffic_sources` - Array of sources
- `conversion_window` - Number of days
- `daily_cap` - Number or 0

### UI Check
In Offer Details Modal:
- Description in gray box with line breaks
- Payout type badge visible
- Protocol badge visible (blue)
- Multiple country flags
- All fields populated

---

## ✅ Success Criteria

| Enhancement | Test | Expected Result |
|-------------|------|-----------------|
| **Country Mapping** | Import offers | Multiple countries, not just US |
| **Payout Type** | View offer details | CPA/CPI/CPL badge visible |
| **Protocol** | View offer details | Protocol badge visible |
| **Complete Fields** | Check database | 30+ fields populated |
| **Description Clean** | View offer details | No HTML tags, proper formatting |
| **Name Format** | View offers list | No underscores, proper spacing |

---

## 🐛 Troubleshooting

### Issue: Countries still showing "US"
**Solution:**
1. Check terminal logs for country extraction (🌍)
2. Verify API returns Country data
3. Check if `contain[]` parameter is in API request

### Issue: Payout type not showing
**Solution:**
1. Check terminal logs for payout type extraction
2. Verify API returns `payout_type`, `type`, or `revenue_type`
3. Check `PAYOUT_TYPE_MAPPING` in field mapper

### Issue: Description still has HTML
**Solution:**
1. Check if `clean_html_description()` is being called
2. Run test: `python backend/test_enhancements.py`
3. Check terminal logs for errors

### Issue: Offer names still have underscores
**Solution:**
1. Check if `format_offer_name()` is being called
2. Run test: `python backend/test_enhancements.py`
3. Verify import is using latest code

---

## 📊 Test Results

Run the test suite to verify all enhancements:

```bash
python backend/test_enhancements.py
```

**Expected:**
- ✅ HTML Cleaner: 4/4 tests pass
- ✅ Name Formatter: 5/5 tests pass
- ✅ Country Mapping: 8/8 tests pass
- ✅ Payout Type Mapping: 7/7 tests pass

---

## 🎯 Next Steps

1. ✅ Run tests - Verify all pass
2. ✅ Restart backend - Apply changes
3. ✅ Test API import - Import real offers
4. ✅ Verify database - Check all fields
5. ✅ Check UI - View offer details
6. ✅ Monitor logs - Watch for errors

---

## 📝 Notes

- All enhancements are backward compatible
- Existing offers are not affected
- New imports will use enhanced mapping
- All fields have sensible defaults
- HTML cleaning preserves line breaks
- Name formatting is non-destructive

---

**Ready to test!** 🚀
