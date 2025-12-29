# 💰 Revenue Share Implementation - Complete Guide

## ✅ Implementation Complete

### **What Was Implemented:**

The system now fully supports **revenue sharing** where affiliates can earn a **percentage of the payout** received from upstream partners, instead of a fixed amount.

---

## 🔄 How It Works

### **Two Payout Models:**

#### **1. Fixed Payout (Traditional)**
- **Spreadsheet has:** `payout` column (e.g., "5.00")
- **System behavior:** Affiliate gets exactly $5.00 regardless of what you receive from partner
- **Example:**
  - Upstream partner sends: $100
  - Affiliate receives: $5.00 (fixed)
  - Your profit: $95.00

#### **2. Revenue Share (NEW)**
- **Spreadsheet has:** `percent` column (e.g., "8%")
- **System behavior:** Affiliate gets 8% of whatever you receive from partner
- **Example:**
  - Upstream partner sends: $100
  - Affiliate receives: $8.00 (8% of $100)
  - Your profit: $92.00
  
  - Upstream partner sends: $50
  - Affiliate receives: $4.00 (8% of $50)
  - Your profit: $46.00

---

## 📊 Bulk Upload Changes

### **Spreadsheet Format:**

You can now upload offers with **either** `payout` OR `percent` column:

#### **Option 1: Fixed Payout**
```
| offer_id | title | url | country | payout | description | platform |
|----------|-------|-----|---------|--------|-------------|----------|
| 75998    | ...   | ... | US      | 5.00   | ...         | ...      |
```

#### **Option 2: Revenue Share (Your Case)**
```
| offer_id | title | url | country | percent | description | platform |
|----------|-------|-----|---------|---------|-------------|----------|
| 75998    | ...   | ... | US      | 8%      | ...         | ...      |
```

### **Validation Rules:**

✅ **Valid:**
- Spreadsheet with `payout` column only
- Spreadsheet with `percent` column only
- Spreadsheet with both (percent takes priority)

❌ **Invalid:**
- Spreadsheet with neither `payout` nor `percent`

---

## 🔧 Technical Implementation

### **1. Bulk Upload (`utils/bulk_offer_upload.py`)**

**Changes:**
- Removed `payout` from required fields
- Added validation: either `payout` OR `percent` must be present
- Maps `percent` → `revenue_share_percent` in database
- Auto-sets `payout = 0` for revenue share offers

**Code:**
```python
# Special validation: Either 'payout' OR 'revenue_share_percent' must be present
has_payout = 'payout' in mapped_data and mapped_data['payout']
has_percent = 'revenue_share_percent' in mapped_data and mapped_data['revenue_share_percent']

if not has_payout and not has_percent:
    errors.append("Missing required field: either 'payout' or 'percent' must be provided")

# If only percent is provided, set payout to 0
if has_percent and not has_payout:
    mapped_data['payout'] = 0
```

### **2. Postback Handling (`routes/postback_enhanced.py`)**

**Changes:**
- Added `calculate_downward_payout()` function
- Fetches offer to check `revenue_share_percent`
- Calculates affiliate payout based on percentage
- Stores both upward and downward payouts

**Flow:**
```python
# 1. Receive postback from upstream partner
upward_payout = 100.00  # What partner sends

# 2. Fetch offer
offer = offers_collection.find_one({'offer_id': click.get('offer_id')})

# 3. Calculate affiliate payout
if offer['revenue_share_percent'] > 0:
    # Revenue share: 8% of $100 = $8
    affiliate_payout = 100.00 * (8 / 100) = 8.00
else:
    # Fixed payout: use offer's payout field
    affiliate_payout = offer['payout']  # e.g., 5.00

# 4. Store in conversion
conversion_data = {
    'payout': 8.00,  # What affiliate gets
    'upward_payout': 100.00,  # What we received
    'is_revenue_share': True,
    'revenue_share_percent': 8,
    'payout_calculation_method': '8% of 100.0'
}
```

---

## 📝 Database Schema

### **Offers Collection:**
```json
{
  "offer_id": "ML-00065",
  "name": "Prime Crisp",
  "payout": 0,  // 0 for revenue share offers
  "revenue_share_percent": 8,  // 0-100
  "incentive_type": "Non-Incent"  // Auto-calculated
}
```

### **Conversions Collection:**
```json
{
  "conversion_id": "CONV-ABC123",
  "payout": 8.00,  // What affiliate receives
  "upward_payout": 100.00,  // What we received from partner
  "is_revenue_share": true,
  "revenue_share_percent": 8,
  "payout_calculation_method": "8% of 100.0"
}
```

---

## 🎯 Example Scenarios

### **Scenario 1: Fixed Payout Offer**
```
Spreadsheet: payout = 5.00
Offer in DB: payout = 5.00, revenue_share_percent = 0

Postback received: payout = 100.00
Affiliate gets: $5.00 (fixed)
```

### **Scenario 2: Revenue Share Offer (8%)**
```
Spreadsheet: percent = 8%
Offer in DB: payout = 0, revenue_share_percent = 8

Postback received: payout = 100.00
Affiliate gets: $8.00 (8% of $100)

Postback received: payout = 50.00
Affiliate gets: $4.00 (8% of $50)
```

### **Scenario 3: Revenue Share Offer (5%)**
```
Spreadsheet: percent = 5%
Offer in DB: payout = 0, revenue_share_percent = 5

Postback received: payout = 90.01
Affiliate gets: $4.50 (5% of $90.01, rounded to 2 decimals)
```

---

## 🚀 Testing Your Upload

### **Your Spreadsheet:**
Based on your screenshot, you have:
- `offer_id`: 75998, 75995, ...
- `percent`: 5%, 8%, 8%
- No `payout` column

### **Expected Result:**
✅ Upload should succeed
✅ Offers created with:
  - `payout = 0`
  - `revenue_share_percent = 5` or `8`
  - `incentive_type = "Non-Incent"`

### **When Postback Arrives:**
```
Example: Offer 75998 (5% revenue share)

Upstream sends: payout=90.01
System calculates: 90.01 × 5% = $4.50
Affiliate receives: $4.50
Your profit: $85.51
```

---

## 📋 Files Modified

| File | Changes |
|------|---------|
| `utils/bulk_offer_upload.py` | ✅ Made payout optional, added percent validation |
| `routes/postback_enhanced.py` | ✅ Added revenue share calculation logic |

---

## ✨ Benefits

1. **Flexible Pricing:** Support both fixed and percentage-based offers
2. **Automatic Calculation:** System calculates affiliate payout automatically
3. **Transparent Logging:** Both upward and downward payouts are logged
4. **Profit Tracking:** Easy to see your margin (upward - downward)
5. **Scalable:** Works with any percentage (0-100%)

---

## 🔍 Monitoring

Check logs for revenue share calculations:
```
💰 Payout Calculation:
   Upward (from partner): $100.0
   Method: 8% of 100.0
   Downward (to affiliate): $8.0
```

---

**Status: ✅ FULLY IMPLEMENTED AND READY TO USE**
