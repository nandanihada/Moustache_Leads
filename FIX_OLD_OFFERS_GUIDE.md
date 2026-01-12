# Fix Old Offers - Complete Guide

## 🎯 Purpose

The API import enhancements only apply to **NEW imports**. This script updates **existing offers** in your database with the same enhancements.

---

## ⚠️ Important

**The enhancements are NOT retroactive by default!**

- ✅ New imports: Automatically get all enhancements
- ❌ Old offers: Need to run this script to apply enhancements

---

## 🔧 What Gets Fixed

### 1. Offer Names
**Before:** `Papa_Survey_Router_ Incent UK/DE/AU/US`
**After:** `Papa Survey Router - Incent UK/DE/AU/US`

- Removes underscores
- Formats "Incent" properly
- Cleans up spacing

### 2. Descriptions
**Before:** `<p>Complete survey<br>New users only</p>`
**After:** `Complete survey\nNew users only`

- Removes HTML tags
- Preserves line breaks
- Unescapes HTML entities

### 3. Missing Fields
Adds these fields if missing:
- `tracking_protocol` (default: 'pixel')
- `payout_model` (from offer_type)
- `category` (from vertical)
- `conversion_window` (default: 30 days)
- `incentive_type` (detected from name)

---

## 🚀 How to Use

### Step 1: Preview Changes (Safe)

```bash
python backend/fix_existing_offers.py --preview
```

**What it does:**
- Shows what would be changed
- Does NOT modify database
- Safe to run anytime

**Example Output:**
```
📊 Found 150 offers in database

[1/150] Papa_Survey_Router_ Incent UK...
   • Name: 'Papa_Survey_Router_ Incent UK' → 'Papa Survey Router - Incent UK'
   • Description: Has HTML tags (will be cleaned)
   • Missing: tracking_protocol
   • Missing: incentive_type

[2/150] iSurveyWorld_DOI_non incent US...
   • Name: 'iSurveyWorld_DOI_non incent US' → 'iSurveyWorld DOI - Non Incent US'
   • Missing: payout_model

📊 PREVIEW SUMMARY
Total Offers:           150
Needs Fixing:           87
Already Up to Date:     63
```

---

### Step 2: Apply Fixes

```bash
python backend/fix_existing_offers.py
```

**What it does:**
- Applies all enhancements to existing offers
- Updates database
- Shows progress for each offer

**Example Output:**
```
🔧 FIXING EXISTING OFFERS
📊 Found 150 offers in database

[1/150] Processing: Papa_Survey_Router_ Incent UK...
   ✅ FIXED (3 changes):
      • Name: 'Papa_Survey_Router_...' → 'Papa Survey Router...'
      • Description: Cleaned HTML (245 → 198 chars)
      • Added: incentive_type = 'Incent'

[2/150] Processing: iSurveyWorld_DOI_non incent US...
   ✅ FIXED (2 changes):
      • Name: 'iSurveyWorld_DOI_non incent US' → 'iSurveyWorld DOI - Non Incent US'
      • Added: payout_model = 'CPA'

[3/150] Processing: Clean Offer Name...
   ⏭️  SKIPPED (no changes needed)

📊 SUMMARY
Total Offers:    150
✅ Fixed:        87
⏭️  Skipped:      63
❌ Errors:       0
```

---

## 📋 Step-by-Step Instructions

### Complete Workflow

1. **Preview first (recommended)**
   ```bash
   python backend/fix_existing_offers.py --preview
   ```
   - Review what will be changed
   - Check if the changes look correct

2. **Apply fixes**
   ```bash
   python backend/fix_existing_offers.py
   ```
   - Press Enter to confirm
   - Wait for completion
   - Review summary

3. **Restart backend**
   ```bash
   cd backend
   python app.py
   ```

4. **Refresh browser**
   - Clear cache (Ctrl+Shift+R)
   - View offers
   - Check that names and descriptions are fixed

---

## ✅ Verification

### Check in UI
1. Go to Admin Offers page
2. Look at offer names - should have no underscores
3. Click on an offer to view details
4. Check description - should be clean, no HTML tags
5. Verify all fields are populated

### Check in Database
```python
from database import Database
db = Database()
offers = db.get_collection('offers')

# Check a sample offer
offer = offers.find_one({'name': {'$regex': 'Survey'}})
print(f"Name: {offer['name']}")
print(f"Description: {offer['description'][:100]}...")
print(f"Protocol: {offer.get('tracking_protocol')}")
print(f"Payout Model: {offer.get('payout_model')}")
print(f"Incentive Type: {offer.get('incentive_type')}")
```

---

## 🐛 Troubleshooting

### Issue: Script fails with "No module named 'database'"
**Solution:**
```bash
cd backend
python fix_existing_offers.py
```

### Issue: "Permission denied" or database connection error
**Solution:**
- Make sure MongoDB is running
- Check database connection in `backend/database.py`
- Verify credentials in `.env` file

### Issue: Changes not visible in UI
**Solution:**
- Restart backend server
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for errors

### Issue: Some offers still have HTML in description
**Solution:**
- Run the script again
- Check terminal output for errors
- Verify `html_cleaner.py` is working: `python backend/test_enhancements.py`

---

## 🔄 Running Multiple Times

**Safe to run multiple times!**
- Script checks what needs fixing
- Skips offers that are already fixed
- Only updates what needs updating
- No duplicate changes

---

## 📊 Expected Results

### Before Running Script
- Offer names: `Papa_Survey_Router_ Incent UK`
- Descriptions: `<p>Complete survey<br>New users</p>`
- Missing fields: No protocol, payout_model, etc.

### After Running Script
- Offer names: `Papa Survey Router - Incent UK`
- Descriptions: Clean text with line breaks
- All fields: Populated with defaults

---

## 💡 Tips

1. **Always preview first** - See what will change before applying
2. **Run during low traffic** - Safer to update database when few users online
3. **Backup database** - Optional but recommended for large databases
4. **Check a few offers manually** - Verify changes look correct
5. **Run after bulk imports** - If you imported offers before enhancements

---

## 🎯 When to Run This Script

Run this script if:
- ✅ You imported offers BEFORE implementing enhancements
- ✅ Offer names have underscores
- ✅ Descriptions have HTML tags
- ✅ Some fields are missing (protocol, payout_model, etc.)
- ✅ You want all offers to have consistent formatting

Don't need to run if:
- ❌ All offers were imported AFTER enhancements
- ❌ All offers already have clean names and descriptions
- ❌ All fields are already populated

---

## 📝 Summary

**Command to preview:**
```bash
python backend/fix_existing_offers.py --preview
```

**Command to fix:**
```bash
python backend/fix_existing_offers.py
```

**What it fixes:**
- Offer names (removes underscores)
- Descriptions (removes HTML)
- Missing fields (adds defaults)

**Safe to run:**
- Multiple times
- On production database
- With existing offers

---

**Ready to fix your old offers!** 🚀
