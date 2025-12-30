from flask import Blueprint, request, jsonify, render_template_string
from models.placement import Placement
from models.tracking import Tracking
from models.offers import OffersService
from models.offerwall_tracking import OfferwallTracking
from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import uuid
import os

logger = logging.getLogger(__name__)

offerwall_bp = Blueprint('offerwall', __name__)

# Global comprehensive tracker (will be set by app.py)
comprehensive_tracker_global = None

def set_comprehensive_tracker(tracker):
    """Set the global comprehensive tracker"""
    global comprehensive_tracker_global
    comprehensive_tracker_global = tracker

# ==================== OFFERWALL TRACKING ====================

class OfferwallTracker:
    """Comprehensive offerwall tracking service"""
    
    def __init__(self):
        self.sessions_col = db_instance.get_collection('offerwall_sessions')
        self.clicks_col = db_instance.get_collection('offerwall_clicks')
        self.conversions_col = db_instance.get_collection('offerwall_conversions')
        self.impressions_col = db_instance.get_collection('offerwall_impressions')
    
    def create_session(self, placement_id, user_id, publisher_id, device_info, geo_info, sub_id=None):
        """Create offerwall session"""
        session_id = str(uuid.uuid4())
        
        session_doc = {
            'session_id': session_id,
            'placement_id': placement_id,
            'user_id': user_id,
            'publisher_id': publisher_id,
            'sub_id': sub_id,
            'device_info': device_info,
            'geo_info': geo_info,
            'created_at': datetime.utcnow(),
            'last_activity_at': datetime.utcnow(),
            'status': 'active',
            'metrics': {
                'impressions': 0,
                'clicks': 0,
                'unique_clicks': 0,
                'time_spent_seconds': 0,
                'conversions': 0,
                'total_earned': 0
            },
            'fraud_flags': [],
            'ip_address': geo_info.get('ip'),
            'country': geo_info.get('country'),
            'device_type': device_info.get('device_type'),
            'browser': device_info.get('browser'),
            'os': device_info.get('os')
        }
        
        self.sessions_col.insert_one(session_doc)
        logger.info(f"✅ Created offerwall session: {session_id}")
        return session_id
    
    def get_session(self, session_id):
        """Get session details"""
        return self.sessions_col.find_one({'session_id': session_id})
    
    def record_impression(self, session_id, placement_id, publisher_id, user_id, impression_data):
        """Record offerwall impression"""
        impression_id = str(uuid.uuid4())
        session = self.get_session(session_id)
        
        impression_doc = {
            'impression_id': impression_id,
            'session_id': session_id,
            'placement_id': placement_id,
            'publisher_id': publisher_id,
            'user_id': user_id,
            'timestamp': datetime.utcnow(),
            'ip_address': session.get('ip_address') if session else None,
            'country': session.get('country') if session else None,
            'device_type': session.get('device_type') if session else None,
            'referrer': impression_data.get('referrer'),
            'user_agent': impression_data.get('user_agent')
        }
        
        self.impressions_col.insert_one(impression_doc)
        
        if session:
            self.sessions_col.update_one(
                {'session_id': session_id},
                {'$inc': {'metrics.impressions': 1}}
            )
        
        return impression_id
    
    def record_click(self, session_id, offer_id, placement_id, publisher_id, user_id, click_data):
        """Record offer click"""
        click_id = str(uuid.uuid4())
        session = self.get_session(session_id)
        
        is_duplicate = self._check_duplicate_click(session_id, offer_id)
        
        click_doc = {
            'click_id': click_id,
            'session_id': session_id,
            'offer_id': offer_id,
            'placement_id': placement_id,
            'publisher_id': publisher_id,
            'user_id': user_id,
            'timestamp': datetime.utcnow(),
            'ip_address': session.get('ip_address') if session else None,
            'country': session.get('country') if session else None,
            'device_type': session.get('device_type') if session else None,
            'is_duplicate': is_duplicate,
            'is_invalid': False,
            'fraud_score': 0
        }
        
        # Add click data if provided
        if click_data:
            click_doc.update({
                'offer_name': click_data.get('offer_name'),
                'offer_url': click_data.get('offer_url'),
                'user_agent': click_data.get('user_agent'),
                'referrer': click_data.get('referrer'),
                'browser': click_data.get('user_agent', '').split(' ')[0] if click_data.get('user_agent') else 'Unknown'
            })
        
        self.clicks_col.insert_one(click_doc)
        
        if session:
            self.sessions_col.update_one(
                {'session_id': session_id},
                {'$inc': {'metrics.clicks': 1}}
            )
        
        logger.info(f"✅ Recorded click: {click_id} for offer: {offer_id}")
        return click_id
    
    def _check_duplicate_click(self, session_id, offer_id, time_window_seconds=5):
        """Check for duplicate clicks"""
        cutoff_time = datetime.utcnow() - timedelta(seconds=time_window_seconds)
        
        existing = self.clicks_col.find_one({
            'session_id': session_id,
            'offer_id': offer_id,
            'timestamp': {'$gte': cutoff_time}
        })
        
        return existing is not None
    
    def record_conversion(self, click_id, session_id, offer_id, placement_id, publisher_id, user_id, payout_amount, conversion_data):
        """Record conversion"""
        conversion_id = str(uuid.uuid4())
        session = self.get_session(session_id)
        
        is_duplicate = self._check_duplicate_conversion(user_id, offer_id, placement_id)
        
        conversion_doc = {
            'conversion_id': conversion_id,
            'click_id': click_id,
            'session_id': session_id,
            'offer_id': offer_id,
            'placement_id': placement_id,
            'publisher_id': publisher_id,
            'user_id': user_id,
            'payout_amount': payout_amount,
            'timestamp': datetime.utcnow(),
            'status': 'pending',
            'postback_status': 'pending',
            'is_duplicate': is_duplicate,
            'transaction_id': conversion_data.get('transaction_id'),
            'fraud_score': 0,
            'fraud_flags': [],
            'ip_address': session.get('ip_address') if session else None,
            'country': session.get('country') if session else None,
            'device_type': session.get('device_type') if session else None
        }
        
        self.conversions_col.insert_one(conversion_doc)
        
        if session:
            self.sessions_col.update_one(
                {'session_id': session_id},
                {'$inc': {
                    'metrics.conversions': 1,
                    'metrics.total_earned': payout_amount
                }}
            )
        
        logger.info(f"✅ Recorded conversion: {conversion_id} for offer: {offer_id}, payout: {payout_amount}")
        return conversion_id
    
    def _check_duplicate_conversion(self, user_id, offer_id, placement_id, time_window_hours=24):
        """Check for duplicate conversions"""
        cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        
        existing = self.conversions_col.find_one({
            'user_id': user_id,
            'offer_id': offer_id,
            'placement_id': placement_id,
            'status': {'$in': ['credited', 'pending']},
            'timestamp': {'$gte': cutoff_time}
        })
        
        return existing is not None
    
    def get_publisher_stats(self, publisher_id, placement_id=None, start_date=None, end_date=None):
        """Get publisher analytics"""
        query = {'publisher_id': publisher_id}
        
        if placement_id:
            query['placement_id'] = placement_id
        
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query['$gte'] = start_date
            if end_date:
                date_query['$lte'] = end_date
            query['created_at'] = date_query
        
        sessions = list(self.sessions_col.find(query))
        total_sessions = len(sessions)
        total_impressions = sum(s['metrics']['impressions'] for s in sessions)
        total_clicks = sum(s['metrics']['clicks'] for s in sessions)
        total_earned = sum(s['metrics']['total_earned'] for s in sessions)
        
        conversion_query = {'publisher_id': publisher_id, 'status': 'credited'}
        if placement_id:
            conversion_query['placement_id'] = placement_id
        if start_date or end_date:
            conversion_query['timestamp'] = date_query
        
        conversions = list(self.conversions_col.find(conversion_query))
        total_conversions = len(conversions)
        
        conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
        ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
        epc = (total_earned / total_clicks) if total_clicks > 0 else 0
        
        return {
            'total_sessions': total_sessions,
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'total_conversions': total_conversions,
            'total_earnings': total_earned,
            'conversion_rate': round(conversion_rate, 2),
            'ctr': round(ctr, 2),
            'epc': round(epc, 4)
        }

# Create tracker instances
legacy_tracker = OfferwallTracker()  # For backward compatibility
enhanced_tracker = OfferwallTracking(db_instance)  # New enhanced tracking with points and analytics

