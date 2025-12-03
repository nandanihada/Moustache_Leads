# 🎯 OFFERWALL FRONTEND - BACKEND INTEGRATION GUIDE

**Status**: ✅ READY FOR INTEGRATION
**Date**: Nov 26, 2025

---

## 📡 NEW BACKEND ENDPOINTS

### 1. Get Real Offers
```javascript
// Fetch real offers from database
fetch(`/api/offerwall/offers?placement_id=${placementId}&user_id=${userId}&limit=50`)
  .then(res => res.json())
  .then(data => {
    console.log('Offers:', data.offers);
    // Display offers on cards
  });
```

**Response**:
```json
{
    "offers": [
        {
            "id": "SURVEY_001",
            "title": "Market Research Survey",
            "description": "Share your opinion...",
            "reward_amount": 150,
            "category": "survey",
            "image_url": "https://...",
            "click_url": "https://...",
            "estimated_time": "5-10 minutes"
        }
    ],
    "total_count": 10
}
```

---

### 2. Track Offer Completion
```javascript
// When offer is completed, send conversion
fetch('/api/offerwall/track/conversion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        session_id: sessionId,
        click_id: clickId,
        offer_id: offerId,
        placement_id: placementId,
        user_id: userId,
        payout_amount: rewardAmount,
        offer_name: offerTitle
    })
})
.then(res => res.json())
.then(data => {
    console.log('Conversion tracked:', data.conversion_id);
    // Activity record created automatically
    // Refresh stats
    fetchUserStats();
});
```

---

### 3. Get User Activity
```javascript
// Fetch completed offers
fetch(`/api/offerwall/user/activity?user_id=${userId}&placement_id=${placementId}`)
  .then(res => res.json())
  .then(data => {
    console.log('Activities:', data.activities);
    // Display in Activity Modal
    displayActivities(data.activities);
  });
```

**Response**:
```json
{
    "success": true,
    "activities": [
        {
            "activity_id": "act_uuid",
            "offer_id": "SURVEY_001",
            "offer_title": "Market Research Survey",
            "reward_amount": 150,
            "completed_at": "2025-11-26T10:30:00Z",
            "status": "completed"
        }
    ],
    "total_completed": 5
}
```

---

### 4. Get User Stats
```javascript
// Fetch user statistics
fetch(`/api/offerwall/user/stats?user_id=${userId}&placement_id=${placementId}`)
  .then(res => res.json())
  .then(data => {
    console.log('Stats:', data);
    // Update stats display
    updateStatsDisplay({
        totalEarned: data.total_earned,
        todayEarned: data.today_earned,
        offersCompleted: data.offers_completed,
        completedOffers: data.completed_offers
    });
  });
```

**Response**:
```json
{
    "success": true,
    "total_earned": 500,
    "today_earned": 150,
    "offers_completed": 5,
    "completed_offers": [
        {
            "offer_id": "SURVEY_001",
            "offer_title": "Market Research Survey",
            "reward_amount": 150,
            "completed_at": "2025-11-26T10:30:00Z"
        }
    ]
}
```

---

## 🔄 INTEGRATION FLOW

### Step 1: Load Offers (On Page Load)
```javascript
async function loadOffers() {
    const response = await fetch(
        `/api/offerwall/offers?placement_id=${PLACEMENT_ID}&user_id=${USER_ID}&limit=50`
    );
    const data = await response.json();
    
    // Use data.offers to render cards
    renderOfferCards(data.offers);
}
```

### Step 2: Load Stats (On Page Load)
```javascript
async function loadStats() {
    const response = await fetch(
        `/api/offerwall/user/stats?user_id=${USER_ID}&placement_id=${PLACEMENT_ID}`
    );
    const data = await response.json();
    
    // Update stats display
    document.getElementById('totalEarned').textContent = data.total_earned;
    document.getElementById('todayEarned').textContent = data.today_earned;
    document.getElementById('offersCompleted').textContent = data.offers_completed;
}
```

### Step 3: Track Click (When User Clicks Offer)
```javascript
function handleOfferClick(offerId, offerTitle, clickUrl) {
    // Track click
    fetch('/api/offerwall/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            placement_id: PLACEMENT_ID,
            user_id: USER_ID,
            offer_id: offerId,
            offer_name: offerTitle,
            user_agent: navigator.userAgent
        })
    })
    .then(res => res.json())
    .then(data => {
        // Open offer in new tab
        window.open(clickUrl, '_blank');
    });
}
```

### Step 4: Track Conversion (When Offer Completes)
```javascript
function trackOfferCompletion(offerId, offerTitle, rewardAmount) {
    fetch('/api/offerwall/track/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: SESSION_ID,
            click_id: CLICK_ID,
            offer_id: offerId,
            placement_id: PLACEMENT_ID,
            user_id: USER_ID,
            payout_amount: rewardAmount,
            offer_name: offerTitle
        })
    })
    .then(res => res.json())
    .then(data => {
        // Refresh stats and activity
        loadStats();
        loadActivity();
    });
}
```

### Step 5: Load Activity (When User Views Activity Modal)
```javascript
async function loadActivity() {
    const response = await fetch(
        `/api/offerwall/user/activity?user_id=${USER_ID}&placement_id=${PLACEMENT_ID}&limit=50`
    );
    const data = await response.json();
    
    // Display activities
    displayActivities(data.activities);
}
```

