# 🔐 Login Logs & Activity Tracking Implementation Plan

## Overview
Comprehensive login logs and real-time activity tracking system for the admin panel.

## Features to Implement

### 1. Login Logs Tracking
- ✅ User ID / Email
- ✅ Login Time
- ✅ Logout Time
- ✅ IP Address
- ✅ Device / Browser
- ✅ Location (city/country)
- ✅ Login Method (password, OTP, SSO)
- ✅ Success/Failed Status
- ✅ Reason for Fail (wrong password, wrong OTP, blocked device)

### 2. Page Visit Tracking
- ✅ Last 10 pages visited per session
- ✅ Timestamps for each page
- ✅ Referrer tracking
- ✅ UTM parameters
- ✅ Device change detection

### 3. Real-Time Activity Dashboard
- ✅ Currently logged-in users
- ✅ Last action timestamp
- ✅ Idle time calculation
- ✅ Current page
- ✅ Location/IP display
- ✅ Activity heatmap (red/yellow/grey dots)

## Database Schema

### Collection: `login_logs`
```javascript
{
  _id: ObjectId,
  user_id: String,
  email: String,
  username: String,
  login_time: ISODate,
  logout_time: ISODate (nullable),
  ip_address: String,
  device: {
    type: String,      // mobile, desktop, tablet
    os: String,        // Windows, macOS, Linux, iOS, Android
    browser: String,   // Chrome, Firefox, Safari, etc.
    version: String
  },
  location: {
    ip: String,
    city: String,
    region: String,
    country: String,
    country_code: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  login_method: String,  // password, otp, sso
  status: String,        // success, failed
  failure_reason: String, // wrong_password, wrong_otp, blocked_device, account_locked
  session_id: String,
  user_agent: String,
  created_at: ISODate
}
```

### Collection: `page_visits`
```javascript
{
  _id: ObjectId,
  session_id: String,
  user_id: String,
  page_url: String,
  page_title: String,
  referrer: String,
  utm_source: String,
  utm_medium: String,
  utm_campaign: String,
  utm_term: String,
  utm_content: String,
  device: Object,
  ip_address: String,
  timestamp: ISODate,
  time_spent: Number,  // seconds
  created_at: ISODate
}
```

### Collection: `active_sessions`
```javascript
{
  _id: ObjectId,
  session_id: String,
  user_id: String,
  email: String,
  username: String,
  current_page: String,
  last_activity: ISODate,
  idle_time: Number,  // seconds
  ip_address: String,
  location: Object,
  device: Object,
  is_active: Boolean,
  activity_level: String,  // active, idle, suspicious
  login_time: ISODate,
  updated_at: ISODate
}
```

## Backend Implementation

### Files to Create/Modify

#### 1. `backend/models/login_logs.py` (NEW)
- LoginLog model with CRUD operations
- Query methods for filtering and pagination
- Analytics methods

#### 2. `backend/models/page_visits.py` (NEW)
- PageVisit model
- Session tracking methods
- Last 10 pages query

#### 3. `backend/models/active_sessions.py` (NEW)
- ActiveSession model
- Real-time session management
- Activity level calculation

#### 4. `backend/services/activity_tracking_service.py` (NEW)
- Track login attempts
- Track page visits
- Update active sessions
- Calculate activity levels
- Device fingerprinting

#### 5. `backend/services/geolocation_service.py` (MODIFY)
- Enhance with city/country lookup
- IP-based location detection

#### 6. `backend/routes/login_logs.py` (NEW)
- GET /api/login-logs - Get login logs with filters
- GET /api/login-logs/:id - Get specific log
- GET /api/active-sessions - Get currently active sessions
- GET /api/page-visits/:session_id - Get page visits for session
- GET /api/activity-stats - Get activity statistics

#### 7. `backend/routes/auth.py` (MODIFY)
- Add login tracking to login endpoint
- Add logout tracking
- Track failed login attempts

