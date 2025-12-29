# 🔒 Preview URL Security & Default Settings

## ✅ Changes Implemented

### **1. Default Preview URL** 
**File:** `backend/utils/bulk_offer_upload.py`

**Change:**
- Set default `preview_url` to `https://www.google.com` if not provided in spreadsheet
- Previously: Empty string (would fall back to target URL)
- Now: Always defaults to Google

```python
DEFAULT_VALUES = {
    'preview_url': 'https://www.google.com',  # Default preview URL if not provided
    ...
}
```

### **2. Preview Page Redirect**
**File:** `backend/routes/preview_handler.py`

**Changes:**
- Preview page **always redirects to Google** after 8 seconds
- **Never exposes the actual target URL** in the preview
- Maintains geo-restriction status display (allowed/denied)

**Before:**
```python
if access_check['allowed']:
    redirect_url = offer.get('target_url')  # ❌ Exposed actual URL
else:
    redirect_url = offer.get('non_access_url')  # ❌ Exposed fallback URL
```

**After:**
```python
# Always redirect to Google - prevents URL exposure
redirect_url = 'https://www.google.com'  # ✅ Secure
```

---

## 🎯 How It Works Now

### **Bulk Upload Behavior:**

When you upload offers via spreadsheet:

| Spreadsheet Column | Value Provided | Result |
|-------------------|----------------|--------|
| `preview_url` | ✅ Yes (e.g., "https://example.com") | Uses provided URL |
| `preview_url` | ❌ No (empty/missing) | Defaults to `https://www.google.com` |

### **Preview Page Flow:**

1. **User clicks "Preview Landing Page"** button
2. **Preview page loads** with:
   - Offer name and ID
   - Geo-restriction status (allowed/denied based on country)
   - 8-second countdown timer
   - Progress bar animation
3. **After 8 seconds** → Redirects to `https://www.google.com`
4. **User can skip** → Click "Skip Wait & Continue" to go immediately

### **Security Benefits:**

✅ **Target URL never exposed** in preview  
✅ **Non-access URL never exposed** in preview  
✅ **Consistent redirect** for all users (Google)  
✅ **Geo-restriction status** still displayed (for testing)  

---

## 📊 Example Scenarios

### **Scenario 1: Spreadsheet with preview_url**
```
Spreadsheet:
- offer_id: 75998
- title: "Hulu Subscription"
- preview_url: "https://custom-landing.com"
- target_url: "https://secret-offer.com/track?id=123"

Result:
✅ Preview URL: https://custom-landing.com
✅ After 8 seconds: Redirects to https://www.google.com
❌ Target URL never shown: https://secret-offer.com/track?id=123
```

### **Scenario 2: Spreadsheet without preview_url**
```
Spreadsheet:
- offer_id: 75995
- title: "Prime Crisp"
- preview_url: (empty)
- target_url: "https://secret-offer.com/track?id=456"

Result:
✅ Preview URL: https://www.google.com (default)
✅ After 8 seconds: Redirects to https://www.google.com
❌ Target URL never shown: https://secret-offer.com/track?id=456
```

---

## 🔍 Preview Page Features

The preview page includes:

1. **Visual Design:**
   - Purple gradient background
   - Animated countdown timer (72px font)
   - Progress bar showing time remaining
   - Responsive design (mobile-friendly)

2. **Information Displayed:**
   - ✅ Offer name
   - ✅ Offer ID
   - ✅ Geo-restriction status
   - ✅ Country name and code
   - ❌ Target URL (hidden for security)

3. **User Actions:**
   - Wait 8 seconds for auto-redirect
   - Click "Skip Wait & Continue" for immediate redirect
   - Both actions → Go to Google

---

## 🎨 Preview Page Screenshot

The preview page shows:
```
┌─────────────────────────────────────┐
│           ⏱️ (animated)              │
│        Offer Preview                │
│  You're about to be redirected      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Hulu Subscription          │  │
│  │   Offer ID: ML-00203         │  │
│  │                              │  │
│  │  ✅ Access granted from      │  │
│  │     United States (US)       │  │
│  └──────────────────────────────┘  │
│                                     │
│      Redirecting in                 │
│           8                         │
│  [████████████░░░░░░░░░░]          │
│                                     │
│  [Skip Wait & Continue →]          │
│                                     │
│  ✅ You will be redirected to      │
│     the offer page                  │
└─────────────────────────────────────┘
```

---

## ✨ Benefits

1. **Security:** Target URLs are never exposed in preview mode
2. **Privacy:** Users can't see the actual tracking URLs
3. **Consistency:** All previews redirect to the same safe destination
4. **User Experience:** 8-second countdown gives time to review offer details
5. **Flexibility:** Users can skip the wait if needed

---

**Status: ✅ IMPLEMENTED AND READY**

All preview pages now:
- Default to Google if no preview_url provided
- Redirect to Google after 8 seconds
- Never expose actual target URLs
