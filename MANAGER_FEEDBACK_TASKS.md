# Manager Feedback - Prioritized Task List

## Priority Legend
- 🟢 **P1 - Quick Fix** (< 1 hour) - Simple UI changes, text updates, small fixes
- 🟡 **P2 - Medium** (1-4 hours) - Feature additions, moderate complexity
- 🔴 **P3 - Complex** (4+ hours) - Major features, backend changes, integrations

---

## ✅ COMPLETED TASKS

### Today's Tasks (Session 4 - January 23, 2026)
- [x] **API Import Count Fix** - Fixed "5 offers found" always showing → Now shows actual total count with clear preview message
- [x] **Login Location Fix** - Fixed IPinfo service integration for login activity tracking → Updated activity_tracking_service.py to use ipinfo_service consistently
- [x] **Email Confirmation Fix** - Fixed worker timeout/SIGKILL issue → Made resend-verification endpoint async (non-blocking)
- [x] **Publisher Category Filter** - Added vertical/category filter to PublisherOffers page with 18 categories
- [x] **Bulk Import Rating/Timer** - Added star rating (1-5) and timer options to both BulkOfferUpload and ApiImportModal

### Iframe/Offerwall Enhancements (Completed)
- [x] **#44** ~~Limit description in iframe cards with "..." truncation, hide partner name~~
- [x] **#47** ~~Fix "NaN%" display issue~~ → Replaced with star rating (1-5 stars)
- [x] **#48** ~~Add country flag/label and device type icon in offer cards~~ + Extract from title
- [x] **#54** ~~Add "ML" or "Moustache Leads" branding on iframe header~~
- [x] **#55** ~~Change "Start Earning Now" to "Click to Earn" in iframe~~
- [x] **#46** ~~Remove or fix "5-10 minutes" time limit showing on every offer~~ → Removed dummy timer
- [x] **#49** ~~Add urgency boosters: timer, "Limited slots", "High demand", "Expires soon"~~
- [x] **#52** ~~Convert rewards from dollars to points system~~ → $1 = 100 points
- [x] **#56** ~~Add compliance conditions display~~ → Added in OfferModal
- [x] **#53** ~~Fix iframe filters - currently dummy/not working~~ → Added working category filters, search, and sorting
- [x] **#14** ~~Category filter exists - verify it's working properly~~ → Added 13 categories with working filter

### Recent Fixes (Session 2)
- [x] **#29** ~~Fix shorten link showing localhost~~ → Now uses production URL
- [x] **Country in title** ~~Remove country codes from offer title display~~ → Countries extracted for flags, removed from title
- [x] **#40** ~~Preview link~~ → Defaults to google.com if no preview_url
- [x] **#17** ~~Add sorting options~~ → Added ID (asc/desc), Payout (high/low), Title (A-Z/Z-A), Newest/Oldest - BOTH ADMIN & USER
- [x] **#35** ~~Show signup attempts~~ → Added signup_attempts collection + admin API endpoint
- [x] **#28** ~~Chameleon Ads country conflict~~ → Enhanced country extraction in network_field_mapper.py
- [x] **#15** ~~Country filter for offers~~ → Added to BOTH AdminOffers and PublisherOffers with 25 countries
- [x] **Vertical Auto-Detection** ~~Fix vertical defaulting to Lifestyle~~ → Auto-detects from offer name/description using keyword matching

### Email System Fixes (Session 2)
- [x] **#34** ~~Email confirmation not sending~~ → Added FRONTEND_URL to .env, added admin diagnostic endpoints (/admin/email-diagnostic, /admin/test-email)

---

## 🟢 P1 - QUICK FIXES (Do First)

### UI/Text Changes
- [x] **#18** ~~Add Terms & Conditions and Privacy Policy links in footer~~ → Added to sidebar footer + created /terms and /privacy pages
- [x] **#19** ~~Add Teams link in footer~~ → Added Team link + created /team page
- [x] **#31** ~~Traffic sources showing nothing~~ → Now shows "All Traffic (Default)" and "None (Default)" when empty

