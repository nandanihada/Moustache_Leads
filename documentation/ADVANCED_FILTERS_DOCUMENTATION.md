# 🔍 Advanced Filters Implementation - Complete Guide

## Overview
Comprehensive filtering system has been implemented for both **Offer Access Requests** and **Placement Approval** sections with real-time data filtering.

---

## 📋 Offer Access Requests Filters

### Location
`src/pages/AdminOfferAccessRequests.tsx`

### Available Filters

#### Row 1: Basic Filters
| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| **Search** | Text | General search across username, email, offer | "john" or "test@email.com" |
| **Status** | Dropdown | Filter by request status | Pending, Approved, Rejected, All |
| **Offer ID** | Text | Filter by specific offer ID | "ML-00001" |
| **Offer Name** | Text | Filter by offer name (partial match) | "Casino" or "Loan" |

#### Row 2: User & Category Filters
| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| **User ID** | Text | Filter by publisher user ID | MongoDB ObjectId |
| **User Name** | Text | Filter by publisher username | "john_doe" |
| **Category** | Dropdown | Filter by offer category | Finance, Gaming, Dating, Shopping, Health, Education, Other |
| **Device** | Dropdown | Filter by device targeting | Mobile, Desktop, Tablet, All |

#### Row 3: Date Range
| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| **Date From** | Date | Start date for request range | 2025-01-01 |
| **Date To** | Date | End date for request range | 2025-12-31 |
| **Clear Filters** | Button | Reset all filters to defaults | Clears all fields |

### Backend Implementation
**File:** `backend/routes/admin_offer_requests.py`

**Supported Query Parameters:**
```
GET /api/admin/offer-access-requests?
  status=pending
  &offer_id=ML-00001
  &offer_name=Casino
  &user_id=<user_id>
  &user_name=john
  &date_from=2025-01-01
  &date_to=2025-12-31
  &category=gaming
  &device=mobile
  &search=test
  &page=1
  &per_page=20
```

**Filter Logic:**
- **Status Filter**: Exact match on request status
- **Offer ID**: Case-insensitive regex match
- **Offer Name**: Case-insensitive substring match
- **User ID**: Exact match
- **User Name**: Case-insensitive substring match
- **Date Range**: Inclusive range (includes entire day for end date)
- **Category**: Exact match on offer category
- **Device**: Exact match on device targeting
- **Search**: Case-insensitive regex on username, email, or offer_id

### Response Format
```json
{
  "requests": [
    {
      "_id": "...",
      "request_id": "REQ-ML-00001-...",
      "offer_id": "ML-00001",
      "user_id": "...",
      "username": "john_doe",
      "email": "john@example.com",
      "status": "pending",
      "requested_at": "2025-11-24T10:30:00",
      "offer_details": {
        "name": "Casino Game",
        "payout": 25.50,
        "network": "AdGate",
        "category": "gaming",
        "device_targeting": "mobile"
      },
      "user_details": {
        "username": "john_doe",
        "email": "john@example.com",
        "account_type": "premium"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

## 🎯 Placement Approval Filters

### Location
`src/pages/AdminPlacementApproval.tsx`

### Available Filters

#### Row 1: Search & Publisher Filters
| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| **Search** | Text | General search across publisher, email, placement | "john" or "test@email.com" |
| **Publisher ID** | Text | Filter by publisher ID | "PUB-001" |
| **Publisher Name** | Text | Filter by publisher name | "John's Placements" |
| **Placement ID** | Text | Filter by placement identifier | "PLACE-001" |

#### Row 2: Platform & Currency Filters
| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| **Platform Type** | Text | Filter by platform type | "Web", "Mobile", "Desktop" |
| **Currency** | Text | Filter by currency code | "USD", "EUR", "GBP" |
| **Date From** | Date | Start date for placement creation | 2025-01-01 |
| **Date To** | Date | End date for placement creation | 2025-12-31 |

### Backend Implementation
**File:** `backend/routes/placements.py` (or similar)

**Supported Query Parameters:**
```
GET /api/placements/admin/all?
  status_filter=PENDING_APPROVAL
  &search=john
  &publisher_id=PUB-001
  &publisher_name=John
  &placement_id=PLACE-001
  &platform_type=Web
  &date_from=2025-01-01
  &date_to=2025-12-31
  &currency=USD
  &page=1
  &size=20
