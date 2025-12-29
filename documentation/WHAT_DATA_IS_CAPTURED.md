# 📊 What Data is Captured & Shown

## 🎯 Data Flow Overview

---

## 1️⃣ **When Someone CLICKS Your Tracking Link**

### **What's Captured Automatically:**

```
┌─────────────────────────────────────────────────┐
│            CLICK DATA CAPTURED                  │
├─────────────────────────────────────────────────┤
│ click_id         → CLK-ABC123 (unique ID)       │
│ offer_id         → ML-00057                     │
│ user_id          → Your publisher ID            │
│ affiliate_id     → Same as user_id              │
│ ip_address       → 192.168.1.100                │
│ country          → US (detected from IP)        │
│ device_type      → mobile/desktop/tablet        │
│ browser          → Chrome/Firefox/Safari        │
│ user_agent       → Full browser string          │
│ sub_id1          → twitter (from URL)           │
│ sub_id2          → campaign1 (from URL)         │
│ sub_id3          → nov2025 (from URL)           │
│ sub_id4          → morning (from URL)           │
│ sub_id5          → test (from URL)              │
│ click_time       → 2025-11-10 10:30:00 UTC      │
│ referer          → Where they clicked from      │
└─────────────────────────────────────────────────┘
```

### **Shows in Performance Report as:**
- **1 Click**
- **Country: US**
- **Device: Mobile**
- **Sub ID 1: twitter** (for filtering)

---

## 2️⃣ **When Someone COMPLETES the Offer**

### **What's Captured from Postback:**

```
┌─────────────────────────────────────────────────┐
│         CONVERSION DATA CAPTURED                │
├─────────────────────────────────────────────────┤
│ conversion_id    → CONV-XYZ789 (unique ID)      │
│ click_id         → CLK-ABC123 (links to click)  │
│ transaction_id   → TXN-SURVEY-12345             │
│ offer_id         → ML-00057                     │
│ user_id          → Your publisher ID            │
│ affiliate_id     → Same as user_id              │
│ status           → approved/pending/rejected    │
│ payout           → $90.01                       │
│ country          → US (from original click)     │
│ device_type      → mobile (from original click) │
│ ip_address       → 192.168.1.100                │
│ sub_id1          → twitter (from click)         │
│ sub_id2          → campaign1 (from click)       │
│ sub_id3          → nov2025 (from click)         │
│ conversion_time  → 2025-11-10 10:35:00 UTC      │
└─────────────────────────────────────────────────┘
```

### **Shows in Conversion Report as:**

```
┌──────────────────────────────────────────────────────────────┐
│ Time     │ Offer  │ Status     │ Payout │ Transaction ID    │
├──────────────────────────────────────────────────────────────┤
│ 10:35 AM │ML-057  │✅ Approved │ $90.01 │ TXN-SURVEY-12345  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3️⃣ **How to See All This Data**

### **Performance Report** (`/dashboard/performance-report`)

**Aggregated View:**
```
Date Range: Nov 1 - Nov 10

Summary Cards:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 🖱️ Clicks    │ 💰 Conversions│ 💵 Payout    │ 📈 CR        │
│ 150          │ 25           │ $2,250.25    │ 16.7%        │
└──────────────┴──────────────┴──────────────┴──────────────┘

Data Table:
┌──────┬────────┬────────┬─────┬────────┬───────┐
│ Date │ Clicks │ Convs  │ Pay │ CR     │ EPC   │
├──────┼────────┼────────┼─────┼────────┼───────┤
│ Nov10│   30   │   5    │$450 │ 16.7%  │$15.00 │
│ Nov 9│   25   │   4    │$360 │ 16.0%  │$14.40 │
└──────┴────────┴────────┴─────┴────────┴───────┘

Chart:
Shows conversion trends over time
```

**Filter by:**
- ✅ Date range
- ✅ Country (show only US clicks)
- ✅ Offer (show only ML-00057)
- ✅ Sub ID 1 (show only twitter traffic)
- ✅ Sub ID 2, 3, 4, 5

---

### **Conversion Report** (`/dashboard/conversion-report`)

**Individual Conversions:**
```
Summary:
┌─────────────┬──────────────┬───────────────┬─────────────┐
│ Approved    │ Pending      │ Rejected      │ Total       │
│ $2,000.00   │ $180.00      │ $70.25        │ $2,250.25   │
│ 22 convs    │ 2 convs      │ 1 conv        │ 25 convs    │
└─────────────┴──────────────┴───────────────┴─────────────┘

