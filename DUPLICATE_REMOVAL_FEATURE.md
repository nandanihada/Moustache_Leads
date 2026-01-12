# Duplicate Offer Removal Feature

## Overview
This feature allows admins to detect and remove duplicate offers based on `offer_id`. When duplicates are found, the system keeps the newest version and removes all older duplicates.

## How It Works

### Backend Components

1. **DuplicateOfferRemover** (`backend/utils/duplicate_remover.py`)
   - Detects duplicate offers by grouping on `offer_id`
   - Provides summary of duplicates without removing them
   - Removes duplicates with configurable strategy (keep newest or oldest)

2. **API Endpoints** (`backend/routes/admin_offers.py`)
   - `GET /api/admin/offers/duplicates/check` - Check for duplicates without removing
   - `POST /api/admin/offers/duplicates/remove` - Remove duplicates

### Frontend Components

1. **AdminOfferApi Service** (`src/services/adminOfferApi.ts`)
   - `checkDuplicates()` - Calls the check endpoint
   - `removeDuplicates(keepStrategy)` - Calls the remove endpoint with strategy

2. **AdminOffers Page** (`src/pages/AdminOffers.tsx`)
   - "Remove Duplicates" button in the top action bar
   - Shows confirmation dialog with duplicate statistics
   - Displays success/error messages via toast notifications

## Usage

### For Admins

1. Navigate to the **Offers Management** page in the admin panel
2. Click the **"Remove Duplicates"** button (orange button with trash icon)
3. The system will:
   - Check for duplicate offers
   - Show a confirmation dialog with statistics:
     - Number of offer_ids with duplicates
     - Total duplicate documents found
     - Number of documents to be removed
   - Ask for confirmation before proceeding
4. If confirmed, duplicates are removed and the page refreshes

### Strategy

By default, the system uses the **"newest"** strategy:
- Keeps the offer with the most recent `updated_at` or `created_at` timestamp
- Removes all older versions

Alternative strategy **"oldest"** can be used programmatically:
- Keeps the first created offer
- Removes all newer versions

## Example Scenario

**Before:**
```
offer_id: "OFFER-123" (3 documents)
  - Document 1: created 2025-01-01, updated 2025-01-05
  - Document 2: created 2025-01-02, updated 2025-01-08  ← KEPT (newest)
  - Document 3: created 2025-01-03, updated 2025-01-06

offer_id: "OFFER-456" (2 documents)
  - Document 1: created 2025-01-01
  - Document 2: created 2025-01-02, updated 2025-01-09  ← KEPT (newest)
```

**After Removal:**
```
offer_id: "OFFER-123" (1 document)
  - Document 2: created 2025-01-02, updated 2025-01-08

offer_id: "OFFER-456" (1 document)
  - Document 2: created 2025-01-02, updated 2025-01-09
```

**Result:** 3 duplicate documents removed, 2 unique offers remain

## API Response Examples

### Check Duplicates Response
```json
{
  "success": true,
  "summary": {
    "total_duplicate_groups": 2,
    "total_duplicate_documents": 5,
    "total_documents_to_remove": 3,
    "duplicate_groups": [
      {
        "offer_id": "OFFER-123",
        "count": 3,
        "documents": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "name": "Example Offer",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-05T00:00:00Z",
            "status": "active"
          },
          // ... more documents
        ]
      }
    ]
  }
}
```

### Remove Duplicates Response
```json
{
  "success": true,
  "message": "Successfully removed 3 duplicate offers",
  "total_duplicates_found": 5,
  "removed": 3
}
```

## Error Handling

- If no duplicates are found, shows a friendly message
- If removal fails, shows error details
- Non-blocking: errors for individual offers don't stop the entire process
- All errors are logged for debugging

## Security

- Requires admin authentication (`@token_required`)
- Requires admin or subadmin role with 'offers' permission
- Confirmation dialog prevents accidental deletion

## Technical Details

### Database Query
Uses MongoDB aggregation pipeline:
```javascript
[
  {
    $group: {
      _id: '$offer_id',
      count: { $sum: 1 },
      docs: { $push: '$$ROOT' }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
]
```

### Keep Strategy Logic
- **Newest**: Sorts by `updated_at` DESC, then `created_at` DESC
- **Oldest**: Sorts by `created_at` ASC

## Future Enhancements

Possible improvements:
- Scheduled automatic duplicate detection
- Email notifications when duplicates are found
- Duplicate prevention during offer creation
- Merge duplicate data instead of just deleting
- Configurable keep strategy from UI
- Bulk duplicate resolution with manual selection

## Testing

To test the feature:
1. Create duplicate offers with the same `offer_id`
2. Click "Remove Duplicates" button
3. Verify only one offer per `offer_id` remains
4. Check that the newest version was kept

## Troubleshooting

**Issue:** Button doesn't appear
- **Solution:** Ensure you're logged in as admin

**Issue:** "No duplicates found" but duplicates exist
- **Solution:** Check that offers have the same exact `offer_id` (case-sensitive)

**Issue:** Wrong offer version kept
- **Solution:** Check `updated_at` and `created_at` timestamps

## Related Files

- `backend/utils/duplicate_remover.py` - Core duplicate detection logic
- `backend/routes/admin_offers.py` - API endpoints
- `src/services/adminOfferApi.ts` - Frontend API service
- `src/pages/AdminOffers.tsx` - UI component
