# 🧪 Complete Testing Guide - User Reports System

## 📋 Overview

This guide will walk you through testing the **entire User Reports Analytics System** with test data.

---

## ⚙️ Prerequisites

✅ Backend server running (`python app.py` in backend folder)  
✅ Frontend server running (`npm run dev` in root folder)  
✅ MongoDB connected  
✅ User account created  

---

## 🚀 Step-by-Step Testing Process

### **Step 1: Generate Test Data** (5 minutes)

First, we need to create sample clicks and conversions data:

```bash
cd backend
python create_test_data.py
```

**What it does:**
- Lists all users in your database
- Lets you select a user
- Asks how many days of data (default: 7 days)
- Asks clicks per day (default: 50/day)
- Generates realistic test data:
  - Clicks with random times, countries, devices
  - Conversions (10-20% conversion rate)
  - Different statuses (approved/pending/rejected)

**Example output:**
```
🔍 FIND YOUR USER ID
======================================================================

📋 Available Users:
======================================================================
1. Username: admin                Role: admin      ID: 68e4e41a4ad6...
2. Username: testpublisher        Role: publisher  ID: 68e4e52b3cd7...

======================================================================

👤 Enter user number (or press Enter for first user): 2

✅ Selected: testpublisher

📅 How many days of data? (default: 7): 14
📊 Clicks per day? (default: 50): 100

🚀 GENERATING TEST DATA
======================================================================
User ID: 68e4e52b3cd7...
Days: 14
Clicks per day: ~100
======================================================================

📦 Using 2 offers for test data
   - Premium Survey App
   - Gaming Offer - Play & Earn

📅 2024-11-07: Generating 98 clicks...
📅 2024-11-06: Generating 105 clicks...
...

======================================================================
✅ TEST DATA GENERATED SUCCESSFULLY!
======================================================================
📊 Total Clicks: 1,456
💰 Total Conversions: 218
📈 Conversion Rate: 14.97%
💵 Estimated Revenue: $545.00

🎉 Ready to test reports!
```

---

### **Step 2: Test Backend API** (5 minutes)

Now test the API endpoints directly:

#### 2.1 Get JWT Token
```bash
python get_token.py
```

Enter your username and password. Copy the token.

#### 2.2 Test Endpoints

Update `test_user_reports.py` with your token:
```python
TOKEN = "your_token_here"
```

Then run:
```bash
python test_user_reports.py
```

**Expected Results:**
```
🧪 TESTING SUMMARY
======================================================================
Status Code: 200
✅ Summary Retrieved Successfully!

Today:
  Clicks: 98
  Conversions: 15
  Payout: $37.50

Last 7 Days:
  Clicks: 687
  Conversions: 103
  Payout: $257.50

======================================================================
🧪 TESTING PERFORMANCE REPORT
======================================================================
Status Code: 200
✅ Performance Report Retrieved Successfully!

Summary:
  Total Clicks: 687
  Total Conversions: 103
  Total Payout: $257.50
  Avg CR: 14.99%
  Avg EPC: $0.37

Data Rows: 7

======================================================================
🧪 TESTING CONVERSION REPORT
======================================================================
Status Code: 200
✅ Conversion Report Retrieved Successfully!

Summary:
  Approved Payout: $195.00
  Pending Payout: $42.50
  Total Conversions: 103

Conversions: 20

======================================================================
✅ ALL TESTS COMPLETED
======================================================================
```

---

### **Step 3: Test Frontend UI** (10 minutes)

#### 3.1 Login
1. Go to: **http://localhost:8080**
2. Click **Login**
3. Enter your credentials
4. You should see the dashboard

#### 3.2 Test Performance Report

**Navigate:** Click **📈 Performance Report** in sidebar

**Test Checklist:**
- [ ] Page loads without errors
- [ ] Date range picker shows (default: last 7 days)
- [ ] **4 Summary Cards** display:
  - [ ] Total Clicks (should show number)
  - [ ] Total Conversions (should show number)
  - [ ] Total Payout (should show $$$)
  - [ ] Avg CR% (should show percentage)
- [ ] **📈 Line Chart** appears:
  - [ ] Chart shows blue line with data points
  - [ ] X-axis shows dates
  - [ ] Y-axis shows conversion counts
  - [ ] Hover shows tooltip with exact values
  - [ ] Legend shows "Conversions"
- [ ] **Data Table** shows rows:
  - [ ] Columns: Date, Offer, Clicks, Conversions, CR%, Payout, EPC
  - [ ] Data is sorted by date (newest first)
  - [ ] Numbers are formatted correctly
- [ ] **Pagination** works (if > 20 rows):
  - [ ] "Previous" and "Next" buttons
  - [ ] Shows "Showing X to Y of Z results"
- [ ] **Refresh button** works:
  - [ ] Click refresh → data reloads
  - [ ] Loading spinner appears
- [ ] **Export CSV** works:
  - [ ] Click Export → CSV downloads
  - [ ] File named: `performance_report_YYYY-MM-DD.csv`
  - [ ] Opens in Excel/Sheets correctly
- [ ] **Date Range Change** works:
  - [ ] Change start date → data updates
  - [ ] Change end date → data updates
  - [ ] Chart updates with new date range
  - [ ] Summary cards update

#### 3.3 Test Conversion Report

**Navigate:** Click **📝 Conversion Report** in sidebar

**Test Checklist:**
- [ ] Page loads without errors
- [ ] Date range picker shows (default: today)
- [ ] **3 Summary Cards** display:
  - [ ] Approved Payout (green text)
  - [ ] Pending Payout (yellow text)
  - [ ] Total Conversions
