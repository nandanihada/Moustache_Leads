# Skip Invalid Rows Feature

## Overview
When uploading a spreadsheet with mixed valid and invalid offers, admins can now choose to skip the invalid rows and proceed with uploading only the valid offers.

## How It Works

### Step 1: Upload Spreadsheet
Admin uploads a spreadsheet (Excel, CSV, or Google Sheets URL) containing offer data.

### Step 2: Validation
The system validates each row and categorizes them as:
- **Valid**: Rows with all required fields and correct data format
- **Invalid**: Rows with missing required fields or invalid data format

### Step 3: Feedback Display
If there are validation errors, the system shows:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Validation Issues Found                             │
│                                                          │
│ Found 3 row(s) with issues. 3 row(s) have missing      │
│ required fields.                                         │
│                                                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ✅ Good news! You have 7 valid offer(s)         │    │
│ │                                                  │    │
│ │ You can either:                                  │    │
│ │ • Fix the invalid rows and re-upload            │    │
│ │ • Click "Skip Invalid & Upload Valid Offers"    │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ How to Fix Your Spreadsheet:                            │
│ 1. Missing target URL in 3 rows                         │
│    Solution: Add a 'url' or 'target_url' column...     │
│    Example: https://example.com/offer?id=123           │
│                                                          │
│ [View All Required Fields] [View Accepted Column Names] │
└─────────────────────────────────────────────────────────┘

Rows with Missing Required Fields (3)
├─ Row 2: Missing: target_url, description
├─ Row 5: Missing: campaign_id
└─ Row 8: Missing: name, countries

[Close]  [Skip Invalid & Upload 7 Valid Offers]
```

### Step 4: Admin Choice

#### Option A: Fix and Re-upload
1. Admin closes the dialog
2. Fixes the invalid rows in the spreadsheet
3. Re-uploads the entire sheet

#### Option B: Skip Invalid & Upload Valid
1. Admin clicks "Skip Invalid & Upload 7 Valid Offers"
2. System uploads only the 7 valid offers
3. Success message shows: "Successfully created 7 offers (3 rows skipped)"
4. Invalid rows are logged for later review

## Technical Details

### Backend Logic
```python
# In admin_offers.py
if error_rows or missing_offers_rows:
    # Generate detailed feedback
    validation_feedback = generate_validation_feedback(error_rows, missing_offers_rows)
    
    # Check if there are valid rows
    can_skip_invalid = len(valid_rows) > 0
    
    # If user requested to skip invalid rows AND there are valid rows
    skip_invalid = options.get('skip_invalid_rows', False)
    
    if skip_invalid and can_skip_invalid:
        # Proceed with uploading only valid rows
        logging.info(f"Skipping {len(error_rows) + len(missing_offers_rows)} invalid rows")
        # Continue to bulk_create_offers with valid_rows
    else:
        # Return validation errors
        return jsonify({
            'validation_feedback': validation_feedback,
            'can_skip_invalid': can_skip_invalid,
            'valid_count': len(valid_rows)
        }), 400
```

### Frontend Logic
```typescript
// In BulkOfferUpload.tsx
const handleUpload = async (skipInvalidRows: boolean = false) => {
    const uploadOptions = {
        // ... other options
        skip_invalid_rows: skipInvalidRows,
    };
    
    // Upload with options
    result = await bulkOfferApi.uploadFile(selectedFile, uploadOptions);
};

// Show skip button when applicable
{uploadResult.can_skip_invalid && uploadResult.valid_count > 0 && (
    <Button onClick={() => handleUpload(true)}>
        Skip Invalid & Upload {uploadResult.valid_count} Valid Offers
    </Button>
)}
```

## User Experience Flow

### Scenario: 10 rows uploaded, 7 valid, 3 invalid

1. **Initial Upload**
   - User uploads spreadsheet
   - System validates all rows
   - Shows validation errors

2. **Decision Point**
   - User sees: "7 valid offers, 3 invalid rows"
   - Two clear options presented
   - No confusion about what to do next

3. **Skip Option Selected**
   - User clicks "Skip Invalid & Upload 7 Valid Offers"
   - System re-submits with `skip_invalid_rows: true`
   - Only valid rows are processed

4. **Success Feedback**
   - "Successfully created 7 offers"
   - Invalid rows are documented
   - User can review and fix them later

## Benefits

### For Admins
- **No All-or-Nothing**: Don't have to fix everything before uploading anything
- **Time Savings**: Get valid offers live immediately
- **Flexibility**: Can fix invalid rows at their own pace
- **Clear Feedback**: Know exactly what's wrong and what's working

### For Business
- **Faster Onboarding**: New offers go live faster
- **Reduced Friction**: Less frustration with bulk uploads
- **Better Data Quality**: Invalid data is flagged but doesn't block progress
- **Improved Workflow**: Parallel processing - upload valid, fix invalid separately

## Edge Cases Handled

1. **All Rows Invalid**: Skip button does NOT appear, must fix errors
2. **All Rows Valid**: Normal upload flow, no validation errors shown
3. **No Valid Rows**: Clear message, must fix at least one row
4. **Duplicate Detection**: Works with skip feature - duplicates are skipped separately
5. **Special Networks**: Auto-generated URLs work with skip feature

## Security Considerations

- Only valid, fully-validated rows are uploaded
- Invalid rows are never partially processed
- All validation rules still apply to valid rows
- No bypass of security checks

## Future Enhancements

1. **Save Invalid Rows**: Option to save invalid rows for later editing
2. **Batch Fix**: Bulk edit invalid rows in the UI
3. **Preview**: Show preview of valid offers before uploading
4. **Export Invalid**: Download CSV of only invalid rows
5. **Auto-Fix**: Suggest automatic fixes for common errors
