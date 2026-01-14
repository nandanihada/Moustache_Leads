# Subdomain Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. GoDaddy DNS Configuration
- [ ] Log in to GoDaddy account
- [ ] Navigate to DNS management for moustacheleads.com
- [ ] Add CNAME record: `dashboard` → `cname.vercel-dns.com`
- [ ] Add CNAME record: `offers` → `cname.vercel-dns.com`
- [ ] Add CNAME record: `offerwall` → `cname.vercel-dns.com`
- [ ] Add CNAME record: `landing` → `cname.vercel-dns.com`
- [ ] Save all DNS records
- [ ] Wait 5-10 minutes for DNS propagation

**Note:** No subdomain needed for postback - it uses backend URL

### 2. Vercel Domain Configuration
- [ ] Go to Vercel dashboard
- [ ] Select moustacheleads project
- [ ] Navigate to Settings → Domains
- [ ] Add domain: `dashboard.moustacheleads.com`
- [ ] Add domain: `offers.moustacheleads.com`
- [ ] Add domain: `offerwall.moustacheleads.com`
- [ ] Add domain: `landing.moustacheleads.com`
- [ ] Wait for all domains to show "Valid Configuration"
- [ ] Verify SSL certificates are provisioned

### 3. Code Changes
- [x] Created `src/config/subdomains.ts`
- [x] Created `src/middleware/subdomainRouter.tsx`
- [x] Updated `src/App.tsx` with SubdomainRouter
- [x] Updated `vercel.json` configuration
- [x] Updated backend CORS in `backend/app.py`

### 4. Deploy Frontend
```bash
cd Moustache_Leads
git add .
git commit -m "Add subdomain routing support"
git push origin main
```
- [ ] Push code to repository
- [ ] Verify Vercel auto-deployment completes
- [ ] Check deployment logs for errors

### 5. Deploy Backend
```bash
cd Moustache_Leads/backend
git add app.py
git commit -m "Update CORS for subdomains"
git push origin main
```
- [ ] Push backend changes
- [ ] Verify Render auto-deployment completes
- [ ] Check backend logs for CORS updates

---

## ✅ Post-Deployment Testing

### Test Each Subdomain
- [ ] Visit `https://dashboard.moustacheleads.com` → Should show admin dashboard (`/admin`)
- [ ] Visit `https://offers.moustacheleads.com` → Should show publisher offers (`/dashboard/offers`)
- [ ] Visit `https://offerwall.moustacheleads.com/offerwall?placement_id=test&user_id=test` → Should show offerwall with params
- [ ] Visit `https://landing.moustacheleads.com` → Should show landing page
- [ ] Verify postback URLs work: `https://moustacheleads-backend.onrender.com/postback/{key}`

### Test Authentication
- [ ] Login from `dashboard.moustacheleads.com`
- [ ] Verify session persists across subdomains
- [ ] Test logout functionality

### Test API Calls
- [ ] Open browser console on each subdomain
- [ ] Verify no CORS errors
- [ ] Test API endpoints (offers, analytics, etc.)
- [ ] Verify data loads correctly

### Test Navigation
- [ ] Navigate from dashboard to offers
- [ ] Verify subdomain changes correctly
- [ ] Test back/forward browser buttons
- [ ] Test direct URL access

### Test SSL Certificates
- [ ] Verify HTTPS works on all subdomains
- [ ] Check for SSL warnings
- [ ] Verify certificate validity

---

## ✅ Monitoring

### First 24 Hours
- [ ] Monitor Vercel deployment logs
- [ ] Monitor Render backend logs
- [ ] Check for CORS errors in browser console
- [ ] Monitor user feedback/reports
- [ ] Check analytics for traffic patterns

### Performance Checks
- [ ] Test page load times on each subdomain
- [ ] Verify CDN caching works correctly
- [ ] Check for any 404 or 500 errors
- [ ] Monitor API response times

---

## 🚨 Rollback Plan (If Needed)

### Quick Rollback
1. Remove subdomain CNAME records from GoDaddy
2. Remove subdomain domains from Vercel
3. Revert code changes:
```bash
git revert HEAD
git push origin main
```

### Partial Rollback
- Keep DNS records but remove from Vercel
- This allows testing without affecting production

---

## 📝 Notes

### DNS Propagation
- Initial propagation: 5-10 minutes
- Full global propagation: up to 48 hours
- Use `nslookup dashboard.moustacheleads.com` to check

### SSL Certificates
- Vercel auto-provisions Let's Encrypt certificates
- Usually takes 5-10 minutes
- Automatically renews before expiration

### Session Management
- Cookies should be set with domain `.moustacheleads.com`
- This allows sharing across all subdomains
- Verify in browser DevTools → Application → Cookies

---

## 🎯 Success Criteria

- ✅ All 4 subdomains resolve correctly (dashboard, offers, offerwall, landing)
- ✅ SSL certificates valid on all subdomains
- ✅ No CORS errors in browser console
- ✅ Authentication works across subdomains
- ✅ All API calls succeed
- ✅ Navigation between subdomains works smoothly
- ✅ Query parameters preserved on offerwall subdomain
- ✅ Postback URLs work from backend domain
- ✅ No increase in error rates
- ✅ Page load times remain acceptable

---

## 📞 Support Contacts

- **Vercel Support**: https://vercel.com/support
- **GoDaddy Support**: https://www.godaddy.com/help
- **Render Support**: https://render.com/docs/support

---

## 🔗 Useful Commands

### Check DNS Resolution
```bash
nslookup dashboard.moustacheleads.com
nslookup offers.moustacheleads.com
nslookup offerwall.moustacheleads.com
nslookup landing.moustacheleads.com
```

### Test SSL Certificate
```bash
curl -I https://dashboard.moustacheleads.com
```

### Check CORS Headers
```bash
curl -H "Origin: https://dashboard.moustacheleads.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  https://your-backend.onrender.com/api/offers
```

---

## ✨ Completion

Once all items are checked:
- [ ] Document any issues encountered
- [ ] Update team on new subdomain structure
- [ ] Update external documentation/links
- [ ] Celebrate successful deployment! 🎉
