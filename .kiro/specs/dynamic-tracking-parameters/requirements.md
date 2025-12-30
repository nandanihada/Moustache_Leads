# Requirements Document: Dynamic Tracking Parameters for Upward Partners

## Introduction

This feature enables flexible integration with multiple upward partners (like LeadAds, CPALead, etc.) who have different requirements for tracking user conversions. Each partner may require different parameters in their offer URLs (like `aff_sub`, `user_id`, `subid`, etc.) to identify which user completed an offer. The system must dynamically inject user-specific values into partner URLs and handle the corresponding postback parameters.

## Glossary

- **Upward Partner**: External offer providers (e.g., LeadAds, CPALead) who supply offers to our platform
- **Target URL**: The partner's offer URL that users are redirected to when they click an offer
- **Tracking Parameter**: A URL parameter that carries user identification or tracking data
- **Postback URL**: The URL that partners hit to notify us of conversions
- **Macro**: A placeholder in a URL template (e.g., `{user_id}`) that gets replaced with actual values
- **Bulk Upload System**: The CSV/Excel upload feature for adding multiple offers at once
- **Click ID**: Our internal unique identifier for each offer click
- **Sub ID**: Partner-specific tracking identifier (often contains our user_id)

## Requirements

### Requirement 1: Dynamic URL Parameter Injection

**User Story:** As an admin, I want to add offers with partner-specific tracking parameters, so that each partner can track conversions back to specific users.

#### Acceptance Criteria

1. WHEN an admin adds an offer with a target URL containing macros (e.g., `{user_id}`, `{click_id}`, `{placement_id}`), THE System SHALL store the URL template with macros intact
2. WHEN a user clicks an offer, THE System SHALL replace all macros in the target URL with actual values before redirecting
3. WHEN a macro is not recognized, THE System SHALL leave it unchanged and log a warning
4. THE System SHALL support at minimum these standard macros: `{user_id}`, `{click_id}`, `{placement_id}`, `{username}`, `{session_id}`, `{timestamp}`, `{country}`, `{device_type}`
5. WHEN multiple macros are present in a URL, THE System SHALL replace all of them correctly

### Requirement 2: Bulk Upload Support for Dynamic Parameters

**User Story:** As an admin, I want to bulk upload offers with dynamic tracking parameters, so that I can efficiently add hundreds of offers from different partners.

#### Acceptance Criteria

1. WHEN an admin uploads a CSV/Excel file with target URLs containing macros, THE System SHALL preserve the macros in the stored URLs
2. WHEN the bulk upload template is downloaded, THE System SHALL include examples of macro usage in the URL column
3. WHEN validating bulk upload data, THE System SHALL NOT treat macros as invalid URL components
4. THE System SHALL provide clear documentation in the bulk upload guide about supported macros
5. WHEN an offer is created via bulk upload, THE System SHALL validate that the URL structure is correct (even with macros)

### Requirement 3: Partner-Specific Postback Parameter Mapping

**User Story:** As a system, I want to map postback parameters from partners back to our internal user IDs, so that conversions are credited to the correct users.

#### Acceptance Criteria

1. WHEN a partner sends a postback with a custom parameter (e.g., `aff_sub`, `subid`, `s1`), THE System SHALL check if that parameter contains our user_id
2. WHEN the postback contains our click_id, THE System SHALL use it as the primary matching method
3. WHEN the postback does NOT contain click_id but contains a user_id in a custom parameter, THE System SHALL match the conversion using user_id + offer_id + recent timestamp
4. THE System SHALL log all received postback parameters in the `custom_data` field for debugging
5. WHEN a postback cannot be matched to a user, THE System SHALL log an error with all received parameters

### Requirement 4: Partner Configuration Management

**User Story:** As an admin, I want to configure partner-specific settings, so that each partner's integration requirements are properly handled.

#### Acceptance Criteria

1. WHEN creating a partner record, THE System SHALL allow specifying which URL parameter they use for user tracking (e.g., `aff_sub`, `subid`, `s1`)
2. WHEN creating a partner record, THE System SHALL allow specifying which postback parameter contains the user identifier
3. THE System SHALL store partner configuration in the `partners` collection
4. WHEN processing a postback, THE System SHALL use the partner's configuration to extract the user_id
5. THE System SHALL provide a UI for managing partner configurations in the admin panel

