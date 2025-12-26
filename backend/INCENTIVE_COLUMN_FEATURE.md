# ✅ Incentive Column Implementation - Feature Documentation

## 🎯 Feature Overview

The Incentive column automatically categorizes offers based on their payout type:

- **Incent** = Fixed amount or tiered payout (user gets direct incentive)
- **Non-Incent** = Percentage-based payout (user doesn't get direct incentive)

---

## ✅ Implementation Status

- [x] ✅ Add new column **Incentive** (field: `incentive_type`)
- [x] ✅ Auto-set Incentive = **Non-Incent** for percentage offers
- [x] ✅ Auto-set Incentive = **Incent** for fixed amount offers
- [ ] ⏳ Display incentive status in offer list (Frontend)
- [ ] ⏳ Display incentive status in offer details (Frontend)
- [ ] ⏳ Include incentive field in reports (Frontend)

---

## 🔧 Backend Implementation

### **1. Incentive Calculation Logic**

Located in: `backend/models/offer.py`

```python
def calculate_incentive_type(payout_type='fixed', revenue_share_percent=None):
    """
    Auto-calculate incentive type based on payout type.
    
    Logic:
        - percentage payout → Non-Incent
        - fixed/tiered payout → Incent
    """
    # Primary logic: Based on payout_type
    if payout_type == 'percentage':
        return 'Non-Incent'
    
    # Legacy logic: Based on revenue_share_percent
    if revenue_share_percent and float(revenue_share_percent) > 0:
        return 'Non-Incent'
    
    # Default: Fixed or tiered payout = Incent
    return 'Incent'
```

### **2. Auto-Calculation on Offer Creation**

When an offer is created, the `incentive_type` is automatically calculated:

```python
payout_type = offer_data.get('payout_type', 'fixed')
revenue_share_percent = float(offer_data.get('revenue_share_percent', 0) or 0)
incentive_type = calculate_incentive_type(payout_type, revenue_share_percent)
```

### **3. Database Field**

The `incentive_type` field is stored in the offers collection:

```python
{
    'offer_id': 'ML-00001',
    'name': 'Example Offer',
    'payout_type': 'fixed',  # or 'percentage' or 'tiered'
    'incentive_type': 'Incent',  # Auto-calculated
    ...
}
```

---

## 📊 Payout Type → Incentive Type Mapping

| Payout Type | Incentive Type | Explanation |
|-------------|----------------|-------------|
| `fixed` | **Incent** | User gets fixed amount (e.g., $5.00) |
| `tiered` | **Incent** | User gets tiered amounts based on performance |
| `percentage` | **Non-Incent** | User gets percentage of revenue (e.g., 10%) |

---

## 🧪 Testing

### **Test 1: Create Fixed Payout Offer**

```json
{
  "name": "Fixed Payout Offer",
  "payout": 10.00,
  "payout_type": "fixed"
}
```

**Expected Result:**
- `incentive_type`: `"Incent"` ✅

### **Test 2: Create Percentage Payout Offer**

```json
{
  "name": "Percentage Payout Offer",
  "payout": 5.00,
  "payout_type": "percentage",
  "revenue_share_percent": 10
}
```

**Expected Result:**
- `incentive_type`: `"Non-Incent"` ✅

### **Test 3: Create Tiered Payout Offer**

```json
{
  "name": "Tiered Payout Offer",
  "payout": 15.00,
  "payout_type": "tiered"
}
```

**Expected Result:**
- `incentive_type`: `"Incent"` ✅

---

## 🔄 Update Existing Offers

To update incentive_type for all existing offers, run:

```bash
cd /home/rishabhg/Downloads/lovable-ascend/backend
source venv/bin/activate  # if using venv
python3 update_incentive_types.py
```

This script will:
1. Show current incentive type breakdown
2. Update all offers with correct incentive_type
3. Show updated breakdown

---

## 📈 Database Query Examples

### **Get All Incent Offers**

```python
offers_collection.find({
    'incentive_type': 'Incent',
    'is_active': True
})
```

### **Get All Non-Incent Offers**

```python
offers_collection.find({
    'incentive_type': 'Non-Incent',
    'is_active': True
})
```

### **Get Breakdown by Incentive Type**

```python
pipeline = [
    {'$match': {'is_active': True}},
    {'$group': {
        '_id': '$incentive_type',
        'count': {'$sum': 1}
    }}
]
offers_collection.aggregate(pipeline)
```

---

## 🎨 Frontend Display (To Be Implemented)

### **Offer List View**

Add a column showing the incentive type with color coding:

```
| Offer ID  | Name              | Payout | Payout Type | Incentive    |
|-----------|-------------------|--------|-------------|--------------|
| ML-00001  | Survey Offer      | $5.00  | fixed       | 🟢 Incent    |
| ML-00002  | Revenue Share     | 10%    | percentage  | 🔴 Non-Incent|
| ML-00003  | Tiered Offer      | $10.00 | tiered      | 🟢 Incent    |
```

### **Offer Details View**

Show incentive type prominently:

```
┌─────────────────────────────────┐
│ Offer Details                   │
├─────────────────────────────────┤
│ Name: Survey Offer              │
│ Payout: $5.00                   │
│ Payout Type: Fixed              │
│ Incentive: 🟢 Incent            │
└─────────────────────────────────┘
```

### **Reports**

Include incentive_type as a filterable column:

```
Filter by Incentive Type:
[ ] All
[ ] Incent
[ ] Non-Incent
```

---

## 📊 API Response

When fetching offers, the `incentive_type` is included:

```json
{
  "offer_id": "ML-00001",
  "name": "Example Offer",
  "payout": 5.00,
  "payout_type": "fixed",
  "incentive_type": "Incent",
  ...
}
```

---

## ✅ Benefits

1. **Automatic Classification** - No manual input required
2. **Consistent Logic** - Same rules applied to all offers
3. **Easy Filtering** - Filter offers by incentive type
4. **Better Reporting** - Track Incent vs Non-Incent performance
5. **Publisher Clarity** - Publishers know what type of offer it is

---

## 🔄 Backward Compatibility

The implementation maintains backward compatibility:

- **Legacy offers**: Will use `revenue_share_percent` if `payout_type` is not set
- **New offers**: Will use `payout_type` for calculation
- **Both fields**: If both are present, `payout_type` takes precedence

---

## 📝 Summary

| Feature | Status |
|---------|--------|
| Backend field added | ✅ Complete |
| Auto-calculation logic | ✅ Complete |
| Database integration | ✅ Complete |
| API response includes field | ✅ Complete |
| Update script for existing offers | ✅ Complete |
| Frontend display | ⏳ Pending |
| Reports integration | ⏳ Pending |

---

## 🚀 Next Steps

1. **Frontend**: Add incentive_type column to offer list
2. **Frontend**: Display incentive badge in offer details
3. **Reports**: Add incentive_type filter and breakdown
4. **Analytics**: Track performance by incentive type

---

**The backend implementation is complete and ready for frontend integration!** 🎉
