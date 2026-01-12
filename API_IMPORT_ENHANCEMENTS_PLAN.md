# API Import Enhancements - Implementation Plan

## Overview
Systematic improvements to API import functionality with realistic time estimates (human + AI assistance).

---

## Implementation Tasks

| # | Task | Description | Time Estimate | Priority | Files to Modify |
|---|------|-------------|---------------|----------|-----------------|
| 1 | **Country Name Mapping** | Convert country codes to names (US → United States) | 30 min | HIGH | `network_field_mapper.py` |
| 2 | **Payout Type Extraction** | Extract and map payout type from API (CPA/CPI/CPL/CPS) | 20 min | HIGH | `network_field_mapper.py` |
| 3 | **Protocol Extraction** | Extract tracking protocol from API response | 15 min | MEDIUM | `network_field_mapper.py` |
| 4 | **Complete Field Mapping** | Map ALL available fields from API response | 45 min | HIGH | `network_field_mapper.py` |
| 5 | **Description Cleaner** | Strip HTML tags and format description beautifully | 30 min | HIGH | `network_field_mapper.py` + new utility |
| 6 | **Offer Name Formatter** | Clean and format offer names (remove underscores, proper case) | 20 min | MEDIUM | `network_field_mapper.py` |
| 7 | **UI Description Display** | Improve description display in offer details | 25 min | MEDIUM | `OfferDetailsModal.tsx` |
| 8 | **Testing & Validation** | Test all changes with real API data | 30 min | HIGH | All files |

**Total Estimated Time: 3.5 hours**

---

## Detailed Task Breakdown

### Task 1: Country Name Mapping (30 min)
**Problem:** API provides country names, but we're only extracting codes
**Solution:** Create country name to code mapping

**Implementation:**
```python
# In network_field_mapper.py
COUNTRY_NAME_TO_CODE = {
    'United States': 'US',
    'United Kingdom': 'GB',
    'Canada': 'CA',
    'Australia': 'AU',
    # ... add more
}

def _extract_countries(self, country_data):
    countries = []
    for country_info in country_data.values():
        # Try to get code first
        code = country_info.get('code')
        if not code:
            # Try to get from name
            name = country_info.get('name')
            code = self.COUNTRY_NAME_TO_CODE.get(name)
        if code:
            countries.append(code.upper())
    return countries
```

**Files:** `backend/services/network_field_mapper.py`

---

### Task 2: Payout Type Extraction (20 min)
**Problem:** Not extracting payout type (CPA/CPI/CPL/CPS)
**Solution:** Extract from API response

**Implementation:**
```python
# Extract payout type from offer
payout_type = offer.get('payout_type') or 'CPA'
# Or from offer type field
offer_type = offer.get('offer_type') or offer.get('type') or 'CPA'
mapped['payout_type'] = payout_type
mapped['offer_type'] = offer_type
```

**Fields to check in API:**
- `offer.payout_type`
- `offer.type`
- `offer.revenue_type`

**Files:** `backend/services/network_field_mapper.py`

---

### Task 3: Protocol Extraction (15 min)
**Problem:** Tracking protocol not visible
**Solution:** Extract from API and map to tracking field

**Implementation:**
```python
# Extract tracking protocol
protocol = offer.get('protocol') or offer.get('tracking_protocol') or 'pixel'
mapped['tracking'] = {
    'protocol': protocol,
    'postback_url': offer.get('postback_url', ''),
    'click_expiration': offer.get('click_expiration_days', 30),
}
```

**Files:** `backend/services/network_field_mapper.py`

---

### Task 4: Complete Field Mapping (45 min)
**Problem:** Not mapping all available fields from API
**Solution:** Map every field the API provides

**Fields to add:**
- Categories/Verticals
- Allowed traffic types
- Conversion flow
- KPI requirements
- Restrictions
- Creative requirements
- Geo-targeting rules
- Device requirements
- OS requirements
- Browser requirements
- Carrier requirements
- Connection type
- Language requirements
- Age restrictions
- Gender targeting

**Implementation:**
```python
# Add all available fields
mapped.update({
    'category': offer.get('category') or offer.get('vertical'),
    'allowed_traffic': offer.get('allowed_traffic_types', []),
    'conversion_flow': offer.get('conversion_flow'),
    'kpi': offer.get('kpi'),
    'restrictions': offer.get('restrictions'),
    'creative_requirements': offer.get('creative_requirements'),
    # ... continue for all fields
})
```

**Files:** `backend/services/network_field_mapper.py`

---

### Task 5: Description Cleaner (30 min)
**Problem:** Description has HTML tags like `<p>`, `<br>`, etc.
**Solution:** Create HTML cleaner utility