### Layout/Scroll Fixes (Session 3)
- [x] **Layout Fix** ~~Scroll issues on multiple pages~~ → Fixed DashboardLayout, Dialog, Sheet components + removed conflicting container styles from 10 pages

### Offers Page (BOTH Admin & User Side)
- [x] **#20** ~~Fix display issue - "72746 Isybank" showing "All Users what?"~~ → Fixed affiliates display to handle undefined/null values
- [x] **#10** ~~Add "Show All" button with pagination limits (min 50, max 200)~~ → Added per_page selector (20/50/100/200/Show All) on BOTH Admin & User pages
- [x] **#24** ~~Add table view for user/publisher side~~ → Added card/table view toggle with full table view

---

## 🟡 P2 - MEDIUM PRIORITY

### Filtering & Display
- [ ] **#15** Add country filter for offers
- [ ] **#16** Offer type filter (CPA/CPL/CPI) - verify existing implementation

### Copy & Export Features
- [x] **#21** ~~Add multi-field copy feature (up to 6 fields): name, country, moustache link, etc.~~ → Added "Copy All Fields" button in OfferDetailsModal
- [ ] **#21b** Give publisher ID to admin for tracking purposes

### API Import Issues
- [ ] **#22** LeadAds showing only 5 offers - add selection for offer types (active/all)
- [ ] **#25** Chameleon Ads showing only 5 offers - fix count display
- [ ] **#26** Multiple countries not showing (FR DE AT CH NL NO SE) - check API parsing
- [ ] **#27** "GLOBAL (ALL GEOS)" showing as USA only - fix geo parsing
- [ ] **#28** CPA Merchant detecting multiple countries but Chameleon not - fix API parser

### Duplicate Management
- [x] **#11** ~~Improve duplicate detection - show preview before delete, option to keep/delete~~ → Added preview modal with keep newest/oldest option
- [x] **#12** ~~Add recycle bin for deleted offers (soft delete)~~ → Implemented with Tabs UI, restore, permanent delete, bulk actions
- [x] **#13** ~~Add box view / single offer carousel view (next/prev navigation)~~ → Added Carousel View button with prev/next navigation

### Login & User Management
- [ ] **#32** Fix location not showing in login activity - IP2Location service issue
- [ ] **#34** Fix email confirmation not being sent on signup
- [ ] **#35** Show signup attempts in admin even if not completed
- [ ] **#36** Clarify user management section display issue

### Partner/Publisher Details
- [ ] **#33** Show more partner details: website, approval date, disapproval date

### Iframe Enhancements
- [ ] **#43** Add toggle for "show in iframe" per offer + amount display fix
- [ ] **#45** Auto-generate creative names for iframe (word limit)

---

## 🔴 P3 - COMPLEX IMPLEMENTATIONS

### Admin/User Separation
- [ ] **#37** Separate admin and user dashboards completely
  - Remove admin/user toggle button
  - Keep "login as user" feature from user management
  - Create separate admin URL/route

### Points System
- [ ] **#39** Fix points display - show percentage, allow configuration per offer

### Tracking URL Format
- [ ] **#23** Change tracking URL format from `/track/ML-01158?user_id=...` to `?offer_id=232323&user_id=768889`

### Preview Link
- [ ] **#40** Show preview link directly if available

### Geo Display
- [ ] **#41** Fix description showing "Geos:" when location already displayed separately

### Notification System
- [ ] **#42** Implement notification bar with:
  - Promo code received
  - Promo code redeemed
  - Offer applied
  - Offer rejected/selected
  - Payment processed
  - Referral received
  - Limit: 6 notifications per category

### Settings Page
- [ ] **#50** Add Privacy Policy and Terms & Conditions editor in settings

### Gift Card
- [ ] **#51** Fix gift card/promo card scroll issue

### Active Users
- [ ] **#38** Define and display "active user" criteria clearly

### Testing
- [ ] **#57** Test SurveyTitans integration - verify clicks showing real activity
- [ ] **#58** General testing and verification

---

## COVERAGE CHECK - All 58 Points

