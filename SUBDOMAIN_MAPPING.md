# Subdomain Mapping Reference

## Frontend Subdomains

### 1. Admin Dashboard
- **Subdomain**: `dashboard.moustacheleads.com`
- **Route**: `/admin`
- **Full URL**: `https://dashboard.moustacheleads.com/admin`
- **Purpose**: Admin panel for managing offers, publishers, analytics
- **Access**: Admin users only

### 2. Publisher Offers
- **Subdomain**: `offers.moustacheleads.com`
- **Route**: `/dashboard/offers`
- **Full URL**: `https://offers.moustacheleads.com/dashboard/offers`
- **Purpose**: Publisher dashboard to view and manage available offers
- **Access**: Publisher users (logged in)

### 3. User Offerwall
- **Subdomain**: `offerwall.moustacheleads.com`
- **Route**: `/offerwall?placement_id={id}&user_id={user}`
- **Example URL**: `https://offerwall.moustacheleads.com/offerwall?placement_id=kSonv403NKleLqWV&user_id=test_user`
- **Purpose**: End-user facing offerwall with available offers
- **Access**: Public (with placement_id and user_id params)
- **Note**: Query parameters are preserved during subdomain routing

### 4. Landing Page
- **Subdomain**: `landing.moustacheleads.com`
- **Route**: `/`
- **Full URL**: `https://landing.moustacheleads.com/`
- **Purpose**: Main marketing/landing page
- **Access**: Public

---

## Backend Endpoints (No Subdomain)

### Postback URLs
- **Domain**: Backend domain (Render)
- **Format**: `https://moustache-leads-1.onrender.com/postback/{key}`
- **Example**: `https://moustache-leads-1.onrender.com/postback/bMi72vJxWiw-gEXrhSpMOlMLB1s7X3od?aff_sub={aff_sub}&status={status}&payout={payout}&transaction_id={transaction_id}`
- **Purpose**: Receive conversion postbacks from offer networks
- **Access**: API endpoint (no frontend subdomain needed)
- **Note**: These are server-to-server callbacks, not user-facing pages

---

## DNS Configuration (GoDaddy)

Add these CNAME records:

| Subdomain  | Type  | Value                | TTL |
|------------|-------|----------------------|-----|
| dashboard  | CNAME | cname.vercel-dns.com | 600 |
| offers     | CNAME | cname.vercel-dns.com | 600 |
| offerwall  | CNAME | cname.vercel-dns.com | 600 |
| landing    | CNAME | cname.vercel-dns.com | 600 |

---

## Vercel Domain Configuration

Add these domains in Vercel project settings:
1. `dashboard.moustacheleads.com`
2. `offers.moustacheleads.com`
3. `offerwall.moustacheleads.com`
4. `landing.moustacheleads.com`

---

## CORS Configuration

Backend allows requests from:
- `https://moustacheleads.com`
- `https://www.moustacheleads.com`
- `https://dashboard.moustacheleads.com`
- `https://offers.moustacheleads.com`
- `https://offerwall.moustacheleads.com`
- `https://landing.moustacheleads.com`
- `http://localhost:*` (development)

---

## Routing Logic

### Subdomain Detection
The app detects the current subdomain and automatically routes to the appropriate page:

```typescript
// If on dashboard.moustacheleads.com → Navigate to /admin
// If on offers.moustacheleads.com → Navigate to /dashboard/offers
// If on offerwall.moustacheleads.com → Navigate to /offerwall (preserve query params)
// If on landing.moustacheleads.com → Navigate to /
```

### Cross-Subdomain Navigation
When a user navigates to a route that belongs to a different subdomain:

```typescript
// User on dashboard.moustacheleads.com clicks link to /dashboard/offers
// → Redirects to offers.moustacheleads.com/dashboard/offers

// User on offers.moustacheleads.com clicks link to /admin
// → Redirects to dashboard.moustacheleads.com/admin
```

### Query Parameter Preservation
For offerwall subdomain, query parameters are always preserved:

```typescript
// Original: offerwall.moustacheleads.com/offerwall?placement_id=xxx&user_id=yyy
// After routing: Query params remain intact
```

---

## Local Development

During local development (localhost:8080 or localhost:5173):
- Subdomain routing is disabled
- All routes work normally without subdomain detection
- Full paths work: `http://localhost:8080/admin`, `http://localhost:8080/dashboard/offers`, etc.

---

## Migration Path

### Old URLs → New URLs

| Old URL | New URL |
|---------|---------|
| `moustacheleads.com/admin` | `dashboard.moustacheleads.com/admin` |
| `moustacheleads.com/dashboard/offers` | `offers.moustacheleads.com/dashboard/offers` |
| `moustacheleads.com/offerwall?params` | `offerwall.moustacheleads.com/offerwall?params` |
| `moustacheleads.com/` | `landing.moustacheleads.com/` |

### Backward Compatibility
- Old URLs will still work on main domain
- Subdomain router will redirect to appropriate subdomain
- No breaking changes for existing users

---

## Testing Checklist

- [ ] Admin can access dashboard at `dashboard.moustacheleads.com`
- [ ] Publishers can access offers at `offers.moustacheleads.com`
- [ ] Offerwall loads with query params at `offerwall.moustacheleads.com/offerwall?placement_id=test&user_id=test`
- [ ] Landing page loads at `landing.moustacheleads.com`
- [ ] Postback URLs work: `https://moustacheleads-backend.onrender.com/postback/{key}`
- [ ] Cross-subdomain navigation works smoothly
- [ ] Authentication persists across subdomains
- [ ] No CORS errors in browser console
- [ ] SSL certificates valid on all subdomains

---

## Support

If you encounter issues:
1. Check DNS propagation: `nslookup subdomain.moustacheleads.com`
2. Verify Vercel domain status in dashboard
3. Check browser console for CORS or routing errors
4. Verify SSL certificates are active
5. Test with different browsers/incognito mode
