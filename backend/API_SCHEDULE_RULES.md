# Schedule + Smart Rules API Documentation

## Overview

This API provides comprehensive CRUD operations for offer scheduling and smart rules management. All endpoints require admin authentication and handle automatic field mapping between frontend and database formats.

## Base URL
```
/api/admin
```

## Authentication
All endpoints require:
- **Authorization Header**: `Bearer <token>`
- **Admin Role**: User must have admin privileges

---

## 📅 **Schedule Endpoints**

### **POST /offers/{id}/schedule**
Create or update offer schedule

**Request Body:**
```json
{
  "schedule": {
    "startDate": "2024-10-16",
    "endDate": "2024-12-31",
    "startTime": "09:00",
    "endTime": "17:00",
    "isRecurring": true,
    "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "status": "Active"
  }
}
```

**Response (201):**
```json
{
  "message": "Schedule created/updated successfully",
  "schedule": {
    "startDate": "2024-10-16",
    "endDate": "2024-12-31",
    "startTime": "09:00",
    "endTime": "17:00",
    "isRecurring": true,
    "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "status": "Active"
  }
}
```

### **GET /offers/{id}/schedule**
Get offer schedule

**Response (200):**
```json
{
  "schedule": {
    "startDate": "2024-10-16",
    "endDate": "2024-12-31",
    "startTime": "09:00",
    "endTime": "17:00",
    "isRecurring": true,
    "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "status": "Active"
  },
  "offer_id": "ML-00123"
}
```

### **PUT /offers/{id}/schedule**
Update offer schedule

**Request Body:** Same as POST
**Response (200):** Same as POST with "updated" message

---

## ⚡ **Smart Rules Endpoints**

### **POST /offers/{id}/smart-rules**
Add new smart rule to offer

**Request Body:**
```json
{
  "rule": {
    "type": "GEO",
    "destinationUrl": "https://example.com/us-landing",
    "geo": ["US", "CA"],
    "splitPercentage": 70,
    "cap": 300,
    "priority": 1,
    "active": true
  }
}
```

**Response (201):**
```json
{
  "message": "Smart rule created successfully",
  "rule": {
    "id": "507f1f77bcf86cd799439011",
    "type": "GEO",
    "destinationUrl": "https://example.com/us-landing",
    "geo": ["US", "CA"],
    "splitPercentage": 70,
    "cap": 300,
    "priority": 1,
    "active": true
  }
}
```

### **GET /offers/{id}/smart-rules**
Get all smart rules for offer

**Response (200):**
```json
{
  "smartRules": [
    {
      "id": "507f1f77bcf86cd799439011",
      "type": "GEO",
      "destinationUrl": "https://example.com/us-landing",
      "geo": ["US", "CA"],
      "splitPercentage": 70,
      "cap": 300,
      "priority": 1,
      "active": true
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "type": "Backup",
      "destinationUrl": "https://backup.example.com",
      "geo": [],
      "splitPercentage": 100,
      "cap": 0,
      "priority": 99,
      "active": true
    }
  ],
  "total": 2,
  "offer_id": "ML-00123"
}
```

### **PUT /offers/{id}/smart-rules/{ruleId}**
Update specific smart rule

**Request Body:**
```json
{
  "rule": {
    "type": "GEO",
    "destinationUrl": "https://updated-example.com/us",
    "geo": ["US"],
    "splitPercentage": 80,
    "cap": 400,
    "priority": 1,
    "active": true
  }
}
```

**Response (200):**
```json
{
  "message": "Smart rule updated successfully",
  "rule": {
    "id": "507f1f77bcf86cd799439011",
    "type": "GEO",
    "destinationUrl": "https://updated-example.com/us",
    "geo": ["US"],
    "splitPercentage": 80,
    "cap": 400,
    "priority": 1,
    "active": true
  }
}
```

### **DELETE /offers/{id}/smart-rules/{ruleId}**
Delete specific smart rule

**Response (200):**
```json
{
  "message": "Smart rule deleted successfully",
  "rule_id": "507f1f77bcf86cd799439011"
}
```

---

## 🔍 **Activation & Status Endpoints**

### **GET /offers/{id}/activation-check**
Check if offer is currently active based on schedule and rules

**Response (200):**
```json
{
  "active": true,
  "reasons": [],
  "schedule_active": true,
  "rules_active": true,
  "rule_stats": {
    "total_rules": 3,
    "active_rules": 2,
    "rule_types": {
      "GEO": 1,
      "Backup": 1
    }
  },
  "offer_id": "ML-00123",
  "checked_at": "2024-10-16T10:30:00.000Z"
}
```

**Inactive Example:**
```json
{
  "active": false,
  "reasons": ["Offer has not started yet", "No active smart rules configured"],
  "schedule_active": false,
  "rules_active": false,
  "rule_stats": {
    "total_rules": 0,
    "active_rules": 0,
    "rule_types": {}
  },
  "offer_id": "ML-00124",
  "checked_at": "2024-10-16T10:30:00.000Z"
}
```

