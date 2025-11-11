# 🎯 Real Data Setup Guide

## Current Status ✅

Your system is ready to track **real offer clicks and conversions**!

### What You Have:
- ✅ **1 Active Offer**: "My first offer" ($90.01 payout)
- ✅ **Tracking System**: Fully functional
- ✅ **Reports**: Performance & Conversion reports ready
- ⚠️ **Old Test Data**: 1989 test clicks from deleted offers

---

## 🗑️ Step 1: Clear Old Test Data

Run this to start fresh:

```bash
cd backend
python clear_test_data.py
```

**Enter `yes` when prompted** to delete all test clicks/conversions.

**Result**: Clean slate, only your 1 real offer remains.

---

## 📦 Step 2: How Users Get Tracking Links

### For Publishers/Users:

1. **Login** to the system
2. **Go to**: http://localhost:8080/offers
3. **Browse offers** - see all active offers
4. **Click "Details"** button on any offer
5. **Modal opens** showing:
   - Offer details (name, payout, description)
   - **Tracking Link** (auto-generated)
   - Preview link
   - Allowed countries, devices, etc.

6. **Copy Tracking Link**
7. **Share it** on social media, website, email, etc.

---

## 🔗 How Tracking Works

### When Someone Clicks the Tracking Link:

```
User clicks: https://yourapp.com/track/ABC123?sub1=twitter

1. ✅ Backend records CLICK:
   - User ID (affiliate)
   - Offer ID
   - Country
   - Device type
   - Browser
   - IP address
   - Sub IDs (from URL params)
   - Timestamp

2. ↗️ User redirected to Target URL (your survey)

3. 💰 When user completes action:
   - Survey posts back to /api/track/conversion
   - Backend records CONVERSION
   - Links to original click
   - Updates reports
```

---

## 📊 How to See Real Data in Reports

### Performance Report:
```
http://localhost:8080/dashboard/performance-report
```

Shows:
- Total clicks
- Total conversions
- Revenue
- Conversion rate
- Chart of performance over time

**Filters by:**
- Date range
- Country
- Offer
- Sub IDs

### Conversion Report:
```
http://localhost:8080/dashboard/conversion-report
```

Shows:
- Individual conversions
- Status (Approved/Pending/Rejected)
- Transaction details
- Payout per conversion
- Chart of revenue trends

---

## 🎯 Testing Real Tracking Flow

### Option 1: Test Yourself

1. **Login as publisher** (e.g., lity_too)
2. **Go to Offers page**
3. **Click "Details"** on "My first offer"
4. **Copy tracking link**, e.g.:
   ```
   http://localhost:5000/track/ML-00057?user_id=690b2edcfc6eb6aae822ce0b&sub1=test
   ```

5. **Open in NEW BROWSER** (incognito mode)
6. **Click will be recorded!**
7. **Check Performance Report** - you'll see 1 click

### Option 2: Share Real Link

1. **Get tracking link** from Offers page
2. **Customize Sub IDs**:
   ```
   http://localhost:5000/track/ML-00057?user_id=YOUR_ID&sub1=twitter&sub2=campaign1
   ```
3. **Share on Twitter/Facebook/Email**
4. **When people click** - shows in reports instantly!

---

## 🔧 Technical Details

### Tracking API Endpoints:

**Record Click:**
```
GET /track/{offer_id}?user_id={affiliate_id}&sub1=...&sub2=...
```

**Record Conversion:**
```
POST /api/track/conversion
{
  "click_id": "CLK-ABC123",
  "transaction_id": "TXN-XYZ",
  "status": "approved",
  "payout": 90.01
}
```

### Database Collections:

**clicks:**
- `click_id` - Unique ID
- `user_id` / `affiliate_id` - Publisher who shared link
- `offer_id` - Which offer
- `country`, `device_type`, `browser` - User info
- `click_time` - When clicked
- `sub_id1` to `sub_id5` - Tracking params

**conversions:**
- `conversion_id` - Unique ID
- `click_id` - Links to original click
- `user_id` / `affiliate_id` - Publisher earning commission
- `offer_id` - Which offer
- `status` - approved/pending/rejected
- `payout` - Amount earned
- `conversion_time` - When converted

---

## 🎮 Quick Test Commands

### Check Current Data:
```bash
python check_system_status.py
```

### Clear Test Data:
```bash
python clear_test_data.py
```

### Check User Data:
```bash
python check_data.py
```

### Generate Test Data (if needed):
```bash
python generate_data_for_current_user.py
```

---

## 📋 Checklist for Real Data

- [ ] Clear old test data (`python clear_test_data.py`)
- [ ] Have at least 1 active offer
- [ ] Offer has target URL (survey link)
- [ ] Login as publisher
- [ ] View offer details - get tracking link
- [ ] Test tracking link (click it)
- [ ] Check Performance Report - see 1 click
- [ ] Share real tracking link
- [ ] Monitor reports for real user activity

---

## 🚀 What Happens Next

### When Real Users Click:

1. **Instant Tracking**:
   - Click recorded in database
   - Shows in Performance Report within seconds
   - User redirected to survey

2. **Performance Report Shows**:
   - Number of clicks
   - Which countries
   - Which devices
   - Time of day patterns
   - Sub ID performance

3. **When Users Convert**:
   - Conversion recorded
   - Status: Approved/Pending/Rejected
   - Payout calculated
   - Shows in Conversion Report
   - Revenue charts update

---

## 💡 Tips

### Customize Tracking Links:

Add Sub IDs to track traffic sources:

```
?sub1=twitter&sub2=morning_post&sub3=campaign_nov
?sub1=facebook&sub2=paid_ad&sub3=audience_23_45
?sub1=email&sub2=newsletter_weekly
```

Then use **Report Filters** to see which sources perform best!

### Monitor Performance:

- **Check reports daily**
- **Use Date Presets** for quick views
- **Filter by Country** to see geo performance
- **Filter by Sub ID** to track campaigns
- **Export CSV** for detailed analysis

---

## 🎉 You're Ready!

Your system is configured to track **real user activity**. 

**Next steps:**
1. Clear test data
2. Get tracking link from Offers page
3. Share it!
4. Watch reports fill with real data! 🚀

**Need help?** Check `check_system_status.py` anytime to see what data you have.
