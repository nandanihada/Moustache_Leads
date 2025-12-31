# API Import Feature - Implementation Checklist

## Overview
Add "API Import" button in Admin Offers to bulk import offers from affiliate network APIs (HasOffers, CJ, ShareASale, etc.)

**Total Time: 2-3 days (16-20 hours)**

---

## Day 1: Backend Development (4-6 hours)

### 1.1 Network API Service (1 hour)
**File**: `backend/services/network_api_service.py`

- [ ] Create base API client class
- [ ] Implement HasOffers API integration
- [ ] Add authentication handling
- [ ] Add response parsing
- [ ] Add error handling and timeouts

**Test**: Call HasOffers API with test credentials

---

### 1.2 Field Mapping Service (30 mins)
**File**: `backend/services/network_field_mapper.py`

- [ ] Create HasOffers field mapping dictionary
- [ ] Add field validation
- [ ] Add currency conversion
- [ ] Add status normalization

**Test**: Map sample API response to DB format

---

### 1.3 Duplicate Detection (1 hour)
**File**: `backend/utils/duplicate_detection.py`

- [ ] Check by campaign_id
- [ ] Check by name + network (fuzzy match)
- [ ] Implement skip/update/create logic

**Test**: Test with existing offers in database

---

### 1.4 API Import Route (1 hour)
**File**: `backend/routes/admin_offers.py`

Add 3 endpoints:
- [ ] `POST /api/admin/offers/api-import/test` - Test connection
- [ ] `POST /api/admin/offers/api-import/preview` - Preview offers
- [ ] `POST /api/admin/offers/api-import` - Import offers

**Test**: Test all endpoints with Postman/curl

---

### 1.5 Integration & Testing (1-2 hours)

- [ ] Test with real HasOffers API
- [ ] Test duplicate detection
- [ ] Test field mapping accuracy
- [ ] Test error handling
- [ ] Fix bugs

---

## Day 2: Frontend Development (4-6 hours)

### 2.1 API Import Modal - Step 1 (1 hour)
**File**: `src/components/ApiImportModal.tsx`

- [ ] Create modal component structure
- [ ] Add network selection dropdown
- [ ] Add Network ID input
- [ ] Add API Key input (with show/hide)
- [ ] Add "Test Connection" button
- [ ] Add loading states

**Test**: Open modal, enter credentials, test connection

---

### 2.2 API Import Modal - Steps 2-5 (2 hours)

- [ ] Step 2: Filters (optional - status, countries)
- [ ] Step 3: Preview table + import options
- [ ] Step 4: Progress bar with real-time updates
- [ ] Step 5: Success/error summary

**Test**: Complete full import flow

---

### 2.3 API Service (30 mins)
**File**: `src/services/apiImportService.ts`

- [ ] Create `testConnection()` function
- [ ] Create `fetchPreview()` function
- [ ] Create `importOffers()` function
- [ ] Add TypeScript types

**Test**: Test all API calls

---

### 2.4 Add Button to AdminOffers (15 mins)
**File**: `src/pages/AdminOffers.tsx`

- [ ] Add "API Import" button next to "Bulk Upload"
- [ ] Add state for modal open/close
- [ ] Wire up modal component

**Test**: Click button, modal opens

---

### 2.5 UI Testing (1-2 hours)

- [ ] Test full import flow
- [ ] Test error states
- [ ] Test progress tracking
- [ ] Test responsive design
- [ ] Fix UI bugs

---

## Day 3: Polish & Testing (3-4 hours)

### 3.1 Error Handling (1 hour)

- [ ] Add comprehensive error messages
- [ ] Add toast notifications
- [ ] Add retry logic
- [ ] Add error report download

**Test**: Test all error scenarios

---

### 3.2 Progress Tracking (1 hour)

- [ ] Add real-time progress updates
- [ ] Add cancel import functionality
- [ ] Show imported/skipped/error counts

**Test**: Import 50+ offers, watch progress

---

### 3.3 Local Testing (1 hour)

- [ ] Test with real API credentials
- [ ] Test importing 10 offers
- [ ] Test importing 100 offers
- [ ] Test duplicate detection
- [ ] Test error handling
- [ ] Test cancel functionality

---

### 3.4 Bug Fixes & Polish (1 hour)

- [ ] Fix any bugs found
- [ ] Improve error messages
- [ ] Add loading indicators
- [ ] Polish UI/UX

---

## Production Deployment (2-3 hours)

### 4.1 Code Review (30 mins)

- [ ] Self-review all code
- [ ] Check for security issues
- [ ] Check for performance issues
- [ ] Ensure code follows standards

---

### 4.2 Staging Deployment (1 hour)

- [ ] Deploy backend to staging
- [ ] Deploy frontend to staging
- [ ] Test on staging with real API
- [ ] Verify all functionality works

---

### 4.3 Production Deployment (1 hour)

- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Test with real data
- [ ] Verify performance

---

### 4.4 Post-Deployment (30 mins)

- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Fix critical bugs if any

---

## Files to Create

### Backend
```
backend/services/network_api_service.py      (new)
backend/services/network_field_mapper.py     (new)
backend/utils/duplicate_detection.py         (new)
backend/routes/admin_offers.py               (modify - add endpoints)
```

### Frontend
```
src/components/ApiImportModal.tsx            (new)
src/services/apiImportService.ts             (new)
src/pages/AdminOffers.tsx                    (modify - add button)
```

---

## API Endpoints

```
POST /api/admin/offers/api-import/test
Body: { network_id, api_key, network_type }
Response: { success, offer_count }

POST /api/admin/offers/api-import/preview
Body: { network_id, api_key, network_type, filters }
Response: { success, offers[], total_available }

POST /api/admin/offers/api-import
Body: { network_id, api_key, network_type, options }
Response: { success, summary: { imported, skipped, errors } }
```

---

## Testing Checklist

### Functional Tests
- [ ] Can open modal
- [ ] Can test connection
- [ ] Can preview offers
- [ ] Can import successfully
- [ ] Duplicates detected correctly
- [ ] Errors handled properly

### Edge Cases
- [ ] Invalid API credentials
- [ ] Network timeout
- [ ] No offers found
- [ ] All offers are duplicates
- [ ] Partial import success
- [ ] Cancel during import

### Performance
- [ ] Import 100 offers in <30 seconds
- [ ] UI remains responsive
- [ ] No memory leaks

---

## Time Summary

| Phase | Time |
|-------|------|
| Day 1: Backend | 4-6 hours |
| Day 2: Frontend | 4-6 hours |
| Day 3: Polish & Testing | 3-4 hours |
| Deployment | 2-3 hours |
| **TOTAL** | **16-20 hours (2-3 days)** |

---

## Success Criteria

- ✅ Can import offers from HasOffers API
- ✅ Duplicate detection works (95%+ accuracy)
- ✅ Field mapping correct (95%+ accuracy)
- ✅ Import 100 offers in <30 seconds
- ✅ Clear error messages
- ✅ Intuitive UI

---

## Next Steps

1. Start with `backend/services/network_api_service.py`
2. Test with real HasOffers API credentials
3. Build frontend modal
4. Test end-to-end flow
5. Deploy to staging
6. Deploy to production

**Ready to start building!** 🚀
