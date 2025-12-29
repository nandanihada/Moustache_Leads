# 🎭 Automatic Link Masking - Setup & Usage Guide

## Overview
The system now **automatically generates masked tracking links** whenever you create a new offer. This ensures that users only see your branded tracking domain instead of the raw advertiser URLs.

---

## 🚀 Quick Setup (First Time Only)

### Step 1: Create a Masking Domain

Before creating offers, you need at least one masking domain configured.

#### Option A: Using the Setup Script (Recommended)
```bash
cd backend
python setup_masking_domain.py
```

**⚠️ IMPORTANT:** Edit `setup_masking_domain.py` first and change the domain from `track.yourdomain.com` to your actual tracking domain.

#### Option B: Using the Admin Panel
1. Log in as admin
2. Go to **Offers Management**
3. Click **"Manage Domains"** button
4. Click **"Add Domain"**
5. Enter your tracking domain details:
   - **Domain:** `track.yourdomain.com` (your actual domain)
   - **Name:** A friendly name like "Main Tracking Domain"
   - **Description:** Optional description
   - **SSL Enabled:** ✅ (recommended)
   - **Status:** Active

---

## 🎯 How It Works

### When You Create an Offer

1. **You enter the target URL:** `https://advertiser.com/offer?aff=123`
2. **System automatically:**
   - Creates a masked link: `https://track.yourdomain.com/Ab12Cd34`
   - Stores both URLs in the database
   - Links them together for tracking

3. **Users see:** `https://track.yourdomain.com/Ab12Cd34`
4. **When clicked:** Redirects to the real target URL

### Masking Settings (Auto-Applied)

The system uses these default settings for auto-generated links:
- **Redirect Type:** 302 (Temporary)
- **Code Length:** 8 characters
- **SubID Passing:** ✅ Enabled
- **Preview Mode:** ❌ Disabled
- **Auto Rotation:** ❌ Disabled

---

## 📊 Where Masked Links Appear

### 1. Offer Details Modal
When users click "View Details" on an offer, they see the masked link automatically.

### 2. API Responses
All offer data returned includes:
```json
{
  "offer_id": "ML-00001",
  "name": "Example Offer",
  "target_url": "https://advertiser.com/offer?aff=123",
  "masked_url": "https://track.yourdomain.com/Ab12Cd34",
  "masked_link_id": "507f1f77bcf86cd799439011"
}
```

### 3. User Dashboard
Users see the masked URL as their tracking link, not the raw target URL.

---

## 🔧 Advanced Features

### Creating Additional Masked Links
Even though offers get automatic masked links, you can create more:

1. Go to Offers Management
2. Click the "⋮" menu on any offer
3. Select **"Create Masked Link"**
4. Configure custom settings:
   - Custom short code
   - Different redirect type
   - URL rotation
   - Preview mode

### Manual Link Creation
If automatic masking fails (e.g., no domains configured), you can:
1. Add a masking domain first
2. Manually create a masked link for the offer
3. The system will associate it with the offer

---

## 🛠️ Database Schema

### Offers Collection
```javascript
{
  offer_id: "ML-00001",
  target_url: "https://advertiser.com/offer",
  masked_url: "https://track.yourdomain.com/Ab12Cd34",  // NEW
  masked_link_id: "507f1f77bcf86cd799439011",           // NEW
  // ... other fields
}
```

