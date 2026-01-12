# Duplicate Offer Removal - Deployment Checklist

## ✅ Pre-Deployment Checklist

### Code Review
- [x] Backend logic implemented (`duplicate_remover.py`)
- [x] API endpoints added (`admin_offers.py`)
- [x] Frontend service methods added (`adminOfferApi.ts`)
- [x] UI component updated (`AdminOffers.tsx`)
- [x] No TypeScript errors
- [x] No Python errors
- [x] Code follows project conventions

### Testing
- [ ] Test duplicate detection with real data
- [ ] Test duplicate removal with test data
- [ ] Verify newest version is kept
- [ ] Test with no duplicates scenario
- [ ] Test error handling
- [ ] Test UI button states
- [ ] Test confirmation dialog
- [ ] Test toast notifications
- [ ] Test page refresh after removal

### Documentation
- [x] Technical documentation created
- [x] User guide created
- [x] Flow diagram created
- [x] Test script created
- [x] Deployment checklist created

## 🚀 Deployment Steps

### Step 1: Backup Database
```bash
# Create a backup before deploying
mongodump --db your_database_name --out backup_$(date +%Y%m%d)
```

### Step 2: Deploy Backend Files
```bash
# Copy new files to server
scp backend/utils/duplicate_remover.py server:/path/to/backend/utils/
scp backend/test_duplicate_removal.py server:/path/to/backend/

# Update existing file
scp backend/routes/admin_offers.py server:/path/to/backend/routes/
```

### Step 3: Deploy Frontend Files
```bash
# Update frontend files
scp src/services/adminOfferApi.ts server:/path/to/src/services/
scp src/pages/AdminOffers.tsx server:/path/to/src/pages/
```

### Step 4: Restart Services
```bash
# Restart backend
sudo systemctl restart your-backend-service

# Rebuild frontend (if needed)
npm run build
```

### Step 5: Verify Deployment
- [ ] Backend server started successfully
- [ ] No errors in backend logs
- [ ] Frontend built successfully
- [ ] No console errors in browser
- [ ] Button appears in admin panel
- [ ] API endpoints respond correctly

## 🧪 Post-Deployment Testing

### Test 1: Check for Duplicates (No Removal)
1. Log in as admin
2. Navigate to Offers Management
3. Click "Remove Duplicates" button
4. If no duplicates: Should show "No Duplicates Found" toast
5. If duplicates exist: Should show confirmation dialog

### Test 2: Create Test Duplicates
```bash
# On server
cd /path/to/backend
python test_duplicate_removal.py --create-test
```

### Test 3: Remove Test Duplicates
1. Click "Remove Duplicates" button
2. Verify confirmation dialog shows correct counts
3. Click OK
4. Verify success toast appears
5. Verify offers list refreshes
6. Verify only one offer per offer_id remains

### Test 4: Cleanup Test Data
```bash
# On server
python test_duplicate_removal.py --cleanup-test
```

### Test 5: API Endpoint Testing
```bash
# Test check endpoint
curl -X GET http://your-server/api/admin/offers/duplicates/check \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test remove endpoint
curl -X POST http://your-server/api/admin/offers/duplicates/remove \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keep_strategy": "newest"}'
```

## 🔍 Monitoring

### Logs to Monitor
```bash
# Backend logs
tail -f /var/log/your-backend.log | grep -i duplicate

# Check for errors
grep -i "error.*duplicate" /var/log/your-backend.log
```

### Metrics to Track
- Number of duplicate checks performed
- Number of duplicates removed
- Average response time
- Error rate
- User adoption rate

## 🐛 Troubleshooting

### Issue: Button doesn't appear
**Check:**
- User is logged in as admin
- User has 'offers' permission
- Frontend files deployed correctly
- Browser cache cleared

