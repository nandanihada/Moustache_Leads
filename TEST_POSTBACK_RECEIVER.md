# 🧪 Test Postback Receiver - Quick Guide

## ✅ System is Deployed!

The postback receiver is now live at:
```
https://moustacheleads-backend.onrender.com/postback/{unique_key}
```

---

## 🚀 Quick Test (5 minutes)

### Step 1: Generate Unique Key for PepperAds

Open browser console (F12) on your admin panel and run:

```javascript
// Generate unique postback URL for pepperAds
fetch('https://moustacheleads-backend.onrender.com/api/admin/postback-receiver/generate-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ partner_id: 'test_partner_001' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ SUCCESS!');
  console.log('📋 Unique Key:', data.unique_key);
  console.log('🔗 Postback URL:', data.postback_url);
  console.log('\n📝 Copy this URL and save it!');
  
  // Save to variable for next step
  window.postbackUrl = data.postback_url;
  window.uniqueKey = data.unique_key;
})
.catch(e => console.error('❌ Error:', e));
```

**Expected Output:**
```
✅ SUCCESS!
📋 Unique Key: abc123xyz456789...
🔗 Postback URL: https://moustacheleads-backend.onrender.com/postback/abc123xyz456789
```

---

### Step 2: Send Test Postback

Now send a test postback with parameters:

```javascript
// Send test postback (use the URL from Step 1)
const testParams = {
  username: 'john_doe',
  status: 'approved',
  payout: '10.50',
  transaction_id: 'txn_' + Date.now(),
  offer_id: 'ML-00050',
  click_id: 'click_' + Date.now()
};

const queryString = new URLSearchParams(testParams).toString();
const testUrl = window.postbackUrl + '?' + queryString;

console.log('📤 Sending test postback to:', testUrl);

fetch(testUrl)
.then(r => r.json())
.then(data => {
  console.log('✅ Postback received!');
  console.log('📄 Response:', data);
  console.log('🆔 Log ID:', data.log_id);
  
  window.logId = data.log_id;
})
.catch(e => console.error('❌ Error:', e));
```

**Expected Output:**
```
✅ Postback received!
📄 Response: {status: "success", message: "Postback received", log_id: "..."}
🆔 Log ID: 67890abcdef...
```

---

### Step 3: View Received Postbacks

Check if your postback was logged:

```javascript
// View all received postbacks
fetch('https://moustacheleads-backend.onrender.com/api/admin/received-postbacks', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('📥 Received Postbacks:');
  console.log('📊 Total:', data.total);
  console.log('📋 Logs:', data.logs);
  
  // Show latest postback details
  if (data.logs.length > 0) {
    const latest = data.logs[0];
    console.log('\n🎯 Latest Postback:');
    console.log('   Partner:', latest.partner_name);
    console.log('   Method:', latest.method);
    console.log('   Parameters:', latest.query_params);
    console.log('   IP:', latest.ip_address);
    console.log('   Time:', latest.timestamp);
  }
})
.catch(e => console.error('❌ Error:', e));
```

**Expected Output:**
```
📥 Received Postbacks:
📊 Total: 1
📋 Logs: [{...}]

🎯 Latest Postback:
   Partner: Unknown Partner (or PepperAds if key was generated for it)
   Method: GET
   Parameters: {username: "john_doe", status: "approved", payout: "10.50", ...}
   IP: 1.2.3.4
   Time: 2025-10-24T10:30:00Z
```

---

## ✅ Success Criteria

You know it's working when:

1. ✅ Step 1 returns a unique_key and postback_url
2. ✅ Step 2 returns `{status: "success"}`
3. ✅ Step 3 shows your postback in the logs
4. ✅ All parameters are captured correctly

---

## 🎯 Real-World Usage

### For PepperAds (or any partner):

1. **Generate their unique URL:**
   ```
   https://moustacheleads-backend.onrender.com/postback/abc123xyz456
   ```

2. **Give them this URL with parameters:**
   ```
   https://moustacheleads-backend.onrender.com/postback/abc123xyz456?username={username}&status={status}&payout={payout}&transaction_id={transaction_id}
   ```

3. **They send postbacks when users complete offers**

4. **You receive and log everything**

5. **View logs to verify conversions**

---

## 📋 All-in-One Test Script

Copy and paste this entire script:

```javascript
// Complete Postback Receiver Test
console.log('🧪 Starting Postback Receiver Test...\n');

// Step 1: Generate Key
fetch('https://moustacheleads-backend.onrender.com/api/admin/postback-receiver/generate-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ partner_id: 'test_partner_001' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Step 1: Generated URL');
  console.log('   URL:', data.postback_url);
  
  // Step 2: Send Test Postback
  const testUrl = data.postback_url + '?username=test&status=approved&payout=5.00&txn_id=test_' + Date.now();
  
  return fetch(testUrl).then(r => r.json()).then(result => {
    console.log('\n✅ Step 2: Sent test postback');
    console.log('   Log ID:', result.log_id);
    
    // Step 3: View Logs
    return fetch('https://moustacheleads-backend.onrender.com/api/admin/received-postbacks', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
  });
})
.then(r => r.json())
.then(data => {
  console.log('\n✅ Step 3: Retrieved logs');
  console.log('   Total postbacks:', data.total);
  if (data.logs.length > 0) {
    console.log('   Latest:', data.logs[0].query_params);
  }
  console.log('\n🎉 TEST COMPLETE! All systems working!');
})
.catch(e => console.error('\n❌ Test failed:', e));
```

---

## 🎉 What's Next?

After successful test:

1. ✅ Generate unique URL for pepperAds
2. ✅ Update pepperAds partner with this URL
3. ✅ Give URL to your manager
4. ✅ They can send test postbacks
5. ✅ You can view all received postbacks

**Your postback receiver is ready for production!** 🚀
