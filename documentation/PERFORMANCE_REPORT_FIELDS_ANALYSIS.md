# 📊 Performance Report Fields - Current vs Required

## ✅ **CURRENTLY EXTRACTING (15 fields):**

### **Grouping/Dimensions:**
- ✅ **Date** - Available
- ✅ **Offer Name** (offer_id) - Available
- ✅ **Country** - Available  
- ✅ **Sub ID 1-5** - Available (can group by these)

### **Statistics:**
- ✅ **Clicks** - Available
- ✅ **Unique Clicks** - Available
- ✅ **Suspicious Clicks** - Available (currently returns 0)
- ✅ **Conversions** - Available
- ✅ **Approved Conversions** - Available
- ✅ **Payout** - Available

### **Calculations:**
- ✅ **CR** (Conversion Rate) - Available
- ✅ **CTR** (Click-Through Rate) - Available
- ✅ **EPC** (Earnings Per Click) - Available

---

## ❌ **NOT CURRENTLY EXTRACTING:**

### **Offer Details (7 fields):**
- ❌ **Ad Group** - NOT in database
- ❌ **Goal** - NOT in database
- ❌ **Category** - NOT in database
- ❌ **Offer URL** - NOT in database (stored in offers collection but not joined)
- ❌ **Creative** - NOT in database
- ❌ **Promo Code** - NOT in database
- ❌ **Currency** - NOT aggregated (default USD)

### **Tracking Details (3 fields):**
- ❌ **Browser** - In clicks collection but NOT aggregated
- ❌ **Source** - In clicks collection but NOT aggregated
- ❌ **App Version** - NOT in database

### **Advertiser Sub IDs (5 fields):**
- ❌ **Advertiser Sub ID 1-5** - NOT in database

### **Additional Statistics (5 fields):**
- ❌ **Impressions** - NOT tracked
- ❌ **Gross Clicks** - NOT tracked separately
- ❌ **Rejected Clicks** - In clicks but NOT aggregated
- ❌ **Payout Type** - NOT tracked

### **Additional Calculations (7 fields):**
- ❌ **Unique Click Rate** - Not calculated
- ❌ **CPC** (Cost Per Click) - Not calculated
- ❌ **CPM** (Cost Per Mille) - Not calculated (no impressions)
- ❌ **CPA** (Cost Per Acquisition) - Not calculated
- ❌ **CPL** (Cost Per Lead) - Not calculated
- ❌ **Rejected Click Rate** - Not calculated
- ❌ **Suspicious Click Rate** - Not calculated (but can be)

---

## 📊 **SUMMARY:**

| Category | Available | Missing | Total |
|----------|-----------|---------|-------|
| **Grouping/Dimensions** | 9 | 7 | 16 |
| **Statistics** | 7 | 5 | 12 |
| **Calculations** | 3 | 7 | 10 |
| **TOTAL** | **19** | **19** | **38** |

---

## 🔍 **DETAILED BREAKDOWN:**

### **1. Fields in Database (can add easily):**

#### **Already in Clicks Collection:**
- ✅ browser
- ✅ device_type
- ✅ source (referrer)
- ✅ is_rejected (for rejected clicks)
- ✅ is_suspicious (for suspicious clicks)
- ✅ sub_id1, sub_id2, sub_id3, sub_id4, sub_id5

#### **Already in Offers Collection (need JOIN):**
- ✅ offer_url
- ✅ category (if added to offers)
- ✅ advertiser_name

---

### **2. Fields NOT in Database (need to add):**

#### **Offer Fields:**
- ❌ **Ad Group** - New field needed in offers collection
- ❌ **Goal** - New field needed in offers collection
- ❌ **Category** - Can add to offers collection
- ❌ **Creative** - New field needed in offers/clicks
- ❌ **Promo Code** - New field needed in offers/clicks

#### **Tracking:**
- ❌ **App Version** - New field needed in clicks collection
- ❌ **Advertiser Sub IDs 1-5** - New fields needed

#### **Statistics:**
- ❌ **Impressions** - Need new tracking (offer views)
- ❌ **Gross Clicks** - All clicks before filtering

---

### **3. Can Calculate from Existing Data:**

#### **Easy Calculations (have data):**
- ✅ **Suspicious Click Rate** = suspicious_clicks / total_clicks * 100
- ✅ **Rejected Click Rate** = rejected_clicks / total_clicks * 100
- ✅ **Unique Click Rate** = unique_clicks / total_clicks * 100
- ✅ **CPA** = total_payout / conversions
- ✅ **CPL** = total_payout / conversions (same as CPA)

#### **Need Additional Data:**
- ❌ **CPC** = advertiser_payout / clicks (need advertiser payout)
- ❌ **CPM** = (payout / impressions) * 1000 (need impressions)

