# Manager Feedback - Prioritized Task List

## Priority Legend
- 🟢 **P1 - Quick Fix** (< 1 hour) - Simple UI changes, text updates, small fixes
- 🟡 **P2 - Medium** (1-4 hours) - Feature additions, moderate complexity
- 🔴 **P3 - Complex** (4+ hours) - Major features, backend changes, integrations

---

## 🟢 P1 - QUICK FIXES (Do First)

### UI/Text Changes
- [ ] **#18** Add Terms & Conditions and Privacy Policy links in footer/left corner (need content)
- [ ] **#19** Add Teams link in footer (clarify: what Teams link?)
- [ ] **#29** Fix shorten link showing localhost - should show production URL
- [ ] **#31** Traffic sources showing nothing - show "Default" or actual value
- [ ] **#44** Limit description in iframe cards with "..." truncation, hide partner name
- [ ] **#47** Fix "NaN%" display issue
- [ ] **#54** Add "ML" or "Moustache Leads" branding on iframe header
- [ ] **#55** Change "Start Earning Now" to "Click to Earn" in iframe

### Admin Offers Page
- [ ] **#10** Add "Show All" button with pagination limits (min 50, max 200)
- [ ] **#17** Add sorting options: ID (asc/desc), Payout, Title (A-Z/Z-A)
- [ ] **#20** Fix display issue - "72746 Isybank" showing "All Users what?" - verify data

### Iframe/Offerwall
- [ ] **#46** Remove or fix "5-10 minutes" time limit showing on every offer
- [ ] **#48** Add country flag/label and device type icon in offer cards

---

## 🟡 P2 - MEDIUM PRIORITY

### Filtering & Display
- [ ] **#14** Category filter exists - verify it's working properly
- [ ] **#15** Add country filter for offers
- [ ] **#16** Offer type filter (CPA/CPL/CPI) - verify existing implementation
- [ ] **#24** Add table view for user/publisher side (currently only card view)
- [ ] **#53** Fix iframe filters - currently dummy/not working

### Copy & Export Features
- [ ] **#21** Add multi-field copy feature (up to 6 fields): name, country, moustache link, etc.
- [ ] **#21b** Give publisher ID to admin for tracking purposes

### API Import Issues
- [ ] **#22** LeadAds showing only 5 offers - add selection for offer types (active/all)
- [ ] **#25** Chameleon Ads showing only 5 offers - fix count display
- [ ] **#26** Multiple countries not showing (FR DE AT CH NL NO SE) - check API parsing
- [ ] **#27** "GLOBAL (ALL GEOS)" showing as USA only - fix geo parsing
- [ ] **#28** CPA Merchant detecting multiple countries but Chameleon not - fix API parser

### Duplicate Management
- [ ] **#11** Improve duplicate detection - show preview before delete, option to keep/delete
- [ ] **#12** Add recycle bin for deleted offers (soft delete)
- [ ] **#13** Add box view / single offer carousel view (next/prev navigation)

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
- [ ] **#49** Add urgency boosters: timer, "Limited slots", "High demand", "Expires soon"

---

## 🔴 P3 - COMPLEX IMPLEMENTATIONS

### Admin/User Separation
- [ ] **#37** Separate admin and user dashboards completely
  - Remove admin/user toggle button
  - Keep "login as user" feature from user management
  - Create separate admin URL/route

### Points System
- [ ] **#39** Fix points display - show percentage, allow configuration per offer
- [ ] **#52** Convert rewards from dollars to points system
  - User configurable: 1$ = X points
  - Display points instead of dollars

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

### Compliance Display
- [ ] **#56** Add compliance conditions display:
  - No VPN/Proxies
  - No Emulators/Bots/Farms
  - New Users Only
  - Same device/IP/user rejection warning

### Active Users
- [ ] **#38** Define and display "active user" criteria clearly

### Testing
- [ ] **#57** Test SurveyTitans integration - verify clicks showing real activity
- [ ] **#58** General testing and verification

---

## Questions for Manager (Need Clarification)

1. **#19** - What "Teams" link? Microsoft Teams? A team page?
2. **#30** - Location section countries appearing - what's the issue exactly?
3. **#36** - "User management section showing in user management section" - need more details
4. **#45** - "iframe names should automatically change with word limit" - need example
5. **#54** - Where exactly should "ML/Moustache Leads" appear?

---

## Already Implemented (Per Your Comments)

- ✅ **#14** Category filter exists
- ✅ **#16** Offer type (CPA/CPL/CPI) exists
- ✅ **#26-28** Multi-country extraction working for CPA Merchant

---

## Recommended Execution Order

### Week 1 - Quick Wins
1. All P1 items (UI fixes, text changes)
2. Fix localhost link (#29)
3. Add sorting (#17)
4. Fix NaN% (#47)

### Week 2 - Core Features
1. Country filter (#15)
2. Multi-copy feature (#21)
3. Fix API import counts (#22, #25)
4. Table view for users (#24)

### Week 3 - Major Features
1. Admin/User separation (#37)
2. Points system (#39, #52)
3. Notification system (#42)

### Week 4 - Polish & Testing
1. Compliance display (#56)
2. All remaining items
3. Full testing (#57, #58)
