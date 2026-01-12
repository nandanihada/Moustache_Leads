# Duplicate Offer Removal - Quick Start Guide

## What This Feature Does

Automatically detects and removes duplicate offers that share the same `offer_id`, keeping only the newest version of each offer.

## How to Use (Admin Panel)

### Step 1: Access the Feature
1. Log in to the admin panel
2. Navigate to **Offers Management**
3. Look for the **"Remove Duplicates"** button (orange button with trash icon)

### Step 2: Check and Remove Duplicates
1. Click the **"Remove Duplicates"** button
2. The system will scan all offers and show a confirmation dialog:
   ```
   Found 2 offer_id(s) with duplicates.
   
   Total duplicate documents: 5
   Documents to be removed: 3
   
   The newest version of each offer will be kept.
   
   Do you want to proceed with removing duplicates?
   ```
3. Click **OK** to proceed or **Cancel** to abort
4. If you proceed, duplicates will be removed and you'll see a success message
5. The offers list will automatically refresh

### Step 3: Verify Results
- Check that only one offer exists per `offer_id`
- Verify that the newest version was kept (check the "Date Added" column)

## When to Use This Feature

Use this feature when:
- ✅ You've imported offers from multiple sources
- ✅ Bulk uploads created duplicate entries
- ✅ API imports resulted in duplicate offers
- ✅ You notice the same offer appearing multiple times
- ✅ You want to clean up your offers database

## What Gets Kept vs Removed

### Kept (1 per offer_id)
- ✅ The offer with the most recent `updated_at` timestamp
- ✅ If no `updated_at`, uses the most recent `created_at`
- ✅ All data from this version is preserved

### Removed (all others)
- ❌ Older versions of the same offer_id
- ❌ All associated data is permanently deleted

## Example

**Before:**
```
Offer ID: OFFER-123
  - Version 1: Created Jan 1, Updated Jan 5
  - Version 2: Created Jan 2, Updated Jan 8  ← KEPT
  - Version 3: Created Jan 3, Updated Jan 6

Offer ID: OFFER-456
  - Version 1: Created Jan 1
  - Version 2: Created Jan 2, Updated Jan 9  ← KEPT
```

**After:**
```
Offer ID: OFFER-123
  - Version 2: Created Jan 2, Updated Jan 8

Offer ID: OFFER-456
  - Version 2: Created Jan 2, Updated Jan 9
```

**Result:** 3 duplicates removed, 2 unique offers remain

## Testing (Backend)

To test the feature from the backend:

```bash
# Check for duplicates (no removal)
python backend/test_duplicate_removal.py --check

# Create test duplicates
python backend/test_duplicate_removal.py --create-test

# Remove duplicates (with confirmation)
python backend/test_duplicate_removal.py --remove

# Clean up test data
python backend/test_duplicate_removal.py --cleanup-test

# Run full test suite
python backend/test_duplicate_removal.py --full-test
```

## API Endpoints

For programmatic access:

### Check for Duplicates
```bash
GET /api/admin/offers/duplicates/check
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "summary": {
    "total_duplicate_groups": 2,
    "total_duplicate_documents": 5,
    "total_documents_to_remove": 3,
    "duplicate_groups": [...]
  }
}
```

### Remove Duplicates
```bash
POST /api/admin/offers/duplicates/remove
Authorization: Bearer <token>
Content-Type: application/json

{
  "keep_strategy": "newest"
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully removed 3 duplicate offers",
  "total_duplicates_found": 5,
  "removed": 3
}
```

## Safety Features

- ✅ **Confirmation Required**: Shows detailed statistics before removal
- ✅ **Admin Only**: Requires admin authentication
- ✅ **Non-Destructive Check**: Can check without removing
- ✅ **Error Handling**: Individual failures don't stop the process
- ✅ **Logging**: All actions are logged for audit trail
- ✅ **Automatic Refresh**: UI updates after removal

## Troubleshooting

### "No Duplicates Found" but I see duplicates
- Check that offers have the **exact same** `offer_id` (case-sensitive)
- Verify offers are not soft-deleted (`is_active: true`)

### Wrong version was kept
- The system keeps the version with the most recent `updated_at` timestamp
- Check the timestamps in the database to verify

### Button doesn't appear
- Ensure you're logged in as an admin
- Check that you have the 'offers' permission

### Removal failed
- Check the error message in the toast notification
- Review backend logs for detailed error information
- Ensure database connection is stable

## Best Practices

1. **Check First**: Always use the check feature before removing
2. **Backup**: Consider backing up your database before bulk operations
3. **Off-Peak**: Run during low-traffic periods for large datasets
4. **Verify**: Check a few offers manually after removal
5. **Regular Cleanup**: Run periodically to prevent duplicate buildup

## Technical Notes

- Uses MongoDB aggregation for efficient duplicate detection
- Processes duplicates in batches to avoid memory issues
- Keeps the newest version based on `updated_at` or `created_at`
- All operations are logged for debugging and audit purposes

## Support

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify database connectivity
3. Ensure proper admin permissions
4. Review the documentation in `DUPLICATE_REMOVAL_FEATURE.md`