### Masked Links Collection
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  offer_id: "ML-00001",
  short_code: "Ab12Cd34",
  target_url: "https://advertiser.com/offer",
  domain_name: "track.yourdomain.com",
  masked_url: "https://track.yourdomain.com/Ab12Cd34",
  click_count: 0,
  status: "active"
}
```

---

## 🔍 Tracking & Analytics

### Automatic Click Tracking
When someone clicks a masked link:
1. System logs the click (IP, user agent, referrer)
2. Increments click counter
3. Tracks SubID parameters if present
4. Redirects to target URL

### SubID Parameter Passing
If the masked link is called with SubID parameters:
```
https://track.yourdomain.com/Ab12Cd34?subid=xyz123
```

They are automatically appended to the target URL:
```
https://advertiser.com/offer?aff=123&subid=xyz123
```

Supported parameters: `subid`, `s1`, `clickid`

---

## ⚙️ Configuration Options

### Masking Domain Settings
- **Domain:** Your tracking domain (DNS must point to your server)
- **SSL:** Enable for HTTPS (recommended)
- **Default Redirect Type:** 301 (permanent) or 302 (temporary)
- **Priority:** If multiple domains exist, lower numbers are chosen first
- **Status:** Active/Inactive

### Link Settings (When Creating Manually)
- **Custom Short Code:** Use your own code instead of random
- **Code Length:** 6, 8, 10, or 12 characters
- **Redirect Type:** 301, 302, or 307
- **SubID Append:** Auto-pass tracking parameters
- **Preview Mode:** Show link details instead of redirecting (for testing)
- **Auto Rotation:** Rotate between multiple destination URLs

---

## 🚨 Troubleshooting

### No Masked Link Created
**Symptom:** Offer created but `masked_url` is empty

**Solutions:**
1. Check if masking domain exists:
   ```bash
   python -c "from models.link_masking import LinkMasking; print(LinkMasking().get_masking_domains())"
   ```
2. Create a domain using `setup_masking_domain.py`
3. Check backend logs for errors

### Masked Link Not Working
**Symptom:** 404 error when clicking masked link

**Solutions:**
1. Verify domain DNS points to your server
2. Check nginx/apache configuration
3. Ensure the link status is "active"
4. Check the route is registered in `app.py`

### Wrong Domain Used
**Symptom:** System uses unexpected domain

**Solutions:**
1. Check domain priorities (lower number = higher priority)
2. Verify domain status is "active"
3. Only active domains with `status: 'active'` are used

---

## 📝 Example Usage Flow

### Creating an Offer with Auto-Masking

```javascript
// Admin creates offer via UI or API
const offerData = {
  campaign_id: "CAMP123",
  name: "Finance Offer - US",
  target_url: "https://advertiser.com/campaign/123?aff=mynetwork",
  payout: 15.00,
  network: "AdvertiserNetwork",
  countries: ["US"],
  device_targeting: "all",
  affiliates: "all"
};

// POST /api/admin/offers
// Response includes:
{
  "message": "Offer created successfully",
  "offer": {
    "offer_id": "ML-00001",
    "target_url": "https://advertiser.com/campaign/123?aff=mynetwork",
    "masked_url": "https://track.yourdomain.com/A7bK9mXz",  // ✨ AUTO-GENERATED
    "masked_link_id": "507f1f77bcf86cd799439011",
    // ... other fields
  }
}
```

### User Gets the Offer

```javascript
// User fetches available offers
// GET /api/offers

// Response shows masked URL:
{
  "offers": [{
    "offer_id": "ML-00001",
    "name": "Finance Offer - US",
    "tracking_link": "https://track.yourdomain.com/A7bK9mXz",  // They see this
    "payout": 15.00
  }]
}
```

### Click & Redirect Flow

```
User clicks: https://track.yourdomain.com/A7bK9mXz?subid=user123

↓ System logs click
↓ Increments counter
↓ Appends SubID

Redirects to: https://advertiser.com/campaign/123?aff=mynetwork&subid=user123
```

---

## 🎨 Benefits

✅ **Brand Protection:** Users see your domain, not advertiser domains  
✅ **Tracking Control:** Full analytics on all clicks  
✅ **Easy Management:** Automatic generation, no manual work  
✅ **Flexible:** Can create additional custom masked links anytime  
✅ **Secure:** SSL support, parameter passing, rotation capabilities  
✅ **Scalable:** Multiple domains, unlimited masked links  

---

## 🔐 Security Notes

1. **Use HTTPS:** Always enable SSL on your masking domains
2. **Domain Verification:** Ensure DNS is properly configured before activating
3. **Rate Limiting:** Consider adding rate limits to prevent abuse
4. **Monitoring:** Check click analytics for suspicious patterns
5. **Regular Audits:** Review masked links periodically

---

## 📞 Support

If you encounter issues:
1. Check backend logs: `tail -f logs/app.log`
2. Verify database connection
3. Ensure masking domain is properly configured
4. Test with a simple offer creation

---

**Last Updated:** 2024
**Feature Status:** ✅ Production Ready
