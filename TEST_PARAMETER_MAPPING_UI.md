# Testing Guide: Parameter Mapping UI

## Quick Test Checklist

### ✅ Test 1: Open the Enhanced Modal
1. Navigate to Partners page
2. Click "Generate Postback URL" button
3. **Expected**: Modal opens with enhanced UI showing:
   - Basic Information section
   - Parameter Mapping section with table
   - Partner template dropdown
   - Example and info sections

### ✅ Test 2: Partner Template Selection
1. Open the modal
2. Try each template from dropdown:
   - LeadAds
   - CPALead
   - OfferToro
   - AdGate Media
   - Custom

3. **Expected**: Parameter mappings auto-fill based on template:
   - **LeadAds**: user_id → aff_sub, status → status, payout → payout, transaction_id → transaction_id
   - **CPALead**: user_id → subid, click_id → s2, status → status, payout → payout
   - **OfferToro**: user_id → user_id, status → status, payout → amount, transaction_id → oid
   - **AdGate Media**: user_id → subid, status → status, payout → payout
   - **Custom**: Empty mappings

### ✅ Test 3: Add Parameter Mapping
1. Open modal
2. Click "+ Add Parameter" button
3. **Expected**: New row appears in the mapping table
4. Select "OUR Parameter" from dropdown
5. Enter "THEIR Parameter" in text field
6. **Expected**: New mapping is added successfully

### ✅ Test 4: Remove Parameter Mapping
1. Open modal with some mappings
2. Click trash icon (🗑) on any row
3. **Expected**: That row is removed from the table

### ✅ Test 5: Enable/Disable Mappings
1. Open modal
2. Uncheck the "Enable" checkbox on a mapping
3. **Expected**: Checkbox unchecks (mapping disabled)
4. Check it again
5. **Expected**: Checkbox checks (mapping enabled)

### ✅ Test 6: Edit Parameter Values
1. Open modal
2. Change "OUR Parameter" dropdown value
3. **Expected**: Dropdown updates
4. Change "THEIR Parameter" text field
5. **Expected**: Text field updates

### ✅ Test 7: Visual Elements
1. Open modal
2. **Verify**:
   - ✅ Arrow icons (→) appear between OUR and THEIR columns
   - ✅ Table has proper borders and styling
   - ✅ Hover effects work on rows
   - ✅ Scrollbar appears if many mappings (max-height: 256px)
   - ✅ Info section has blue background
   - ✅ Example section has gray background

### ✅ Test 8: Form Validation
1. Open modal
2. Leave "Partner Name" empty
3. Click "Generate Postback URL"
4. **Expected**: Validation error appears
5. Fill in "Partner Name"
6. Click "Generate Postback URL"
7. **Expected**: Partner is created successfully

### ✅ Test 9: Cancel and Reset
1. Open modal
2. Fill in some data and mappings
3. Click "Cancel"
4. **Expected**: Modal closes
5. Open modal again
6. **Expected**: Form is reset to default values (LeadAds template)

### ✅ Test 10: Responsive Layout
1. Open modal
2. Resize browser window
3. **Expected**: 
   - Modal remains centered
   - Table columns adjust properly
   - Scrollbar appears if needed
   - No horizontal overflow

---

## Visual Verification

### Check These UI Elements:

#### Header Section
- [ ] Title: "Generate Postback URL for Upward Partner"
- [ ] Description text is visible and clear

#### Basic Information Section
- [ ] "Basic Information" heading
- [ ] Partner Name input field
- [ ] Description textarea
- [ ] Status dropdown (Active/Inactive)

#### Parameter Mapping Section
- [ ] "Parameter Mapping" heading with "Add Parameter" button
- [ ] Partner template dropdown
- [ ] Mapping table with headers:
  - Enable | OUR Parameter | → | THEIR Parameter | Actions
- [ ] Arrow icons visible between columns
- [ ] Trash icons visible in Actions column

#### Info Sections
- [ ] Blue info box with "📋 How It Works"
- [ ] Gray example box with "💡 Example"
- [ ] Example shows parameter mapping with arrow

