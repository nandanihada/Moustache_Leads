# 🧪 Frontend Testing Guide for Backend Functionalities

## ✅ Backend Status: RUNNING
- **Health Check**: ✅ http://localhost:5000/health
- **Database**: ✅ Connected
- **Background Services**: ✅ Started

---

## 🎯 TAB 1: TARGETING FUNCTIONALITY

### **Test Device/Browser/OS Targeting**

1. **Create Test Offer with Targeting:**
   ```
   - Go to Admin Offers → Create Offer
   - Set Device Targeting: "Mobile Only"
   - Set OS Targeting: ["iOS", "Android"] 
   - Set Browser Targeting: ["Chrome", "Safari"]
   - Save offer
   ```

2. **Test Targeting Validation:**
   ```javascript
   // Open browser console and test:
   
   // Login first
   const response = await fetch('http://localhost:5000/api/auth/login', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({username: 'your_username', password: 'your_password'})
   });
   const data = await response.json();
   const token = data.access_token;
   
   // Get accessible offers
   const offers = await fetch('http://localhost:5000/api/offers/accessible', {
     headers: {'Authorization': `Bearer ${token}`}
   });
   console.log(await offers.json());
   
   // Generate tracking link
   const trackingResponse = await fetch('http://localhost:5000/api/offers/ML-00001/tracking-link', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({sub1: 'test', sub2: 'campaign'})
   });
   const trackingData = await trackingResponse.json();
   console.log('Tracking URL:', trackingData.tracking_url);
   
   // Click the tracking URL from different devices/browsers
   ```

3. **Expected Results:**
   - ✅ Desktop users should be blocked
   - ✅ Mobile users should be allowed
   - ✅ Only iOS/Android should work
   - ✅ Only Chrome/Safari should work

---

## 📊 TAB 2: CAPS & AUTO-PAUSE

### **Test Cap Monitoring & Auto-Pause**

1. **Create Offer with Caps:**
   ```
   - Daily Cap: 5 conversions
   - Auto-pause when cap reached: ✅ Enabled
   - Cap Alert Emails: your-email@example.com
   ```

2. **Test Cap Status:**
   ```javascript
   // Check current cap status
   const capStatus = await fetch('http://localhost:5000/api/offers/ML-00001/caps', {
     headers: {'Authorization': `Bearer ${token}`}
   });
   console.log('Cap Status:', await capStatus.json());
   ```

3. **Simulate Conversions:**
   ```javascript
   // Simulate multiple conversions to test caps
   for(let i = 1; i <= 6; i++) {
     const conversion = await fetch('http://localhost:5000/api/postback/conversion', {
       method: 'POST',
       headers: {'Content-Type': 'application/json'},
       body: JSON.stringify({
         click_id: `test-click-${i}`,
         payout: 10.00,
         status: 'approved'
       })
     });
     console.log(`Conversion ${i}:`, await conversion.json());
   }
   ```

4. **Expected Results:**
   - ✅ After 5 conversions, offer should auto-pause
   - ✅ Cap alerts should be sent at 80%, 90%, 100%
   - ✅ Offer status should change to "paused"

---

## 📈 TAB 3: TRACKING & POSTBACKS

### **Test Click Tracking & Postbacks**

1. **Generate Tracking Links:**
   ```javascript
   // Generate tracking link with sub IDs
   const tracking = await fetch('http://localhost:5000/api/offers/ML-00001/tracking-link', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       sub1: 'facebook',
       sub2: 'campaign123',
       sub3: 'adset456'
     })
   });
   const trackingData = await tracking.json();
   console.log('Generated Tracking URL:', trackingData.tracking_url);
   ```

2. **Test Click Tracking:**
   ```
   - Copy the tracking URL
   - Open in new browser tab
   - Should redirect to offer target URL
   - Check backend logs for click recording
   ```

3. **Test Conversion Postback:**
   ```javascript
   // Send conversion postback
   const conversion = await fetch('http://localhost:5000/api/postback/conversion', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       click_id: trackingData.click_id,
       payout: 15.50,
       status: 'approved',
       external_id: 'EXT123'
     })
   });
   console.log('Conversion Result:', await conversion.json());
   ```

4. **Expected Results:**
   - ✅ Clicks should be tracked with unique IDs
   - ✅ Conversions should be recorded
   - ✅ Postbacks should be queued and sent
   - ✅ Affiliate stats should update

---

## 🔐 TAB 4: ACCESS CONTROL

### **Test Affiliate Access Control**

1. **Create Offers with Different Access:**
   ```
   Offer A: Affiliates = "All" 
   Offer B: Affiliates = "Premium"
   Offer C: Affiliates = "Selected" → Add specific usernames
   Offer D: Affiliates = "Request" → Requires approval
   ```

