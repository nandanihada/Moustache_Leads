# Publisher & Placement Management - Integrated Flask Solution

This document describes the **Step 2: Publisher & Placement Management** functionality integrated directly into your existing Flask backend.

## 🎯 Overview

The placement management system is now fully integrated into your existing Flask application, maintaining the same architecture and database connection. No separate services needed!

## 📊 Database Schema

### Publishers Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "contactEmail": "email", 
  "userId": "ObjectId (reference to users)",
  "status": "ACTIVE|INACTIVE|SUSPENDED",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Placements Collection
```json
{
  "_id": "ObjectId",
  "publisherId": "ObjectId (reference to publishers)",
  "placementIdentifier": "string (16 chars, auto-generated)",
  "platformType": "website|iOS|android",
  "offerwallTitle": "string",
  "currencyName": "string", 
  "exchangeRate": "float (> 0)",
  "postbackUrl": "url",
  "status": "LIVE|PAUSED|INACTIVE",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## 🛠 API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Publisher Management
- `GET /api/placements/publisher/me` - Get current publisher info (auto-creates if needed)

### Placement CRUD
- `POST /api/placements/` - Create new placement
- `GET /api/placements/` - List placements (with pagination & filters)
- `GET /api/placements/{id}` - Get specific placement
- `PUT /api/placements/{id}` - Update placement
- `DELETE /api/placements/{id}` - Delete placement (soft delete)

### Query Parameters for Placement List
- `page`: Page number (default: 1)
- `size`: Page size (default: 10, max: 100)
- `status_filter`: Filter by status (LIVE, PAUSED, INACTIVE)
- `platform_filter`: Filter by platform (website, iOS, android)

## 🔐 Security Features

- **JWT Integration**: Uses your existing Flask authentication system
- **Auto Publisher Creation**: Publishers are automatically created for authenticated users
- **Owner Verification**: Users can only manage their own placements
- **Input Validation**: Comprehensive validation for all fields
- **URL Validation**: Postback URLs are validated for proper format
- **Exchange Rate Validation**: Must be greater than 0

## 📁 Files Added

### Backend Models
- `models/publisher.py` - Publisher model with database operations
- `models/placement.py` - Placement model with CRUD operations and validation

### Backend Routes
- `routes/placements.py` - All placement API endpoints

### Frontend Examples
- `frontend-examples/PlacementForm.tsx` - React form component
- `frontend-examples/placementApi.ts` - TypeScript API service

### Testing
- `test_placements.py` - Comprehensive test script

## 🚀 Quick Start

### 1. Start Your Flask Backend
```bash
# Your existing Flask app (already configured)
python app.py
```

### 2. Test the Placement API
```bash
# Run the test script
python test_placements.py
```

### 3. Use in Frontend
```typescript
import { placementApi } from './placementApi';

// Create a placement
const newPlacement = await placementApi.createPlacement({
  platformType: 'website',
  offerwallTitle: 'My Offerwall',
  currencyName: 'Coins',
  exchangeRate: 1.0,
  postbackUrl: 'https://mysite.com/postback',
  status: 'LIVE'
});

// List placements
const placements = await placementApi.getPlacements({
  page: 1,
  size: 10,
  status_filter: 'LIVE'
});
```

## 📝 Example API Usage

### Create Placement
```bash
curl -X POST http://localhost:5000/api/placements/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platformType": "website",
    "offerwallTitle": "My Awesome Offerwall",
    "currencyName": "Gold Coins",
    "exchangeRate": 1.5,
    "postbackUrl": "https://mysite.com/postback",
    "status": "LIVE"
  }'
```

### List Placements
```bash
curl -X GET "http://localhost:5000/api/placements/?page=1&size=10&status_filter=LIVE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Placement
```bash
curl -X PUT http://localhost:5000/api/placements/PLACEMENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "offerwallTitle": "Updated Offerwall Title",
    "exchangeRate": 2.0,
    "status": "PAUSED"
  }'
```

## 🔄 Integration with Existing System

### Seamless Authentication
- Uses your existing JWT tokens from Flask authentication
- No additional login required
- Publishers are automatically created for authenticated users

### Database Integration  
- Uses your existing MongoDB Atlas connection
- Same database (`ascend_db`) as your user authentication
- Consistent error handling and logging

### Frontend Compatibility
- Works with your existing React frontend
- Same CORS configuration
- Compatible with existing authentication flow

## 🧪 Testing

The `test_placements.py` script tests all functionality:

1. **Authentication**: Login with demo credentials
2. **Publisher Creation**: Auto-creates publisher for user
3. **Placement CRUD**: Create, read, update, delete operations
4. **Validation**: Tests input validation and error handling
5. **Pagination**: Tests listing with filters

Run the test:
```bash
python test_placements.py
```

Expected output:
```
🚀 Starting Placement Management Tests
==================================================
🔐 Testing Login...
✅ Login successful!

👤 Testing Publisher Info...
✅ Publisher info retrieved: demo (demo@example.com)

📝 Testing Placement Creation...
✅ Placement created successfully!
   ID: 507f1f77bcf86cd799439011
   Identifier: Kj8mN2pQ7rT9xV3z
   Title: Test Offerwall

🔍 Testing Single Placement Retrieval...
✅ Placement retrieved successfully!

✏️ Testing Placement Update...
✅ Placement updated successfully!

📋 Testing Placement List...
✅ Placement list retrieved!
   Total placements: 1

🎉 All tests completed!
```

## 🎨 Frontend Integration

### React Component Example
```tsx
import React, { useState, useEffect } from 'react';
import { placementApi } from './placementApi';
import PlacementForm from './PlacementForm';

const PlacementManager: React.FC = () => {
  const [placements, setPlacements] = useState([]);
  
  const handleCreatePlacement = async (data) => {
    try {
      await placementApi.createPlacement(data);
      // Refresh list
      loadPlacements();
    } catch (error) {
      console.error('Error creating placement:', error);
    }
  };

  const loadPlacements = async () => {
    try {
      const response = await placementApi.getPlacements();
      setPlacements(response.placements);
    } catch (error) {
      console.error('Error loading placements:', error);
    }
  };

  useEffect(() => {
    loadPlacements();
  }, []);

  return (
    <div>
      <PlacementForm onSubmit={handleCreatePlacement} />
      {/* Placement list component */}
    </div>
  );
};
```

## 🔧 Configuration

No additional configuration needed! The placement system uses:
- Your existing MongoDB Atlas connection
- Your existing JWT secret key
- Your existing CORS settings
- Your existing error handling

## 🚀 Next Steps

With the placement management system integrated, you can now:

1. **Build Frontend UI**: Use the provided React components as a starting point
2. **Add Reporting**: Extend the system to track placement performance
3. **Webhook Integration**: Add webhook validation and testing features
4. **Analytics**: Implement placement analytics and reporting
5. **Bulk Operations**: Add bulk placement management features

## 📊 Benefits of Integrated Approach

✅ **Single Codebase**: Everything in one Flask application  
✅ **Shared Authentication**: Uses existing JWT system  
✅ **Consistent Database**: Same MongoDB connection and patterns  
✅ **Unified Deployment**: Deploy as one service  
✅ **Simplified Maintenance**: Single service to maintain  
✅ **Better Performance**: No inter-service communication overhead  

The placement management system is now fully integrated and ready for production use!