- [ ] **📊 Bar Chart** appears:
  - [ ] Chart shows green bars
  - [ ] X-axis shows dates
  - [ ] Y-axis shows revenue
  - [ ] Hover shows tooltip with exact revenue
  - [ ] Legend shows "Revenue ($)"
- [ ] **Transaction Table** shows rows:
  - [ ] Columns: Time, Transaction ID, Offer, Status, Payout, Country, Device
  - [ ] Transaction IDs are formatted (monospace font)
  - [ ] Times show full date/time
- [ ] **Status Badges** work:
  - [ ] 🟢 Approved (green badge with checkmark)
  - [ ] 🟡 Pending (yellow badge with clock)
  - [ ] 🔴 Rejected (red badge with X)
- [ ] **Pagination** works (if > 20 rows)
- [ ] **Refresh button** works
- [ ] **Export CSV** works:
  - [ ] Downloads `conversion_report_YYYY-MM-DD.csv`
- [ ] **Date Range Change** works:
  - [ ] Change dates → data updates
  - [ ] Chart updates
  - [ ] Summary cards update

---

## 🎯 Advanced Testing

### Test Different Scenarios

#### 1. **Empty State**
- Change date range to future dates
- Should show "No data available" message
- Chart should show "No chart data available"

#### 2. **Different Date Ranges**
- Test: Today only
- Test: Last 7 days
- Test: Last 30 days
- Test: Custom range (e.g., specific week)

#### 3. **Pagination**
If you have more than 20 conversions:
- Go to page 2
- Check URL updates
- Go back to page 1
- Check data loads correctly

#### 4. **Browser Compatibility**
- Test in Chrome ✅
- Test in Firefox
- Test in Safari
- Test in Edge

#### 5. **Responsive Design**
- Desktop view (1920x1080)
- Tablet view (768px)
- Mobile view (375px)
- Check charts resize correctly
- Check tables scroll horizontally on mobile

---

## 🐛 Common Issues & Solutions

### Issue 1: "No data available"
**Solution:**
- Make sure you ran `create_test_data.py`
- Check you're logged in as the correct user
- Verify date range includes test data dates

### Issue 2: "Failed to load report"
**Solution:**
- Check backend is running on port 5000
- Check browser console for errors (F12)
- Verify JWT token is valid (not expired)

### Issue 3: Charts not showing
**Solution:**
- Check browser console for errors
- Verify Recharts is installed: `npm list recharts`
- Make sure date range has data
- Try refreshing the page (Ctrl+R)

### Issue 4: Export doesn't work
**Solution:**
- Check browser allows downloads
- Check popup blocker isn't blocking download
- Verify backend `/api/reports/export` endpoint works

### Issue 5: Pagination missing
**Solution:**
- Normal if you have < 20 results
- Generate more test data with more clicks per day

---

## 📸 What Success Looks Like

### Performance Report (With Data):
```
┌─────────────────────────────────────────────┐
│ Performance Report                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────┐│
│ │  1,456  │ │   218   │ │ $545.00 │ │15% ││
│ │ Clicks  │ │Converts │ │ Payout  │ │ CR ││
│ └─────────┘ └─────────┘ └─────────┘ └────┘│
│                                             │
│ [📈 Line Chart showing trend line]          │
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ Date       │ Offer  │ Clicks │ Conv  │ ││
│ │ 2024-11-07 │ Survey │   98   │  15   │ ││
│ │ 2024-11-06 │ Survey │  105   │  16   │ ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Conversion Report (With Data):
```
┌─────────────────────────────────────────────┐
│ Conversion Report                           │
│ ┌───────────┐ ┌───────────┐ ┌────────────┐│
│ │ $195.00   │ │  $42.50   │ │    103     ││
│ │ Approved  │ │  Pending  │ │   Total    ││
│ └───────────┘ └───────────┘ └────────────┘│
│                                             │
│ [📊 Bar Chart showing green bars]           │
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ Time     │ TXN-ID    │ Status │ Payout││
│ │ 3:45 PM  │ TXN-ABC   │ 🟢 App │ $2.50 ││
│ │ 2:30 PM  │ TXN-XYZ   │ 🟡 Pnd │ $2.50 ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## ✅ Final Checklist

### Backend
- [ ] All 5 API endpoints return 200 OK
- [ ] JWT authentication works
- [ ] User sees only their own data
- [ ] Date filtering works
- [ ] Pagination works
- [ ] CSV export generates file

### Frontend
- [ ] Both pages load without errors
- [ ] Navigation menu shows report links
- [ ] Date pickers work
- [ ] Summary cards display correctly
- [ ] **Line chart renders** (Performance Report)
- [ ] **Bar chart renders** (Conversion Report)
- [ ] Charts have interactive tooltips
- [ ] Data tables display rows
- [ ] Pagination buttons work
- [ ] Export buttons download CSVs
- [ ] Refresh buttons reload data
- [ ] Loading states appear
- [ ] Empty states show when no data

### Data
- [ ] Test data generated successfully
- [ ] Clicks created in database
- [ ] Conversions created in database
- [ ] Data spans multiple days
- [ ] Multiple offers used
- [ ] Different statuses present

---

## 🎉 Success!

If all checkboxes are ticked, your **User Reports Analytics System is working perfectly!**

### Next Steps:
- Demo to your manager ✅
- Deploy to production 🚀
- Monitor with real traffic 📊
- Collect user feedback 💬

---

## 📞 Need Help?

If something isn't working:
1. Check browser console (F12) for errors
2. Check backend terminal for errors
3. Verify MongoDB is connected
4. Review this testing guide again
5. Check `USER_REPORTS_COMPLETE.md` for documentation

---

**Happy Testing! 🧪✨**