```

**Filter Logic:**
- **Search**: Case-insensitive search on publisher name, email, placement title
- **Publisher ID**: Exact match
- **Publisher Name**: Case-insensitive substring match
- **Placement ID**: Case-insensitive substring match
- **Platform Type**: Case-insensitive match
- **Currency**: Case-insensitive match
- **Date Range**: Inclusive range

### Response Format
```json
{
  "placements": [
    {
      "id": "...",
      "publisherId": "PUB-001",
      "publisherName": "John Doe",
      "publisherEmail": "john@example.com",
      "placementIdentifier": "PLACE-001",
      "platformType": "Web",
      "offerwallTitle": "My Offerwall",
      "currencyName": "USD",
      "exchangeRate": 1.0,
      "postbackUrl": "https://example.com/postback",
      "status": "active",
      "approvalStatus": "PENDING_APPROVAL",
      "createdAt": "2025-11-24T10:30:00"
    }
  ],
  "total": 25,
  "pagination": {
    "page": 1,
    "size": 20
  }
}
```

---

## 🚀 Usage Examples

### Example 1: Find All Pending Gaming Offers from Mobile Users
**Offer Access Requests:**
```
Filters:
- Status: Pending
- Category: Gaming
- Device: Mobile
- Date From: 2025-11-01
- Date To: 2025-11-30
```

### Example 2: Find Specific Publisher's Placement Requests
**Placement Approval:**
```
Filters:
- Publisher Name: "John Doe"
- Platform Type: "Web"
- Status: PENDING_APPROVAL
```

### Example 3: Find Offers by Specific User
**Offer Access Requests:**
```
Filters:
- User Name: "john_doe"
- Status: All
```

### Example 4: Find Finance Offers Requested in Date Range
**Offer Access Requests:**
```
Filters:
- Category: Finance
- Date From: 2025-11-01
- Date To: 2025-11-30
- Status: Approved
```

---

## 🔧 Technical Details

### Frontend State Management
Both pages use React hooks for filter state:

```typescript
const [filters, setFilters] = useState({
  // Offer Access Requests
  status: 'all',
  search: '',
  offer_id: '',
  offer_name: '',
  user_id: '',
  user_name: '',
  date_from: '',
  date_to: '',
  category: '',
  device: '',
  page: 1,
  per_page: 20
});
```

### Real-time Filtering
- Filters trigger API calls immediately on change
- Date pickers include full day ranges
- Pagination resets to page 1 when filters change
- Clear Filters button resets all fields to defaults

### Performance Considerations
- Filters are sent as URL query parameters
- Backend uses MongoDB regex for text searches
- Pagination limits results to 20-100 per page
- Date range queries use MongoDB date operators

---

## 📊 Data Fields Returned

### Offer Access Requests
- Request ID
- Offer details (name, payout, network, category, device)
- Publisher details (username, email, account type)
- Request status (pending, approved, rejected)
- Request date/time
- Approval/rejection notes

### Placement Approvals
- Placement ID
- Publisher details (name, email, ID)
- Platform type
- Currency & exchange rate
- Offerwall title
- Postback URL
- Creation date
- Approval status

---

## ✅ Implementation Checklist

- [x] Frontend filter UI for Offer Access Requests
- [x] Frontend filter UI for Placement Approvals
- [x] Backend filter logic for Offer Access Requests
- [x] Backend filter logic for Placement Approvals
- [x] Date range filtering
- [x] Category filtering
- [x] Device targeting filtering
- [x] Search functionality
- [x] Clear filters button
- [x] Real-time filter updates
- [x] Pagination with filters
- [x] Response data enrichment

---

## 🎨 UI Features

### Filter Card Layout
- Responsive grid (1 column mobile, 2 columns tablet, 4 columns desktop)
- Clear labels for each filter
- Placeholder text for guidance
- Date pickers with calendar UI
- Dropdown selects for predefined options
- Clear Filters button for quick reset

### Table Display
- Shows filtered results with pagination
- Status badges with color coding
- User and offer details in expandable rows
- Action buttons for approve/reject/view
- Real-time count of filtered results

---

## 📝 Notes

1. **Case Sensitivity**: Text filters are case-insensitive for better UX
2. **Partial Matching**: Name filters support partial matches (substring search)
3. **Date Ranges**: End date includes the entire day (23:59:59)
4. **Pagination**: Resets to page 1 when filters change
5. **Performance**: Filters are applied server-side for efficiency
6. **Real-time**: All filters trigger immediate API calls

---

## 🔄 Future Enhancements

- [ ] Export filtered results to CSV
- [ ] Save filter presets
- [ ] Advanced search with AND/OR logic
- [ ] Filter history
- [ ] Bulk actions on filtered results
- [ ] Filter suggestions based on data
- [ ] Custom date range presets (Last 7 days, Last 30 days, etc.)

---

**Last Updated:** November 24, 2025
**Version:** 1.0
