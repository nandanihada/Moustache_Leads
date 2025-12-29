# 📊 Performance Report Fields - Data Status

## 🔍 **CURRENT SITUATION:**

Your database is **currently empty**:
- ❌ 0 clicks
- ❌ 0 offers  
- ❌ 0 conversions

**This means ALL fields will show empty/zero values right now.**

---

## ✅ **WHICH FIELDS WILL HAVE DATA (Once you have traffic):**

### **Automatically Populated (No extra work needed):**

#### **From Clicks Collection:**
These are captured automatically when users click on offers:
- ✅ **Date** - Click timestamp
- ✅ **Clicks** - Count of clicks
- ✅ **Country** - User's country (from IP)
- ✅ **Browser** - User's browser
- ✅ **Device Type** - Mobile/Desktop/Tablet
- ✅ **Source** - Referrer URL
- ✅ **IP Address** - User IP
- ✅ **User Agent** - Browser user agent

#### **From Conversions Collection:**
These are captured when postbacks arrive:
- ✅ **Conversions** - Count of conversions
- ✅ **Payout** - Conversion payout amount
- ✅ **Status** - approved/pending/rejected
- ✅ **Transaction ID** - Unique conversion ID

#### **Calculated Automatically:**
These are computed from the above data:
- ✅ **CR%** - Conversion Rate
- ✅ **CTR%** - Click-Through Rate
- ✅ **EPC** - Earnings Per Click
- ✅ **CPA** - Cost Per Acquisition
- ✅ **CPC** - Cost Per Click
- ✅ **CPM** - Cost Per Mille

---

## ⚠️ **WHICH FIELDS NEED MANUAL SETUP:**

### **Phase 1 Fields (Partially Working):**

#### **Need to Enable in Tracking:**
- ⚠️ **Gross Clicks** - All clicks (working, just needs traffic)
- ⚠️ **Unique Clicks** - Need to set `is_unique` flag in clicks
- ⚠️ **Suspicious Clicks** - Need to set `is_suspicious` flag in clicks
- ⚠️ **Rejected Clicks** - Need to set `is_rejected` flag in clicks
- ⚠️ **Sub ID 1-5** - Need to pass in tracking URL

**How to fix:** Update your click tracking code to set these flags.

---

### **Phase 2 Fields (Need Offer Data):**

#### **Need to Add to Offers Collection:**
- ❌ **Offer URL** - Add `url` field to offers
- ❌ **Category** - Add `category` field to offers
- ✅ **Currency** - Add `currency` field (defaults to USD)

**How to fix:** When creating offers, include these fields:
```javascript
{
  offer_id: "ML-00057",
  name: "My Survey Offer",
  url: "https://partner.com/offer/123",
  category: "Survey",
  currency: "USD"
}
```

---

### **Phase 3 Fields (Need New Database Fields):**

#### **Need to Add to Offers Collection:**
- ❌ **Ad Group** - Add `ad_group` field
- ❌ **Goal** - Add `goal` field  
- ❌ **Promo Code** - Add `promo_code` field

**How to fix:** Update offers with these fields:
```javascript
{
  ad_group: "Premium Offers",
  goal: "Lead Generation",
  promo_code: "SAVE20"
}
```

#### **Need to Add to Clicks Collection:**
- ❌ **Creative** - Add `creative` field (banner/ad ID)
- ❌ **App Version** - Add `app_version` field
- ❌ **Advertiser Sub ID 1-5** - Add `advertiser_sub_id1-5` fields

**How to fix:** Update click tracking to capture:
```javascript
{
  creative: "banner_001",
  app_version: "1.2.3",
  advertiser_sub_id1: "campaign_123",
  advertiser_sub_id2: "placement_456"
}
```

---

## 🎯 **SUMMARY TABLE:**

