# Implementation Plan: Offer Enhancements

## Overview

This implementation plan covers five offer management enhancements: vertical classification, geo-restriction, revenue sharing, incentive type, and preview page. Tasks are organized to build incrementally with testing at each stage.

## Tasks

- [x] 1. Database Schema and Constants Setup
  - [x] 1.1 Add VALID_VERTICALS constant and CATEGORY_TO_VERTICAL_MAP to offer model
    - Create constants in `backend/models/offer.py`
    - Define 10 verticals: Finance, Gaming, Dating, Health, E-commerce, Entertainment, Education, Travel, Utilities, Lifestyle
    - Create mapping from old category values to new verticals
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 1.2 Update offer schema with new fields
    - Add `vertical` field (replaces category)
    - Add `allowed_countries` array field
    - Add `non_access_url` string field
    - Add `revenue_share_percent` float field (0-100)
    - Add `incentive_type` string field ('Incent' or 'Non-Incent')
    - Update `create_offer` method to handle new fields
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_

  - [x] 1.3 Add calculate_incentive_type helper function
    - Create function that returns 'Non-Incent' if revenue_share_percent > 0, else 'Incent'
    - Integrate into create_offer and update_offer methods
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ]* 1.4 Write property tests for incentive type calculation
    - **Property 8: Incentive Type Auto-Calculation (Percentage)**
    - **Property 9: Incentive Type Auto-Calculation (Fixed)**
    - **Validates: Requirements 4.2, 4.3**

- [x] 2. Checkpoint - Verify schema changes
  - Ensure all tests pass, ask the user if questions arise.

- [-] 3. Bulk Upload Service Updates
  - [x] 3.1 Update SPREADSHEET_TO_DB_MAPPING with new columns
    - Add mappings for 'vertical', 'category' → 'vertical'
    - Add mappings for 'non_access_url', 'fallback_url' → 'non_access_url'
    - Add mappings for 'percent', 'revenue_share_percent' → 'revenue_share_percent'
    - _Requirements: 1.7, 2.5, 3.4_

  - [x] 3.2 Implement parse_payout_value function for percentage detection
    - Detect '%' character in payout values
    - Extract numeric value and set as revenue_share_percent
    - Return tuple of (fixed_payout, revenue_share_percent)
    - _Requirements: 3.5_

  - [x] 3.3 Update validate_spreadsheet_data for vertical validation
    - Validate vertical is one of 10 predefined values
    - Return user-friendly error for invalid verticals
    - _Requirements: 2.6_

  - [x] 3.4 Update apply_default_values to auto-calculate incentive_type
    - Call calculate_incentive_type based on revenue_share_percent
    - Set default vertical to 'Lifestyle' if not specified
    - _Requirements: 4.4_

  - [ ]* 3.5 Write property tests for bulk upload parsing
    - **Property 4: Backward Compatible Column Mapping**
    - **Property 7: Percentage Payout Detection in Bulk Upload**
    - **Validates: Requirements 2.5, 3.5**

- [ ] 4. Checkpoint - Verify bulk upload changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Geo-Restriction Implementation
  - [x] 5.1 Add check_geo_access function to offer_serving.py
    - Check if user's country is in offer's allowed_countries
    - Return (is_allowed, redirect_url) tuple
    - Use non_access_url or default fallback if blocked
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 5.2 Integrate geo-check into click tracking flow
    - Call check_geo_access before redirecting
    - Log geo-blocked redirects for analytics
    - Update apply_schedule_and_smart_rules to include geo check
    - _Requirements: 1.4, 1.5, 1.8_

  - [x] 5.3 Add DEFAULT_NON_ACCESS_URL configuration
    - Add to config.py or environment variables
    - Use as fallback when offer's non_access_url is empty
    - _Requirements: 1.6_

  - [ ]* 5.4 Write property tests for geo-restriction logic
    - **Property 1: Geo-Restriction Redirect Logic**
    - **Property 2: Geo-Allowed Access**
    - **Validates: Requirements 1.4, 1.5**

- [ ] 6. Checkpoint - Verify geo-restriction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Revenue Share Calculation
  - [x] 7.1 Add calculate_downward_payout function to postback_receiver.py
    - Calculate: upward_payout × (revenue_share_percent / 100)
    - Fall back to fixed payout if percent is 0 or null
    - _Requirements: 3.2, 3.3_

  - [x] 7.2 Integrate revenue share into postback forwarding
    - Update receive_postback function to use calculate_downward_payout
    - Log both upward and downward payout values
    - _Requirements: 3.2, 3.6_

  - [ ]* 7.3 Write property tests for revenue share calculation
    - **Property 5: Revenue Share Calculation**
    - **Property 6: Fixed Payout Fallback**
    - **Validates: Requirements 3.2, 3.3**

- [ ] 8. Checkpoint - Verify revenue share
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Preview Page Implementation
  - [x] 9.1 Create preview page template
    - Create `backend/templates/preview_page.html`
    - Include countdown timer (8 seconds)
    - Display offer name, description, payout
    - Add Skip button for immediate redirect
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 9.2 Add preview route to offer_serving.py
    - Create `/preview/<offer_id>` endpoint
    - Fetch offer details and render preview template
    - Pass non_access_url (or default) as redirect target
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 10. Frontend Updates
  - [x] 10.1 Update AddOfferModal with new fields
    - Replace Category dropdown with Vertical dropdown (10 options)
    - Add Allowed Countries multi-select
    - Add Non-Access URL input field
    - Add Revenue Share Percent input (0-100)
    - Display auto-calculated Incentive Type (read-only)
    - _Requirements: 1.1, 1.2, 2.3, 3.1, 4.5_

  - [x] 10.2 Update EditOfferModal with same fields
    - Mirror changes from AddOfferModal
    - Ensure incentive_type recalculates on payout changes
    - _Requirements: 4.6_

  - [x] 10.3 Update offer display components
    - Change "Category" label to "Vertical" in all tables and modals
    - Add Incentive Type column to offer tables
    - Show Revenue Share Percent if configured
    - _Requirements: 2.4, 3.7, 4.5_

  - [x] 10.4 Update OfferDetailsModal
    - Display new fields: vertical, allowed_countries, non_access_url
    - Show revenue_share_percent and incentive_type
    - _Requirements: 2.4, 3.7, 4.5_

- [x] 11. Checkpoint - Verify frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Migration and Cleanup
  - [x] 12.1 Create migration script for existing offers
    - Map old category values to new vertical values
    - Calculate and set incentive_type for all existing offers
    - Set default values for new fields (empty allowed_countries, null non_access_url)
    - _Requirements: 2.7_

  - [ ] 12.2 Update API documentation
    - Document new fields in offer schema
    - Document new endpoints (preview page)
    - Update bulk upload template with new columns
    - _Requirements: All_

- [ ] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end flow: create offer → bulk upload → click tracking → postback

## Notes

- Tasks marked with `*` are optional property-based tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
