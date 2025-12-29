# Placement Management API - Test Cases

## 🔐 **Authentication Setup**

First, obtain a JWT token by logging in:

### **Login Request**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "...",
    "username": "demo",
    "email": "demo@example.com"
  }
}
```

**Save the token for subsequent requests:**
```bash
export JWT_TOKEN="your_jwt_token_here"
```

---

## 📋 **Placement API Endpoints**

### **1. Create Placement**

**Endpoint:** `POST /api/placements/`

```bash
curl -X POST http://localhost:5000/api/placements/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "platformType": "website",
    "offerwallTitle": "My Test Offerwall",
    "currencyName": "Gold Coins",
    "exchangeRate": 1.5,
    "postbackUrl": "https://your-server.com/postback",
    "status": "LIVE"
  }'
```

**Expected Response:**
```json
{
  "id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "publisherId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "placementIdentifier": "Abc123Def456Ghi7",
  "platformType": "website",
  "offerwallTitle": "My Test Offerwall",
  "currencyName": "Gold Coins",
  "exchangeRate": 1.5,
  "postbackUrl": "https://your-server.com/postback",
  "status": "LIVE",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### **2. Get All Placements**

**Endpoint:** `GET /api/placements/`

```bash
# Basic request
curl -X GET http://localhost:5000/api/placements/ \
  -H "Authorization: Bearer $JWT_TOKEN"

# With pagination and filters
curl -X GET "http://localhost:5000/api/placements/?page=1&size=10&status_filter=LIVE&platform_filter=website" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:**
```json
{
  "placements": [
    {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "publisherId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "placementIdentifier": "Abc123Def456Ghi7",
      "platformType": "website",
      "offerwallTitle": "My Test Offerwall",
      "currencyName": "Gold Coins",
      "exchangeRate": 1.5,
      "postbackUrl": "https://your-server.com/postback",
      "status": "LIVE",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 10
}
```

### **3. Get Specific Placement**

**Endpoint:** `GET /api/placements/{placement_id}`

```bash
curl -X GET http://localhost:5000/api/placements/64f8a1b2c3d4e5f6a7b8c9d0 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### **4. Update Placement**

**Endpoint:** `PUT /api/placements/{placement_id}`

```bash
curl -X PUT http://localhost:5000/api/placements/64f8a1b2c3d4e5f6a7b8c9d0 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "offerwallTitle": "Updated Offerwall Title",
    "exchangeRate": 2.0,
    "status": "PAUSED"
  }'
```

### **5. Delete Placement (Soft Delete)**

**Endpoint:** `DELETE /api/placements/{placement_id}`

```bash
curl -X DELETE http://localhost:5000/api/placements/64f8a1b2c3d4e5f6a7b8c9d0 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:** `204 No Content`

### **6. Get Publisher Info**

**Endpoint:** `GET /api/placements/publisher/me`

```bash
curl -X GET http://localhost:5000/api/placements/publisher/me \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:**
```json
{
  "id": "64f8a1b2c3d4e5f6a7b8c9d1",
  "name": "demo",
  "contactEmail": "demo@example.com",
  "status": "active",
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### **7. Test Postback**

**Endpoint:** `POST /api/placements/test-postback`

```bash
curl -X POST http://localhost:5000/api/placements/test-postback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "placementIdentifier": "Abc123Def456Ghi7",
    "postbackUri": "https://your-server.com/postback",
    "userId": "test_user_123",
    "rewardValue": "100",
    "offerName": "Test Survey Offer",
    "offerId": "OFFER_001",
    "testStatus": "completed",
    "userIp": "192.168.1.100"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Postback sent. Server responded with status 200. Response: OK",
  "postback_data": {
    "user_id": "test_user_123",
    "reward_value": "100",
    "offer_name": "Test Survey Offer",
    "offer_id": "OFFER_001",
    "status": "completed",
    "user_ip": "192.168.1.100",
    "placement_id": "Abc123Def456Ghi7",
    "timestamp": 1705312200,
    "test_mode": true
  },
  "response_status": 200,
  "response_body": "OK"
}
```

---

## 🧪 **Postman Collection**

### **Collection Setup**

1. **Create Environment Variables:**
   - `base_url`: `http://localhost:5000`
   - `jwt_token`: (will be set after login)

2. **Pre-request Script for Authentication:**
```javascript
// Add this to requests that need authentication
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('jwt_token')
});
```

3. **Test Scripts:**

**For Login Request:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has token", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('token');
    pm.environment.set('jwt_token', jsonData.token);
});
```

**For Placement Creation:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Placement created with identifier", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('placementIdentifier');
    pm.environment.set('placement_id', jsonData.id);
    pm.environment.set('placement_identifier', jsonData.placementIdentifier);
});
```