| Field | Will Have Data? | When? | Action Needed |
|-------|----------------|-------|---------------|
| **Date** | ✅ Yes | Immediately | None - auto captured |
| **Offer Name** | ✅ Yes | When offers exist | Create offers |
| **Offer URL** | ❌ No | When added to offers | Add `url` field |
| **Category** | ❌ No | When added to offers | Add `category` field |
| **Currency** | ✅ Yes | Defaults to USD | Optional: set in offers |
| **Ad Group** | ❌ No | When added to offers | Add `ad_group` field |
| **Goal** | ❌ No | When added to offers | Add `goal` field |
| **Promo Code** | ❌ No | When added to offers | Add `promo_code` field |
| **Creative** | ❌ No | When tracking updated | Add to click tracking |
| **App Version** | ❌ No | When tracking updated | Add to click tracking |
| **Country** | ✅ Yes | Immediately | None - auto captured |
| **Browser** | ✅ Yes | Immediately | None - auto captured |
| **Device Type** | ✅ Yes | Immediately | None - auto captured |
| **Source** | ✅ Yes | Immediately | None - auto captured |
| **Sub ID 1-5** | ⚠️ Maybe | If passed in URL | Add to tracking URLs |
| **Adv Sub ID 1-5** | ❌ No | When tracking updated | Add to click tracking |
| **Clicks** | ✅ Yes | Immediately | None - auto counted |
| **Gross Clicks** | ✅ Yes | Immediately | None - auto counted |
| **Unique Clicks** | ⚠️ Maybe | If flag set | Set `is_unique` flag |
| **Suspicious** | ⚠️ Maybe | If flag set | Set `is_suspicious` flag |
| **Rejected** | ⚠️ Maybe | If flag set | Set `is_rejected` flag |
| **Conversions** | ✅ Yes | When postbacks arrive | None - auto counted |
| **Approved Convs** | ✅ Yes | When postbacks arrive | None - auto counted |
| **Payout** | ✅ Yes | When postbacks arrive | None - auto captured |
| **CR%** | ✅ Yes | Immediately | None - auto calculated |
| **CTR%** | ✅ Yes | Immediately | None - auto calculated |
| **EPC** | ✅ Yes | Immediately | None - auto calculated |
| **Unique%** | ✅ Yes | Immediately | None - auto calculated |
| **Suspicious%** | ✅ Yes | Immediately | None - auto calculated |
| **Rejected%** | ✅ Yes | Immediately | None - auto calculated |
| **CPA** | ✅ Yes | Immediately | None - auto calculated |
| **CPC** | ✅ Yes | Immediately | None - auto calculated |
| **CPM** | ⚠️ Zero | Need impressions | Implement impression tracking |

---

## 📈 **REALISTIC EXPECTATIONS:**

### **Immediately Working (15 fields):**
Once you have traffic, these will work automatically:
- Date, Offer Name, Country, Browser, Device, Source
- Clicks, Gross Clicks, Conversions, Payout
- CR%, CTR%, EPC, CPA, CPC

### **Easy to Enable (6 fields):**
Just need to set flags in your existing tracking:
- Unique Clicks, Suspicious Clicks, Rejected Clicks
- Unique%, Suspicious%, Rejected%

### **Need Offer Updates (6 fields):**
Add fields when creating/updating offers:
- Offer URL, Category, Currency
- Ad Group, Goal, Promo Code

### **Need Tracking Updates (7 fields):**
Update click tracking code:
- Creative, App Version
- Advertiser Sub ID 1-5

---

## 🚀 **QUICK START - GET DATA NOW:**

I can create a script to populate test data so you can see everything working!

### **Option 1: Test Data (Recommended for testing)**
```bash
python populate_test_data.py
```
This will create:
- 100 test clicks with all fields
- 5 test offers with all fields
- 20 test conversions
- All flags and tracking data

### **Option 2: Real Production Data**
Wait for real traffic and:
1. Create offers with all fields
2. Update tracking code to capture all fields
3. Data will populate as traffic comes in

---

## 💡 **MY RECOMMENDATION:**

### **For Testing (Do this now):**
1. ✅ Run test data script (I'll create it)
2. ✅ See all 38 columns working
3. ✅ Verify calculations are correct
4. ✅ Test column selector

### **For Production (Do later):**
1. Update offer creation to include all fields
2. Update click tracking to capture all fields
3. Set up fraud detection for flags
4. Implement impression tracking (optional)

---

## ❓ **ANSWER TO YOUR QUESTION:**

**"Will fields be empty or contain values?"**

**Right now:** ALL EMPTY (database is empty)

**After test data:** ALL WORKING (you can see everything)

**In production:** 
- ✅ **15 fields** will work immediately with real traffic
- ⚠️ **6 fields** need simple flag updates
- ❌ **13 fields** need database schema updates
- ⚠️ **1 field** (CPM) needs impression tracking

**Bottom line:** Most important fields (Date, Offer, Clicks, Conversions, Payout, CR%, EPC) will work automatically. The rest need varying levels of setup.

---

## 🎯 **NEXT STEP:**

**Want me to create a test data script so you can see all 38 columns working with real data right now?**

This will let you:
- ✅ Test the column selector
- ✅ See all calculations working
- ✅ Verify the UI looks good
- ✅ Understand what each field shows

Then you can decide which fields to implement in production based on what you actually need!
