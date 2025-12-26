# 📊 Percentage-Based Payout Logic - Implementation Guide

## ✅ Current Status

### **Already Implemented:**
- [x] ✅ **Percent field exists** - `revenue_share_percent` in offer model
- [x] ✅ **Calculation logic exists** - `calculate_downward_payout()` function
- [x] ✅ **Integration in postback** - Used in postback receiver (line 499)

### **To Be Implemented:**
- [ ] ⏳ Validate percent value (0–100)
- [ ] ⏳ Store payout calculation logs
- [ ] ⏳ Handle rounding rules
- [ ] ⏳ Frontend display for percentage field

---

## 🔍 Existing Implementation

### **1. Calculation Function** (`postback_receiver.py` lines 125-181)

```python
def calculate_downward_payout(upward_payout, offer):
    """
    Calculate payout to forward based on revenue share settings.
    
    Logic:
    - If revenue_share_percent > 0: Calculate percentage
    - Otherwise: Use fixed payout
    """
    upward_payout = float(upward_payout) if upward_payout else 0
    revenue_share_percent = offer.get('revenue_share_percent', 0)
    
    if revenue_share_percent and float(revenue_share_percent) > 0:
        # Percentage-based
        percent = float(revenue_share_percent)
        downward_payout = upward_payout * (percent / 100)
        
        return {
            'downward_payout': round(downward_payout, 2),
            'is_percentage': True,
            'revenue_share_percent': percent,
            'calculation_method': f'{percent}% of {upward_payout}'
        }
    else:
        # Fixed payout
        fixed_payout = float(offer.get('payout', 0))
        
        return {
            'downward_payout': fixed_payout,
            'is_percentage': False,
            'revenue_share_percent': 0,
            'calculation_method': f'Fixed: {fixed_payout}'
        }
```

### **2. Usage in Postback** (lines 486-516)

```python
# Get upward payout from postback
upward_payout = get_param_value('payout') or get_param_value('amount') or 0

# Calculate downward payout
revenue_calc = calculate_downward_payout(upward_payout, offer_for_calc)
final_payout = revenue_calc['downward_payout']

logger.info(f"💰 Revenue share calculation:")
logger.info(f"   Upward payout: {upward_payout}")
logger.info(f"   Method: {revenue_calc['calculation_method']}")
logger.info(f"   Downward payout: {final_payout}")
```

---

## 📋 Implementation Checklist

### ✅ **Task 1: Add Percent Field** - DONE
- Field: `revenue_share_percent` (0-100)
- Location: `backend/models/offer.py`
- Status: ✅ Already exists

### ⏳ **Task 2: Validate Percent Value**
- Add validation in offer creation/update
- Ensure 0 ≤ value ≤ 100
- Return error if invalid

### ⏳ **Task 3: Detect Percentage-Based Offers**
- Check if `revenue_share_percent > 0`
- Set `payout_type = 'percentage'`
- Update `incentive_type = 'Non-Incent'`

### ✅ **Task 4: Calculate Downstream Payout** - DONE
- Formula: `(upward_payout × percent) / 100`
- Status: ✅ Already implemented

### ✅ **Task 5: Send to Downstream Partner** - DONE
- Replace `{payout}` macro with calculated amount
- Status: ✅ Already implemented

### ⏳ **Task 6: Store Calculation Logs**
- Log each calculation to database
- Include: upward amount, percent, downward amount
- Store in `payout_calculations` collection

### ⏳ **Task 7: Handle Rounding Rules**
- Round to 2 decimal places
- Document rounding behavior
- Handle edge cases

---

## 🚀 Next Steps

1. **Add validation** for revenue_share_percent
2. **Create payout calculation logs** collection
3. **Implement rounding rules** documentation
4. **Add frontend display** for percentage field
5. **Create testing scenarios**

---

## 📊 Example Flow

### **Scenario: 10% Revenue Share**

1. **Offer Configuration:**
   - `revenue_share_percent`: 10
   - `payout_type`: 'percentage'
   - `incentive_type`: 'Non-Incent'

2. **Upstream Postback Received:**
   - `payout`: $50.00

3. **Calculation:**
   - `downward_payout = 50.00 × (10 / 100) = $5.00`

4. **Forwarded to Downstream:**
   - `{payout}` = $5.00

5. **Logged:**
   - Upward: $50.00
   - Percent: 10%
   - Downward: $5.00
   - Method: "10% of 50.00"

---

## 📝 Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `models/offer.py` | Offer model with revenue_share_percent | ✅ Exists |
| `routes/postback_receiver.py` | Calculation logic | ✅ Implemented |
| `routes/admin_offers.py` | Validation | ⏳ To add |
| Frontend offer form | Display percentage field | ⏳ To add |

---

**Current Implementation: 60% Complete**
**Remaining Work: Validation, Logging, Frontend**