Individual Transactions:
┌────────────┬───────┬───────────┬────────┬──────────────┬─────────┐
│ Time       │ Offer │ Status    │ Payout │ Transaction  │ Country │
├────────────┼───────┼───────────┼────────┼──────────────┼─────────┤
│ 10:35 AM   │ML-057 │✅ Approved│ $90.01 │ TXN-SURV-123 │ US      │
│ 09:20 AM   │ML-057 │⏰ Pending │ $90.01 │ TXN-SURV-122 │ UK      │
│ 08:15 AM   │ML-057 │❌ Rejected│ $0.00  │ TXN-SURV-121 │ IN      │
└────────────┴───────┴───────────┴────────┴──────────────┴─────────┘
```

**Filter by:**
- ✅ Date range
- ✅ Status (approved/pending/rejected)
- ✅ Offer
- ✅ Country
- ✅ Sub IDs

---

## 4️⃣ **Advanced Filtering Examples**

### **Example 1: See Twitter Campaign Performance**

**Filter:**
- Sub ID 1 = "twitter"
- Date: Last 7 days

**Shows:**
- All clicks from your Twitter campaign
- How many converted
- Total earnings from Twitter traffic
- Conversion rate for Twitter vs other sources

---

### **Example 2: See US Mobile Traffic**

**Filter:**
- Country = "US"
- Device = "mobile"

**Shows:**
- Clicks from US mobile users only
- Their conversion rate
- Revenue from this segment

---

### **Example 3: See Specific Campaign ROI**

**Filter:**
- Sub ID 1 = "facebook"
- Sub ID 2 = "paid_ad"
- Sub ID 3 = "campaign_nov"

**Shows:**
- Performance of your Facebook paid ad campaign
- Track if it's profitable
- Compare with organic traffic

---

## 5️⃣ **Real-Time Updates**

### **Data flows instantly:**

```
Click happens
  ↓ (< 1 second)
Shows in Performance Report

Conversion happens
  ↓ (< 1 second)
Shows in Conversion Report
```

**No delay!** Everything is real-time.

---

## 🧪 **Test to See It All:**

```bash
# Run the complete flow test
cd backend
python test_complete_flow.py
```

**This will:**
1. ✅ Simulate a click
2. ✅ Show click data captured
3. ✅ Simulate a conversion
4. ✅ Show conversion data captured
5. ✅ Display your totals
6. ✅ Tell you where to see it in reports

---

## 📊 **Database Collections:**

### **clicks** (Every click tracked)
```json
{
  "_id": "...",
  "click_id": "CLK-ABC123",
  "offer_id": "ML-00057",
  "user_id": "YOUR_ID",
  "country": "US",
  "device_type": "mobile",
  "sub_id1": "twitter",
  "click_time": "2025-11-10T10:30:00Z"
}
```

### **conversions** (Every conversion tracked)
```json
{
  "_id": "...",
  "conversion_id": "CONV-XYZ789",
  "click_id": "CLK-ABC123",
  "transaction_id": "TXN-123",
  "status": "approved",
  "payout": 90.01,
  "conversion_time": "2025-11-10T10:35:00Z"
}
```

---

## 💡 **Summary:**

**When someone clicks your link:**
- ✅ IP, Country, Device, Browser captured
- ✅ Your Sub IDs tracked (campaign info)
- ✅ Unique click_id generated
- ✅ Shows in Performance Report instantly

**When they complete offer:**
- ✅ Links to original click (all data preserved)
- ✅ Transaction ID, Status, Payout captured
- ✅ Shows in Conversion Report instantly
- ✅ You earn money!

**All visible in:**
- 📊 Performance Report (aggregated stats)
- 💰 Conversion Report (individual transactions)
- 🔍 Advanced filters (segment your data)
- 📈 Charts (visual trends)

**Everything tracked. Everything visible. Real-time.** ✅
