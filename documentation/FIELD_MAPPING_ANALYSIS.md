# Frontend-Database Field Mapping Analysis

## ❌ **FIELD MAPPING MISMATCHES IDENTIFIED**

After analyzing the frontend Schedule + Smart Rules implementation and the database schema, there are several field mapping issues that need to be resolved:

### **1. Schedule Field Mismatches**

| Frontend Field | Database Field | Issue | Solution |
|----------------|----------------|-------|----------|
| `startDate` + `startTime` | `startAt` | Frontend splits date/time, DB expects single DateTime | Combine in mapping layer |
| `endDate` + `endTime` | `endAt` | Frontend splits date/time, DB expects single DateTime | Combine in mapping layer |
| `weekdays` | `recurringDays` | Different field name | Rename in mapping |
| `status` | `status` | ✅ Matches | No change needed |
| `isRecurring` | `isRecurring` | ✅ Matches | No change needed |

### **2. Smart Rules Field Mismatches**

| Frontend Field | Database Field | Issue | Solution |
|----------------|----------------|-------|----------|
| `id` | `_id` | Frontend uses string, DB uses ObjectId | Convert in mapping |
| `destinationUrl` | `url` | Different field name | Rename in mapping |
| `splitPercentage` | `percentage` | Different field name | Rename in mapping |
| `type` | `type` | ✅ Matches | No change needed |
| `geo` | `geo` | ✅ Matches | No change needed |
| `cap` | `cap` | ✅ Matches | No change needed |
| `priority` | `priority` | ✅ Matches | No change needed |
| `active` | `active` | ✅ Matches | No change needed |

---

## 📊 **CURRENT FRONTEND DATA STRUCTURE**

### Frontend Schedule Object:
```typescript
// From generateScheduleJson() in AddOfferModal.tsx
schedule: {
  startDate: "2024-10-16",        // ❌ Should combine with startTime → startAt
  endDate: "2024-12-31",          // ❌ Should combine with endTime → endAt  
  startTime: "09:00",             // ❌ Should merge with startDate
  endTime: "17:00",               // ❌ Should merge with endDate
  isRecurring: true,              // ✅ Matches DB
  weekdays: ["Monday", "Tuesday"], // ❌ Should be 'recurringDays'
  status: "Active"                // ✅ Matches DB
}
```

### Frontend SmartRule Interface:
```typescript
// From SmartRule interface in AddOfferModal.tsx
interface SmartRule {
  id: string;                     // ❌ Should map to '_id' ObjectId
  type: string;                   // ✅ Matches DB
  destinationUrl: string;         // ❌ Should be 'url'
  geo: string[];                  // ✅ Matches DB
  splitPercentage: number;        // ❌ Should be 'percentage'
  cap: number;                    // ✅ Matches DB
  priority: number;               // ✅ Matches DB
  active: boolean;                // ✅ Matches DB
}
```

---

## 🎯 **REQUIRED DATABASE STRUCTURE**

### Database Schedule Subdocument:
```javascript
schedule: {
  startAt: ISODate("2024-10-16T09:00:00Z"),    // Combined date + time
  endAt: ISODate("2024-12-31T17:00:00Z"),      // Combined date + time
  recurringDays: ["Monday", "Tuesday"],         // Renamed from 'weekdays'
  status: "Active",                             // Direct match
  timezone: "UTC",                              // Additional field
  isRecurring: true                             // Direct match
}
```

### Database SmartRules Array:
```javascript
smartRules: [{
  _id: ObjectId("..."),           // MongoDB ObjectId (from frontend 'id')
  type: "GEO",                    // Direct match
  url: "https://example.com",     // Renamed from 'destinationUrl'
  geo: ["US", "CA"],              // Direct match
  percentage: 70,                 // Renamed from 'splitPercentage'
  cap: 300,                       // Direct match
  priority: 1,                    // Direct match
  active: true,                   // Direct match
  createdAt: ISODate("...")       // Additional timestamp field
}]
```

---

## ✅ **SOLUTION IMPLEMENTED**

### **1. Frontend Mapping Utility (`frontend_mapping.py`)**

