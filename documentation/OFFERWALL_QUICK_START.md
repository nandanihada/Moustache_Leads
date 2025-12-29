# 🎯 Offerwall Quick Start Guide

## 5-Minute Setup

### Step 1: Get Your Placement ID
```
1. Login to dashboard
2. Go to "Placements" page
3. Find your placement
4. Copy the Placement ID (e.g., placement_abc123xyz789)
```

### Step 2: Embed the Iframe
```html
<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID"
  width="100%" 
  height="600" 
  frameborder="0"
  style="border: none; border-radius: 8px;">
</iframe>
```

### Step 3: Replace Variables
- `YOUR_PLACEMENT_ID` → Your actual placement ID
- `USER_ID` → Your end user's unique ID

### Step 4: Done! 🎉
The offerwall is now live and tracking:
- ✅ User sessions
- ✅ Offer clicks
- ✅ Conversions
- ✅ Earnings

---

## 📊 What Happens Next

### Real-Time Tracking
- User loads iframe → Session created
- User clicks offer → Click tracked
- User completes offer → Conversion tracked
- Earnings calculated automatically

### Analytics Available
- Total impressions
- Click-through rate (CTR)
- Conversion rate
- Earnings per click (EPC)
- Country & device breakdown

---

## 🔧 Advanced Options

### Add External Campaign Tracking
```html
<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID&sub_id=CAMPAIGN_123"
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>
```

### Filter by Country
```html
<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID&country=US"
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>
```

### Filter by Category
```html
<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID&category=games"
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>
```

---

## 📈 Monitor Performance

### View Analytics
1. Go to Dashboard
2. Click "Analytics"
3. Select your Placement ID
4. See real-time metrics

### Key Metrics
- **Impressions**: How many times offerwall loaded
- **Clicks**: How many offers were clicked
- **CTR**: Click-Through Rate (clicks/impressions)
- **Conversions**: How many offers completed
- **Earnings**: Total money earned
- **EPC**: Earnings Per Click

---

## 🚨 Troubleshooting

### Iframe Not Loading?
```
✓ Check placement_id is correct
✓ Check user_id is provided
✓ Check backend is running
✓ Check browser console for errors
```

### No Tracking Data?
```
✓ Wait 30 seconds for data to sync
✓ Check database collections exist
✓ Verify API endpoints are accessible
✓ Check browser network tab
```

### Low CTR?
```
✓ Ensure offers are relevant
✓ Check offer images load
✓ Verify reward amounts are attractive
✓ Test on different devices
```

---

## 💡 Pro Tips

1. **Use Descriptive User IDs** - Makes debugging easier
2. **Add Sub IDs** - Track campaigns separately
3. **Test on Mobile** - Most traffic is mobile
4. **Monitor CTR** - Aim for 5-15% CTR
5. **Check Fraud Flags** - Review suspicious activity

---

## 🎯 Next Steps

1. ✅ Embed iframe
2. ✅ Test with real user
3. ✅ Monitor analytics
4. ✅ Optimize placement
5. ✅ Scale to more placements

---

## 📞 Need Help?

Check the full documentation:
- `OFFERWALL_IMPLEMENTATION_SUMMARY.md` - Complete guide
- `src/pages/AscendIframe.jsx` - Integration examples
- Backend API docs - Endpoint details

---

## 🎉 You're All Set!

Your offerwall is now live and earning. Monitor your analytics and optimize for maximum revenue!