| # | Description | Status |
|---|-------------|--------|
| 10 | Show all offers pagination (50-200) | ✅ Done |
| 11 | Duplicate detection preview/options | ✅ Done |
| 12 | Recycle bin for deleted offers | ✅ Done |
| 13 | Box view / carousel view | ✅ Done |
| 14 | Category filter | ✅ Done |
| 15 | Country filter | ✅ Done |
| 16 | Offer type filter (CPA/CPL/CPI) | ⏳ Pending |
| 17 | Sorting options | ✅ Done |
| 18 | Terms & Privacy links | ✅ Done |
| 19 | Teams link | ✅ Done |
| 20 | Isybank display issue | ✅ Done |
| 21 | Multi-field copy feature | ✅ Done |
| 22 | LeadAds 5 offers issue | ⏳ Pending |
| 23 | Tracking URL format change | ⏳ Pending |
| 24 | Table view for users | ✅ Done |
| 25 | Chameleon Ads 5 offers | ⏳ Pending |
| 26 | Multiple countries not showing | ⏳ Pending |
| 27 | GLOBAL GEOS showing USA | ⏳ Pending |
| 28 | Chameleon vs CPA Merchant geo | ✅ Done |
| 29 | Localhost shorten link | ✅ Done |
| 30 | Location section countries | ⚠️ Need clarification |
| 31 | Traffic sources empty | ✅ Done |
| 32 | Login activity location | ✅ Done |
| 33 | Partner details (website, dates) | ⏳ Pending |
| 34 | Email confirmation not sent | ✅ Done |
| 35 | Show signup attempts | ✅ Done |
| 36 | User management section | ⏳ Pending |
| 37 | Admin/User separation | ⏳ Pending |
| 38 | Active user definition | ⏳ Pending |
| 39 | Points percentage display | ⏳ Pending |
| 40 | Preview link display | ✅ Done |
| 41 | Geos in description | ⏳ Pending |
| 42 | Notification bar | ⏳ Pending |
| 43 | Iframe toggle per offer | ⏳ Pending |
| 44 | Description truncation | ✅ Done |
| 45 | Auto-generate creative names | ⏳ Pending |
| 46 | 5-10 minutes time limit | ✅ Done |
| 47 | NaN% fix | ✅ Done |
| 48 | Country flag & device icon | ✅ Done |
| 49 | Urgency boosters | ✅ Done |
| 50 | Privacy/Terms editor in settings | ⏳ Pending |
| 51 | Gift card scroll issue | ⏳ Pending |
| 52 | Points system (dollars to points) | ✅ Done |
| 53 | Iframe filters not working | ✅ Done |
| 54 | ML branding on iframe | ✅ Done |
| 55 | "Click to Earn" text | ✅ Done |
| 56 | Compliance conditions display | ✅ Done |
| 57 | SurveyTitans testing | ⏳ Pending |
| 58 | General testing | ⏳ Pending |

**Completed: 35 tasks | Remaining: 13 tasks**

---

## Questions for Manager (Need Clarification)

1. **#19** - What "Teams" link? Microsoft Teams? A team page?
2. **#30** - Location section countries appearing - what's the issue exactly?
3. **#36** - "User management section showing in user management section" - need more details
4. **#45** - "iframe names should automatically change with word limit" - need example

---

## Already Implemented (Per Your Comments)

- ✅ **#14** Category filter exists
- ✅ **#16** Offer type (CPA/CPL/CPI) exists
- ✅ **#26-28** Multi-country extraction working for CPA Merchant

---

## Recommended Execution Order

### Week 1 - Quick Wins
1. ~~All iframe enhancements~~ ✅ DONE
2. Fix localhost link (#29)
3. Add sorting (#17) - BOTH SIDES
4. Add pagination limits (#10) - BOTH SIDES

### Week 2 - Core Features
1. Country filter (#15)
2. Multi-copy feature (#21)
3. Fix API import counts (#22, #25)
4. Table view for users (#24)

### Week 3 - Major Features
1. Admin/User separation (#37)
2. Points percentage config (#39)
3. Notification system (#42)

### Week 4 - Polish & Testing
1. All remaining items
2. Full testing (#57, #58)