# Simple HTML template for the offerwall iframe
OFFERWALL_HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offerwall - {{ placement.offerwallTitle }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .offers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .offer-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        
        .offer-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .offer-image {
            width: 100%;
            height: 180px;
            background-size: cover;
            background-position: center;
            border-radius: 8px;
            margin-bottom: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            color: white;
            position: relative;
        }
        
        .offer-image::before {
            content: attr(data-emoji);
            position: absolute;
        }
        
        .offer-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .offer-description {
            color: #6b7280;
            font-size: 0.9rem;
            line-height: 1.4;
            margin-bottom: 15px;
        }
        
        .offer-reward {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .reward-amount {
            font-size: 1.5rem;
            font-weight: 700;
            color: #059669;
        }
        
        .reward-currency {
            font-size: 0.9rem;
            color: #6b7280;
            text-transform: uppercase;
        }
        
        .offer-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
            color: #9ca3af;
            margin-bottom: 15px;
        }
        
        .offer-button {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        
        .offer-button:hover {
            opacity: 0.9;
        }
        
        .urgency-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ef4444;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
        }
        
        .category-badge {
            display: inline-block;
            background: #f3f4f6;
            color: #374151;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .loading {
            text-align: center;
            color: white;
            font-size: 1.2rem;
            margin: 50px 0;
        }
        
        .error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .offers-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ placement.offerwallTitle }}</h1>
            <p>Complete offers and earn {{ placement.currencyName }}!</p>
        </div>
        
        <div id="offers-container">
            <div class="loading">Loading offers...</div>
        </div>
    </div>

    <script>
        // Configuration
        const PLACEMENT_ID = '{{ placement.placementIdentifier }}';
        const USER_ID = '{{ user_id }}';
        const API_BASE = window.location.origin;
        
        console.log('Offerwall Config:', { PLACEMENT_ID, USER_ID, API_BASE });
        
        // Track impression on load
        fetch(`${API_BASE}/api/offerwall/track/impression`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                placement_id: PLACEMENT_ID,
                user_id: USER_ID,
                user_agent: navigator.userAgent,
                referrer: document.referrer
            })
        }).catch(err => console.warn('Failed to track impression:', err));
        
        // Load offers
        async function loadOffers() {
            try {
                const url = `${API_BASE}/api/offerwall/offers?placement_id=${PLACEMENT_ID}&user_id=${USER_ID}`;
                console.log('Loading offers from:', url);
                
                const response = await fetch(url);
                console.log('Response status:', response.status);
                
                const data = await response.json();
                console.log('Offers data:', data);
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (!data.offers || data.offers.length === 0) {
                    throw new Error('No offers returned from API');
                }
                
                console.log('Rendering', data.offers.length, 'offers');
                renderOffers(data.offers);
            } catch (error) {
                console.error('Error loading offers:', error);
                document.getElementById('offers-container').innerHTML = `
                    <div class="error">
                        <h3>Unable to load offers</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        
        function getEmojiForCategory(category) {
            const emojiMap = {
                'survey': '📋',
                'app': '📱',
                'game': '🎮',
                'video': '🎬',
                'general': '🎁',
                'install': '⬇️',
                'signup': '📝',
                'level': '⬆️'
            };
            return emojiMap[category?.toLowerCase()] || '⭐';
        }
        
        function renderOffers(offers) {
            if (!offers || offers.length === 0) {
                document.getElementById('offers-container').innerHTML = `
                    <div class="error">
                        <h3>No offers available</h3>
                        <p>Please check back later for new opportunities!</p>
                    </div>
                `;
                return;
            }
            
            const offersHtml = offers.map(offer => {
                const emoji = getEmojiForCategory(offer.category);
                const hasImage = offer.image_url && !offer.image_url.includes('placeholder');
                const imageStyle = hasImage ? `background-image: url('${offer.image_url}')` : '';
                
                return `
                    <div class="offer-card" onclick="handleOfferClick('${offer.id}', '${offer.title}', '${offer.click_url}')">
                        ${offer.urgency ? `<div class="urgency-badge">${offer.urgency.message}</div>` : ''}
                        <div class="offer-image" style="${imageStyle}" data-emoji="${emoji}">
                            ${!hasImage ? emoji : ''}
                        </div>
                        <div class="offer-title">${offer.title}</div>
                        <div class="offer-description">${offer.description}</div>
                        <div class="offer-reward">
                            <span class="reward-amount">${offer.reward_amount}</span>
                            <span class="reward-currency">${offer.reward_currency}</span>
                        </div>
                        <div class="offer-meta">
                            <span class="category-badge">${offer.category}</span>
                            <span>${offer.estimated_time}</span>
                        </div>
                        <button class="offer-button">Start Offer</button>
                    </div>
                `;
            }).join('');
            
            document.getElementById('offers-container').innerHTML = `
                <div class="offers-grid">
                    ${offersHtml}
                </div>
            `;
        }
        
        async function handleOfferClick(offerId, offerTitle, clickUrl) {
            try {
                // Track click
                await fetch(`${API_BASE}/api/offerwall/track/click`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        placement_id: PLACEMENT_ID,
                        user_id: USER_ID,
                        offer_id: offerId,
                        offer_name: offerTitle,
                        user_agent: navigator.userAgent
                    })
                });
                
                // Open offer in new tab/window
                window.open(clickUrl, '_blank');
                
            } catch (error) {
                console.error('Error tracking click:', error);
                // Still open the offer even if tracking fails
                window.open(clickUrl, '_blank');
            }
        }
        
        // Load offers when page loads
        document.addEventListener('DOMContentLoaded', loadOffers);
    </script>
</body>
</html>
'''

# ==================== PROFESSIONAL OFFERWALL HTML TEMPLATE ====================

PROFESSIONAL_OFFERWALL_HTML = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Earn Rewards - Offerwall</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a);
            min-height: 100vh;
            color: #e2e8f0;
        }
        
        .header {
            position: sticky;
            top: 0;
            z-index: 40;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(71, 85, 105, 0.5);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        
        .header-content {
            max-width: 100%;
            margin: 0 auto;
            padding: 1rem 1rem;
        }
        
        .header-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            gap: 1.5rem;
        }
        
        @media (max-width: 1024px) {
            .header-top {
                flex-direction: column;
                align-items: stretch;
            }
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .logo {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            border-radius: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            font-size: 1.75rem;
        }
        
        .logo-text h1 {
            font-size: 1.875rem;
            font-weight: 900;
            color: white;
        }
        
        .logo-text p {
            font-size: 0.75rem;
            color: #9ca3af;
            font-weight: 500;
            letter-spacing: 0.05em;
        }
        
        .earnings-box {
            text-align: center;
            background: linear-gradient(to right, rgba(5, 150, 105, 0.1), rgba(34, 197, 94, 0.1));
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(16, 185, 129, 0.3);
            backdrop-filter: blur(10px);
            flex: 1;
            min-width: 150px;
        }
        
        .earnings-label {
            font-size: 0.65rem;
            color: #9ca3af;
            font-weight: 700;
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
        }
        
        .earnings-amount {
            font-size: 1.5rem;
            font-weight: 900;
            color: #10b981;
        }
        
        .earnings-sub {
            font-size: 0.65rem;
            color: #6b7280;
            margin-top: 0.25rem;
        }
        
        .action-buttons {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        @media (max-width: 768px) {
            .earnings-box {
                padding: 0.5rem 1rem;
                min-width: 120px;
            }
            
            .earnings-amount {
                font-size: 1.25rem;
            }
        }
        
        .action-btn {
            padding: 0.75rem;
            background: rgba(71, 85, 105, 0.5);
            border: none;
            border-radius: 0.5rem;
            color: #9ca3af;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .action-btn:hover {
            background: rgba(71, 85, 105, 0.7);
            color: #3b82f6;
        }
        
        .search-bar {
            position: relative;
            width: 100%;
            margin-top: 0.5rem;
        }
        
        .search-bar input {
            width: 100%;
            padding-left: 2.5rem;
            padding-right: 1rem;
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(71, 85, 105, 0.3);
            border-radius: 0.5rem;
            color: white;
            transition: all 0.2s;
            font-size: 0.875rem;
        }
        
        .search-bar input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .search-bar input::placeholder {
            color: #6b7280;
        }
        
        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: #6b7280;
            pointer-events: none;
            width: 18px;
            height: 18px;
        }
        
        @media (max-width: 768px) {
            .search-bar input {
                font-size: 0.8rem;
                padding: 0.6rem 0.5rem 0.6rem 2rem;
            }
        }
        
        .filters {
            background: rgba(30, 41, 59, 0.5);
            border-bottom: 1px solid rgba(71, 85, 105, 0.5);
            position: sticky;
            top: 0;
            z-index: 30;
            backdrop-filter: blur(10px);
            overflow-x: auto;
        }
        
        .filters-content {
            max-width: 100%;
            margin: 0 auto;
            padding: 0.75rem 1rem;
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            scroll-behavior: smooth;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            padding: 0.5rem 0.75rem;
            background: rgba(71, 85, 105, 0.5);
            border: 1px solid rgba(71, 85, 105, 0.3);
            border-radius: 0.5rem;
            color: #d1d5db;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
        }
        
        .filter-btn:hover {
            background: rgba(71, 85, 105, 0.7);
        }
        
        .filter-btn.active {
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            color: white;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            width: 100%;
        }
        
        .offers-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-bottom: 3rem;
            width: 100%;
        }
        
        @media (max-width: 1200px) {
            .offers-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
            }
        }
        
        @media (max-width: 1024px) {
            .offers-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 0.75rem;
            }
        }
        
        @media (max-width: 768px) {
            .offers-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
        }
        
        @media (max-width: 600px) {
            .offers-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }
        }
        
        @media (max-width: 480px) {
            .offers-grid {
                grid-template-columns: 1fr;
                gap: 0.75rem;
            }
        }
        
        .offer-card {
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(71, 85, 105, 0.3);
            border-radius: 1rem;
            overflow: hidden;
            transition: all 0.3s;
            cursor: pointer;
            position: relative;
            display: flex;
            flex-direction: column;
            min-width: 0;
            max-width: 100%;
        }
        
        .offer-card:hover {
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.2);
            transform: translateY(-4px);
        }
        
        .offer-card.completed {
            opacity: 0.6;
            border-color: rgba(16, 185, 129, 0.5);
        }
        
        .offer-image {
            width: 100%;
            height: 160px;
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            position: relative;
            overflow: hidden;
        }
        
        .offer-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        @media (max-width: 768px) {
            .offer-image {
                height: 140px;
                font-size: 2.5rem;
            }
        }
        
        @media (max-width: 480px) {
            .offer-image {
                height: 120px;
                font-size: 2rem;
            }
        }
        
        .completed-badge {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: #10b981;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .category-badge {
            position: absolute;
            top: 0.5rem;
            left: 0.5rem;
            background: rgba(15, 23, 42, 0.8);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            backdrop-filter: blur(10px);
        }
        
        .offer-content {
            padding: 1rem;
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .offer-title {
            font-size: 1rem;
            font-weight: 700;
            color: #f1f5f9;
            margin-bottom: 0.5rem;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .offer-description {
            font-size: 0.8rem;
            color: #cbd5e1;
            margin-bottom: 0.75rem;
            line-height: 1.4;
            flex: 1;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .reward-box {
            background: linear-gradient(to right, #10b981, #34d399);
            padding: 0.75rem;
            border-radius: 0.75rem;
            margin-bottom: 0.75rem;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .reward-label {
            font-size: 0.65rem;
            font-weight: 700;
            opacity: 0.9;
            margin-bottom: 0.25rem;
        }
        
        .reward-amount {
            font-size: 1.5rem;
            font-weight: 900;
        }
        
        .reward-currency {
            font-size: 0.75rem;
            font-weight: 700;
            opacity: 0.9;
        }
        
        .offer-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.7rem;
            color: #94a3b8;
            margin-bottom: 0.75rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid rgba(71, 85, 105, 0.3);
        }
        
        @media (max-width: 768px) {
            .offer-content {
                padding: 0.75rem;
            }
            
            .offer-title {
                font-size: 0.9rem;
            }
            
            .offer-description {
                font-size: 0.75rem;
            }
            
            .reward-amount {
                font-size: 1.25rem;
            }
        }
        
        @media (max-width: 480px) {
            .offer-content {
                padding: 0.75rem;
            }
            
            .offer-title {
                font-size: 0.85rem;
                -webkit-line-clamp: 1;
            }
            
            .offer-description {
                font-size: 0.7rem;
                -webkit-line-clamp: 1;
            }
        }
        
        .offer-button {
            width: 100%;
            padding: 0.6rem 0.75rem;
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.9rem;
        }
        
        .offer-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
        }
        
        .offer-button:disabled {
            background: #6b7280;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        @media (max-width: 768px) {
            .offer-button {
                padding: 0.5rem 0.5rem;
                font-size: 0.8rem;
            }
        }
        
        @media (max-width: 480px) {
            .offer-button {
                padding: 0.5rem;
                font-size: 0.75rem;
            }
        }
        
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 50;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        }
        
        .modal.active {
            display: flex;
        }
        
        .modal-content {
            background: #1e293b;
            border: 1px solid rgba(71, 85, 105, 0.5);
            border-radius: 1rem;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: white;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .modal-stat {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .stat-box {
            padding: 1rem;
            background: rgba(71, 85, 105, 0.3);
            border-radius: 0.75rem;
            border: 1px solid rgba(71, 85, 105, 0.3);
        }
        
        .stat-label {
            font-size: 0.75rem;
            color: #9ca3af;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .stat-value {
            font-size: 1.875rem;
            font-weight: 900;
            color: #3b82f6;
        }
        
        .close-btn {
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            font-size: 1.5rem;
            padding: 0;
            margin-left: auto;
        }
        
        .close-btn:hover {
            color: white;
        }
        
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #9ca3af;
        }
        
        .spinner {
            border: 3px solid rgba(71, 85, 105, 0.3);
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-right: 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <!-- HEADER -->
    <div class="header">
        <div class="header-content">
            <div class="header-top">
                <div class="logo-section">
                    <div class="logo">⚡</div>
                    <div class="logo-text">
                        <h1>Earn Rewards</h1>
                        <p>Complete tasks and earn instantly</p>
                    </div>
                </div>
                
                <div class="earnings-box">
                    <div class="earnings-label">TODAY'S EARNINGS</div>
                    <div class="earnings-amount" id="todayEarnings">0</div>
                    <div class="earnings-sub">coins earned</div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn" id="refreshBtn" title="Refresh offers">🔄</button>
                    <button class="action-btn" id="settingsBtn" title="Device settings">⚙️</button>
                    <button class="action-btn" id="activityBtn" title="Activity & tracking">📊</button>
                </div>
            </div>
            
            <div class="search-bar">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <circle cx="8" cy="8" r="6"></circle>
                    <path d="M12 12l4 4"></path>
                </svg>
                <input type="text" id="searchInput" placeholder="Search offers by name or description...">
            </div>
        </div>
    </div>
    
    <!-- FILTERS -->
    <div class="filters">
        <div class="filters-content">
            <select id="sortSelect" class="filter-btn">
                <option value="payout_high">💰 Highest Payout</option>
                <option value="payout_low">💵 Lowest Payout</option>
                <option value="latest">🆕 Latest</option>
                <option value="trending">🔥 Trending</option>
            </select>
            
            <button class="filter-btn active" data-category="all">All Tasks</button>
            <button class="filter-btn" data-category="survey">📋 Survey</button>
            <button class="filter-btn" data-category="app">📱 App</button>
            <button class="filter-btn" data-category="game">🎮 Game</button>
            <button class="filter-btn" data-category="video">🎬 Video</button>
        </div>
    </div>
    
    <!-- MAIN CONTENT -->
    <div class="container">
        <div id="offersContainer" class="loading">
            <div class="spinner"></div>
            <span>Loading offers...</span>
        </div>
    </div>
    
    <!-- OFFER DETAILS MODAL -->
    <div class="modal" id="offerDetailsModal">
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-title">
                <span id="offerModalTitle">Offer Details</span>
                <button class="close-btn" onclick="closeModal('offerDetailsModal')">✕</button>
            </div>
            
            <!-- Offer Header -->
            <div id="offerHeader" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <div id="offerModalImage" style="width: 120px; height: 120px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 3rem; flex-shrink: 0; overflow: hidden;">
                        📋
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span id="offerModalCategory" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;">Survey</span>
                            <span id="offerModalStatus" style="background: rgba(71, 85, 105, 0.3); color: #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;"></span>
                        </div>
                        <h2 id="offerModalName" style="font-size: 1.5rem; font-weight: 900; color: white; margin: 0 0 0.5rem 0;">Offer Title</h2>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div>
                                <div style="font-size: 0.75rem; color: #9ca3af; font-weight: 700;">REWARD</div>
                                <div style="font-size: 1.875rem; font-weight: 900; color: #10b981;" id="offerModalReward">100</div>
                            </div>
                            <div style="border-left: 1px solid rgba(71, 85, 105, 0.3); padding-left: 1rem;">
                                <div style="font-size: 0.75rem; color: #9ca3af; font-weight: 700;">OFFER ID</div>
                                <div style="font-size: 0.875rem; color: #cbd5e1; font-family: monospace;" id="offerModalId">offer_123</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Short Summary -->
                <div style="background: rgba(71, 85, 105, 0.3); padding: 1rem; border-radius: 0.75rem; border-left: 3px solid #3b82f6;">
                    <div style="font-size: 0.75rem; color: #9ca3af; font-weight: 700; margin-bottom: 0.5rem;">QUICK SUMMARY</div>
                    <p id="offerModalSummary" style="color: #cbd5e1; margin: 0; line-height: 1.5;">Complete this offer to earn rewards.</p>
                </div>
            </div>
            
            <!-- Timeline / Steps -->
            <div id="offerStepsSection" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: white; margin: 0 0 1rem 0;">📋 Steps to Complete</h3>
                <div id="offerSteps" style="space-y: 0.75rem;"></div>
            </div>
            
            <!-- Full Description -->
            <div id="offerDescriptionSection" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: white; margin: 0 0 1rem 0;">📝 Full Description</h3>
                <p id="offerModalDescription" style="color: #cbd5e1; line-height: 1.6; margin: 0;">Detailed description of the offer goes here.</p>
            </div>
            
            <!-- Requirements -->
            <div id="offerRequirementsSection" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: white; margin: 0 0 1rem 0;">⚠️ Requirements & Restrictions</h3>
                <ul id="offerRequirements" style="color: #cbd5e1; margin: 0; padding-left: 1.5rem; line-height: 1.6;">
                    <li>Must be 18+ years old</li>
                    <li>Valid email required</li>
                    <li>One completion per user</li>
                </ul>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                <button class="offer-button" id="startOfferBtn" style="background: linear-gradient(135deg, #10b981, #34d399);" onclick="startOffer()">
                    🚀 Start Offer
                </button>
                <button class="offer-button" style="background: linear-gradient(135deg, #3b82f6, #06b6d4);" onclick="sendToDevice()">
                    📱 Send to Device
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                <button class="offer-button" style="background: linear-gradient(135deg, #8b5cf6, #a78bfa);" onclick="copyLink()">
                    🔗 Copy Link
                </button>
                <button class="offer-button" style="background: rgba(71, 85, 105, 0.5);" onclick="closeModal('offerDetailsModal')">
                    ✕ Close
                </button>
            </div>
            
            <!-- Tracking Tips -->
            <div style="background: rgba(71, 85, 105, 0.2); padding: 1rem; border-radius: 0.75rem; border-left: 3px solid #10b981;">
                <div style="font-size: 0.75rem; color: #9ca3af; font-weight: 700; margin-bottom: 0.5rem;">💡 TRACKING TIPS</div>
                <ul style="color: #cbd5e1; margin: 0; padding-left: 1.5rem; font-size: 0.875rem; line-height: 1.5;">
                    <li>Your completion will be tracked automatically</li>
                    <li>Rewards credited within 24-48 hours</li>
                    <li>Check Activity tab to see your progress</li>
                    <li>Complete offers on the same device</li>
                </ul>
            </div>
        </div>
    </div>
    
    <!-- DEVICE SETTINGS MODAL -->
    <div class="modal" id="deviceSettingsModal">
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-title">
                <span>⚙️ Device Settings</span>
                <button class="close-btn" onclick="closeModal('deviceSettingsModal')">✕</button>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: white; margin: 0 0 1rem 0;">📱 Device Type</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <button class="filter-btn active" id="deviceAndroid" onclick="setDevice('android')" style="padding: 1rem; text-align: center; cursor: pointer;">
                        🤖 Android
                    </button>
                    <button class="filter-btn" id="deviceIOS" onclick="setDevice('ios')" style="padding: 1rem; text-align: center; cursor: pointer;">
                        🍎 iOS
                    </button>
                </div>
                <button class="filter-btn" id="deviceDesktop" onclick="setDevice('desktop')" style="width: 100%; padding: 1rem; text-align: center; cursor: pointer; margin-top: 0.75rem;">
                    💻 Desktop
                </button>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: white; margin: 0 0 1rem 0;">🌍 Country</h3>
                <select id="countrySelect" style="width: 100%; padding: 0.75rem; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(71, 85, 105, 0.3); border-radius: 0.5rem; color: white; cursor: pointer;">
                    <option value="US">🇺🇸 United States</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="MX">🇲🇽 Mexico</option>
                </select>
            </div>
            
            <div style="background: rgba(71, 85, 105, 0.3); padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem;">
                <div style="font-size: 0.875rem; color: #cbd5e1; margin-bottom: 0.5rem;">
                    <strong>Current Settings:</strong>
                </div>
                <div style="font-size: 0.875rem; color: #9ca3af;">
                    Device: <span id="currentDevice" style="color: #3b82f6; font-weight: 700;">Android</span>
                </div>
                <div style="font-size: 0.875rem; color: #9ca3af;">
                    Country: <span id="currentCountry" style="color: #3b82f6; font-weight: 700;">US</span>
                </div>
            </div>
            
            <button class="offer-button" onclick="closeModal('deviceSettingsModal')" style="background: linear-gradient(135deg, #3b82f6, #06b6d4);">
                ✓ Save Settings
            </button>
        </div>
    </div>
    
    <!-- ACTIVITY MODAL -->
    <div class="modal" id="activityModal">
        <div class="modal-content">
            <div class="modal-title">
                <span>🏆 Your Activity</span>
                <button class="close-btn" onclick="closeModal('activityModal')">✕</button>
            </div>
            
            <div class="modal-stat">
                <div class="stat-box">
                    <div class="stat-label">TOTAL EARNED</div>
                    <div class="stat-value" id="totalEarned">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">TODAY</div>
                    <div class="stat-value" id="todayEarned">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">COMPLETED</div>
                    <div class="stat-value" id="completed">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">PENDING</div>
                    <div class="stat-value" id="pending">0</div>
                </div>
            </div>
            
            <div id="completedList"></div>
            
            <button class="offer-button" onclick="closeModal('activityModal')" style="margin-top: 1rem;">Close</button>
        </div>
    </div>

    <script>
        const PLACEMENT_ID = '{{ placement_id }}';
        const USER_ID = '{{ user_id }}';
        const SUB_ID = '{{ sub_id }}';
        const COUNTRY = '{{ country }}';
        const API_BASE = window.location.origin;
        
        let allOffers = [];
        let filteredOffers = [];
        let userStats = {};
        let selectedCategory = 'all';
        let sortBy = 'payout_high';
        let searchQuery = '';
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            loadOffers();
            loadUserStats();
            setupEventListeners();
            
            // Refresh stats every 5 seconds
            setInterval(loadUserStats, 5000);
        });
        
        function setupEventListeners() {
            document.getElementById('searchInput').addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                applyFilters();
            });
            
            document.getElementById('sortSelect').addEventListener('change', (e) => {
                sortBy = e.target.value;
                applyFilters();
            });
            
            document.querySelectorAll('[data-category]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    selectedCategory = e.target.dataset.category;
                    applyFilters();
                });
            });
            
            document.getElementById('refreshBtn').addEventListener('click', () => {
                loadOffers();
                loadUserStats();
            });
            
            document.getElementById('activityBtn').addEventListener('click', () => {
                openModal('activityModal');
            });
            
            document.getElementById('settingsBtn').addEventListener('click', () => {
                openModal('deviceSettingsModal');
            });
        }
        
        let currentDevice = 'android';
        let currentCountry = 'US';
        let currentOfferDetails = null;
        
        function setDevice(device) {
            currentDevice = device;
            document.querySelectorAll('[id^="device"]').forEach(btn => btn.classList.remove('active'));
            document.getElementById('device' + device.charAt(0).toUpperCase() + device.slice(1)).classList.add('active');
            document.getElementById('currentDevice').textContent = device.charAt(0).toUpperCase() + device.slice(1);
        }
        
        function showOfferDetails(offerId) {
            const offer = allOffers.find(o => o.id === offerId);
            if (!offer) return;
            
            currentOfferDetails = offer;
            
            // Set header info
            document.getElementById('offerModalTitle').textContent = offer.title;
            document.getElementById('offerModalName').textContent = offer.title;
            document.getElementById('offerModalReward').textContent = offer.reward_amount;
            document.getElementById('offerModalId').textContent = offer.id;
            document.getElementById('offerModalCategory').textContent = offer.category;
            document.getElementById('offerModalSummary').textContent = offer.description;
            document.getElementById('offerModalDescription').textContent = offer.description || 'Complete this offer to earn rewards.';
            
            // Set image
            const imageEl = document.getElementById('offerModalImage');
            if (offer.image_url && !offer.image_url.includes('placeholder')) {
                imageEl.innerHTML = `<img src="${offer.image_url}" alt="${offer.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                imageEl.innerHTML = getEmoji(offer.category);
            }
            
            // Set status
            const isCompleted = (userStats.completed_offers || []).includes(offerId);
            const statusEl = document.getElementById('offerModalStatus');
            if (isCompleted) {
                statusEl.textContent = '✓ Completed';
                statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
                statusEl.style.color = '#10b981';
                document.getElementById('startOfferBtn').textContent = '✓ Already Completed';
                document.getElementById('startOfferBtn').disabled = true;
            } else {
                statusEl.textContent = 'Available';
                statusEl.style.background = 'rgba(71, 85, 105, 0.3)';
                statusEl.style.color = '#cbd5e1';
                document.getElementById('startOfferBtn').textContent = '🚀 Start Offer';
                document.getElementById('startOfferBtn').disabled = false;
            }
            
            // Set steps
            const stepsEl = document.getElementById('offerSteps');
            const steps = offer.steps || [
                { title: 'Click Start Offer', reward: 0 },
                { title: 'Complete the task', reward: Math.floor(offer.reward_amount * 0.7) },
                { title: 'Earn your reward', reward: Math.ceil(offer.reward_amount * 0.3) }
            ];
            
            stepsEl.innerHTML = steps.map((step, idx) => `
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: rgba(71, 85, 105, 0.2); border-radius: 0.75rem; border-left: 3px solid #3b82f6;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0;">
                        ${idx + 1}
                    </div>
                    <div style="flex: 1;">
                        <div style="color: white; font-weight: 600; margin-bottom: 0.25rem;">${step.title}</div>
                        ${step.reward > 0 ? `<div style="color: #10b981; font-size: 0.875rem; font-weight: 700;">+${step.reward} coins</div>` : ''}
                    </div>
                </div>
            `).join('');
            
            // Set requirements
            const reqEl = document.getElementById('offerRequirements');
            const requirements = offer.requirements || [
                'Must be 18+ years old',
                'Valid email required',
                'One completion per user',
                'Complete on the same device'
            ];
            
            reqEl.innerHTML = requirements.map(req => `<li>${req}</li>`).join('');
            
            openModal('offerDetailsModal');
        }
        
        function startOffer() {
            if (!currentOfferDetails) return;
            
            const offer = currentOfferDetails;
            
            // Track click
            fetch(`${API_BASE}/api/offerwall/track/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    placement_id: PLACEMENT_ID,
                    user_id: USER_ID,
                    offer_id: offer.id,
                    offer_name: offer.title,
                    user_agent: navigator.userAgent
                })
            }).catch(err => console.warn('Click tracking failed:', err));
            
            // Open offer
            window.open(offer.click_url, '_blank');
            closeModal('offerDetailsModal');
        }
        
        function sendToDevice() {
            if (!currentOfferDetails) return;
            alert(`📱 Offer link will be sent to your ${currentDevice} device!\\n\\nFeature coming soon.`);
        }
        
        function copyLink() {
            if (!currentOfferDetails) return;
            const link = currentOfferDetails.click_url;
            navigator.clipboard.writeText(link).then(() => {
                alert('✓ Link copied to clipboard!');
            }).catch(() => {
                alert('Failed to copy link');
            });
        }
        
        async function loadOffers() {
            try {
                const url = `${API_BASE}/api/offerwall/offers?placement_id=${PLACEMENT_ID}&user_id=${USER_ID}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.offers && data.offers.length > 0) {
                    allOffers = data.offers;
                    applyFilters();
                } else {
                    document.getElementById('offersContainer').innerHTML = '<p style="text-align: center; color: #9ca3af;">No offers available</p>';
                }
            } catch (error) {
                console.error('Error loading offers:', error);
                document.getElementById('offersContainer').innerHTML = '<p style="text-align: center; color: #ef4444;">Error loading offers</p>';
            }
        }
        
        async function loadUserStats() {
            try {
                const url = `${API_BASE}/api/offerwall/user/stats?user_id=${USER_ID}&placement_id=${PLACEMENT_ID}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.stats) {
                    userStats = data.stats;
                    document.getElementById('todayEarnings').textContent = userStats.today_earned || 0;
                    document.getElementById('totalEarned').textContent = userStats.total_earned || 0;
                    document.getElementById('todayEarned').textContent = userStats.today_earned || 0;
                    document.getElementById('completed').textContent = userStats.offers_completed || 0;
                    document.getElementById('pending').textContent = userStats.offers_pending || 0;
                    
                    // Update completed list
                    updateCompletedList();
                }
            } catch (error) {
                console.warn('Error loading stats:', error);
            }
        }
        
        function updateCompletedList() {
            const completedOffers = userStats.completed_offers || [];
            if (completedOffers.length === 0) {
                document.getElementById('completedList').innerHTML = '';
                return;
            }
            
            let html = '<div style="margin-top: 1rem;"><h3 style="color: #cbd5e1; font-size: 0.875rem; font-weight: 700; margin-bottom: 0.75rem;">✅ Recently Completed</h3>';
            
            completedOffers.slice(0, 5).forEach(offerId => {
                const offer = allOffers.find(o => o.id === offerId);
                if (offer) {
                    html += `
                        <div style="padding: 0.75rem; background: rgba(71, 85, 105, 0.3); border-radius: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid #10b981;">
                            <div style="color: #cbd5e1; font-weight: 600; font-size: 0.875rem;">${offer.title}</div>
                            <div style="color: #9ca3af; font-size: 0.75rem;">+${offer.reward_amount} coins</div>
                        </div>
                    `;
                }
            });
            
            html += '</div>';
            document.getElementById('completedList').innerHTML = html;
        }
        
        function applyFilters() {
            let filtered = allOffers;
            
            if (searchQuery) {
                filtered = filtered.filter(o => 
                    o.title.toLowerCase().includes(searchQuery) || 
                    o.description.toLowerCase().includes(searchQuery)
                );
            }
            
            if (selectedCategory !== 'all') {
                filtered = filtered.filter(o => o.category === selectedCategory);
            }
            
            filtered.sort((a, b) => {
                if (sortBy === 'payout_high') return b.reward_amount - a.reward_amount;
                if (sortBy === 'payout_low') return a.reward_amount - b.reward_amount;
                return 0;
            });
            
            filteredOffers = filtered;
            renderOffers();
        }
        
        function renderOffers() {
            if (filteredOffers.length === 0) {
                document.getElementById('offersContainer').innerHTML = '<p style="text-align: center; color: #9ca3af;">No offers found</p>';
                return;
            }
            
            const completedIds = userStats.completed_offers || [];
            const html = filteredOffers.map(offer => {
                const isCompleted = completedIds.includes(offer.id);
                const emoji = getEmoji(offer.category);
                
                return `
                    <div class="offer-card ${isCompleted ? 'completed' : ''}" onclick="showOfferDetails('${offer.id}')">
                        <div class="offer-image">
                            ${offer.image_url && !offer.image_url.includes('placeholder') ? `<img src="${offer.image_url}" alt="${offer.title}">` : emoji}
                            ${isCompleted ? '<div class="completed-badge">✓ Completed</div>' : ''}
                            <div class="category-badge">${offer.category}</div>
                        </div>
                        <div class="offer-content">
                            <div class="offer-title">${offer.title}</div>
                            <div class="offer-description">${offer.description}</div>
                            <div class="reward-box">
                                <div>
                                    <div class="reward-label">EARN</div>
                                    <div class="reward-amount">${offer.reward_amount}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="reward-currency">${offer.reward_currency}</div>
                                </div>
                            </div>
                            <div class="offer-meta">
                                <span>${offer.category}</span>
                                <span>⏱️ ${offer.estimated_time}</span>
                            </div>
                            <button class="offer-button" ${isCompleted ? 'disabled' : ''} onclick="event.stopPropagation(); handleOfferClick('${offer.id}', '${offer.title}', '${offer.click_url}')">
                                ${isCompleted ? '✓ Completed' : 'Start Now'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('offersContainer').innerHTML = `<div class="offers-grid">${html}</div>`;
        }
        
        function getEmoji(category) {
            const map = {
                'survey': '📋',
                'app': '📱',
                'game': '🎮',
                'video': '🎬',
                'general': '🎁',
                'install': '⬇️',
                'signup': '📝',
                'level': '⬆️'
            };
            return map[category?.toLowerCase()] || '⭐';
        }
        
        async function handleOfferClick(offerId, offerTitle, clickUrl) {
            try {
                // Track click
                await fetch(`${API_BASE}/api/offerwall/track/click`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        placement_id: PLACEMENT_ID,
                        user_id: USER_ID,
                        offer_id: offerId,
                        offer_name: offerTitle,
                        user_agent: navigator.userAgent
                    })
                });
                
                window.open(clickUrl, '_blank');
            } catch (error) {
                console.error('Error:', error);
                window.open(clickUrl, '_blank');
            }
        }
        
        function openModal(modalId) {
            document.getElementById(modalId).classList.add('active');
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }
    </script>
