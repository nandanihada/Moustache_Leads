from flask import Blueprint, request, jsonify, render_template_string
from models.placement import Placement
from models.tracking import Tracking
from models.offers import OffersService
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

offerwall_bp = Blueprint('offerwall', __name__)

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
            height: 120px;
            background-size: cover;
            background-position: center;
            border-radius: 8px;
            margin-bottom: 15px;
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
                const response = await fetch(`${API_BASE}/api/offerwall/offers?placement_id=${PLACEMENT_ID}&user_id=${USER_ID}`);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
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
            
            const offersHtml = offers.map(offer => `
                <div class="offer-card" onclick="handleOfferClick('${offer.id}', '${offer.title}', '${offer.click_url}')">
                    ${offer.urgency ? `<div class="urgency-badge">${offer.urgency.message}</div>` : ''}
                    <div class="offer-image" style="background-image: url('${offer.image_url}')"></div>
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
            `).join('');
            
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


@offerwall_bp.route('/offerwall')
def serve_offerwall():
    """Serve the offerwall iframe with validation"""
    try:
        # Get query parameters
        placement_id = request.args.get('placement_id')
        user_id = request.args.get('user_id')
        api_key = request.args.get('api_key')
        
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
        
        # Render the offerwall HTML
        return render_template_string(
            OFFERWALL_HTML_TEMPLATE,
            placement=placement,
            user_id=user_id
        )
        
    except Exception as e:
        logger.error(f"Error serving offerwall: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/offers')
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
        query_filter = {}
        
        # Filter by status (default to active offers only)
        if status and status != 'all':
            query_filter['status'] = status
        
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
            transformed_offer = {
                'id': offer.get('offer_id', str(offer.get('_id'))),
                'title': offer.get('name', 'Untitled Offer'),
                'description': offer.get('description', 'No description available'),
                'reward_amount': offer.get('payout', 0),
                'reward_currency': offer.get('currency', 'USD'),
                'category': offer.get('category', 'general'),
                'status': offer.get('status', 'active'),
                'image_url': offer.get('creative_url') or offer.get('preview_url') or 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Offer',
                'click_url': offer.get('target_url', '#'),
                'network': offer.get('network', 'Unknown'),
                'countries': offer.get('countries', []),
                'devices': offer.get('devices', []),
                'estimated_time': '5-10 minutes',  # Default value
                'created_at': offer.get('created_at', datetime.utcnow()).isoformat() if isinstance(offer.get('created_at'), datetime) else str(offer.get('created_at', '')),
            }
            transformed_offers.append(transformed_offer)
        
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


@offerwall_bp.route('/api/offerwall/track/impression', methods=['POST'])
def track_impression():
    """Track offerwall impression"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['placement_id', 'user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Track impression
        tracking = Tracking()
        impression_id, error = tracking.track_impression(
            placement_id=data['placement_id'],
            user_id=data['user_id'],
            user_ip=request.remote_addr,
            user_agent=data.get('user_agent')
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'success': True,
            'impression_id': impression_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error tracking impression: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/track/click', methods=['POST'])
def track_click():
    """Track offer click and apply rotation rules"""
    import random
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['placement_id', 'user_id', 'offer_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        offer_id = data['offer_id']
        
        # Get offer with Smart Rules for rotation logic
        try:
            from models.offer_extended import OfferExtended
            extended_model = OfferExtended()
            offer = extended_model.get_offer_by_id(offer_id)
            
            if not offer:
                logger.warning(f"❌ Offer {offer_id} not found")
                return jsonify({'error': 'Offer not found'}), 404
            
            # Apply rotation logic if Smart Rules exist
            final_url = apply_rotation_rules(offer, data)
            
        except ImportError:
            logger.warning("⚠️ OfferExtended model not available, using fallback")
            # Fallback to basic offer model
            from models.offer import Offer
            offer_model = Offer()
            offer = offer_model.get_offer_by_id(offer_id)
            
            if not offer:
                return jsonify({'error': 'Offer not found'}), 404
            
            final_url = offer.get('target_url', 'https://example.com')
        
        # Track click
        tracking = Tracking()
        click_id, error = tracking.track_click(
            placement_id=data['placement_id'],
            user_id=data['user_id'],
            offer_id=data['offer_id'],
            offer_name=data.get('offer_name'),
            user_ip=request.remote_addr,
            user_agent=data.get('user_agent')
        )
        
        if error:
            logger.error(f"Error tracking click: {error}")
            # Continue with redirect even if tracking fails
        
        logger.info(f"🎯 Click tracked for offer {offer_id}, redirecting to: {final_url}")
        
        return jsonify({
            'success': True,
            'click_id': click_id,
            'redirect_url': final_url
        }), 200
        
    except Exception as e:
        logger.error(f"Error tracking click: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@offerwall_bp.route('/api/offerwall/stats/<placement_id>')
def get_placement_stats(placement_id):
    """Get placement statistics (protected endpoint for publishers)"""
    try:
        # This would normally require authentication, but for demo purposes we'll allow it
        tracking = Tracking()
        stats, error = tracking.get_placement_stats(placement_id)
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Error getting placement stats: {e}")
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