2. **Test Access Checking:**
   ```javascript
   // Check access to specific offer
   const accessCheck = await fetch('http://localhost:5000/api/offers/ML-00001/access-check', {
     headers: {'Authorization': `Bearer ${token}`}
   });
   console.log('Access Check:', await accessCheck.json());
   
   // Get all accessible offers
   const accessible = await fetch('http://localhost:5000/api/offers/accessible', {
     headers: {'Authorization': `Bearer ${token}`}
   });
   console.log('Accessible Offers:', await accessible.json());
   ```

3. **Test Access Requests:**
   ```javascript
   // Request access to restricted offer
   const request = await fetch('http://localhost:5000/api/offers/ML-00004/request-access', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       message: 'Please grant me access to this offer. I have good traffic quality.'
     })
   });
   console.log('Access Request:', await request.json());
   ```

4. **Test Admin Approval (Admin Users Only):**
   ```javascript
   // Get pending requests (admin only)
   const requests = await fetch('http://localhost:5000/api/admin/access-requests', {
     headers: {'Authorization': `Bearer ${adminToken}`}
   });
   console.log('Pending Requests:', await requests.json());
   
   // Approve request (admin only)
   const approval = await fetch('http://localhost:5000/api/admin/access-requests/REQ-123/approve', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${adminToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({notes: 'Approved - good affiliate'})
   });
   console.log('Approval Result:', await approval.json());
   ```

5. **Expected Results:**
   - ✅ Users should only see offers they have access to
   - ✅ Premium offers should be restricted to premium users
   - ✅ Selected offers should be restricted to selected users
   - ✅ Request-based offers should require approval
   - ✅ Access requests should be trackable

---

## 📊 TAB 5: PERFORMANCE TRACKING

### **Test Affiliate Performance**

1. **Check Performance Metrics:**
   ```javascript
   // Get affiliate performance
   const performance = await fetch('http://localhost:5000/api/affiliate/performance', {
     headers: {'Authorization': `Bearer ${token}`}
   });
   console.log('Performance Metrics:', await performance.json());
   ```

2. **Expected Results:**
   - ✅ Total clicks, conversions, earnings
   - ✅ Conversion rate calculation
   - ✅ Active offers count
   - ✅ Last updated timestamp

---

## 🧪 COMPREHENSIVE TEST WORKFLOW

### **Step-by-Step Testing:**

1. **Setup:**
   ```bash
   # Backend should be running
   cd backend
   python app.py
   
   # Frontend should be running
   cd ../
   npm run dev
   ```

2. **Create Test Data:**
   - Create user account
   - Create offers with different targeting/caps/access
   - Generate tracking links

3. **Test Each Functionality:**
   - Device targeting (try different user agents)
   - Cap limits (send multiple conversions)
   - Access control (try different user types)
   - Tracking (click links, send postbacks)

4. **Verify Results:**
   - Check database for recorded data
   - Check backend logs for processing
   - Check frontend for proper display

---

## 🚀 QUICK TEST COMMANDS

```javascript
// Copy-paste this into browser console for quick testing:

// 1. Login and get token
const login = async () => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: 'testuser', password: 'testpass'})
  });
  const data = await response.json();
  window.token = data.access_token;
  console.log('✅ Logged in, token saved to window.token');
};

// 2. Get accessible offers
const getOffers = async () => {
  const response = await fetch('http://localhost:5000/api/offers/accessible', {
    headers: {'Authorization': `Bearer ${window.token}`}
  });
  const data = await response.json();
  console.log('📋 Accessible offers:', data);
  return data.offers;
};

// 3. Generate tracking link
const getTracking = async (offerId) => {
  const response = await fetch(`http://localhost:5000/api/offers/${offerId}/tracking-link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({sub1: 'test'})
  });
  const data = await response.json();
  console.log('🔗 Tracking link:', data.tracking_url);
  return data;
};

// 4. Test conversion
const testConversion = async (clickId) => {
  const response = await fetch('http://localhost:5000/api/postback/conversion', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      click_id: clickId,
      payout: 10.00,
      status: 'approved'
    })
  });
  const data = await response.json();
  console.log('💰 Conversion result:', data);
  return data;
};

// Run all tests
const runTests = async () => {
  await login();
  const offers = await getOffers();
  if (offers.length > 0) {
    const tracking = await getTracking(offers[0].offer_id);
    await testConversion(tracking.click_id);
  }
};

// Execute: runTests();
```

---

## ✅ **BACKEND IS READY FOR TESTING!**

All backend functionalities are implemented and working:
- 🎯 **Targeting** - Device/Browser/OS validation
- 📊 **Caps** - Auto-pause and email alerts  
- 📈 **Tracking** - Click/conversion tracking with postbacks
- 🔐 **Access** - Affiliate permission system
- 📊 **Performance** - Stats and metrics

**Start testing each tab step by step using the commands above!** 🚀