---

## 🎨 FRONTEND UPDATES NEEDED

### Update 1: Offer Card Rendering
```javascript
// OLD: Uses mock data
// NEW: Uses real data from API

function renderOfferCards(offers) {
    const container = document.getElementById('offersContainer');
    container.innerHTML = '';
    
    offers.forEach(offer => {
        const card = document.createElement('div');
        card.className = 'offer-card';
        card.innerHTML = `
            <div class="offer-image">
                ${offer.image_url ? `<img src="${offer.image_url}" alt="${offer.title}">` : '📋'}
            </div>
            <div class="offer-content">
                <h3 class="offer-title">${offer.title}</h3>
                <p class="offer-description">${offer.description}</p>
                <div class="reward-box">
                    <div>
                        <div class="reward-label">REWARD</div>
                        <div class="reward-amount">${offer.reward_amount}</div>
                    </div>
                </div>
                <div class="offer-meta">
                    <span>${offer.category}</span>
                    <span>⏱️ ${offer.estimated_time}</span>
                </div>
                <button class="offer-button" onclick="handleOfferClick('${offer.id}', '${offer.title}', '${offer.click_url}')">
                    Start Now
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}
```

### Update 2: Stats Display
```javascript
// Update stats display with real data
function updateStatsDisplay(stats) {
    document.getElementById('totalEarned').textContent = stats.totalEarned;
    document.getElementById('todayEarned').textContent = stats.todayEarned;
    document.getElementById('offersCompleted').textContent = stats.offersCompleted;
    
    // Update completed offers list
    const completedList = document.getElementById('completedOffersList');
    completedList.innerHTML = stats.completedOffers.map(offer => `
        <div class="completed-offer">
            <span>${offer.offer_title}</span>
            <span>+${offer.reward_amount}</span>
            <span>${new Date(offer.completed_at).toLocaleDateString()}</span>
        </div>
    `).join('');
}
```

### Update 3: Activity Modal
```javascript
// Display completed offers in Activity Modal
function displayActivities(activities) {
    const container = document.getElementById('activityList');
    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-title">${activity.offer_title}</div>
            <div class="activity-reward">+${activity.reward_amount}</div>
            <div class="activity-date">${new Date(activity.completed_at).toLocaleString()}</div>
        </div>
    `).join('');
}
```

---

## 🔄 AUTO-REFRESH STATS

```javascript
// Refresh stats every 5 seconds
setInterval(() => {
    loadStats();
    loadActivity();
}, 5000);
```

---

## 📊 COMPLETE INTEGRATION EXAMPLE

```javascript
// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load offers
    await loadOffers();
    
    // Load stats
    await loadStats();
    
    // Set up auto-refresh
    setInterval(() => {
        loadStats();
        loadActivity();
    }, 5000);
    
    // Set up event listeners
    document.getElementById('activityBtn').addEventListener('click', loadActivity);
});

// Load offers from API
async function loadOffers() {
    const response = await fetch(
        `/api/offerwall/offers?placement_id=${PLACEMENT_ID}&user_id=${USER_ID}&limit=50`
    );
    const data = await response.json();
    renderOfferCards(data.offers);
}

// Load stats from API
async function loadStats() {
    const response = await fetch(
        `/api/offerwall/user/stats?user_id=${USER_ID}&placement_id=${PLACEMENT_ID}`
    );
    const data = await response.json();
    updateStatsDisplay(data);
}

// Load activity from API
async function loadActivity() {
    const response = await fetch(
        `/api/offerwall/user/activity?user_id=${USER_ID}&placement_id=${PLACEMENT_ID}`
    );
    const data = await response.json();
    displayActivities(data.activities);
}

// Handle offer click
function handleOfferClick(offerId, offerTitle, clickUrl) {
    fetch('/api/offerwall/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            placement_id: PLACEMENT_ID,
            user_id: USER_ID,
            offer_id: offerId,
            offer_name: offerTitle,
            user_agent: navigator.userAgent
        })
    })
    .then(() => window.open(clickUrl, '_blank'));
}

// Track completion
function trackCompletion(offerId, offerTitle, reward) {
    fetch('/api/offerwall/track/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: SESSION_ID,
            click_id: CLICK_ID,
            offer_id: offerId,
            placement_id: PLACEMENT_ID,
            user_id: USER_ID,
            payout_amount: reward,
            offer_name: offerTitle
        })
    })
    .then(() => {
        loadStats();
        loadActivity();
    });
}
```

---

## ✅ CHECKLIST

- [ ] Update offer card rendering to use real data
- [ ] Update stats display
- [ ] Update activity modal
- [ ] Add auto-refresh timer
- [ ] Test with real offers
- [ ] Test with real stats
- [ ] Test activity tracking
- [ ] Verify timestamps
- [ ] Check error handling
- [ ] Monitor performance

---

## 🚀 DEPLOYMENT

1. Update frontend code with new API calls
2. Test locally with backend
3. Deploy to production
4. Monitor for errors
5. Gather user feedback

---

**Frontend integration ready!** 🎉
