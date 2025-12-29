# Gift Card API Reference

## 📡 **Base URL**
```
http://localhost:5000/api
```

---

## 🔐 **Authentication**
All endpoints require authentication token in header:
```
Authorization: Bearer <token>
```

---

## 📋 **Admin Endpoints**

### **1. Create Gift Card**
```http
POST /admin/gift-cards
```

**Request Body:**
```json
{
  "name": "Holiday Bonus",
  "description": "Special holiday gift for our users",
  "amount": 100,
  "max_redemptions": 15,
  "image_url": "https://example.com/gift-card.jpg",
  "expiry_date": "2025-12-31T23:59:59Z",
  "send_to_all": true,
  "excluded_users": ["675e1234...", "675e5678..."],
  "code": "CUSTOM123",  // Optional
  "send_email": true
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Gift card created successfully! First 15 users can redeem.",
  "gift_card": {
    "_id": "675e9abc...",
    "code": "GIFT12345678",
    "name": "Holiday Bonus",
    "amount": 100,
    "max_redemptions": 15,
    "redemption_count": 0,
    "status": "active",
    "email_status": "sent"
  }
}
```

---

### **2. Get All Gift Cards**
```http
GET /admin/gift-cards?skip=0&limit=20&status=active
```

**Query Parameters:**
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Number of records to return (default: 20)
- `status` (optional): Filter by status (active, expired, cancelled, fully_redeemed)

**Response (200):**
```json
{
  "success": true,
  "gift_cards": [
    {
      "_id": "675e9abc...",
      "code": "GIFT12345678",
      "name": "Holiday Bonus",
      "amount": 100,
      "max_redemptions": 15,
      "redemption_count": 5,
      "status": "active",
      "expiry_date": "2025-12-31T23:59:59Z",
      "created_at": "2025-12-19T10:00:00Z"
    }
  ],
  "total": 10,
  "skip": 0,
  "limit": 20
}
```

---

### **3. Send Gift Card Emails**
```http
POST /admin/gift-cards/{gift_card_id}/send-email
```

**Request Body:**
```json
{
  "user_ids": ["675e1234...", "675e5678..."]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Gift card emails sent to 2 users"
}
```

---

### **4. Cancel Gift Card**
```http
POST /admin/gift-cards/{gift_card_id}/cancel
```

**Response (200):**
```json
{
  "success": true,
  "message": "Gift card cancelled successfully"
}
```

---

## 👤 **User Endpoints**

### **1. Redeem Gift Card**
```http
POST /publisher/gift-cards/redeem
```

**Request Body:**
```json
{
  "code": "GIFT12345678"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "🎉 Congratulations! You redeemed $100.00! You were #5 out of 15 lucky users!",
  "amount": 100,
  "new_balance": 250,
  "gift_card_name": "Holiday Bonus",
  "redemption_number": 5,
  "max_redemptions": 15
}
```

**Error Responses:**

**Already Redeemed (400):**
```json
{
  "success": false,
  "error": "You have already redeemed this gift card"
}
```

**Fully Redeemed (400):**
```json
{
  "success": false,
  "error": "Sorry! This gift card has been fully redeemed (limit: 15 users)"
}
```

**Expired (400):**
```json
{
  "success": false,
  "error": "Gift card has expired"
}
```

**Not Found (400):**
```json
{
  "success": false,
  "error": "Gift card not found"
}
```

---

### **2. Get Available Gift Cards**
```http
GET /publisher/gift-cards
```

**Response (200):**
```json
{
  "success": true,
  "gift_cards": [
    {
      "_id": "675e9abc...",
      "code": "GIFT12345678",
      "name": "Holiday Bonus",
      "amount": 100,
      "max_redemptions": 15,
      "redemption_count": 5,
      "remaining_redemptions": 10,
      "status": "active",
      "expiry_date": "2025-12-31T23:59:59Z",
      "image_url": "https://...",
      "is_redeemed": false
    },
    {
      "_id": "675edef0...",
      "code": "GIFT87654321",
      "name": "VIP Bonus",
      "amount": 50,
      "max_redemptions": 10,
      "redemption_count": 10,
      "remaining_redemptions": 0,
      "status": "fully_redeemed",
      "is_redeemed": true
    }
  ]
}
```