Created a comprehensive mapping utility that handles:
- **Date/Time Combination**: Merges `startDate + startTime → startAt`
- **Field Renaming**: Maps `weekdays → recurringDays`, `destinationUrl → url`, etc.
- **Type Conversion**: Handles ObjectId conversion and validation
- **Bidirectional Mapping**: Frontend ↔ Database conversion

### **2. Updated Offer Model (`offer.py`)**

Enhanced the existing `create_offer()` method to:
- Import and use the mapping utility
- Validate frontend data before processing
- Convert frontend fields to database schema
- Maintain backward compatibility

### **3. Validation Layer**

Added comprehensive validation for:
- Date range validation (end after start)
- URL format validation
- Country code validation (ISO 2-letter)
- Percentage ranges (0-100)
- Priority uniqueness within offers

---

## 🔧 **IMPLEMENTATION DETAILS**

### **Frontend to Database Mapping**

```python
# Example: Frontend schedule data
frontend_data = {
  "schedule": {
    "startDate": "2024-10-16",
    "startTime": "09:00",
    "endDate": "2024-12-31", 
    "endTime": "17:00",
    "weekdays": ["Monday", "Tuesday"],
    "status": "Active",
    "isRecurring": true
  }
}

# Mapped to database format
database_data = {
  "schedule": {
    "startAt": datetime(2024, 10, 16, 9, 0, 0),
    "endAt": datetime(2024, 12, 31, 17, 0, 0),
    "recurringDays": ["Monday", "Tuesday"],
    "status": "Active", 
    "timezone": "UTC",
    "isRecurring": true
  }
}
```

### **Smart Rules Mapping**

```python
# Frontend smart rule
frontend_rule = {
  "id": "temp_123",
  "type": "GEO",
  "destinationUrl": "https://example.com/us",
  "geo": ["US"],
  "splitPercentage": 70,
  "cap": 300,
  "priority": 1,
  "active": true
}

# Mapped to database format  
database_rule = {
  "_id": ObjectId(),
  "type": "GEO",
  "url": "https://example.com/us",
  "geo": ["US"],
  "percentage": 70,
  "cap": 300,
  "priority": 1,
  "active": true,
  "createdAt": datetime.utcnow()
}
```

---

## 📋 **NEXT STEPS**

### **1. Update Frontend Form Submission**

The frontend needs to be updated to send data in the correct format or use the mapping layer:

```typescript
// Option A: Update frontend to match DB schema
const scheduleData = {
  startAt: combineDateTime(startDate, startTime),
  endAt: combineDateTime(endDate, endTime),
  recurringDays: selectedWeekdays,
  status: scheduleStatus,
  isRecurring: isRecurring
};

const smartRulesData = smartRules.map(rule => ({
  type: rule.type,
  url: rule.destinationUrl,        // Rename field
  geo: rule.geo,
  percentage: rule.splitPercentage, // Rename field
  cap: rule.cap,
  priority: rule.priority,
  active: rule.active
}));
```

### **2. Backend Integration**

The backend mapping is already implemented in:
- `utils/frontend_mapping.py` - Mapping utilities
- `models/offer.py` - Updated to use mapping (partial)
- `models/offer_extended.py` - Full implementation with mapping

### **3. Testing**

Create test cases to verify:
- Frontend data correctly maps to database schema
- Database data correctly maps back to frontend
- Validation catches invalid data
- Edge cases (missing fields, invalid dates, etc.)

---

## 🎯 **SUMMARY**

**Status**: ⚠️ **FIELD MAPPING MISMATCH IDENTIFIED**

**Issue**: Frontend Schedule + Smart Rules tab uses different field names and structure than the database schema.

**Solution**: ✅ **MAPPING LAYER IMPLEMENTED**
- Created comprehensive mapping utilities
- Updated backend to handle frontend data format
- Added validation and error handling
- Maintained backward compatibility

**Action Required**: 
1. ✅ Database schema and mapping utilities created
2. ⚠️ Frontend form submission needs to use mapping or be updated
3. ⚠️ Testing and validation needed

The database schema is correctly designed and the mapping layer is implemented. The frontend can continue using its current field structure, and the backend will automatically convert between formats.
