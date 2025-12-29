# Frontend-Backend Integration Guide

## 🎯 Overview

Your existing `Placements.tsx` frontend has been integrated with the Flask backend API. Here's how to test the complete system.

## 🚀 Step-by-Step Testing

### 1. Start the Flask Backend
```bash
cd d:\pepeleads\ascend\lovable-ascend\backend
python app.py
```

The backend should start on `http://localhost:5000`

### 2. Create a Test User (if needed)
```bash
cd d:\pepeleads\ascend\lovable-ascend\backend
python test_frontend_integration.py
```

Or manually create a user:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### 3. Start Your Frontend
```bash
cd d:\pepeleads\ascend\lovable-ascend
npm start
# or
yarn start
```

### 4. Test the Integration

#### Login First
- Navigate to your login page
- Login with credentials: `testuser` / `password123`
- Ensure JWT token is stored in localStorage

#### Test Placement Management
1. **Navigate to Placements page** (`/placements`)
2. **Create New Placement:**
   - Click "Add New Placement"
   - Fill in the form:
     - Platform Type: Website/iOS/Android
     - Offerwall Title: "My Test Offerwall"
     - Currency Name: "Gold Coins"
     - Exchange Rate: 1.5
     - Postback URL: "https://example.com/postback"
   - Click "Create New Placement"
   - Should see success message with placement ID

3. **View Existing Placements:**
   - Should see your created placement in the navigation
   - Click on placement to view/edit details

4. **Update Placement:**
   - Modify any field (title, exchange rate, etc.)
   - Click "Save Configuration Changes"
   - Should see success message

5. **Test Postback:**
   - Go to "Postback Testing" tab
   - Fill in test data
   - Click "Send Test Postback"
   - Should see success message

## 🔧 API Integration Details

### What's Been Integrated

Your existing `Placements.tsx` now:
- ✅ **Loads real placements** from Flask backend on page load
- ✅ **Creates new placements** via API calls
- ✅ **Updates existing placements** via API calls
- ✅ **Auto-creates publisher records** for authenticated users
- ✅ **Handles loading states** and error messages
- ✅ **Maintains your existing UI** - no visual changes needed

### API Endpoints Used

- `GET /api/placements/` - Load placements list
- `POST /api/placements/` - Create new placement
- `PUT /api/placements/{id}` - Update placement
- `GET /api/placements/publisher/me` - Get publisher info

### Data Flow

1. **Page Load:** Frontend calls API to load existing placements
2. **Create:** Frontend converts UI data → API format → sends to backend
3. **Update:** Frontend sends changes to backend → updates local state
4. **Display:** Backend data is converted to frontend format for display

## 🧪 Testing Checklist

- [ ] Backend starts without errors
- [ ] User can login and get JWT token
- [ ] Placements page loads without errors
- [ ] Can create new placement
- [ ] New placement appears in navigation
- [ ] Can switch between placements
- [ ] Can update placement details
- [ ] Error messages show for invalid data
- [ ] Loading states work properly

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors:**
   - Backend CORS is configured for `localhost:3000`, `localhost:5173`, `localhost:8080`
   - Make sure your frontend runs on one of these ports

2. **Authentication Errors:**
   - Ensure JWT token is stored in localStorage as `token`
   - Check browser dev tools → Application → Local Storage

3. **API Errors:**
   - Check browser dev tools → Network tab for failed requests
   - Check Flask backend console for error logs

4. **Data Format Issues:**
   - API service converts between frontend/backend data formats
   - Check console logs for conversion errors

### Debug Steps

1. **Check Backend Logs:**
   ```bash
   # Backend console should show requests
   INFO:werkzeug:127.0.0.1 - - [date] "POST /api/placements/ HTTP/1.1" 201 -
   ```

2. **Check Frontend Network Tab:**
   - Look for failed API calls (red entries)
   - Check request/response data

3. **Check Browser Console:**
   - Look for JavaScript errors
   - Check API service logs

4. **Test Backend Directly:**
   ```bash
   python test_frontend_integration.py
   ```

## 🎉 Success Indicators

When everything works correctly:
- ✅ Placements load from database on page refresh
- ✅ New placements get unique IDs from backend
- ✅ Changes persist after page refresh
- ✅ Multiple users can have separate placements
- ✅ Data appears in MongoDB Atlas dashboard

## 🔄 Data Synchronization

- **Frontend State:** Managed by React useState
- **Backend State:** Stored in MongoDB Atlas
- **Sync Points:** Page load, create, update operations
- **Offline Handling:** Shows error messages, falls back to cached data

Your placement management system is now fully integrated with the Flask backend!
