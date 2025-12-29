# 🚀 Gift Card System - Quick Start Guide

## ⚡ **Get Started in 5 Minutes**

### **Prerequisites:**
- ✅ Backend server running (`python app.py`)
- ✅ MongoDB connected
- ✅ Email service configured (SMTP credentials in `.env`)
- ✅ Admin account created

---

## 📝 **Step 1: Create Your First Gift Card**

### **Using cURL:**
```bash
curl -X POST http://localhost:5000/api/admin/gift-cards \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Bonus",
    "amount": 25,
    "max_redemptions": 10,
    "expiry_date": "2025-12-31T23:59:59Z",
    "send_to_all": true,
    "excluded_users": [],
    "send_email": true
  }'
```

### **Using Postman:**
1. Create new POST request
2. URL: `http://localhost:5000/api/admin/gift-cards`
3. Headers: 
   - `Authorization: Bearer YOUR_TOKEN`
   - `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "name": "Welcome Bonus",
  "amount": 25,
  "max_redemptions": 10,
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "send_email": true
}
```

### **Expected Response:**
```json
{
  "success": true,
  "message": "Gift card created successfully! First 10 users can redeem.",
  "gift_card": {
    "_id": "675e9abc...",
    "code": "GIFT12345678",
    "name": "Welcome Bonus",
    "amount": 25,
    "max_redemptions": 10,
    "status": "active"
  }
}
```

**✅ Copy the `code` value - you'll need it for testing!**

---

## 🎁 **Step 2: Redeem the Gift Card**

### **Using cURL:**
```bash
curl -X POST http://localhost:5000/api/publisher/gift-cards/redeem \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "GIFT12345678"
  }'
```

### **Expected Response:**
```json
{
  "success": true,
  "message": "🎉 Congratulations! You redeemed $25.00! You were #1 out of 10 lucky users!",
  "amount": 25,
  "new_balance": 25,
  "redemption_number": 1,
  "max_redemptions": 10
}
```

---

## 📊 **Step 3: Check Gift Card Status**

### **Get All Gift Cards (Admin):**
```bash
curl -X GET http://localhost:5000/api/admin/gift-cards \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### **Get Available Gift Cards (User):**
```bash
curl -X GET http://localhost:5000/api/publisher/gift-cards \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### **Check Your Balance:**
```bash
curl -X GET http://localhost:5000/api/publisher/balance \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

---

## 🧪 **Quick Testing Scenarios**

### **Test 1: Create and Redeem**
```bash
# 1. Create gift card
CODE=$(curl -X POST http://localhost:5000/api/admin/gift-cards \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","amount":50,"max_redemptions":5,"expiry_date":"2025-12-31T23:59:59Z"}' \
  | jq -r '.gift_card.code')

# 2. Redeem it
curl -X POST http://localhost:5000/api/publisher/gift-cards/redeem \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$CODE\"}"
```

### **Test 2: Max Redemptions**
```bash
# Create gift card with max_redemptions = 2
# Have 3 different users try to redeem
# 3rd user should get error
```

### **Test 3: Duplicate Redemption**
```bash
# Same user tries to redeem twice
# Should get error on 2nd attempt
```

---

## 🎨 **Frontend Integration Examples**

### **React - Create Gift Card Form:**
```jsx
import { useState } from 'react';

