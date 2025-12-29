# Bulk Offer Upload Enhancements

## Overview
This document describes the enhancements made to the bulk offer upload system to support multiple currencies, percentage-based payouts, and an optional payout model field.

## Changes Implemented

### 1. Enhanced Payout Column Display

**Location:** `src/pages/AdminOffers.tsx`

**Change:** The "Payout" column has been renamed to "Payout/Revenue" and now intelligently displays:
- **Fixed Payout:** Shows currency symbol + amount (e.g., `$42.00`, `€30.00`, `₹100.00`)
- **Percentage Payout:** Shows percentage (e.g., `4%`, `50%`)

**Supported Currencies:**
- USD ($), EUR (€), GBP (£), INR (₹), JPY (¥)
- RUB (₽), BRL (R$), CAD (C$), AUD (A$), CHF (CHF)
- SEK (kr), PLN (zł), ILS (₪), KRW (₩), THB (฿)
- VND (₫), IDR (Rp), MYR (RM), PHP (₱), SGD (S$)
- HKD (HK$), TWD (NT$), ZAR (R), AED (د.إ), SAR (SR)
- QAR (QR), BHD (BD), KWD (KD), OMR (OMR)

### 2. Currency Symbol Parser

**Location:** `backend/utils/bulk_offer_upload.py`

**Function:** `parse_payout_value(payout_str: str) -> Tuple[float, float, str]`

**Features:**
- Automatically detects currency symbols in payout values
- Extracts numeric value and identifies currency code
- Handles percentage-based payouts (e.g., `50%`)
- Supports currency symbols at the beginning or end of the value

**Examples:**
```python
parse_payout_value("$42")     # Returns: (42.0, 0, 'USD')
parse_payout_value("€30")     # Returns: (30.0, 0, 'EUR')
parse_payout_value("₹100")    # Returns: (100.0, 0, 'INR')
parse_payout_value("4%")      # Returns: (0, 4.0, 'USD')
parse_payout_value("50%")     # Returns: (0, 50.0, 'USD')
parse_payout_value("10.50")   # Returns: (10.5, 0, 'USD')
```

### 3. New Optional Column: Payout_Model

**Location:** `backend/utils/bulk_offer_upload.py`

**Field Mapping:**
- Spreadsheet columns: `payout_model`, `payout model`, `model`
- Database field: `payout_model`

**Purpose:** Allows specifying the payout model type (e.g., CPA, CPI, CPL, CPS, CPM)

**Usage:** This is an optional field. If provided in the spreadsheet, it will be stored with the offer.

### 4. Updated Bulk Upload Template

**Location:** `backend/routes/admin_offers.py` - `/offers/bulk-upload/template` endpoint

**New Template Structure:**
```csv
campaign_id,title,url,country,payout,payout_model,preview_url,image_url,description,platform,expiry,category,device,traffic_sources
CAMP-12345,Example Offer - Complete Survey,https://example.com/offer,US,$2.50,CPA,https://example.com/preview,,Complete a short survey...,SurveyNetwork,2025-01-30,surveys,all,Social and content traffic allowed
```

**Note:** The `payout` column now accepts:
- Fixed amounts with currency symbols: `$2.50`, `€5.00`, `£3.75`, `₹50`
- Percentage values: `4%`, `50%`
- Plain numbers (defaults to USD): `2.50`

### 5. CSV Export Enhancement

**Location:** `src/pages/AdminOffers.tsx` - `handleCSVExport` function

**Changes:**
- Payout column now exports with proper currency symbols or percentage
- Added "Payout Model" column to export
- Maintains backward compatibility with existing exports

## Usage Examples

### Example 1: Fixed Payout with Currency Symbol
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-001,US Survey,https://example.com/us,US,$5.00,CPA
CAMP-002,EU Survey,https://example.com/eu,DE,€4.50,CPA
CAMP-003,UK Survey,https://example.com/uk,GB,£3.75,CPA
CAMP-004,India Survey,https://example.com/in,IN,₹100,CPA
```

### Example 2: Percentage-Based Payout
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-005,Revenue Share Offer,https://example.com/rev,US,50%,RevShare
CAMP-006,Affiliate Program,https://example.com/aff,US,4%,RevShare
```

### Example 3: Mixed Payouts
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-007,Fixed Payout,https://example.com/fixed,US,$10.00,CPA
CAMP-008,Percentage,https://example.com/percent,US,25%,RevShare
CAMP-009,Euro Fixed,https://example.com/euro,FR,€8.50,CPI
```

## Testing

A test script has been created to verify currency parsing functionality:

**File:** `backend/test_currency_parsing.py`

**Run Test:**
```bash
cd backend
python test_currency_parsing.py
```

**Expected Output:**
```
✅ PASS: '$42' -> (42.0, 0, 'USD')
✅ PASS: '€30' -> (30.0, 0, 'EUR')
✅ PASS: '£25' -> (25.0, 0, 'GBP')
✅ PASS: '₹100' -> (100.0, 0, 'INR')
... (all tests pass)
```

## Database Schema

The following fields are now supported in the offers collection:

```javascript
{
  payout: Number,                    // Fixed payout amount
  currency: String,                  // Currency code (USD, EUR, GBP, etc.)
  revenue_share_percent: Number,     // Percentage for revenue sharing (0-100)
  payout_model: String,              // Optional: CPA, CPI, CPL, CPS, CPM, RevShare, etc.
  incentive_type: String             // Auto-calculated: 'Incent' or 'Non-Incent'
}
```

## Backward Compatibility

All changes are backward compatible:
- Existing offers without currency symbols will default to USD
- Offers without payout_model will have an empty string
- Plain numeric payout values (without symbols) are still supported
- Existing CSV exports will continue to work

## API Changes

### Type Definition Update

**File:** `src/services/adminOfferApi.ts`

Added `payout_model?: string` to the Offer interface.

## Notes

1. **Currency Detection:** The parser checks for currency symbols at both the beginning and end of the payout string.

2. **Validation:** Invalid payout values (non-numeric after removing currency symbols) will be caught during validation and reported as errors.

3. **Default Currency:** If no currency symbol is provided, USD is assumed as the default.

4. **Percentage Handling:** When a percentage is detected, the fixed payout is set to 0, and the revenue_share_percent field is populated.

5. **Display Logic:** The frontend automatically determines whether to show a currency symbol or percentage based on the revenue_share_percent value.

## Future Enhancements

Potential future improvements:
- Add currency conversion rates for multi-currency reporting
- Support for custom currency symbols
- Validation of currency against country codes
- Bulk currency conversion tool
