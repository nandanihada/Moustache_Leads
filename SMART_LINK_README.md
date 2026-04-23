# Smart Link (Smart Redirect) System

A comprehensive smart link system for affiliate/campaign platforms that automatically redirects users to the best available offers based on their location, device, and other targeting criteria.

## Features

### Core Functionality
- **Single URL Redirects**: One smart link URL that redirects to the best offer
- **Geo-Targeting**: Automatic country detection and offer filtering
- **Device Targeting**: Mobile, tablet, desktop detection
- **Traffic Source Validation**: Filter by traffic source/sub-ID
- **Offer Rotation**: Distribute traffic evenly across offers
- **Performance-Based Selection**: Route to high-performing offers
- **Time-Based Offers**: Schedule offers for specific time periods

### Admin Dashboard
- Create and manage smart links
- View comprehensive analytics
- Filter by country, network, offer, date range
- Real-time metrics and performance tracking

## API Endpoints

### Smart Link Redirect
```
GET /smart/{slug}
```
Automatically redirects users to the best offer based on their profile.

### Admin APIs
```
GET  /api/admin/smart-links                    # List all smart links
POST /api/admin/smart-links                    # Create new smart link
PUT  /api/admin/smart-links/{id}               # Update smart link
DELETE /api/admin/smart-links/{id}             # Delete smart link
GET  /api/admin/smart-links/{id}/analytics     # Get analytics for smart link
```

## Database Schema

### SmartLinks Collection
```javascript
{
  _id: ObjectId,
  name: String,           // Display name
  slug: String,           // Unique URL slug
  status: String,         // 'active' or 'inactive'
  offer_ids: [String],    // Optional list of offer IDs that this smart link can serve
  rotation_strategy: String, // 'performance', 'round_robin', or 'random'
  fallback_url: String,   // Optional URL to send traffic when no offer matches
  created_at: DateTime,
  updated_at: DateTime
}
```

### ClickLogs Collection
```javascript
{
  _id: ObjectId,
  smart_link_id: String,
  offer_id: String,
  country: String,
  ip: String,
  user_agent: String,
  click_id: String,
  timestamp: DateTime
}
```

## Usage

### 1. Create a Smart Link
Use the admin dashboard at `/admin/smart-links` to create a new smart link.

### 2. Share the Link
The smart link URL will be: `https://yourdomain.com/smart/your-slug`

### 3. Automatic Redirect
When users click the link, they are automatically redirected to the best available offer based on:
- User's country (detected via IP geolocation)
- Device type (mobile/tablet/desktop)
- Traffic source (if provided in URL parameters)
- Offer availability and targeting rules
- Performance metrics

## Configuration

### Offer Targeting Fields
Offers in the database should include these fields for smart link targeting:

```javascript
{
  countries: ["US", "CA", "GB"],           // Array of country codes
  device_targeting: "all",                 // "all", "mobile", "tablet", "desktop"
  allowed_traffic_sources: ["source1"],    // Array of allowed sources
  blocked_traffic_sources: [],             // Array of blocked sources
  schedule_rules: [{                       // Time-based scheduling
    days: [1, 2, 3, 4, 5],                // Monday=0, Sunday=6
    start_time: "09:00",
    end_time: "17:00",
    active: true
  }],
  performance_score: 0.85,                // For performance-based selection
  rotation_weight: 1.0                    // For weighted rotation
}
```

## Advanced Features

### Offer Selection Strategies

1. **Round Robin**: Distribute traffic evenly across all eligible offers
2. **Performance-Based**: Prioritize offers with higher conversion rates
3. **Random**: Random selection from eligible offers
4. **Weighted**: Use rotation_weight for custom distribution

### Fallback Logic

1. If no country-specific offers: Use global offers
2. If no offers match criteria: Redirect to default URL
3. If geolocation fails: Use global offers

### Analytics

Track every click with:
- Smart link ID
- Selected offer ID
- User country and IP
- Device/browser info
- Timestamp
- Unique click ID

## Development

### Backend Setup
```bash
cd backend
python run.py
```

### Frontend Setup
```bash
npm install
npm run dev
```

### Testing
1. Create test offers with different targeting
2. Create a smart link via admin dashboard
3. Test redirects from different countries/devices
4. Verify analytics are recorded correctly

## Security Considerations

- IP geolocation may not be 100% accurate
- Consider user privacy and GDPR compliance
- Validate traffic sources to prevent abuse
- Monitor for click fraud patterns
- Use HTTPS for all smart link URLs

## Performance

- Smart links redirect instantly (no page load)
- Geolocation lookup cached where possible
- Database queries optimized with proper indexing
- Analytics logging is asynchronous to avoid redirect delays