### **GET /offers/active-with-schedule**
Get all currently active offers considering their schedules

**Response (200):**
```json
{
  "offers": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "offer_id": "ML-00123",
      "name": "Paramount+ Premium Streaming",
      "status": "Active",
      "schedule": {
        "startDate": "2024-10-16",
        "endDate": "2024-12-31",
        "status": "Active",
        "isRecurring": true
      },
      "smartRules": [...],
      "payout": 9.60,
      "network": "PepperAds"
    }
  ],
  "total": 1,
  "checked_at": "2024-10-16T10:30:00.000Z"
}
```

### **GET /offers/geo/{countryCode}**
Get offers with active GEO rules for specific country

**Parameters:**
- `countryCode`: 2-letter ISO country code (e.g., "US", "CA")

**Response (200):**
```json
{
  "offers": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "offer_id": "ML-00123",
      "name": "US-Targeted Streaming Offer",
      "smartRules": [
        {
          "id": "507f1f77bcf86cd799439012",
          "type": "GEO",
          "geo": ["US"],
          "active": true
        }
      ]
    }
  ],
  "total": 1,
  "country_code": "US",
  "checked_at": "2024-10-16T10:30:00.000Z"
}
```

---

## 📋 **Data Models**

### **Schedule Object**
```typescript
interface Schedule {
  startDate?: string;        // YYYY-MM-DD format
  endDate?: string;          // YYYY-MM-DD format
  startTime?: string;        // HH:MM format (24-hour)
  endTime?: string;          // HH:MM format (24-hour)
  isRecurring: boolean;      // Weekly recurring flag
  weekdays: string[];        // ["Monday", "Tuesday", ...]
  status: "Active" | "Paused";
}
```

### **Smart Rule Object**
```typescript
interface SmartRule {
  id?: string;               // Auto-generated ObjectId (read-only)
  type: "Backup" | "Rotation" | "GEO" | "Time";
  destinationUrl: string;    // Valid HTTP/HTTPS URL
  geo: string[];             // 2-letter ISO country codes
  splitPercentage: number;   // 0-100
  cap: number;               // >= 0
  priority: number;          // >= 1, unique per offer
  active: boolean;           // Rule enabled/disabled
}
```

---

## ❌ **Error Responses**

### **400 Bad Request**
```json
{
  "error": "Schedule validation failed",
  "details": ["End date must be after start date"]
}
```

### **403 Forbidden**
```json
{
  "error": "Admin access required"
}
```

### **404 Not Found**
```json
{
  "error": "Offer not found"
}
```

### **500 Internal Server Error**
```json
{
  "error": "Failed to create schedule: Database connection error"
}
```

---

## 🔧 **Validation Rules**

### **Schedule Validation**
- `endDate` must be after `startDate` if both provided
- `weekdays` must contain valid day names
- `status` must be "Active" or "Paused"
- `startTime`/`endTime` must be in HH:MM format

### **Smart Rules Validation**
- `type` must be one of: Backup, Rotation, GEO, Time
- `destinationUrl` must be valid HTTP/HTTPS URL
- `geo` must contain valid 2-letter ISO country codes
- `splitPercentage` must be 0-100
- `cap` must be >= 0
- `priority` must be >= 1 and unique within offer
- `active` must be boolean

---

## 🚀 **Usage Examples**

### **Create Complete Offer Schedule**
```bash
curl -X POST "http://localhost:5000/api/admin/offers/ML-00123/schedule" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": {
      "startDate": "2024-11-01",
      "endDate": "2024-12-31",
      "startTime": "09:00",
      "endTime": "17:00",
      "isRecurring": true,
      "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "status": "Active"
    }
  }'
```

### **Add GEO-Targeted Smart Rule**
```bash
curl -X POST "http://localhost:5000/api/admin/offers/ML-00123/smart-rules" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rule": {
      "type": "GEO",
      "destinationUrl": "https://example.com/us-landing",
      "geo": ["US"],
      "splitPercentage": 80,
      "cap": 500,
      "priority": 1,
      "active": true
    }
  }'
```

### **Check Offer Activation Status**
```bash
curl -X GET "http://localhost:5000/api/admin/offers/ML-00123/activation-check" \
  -H "Authorization: Bearer <token>"
```

---

## 🔄 **Field Mapping**

The API automatically handles field mapping between frontend and database formats:

**Frontend → Database:**
- `startDate + startTime` → `startAt` (combined DateTime)
- `endDate + endTime` → `endAt` (combined DateTime)
- `weekdays` → `recurringDays`
- `destinationUrl` → `url`
- `splitPercentage` → `percentage`

**Database → Frontend:**
- `startAt` → `startDate + startTime` (split DateTime)
- `endAt` → `endDate + endTime` (split DateTime)
- `recurringDays` → `weekdays`
- `url` → `destinationUrl`
- `percentage` → `splitPercentage`

This ensures seamless integration between the React frontend components and MongoDB database schema.