---

### **3. Get Redemption History**
```http
GET /publisher/gift-cards/history
```

**Response (200):**
```json
{
  "success": true,
  "history": [
    {
      "_id": "675f1234...",
      "code": "GIFT12345678",
      "amount": 100,
      "redeemed_at": "2025-12-19T10:30:00Z",
      "redemption_number": 5,
      "status": "credited"
    },
    {
      "_id": "675f5678...",
      "code": "GIFT87654321",
      "amount": 50,
      "redeemed_at": "2025-12-18T15:20:00Z",
      "redemption_number": 8,
      "status": "credited"
    }
  ],
  "total_redeemed": 2
}
```

---

### **4. Get User Balance**
```http
GET /publisher/balance
```

**Response (200):**
```json
{
  "success": true,
  "balance": 250
}
```

---

## 🔄 **Gift Card Status Flow**

```
active → fully_redeemed (when max_redemptions reached)
active → expired (when expiry_date passed)
active → cancelled (admin action)
```

---

## 📊 **Field Descriptions**

### **Gift Card Object**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique identifier |
| `code` | String | Gift card code (e.g., GIFT12345678) |
| `name` | String | Gift card name |
| `description` | String | Optional description |
| `amount` | Number | Credit amount in dollars |
| `max_redemptions` | Number | Maximum number of users who can redeem |
| `redemption_count` | Number | Current number of redemptions |
| `remaining_redemptions` | Number | Slots remaining (max - count) |
| `image_url` | String | Gift card image URL |
| `expiry_date` | ISO Date | When the gift card expires |
| `send_to_all` | Boolean | Whether to send to all users |
| `excluded_users` | Array | User IDs excluded from email |
| `redeemed_by` | Array | User IDs who redeemed |
| `status` | String | active, expired, cancelled, fully_redeemed |
| `created_at` | ISO Date | Creation timestamp |
| `is_redeemed` | Boolean | Whether current user redeemed (user view only) |

### **Redemption Object**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique identifier |
| `user_id` | String | User who redeemed |
| `gift_card_id` | String | Gift card ID |
| `code` | String | Gift card code |
| `amount` | Number | Amount credited |
| `redeemed_at` | ISO Date | Redemption timestamp |
| `redemption_number` | Number | User's position (1st, 2nd, 3rd...) |
| `status` | String | credited |

---

## ⚠️ **Error Codes**

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Not admin (for admin endpoints) |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Server-side error |

---

## 🎯 **Common Use Cases**

### **Use Case 1: Create and Send Gift Card to All Users**
```bash
curl -X POST http://localhost:5000/api/admin/gift-cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Bonus",
    "amount": 25,
    "max_redemptions": 100,
    "expiry_date": "2025-12-31T23:59:59Z",
    "send_to_all": true,
    "excluded_users": [],
    "send_email": true
  }'
```

### **Use Case 2: Create VIP Gift Card for Specific Users**
```bash
curl -X POST http://localhost:5000/api/admin/gift-cards \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Exclusive",
    "amount": 500,
    "max_redemptions": 5,
    "expiry_date": "2025-12-31T23:59:59Z",
    "send_to_all": false,
    "send_email": true
  }'
```

### **Use Case 3: User Redeems Gift Card**
```bash
curl -X POST http://localhost:5000/api/publisher/gift-cards/redeem \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "GIFT12345678"
  }'
```

---

## 📝 **Notes**

1. **Codes are case-insensitive**: `gift123` = `GIFT123`
2. **Auto-generated codes**: Format is `GIFT` + 8 random alphanumeric characters
3. **Expiry dates**: Must be in ISO 8601 format with timezone
4. **Max redemptions**: Must be > 0
5. **Amount**: Must be > 0
6. **Email sending**: Asynchronous, doesn't block gift card creation
7. **Balance updates**: Atomic, prevents race conditions

---

**API Version:** 1.0  
**Last Updated:** 2025-12-19