**Implementation:**
```python
# New file: backend/utils/html_cleaner.py
import re
from html import unescape

def clean_html_description(html_text):
    """
    Clean HTML from description and format beautifully
    
    - Remove HTML tags
    - Convert <br> to newlines
    - Unescape HTML entities
    - Remove extra whitespace
    - Preserve paragraph breaks
    """
    if not html_text:
        return ''
    
    # Convert <br> and <p> to newlines
    text = re.sub(r'<br\s*/?>', '\n', html_text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n\n', text, flags=re.IGNORECASE)
    
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Unescape HTML entities (&nbsp; → space, &amp; → &)
    text = unescape(text)
    
    # Remove extra whitespace
    text = re.sub(r'\n\s*\n', '\n\n', text)  # Max 2 newlines
    text = re.sub(r' +', ' ', text)  # Multiple spaces to single
    text = text.strip()
    
    return text
```

**Usage in mapper:**
```python
from utils.html_cleaner import clean_html_description

mapped['description'] = clean_html_description(offer.get('description', ''))
```

**Files:** 
- `backend/utils/html_cleaner.py` (NEW)
- `backend/services/network_field_mapper.py`

---

### Task 6: Offer Name Formatter (20 min)
**Problem:** Offer names have underscores and inconsistent formatting
**Solution:** Clean and format offer names

**Examples:**
- `Papa_Survey_Router_ Incent UK/DE/AU/US` → `Papa Survey Router - Incent UK/DE/AU/US`
- `iSurveyWorld_DOI_non Incent US` → `iSurveyWorld DOI - Non Incent US`

**Implementation:**
```python
def format_offer_name(name):
    """
    Format offer name for better readability
    
    - Replace underscores with spaces
    - Replace multiple spaces with single space
    - Capitalize properly
    - Replace _ before keywords with dash
    """
    if not name:
        return ''
    
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    
    # Remove extra spaces
    name = re.sub(r'\s+', ' ', name)
    
    # Replace space before Incent/Non with dash
    name = re.sub(r'\s+(Incent|Non Incent|non incent)', r' - \1', name, flags=re.IGNORECASE)
    
    # Capitalize "non incent" properly
    name = re.sub(r'non incent', 'Non Incent', name, flags=re.IGNORECASE)
    
    # Clean up
    name = name.strip()
    
    return name
```

**Files:** `backend/services/network_field_mapper.py`

---

### Task 7: UI Description Display (25 min)
**Problem:** Description display in UI needs improvement
**Solution:** Update OfferDetailsModal to show formatted description

**Implementation:**
```tsx
// In OfferDetailsModal.tsx
<div className="space-y-2">
  <Label>Description</Label>
  <div className="p-4 bg-gray-50 rounded-md border">
    <p className="text-sm whitespace-pre-line">
      {offer.description || 'No description available'}
    </p>
  </div>
</div>
```

**Features:**
- `whitespace-pre-line` preserves line breaks
- Gray background for better readability
- Proper padding and borders

**Files:** `src/components/OfferDetailsModal.tsx`

---

### Task 8: Testing & Validation (30 min)
**Checklist:**
- [ ] Test with real API import
- [ ] Verify country names are correct
- [ ] Verify payout types are extracted
- [ ] Verify protocol is visible
- [ ] Verify all fields are mapped
- [ ] Verify description is clean (no HTML)
- [ ] Verify offer names are formatted
- [ ] Verify UI displays everything correctly

---

## Implementation Order

### Phase 1: Backend Data Extraction (1.5 hours)
1. Country name mapping
2. Payout type extraction
3. Protocol extraction
4. Complete field mapping

### Phase 2: Data Cleaning (50 min)
5. Description cleaner utility
6. Offer name formatter

### Phase 3: Frontend Display (55 min)
7. UI description display improvements
8. Testing & validation

---

## Files to Modify

### Backend
1. `backend/services/network_field_mapper.py` - Main mapper (Tasks 1-6)
2. `backend/utils/html_cleaner.py` - NEW file (Task 5)
3. `backend/services/network_api_service.py` - May need to request more fields

### Frontend
4. `src/components/OfferDetailsModal.tsx` - Description display (Task 7)

---

## Testing Strategy

### Unit Tests
- Test country name to code mapping
- Test HTML cleaner with various inputs
- Test offer name formatter

### Integration Tests
- Import real offers from API
- Verify all fields are populated
- Check database for correct data

### UI Tests
- View offer details
- Verify description is readable
- Verify all fields are visible

---

## Success Criteria

✅ All country names correctly mapped to codes
✅ Payout type visible in offer details
✅ Protocol visible in tracking section
✅ All API fields mapped and stored
✅ Descriptions clean (no HTML tags)
✅ Offer names properly formatted
✅ UI displays all information beautifully

---

## Next Steps

1. Review this plan
2. Confirm priorities
3. Start with Phase 1 (Backend Data Extraction)
4. Test after each task
5. Move to Phase 2 and 3

**Ready to start? Let me know which task to begin with!**