---

## 🔍 **Error Testing**

### **Authentication Errors**

```bash
# Missing token
curl -X GET http://localhost:5000/api/placements/
# Expected: 401 Unauthorized

# Invalid token
curl -X GET http://localhost:5000/api/placements/ \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized
```

### **Validation Errors**

```bash
# Missing required fields
curl -X POST http://localhost:5000/api/placements/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "offerwallTitle": "Test"
  }'
# Expected: 400 Bad Request with validation errors

# Invalid exchange rate
curl -X POST http://localhost:5000/api/placements/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "platformType": "website",
    "offerwallTitle": "Test",
    "currencyName": "Coins",
    "exchangeRate": -1,
    "postbackUrl": "https://example.com"
  }'
# Expected: 400 Bad Request - "Exchange rate must be greater than 0"

# Invalid URL format
curl -X POST http://localhost:5000/api/placements/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "platformType": "website",
    "offerwallTitle": "Test",
    "currencyName": "Coins",
    "exchangeRate": 1.5,
    "postbackUrl": "invalid-url"
  }'
# Expected: 400 Bad Request - "Invalid postback URL format"
```

### **Status Toggle Testing**

```bash
# Test all valid statuses
for status in "LIVE" "PAUSED" "INACTIVE"; do
  curl -X PUT http://localhost:5000/api/placements/64f8a1b2c3d4e5f6a7b8c9d0 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{\"status\": \"$status\"}"
done

# Test invalid status
curl -X PUT http://localhost:5000/api/placements/64f8a1b2c3d4e5f6a7b8c9d0 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"status": "INVALID_STATUS"}'
# Expected: 400 Bad Request - "Status must be one of: LIVE, PAUSED, INACTIVE"
```

---

## 📊 **Performance Testing**

### **Load Testing with Multiple Placements**

```bash
# Create multiple placements
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/placements/ \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{
      \"platformType\": \"website\",
      \"offerwallTitle\": \"Test Placement $i\",
      \"currencyName\": \"Coins\",
      \"exchangeRate\": $i.5,
      \"postbackUrl\": \"https://example.com/postback$i\"
    }"
done

# Test pagination
curl -X GET "http://localhost:5000/api/placements/?page=1&size=5" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## 🔧 **Health Check**

```bash
# Check backend health
curl -X GET http://localhost:5000/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 📝 **Notes**

1. **Unique Identifiers:** Each placement gets a unique 16-character `placementIdentifier`
2. **Soft Deletes:** DELETE operations set status to 'INACTIVE' rather than removing records
3. **Owner Isolation:** Users can only access their own placements
4. **Validation:** All inputs are validated on both frontend and backend
5. **Error Handling:** Comprehensive error responses with clear messages
6. **Pagination:** All list endpoints support pagination with `page` and `size` parameters
7. **Filtering:** Placements can be filtered by `status_filter` and `platform_filter`

## 🚀 **Quick Test Sequence**

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}' | \
  jq -r '.token')

# 2. Create placement
PLACEMENT=$(curl -s -X POST http://localhost:5000/api/placements/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "platformType": "website",
    "offerwallTitle": "Quick Test",
    "currencyName": "Points",
    "exchangeRate": 1.0,
    "postbackUrl": "https://httpbin.org/post"
  }')

PLACEMENT_ID=$(echo $PLACEMENT | jq -r '.id')
PLACEMENT_IDENTIFIER=$(echo $PLACEMENT | jq -r '.placementIdentifier')

# 3. Test postback
curl -X POST http://localhost:5000/api/placements/test-postback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"placementIdentifier\": \"$PLACEMENT_IDENTIFIER\",
    \"postbackUri\": \"https://httpbin.org/post\",
    \"userId\": \"test123\",
    \"rewardValue\": \"50\"
  }"

# 4. Update status
curl -X PUT http://localhost:5000/api/placements/$PLACEMENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "PAUSED"}'

# 5. List placements
curl -X GET http://localhost:5000/api/placements/ \
  -H "Authorization: Bearer $TOKEN"
```