</body>
</html>
'''


@offerwall_bp.route('/offerwall')
def serve_offerwall():
    """Redirect to frontend offerwall with validation"""
    from flask import redirect, url_for
    try:
        # Get query parameters
        placement_id = request.args.get('placement_id')
        user_id = request.args.get('user_id')
        api_key = request.args.get('api_key')
        sub_id = request.args.get('sub_id', '')
        country = request.args.get('country', '')
        
        # Validate required parameters
        if not all([placement_id, user_id, api_key]):
            return jsonify({
                'error': 'Missing required parameters: placement_id, user_id, api_key'
            }), 400
        
        # Validate placement and API key
        placement_model = Placement()
        placement, error = placement_model.validate_placement_access(placement_id, api_key)
        
        if error:
            return jsonify({'error': error}), 403
        
        # Build redirect URL to frontend based on environment
        # Determine the correct frontend URL
        if 'localhost' in request.host or '127.0.0.1' in request.host:
            # Local development
            frontend_url = 'http://localhost:8080'
        elif 'onrender.com' in request.host:
            # Backend is on Render, frontend is on Vercel
            frontend_url = 'https://moustache-leads.vercel.app'
        elif 'theinterwebsite.space' in request.host:
            # Both on theinterwebsite.space
            frontend_url = 'https://theinterwebsite.space'
        else:
            # Default fallback
            frontend_url = 'https://moustache-leads.vercel.app'
        
        # Build query string
        query_params = f'placement_id={placement_id}&user_id={user_id}'
        if sub_id:
            query_params += f'&sub_id={sub_id}'
        if country:
            query_params += f'&country={country}'
        
        # Redirect to frontend offerwall
        redirect_url = f'{frontend_url}/offerwall?{query_params}'
        print(f'✅ Redirecting to frontend offerwall: {redirect_url}')
        return redirect(redirect_url, code=302)
        
    except Exception as e:
        logger.error(f"Error serving offerwall: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/offers', methods=['GET'])
def get_offers():
    """Get offers for the offerwall (JSON API) - fetches from admin's offer database"""
    try:
        from models.offer import Offer
        from database import db_instance
        
        # Get query parameters (placement_id and user_id are optional for publisher view)
        placement_id = request.args.get('placement_id')
        user_id = request.args.get('user_id')
        category = request.args.get('category')
        status = request.args.get('status', 'active')
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"📥 Fetching offers - placement_id: {placement_id}, user_id: {user_id}, status: {status}")
        
        # Build query filter
        query_filter = {
            'is_active': True  # Only show active offers (not deleted)
        }
        
        # Filter by status (default to active offers only)
        if status and status != 'all':
            query_filter['status'] = status.lower()  # Force lowercase for consistency
        
        # Filter by category if provided
        if category:
            query_filter['category'] = category
        
        # Get offers from database
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("❌ Database connection not available")
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Fetch offers from database
        offers_cursor = offers_collection.find(query_filter).limit(limit)
        offers_list = list(offers_cursor)
        
        logger.info(f"✅ Found {len(offers_list)} offers in database")
        
        # Transform offers to frontend format
        transformed_offers = []
        for offer in offers_list:
            # Get image URL from multiple possible fields
            image_url = (
                offer.get('image_url') or 
                offer.get('creative_url') or 
                offer.get('preview_url') or 
                offer.get('thumbnail_url') or
                ''
            )
            
            # Only use placeholder if no real image URL
            if not image_url or image_url.strip() == '':
                image_url = ''
            
            # 🔥 TRACKING URL GENERATION: Use proper tracking URLs
            tracking_url = None
            
            # 1. First check if masked_url is valid (contains our domain)
            if offer.get('masked_url'):
                masked_url = offer.get('masked_url')
                # Check if it's a valid tracking URL (contains our domain)
                if 'moustacheleads-backend.onrender.com' in masked_url or 'localhost:5000' in masked_url:
                    tracking_url = masked_url
                    logger.info(f"✅ Using valid masked_url: {tracking_url}")
                else:
                    logger.warning(f"⚠️ Invalid masked_url detected: {masked_url}, will generate new tracking URL")
            
            # 2. Generate proper tracking URL if no valid masked_url
            if not tracking_url and offer.get('target_url'):
                try:
                    # Determine the correct base URL based on the request
                    if 'localhost' in request.host or '127.0.0.1' in request.host:
                        base_url = "http://localhost:5000"  # Local development URL
                    else:
                        # Use the same protocol and host as the request, but ensure we're pointing to backend
                        protocol = request.scheme
                        host = request.host.split(':')[0]  # Remove port if present
                        
                        # Map frontend domains to backend domains
                        if 'theinterwebsite.space' in host:
                            base_url = "https://api.theinterwebsite.space"
                        elif 'vercel.app' in host or 'moustache-leads' in host:
                            base_url = "https://moustacheleads-backend.onrender.com"
                        elif 'onrender.com' in host:
                            # Request from Render itself - no port needed
                            base_url = f"{protocol}://{host}"
                        else:
                            # Development or unknown - add port 5000
                            base_url = f"{protocol}://{host}:5000"
                    
                    # Create tracking URL in the format: /track/{offer_id}?user_id={user_id}&sub1={placement_id}
                    tracking_url = f"{base_url}/track/{offer.get('offer_id')}?user_id={user_id}&sub1={placement_id}"
                    
                    logger.info(f"✅ Generated tracking URL: {tracking_url}")
                        
                except Exception as e:
                    logger.error(f"❌ Error generating tracking URL: {e}")
                    tracking_url = offer.get('target_url', '#')
            
            # 3. Final fallback
            if not tracking_url:
                tracking_url = offer.get('target_url') or offer.get('url') or '#'
                logger.warning(f"⚠️ Using fallback URL: {tracking_url}")
            
            transformed_offer = {
                'id': offer.get('offer_id', str(offer.get('_id'))),
                'title': offer.get('name', 'Untitled Offer'),
                'description': offer.get('description', 'No description available'),
                'reward_amount': offer.get('payout', 0),
                'reward_currency': offer.get('currency', 'USD'),
                'category': offer.get('category', 'general'),
                'status': offer.get('status', 'active'),
                'image_url': image_url,
                'click_url': tracking_url,
                'network': offer.get('network', 'Unknown'),
                'countries': offer.get('countries', []),
                'devices': offer.get('devices', []),
                'estimated_time': '5-10 minutes',  # Default value
                'created_at': offer.get('created_at', datetime.utcnow()).isoformat() if isinstance(offer.get('created_at'), datetime) else str(offer.get('created_at', '')),
                # 🔥 ADDITIONAL OFFER INFO FOR BETTER TRACKING
                'campaign_id': offer.get('campaign_id'),
                'offer_type': offer.get('offer_type', 'standard'),
                'conversion_flow': offer.get('conversion_flow', 'single_opt_in'),
                'payout_type': offer.get('payout_type', 'cpa'),
            }
            transformed_offers.append(transformed_offer)
            
            logger.info(f"✅ Offer: {transformed_offer['title']}, Tracking URL: {tracking_url}")
        
        response_data = {
            'offers': transformed_offers,
            'total_count': len(transformed_offers),
            'placement_id': placement_id,
            'user_id': user_id,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        logger.info(f"✅ Returning {len(transformed_offers)} offers to frontend")
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting offers: {e}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


# ⚠️ DEPRECATED: Old impression tracking endpoint removed - using track_offerwall_impression instead


# ==================== NEW OFFERWALL TRACKING ENDPOINTS ====================

@offerwall_bp.route('/api/offerwall/session/create', methods=['POST'])
def create_offerwall_session():
    """Create a new offerwall session"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['placement_id', 'user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get publisher ID from placement
        try:
            placements_col = db_instance.get_collection('placements')
            
            # Try multiple strategies to find placement (handles both ObjectId and string IDs)
            placement = None
            try:
                placement = placements_col.find_one({'_id': ObjectId(data['placement_id'])})
            except:
                # Try as string
                placement = placements_col.find_one({
                    '$or': [
                        {'_id': data['placement_id']},
                        {'placementId': data['placement_id']},
                        {'placement_id': data['placement_id']}
                    ]
                })
            
            if not placement:
                logger.warning(f"Placement not found: {data['placement_id']}")
                publisher_id = 'unknown'
            else:
                publisher_id = placement.get('publisherId', 'unknown')
                if isinstance(publisher_id, ObjectId):
                    publisher_id = str(publisher_id)
        except Exception as e:
            logger.error(f"Error fetching placement: {e}")
            publisher_id = 'unknown'
        
        # Create session using enhanced tracker
        session_id, error = enhanced_tracker.create_session(
            placement_id=data['placement_id'],
            user_id=data['user_id'],
            publisher_id=publisher_id,
            device_info=data.get('device_info', {}),
            geo_info=data.get('geo_info', {}),
            sub_id=data.get('sub_id')
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'placement_id': data['placement_id']
        }), 200
        
    except Exception as e:
        logger.error(f"Error creating offerwall session: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/track/impression', methods=['POST'])
def track_offerwall_impression():
    """Track offerwall impression"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['session_id', 'placement_id', 'user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get publisher from placement
        try:
            placement_model = Placement()
            placement = placement_model.get_placement_by_id_only(data['placement_id'])
            
            if placement:
                publisher_id = placement.get('publisherId', 'unknown')
                if isinstance(publisher_id, ObjectId):
                    publisher_id = str(publisher_id)
                logger.info(f"✅ Found placement, publisher_id: {publisher_id}")
            else:
                logger.warning(f"⚠️ Placement not found: {data['placement_id']}")
                publisher_id = 'unknown'
        except Exception as e:
            logger.error(f"❌ Error fetching placement: {e}")
            publisher_id = 'unknown'
        
        # Record impression using enhanced tracker
        impression_id, error = enhanced_tracker.record_impression(
            session_id=data['session_id'],
            placement_id=data['placement_id'],
            publisher_id=publisher_id,
            user_id=data['user_id'],
            impression_data={
                'referrer': data.get('referrer'),
                'user_agent': data.get('user_agent')
            }
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        # ALSO track in comprehensive tracking system
        try:
            from models.comprehensive_tracking import ComprehensiveOfferwallTracker
            from routes.comprehensive_analytics import comprehensive_tracker as comp_tracker
            
            if comp_tracker:
                comprehensive_impression_data = {
                    'session_id': data['session_id'],
                    'user_id': data['user_id'],
                    'placement_id': data['placement_id'],
                    'publisher_id': publisher_id,
                    
                    # Offer Details
                    'offer_id': data.get('offer_id', 'unknown'),
                    'offer_name': data.get('offer_name', 'Unknown Offer'),
                    'offer_category': data.get('offer_category', 'unknown'),
                    'offer_payout': data.get('offer_payout', 0),
                    'offer_network': data.get('offer_network', 'unknown'),
                    'advertiser_id': data.get('advertiser_id', 'unknown'),
                    
                    # Device/Geo
                    'device_type': data.get('device_type', 'desktop'),
                    'country': data.get('country', 'Unknown'),
                    'ip_address': request.remote_addr,
                    
                    # Impression Context
                    'position': data.get('position', 0),
                    'view_duration': data.get('view_duration', 0),
                    'visible': data.get('visible', True),
                    'viewable': data.get('viewable', True),
                }
                
                comp_impression_id, comp_error = comp_tracker.track_impression(comprehensive_impression_data)
                if comp_error:
                    logger.warning(f"⚠️ Comprehensive tracking impression failed: {comp_error}")
                else:
                    logger.info(f"✅ Comprehensive impression tracked: {comp_impression_id}")
        except Exception as e:
            logger.warning(f"⚠️ Error in comprehensive tracking: {e}")
        
        return jsonify({
            'success': True,
            'impression_id': impression_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error tracking impression: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/track/click', methods=['POST'])
def track_offerwall_click():
    """Track offer click"""
    print("🚀 CLICK TRACKING ENDPOINT CALLED")
    logger.info("🚀 CLICK TRACKING ENDPOINT CALLED")
    
    try:
        data = request.get_json()
        logger.info(f"🔍 Received click data: {data}")
        
        if not data:
            logger.error("❌ No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['session_id', 'offer_id', 'placement_id', 'user_id']
        logger.info(f"🔍 Checking required fields: {required_fields}")
        
        for field in required_fields:
            if field not in data:
                logger.error(f"❌ Missing required field: {field}")
                return jsonify({'error': f'{field} is required'}), 400
        
        logger.info("✅ All required fields present")
        
        # Get publisher from placement
        logger.info(f"🔍 Fetching placement for ID: {data['placement_id']}")
        try:
            placements_col = db_instance.get_collection('placements')
            # Try multiple search strategies
            placement = None
            
            # Strategy 1: Try as ObjectId
            try:
                from bson import ObjectId
                placement = placements_col.find_one({'_id': ObjectId(data['placement_id'])})
                if placement:
                    logger.info(f"✅ Found placement by ObjectId _id")
            except:
                pass
            
            # Strategy 2: Try by placement_id field as string
            if not placement:
                placement = placements_col.find_one({'placement_id': data['placement_id']})
                if placement:
                    logger.info(f"✅ Found placement by placement_id field")
            
            # Strategy 3: Try by _id as string
            if not placement:
                placement = placements_col.find_one({'_id': data['placement_id']})
                if placement:
                    logger.info(f"✅ Found placement by _id as string")
            
            # Strategy 4: Try by placementId field (camelCase)
            if not placement:
                placement = placements_col.find_one({'placementId': data['placement_id']})
                if placement:
                    logger.info(f"✅ Found placement by placementId field")
            
            # Strategy 5: Try by placementIdentifier field
            if not placement:
                placement = placements_col.find_one({'placementIdentifier': data['placement_id']})
                if placement:
                    logger.info(f"✅ Found placement by placementIdentifier field")
            
            if not placement:
                logger.warning(f"⚠️ Placement not found with ID: {data['placement_id']}")
                logger.warning(f"⚠️ Tried: _id (ObjectId), placement_id, _id (string), placementId, placementIdentifier")
                # List available placements for debugging
                sample_placements = list(placements_col.find().limit(3))
                logger.warning(f"⚠️ Sample placements in DB:")
                for sp in sample_placements:
                    logger.warning(f"   - _id: {sp.get('_id')}, placement_id: {sp.get('placement_id')}, placementId: {sp.get('placementId')}, placementIdentifier: {sp.get('placementIdentifier')}")
            
            logger.info(f"🔍 Placement found: {placement is not None}")
            
            publisher_id = placement.get('publisherId', 'unknown') if placement else 'unknown'
            if isinstance(publisher_id, ObjectId):
                publisher_id = str(publisher_id)
            logger.info(f"🔍 Publisher ID: {publisher_id}")
        except Exception as e:
            logger.error(f"❌ Error fetching placement: {e}")
            import traceback
            logger.error(traceback.format_exc())
            publisher_id = 'unknown'

        
        # Record click using enhanced tracker with fraud detection
        click_id, error = enhanced_tracker.record_click(
            session_id=data['session_id'],
            offer_id=data['offer_id'],
            placement_id=data['placement_id'],
            publisher_id=publisher_id,
            user_id=data['user_id'],
            click_data={
                'offer_name': data.get('offer_name', 'Unknown Offer'),
                'user_agent': data.get('user_agent'),
                'referrer': data.get('referrer'),
                'offer_url': data.get('offer_url')
            }
        )
        
        if error:
            logger.error(f"❌ Error tracking click: {error}")
            return jsonify({'error': error}), 500
        
        logger.info(f"✅ Click tracked: {click_id} for offer: {data['offer_id']} - Offer name: {data.get('offer_name')}")
        
        # ALSO track in comprehensive tracking system
        logger.info("=" * 80)
        logger.info("🚀 STARTING COMPREHENSIVE TRACKING...")
        logger.info("=" * 80)
        logger.info(f"🔍 comprehensive_tracker_global is: {comprehensive_tracker_global}")
        try:
            logger.info("📦 Step 1: Importing modules...")
            from models.comprehensive_tracking import ComprehensiveOfferwallTracker
            from models.geolocation import GeolocationService, FraudDetectionService
            
            logger.info("✅ Step 1 Complete: Modules imported successfully")
            
            # Get geolocation and IP info
            logger.info("📦 Step 2: Getting geolocation data...")
            geo_service = GeolocationService()
            ip_address = request.remote_addr
            logger.info(f"   IP Address: {ip_address}")
            
            geo_info = geo_service.get_ip_info(ip_address)
            logger.info(f"✅ Step 2 Complete: Got geo info - Country: {geo_info.get('country')}, City: {geo_info.get('city')}")
            
            # For local testing, provide default values if geolocation is unknown
            if ip_address in ['127.0.0.1', 'localhost', '::1']:
                logger.info("🔧 Local IP detected, using mock geolocation data for testing")
                geo_info = {
                    'country': 'United States',
                    'country_code': 'US',
                    'region': 'California',
                    'city': 'San Francisco',
                    'postal_code': '94102',
                    'latitude': 37.7749,
                    'longitude': -122.4194,
                    'isp': 'Local ISP',
                    'organization': 'Local Organization',
                    'asn': 'AS12345',
                    'asn_name': 'LOCAL',
                    'vpn_detected': False,
                    'proxy_detected': False,
                    'tor_detected': False,
                    'hosting_detected': False
                }
            
            # Get publisher name
            logger.info("📦 Step 3: Getting publisher name...")
            publisher_name = 'Unknown'
            try:
                placements_col = db_instance.get_collection('placements')
                # Try multiple search strategies
                placement = None
                
                # Strategy 1: Try as ObjectId
                try:
                    from bson import ObjectId
                    placement = placements_col.find_one({'_id': ObjectId(data['placement_id'])})
                    if placement:
                        logger.info(f"   Found placement by ObjectId _id")
                except:
                    pass
                
                # Strategy 2: Try by placement_id field as string
                if not placement:
                    placement = placements_col.find_one({'placement_id': data['placement_id']})
                    if placement:
                        logger.info(f"   Found placement by placement_id field")
                
                # Strategy 3: Try by _id as string
                if not placement:
                    placement = placements_col.find_one({'_id': data['placement_id']})
                    if placement:
                        logger.info(f"   Found placement by _id as string")
                
                # Strategy 4: Try by placementId field (camelCase)
                if not placement:
                    placement = placements_col.find_one({'placementId': data['placement_id']})
                    if placement:
                        logger.info(f"   Found placement by placementId field")
                
                if placement and placement.get('publisherId'):
                    logger.info(f"   Found placement, publisher ID: {placement.get('publisherId')}")
                    publishers_col = db_instance.get_collection('publishers')
                    publisher = publishers_col.find_one({'_id': ObjectId(placement['publisherId'])})
                    if publisher:
                        publisher_name = publisher.get('name', 'Unknown')
                        logger.info(f"✅ Step 3 Complete: Got publisher name: {publisher_name}")
                    else:
                        logger.warning(f"⚠️ Step 3: Publisher not found for ID: {placement.get('publisherId')}")
                else:
                    logger.warning(f"⚠️ Step 3: Placement not found or has no publisherId")
                    if not placement:
                        logger.warning(f"   Placement ID searched: {data['placement_id']}")

            except Exception as e:
                logger.error(f"❌ Step 3 Error: Failed to get publisher name: {e}")
            
            # Detect fraud
            logger.info("📦 Step 4: Running fraud detection...")
            fraud_service = FraudDetectionService(db_instance)
            # Ensure user_agent is never None - provide empty string as default
            user_agent_value = data.get('user_agent') or ''
            fraud_data = fraud_service.detect_fraud({
                'user_id': data['user_id'],
                'offer_id': data['offer_id'],
                'placement_id': data['placement_id'],
                'time_to_click': data.get('time_to_click', 0),
                'user_agent': user_agent_value,
                'vpn_detected': geo_info.get('vpn_detected', False),
                'proxy_detected': geo_info.get('proxy_detected', False),
                'tor_detected': geo_info.get('tor_detected', False),
                'hosting_detected': geo_info.get('hosting_detected', False),
            })
            logger.info(f"✅ Step 4 Complete: Fraud status: {fraud_data['fraud_status']}, Score: {fraud_data['fraud_score']}")
            
            # Use global tracker if available, otherwise create new one
            logger.info("📦 Step 5: Getting comprehensive tracker instance...")
            # Try to get from comprehensive_analytics module first
            try:
                from routes import comprehensive_analytics
                if hasattr(comprehensive_analytics, 'comprehensive_tracker') and comprehensive_analytics.comprehensive_tracker is not None:
                    direct_tracker = comprehensive_analytics.comprehensive_tracker
                    logger.info("✅ Step 5 Complete: Using tracker from comprehensive_analytics module")
                elif comprehensive_tracker_global is not None:
                    direct_tracker = comprehensive_tracker_global
                    logger.info("✅ Step 5 Complete: Using global comprehensive tracker")
                else:
                    logger.info("⚠️ No global tracker available, creating new instance")
                    direct_tracker = ComprehensiveOfferwallTracker(db_instance)
                    logger.info("✅ Step 5 Complete: Created new tracker instance")
            except Exception as e:
                logger.warning(f"⚠️ Error getting tracker from module: {e}, creating new instance")
                direct_tracker = ComprehensiveOfferwallTracker(db_instance)
                logger.info("✅ Step 5 Complete: Created new tracker instance")
            
            # Extract device info from user_agent if not provided
            logger.info("📦 Step 6: Extracting device information...")
            user_agent = data.get('user_agent', '')
            device_type = data.get('device_type', 'desktop')
            browser = data.get('browser', 'Unknown')
            os = data.get('os', 'Unknown')
            
            # If device info not provided, try to detect from user_agent
            if browser == 'Unknown' and user_agent:
                if 'Chrome' in user_agent:
                    browser = 'Chrome'
                elif 'Firefox' in user_agent:
                    browser = 'Firefox'
                elif 'Safari' in user_agent:
                    browser = 'Safari'
                elif 'Edge' in user_agent:
                    browser = 'Edge'
            
            if os == 'Unknown' and user_agent:
                if 'Windows' in user_agent:
                    os = 'Windows'
                elif 'Mac' in user_agent:
                    os = 'macOS'
                elif 'Linux' in user_agent:
                    os = 'Linux'
                elif 'Android' in user_agent:
                    os = 'Android'
                elif 'iPhone' in user_agent or 'iPad' in user_agent:
                    os = 'iOS'
            
            logger.info(f"✅ Step 6 Complete: Device: {device_type}, OS: {os}, Browser: {browser}")
            
            logger.info("📦 Step 7: Building comprehensive click data...")
            comprehensive_click_data = {
                'session_id': data['session_id'],
                'user_id': data['user_id'],
                'offer_id': data['offer_id'],
                'offer_name': data.get('offer_name', 'Unknown Offer'),
                'placement_id': data['placement_id'],
                'publisher_id': publisher_id,
                'publisher_name': publisher_name,
                
                # Device/Geo
                'device_type': device_type,
                'browser': browser,
                'os': os,
                'country': geo_info.get('country', 'Unknown'),
                'region': geo_info.get('region', 'Unknown'),
                'city': geo_info.get('city', 'Unknown'),
                'postal_code': geo_info.get('postal_code', 'Unknown'),
                'latitude': geo_info.get('latitude'),
                'longitude': geo_info.get('longitude'),
                'ip_address': ip_address,
                'isp': geo_info.get('isp', 'Unknown'),
                'asn': geo_info.get('asn', 'Unknown'),
                'organization': geo_info.get('organization', 'Unknown'),
                'user_agent': data.get('user_agent'),
                
                # Click Context
                'position': data.get('position', 0),
                'time_to_click': data.get('time_to_click', 0),
                
                # Fraud Indicators
                'vpn_detected': fraud_data['indicators'].get('vpn_detected', False),
                'proxy_detected': fraud_data['indicators'].get('proxy_detected', False),
                'tor_detected': fraud_data['indicators'].get('tor_detected', False),
                'hosting_detected': fraud_data['indicators'].get('hosting_detected', False),
                'duplicate_click': fraud_data['indicators'].get('duplicate_click', False),
                'fast_click': fraud_data['indicators'].get('fast_click', False),
                'bot_like': fraud_data['indicators'].get('bot_like', False),
                'fraud_score': fraud_data['fraud_score'],
                'fraud_status': fraud_data['fraud_status'],
            }
            
            logger.info("✅ Step 7 Complete: Comprehensive click data built")
            logger.info(f"   Publisher: {publisher_name} ({publisher_id})")
            logger.info(f"   Location: {geo_info.get('city')}, {geo_info.get('country')}")
            logger.info(f"   Device: {device_type}, {os}, {browser}")
            logger.info(f"   Fraud: {fraud_data['fraud_status']}")
            
            logger.info("📦 Step 8: Saving to offerwall_clicks_detailed collection...")
            comp_click_id, comp_error = direct_tracker.track_click(comprehensive_click_data)
            
            if comp_error:
                logger.error(f"❌ Step 8 FAILED: Comprehensive tracking error: {comp_error}")
                logger.error(f"   Error details: {comp_error}")
            else:
                logger.info(f"✅ Step 8 Complete: Comprehensive click tracked successfully!")
                logger.info(f"   Comprehensive Click ID: {comp_click_id}")
                logger.info(f"   Saved to: offerwall_clicks_detailed collection")
                logger.info("=" * 80)
                logger.info("🎉 COMPREHENSIVE TRACKING COMPLETED SUCCESSFULLY!")
                logger.info("=" * 80)
                
        except Exception as e:
            logger.error("=" * 80)
            logger.error(f"❌ COMPREHENSIVE TRACKING FAILED!")
            logger.error("=" * 80)
            logger.error(f"❌ Error type: {type(e).__name__}")
            logger.error(f"❌ Error message: {str(e)}")
            import traceback
            logger.error(f"❌ Full traceback:")
            logger.error(traceback.format_exc())
            logger.error("=" * 80)
        
        
        # Get offer URL for redirect
        try:
            offers_service = OffersService()
            offer = offers_service.get_offer_by_id(data['offer_id'])
        except:
            offer = None
        
        redirect_url = data.get('offer_url')
        if offer and offer.get('target_url'):
            redirect_url = offer['target_url']
        
        response_data = {
            'success': True,
            'click_id': click_id,
            'redirect_url': redirect_url
        }
        logger.info(f"✅ Returning response: {response_data}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"❌ Error tracking click: {e}", exc_info=True)
        import traceback
        error_msg = traceback.format_exc()
        print(f"❌❌❌ ERROR: {error_msg}")
        logger.error(f"❌ Full traceback: {error_msg}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@offerwall_bp.route('/api/offerwall/track/conversion', methods=['POST'])
def track_offerwall_conversion():
    """Track offer conversion"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['session_id', 'click_id', 'offer_id', 'placement_id', 'user_id', 'payout_amount']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get publisher from placement
        try:
            placements_col = db_instance.get_collection('placements')
            
            # Try multiple strategies
            placement = None
            try:
                placement = placements_col.find_one({'_id': ObjectId(data['placement_id'])})
            except:
                placement = placements_col.find_one({
                    '$or': [
                        {'_id': data['placement_id']},
                        {'placementId': data['placement_id']},
                        {'placement_id': data['placement_id']}
                    ]
                })
            
            publisher_id = placement.get('publisherId', 'unknown') if placement else 'unknown'
            if isinstance(publisher_id, ObjectId):
                publisher_id = str(publisher_id)
        except Exception as e:
            logger.error(f"Error fetching placement: {e}")
            publisher_id = 'unknown'
        
        # Record conversion using enhanced tracker with points awarding
        conversion_id, error = enhanced_tracker.record_conversion(
            click_id=data['click_id'],
            session_id=data['session_id'],
            offer_id=data['offer_id'],
            placement_id=data['placement_id'],
            publisher_id=publisher_id,
            user_id=data['user_id'],
            payout_amount=float(data['payout_amount']),
            conversion_data={
                'offer_name': data.get('offer_name', 'Unknown Offer'),
                'postback_data': {
                    'transaction_id': data.get('transaction_id'),
                    'offer_network': data.get('offer_network')
                },
                'source_platform': data.get('source_platform', 'internal')
            }
        )
        
        if error:
            logger.error(f"❌ Error tracking conversion: {error}")
            return jsonify({'error': error}), 500
        
        # ALSO track in comprehensive tracking system
        try:
            from models.comprehensive_tracking import ComprehensiveOfferwallTracker
            from routes.comprehensive_analytics import comprehensive_tracker as comp_tracker
            
            if comp_tracker:
                comprehensive_conversion_data = {
                    'session_id': data['session_id'],
                    'click_id': data['click_id'],
                    'user_id': data['user_id'],
                    'offer_id': data['offer_id'],
                    'offer_name': data.get('offer_name', 'Unknown Offer'),
                    'placement_id': data['placement_id'],
                    'publisher_id': publisher_id,
                    
                    # Offer Details
                    'offer_category': data.get('offer_category', 'unknown'),
                    'offer_network': data.get('offer_network', 'unknown'),
                    'advertiser_id': data.get('advertiser_id', 'unknown'),
                    
                    # Device/Geo
                    'device_type': data.get('device_type', 'desktop'),
                    'browser': data.get('browser', 'Unknown'),
                    'os': data.get('os', 'Unknown'),
                    'country': data.get('country', 'Unknown'),
                    'ip_address': request.remote_addr,
                    
                    # Conversion Timing
                    'session_duration': data.get('session_duration', 0),
                    
                    # PAYOUT INFO
                    'payout_amount': float(data['payout_amount']),
                    'user_reward': data.get('user_reward', float(data['payout_amount']) * 0.5),
                    'publisher_commission': data.get('publisher_commission', float(data['payout_amount']) * 0.35),
                    'platform_revenue': data.get('platform_revenue', float(data['payout_amount']) * 0.15),
                    'currency': data.get('currency', 'USD'),
                    
                    # Postback Data
                    'transaction_id': data.get('transaction_id'),
                    'postback_url': data.get('postback_url'),
                    'postback_data': data.get('postback_data', {}),
                    
                    # Fraud Indicators
                    'vpn_detected': data.get('vpn_detected', False),
                }
                
                comp_conversion_id, comp_error = comp_tracker.track_conversion(comprehensive_conversion_data)
                if comp_error:
                    logger.warning(f"⚠️ Comprehensive tracking conversion failed: {comp_error}")
                else:
                    logger.info(f"✅ Comprehensive conversion tracked: {comp_conversion_id}")
        except Exception as e:
            logger.warning(f"⚠️ Error in comprehensive tracking: {e}")
        
        # Create activity record for user (for backward compatibility)
        try:
            activities_col = db_instance.get_collection('offerwall_activities')
            activity_doc = {
                'activity_id': str(uuid.uuid4()),
                'user_id': data['user_id'],
                'placement_id': data['placement_id'],
                'offer_id': data['offer_id'],
                'offer_title': data.get('offer_name', 'Offer'),
                'reward_amount': float(data['payout_amount']),
                'activity_type': 'offer_completed',
                'status': 'completed',
                'completed_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'completion_details': {
                    'transaction_id': data.get('transaction_id'),
                    'offer_network': data.get('offer_network'),
                    'completion_time': datetime.utcnow().isoformat(),
                    'user_agent': data.get('user_agent'),
                    'ip_address': request.remote_addr
                }
            }
            activities_col.insert_one(activity_doc)
            logger.info(f"✅ Activity recorded for user {data['user_id']}, offer {data['offer_id']}")
        except Exception as e:
            logger.error(f"⚠️ Error creating activity record: {e}")
        
        return jsonify({
            'success': True,
            'conversion_id': conversion_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error tracking conversion: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/user/activity', methods=['GET'])
def get_user_activity():
    """Get user's completed offers activity"""
    try:
        user_id = request.args.get('user_id')
        placement_id = request.args.get('placement_id')
        limit = int(request.args.get('limit', 50))
        
        if not user_id or not placement_id:
            return jsonify({'error': 'user_id and placement_id are required'}), 400
        
        logger.info(f"📊 Fetching activity for user {user_id}, placement {placement_id}")
        
        # Get activities from database
        activities_col = db_instance.get_collection('offerwall_activities')
        activities = list(activities_col.find({
            'user_id': user_id,
            'placement_id': placement_id,
            'status': 'completed'
        }).sort('completed_at', -1).limit(limit))
        
        # Convert datetime objects to ISO format and add formatted time
        for activity in activities:
            completed_at = activity.get('completed_at')
            if isinstance(completed_at, datetime):
                # Add formatted time for display
                activity['completed_at_formatted'] = completed_at.strftime('%Y-%m-%d %H:%M:%S')
                # Add relative time
                time_diff = datetime.utcnow() - completed_at
                if time_diff.days > 0:
                    activity['completed_ago'] = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
                elif time_diff.seconds > 3600:
                    hours = time_diff.seconds // 3600
                    activity['completed_ago'] = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif time_diff.seconds > 60:
                    minutes = time_diff.seconds // 60
                    activity['completed_ago'] = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
                else:
                    activity['completed_ago'] = 'Just now'
                # Convert to ISO format after formatting
                activity['completed_at'] = completed_at.isoformat()
                    
            if isinstance(activity.get('created_at'), datetime):
                activity['created_at'] = activity['created_at'].isoformat()
            # Remove MongoDB ObjectId
            if '_id' in activity:
                activity['_id'] = str(activity['_id'])
                
            # Add completion details if available
            if 'completion_details' in activity:
                details = activity['completion_details']
                if isinstance(details.get('completion_time'), datetime):
                    details['completion_time'] = details['completion_time'].isoformat()
        
        logger.info(f"✅ Found {len(activities)} completed offers for user {user_id}")
        
        return jsonify({
            'success': True,
            'activities': activities,
            'total_completed': len(activities),
            'user_id': user_id,
            'placement_id': placement_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user activity: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500




@offerwall_bp.route('/api/offerwall/user/points', methods=['GET'])
def get_user_points():
    """Get user's points summary"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        points = enhanced_tracker.get_user_points(user_id)
        
        return jsonify({
            'success': True,
            'data': points
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user points: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/user/points-history', methods=['GET'])
def get_user_points_history():
    """Get user's points earning history"""
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', 50, type=int)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        history = enhanced_tracker.get_user_points_history(user_id, limit=limit)
        
        # Format history for frontend
        formatted_history = []
        for entry in history:
            formatted_history.append({
                'timestamp': entry['timestamp'].isoformat() if isinstance(entry['timestamp'], datetime) else entry['timestamp'],
                'points': entry['points'],
                'type': entry['type'],
                'offer_id': entry.get('offer_id'),
                'conversion_id': entry.get('conversion_id'),
                'status': entry['status']
            })
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'history': formatted_history,
                'total_entries': len(formatted_history)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting points history: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/user/dashboard', methods=['GET'])
def get_user_dashboard():
    """Get user's complete offerwall dashboard"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Get points
        points = enhanced_tracker.get_user_points(user_id)
        
        # Get recent history
        history = enhanced_tracker.get_user_points_history(user_id, limit=10)
        
        # Get completed offers
        completions = enhanced_tracker.get_user_completed_offers(user_id, limit=10)
        
        # Calculate stats
        total_offers_completed = len(completions)
        total_earnings = points['total_points']
        
        # Calculate average payout per offer
        avg_payout = (total_earnings / total_offers_completed) if total_offers_completed > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'points': {
                    'total': points['total_points'],
                    'available': points['available_points'],
                    'redeemed': points['redeemed_points'],
                    'pending': points['pending_points']
                },
                'stats': {
                    'total_offers_completed': total_offers_completed,
                    'total_earnings': total_earnings,
                    'average_payout_per_offer': round(avg_payout, 2)
                },
                'recent_activity': {
                    'recent_points': history[:5],
                    'recent_offers': completions[:5]
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user dashboard: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@offerwall_bp.route('/api/offerwall/user/completed-offers', methods=['GET'])
def get_user_completed_offers():
    """Get user's completed offers"""
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', 50, type=int)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        completions = enhanced_tracker.get_user_completed_offers(user_id, limit=limit)
        
        # Format completions for frontend
        formatted_completions = []
        for completion in completions:
            formatted_completions.append({
                '_id': str(completion.get('_id', '')),
                'user_id': completion.get('user_id', ''),
                'offer_id': completion.get('offer_id', ''),
                'offer_name': completion.get('offer_name', 'Unknown Offer'),
                'payout_amount': completion.get('payout_amount', 0),
                'points_awarded': completion.get('points_awarded', 0),
                'completion_time': completion.get('completion_time', ''),
                'status': completion.get('status', 'completed'),
                'fraud_score': completion.get('fraud_score', 0)
            })
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'completed_offers': formatted_completions,
                'total_entries': len(formatted_completions)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting completed offers: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/user/clicks', methods=['GET'])
def get_user_clicks():
    """Get user's click history"""
    logger.info("🚀 USER CLICKS ENDPOINT CALLED")
    
    try:
        user_id = request.args.get('user_id')
        placement_id = request.args.get('placement_id')
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"🔍 Request params - user_id: {user_id}, placement_id: {placement_id}, limit: {limit}")
        
        if not user_id or not placement_id:
            logger.error("❌ Missing user_id or placement_id")
            return jsonify({'error': 'user_id and placement_id are required'}), 400
        
        logger.info(f"📊 Fetching clicks for user {user_id}, placement {placement_id}")
        
        # Try comprehensive collection first (newer data)
        logger.info("🔍 Querying offerwall_clicks_detailed collection (comprehensive)...")
        clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        
        query = {
            'user_id': user_id,
            'placement_id': placement_id
        }
        logger.info(f"🔍 Query: {query}")
        
        clicks = list(clicks_detailed_col.find(query).sort('timestamp', -1).limit(limit))
        logger.info(f"🔍 Found {len(clicks)} clicks in comprehensive collection")
        
        # If no clicks in comprehensive, try regular collection
        if len(clicks) == 0:
            logger.info("🔍 No clicks in comprehensive collection, trying regular offerwall_clicks...")
            clicks_col = db_instance.get_collection('offerwall_clicks')
            clicks = list(clicks_col.find(query).sort('timestamp', -1).limit(limit))
            logger.info(f"🔍 Found {len(clicks)} clicks in regular collection")
        
        logger.info(f"🔍 Found {len(clicks)} total clicks in database")
        
        # Log each click found
        for i, click in enumerate(clicks):
            logger.info(f"🔍 Click {i+1}: {click.get('offer_name')} ({click.get('offer_id')}) - {click.get('timestamp')}")
        
        # If no clicks found, log the collections available
        if len(clicks) == 0:
            logger.warning("⚠️ NO CLICKS FOUND! Checking what's in the collection...")
            all_docs = list(clicks_detailed_col.find().limit(5))
            logger.warning(f"⚠️ Total documents in comprehensive collection: {clicks_detailed_col.count_documents({})}")
            if all_docs:
                logger.warning(f"⚠️ Sample document keys: {list(all_docs[0].keys())}")
                logger.warning(f"⚠️ Sample user_id: {all_docs[0].get('user_id')}")
                logger.warning(f"⚠️ Sample placement_id: {all_docs[0].get('placement_id')}")
        
        # Convert datetime objects to ISO format and add formatted time
        for click in clicks:
            # Use timestamp field instead of created_at
            timestamp_field = click.get('timestamp') or click.get('created_at')
            if isinstance(timestamp_field, datetime):
                click['created_at'] = timestamp_field.isoformat()
                # Add formatted time for display
                click['created_at_formatted'] = timestamp_field.strftime('%Y-%m-%d %H:%M:%S')
                # Add relative time
                time_diff = datetime.utcnow() - timestamp_field
                if time_diff.days > 0:
                    click['clicked_ago'] = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
                elif time_diff.seconds > 3600:
                    hours = time_diff.seconds // 3600
                    click['clicked_ago'] = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif time_diff.seconds > 60:
                    minutes = time_diff.seconds // 60
                    click['clicked_ago'] = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
                else:
                    click['clicked_ago'] = 'Just now'
            
            # Remove MongoDB ObjectId
            if '_id' in click:
                click['_id'] = str(click['_id'])
        
        logger.info(f"✅ Found {len(clicks)} clicks for user {user_id}")
        
        return jsonify({
            'success': True,
            'clicks': clicks,
            'total_clicks': len(clicks),
            'user_id': user_id,
            'placement_id': placement_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user clicks: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/user/stats', methods=['GET'])
def get_user_stats():
    """Get user's offerwall statistics"""
    try:
        user_id = request.args.get('user_id')
        placement_id = request.args.get('placement_id')
        
        if not user_id or not placement_id:
            return jsonify({'error': 'user_id and placement_id are required'}), 400
        
        logger.info(f"📈 Fetching stats for user {user_id}, placement {placement_id}")
        
        # Get activities from database
        activities_col = db_instance.get_collection('offerwall_activities')
        all_activities = list(activities_col.find({
            'user_id': user_id,
            'placement_id': placement_id
        }))
        
        # Calculate stats
        total_earned = sum(float(a.get('reward_amount', 0)) for a in all_activities)
        
        # Get today's earnings
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_activities = [a for a in all_activities if isinstance(a.get('completed_at'), datetime) and a['completed_at'] >= today_start]
        today_earned = sum(float(a.get('reward_amount', 0)) for a in today_activities)
        
        # Get completed offers list (last 10)
        completed_offers = []
        for activity in sorted(all_activities, key=lambda x: x.get('completed_at', datetime.utcnow()), reverse=True)[:10]:
            completed_offers.append({
                'offer_id': activity.get('offer_id'),
                'offer_title': activity.get('offer_title'),
                'reward_amount': activity.get('reward_amount'),
                'completed_at': activity.get('completed_at').isoformat() if isinstance(activity.get('completed_at'), datetime) else str(activity.get('completed_at'))
            })
        
        logger.info(f"✅ Stats - Total: {total_earned}, Today: {today_earned}, Completed: {len(all_activities)}")
        
        return jsonify({
            'success': True,
            'stats': {
                'total_earned': total_earned,
                'today_earned': today_earned,
                'offers_clicked': 0,  # Can be calculated from clicks collection if needed
                'offers_completed': len(all_activities),
                'offers_pending': 0,  # Can be calculated from pending conversions
                'week_clicks': 0,  # Can be calculated from clicks collection
                'week_conversions': len(all_activities),  # Using completed activities as conversions
                'completed_offers': [offer['offer_id'] for offer in completed_offers] if completed_offers else []
            },
            'user_id': user_id,
            'placement_id': placement_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user stats: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/analytics/<placement_id>', methods=['GET'])
def get_offerwall_analytics(placement_id):
    """Get offerwall analytics for a placement"""
    try:
        # Get publisher from placement
        placement_model = Placement()
        placement = placement_model.get_placement_by_id_only(placement_id)
        
        if not placement:
            return jsonify({'error': 'Placement not found'}), 404
        
        publisher_id = placement.get('publisherId', 'unknown')
        if isinstance(publisher_id, ObjectId):
            publisher_id = str(publisher_id)
        
        # Get stats
        stats = tracker.get_publisher_stats(publisher_id, placement_id=placement_id)
        
        return jsonify({
            'success': True,
            'placement_id': placement_id,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting analytics: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

def apply_rotation_rules(offer, request_data):
    """
    Apply rotation rules from Smart Rules to select destination URL
    
    Args:
        offer: Offer document with smartRules
        request_data: Request data containing user context
        
    Returns:
        str: Selected destination URL based on rotation rules
    """
    import random
    
    try:
        offer_id = offer.get('offer_id', 'unknown')
        logger.info(f"🔄 Applying rotation rules for offer {offer_id}")
        
        # Get smart rules
        smart_rules = offer.get('smartRules', [])
        
        if not smart_rules:
            logger.info(f"📋 No smart rules found for offer {offer_id}, using default target_url")
            return offer.get('target_url', 'https://example.com')
        
        # Filter for active rotation rules
        rotation_rules = [
            rule for rule in smart_rules 
            if rule.get('type') == 'Rotation' and rule.get('active', True)
        ]
        
        if not rotation_rules:
            logger.info(f"📋 No active rotation rules found for offer {offer_id}")
            
            # Check for other active rules (GEO, Backup, etc.)
            active_rules = [rule for rule in smart_rules if rule.get('active', True)]
            
            if active_rules:
                # Sort by priority and use the first active rule
                sorted_rules = sorted(active_rules, key=lambda x: x.get('priority', 999))
                selected_rule = sorted_rules[0]
                selected_url = selected_rule.get('url', offer.get('target_url', 'https://example.com'))
                logger.info(f"✅ Using priority rule: {selected_rule.get('type')} -> {selected_url}")
                return selected_url
            
            return offer.get('target_url', 'https://example.com')
        
        # Apply rotation logic
        logger.info(f"🎯 Found {len(rotation_rules)} active rotation rules")
        
        # Collect all rotation links with their weights
        rotation_links = []
        
        for rule in rotation_rules:
            url = rule.get('url')
            # Try both field names for compatibility
            split_percentage = rule.get('percentage', rule.get('splitPercentage', 0))
            
            if url and split_percentage > 0:
                rotation_links.append({
                    'url': url,
                    'split': split_percentage,
                    'priority': rule.get('priority', 999)
                })
                logger.info(f"📊 Rotation link: {url} (weight: {split_percentage}%)")
        
        if not rotation_links:
            logger.warning(f"⚠️ No valid rotation links found for offer {offer_id}")
            return offer.get('target_url', 'https://example.com')
        
        # Sort by priority (lower number = higher priority)
        rotation_links.sort(key=lambda x: x['priority'])
        
        # Extract URLs and weights for random selection
        urls = [link['url'] for link in rotation_links]
        weights = [link['split'] for link in rotation_links]
        
        # Normalize weights to ensure they sum to 100 (optional, random.choices handles this)
        total_weight = sum(weights)
        if total_weight == 0:
            logger.warning(f"⚠️ Total weight is 0 for offer {offer_id}")
            return rotation_links[0]['url']  # Return first URL as fallback
        
        # Use random.choices to select URL based on weights
        selected_url = random.choices(urls, weights=weights, k=1)[0]
        
        # Find which rule was selected for logging
        selected_rule = next((link for link in rotation_links if link['url'] == selected_url), None)
        selected_weight = selected_rule['split'] if selected_rule else 0
        
        logger.info(f"🎲 Rotation selection: {selected_url} (weight: {selected_weight}%, total_weight: {total_weight})")
        
        return selected_url
        
    except Exception as e:
        logger.error(f"❌ Error applying rotation rules: {str(e)}", exc_info=True)
        # Fallback to default target URL
        return offer.get('target_url', 'https://example.com')


