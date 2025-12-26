# 🎬 Preview URL with Timed Redirect - Feature Documentation

## ✅ Feature Overview

The Preview URL feature provides a beautiful countdown page that shows users a preview of the offer before redirecting them. It includes:

- ⏱️ **8-second countdown timer** with visual progress bar
- 🌍 **Geo-restriction awareness** - respects country-based access control
- ↪️ **Smart redirects** - sends users to appropriate URLs based on their location
- 🎨 **Beautiful UI** - modern, responsive design with animations
- ⏭️ **Skip option** - users can skip the countdown and proceed immediately

---

## 🔗 URL Format

```
http://your-domain.com/preview/{offer_id}
```

**Example:**
```
http://localhost:5000/preview/ML-00135
```

---

## 🎯 How It Works

### **Step 1: User Access**
User clicks on or visits the preview URL

### **Step 2: Geo-Check**
System detects user's country from IP address

### **Step 3: Access Decision**
- ✅ **If country is allowed**: Prepare to redirect to target URL
- 🚫 **If country is blocked**: Prepare to redirect to non-access URL

### **Step 4: Preview Page**
Show beautiful countdown page with:
- Offer name and ID
- Country access status
- 8-second countdown timer
- Visual progress bar
- Skip button

### **Step 5: Auto-Redirect**
After 8 seconds (or when user clicks skip):
- ✅ **Allowed users** → Redirect to `target_url`
- 🚫 **Blocked users** → Redirect to `non_access_url`

---

## 📊 Preview Page Features

### **Visual Elements:**

1. **Countdown Timer**
   - Large, animated countdown (8 → 7 → 6... → 0)
   - Pulse animation on each second
   - Clear visual feedback

2. **Progress Bar**
   - Animated progress bar showing time remaining
   - Smooth linear animation
   - Gradient colors matching theme

3. **Offer Information**
   - Offer name
   - Offer ID
   - Country access status badge

4. **Access Status Badge**
   - 🟢 **Green** for allowed countries
   - 🔴 **Red** for blocked countries
   - Shows detected country name and code

5. **Skip Button**
   - Prominent "Skip Wait & Continue" button
   - Allows immediate redirect
   - Hover and click animations

---

## 🧪 Testing Guide

### **Test 1: Allowed Country (India)**

1. Set offer allowed_countries to `['IN']`
2. Access from Indian IP: `http://localhost:5000/preview/ML-00135`
3. **Expected Result:**
   - ✅ Green badge: "Access granted from India (IN)"
   - Countdown from 8 to 0
   - Redirect to target URL (e.g., Google)

### **Test 2: Blocked Country (US)**

1. Set offer allowed_countries to `['IN']`
2. Access from US VPN: `http://localhost:5000/preview/ML-00135`
3. **Expected Result:**
   - 🔴 Red badge: "Access restricted from United States (US)"
   - Countdown from 8 to 0
   - Redirect to non-access URL

### **Test 3: Skip Functionality**

1. Access preview URL
2. Click "Skip Wait & Continue" button
3. **Expected Result:**
   - Immediate redirect (no wait)
   - Countdown stops
   - Redirects to appropriate URL

### **Test 4: No Restrictions**

1. Set offer allowed_countries to `[]` (empty)
2. Access from any country
3. **Expected Result:**
   - ✅ Green badge: "Access granted"
   - Redirect to target URL

---

## 🎨 Preview Page Design

### **Desktop View:**
```
┌─────────────────────────────────────┐
│              ⏱️                      │
│         Offer Preview               │
│  You're about to be redirected...   │
│                                     │
│  ┌───────────────────────────────┐ │
│  │   US-Only Test Offer          │ │
│  │   Offer ID: ML-00135          │ │
│  │                               │ │
│  │  ✅ Access granted from IN    │ │
│  └───────────────────────────────┘ │
│                                     │
│        Redirecting in               │
│             8                       │
│  ████████████████░░░░░░░░░░░       │
│                                     │
│  [ Skip Wait & Continue → ]         │
│                                     │
│  ✅ You will be redirected to...   │
└─────────────────────────────────────┘
```

### **Mobile View:**
- Fully responsive
- Touch-friendly buttons
- Optimized font sizes
- Smooth animations

---

## 🔧 Configuration

### **Countdown Duration**
Default: 8 seconds

To change, modify in `preview_handler.py`:
```python
countdown_seconds=8  # Change this value
```

### **Redirect URLs**

**For Allowed Users:**
```python
redirect_url = offer.get('target_url')
```

**For Blocked Users:**
```python
redirect_url = offer.get('non_access_url') or 'https://www.example.com'
```

---

## 📝 Database Fields Used

| Field | Type | Purpose |
|-------|------|---------|
| `target_url` | String | Main offer URL (for allowed users) |
| `non_access_url` | String | Fallback URL (for blocked users) |
| `allowed_countries` | Array | List of allowed country codes |
| `name` | String | Offer name (shown on preview) |
| `offer_id` | String | Offer ID (shown on preview) |

---

## 🌍 Geo-Restriction Integration

The preview page **fully respects** geo-restrictions:

1. **IP Detection**: User's IP is detected from request
2. **Country Lookup**: IP is geolocated using IPInfo service
3. **Access Check**: Country is checked against `allowed_countries`
4. **Smart Redirect**: 
   - ✅ Allowed → `target_url`
   - 🚫 Blocked → `non_access_url`

---

## 🎯 Use Cases

### **Use Case 1: Soft Landing Page**
Show users a preview before sending them to the actual offer, giving them time to prepare or cancel.

### **Use Case 2: Geo-Aware Redirects**
Automatically route users to appropriate pages based on their location without showing error messages.

### **Use Case 3: Compliance**
Give users clear information about where they're being redirected and why.

### **Use Case 4: Branding**
Show your brand/offer information before redirect, improving trust.

---

## 🚀 API Endpoints

### **Preview Endpoint**
```
GET /preview/{offer_id}
```

**Parameters:**
- `offer_id` (path): Offer ID to preview

**Query Parameters (optional):**
- `subid`: Affiliate/publisher ID
- Any other tracking parameters

**Response:**
- HTML page with countdown timer
- Auto-redirects after 8 seconds

---

## 📊 Logging

The preview handler logs:

```
🔍 Preview for ML-00135: allowed - Access granted from India (IN)
🔍 Preview for ML-00135: denied - Access restricted from United States (US)
```

---

## ✅ Feature Checklist

- [x] Add Preview URL field in offer ✅ (Already exists)
- [x] Show default preview URL on open ✅
- [x] Implement 8-second countdown timer ✅
- [x] Auto-redirect after 8 seconds ✅
- [x] Redirect target = Non-Access URL (for blocked users) ✅
- [x] Ensure preview respects country restrictions ✅
- [x] Test redirect across devices ⏳ (Ready for testing)

---

## 🧪 Testing Commands

### **Test with curl:**

```bash
# Test preview with Indian IP
curl -H "X-Forwarded-For: 103.21.124.1" http://localhost:5000/preview/ML-00135

# Test preview with US IP
curl -H "X-Forwarded-For: 8.8.8.8" http://localhost:5000/preview/ML-00135
```

### **Test in Browser:**

```
http://localhost:5000/preview/ML-00135
```

---

## 🎉 Feature Complete!

The Preview URL with Timed Redirect feature is **fully implemented** and ready for testing!

**Next Steps:**
1. Test the preview URL in your browser
2. Test with different countries (VPN)
3. Test the skip functionality
4. Test on mobile devices
5. Verify geo-restrictions are working

**Enjoy your new feature!** 🚀