function CreateGiftCard() {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    max_redemptions: '',
    expiry_date: '',
    send_to_all: true,
    send_email: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/admin/gift-cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`Gift card created! Code: ${data.gift_card.code}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      <input 
        type="number"
        placeholder="Amount"
        value={formData.amount}
        onChange={(e) => setFormData({...formData, amount: e.target.value})}
      />
      <input 
        type="number"
        placeholder="Max Redemptions"
        value={formData.max_redemptions}
        onChange={(e) => setFormData({...formData, max_redemptions: e.target.value})}
      />
      <input 
        type="datetime-local"
        value={formData.expiry_date}
        onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
      />
      <button type="submit">Create Gift Card</button>
    </form>
  );
}
```

### **React - Redeem Gift Card:**
```jsx
import { useState } from 'react';

function RedeemGiftCard() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  const handleRedeem = async () => {
    const response = await fetch('/api/publisher/gift-cards/redeem', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Show celebration animation
      setMessage(data.message);
      // Update balance
      // Show confetti
    } else {
      setMessage(data.error);
    }
  };

  return (
    <div>
      <input 
        placeholder="Enter gift card code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <button onClick={handleRedeem}>Redeem</button>
      {message && <p>{message}</p>}
    </div>
  );
}
```

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: "Database connection not available"**
**Solution:** Check MongoDB is running and connection string in `.env`

### **Issue 2: "Unauthorized"**
**Solution:** Include valid JWT token in Authorization header

### **Issue 3: "Field 'max_redemptions' is required"**
**Solution:** Always include max_redemptions when creating gift card

### **Issue 4: Emails not sending**
**Solution:** 
1. Check SMTP credentials in `.env`
2. Verify email service is configured
3. Check logs for email errors

### **Issue 5: "Gift card not found"**
**Solution:** 
1. Verify code is correct (case-insensitive)
2. Check gift card exists in database
3. Ensure code hasn't been cancelled

---

## 📚 **Essential Endpoints Cheat Sheet**

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Create | POST | `/api/admin/gift-cards` | Admin |
| List All | GET | `/api/admin/gift-cards` | Admin |
| Redeem | POST | `/api/publisher/gift-cards/redeem` | User |
| My Cards | GET | `/api/publisher/gift-cards` | User |
| History | GET | `/api/publisher/gift-cards/history` | User |
| Balance | GET | `/api/publisher/balance` | User |

---

## 🎯 **Quick Validation Checklist**

Before creating a gift card, ensure:
- [ ] Name is not empty
- [ ] Amount > 0
- [ ] Max redemptions > 0
- [ ] Expiry date is in future
- [ ] Valid image URL (if provided)
- [ ] Excluded users are valid user IDs

Before redeeming:
- [ ] Code is not empty
- [ ] User is authenticated
- [ ] User hasn't already redeemed

---

## 💡 **Pro Tips**

1. **Testing Locally:**
   - Use Postman collections for quick testing
   - Create test gift cards with low max_redemptions (2-3)
   - Use short expiry dates for testing auto-expiry

2. **Email Testing:**
   - Use a test email service (Mailtrap, etc.)
   - Check spam folder if emails not received
   - Verify email template renders correctly

3. **Database Queries:**
   ```javascript
   // Check gift card status
   db.gift_cards.findOne({code: "GIFT12345678"})
   
   // Check redemptions
   db.gift_card_redemptions.find({gift_card_id: ObjectId("...")})
   
   // Check user balance
   db.users.findOne({_id: ObjectId("...")}, {balance: 1})
   ```

4. **Performance:**
   - Index the `code` field for faster lookups
   - Batch email sending for large user bases
   - Use pagination for gift card lists

---

## 🚀 **Next Steps**

1. **Read Full Documentation:**
   - `GIFT_CARD_API_REFERENCE.md` - Complete API docs
   - `GIFT_CARD_TESTING_GUIDE.md` - All test cases
   - `GIFT_CARD_VISUAL_FLOW.md` - Visual diagrams

2. **Build Frontend:**
   - Admin gift card creation form
   - User redemption page
   - Celebration animation
   - Gift card display components

3. **Test Thoroughly:**
   - All redemption scenarios
   - Email sending
   - Auto-deactivation
   - Edge cases

4. **Deploy:**
   - Review security settings
   - Configure production email service
   - Set up monitoring
   - Test in staging environment

---

## 📞 **Need Help?**

- **API Issues:** Check `GIFT_CARD_API_REFERENCE.md`
- **Testing:** See `GIFT_CARD_TESTING_GUIDE.md`
- **Requirements:** Read `GIFT_CARD_UPDATED_REQUIREMENTS.md`
- **Visual Flow:** View `GIFT_CARD_VISUAL_FLOW.md`

---

**Happy Coding! 🎉**

**Quick Start Version:** 1.0  
**Last Updated:** December 19, 2025
