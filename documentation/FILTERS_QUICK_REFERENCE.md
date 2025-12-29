# 🚀 Advanced Filters - Quick Reference

## Offer Access Requests Filters

| Filter | Type | Values | Example |
|--------|------|--------|---------|
| Search | Text | Any text | "john" |
| Status | Dropdown | Pending, Approved, Rejected, All | "Pending" |
| Offer ID | Text | ML-XXXXX | "ML-00001" |
| Offer Name | Text | Any text | "Casino" |
| User ID | Text | MongoDB ID | "507f1f77bcf86cd799439011" |
| User Name | Text | Any text | "john_doe" |
| Category | Dropdown | Finance, Gaming, Dating, Shopping, Health, Education, Other | "Gaming" |
| Device | Dropdown | Mobile, Desktop, Tablet, All | "Mobile" |
| Date From | Date | YYYY-MM-DD | "2025-11-01" |
| Date To | Date | YYYY-MM-DD | "2025-11-30" |

---

## Placement Approval Filters

| Filter | Type | Values | Example |
|--------|------|--------|---------|
| Search | Text | Any text | "john" |
| Publisher ID | Text | Any text | "PUB-001" |
| Publisher Name | Text | Any text | "John Doe" |
| Placement ID | Text | Any text | "PLACE-001" |
| Platform Type | Text | Any text | "Web" |
| Currency | Text | Currency code | "USD" |
| Date From | Date | YYYY-MM-DD | "2025-11-01" |
| Date To | Date | YYYY-MM-DD | "2025-11-30" |

---

## Quick Filter Combinations

### Find Pending Requests
```
Status: Pending
→ Shows all pending requests
```

### Find Specific User's Requests
```
User Name: john_doe
→ Shows all requests from john_doe
```

### Find Gaming Offers
```
Category: Gaming
→ Shows all gaming offer requests
```

### Find Mobile Offers
```
Device: Mobile
→ Shows all mobile device offers
```

### Find Requests in Date Range
```
Date From: 2025-11-01
Date To: 2025-11-30
→ Shows all requests from November
```

### Find Specific Offer
```
Offer ID: ML-00001
→ Shows all requests for ML-00001
```

### Find Approved Requests
```
Status: Approved
→ Shows all approved requests
```

### Find Finance Offers
```
Category: Finance
→ Shows all finance offer requests
```

---

## API Query Parameters

### Offer Access Requests
```
GET /api/admin/offer-access-requests?
  status=pending
  &offer_id=ML-00001
  &offer_name=Casino
  &user_id=<id>
  &user_name=john
  &date_from=2025-11-01
  &date_to=2025-11-30
  &category=gaming
  &device=mobile
  &search=test
  &page=1
  &per_page=20
```

### Placement Approvals
```
GET /api/placements/admin/all?
  status_filter=PENDING_APPROVAL
  &search=john
  &publisher_id=PUB-001
  &publisher_name=John
  &placement_id=PLACE-001
  &platform_type=Web
  &date_from=2025-11-01
  &date_to=2025-11-30
  &currency=USD
  &page=1
  &size=20
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Focus Search | Ctrl + F |
| Clear Filters | Ctrl + Shift + C |
| Next Page | Ctrl + Right |
| Previous Page | Ctrl + Left |

---

## Response Format

### Offer Access Requests
```json
{
  "requests": [
    {
      "request_id": "REQ-ML-00001-...",
      "offer_id": "ML-00001",
      "user_id": "...",
      "username": "john_doe",
      "status": "pending",
      "requested_at": "2025-11-24T10:30:00",
      "offer_details": {
        "name": "Casino Game",
        "payout": 25.50,
        "category": "gaming",
        "device_targeting": "mobile"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "total": 45,
    "pages": 3
  }
}
```

### Placement Approvals
```json
{
  "placements": [
    {
      "id": "...",
      "publisherName": "John Doe",
      "placementIdentifier": "PLACE-001",
      "platformType": "Web",
      "currencyName": "USD",
      "approvalStatus": "PENDING_APPROVAL",
      "createdAt": "2025-11-24T10:30:00"
    }
  ],
  "total": 25
}
```

---

## Common Issues & Solutions

### No Results Found
**Solution:** 
- Check filter values are correct
- Try clearing filters and searching again
- Verify date range is correct

### Filters Not Working
**Solution:**
- Refresh the page
- Clear browser cache
- Check network tab for API errors

### Slow Loading
**Solution:**
- Reduce date range
- Use more specific filters
- Check internet connection

### Wrong Results
**Solution:**
- Verify filter values
- Check for typos
- Clear and reapply filters

---

## Filter Tips

✅ **Use specific filters** for faster results
✅ **Combine filters** for precise searches
✅ **Use date ranges** to narrow results
✅ **Clear filters** to start fresh
✅ **Check pagination** for more results
✅ **Use search** for general queries
✅ **Use dropdowns** for exact matches

---

## Performance Tips

⚡ **Faster Searches:**
- Use specific offer/user IDs
- Narrow date ranges
- Combine multiple filters
- Avoid very broad searches

⚡ **Optimize Filters:**
- Start with status filter
- Add category/device filters
- Use date ranges
- Refine with search

---

## Files Location

📁 **Frontend:**
- `src/pages/AdminOfferAccessRequests.tsx`
- `src/pages/AdminPlacementApproval.tsx`

📁 **Backend:**
- `backend/routes/admin_offer_requests.py`

📁 **Documentation:**
- `ADVANCED_FILTERS_DOCUMENTATION.md`
- `FILTERS_IMPLEMENTATION_SUMMARY.md`
- `FILTERS_VISUAL_GUIDE.md`
- `FILTERS_COMPLETE_SUMMARY.md`
- `FILTERS_QUICK_REFERENCE.md` (this file)

---

## Support Resources

📖 **Documentation:**
1. ADVANCED_FILTERS_DOCUMENTATION.md - Detailed specs
2. FILTERS_VISUAL_GUIDE.md - UI/UX details
3. FILTERS_IMPLEMENTATION_SUMMARY.md - Technical details
4. FILTERS_COMPLETE_SUMMARY.md - Full summary

🔧 **Code Files:**
1. AdminOfferAccessRequests.tsx - Offer filters
2. AdminPlacementApproval.tsx - Placement filters
3. admin_offer_requests.py - Backend logic

---

## Version Info

**Version:** 1.0
**Last Updated:** November 24, 2025
**Status:** ✅ Complete and Ready to Use

---

**Quick Reference Guide - Advanced Filters**