#### Footer
- [ ] Cancel button (outline style)
- [ ] Generate Postback URL button (primary style)

---

## Functional Testing Scenarios

### Scenario 1: Add LeadAds Partner
```
1. Click "Generate Postback URL"
2. Enter Partner Name: "LeadAds"
3. Select Template: "LeadAds" (should already be selected)
4. Verify mappings:
   ✓ user_id → aff_sub
   ✓ status → status
   ✓ payout → payout
   ✓ transaction_id → transaction_id
5. Click "Generate Postback URL"
6. Verify partner is created
```

### Scenario 2: Custom Partner with Custom Mappings
```
1. Click "Generate Postback URL"
2. Enter Partner Name: "MyCustomPartner"
3. Select Template: "Custom"
4. Click "+ Add Parameter" 3 times
5. Set mappings:
   - user_id → uid
   - status → conv_status
   - payout → amount
6. Disable the "status" mapping
7. Click "Generate Postback URL"
8. Verify partner is created with custom mappings
```

### Scenario 3: Modify Template Mappings
```
1. Click "Generate Postback URL"
2. Enter Partner Name: "CPALead Modified"
3. Select Template: "CPALead"
4. Change "subid" to "user_identifier"
5. Add new mapping: currency → curr
6. Remove the "click_id → s2" mapping
7. Click "Generate Postback URL"
8. Verify partner is created with modified mappings
```

---

## Browser Compatibility Testing

Test in these browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Check:
- [ ] Modal opens correctly
- [ ] Dropdowns work
- [ ] Checkboxes work
- [ ] Buttons work
- [ ] Styling is consistent
- [ ] No console errors

---

## Edge Cases to Test

### Edge Case 1: Empty Mappings
1. Select "Custom" template
2. Remove all mappings
3. Try to generate postback URL
4. **Expected**: Should work (mappings are optional)

### Edge Case 2: Duplicate Parameter Names
1. Add two mappings with same "OUR Parameter"
2. **Expected**: Should allow (backend will handle)

### Edge Case 3: Special Characters in THEIR Parameter
1. Enter special characters: `aff_sub-123`, `user.id`, `sub[0]`
2. **Expected**: Should accept (backend will validate)

### Edge Case 4: Very Long Parameter Names
1. Enter very long parameter name (100+ characters)
2. **Expected**: Input should handle it (may truncate in display)

### Edge Case 5: Many Mappings (10+)
1. Add 15 parameter mappings
2. **Expected**: Scrollbar appears, table remains usable

---

## Performance Testing

### Test 1: Modal Open Speed
- Open modal multiple times
- **Expected**: Opens instantly (<100ms)

### Test 2: Template Switching Speed
- Switch between templates rapidly
- **Expected**: Updates instantly, no lag

### Test 3: Adding Many Mappings
- Add 20 mappings quickly
- **Expected**: No performance degradation

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all form fields
- [ ] Enter/Space to toggle checkboxes
- [ ] Arrow keys in dropdowns
- [ ] Escape to close modal

### Screen Reader
- [ ] Labels are read correctly
- [ ] Buttons have proper aria-labels
- [ ] Table structure is announced

---

## Success Criteria

✅ All visual elements render correctly
✅ All interactive elements work as expected
✅ Templates auto-fill mappings correctly
✅ Add/remove mappings work smoothly
✅ Form validation works
✅ Modal can be opened, used, and closed without errors
✅ No console errors or warnings
✅ Responsive layout works on different screen sizes
✅ Keyboard navigation works
✅ Cross-browser compatible

---

## Known Limitations (To Be Implemented)

⚠️ **Backend Integration Pending**:
- Parameter mappings are not yet saved to database
- Postback receiver doesn't use mappings yet
- Need to update Partner model to store mappings

⚠️ **Future Enhancements**:
- Validate parameter names (no spaces, special chars)
- Show preview of generated postback URL with mappings
- Save custom templates for reuse
- Import/export parameter mappings

---

## Report Issues

If you find any issues during testing, report them with:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser and OS
5. Screenshots if applicable

---

**Testing Status**: Ready for testing
**Last Updated**: December 30, 2025
