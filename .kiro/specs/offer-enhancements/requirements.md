# Requirements Document

## Introduction

This document specifies the requirements for enhancing the offer management system with five new features: country-based access control with fallback URLs, renaming category to vertical with 10 predefined options, percentage-based revenue sharing for postbacks, auto-calculated incentive type, and preview URL with delayed redirect functionality. These features apply to both manual offer creation and bulk upload via spreadsheet.

## Glossary

- **Offer_System**: The core offer management module handling offer creation, display, and tracking
- **Geo_Service**: The geolocation service that detects user country from IP address
- **Postback_Processor**: The module that receives conversion postbacks from upward partners and forwards to downward partners
- **Bulk_Upload_Service**: The utility that parses spreadsheets (Excel/CSV/Google Sheets) and creates offers in bulk
- **Vertical**: The industry category classification for offers (replaces "category")
- **Non_Access_URL**: A fallback URL shown to users who don't match the offer's allowed countries
- **Revenue_Share_Percent**: The percentage of upward partner payout forwarded to downward partners
- **Incentive_Type**: Classification of offer as "Incent" (fixed payout) or "Non-Incent" (percentage payout)
- **Preview_Page**: An intermediate page shown before redirecting to the actual offer URL

## Requirements

### Requirement 1: Country-Based Access Control

**User Story:** As an admin, I want to restrict offers to specific countries and show a fallback URL to users from non-allowed countries, so that I can control offer visibility based on geographic targeting.

#### Acceptance Criteria

1. WHEN an admin creates or edits an offer, THE Offer_System SHALL provide a field to specify allowed countries (array of country codes)
2. WHEN an admin creates or edits an offer, THE Offer_System SHALL provide a field to specify a non_access_url (fallback URL for non-allowed users)
3. WHEN a user clicks on an offer, THE Geo_Service SHALL detect the user's country from their IP address
4. IF the user's country is NOT in the offer's allowed_countries list, THEN THE Offer_System SHALL redirect the user to the non_access_url instead of the target_url
5. IF the user's country IS in the offer's allowed_countries list, THEN THE Offer_System SHALL redirect the user to the target_url normally
6. WHEN the non_access_url is not specified, THE Offer_System SHALL use a default fallback URL (configurable system-wide)
7. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL accept a "non_access_url" column in the spreadsheet
8. THE Offer_System SHALL log all geo-blocked redirects for analytics purposes

### Requirement 2: Rename Category to Vertical

**User Story:** As an admin, I want to classify offers by vertical (industry type) with 10 predefined options, so that I can better organize and filter offers.

#### Acceptance Criteria

1. THE Offer_System SHALL rename the "category" field to "vertical" in the database schema
2. THE Offer_System SHALL provide exactly 10 predefined vertical options: Finance, Gaming, Dating, Health, E-commerce, Entertainment, Education, Travel, Utilities, Lifestyle
3. WHEN an admin creates or edits an offer, THE Offer_System SHALL display a dropdown with the 10 vertical options
4. WHEN displaying offers in the frontend, THE Offer_System SHALL show "Vertical" instead of "Category" in all labels and columns
5. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL accept both "vertical" and "category" column names (for backward compatibility)
6. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL validate that the vertical value matches one of the 10 predefined options
7. THE Offer_System SHALL migrate existing offers by mapping old category values to the closest vertical option

### Requirement 3: Percentage-Based Revenue Sharing

**User Story:** As an admin, I want to specify a revenue share percentage for offers, so that when we receive postbacks from upward partners, we forward that percentage of the payout to downward partners.

#### Acceptance Criteria

1. WHEN an admin creates or edits an offer, THE Offer_System SHALL provide a "revenue_share_percent" field (0-100)
2. WHEN the revenue_share_percent is specified, THE Postback_Processor SHALL calculate downward_payout as: upward_payout × (revenue_share_percent / 100)
3. WHEN the revenue_share_percent is NOT specified or is 0, THE Postback_Processor SHALL use the offer's fixed payout amount
4. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL accept a "percent" or "revenue_share_percent" column
5. IF the spreadsheet contains a percentage value in the payout column (e.g., "50%"), THEN THE Bulk_Upload_Service SHALL extract the percentage and set revenue_share_percent accordingly
6. THE Postback_Processor SHALL log both the original upward payout and the calculated downward payout for audit purposes
7. WHEN displaying offers, THE Offer_System SHALL show the revenue share percentage if configured

### Requirement 4: Auto-Calculated Incentive Type

**User Story:** As an admin, I want the system to automatically determine if an offer is "Incent" or "Non-Incent" based on the payout type, so that I can easily identify offer characteristics.

#### Acceptance Criteria

1. THE Offer_System SHALL add an "incentive_type" field to offers with values: "Incent" or "Non-Incent"
2. WHEN an offer has a revenue_share_percent > 0 (percentage-based payout), THE Offer_System SHALL automatically set incentive_type to "Non-Incent"
3. WHEN an offer has a fixed payout amount (no percentage), THE Offer_System SHALL automatically set incentive_type to "Incent"
4. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL auto-calculate incentive_type based on whether the payout is a percentage or fixed amount
5. WHEN displaying offers in tables and details, THE Offer_System SHALL show the incentive_type column
6. THE Offer_System SHALL recalculate incentive_type whenever the payout or revenue_share_percent is updated

### Requirement 5: Preview URL with Delayed Redirect

**User Story:** As an admin, I want the preview URL to show a default page for 8 seconds before redirecting to a safe URL, so that users can see offer information before being redirected.

#### Acceptance Criteria

1. WHEN a user accesses the preview_url of an offer, THE Offer_System SHALL display a preview page for 8 seconds
2. AFTER 8 seconds on the preview page, THE Offer_System SHALL automatically redirect the user to the non_access_url (same URL used for country mismatch)
3. THE preview page SHALL display a countdown timer showing seconds remaining
4. THE preview page SHALL display basic offer information (name, description, payout)
5. THE preview page SHALL provide a "Skip" button to immediately redirect to the non_access_url
6. WHEN the non_access_url is not configured, THE Offer_System SHALL redirect to a default safe URL
7. WHEN bulk uploading offers, THE Bulk_Upload_Service SHALL accept a "preview_url" column (existing functionality maintained)