### Requirement 5: Macro Documentation and Validation

**User Story:** As an admin, I want clear documentation of available macros, so that I can correctly configure partner integrations.

#### Acceptance Criteria

1. THE System SHALL provide a comprehensive list of supported macros in the documentation
2. WHEN an admin views offer creation form, THE System SHALL display available macros with descriptions
3. WHEN an admin enters a URL with unsupported macros, THE System SHALL warn them but still allow saving
4. THE System SHALL provide example URLs for common partners (LeadAds, CPALead, etc.)
5. THE System SHALL include macro documentation in the bulk upload guide

### Requirement 6: Backward Compatibility

**User Story:** As a system, I want to maintain compatibility with existing offers, so that current integrations continue working.

#### Acceptance Criteria

1. WHEN an offer has a static URL (no macros), THE System SHALL redirect users to it unchanged
2. WHEN processing postbacks for old offers, THE System SHALL continue using the existing click_id matching logic
3. THE System SHALL NOT require migration of existing offers to use the new macro system
4. WHEN displaying offers in the admin panel, THE System SHALL show both static and dynamic URLs correctly
5. THE System SHALL support both old and new URL formats simultaneously

### Requirement 7: Testing and Debugging Support

**User Story:** As an admin, I want to test partner integrations, so that I can verify tracking is working correctly before going live.

#### Acceptance Criteria

1. THE System SHALL provide a test mode for generating tracking URLs without recording actual clicks
2. WHEN in test mode, THE System SHALL show the final URL with all macros replaced
3. THE System SHALL log all macro replacements for debugging purposes
4. WHEN a postback is received, THE System SHALL log the raw parameters before processing
5. THE System SHALL provide an admin endpoint to view recent postback logs with parameter details

### Requirement 8: Security and Validation

**User Story:** As a system, I want to validate tracking parameters, so that malicious data cannot be injected.

#### Acceptance Criteria

1. WHEN replacing macros, THE System SHALL URL-encode all values to prevent injection attacks
2. WHEN receiving postback parameters, THE System SHALL sanitize all input before processing
3. THE System SHALL validate that user_id values in postbacks match existing users
4. WHEN a postback contains suspicious data, THE System SHALL flag it for review
5. THE System SHALL rate-limit postback endpoints to prevent abuse

## Special Requirements Guidance

### Common Partner Patterns

**LeadAds Pattern:**
- Target URL: `https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}`
- Postback: They send back `aff_sub` parameter with our user_id
- Configuration: `user_param: "aff_sub"`, `postback_user_param: "aff_sub"`

**CPALead Pattern:**
- Target URL: `https://cpalead.com/offer?id=12345&subid={user_id}&s2={placement_id}`
- Postback: They send back `subid` parameter
- Configuration: `user_param: "subid"`, `postback_user_param: "subid"`

**Generic Pattern:**
- Target URL: `https://partner.com/offer?oid=123&s1={user_id}&s2={click_id}&s3={placement_id}`
- Postback: They send back `s1`, `s2`, `s3` parameters
- Configuration: `user_param: "s1"`, `postback_user_param: "s1"`

### Macro Replacement Priority

1. **User Context Macros** (highest priority):
   - `{user_id}` - MongoDB user ID
   - `{username}` - User's username
   - `{user_email}` - User's email (if available)

2. **Click Context Macros**:
   - `{click_id}` - Our unique click identifier
   - `{session_id}` - Offerwall session ID
   - `{timestamp}` - Current Unix timestamp

3. **Placement Context Macros**:
   - `{placement_id}` - Offerwall placement ID
   - `{publisher_id}` - Publisher ID

4. **Device/Geo Context Macros**:
   - `{country}` - User's country code
   - `{device_type}` - mobile/desktop/tablet
   - `{ip_address}` - User's IP address
   - `{user_agent}` - Browser user agent

### Fallback Matching Logic

When processing postbacks:
1. **Primary**: Match by `click_id` if provided
2. **Secondary**: Match by `user_id` + `offer_id` + recent timestamp (last 24 hours)
3. **Tertiary**: Check custom parameters for user_id patterns
4. **Failure**: Log error with all parameters for manual review
