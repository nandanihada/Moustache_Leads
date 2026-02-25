# Bulk Upload Validation Feedback Enhancement

## Overview
Enhanced the bulk offer upload feature to provide detailed, actionable feedback when validation errors occur, making it easier for admins to fix their spreadsheets. Additionally, added the ability to skip invalid rows and proceed with uploading only valid offers.

## Key Features

### 1. Skip Invalid Rows Option
When a spreadsheet contains both valid and invalid rows:
- The system shows how many valid offers can be uploaded
- A "Skip Invalid & Upload Valid Offers" button appears
- Admins can choose to:
  - Fix the invalid rows and re-upload the entire sheet, OR
  - Proceed immediately with only the valid offers
- Invalid rows are reported but don't block the upload of valid data

### 2. Special Network Handling
For networks **cpamerchant**, **leadads**, and **chameleonads**:
- `target_url` is now **optional** if `campaign_id` (offer_id) is present
- The system automatically generates tracking URLs for these networks
- Users are warned when auto-generation will occur

### 2. Detailed Validation Feedback
When validation errors occur, the system now provides:

#### Summary Information
- Total number of issues found
- Breakdown by error type (missing fields, invalid format, invalid values)

#### Special Network Information
- Lists networks that support auto-generated tracking URLs
- Explains the requirements for auto-generation

#### Fix Suggestions
For each missing or invalid field, provides:
- **Issue**: What's wrong
- **Solution**: How to fix it
- **Example**: Sample correct value

Example fix suggestion:
```
Issue: Missing target URL in one or more rows
Solution: Add a 'url' or 'target_url' column with valid URLs. 
          NOTE: For networks cpamerchant, leadads, chameleonads, 
          target_url is optional if campaign_id is provided.
Example: https://example.com/offer?id=123
```

#### Required Fields Reference
- Complete list of required fields with descriptions
- Helps admins understand what each field is for

#### Column Mapping Reference
- Shows all accepted column name variations
- Example: `campaign_id` can also be named `offer_id`

### 3. Enhanced Error Display
The UI now shows:
- **Skip Option Alert**: Green alert showing valid offer count with options to fix or skip
- **Validation Issues Panel**: Prominent amber-colored panel with detailed feedback
- **Expandable Sections**: Required fields and column mappings in collapsible sections
- **Row-by-Row Errors**: Specific errors for each problematic row
- **Missing Fields**: Clear indication of which fields are missing per row
- **Warnings**: Non-critical warnings (e.g., "target_url will be auto-generated")
- **Action Button**: Dynamic button that changes to "Skip Invalid & Upload Valid" when applicable

## Technical Implementation

### Backend Changes

#### `bulk_offer_upload.py`
1. **Updated `validate_spreadsheet_data()`**:
   - Added special network detection
   - Skip `target_url` requirement for special networks when `campaign_id` is present
   - Track warnings separately from errors
   - Include warnings in validation results

2. **New `generate_validation_feedback()` function**:
   - Analyzes all validation errors
   - Generates field-specific fix suggestions
   - Provides special network information
   - Returns structured feedback object

#### `admin_offers.py`
- Updated bulk upload route to call `generate_validation_feedback()`
- Returns detailed feedback in error response
- Includes both validation errors and missing offers
- Added `skip_invalid_rows` option support
- When `skip_invalid_rows=true` and there are valid rows, proceeds with upload
- Returns `can_skip_invalid` flag to indicate if skip option is available

### Frontend Changes

#### `BulkOfferUpload.tsx`
1. **Updated `UploadResult` interface**:
   - Added `validation_feedback` field
   - Added `missing_offers` array
   - Added `can_skip_invalid` boolean flag
   - Added `valid_count` number
   - Enhanced error objects with `missing_fields` and `warnings`

2. **Updated `handleUpload()` function**:
   - Now accepts `skipInvalidRows` parameter
   - Passes `skip_invalid_rows` option to backend
   - Preserves upload result when retrying with skip option

3. **New UI Components**:
   - Skip Option Alert (green) showing valid offer count
   - Validation Issues Panel with amber styling
   - Special Network Info alert (blue)
   - Fix Suggestions cards with numbered steps
   - Expandable Required Fields reference
   - Expandable Column Mapping reference
   - Enhanced error display with missing fields and warnings
   - Dynamic "Skip Invalid & Upload Valid" button (amber)
   - Button shows count of valid offers to be uploaded

#### `bulkOfferApi.ts`
- Updated error handling to capture `validation_feedback` and `can_skip_invalid`
- Updated `BulkUploadResult` interface to match backend response
- Added `skip_invalid_rows` to `BulkUploadOptions` interface
- Enhanced error object with `valid_count` and `can_skip_invalid` fields

## Usage Example

### Scenario 1: Admin uploads sheet with 10 rows - 7 valid, 3 invalid

**Before**: 
```
Error: Validation errors found in spreadsheet
(All 10 rows rejected, nothing uploaded)
```

**After**:
```
Validation Issues Found

Found 3 row(s) with issues. 3 row(s) have missing required fields.

✅ Good news! You have 7 valid offer(s) in your spreadsheet.

You can either:
• Fix the invalid rows and re-upload the entire sheet
• Click "Skip Invalid & Upload Valid Offers" below to proceed with only the valid offers

[Skip Invalid & Upload 7 Valid Offers] button appears

How to Fix Your Spreadsheet:
1. Missing target URL in 3 rows
   Add a 'url' or 'target_url' column with valid URLs...
   Example: https://example.com/offer?id=123

[View All Required Fields]
[View Accepted Column Names]
```

### Scenario 2: Admin uploads sheet with missing target_url for cpamerchant offers

**Before**: 
```
Error: No valid data found in spreadsheet
```

**After**:
```
Validation Issues Found

Found 5 row(s) with issues. 5 row(s) have missing required fields.

Special Networks:
For networks cpamerchant, leadads, chameleonads, the target_url field 
is optional if campaign_id is provided. The system will automatically 
generate the tracking URL.

How to Fix Your Spreadsheet:

1. Missing target URL in one or more rows
   Add a 'url' or 'target_url' column with valid URLs. 
   NOTE: For networks cpamerchant, leadads, chameleonads, target_url 
   is optional if campaign_id is provided - it will be auto-generated.
   Example: https://example.com/offer?id=123

[View All Required Fields]
[View Accepted Column Names]
```

## Benefits

1. **Reduced Support Burden**: Admins can self-diagnose and fix issues
2. **Faster Onboarding**: Clear guidance on spreadsheet format
3. **Fewer Errors**: Specific examples help prevent common mistakes
4. **Better UX**: Professional, helpful error messages instead of generic failures
5. **Special Network Support**: Automatic handling of networks with generated URLs
6. **Flexible Upload**: Can proceed with partial data instead of all-or-nothing
7. **Time Savings**: No need to fix entire sheet if only a few rows are invalid
8. **Productivity**: Upload valid offers immediately while fixing invalid ones separately

## Testing Recommendations

1. Test with sheet missing various required fields
2. Test with special networks (cpamerchant, leadads, chameleonads) with and without target_url
3. Test with invalid data formats (bad URLs, invalid payouts, etc.)
4. Test with mixed valid/invalid rows - verify skip option appears
5. Test skip functionality - verify only valid rows are uploaded
6. Test with all invalid rows - verify skip option does NOT appear
7. Test with all valid rows - verify normal upload flow
8. Verify all expandable sections work correctly
9. Check mobile responsiveness of validation feedback panel
10. Verify success message shows correct count when skipping invalid rows
