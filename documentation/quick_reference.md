# Quick Reference Guide - Implementation Phases

> [!TIP]
> This is a condensed reference for quick lookups. For detailed information, see [implementation_plan.md](file:///d:/pepeleads/ascend/lovable-ascend/documentation/implementation_plan.md)

---

## Phase Status Overview

| Phase | Status | Priority | Complexity | Duration |
|-------|--------|----------|------------|----------|
| 1. Login Logs Enhancement | 🟡 Ready | High | Medium | 3-5 days |
| 2. Gift Card Promo Codes | 🟡 Ready | High | Medium | 3-4 days |
| 3. Postback Fix | 🟡 Ready | Critical | Low | 1-2 days |
| 4. Dashboard Cleanup | 🔴 Blocked | Medium | Low | 1-2 days |
| 5. Offer Field Updates | 🔴 Blocked | Medium | Medium | 2-3 days |
| 6. Bug Hunting & QA | 🟡 Ready | High | Variable | Ongoing |

---

## Quick Commands

### Start Development Server
```bash
# Frontend
cd d:\pepeleads\ascend\lovable-ascend
npm run dev

# Backend
cd backend
python app.py
```

### View Documentation
```bash
# Open documentation folder
cd d:\pepeleads\ascend\lovable-ascend\documentation

# View task list
cat task.md

# View implementation plan
cat implementation_plan.md
```

---

## Phase 1: Login Logs - Quick Checklist

### Setup
- [ ] Create IPInfo.io account
- [ ] Get API key
- [ ] Add to environment variables

### Backend
- [ ] Install IPInfo SDK
- [ ] Update login_logs model
- [ ] Integrate API in login route
- [ ] Add caching
- [ ] Fix timezone handling

### Frontend
- [ ] Add new columns to AdminLoginLogs
- [ ] Update date formatting
- [ ] Add geographic filters

### Test
- [ ] Test with multiple IPs
- [ ] Verify timezone display
- [ ] Check rate limiting

---

## Phase 2: Gift Cards - Quick Checklist

### Backend
- [ ] Update promo_code model (is_gift_card, credit_amount)
- [ ] Add gift card creation endpoint
- [ ] Add redemption logic
- [ ] Update user balance system

### Frontend
- [ ] Add gift card toggle in admin panel
- [ ] Add credit amount input
- [ ] Create user redemption page
- [ ] Update balance display

### Test
- [ ] Create gift card
- [ ] Redeem as user
- [ ] Test duplicate prevention
- [ ] Verify balance update

---

## Phase 3: Postback Fix - Quick Checklist

### Backend
- [ ] Update postback_receiver to capture username
- [ ] Update postback_receiver to capture score
- [ ] Add {username} placeholder support
- [ ] Add {score} placeholder support
- [ ] Update postback logs

### Test
- [ ] Configure test partner with placeholders
- [ ] Trigger postback
- [ ] Verify partner receives data
- [ ] Check postback logs

---

## Phase 4: Dashboard Cleanup - Quick Checklist

> [!WARNING]
> **Requires stakeholder input before starting**

### Audit
- [ ] List all current tabs
- [ ] Identify unused tabs
- [ ] Document dependencies

### Cleanup
- [ ] Remove tabs from AdminSidebar
- [ ] Delete page components
- [ ] Remove backend routes
- [ ] Update documentation

### Test
- [ ] Test navigation
- [ ] Check for broken links
- [ ] Test with different permissions

---

## Phase 5: Offer Fields - Quick Checklist

> [!WARNING]
> **Requires stakeholder input before starting**

### Analysis
- [ ] List all current fields
- [ ] Identify unused fields
- [ ] Check database usage

### Updates
- [ ] Update offer model
- [ ] Create migration script
- [ ] Update admin forms
- [ ] Update API calls

### Test
- [ ] Create new offer
- [ ] Edit existing offer
- [ ] Verify display
- [ ] Run migration on staging

---

## Phase 6: Bug Hunting - Quick Checklist

### Code Review
- [ ] Check TODO/FIXME comments
- [ ] Review error logs
- [ ] Check console errors

### Functional Testing
- [ ] User registration
- [ ] Offer completion
- [ ] Postback flow
- [ ] Promo codes
- [ ] Admin permissions

### Performance
- [ ] API response times
- [ ] Database queries
- [ ] Memory usage

### Security
- [ ] Authentication
- [ ] Input validation
- [ ] Rate limiting

### UI/UX
- [ ] Mobile responsive
- [ ] Form validation
- [ ] Error messages
- [ ] Loading states

---

## Key Files Reference

### Backend Files
| File | Purpose |
|------|---------|
| `backend/models/login_logs.py` | Login log data model |
| `backend/routes/login_logs.py` | Login log API endpoints |
| `backend/models/promo_code.py` | Promo code data model |
| `backend/routes/admin_promo_codes.py` | Promo code management |
| `backend/routes/postback_receiver.py` | Postback receiving logic |
| `backend/services/partner_postback_service.py` | Postback forwarding |
| `backend/models/offer.py` | Offer data model |

### Frontend Files
| File | Purpose |
|------|---------|
| `src/pages/AdminLoginLogs.tsx` | Login logs admin page |
| `src/pages/AdminPromoCodeManagement.tsx` | Promo code admin page |
| `src/components/layout/AdminSidebar.tsx` | Admin navigation |
| `src/pages/AdminOffers.tsx` | Offer management page |
| `src/services/adminOfferApi.ts` | Offer API client |

---

## Environment Variables Needed

```bash
# IPInfo.io API (Phase 1)
IPINFO_API_KEY=your_api_key_here

# Existing variables (verify these exist)
MONGODB_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
```

---

## Testing Endpoints

### Login Logs
```
GET /api/admin/login-logs
```

### Promo Codes
```
POST /api/admin/promo-codes
POST /api/user/redeem-promo-code
```

### Postbacks
```
POST /api/postback/receive
GET /api/admin/postback-logs
```

### Offers
```
GET /api/admin/offers
POST /api/admin/offers
PUT /api/admin/offers/:id
```

---

## Common Issues & Solutions

### Issue: IPInfo API Rate Limit
**Solution**: Implement caching for IP lookups

### Issue: Timezone Display Incorrect
**Solution**: Store in UTC, convert on display

### Issue: Gift Card Redeemed Twice
**Solution**: Check redemption history before crediting

### Issue: Postback Missing Parameters
**Solution**: Verify placeholder replacement logic

---

## Contact & Resources

### Documentation
- [Task List](file:///d:/pepeleads/ascend/lovable-ascend/documentation/task.md)
- [Implementation Plan](file:///d:/pepeleads/ascend/lovable-ascend/documentation/implementation_plan.md)
- [Project Overview](file:///d:/pepeleads/ascend/lovable-ascend/documentation/project_overview.md)

### External APIs
- [IPInfo.io Docs](https://ipinfo.io/developers)
- [IPInfo.io Dashboard](https://ipinfo.io/account)

---

**Last Updated**: 2025-12-19  
**Quick Reference Version**: 1.0