#### 8. `backend/middleware/activity_tracker.py` (NEW)
- Middleware to track page visits
- Session heartbeat updates
- Idle time calculation

## Frontend Implementation

### Files to Create/Modify

#### 1. `src/pages/AdminLoginLogs.tsx` (NEW)
Main admin page for login logs with:
- Filters (date range, user, status, method)
- Table with all login log fields
- Pagination (last 100 logs)
- Export functionality
- Real-time updates

#### 2. `src/pages/AdminActiveUsers.tsx` (NEW)
Real-time dashboard showing:
- Currently logged-in users
- Activity heatmap
- User cards with:
  - Username/Email
  - Current page
  - Last activity
  - Idle time
  - Location/IP
  - Activity indicator (red/yellow/grey)

#### 3. `src/components/LoginLogTable.tsx` (NEW)
Reusable table component for login logs

#### 4. `src/components/ActiveUserCard.tsx` (NEW)
Card component for active user display

#### 5. `src/components/PageVisitTimeline.tsx` (NEW)
Timeline component showing last 10 pages visited

#### 6. `src/services/loginLogsService.ts` (NEW)
API service for login logs endpoints

#### 7. `src/services/activityTrackingService.ts` (NEW)
- Track page visits on route change
- Send heartbeat to backend
- Handle session management

#### 8. `src/App.tsx` (MODIFY)
- Add activity tracking middleware
- Track route changes
- Send page visit events

## API Endpoints

### Login Logs
- `GET /api/login-logs?page=1&limit=100&status=success&user_id=xxx`
- `GET /api/login-logs/:id`
- `GET /api/login-logs/stats`

### Active Sessions
- `GET /api/active-sessions`
- `GET /api/active-sessions/:session_id`
- `POST /api/active-sessions/heartbeat`

### Page Visits
- `GET /api/page-visits/:session_id`
- `POST /api/page-visits/track`

### Activity Stats
- `GET /api/activity-stats/overview`
- `GET /api/activity-stats/heatmap`

## Activity Level Logic

### Red Dots (Suspicious)
- More than 10 page visits in 1 minute
- Rapid IP changes
- Multiple failed login attempts
- Unusual access patterns

### Yellow Dots (Normal Usage)
- Regular page navigation
- Active within last 5 minutes
- Normal session duration

### Grey Dots (Idle)
- No activity for 5+ minutes
- Session still active but idle

## Implementation Steps

### Phase 1: Backend Foundation (30 min)
1. Create database models
2. Create activity tracking service
3. Enhance geolocation service
4. Create login logs routes

### Phase 2: Login Tracking (20 min)
1. Modify auth.py to track logins
2. Add logout tracking
3. Track failed attempts
4. Test login tracking

### Phase 3: Page Visit Tracking (30 min)
1. Create activity tracker middleware
2. Add page visit tracking
3. Create active sessions management
4. Test page tracking

### Phase 4: Frontend - Login Logs Page (40 min)
1. Create AdminLoginLogs page
2. Create LoginLogTable component
3. Add filters and pagination
4. Add export functionality

### Phase 5: Frontend - Active Users Dashboard (40 min)
1. Create AdminActiveUsers page
2. Create ActiveUserCard component
3. Add real-time updates
4. Add activity heatmap

### Phase 6: Frontend - Activity Tracking (20 min)
1. Create activity tracking service
2. Add route change tracking
3. Add heartbeat mechanism
4. Test end-to-end

### Phase 7: Testing & Polish (20 min)
1. Test all endpoints
2. Test real-time updates
3. Test activity levels
4. Add error handling

## Total Estimated Time: 3-4 hours

## Success Criteria
- ✅ Last 100 login logs visible in admin panel
- ✅ Real-time active users dashboard
- ✅ Last 10 pages tracked per session
- ✅ Activity levels correctly calculated
- ✅ All login attempts (success/failed) tracked
- ✅ Location and device info captured
- ✅ Export functionality working
