# 🚀 LOGIN LOGS QUICK START GUIDE

## Access the Features

### 1. Login Logs Page
**URL**: `/admin/login-logs`

**What you'll see:**
- Last 100 login attempts
- Success and failed logins
- User details, IP addresses, locations
- Device and browser information
- Login methods and failure reasons

**Features:**
- 🔍 Search by email
- 🎯 Filter by status (success/failed)
- 📅 Date range filtering
- 📊 Statistics cards
- 📥 Export to CSV

### 2. Active Users Dashboard
**URL**: `/admin/active-users`

**What you'll see:**
- Real-time active users
- Current page they're viewing
- Last activity time
- Idle time
- Location and device info
- Activity level indicators

**Features:**
- 🔄 Auto-refresh (every 10 seconds)
- 🎨 Color-coded activity levels
- 🚨 Suspicious activity alerts
- 📍 Location tracking
- 💻 Device information

---

## Activity Level Colors

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | Active | Activity within 1 minute |
| 🟡 Yellow | Normal | Activity within 5 minutes |
| ⚪ Grey | Idle | No activity for 5+ minutes |
| 🔴 Red | Suspicious | Unusual activity detected |

---

## Suspicious Activity Triggers

The system automatically flags sessions as suspicious when:
- ⚠️ More than 10 page visits in 1 minute (rapid navigation)
- ⚠️ Device change during session
- ⚠️ Multiple failed login attempts
- ⚠️ Rapid IP changes

---

## Data Tracked

### Login Logs
- ✅ User ID / Email / Username
- ✅ Login Time
- ✅ Logout Time
- ✅ IP Address
- ✅ Device Type (Desktop/Mobile/Tablet)
- ✅ Operating System
- ✅ Browser & Version
- ✅ Location (City, Country)
- ✅ Login Method (Password/OTP/SSO)
- ✅ Status (Success/Failed)
- ✅ Failure Reason
- ✅ Session ID

### Page Visits (Last 10 per session)
- ✅ Page URL
- ✅ Page Title
- ✅ Timestamp
- ✅ Time Spent
- ✅ Referrer
- ✅ UTM Parameters

### Active Sessions
- ✅ Current Page
- ✅ Last Activity
- ✅ Idle Time
- ✅ Session Duration
- ✅ Location & IP
- ✅ Device Info
- ✅ Activity Level

---

## Common Use Cases

### 1. Investigate Failed Logins
1. Go to `/admin/login-logs`
2. Filter by Status: "Failed"
3. Check failure reasons
4. Look for patterns (same IP, multiple attempts)

### 2. Monitor Active Users
1. Go to `/admin/active-users`
2. Enable auto-refresh
3. Watch for red (suspicious) indicators
4. Check what pages users are viewing

### 3. Export Login Data
1. Go to `/admin/login-logs`
2. Apply desired filters
3. Click "Export CSV"
4. Open in Excel/Google Sheets

### 4. Check User Login History
1. Go to `/admin/login-logs`
2. Search by user email
3. View all their login attempts
4. Check for suspicious patterns

### 5. Identify Security Issues
1. Look for multiple failed attempts
2. Check for unusual login times
3. Monitor for rapid IP changes
4. Watch for device changes

---

## API Endpoints (for developers)

### Get Login Logs
```bash
GET /api/admin/login-logs?page=1&limit=100&status=success
```

### Get Active Sessions
```bash
GET /api/admin/active-sessions
```

### Get Login Statistics
```bash
GET /api/admin/login-logs/stats
```

### Track Page Visit
```bash
POST /api/admin/page-visits/track
{
  "session_id": "uuid",
  "page_url": "/dashboard",
  "page_title": "Dashboard"
}
```

---

## Tips & Best Practices

### Security Monitoring
- ✅ Check login logs daily
- ✅ Monitor for failed login patterns
- ✅ Investigate suspicious activity immediately
- ✅ Review active users regularly

### Performance
- ✅ Use date range filters to limit results
- ✅ Export data for long-term analysis
- ✅ Toggle auto-refresh off when not needed

### Data Management
- ✅ Old page visits are automatically cleaned up after 90 days
- ✅ Stale sessions are marked inactive after 24 hours
- ✅ Export important logs before they're cleaned

---

## Troubleshooting

### "No logs found"
- Check your date range filters
- Verify you have admin permissions
- Try clearing all filters

### "Failed to load"
- Check your internet connection
- Verify backend is running
- Check browser console for errors

### Auto-refresh not working
- Click the "Auto-Refresh" button to toggle
- Check if button shows "Auto-Refresh On"
- Refresh the page if needed

---

## Support

For issues or questions:
1. Check the console for errors
2. Verify backend is running on port 5000
3. Ensure you're logged in as admin
4. Check network tab for failed requests

---

## Quick Links

- **Login Logs**: `/admin/login-logs`
- **Active Users**: `/admin/active-users`
- **Admin Dashboard**: `/admin`

---

**Last Updated**: 2025-12-08
**Version**: 1.0.0