---

## 🎯 **WHAT CAN WE ADD IMMEDIATELY:**

### **Phase 1: Easy Additions (no database changes)**

#### **New Grouping Options:**
1. ✅ **Browser** (already in DB)
2. ✅ **Source** (already in DB)
3. ✅ **Device Type** (already in DB)

#### **New Statistics:**
4. ✅ **Rejected Clicks** (already tracked)
5. ✅ **Gross Clicks** (all clicks)

#### **New Calculations:**
6. ✅ **Suspicious Click Rate** - suspicious/total * 100
7. ✅ **Rejected Click Rate** - rejected/total * 100
8. ✅ **Unique Click Rate** - unique/total * 100
9. ✅ **CPA** - payout/conversions

**Estimated Time: 2-3 hours**

---

### **Phase 2: Medium Additions (join with offers)**

#### **Offer Details:**
10. ✅ **Offer URL** (join with offers collection)
11. ✅ **Category** (add to offers, then join)
12. ✅ **Currency** (from offers)

**Estimated Time: 3-4 hours**

---

### **Phase 3: Complex Additions (need new tracking)**

#### **New Fields in Database:**
13. ❌ **Ad Group** - Add to offers collection
14. ❌ **Goal** - Add to offers collection
15. ❌ **Creative** - Add to clicks collection
16. ❌ **Promo Code** - Add to offers collection
17. ❌ **App Version** - Add to clicks tracking
18. ❌ **Advertiser Sub IDs 1-5** - Add to clicks collection

#### **New Tracking System:**
19. ❌ **Impressions** - Need offer view tracking
20. ❌ **CPM** - Calculate after impressions tracked

**Estimated Time: 10-15 hours**

---

## 📋 **CURRENT STATE:**

```javascript
// What we're extracting NOW:
{
  date: "2025-11-11",
  offer_id: "ML-00057",
  offer_name: "My first offer",
  country: "US",
  clicks: 100,
  unique_clicks: 85,
  suspicious_clicks: 5,
  conversions: 10,
  approved_conversions: 9,
  total_payout: 50.00,
  cr: 10.0,  // calculated
  epc: 0.50, // calculated
  ctr: 2.5   // calculated
}
```

---

## 🎯 **RECOMMENDED IMPLEMENTATION:**

### **Option A: Add Phase 1 Only (Quick Win)**
**Time: 2-3 hours**
**Benefit: 9 new fields with real data**

Add immediately:
- Browser grouping
- Source grouping
- Device grouping
- Rejected clicks stat
- Gross clicks stat
- 4 new calculated rates

---

### **Option B: Add Phase 1 + Phase 2 (Best Value)**
**Time: 5-7 hours**
**Benefit: 12 new fields with real data**

Everything from Phase 1 PLUS:
- Offer URL
- Category
- Currency

---

### **Option C: Full Implementation (Long Term)**
**Time: 15-20 hours**
**Benefit: All 38 fields**

Requires:
- Database schema changes
- New tracking systems
- Impression tracking
- Testing and validation

---

## ✅ **MY RECOMMENDATION:**

### **Start with Phase 1 (2-3 hours):**

This gives you **9 additional valuable fields** using data you already have:

1. **Browser** - See which browsers convert best
2. **Source** - Track traffic sources
3. **Device** - Mobile vs Desktop performance
4. **Rejected Clicks** - Quality monitoring
5. **Gross Clicks** - Total traffic
6. **Suspicious Rate** - Fraud detection
7. **Rejected Rate** - Quality metrics
8. **Unique Rate** - Traffic quality
9. **CPA** - Cost analysis

These are the most commonly used fields and provide immediate business value.

**Then decide if you need Phase 2 & 3 based on actual usage.**

---

## 💡 **QUESTION FOR YOU:**

Do you want me to:

**A.** Implement Phase 1 now (2-3 hours, 9 new fields) ✅  
**B.** Implement Phase 1 + Phase 2 (5-7 hours, 12 new fields)  
**C.** Plan full implementation for later (15-20 hours, all 38 fields)  
**D.** Just document what's missing (already done above)  

**Which option do you prefer?**

---

## 📊 **CURRENT vs REQUESTED COMPARISON:**

```
┌────────────────────────────────────────────────────────┐
│                  PERFORMANCE REPORT                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ Currently Have: 19 fields                          │
│  ❌ Missing: 19 fields                                 │
│  📊 Total Requested: 38 fields                         │
│                                                         │
│  Coverage: 50%                                          │
│                                                         │
│  ✅ Easy to Add: 9 fields (Phase 1)                    │
│  ⚠️ Medium Effort: 3 fields (Phase 2)                  │
│  ❌ Complex: 7 fields (Phase 3)                        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

**Let me know which phase you want implemented!** 🚀