**Fix:**
```bash
# Clear browser cache
# Or force refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Issue: "Failed to check duplicates" error
**Check:**
- Backend server is running
- Database connection is active
- API endpoint is accessible
- Authentication token is valid

**Fix:**
```bash
# Check backend logs
tail -f /var/log/your-backend.log

# Test database connection
python -c "from database import db_instance; print(db_instance.get_collection('offers'))"
```

### Issue: Duplicates not removed
**Check:**
- Offers have exact same `offer_id`
- Offers are not soft-deleted (`is_active: true`)
- Database write permissions
- No database errors in logs

**Fix:**
```bash
# Check database directly
mongo your_database
> db.offers.aggregate([
    { $group: { _id: '$offer_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ])
```

### Issue: Wrong version kept
**Check:**
- `updated_at` timestamps are correct
- `created_at` timestamps are correct
- Keep strategy is set to "newest"

**Fix:**
- Verify timestamps in database
- Check if `updated_at` field exists
- Ensure timestamps are in correct format

## 🔐 Security Verification

### Access Control
- [ ] Only admins can access the feature
- [ ] Authentication is required
- [ ] Authorization is enforced
- [ ] Audit logs are created

### Test Security
```bash
# Test without authentication (should fail)
curl -X GET http://your-server/api/admin/offers/duplicates/check

# Test with non-admin user (should fail)
curl -X GET http://your-server/api/admin/offers/duplicates/check \
  -H "Authorization: Bearer NON_ADMIN_TOKEN"
```

## 📊 Performance Testing

### Load Testing
```bash
# Test with large dataset
# Create 1000 test duplicates
for i in {1..1000}; do
  python test_duplicate_removal.py --create-test
done

# Measure performance
time curl -X GET http://your-server/api/admin/offers/duplicates/check \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Performance
- Check duplicates: < 2 seconds for 10,000 offers
- Remove duplicates: < 5 seconds for 1,000 duplicates
- UI response: < 1 second

## 📝 Rollback Plan

### If Issues Occur
1. **Stop the service**
   ```bash
   sudo systemctl stop your-backend-service
   ```

2. **Restore previous version**
   ```bash
   # Restore backend files
   cp backup/admin_offers.py backend/routes/
   rm backend/utils/duplicate_remover.py
   
   # Restore frontend files
   git checkout HEAD~1 src/services/adminOfferApi.ts
   git checkout HEAD~1 src/pages/AdminOffers.tsx
   ```

3. **Restore database (if needed)**
   ```bash
   mongorestore --db your_database_name backup_YYYYMMDD/
   ```

4. **Restart service**
   ```bash
   sudo systemctl start your-backend-service
   ```

## ✅ Sign-Off Checklist

### Development Team
- [ ] Code reviewed and approved
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] Documentation complete

### QA Team
- [ ] Functional testing complete
- [ ] Security testing complete
- [ ] Performance testing complete
- [ ] User acceptance testing complete

### DevOps Team
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Alerts configured

### Product Team
- [ ] Feature requirements met
- [ ] User documentation complete
- [ ] Training materials prepared
- [ ] Stakeholders notified

## 🎉 Post-Deployment

### Communication
- [ ] Notify admin users about new feature
- [ ] Send user guide to admins
- [ ] Update internal documentation
- [ ] Add to release notes

### Monitoring Period
- Monitor for 24 hours after deployment
- Check logs for errors
- Track usage metrics
- Gather user feedback

### Success Criteria
- [ ] No critical errors in 24 hours
- [ ] Feature used by at least 3 admins
- [ ] Positive user feedback
- [ ] Performance within acceptable limits

## 📞 Support Contacts

**Technical Issues:**
- Backend: [Backend Team Contact]
- Frontend: [Frontend Team Contact]
- Database: [Database Team Contact]

**Emergency Rollback:**
- On-Call Engineer: [Contact Info]
- Escalation: [Manager Contact]

---

**Deployment Date:** _________________

**Deployed By:** _________________

**Verified By:** _________________

**Sign-Off:** _________________
