from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import re
import sys
import os

# Add utils directory to path for frontend mapping
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'utils'))
from frontend_mapping import frontend_to_database, validate_frontend_data

# ==================== OFFER ENHANCEMENT CONSTANTS ====================

# 10 Predefined Verticals (replaces category)
VALID_VERTICALS = [
    'Finance', 'Gaming', 'Dating', 'Health', 'E-commerce',
    'Entertainment', 'Education', 'Travel', 'Utilities', 'Lifestyle'
]

# Mapping from old category values to new verticals (for migration)
CATEGORY_TO_VERTICAL_MAP = {
    'finance': 'Finance',
    'gaming': 'Gaming',
    'dating': 'Dating',
    'health': 'Health',
    'education': 'Education',
    'general': 'Lifestyle',
    'ecommerce': 'E-commerce',
    'e-commerce': 'E-commerce',
    'entertainment': 'Entertainment',
    'travel': 'Travel',
    'utilities': 'Utilities',
    'lifestyle': 'Lifestyle',
}

# Default fallback URL for geo-restricted users
DEFAULT_NON_ACCESS_URL = 'https://example.com/not-available'


def calculate_incentive_type(payout_type='fixed', revenue_share_percent=None):
    """
    Auto-calculate incentive type based on payout type.
    
    Args:
        payout_type: Type of payout - 'fixed', 'percentage', 'tiered'
        revenue_share_percent: Percentage of revenue share (0-100) or None (legacy)
        
    Returns:
        'Non-Incent' if percentage-based payout
        'Incent' if fixed amount payout
    
    Logic:
        - percentage payout → Non-Incent (user doesn't get direct incentive)
        - fixed/tiered payout → Incent (user gets fixed incentive)
    """
    # Primary logic: Based on payout_type
    if payout_type == 'percentage':
        return 'Non-Incent'
    
    # Legacy logic: Based on revenue_share_percent (for backward compatibility)
    if revenue_share_percent and float(revenue_share_percent) > 0:
        return 'Non-Incent'
    
    # Default: Fixed or tiered payout = Incent
    return 'Incent'


def map_category_to_vertical(category_value):
    """
    Map old category value to new vertical.
    
    Args:
        category_value: Old category string
        
    Returns:
        Mapped vertical string or 'Lifestyle' as default
    """
    if not category_value:
        return 'Lifestyle'
    
    category_lower = str(category_value).lower().strip()
    return CATEGORY_TO_VERTICAL_MAP.get(category_lower, 'Lifestyle')


def validate_vertical(vertical_value):
    """
    Validate that vertical is one of the 10 predefined values.
    
    Args:
        vertical_value: Vertical string to validate
        
    Returns:
        Tuple of (is_valid, normalized_value or error_message)
    """
    if not vertical_value:
        return True, 'Lifestyle'  # Default
    
    # Check exact match (case-insensitive)
    for valid_vertical in VALID_VERTICALS:
        if str(vertical_value).lower().strip() == valid_vertical.lower():
            return True, valid_vertical
    
    return False, f"Invalid vertical '{vertical_value}'. Must be one of: {', '.join(VALID_VERTICALS)}"


# Keywords for auto-detecting vertical from description/name
VERTICAL_KEYWORDS = {
    'Finance': [
        'bank', 'banking', 'loan', 'credit', 'debit', 'card', 'money', 'cash', 'invest', 
        'investment', 'trading', 'forex', 'crypto', 'bitcoin', 'stock', 'insurance', 
        'mortgage', 'finance', 'financial', 'payment', 'pay', 'wallet', 'savings',
        'account', 'transfer', 'deposit', 'withdraw', 'interest', 'apr', 'fico',
        'debt', 'budget', 'tax', 'ira', '401k', 'retirement', 'pension', 'fintech',
        'neobank', 'paypal', 'venmo', 'zelle', 'cashback', 'rewards', 'bonus'
    ],
    'Gaming': [
        'game', 'gaming', 'play', 'player', 'casino', 'bet', 'betting', 'poker', 
        'slots', 'spin', 'jackpot', 'win', 'winner', 'esports', 'mobile game',
        'puzzle', 'rpg', 'mmorpg', 'fps', 'strategy', 'arcade', 'console', 'pc game',
        'playstation', 'xbox', 'nintendo', 'steam', 'epic games', 'roblox', 'fortnite',
        'minecraft', 'league', 'dota', 'valorant', 'cod', 'gta', 'fifa', 'nba',
        'fantasy', 'sports betting', 'sportsbook', 'gambling', 'wager', 'odds'
    ],
    'Dating': [
        'date', 'dating', 'match', 'love', 'relationship', 'single', 'singles',
        'meet', 'hookup', 'romance', 'romantic', 'partner', 'soulmate', 'tinder',
        'bumble', 'hinge', 'okcupid', 'plenty of fish', 'pof', 'eharmony', 'zoosk',
        'chat', 'flirt', 'connection', 'compatible', 'swipe', 'profile', 'matchmaking'
    ],
    'Health': [
        'health', 'healthy', 'medical', 'medicine', 'doctor', 'hospital', 'clinic',
        'pharmacy', 'drug', 'prescription', 'vitamin', 'supplement', 'fitness',
        'workout', 'exercise', 'gym', 'weight', 'diet', 'nutrition', 'wellness',
        'mental health', 'therapy', 'counseling', 'insurance', 'medicare', 'medicaid',
        'dental', 'vision', 'hearing', 'sleep', 'cbd', 'hemp', 'organic', 'natural',
        'skincare', 'beauty', 'cosmetic', 'anti-aging', 'hair', 'teeth', 'whitening'
    ],
    'E-commerce': [
        'shop', 'shopping', 'store', 'buy', 'purchase', 'order', 'cart', 'checkout',
        'amazon', 'ebay', 'walmart', 'target', 'aliexpress', 'shopify', 'etsy',
        'product', 'deal', 'discount', 'coupon', 'promo', 'sale', 'offer', 'free shipping',
        'delivery', 'retail', 'wholesale', 'marketplace', 'vendor', 'seller', 'buyer',
        'fashion', 'clothing', 'shoes', 'accessories', 'electronics', 'gadget', 'tech',
        'home', 'furniture', 'decor', 'kitchen', 'appliance', 'grocery', 'food'
    ],
    'Entertainment': [
        'movie', 'film', 'tv', 'television', 'show', 'series', 'stream', 'streaming',
        'netflix', 'hulu', 'disney', 'hbo', 'amazon prime', 'youtube', 'spotify',
        'music', 'song', 'album', 'artist', 'concert', 'ticket', 'event', 'live',
        'podcast', 'radio', 'news', 'magazine', 'book', 'ebook', 'audiobook',
        'celebrity', 'gossip', 'viral', 'trending', 'meme', 'funny', 'comedy',
        'drama', 'action', 'horror', 'thriller', 'documentary', 'anime', 'cartoon'
    ],
    'Education': [
        'learn', 'learning', 'course', 'class', 'school', 'college', 'university',
        'degree', 'diploma', 'certificate', 'certification', 'training', 'tutorial',
        'study', 'student', 'teacher', 'tutor', 'education', 'educational', 'academic',
        'online course', 'e-learning', 'udemy', 'coursera', 'skillshare', 'masterclass',
        'language', 'english', 'spanish', 'coding', 'programming', 'development',
        'skill', 'career', 'job', 'resume', 'interview', 'professional', 'mba', 'phd'
    ],
    'Travel': [
        'travel', 'trip', 'vacation', 'holiday', 'flight', 'airline', 'airport',
        'hotel', 'resort', 'booking', 'reservation', 'airbnb', 'vrbo', 'expedia',
        'kayak', 'priceline', 'tripadvisor', 'cruise', 'tour', 'destination',
        'beach', 'mountain', 'city', 'country', 'international', 'domestic',
        'passport', 'visa', 'luggage', 'rental car', 'uber', 'lyft', 'taxi',
        'adventure', 'explore', 'backpack', 'tourism', 'tourist', 'sightseeing'
    ],
    'Utilities': [
        'utility', 'utilities', 'electric', 'electricity', 'power', 'energy', 'gas',
        'water', 'internet', 'wifi', 'broadband', 'cable', 'phone', 'mobile',
        'cellular', 'carrier', 'verizon', 'at&t', 'tmobile', 't-mobile', 'sprint',
        'vpn', 'security', 'antivirus', 'software', 'app', 'tool', 'service',
        'subscription', 'plan', 'bill', 'payment', 'solar', 'renewable', 'smart home',
        'iot', 'device', 'gadget', 'storage', 'cloud', 'backup', 'cleaner', 'optimizer'
    ],
    'Lifestyle': [
        'lifestyle', 'life', 'living', 'home', 'family', 'pet', 'dog', 'cat',
        'garden', 'outdoor', 'hobby', 'craft', 'diy', 'art', 'photography',
        'cooking', 'recipe', 'food', 'restaurant', 'wine', 'beer', 'coffee',
        'fashion', 'style', 'trend', 'luxury', 'premium', 'vip', 'exclusive',
        'membership', 'club', 'community', 'social', 'network', 'influencer'
    ]
}


def detect_vertical_from_text(name, description=''):
    """
    Auto-detect vertical/category from offer name and description.
    
    Args:
        name: Offer name/title
        description: Offer description
        
    Returns:
        Detected vertical string (one of VALID_VERTICALS)
    """
    # Combine name and description for analysis
    text = f"{name} {description}".lower()
    
    # Count keyword matches for each vertical
    scores = {}
    for vertical, keywords in VERTICAL_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            # Check for whole word match (with word boundaries)
            if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', text):
                # Give higher weight to matches in the name
                if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', name.lower()):
                    score += 3  # Name match = 3 points
                else:
                    score += 1  # Description match = 1 point
        scores[vertical] = score
    
    # Find the vertical with highest score
    if scores:
        best_vertical = max(scores, key=scores.get)
        best_score = scores[best_vertical]
        
        # Only return detected vertical if score is meaningful (at least 1 match)
        if best_score > 0:
            return best_vertical
    
    # Default to Lifestyle if no matches found
    return 'Lifestyle'


class Offer:
    def __init__(self):
        self.collection = db_instance.get_collection('offers')
        self.counter_collection = db_instance.get_collection('counters')
        self.settings_collection = db_instance.get_collection('offer_settings')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def _get_next_offer_id(self):
        """Generate next auto-increment offer ID in format ML-00001"""
        if not self._check_db_connection():
            return "ML-00001"  # Fallback for testing
        
        try:
            # Find and update counter
            result = self.counter_collection.find_one_and_update(
                {'_id': 'offer_counter'},
                {'$inc': {'sequence_value': 1}},
                upsert=True,
                return_document=True
            )
            
            sequence = result['sequence_value']
            return f"ML-{sequence:05d}"  # Format as ML-00001, ML-00002, etc.
            
        except Exception as e:
            # Fallback: find highest existing ID and increment
            try:
                last_offer = self.collection.find_one(
                    {'offer_id': {'$regex': '^ML-'}},
                    sort=[('offer_id', -1)]
                )
                if last_offer:
                    last_num = int(last_offer['offer_id'].split('-')[1])
                    return f"ML-{last_num + 1:05d}"
                else:
                    return "ML-00001"
            except:
                return "ML-00001"
    
    def create_offer(self, offer_data, created_by):
        """Create a new offer with frontend field mapping support"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate frontend data first
            is_valid, validation_errors = validate_frontend_data(offer_data)
            if not is_valid:
                return None, f"Validation errors: {'; '.join(validation_errors)}"
            
            # Map frontend fields to database schema
            mapped_data = frontend_to_database(offer_data)
            
            # Generate unique offer ID
            offer_id = self._get_next_offer_id()
            
            # Validate required fields
            # Note: payout can be 0 for revenue share offers, so check for None/missing explicitly
            required_fields = ['campaign_id', 'name', 'network', 'target_url']
            for field in required_fields:
                if not mapped_data.get(field):
                    return None, f"Field '{field}' is required"
            
            # Special validation for payout: must be present (can be 0 for revenue share)
            if 'payout' not in mapped_data or mapped_data['payout'] is None:
                return None, "Field 'payout' is required"
            
            # Validate URL format
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            if not url_pattern.match(mapped_data['target_url']):
                return None, "Invalid target URL format"
            
            if mapped_data.get('preview_url') and not url_pattern.match(mapped_data['preview_url']):
                return None, "Invalid preview URL format"
            
            # Validate payout is numeric (can be 0 for revenue share)
            try:
                payout_value = float(mapped_data['payout'])
                if payout_value < 0:
                    return None, "Payout cannot be negative"
            except (ValueError, TypeError):
                return None, "Payout must be a valid number"
            
            # Process vertical (replaces category) - validate and normalize
            vertical_input = mapped_data.get('vertical') or mapped_data.get('category', '')
            
            # If vertical is not explicitly set or is default 'Lifestyle', auto-detect from description
            if not vertical_input or vertical_input.lower() == 'lifestyle':
                # Auto-detect vertical from name and description
                offer_name = mapped_data.get('name', '')
                offer_description = mapped_data.get('description', '')
                vertical_value = detect_vertical_from_text(offer_name, offer_description)
                print(f"🔍 AUTO-DETECTED VERTICAL: '{vertical_value}' from name='{offer_name[:50]}...'")
            else:
                is_valid_vertical, vertical_result = validate_vertical(vertical_input)
                if not is_valid_vertical:
                    # Try mapping from old category
                    vertical_value = map_category_to_vertical(vertical_input)
                else:
                    vertical_value = vertical_result
            
            # Validate and process revenue share percent
            revenue_share_percent = float(offer_data.get('revenue_share_percent', 0) or 0)
            
            # Validate revenue_share_percent is between 0 and 100
            if revenue_share_percent < 0 or revenue_share_percent > 100:
                return None, "Revenue share percent must be between 0 and 100"
            
            # Get payout_type and auto-calculate incentive type
            payout_type = offer_data.get('payout_type', 'fixed')
            
            # DEBUG: Print what we're receiving (visible immediately)
            print("="*80)
            print("🔍 INCENTIVE DEBUG:")
            print(f"   payout_type received: '{payout_type}'")
            print(f"   revenue_share_percent: {revenue_share_percent}")
            
            incentive_type = calculate_incentive_type(payout_type, revenue_share_percent)
            
            print(f"   calculated incentive_type: '{incentive_type}'")
            print(f"   (percentage → Non-Incent, fixed/tiered → Incent)")
            print("="*80)
            
            # Process allowed countries for geo-restriction
            allowed_countries = offer_data.get('allowed_countries', [])
            if isinstance(allowed_countries, str):
                allowed_countries = [c.strip().upper() for c in allowed_countries.split(',') if c.strip()]
            
            # Create offer document using mapped data
            offer_doc = {
                # SECTION 1: OFFER IDENTIFICATION
                'offer_id': offer_id,  # Our auto-generated ML-00001
                'campaign_id': mapped_data['campaign_id'].strip(),  # Publisher's campaign ID
                'name': mapped_data['name'].strip(),
                'description': mapped_data.get('description', '').strip(),
                'vertical': vertical_value,  # NEW: Replaces category - one of 10 predefined values
                'category': vertical_value,  # DEPRECATED: Keep for backward compatibility
                'offer_type': mapped_data.get('offer_type', 'CPA'),  # CPA/CPL/CPS/CPI/CPC
                'status': mapped_data.get('status', 'active').lower(),  # Active/Inactive/Pending/Paused/Hidden - force lowercase
                'tags': mapped_data.get('tags', []),  # Internal filtering tags
                'keywords': mapped_data.get('keywords', []),  # SEO/filtering keywords
                
                # SECTION 2: TARGETING RULES
                'countries': mapped_data.get('countries', []),
                'allowed_countries': allowed_countries,  # NEW: Geo-restriction - allowed country codes
                'non_access_url': offer_data.get('non_access_url', '').strip(),  # NEW: Fallback URL for blocked users
                'languages': mapped_data.get('languages', []),  # en, es, fr, etc
                'device_targeting': mapped_data.get('device_targeting', 'all'),  # all/mobile/desktop
                'os_targeting': mapped_data.get('os_targeting', []),  # iOS/Android/Windows/Mac
                'browser_targeting': mapped_data.get('browser_targeting', []),  # Chrome/Safari/Edge
                'carrier_targeting': mapped_data.get('carrier_targeting', []),  # Verizon/AT&T/T-Mobile
                'connection_type': mapped_data.get('connection_type', 'all'),  # wifi/mobile/all
                'timezone': mapped_data.get('timezone', 'UTC'),  # UTC/EST/PST/etc
                
                # SECTION 3: PAYOUT & FINANCE
                'payout': float(offer_data['payout']),
                'revenue_share_percent': revenue_share_percent,  # NEW: 0-100 percentage for revenue sharing
                'incentive_type': incentive_type,  # NEW: Auto-calculated - 'Incent' or 'Non-Incent'
                'currency': offer_data.get('currency', 'USD'),  # USD/EUR/GBP/etc
                'revenue': offer_data.get('revenue'),  # Optional network earn
                'payout_type': offer_data.get('payout_type', 'fixed'),  # fixed/tiered/percentage
                'payout_model': offer_data.get('payout_model', '').strip(),  # NEW: CPA/CPI/CPL/CPS/CPM/RevShare (optional)
                'daily_cap': offer_data.get('daily_cap'),  # Daily conversion limit
                'weekly_cap': offer_data.get('weekly_cap'),  # Weekly conversion limit
                'monthly_cap': offer_data.get('monthly_cap'),  # Monthly conversion limit
                'auto_pause_on_cap': offer_data.get('auto_pause_on_cap', False),  # Auto pause when cap reached
                'cap_alert_emails': offer_data.get('cap_alert_emails', []),  # Email alerts for caps
                
                # SECTION 4: TRACKING SETUP
                'network': offer_data['network'].strip(),
                'partner_id': offer_data.get('partner_id', '').strip(),  # Partner ID for postback
                'target_url': offer_data['target_url'].strip(),
                'preview_url': offer_data.get('preview_url', '').strip(),
                'tracking_domain': offer_data.get('tracking_domain', 'main'),  # main/subdomain
                'tracking_protocol': offer_data.get('tracking_protocol', 'pixel'),  # pixel/s2s/api
                'postback_url': offer_data.get('postback_url', '').strip(),  # Conversion postback URL
                'hash_code': offer_data.get('hash_code', '').strip(),
                'click_expiration': offer_data.get('click_expiration', 7),  # Days
                'conversion_window': offer_data.get('conversion_window', 30),  # Days
                'allowed_traffic_sources': offer_data.get('allowed_traffic_sources', []),  # Allowed sources
                'blocked_traffic_sources': offer_data.get('blocked_traffic_sources', []),  # Blocked sources
                'duplicate_conversion_rule': offer_data.get('duplicate_conversion_rule', 'allow'),  # allow/deny/unique
                
                # SECTION 5: ACCESS & AFFILIATES
                # 🔥 AUTO-SET AFFILIATES TO 'REQUEST' IF APPROVAL REQUIRED
                'affiliates': 'request' if (offer_data.get('require_approval') or offer_data.get('approval_type') in ['time_based', 'manual']) else offer_data.get('affiliates', 'all'),
                'access_type': offer_data.get('access_type', 'public'),  # public/private/request-only
                'selected_users': offer_data.get('selected_users', []),  # Specific affiliate list
                'manager': offer_data.get('manager', '').strip(),  # Campaign manager
                'approval_notes': offer_data.get('approval_notes', '').strip(),  # Access instructions
                
                # SECTION 5.1: APPROVAL WORKFLOW SETTINGS
                'approval_status': offer_data.get('approval_status', 'active'),  # active/pending/paused
                'approval_settings': {
                    'type': offer_data.get('approval_type', 'auto_approve'),  # auto_approve/time_based/manual
                    'auto_approve_delay': offer_data.get('auto_approve_delay', 0),  # minutes for time-based
                    'require_approval': offer_data.get('require_approval', False),  # override for manual
                    'approval_message': offer_data.get('approval_message', '').strip(),  # custom message
                    'max_inactive_days': offer_data.get('max_inactive_days', 30)  # days before auto-lock
                },
                'approved_by': offer_data.get('approved_by', '').strip(),  # admin who approved
                'approval_date': offer_data.get('approval_date'),  # when approved
                
                # SECTION 6: CREATIVES & VISUALS
                'creative_type': offer_data.get('creative_type', 'image'),  # image/html/email
                'image_url': offer_data.get('image_url', '').strip(),
                'thumbnail_url': offer_data.get('thumbnail_url', '').strip(),
                'html_code': offer_data.get('html_code', '').strip(),  # HTML banner code
                'email_template': offer_data.get('email_template', '').strip(),  # Email HTML template
                'email_subject': offer_data.get('email_subject', '').strip(),  # Email subject line
                # Legacy fields (keeping for backward compatibility)
                'banner_codes': offer_data.get('banner_codes', []),  # HTML banner codes
                'email_creative': offer_data.get('email_creative', '').strip(),  # Email template
                'landing_page_variants': offer_data.get('landing_page_variants', []),  # LP variations
                'creative_category': offer_data.get('creative_category', 'banner'),  # banner/email/video
                
                # SECTION 7: SCHEDULE & EXPIRY
                'start_date': offer_data.get('start_date', ''),
                'expiration_date': offer_data.get('expiration_date', ''),
                'auto_expire_action': offer_data.get('auto_expire_action', 'pause'),  # pause/replace/redirect
                'fallback_url': offer_data.get('fallback_url', '').strip(),
                
                # SECTION 8: SMART RULES
                'random_redirect': offer_data.get('random_redirect', False),
                'redirect_urls': offer_data.get('redirect_urls', []),  # Alternate URLs
                'geo_redirect_rules': offer_data.get('geo_redirect_rules', {}),  # Country-specific URLs
                'rotation_enabled': offer_data.get('rotation_enabled', False),
                'leads_filter_enabled': offer_data.get('leads_filter_enabled', False),  # Mustache leads filter
                'rotation_rules': offer_data.get('rotation_rules', {}),  # Advanced rotation settings
                
                # SECTION 9: COMPLIANCE
                'allowed_traffic_types': offer_data.get('allowed_traffic_types', ['email', 'search', 'display']),
                'disallowed_traffic_types': offer_data.get('disallowed_traffic_types', ['adult', 'fraud']),
                'creative_approval_required': offer_data.get('creative_approval_required', False),
                'affiliate_terms': offer_data.get('affiliate_terms', '').strip(),  # Terms and conditions
                'brand_guidelines': offer_data.get('brand_guidelines', '').strip(),  # Brand guidelines
                'terms_notes': offer_data.get('terms_notes', '').strip(),
                
                # SECTION 10: INTEGRATIONS
                'network_partner': offer_data.get('network_partner', '').strip(),  # PepperAds/PepeLeads
                'network_short_description': offer_data.get('network_short_description', '').strip(),  # Brief description
                'external_offer_id': offer_data.get('external_offer_id', '').strip(),
                'sync_frequency': offer_data.get('sync_frequency', 'manual'),  # daily/weekly/manual
                'webhook_template': offer_data.get('webhook_template', '').strip(),  # Postback template
                'webhook_url': offer_data.get('webhook_url', '').strip(),
                
                # SECTION 11: REPORTING & MONITORING
                'hit_limit': offer_data.get('hit_limit'),  # Click limit
                'conversion_goal': offer_data.get('conversion_goal', 'lead'),  # lead/sale/install
                'quality_threshold': offer_data.get('quality_threshold'),  # CR threshold
                'validation_type': offer_data.get('validation_type', 'internal'),  # internal/external
                
                # SECTION 12: PROMO CODE ASSIGNMENT (Admin-assigned)
                'promo_code_id': offer_data.get('promo_code_id'),  # ObjectId of assigned promo code
                'promo_code': offer_data.get('promo_code'),  # Code name (e.g., "SUMMER20")
                'bonus_amount': offer_data.get('bonus_amount'),  # Bonus amount (20 for 20%)
                'bonus_type': offer_data.get('bonus_type'),  # Bonus type (percentage/fixed)
                'promo_code_assigned_at': offer_data.get('promo_code_assigned_at'),  # When assigned
                'promo_code_assigned_by': offer_data.get('promo_code_assigned_by'),  # Admin who assigned
                
                # SYSTEM FIELDS
                'hits': 0,  # Click counter
                'limit': offer_data.get('limit'),  # Overall limit
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Insert offer
            result = self.collection.insert_one(offer_doc)
            offer_doc['_id'] = str(result.inserted_id)
            
            return offer_doc, None
            
        except Exception as e:
            return None, f"Error creating offer: {str(e)}"
    
    def get_offers(self, filters=None, skip=0, limit=20):
        """Get offers with filtering and pagination"""
        if not self._check_db_connection():
            return [], 0
        
        try:
            # Exclude deleted offers by default
            query = {'is_active': True, '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
            
            if filters:
                if filters.get('status'):
                    query['status'] = filters['status']
                if filters.get('network'):
                    query['network'] = {'$regex': filters['network'], '$options': 'i'}
                if filters.get('search'):
                    search_regex = {'$regex': filters['search'], '$options': 'i'}
                    # Need to handle $or properly when search is present
                    query = {
                        '$and': [
                            {'is_active': True},
                            {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
                            {'$or': [
                                {'name': search_regex},
                                {'campaign_id': search_regex},
                                {'offer_id': search_regex}
                            ]}
                        ]
                    }
                    if filters.get('status'):
                        query['$and'].append({'status': filters['status']})
                    if filters.get('network'):
                        query['$and'].append({'network': {'$regex': filters['network'], '$options': 'i'}})
            
            # Get total count
            total = self.collection.count_documents(query)
            
            # Get offers with pagination
            offers = list(self.collection.find(query)
                         .sort('created_at', -1)
                         .skip(skip)
                         .limit(limit))
            
            return offers, total
            
        except Exception as e:
            return [], 0
    
    def clone_offer(self, offer_id, created_by):
        """Clone an existing offer"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Get original offer
            original_offer = self.collection.find_one({'offer_id': offer_id, 'is_active': True})
            if not original_offer:
                return None, "Original offer not found"
            
            # Generate new offer ID
            new_offer_id = self._get_next_offer_id()
            
            # Create cloned offer document
            cloned_offer_doc = {
                'offer_id': new_offer_id,
                'campaign_id': f"{original_offer['campaign_id']}-CLONE",
                'name': f"{original_offer['name']} (Clone)",
                'description': original_offer.get('description', ''),
                'status': 'pending',  # New clones start as pending
                'countries': original_offer.get('countries', []),
                'payout': original_offer['payout'],
                'network': original_offer['network'],
                'short_description': original_offer.get('short_description', ''),
                'affiliates': original_offer.get('affiliates', 'all'),
                'selected_users': original_offer.get('selected_users', []),
                'image_url': original_offer.get('image_url', ''),
                'thumbnail_url': original_offer.get('thumbnail_url', ''),
                'hash_code': original_offer.get('hash_code', ''),
                'hits': 0,  # Reset hits for clone
                'limit': original_offer.get('limit'),
                'target_url': original_offer['target_url'],
                'preview_url': original_offer.get('preview_url', ''),
                'expiration_date': original_offer.get('expiration_date'),
                'device_targeting': original_offer.get('device_targeting', 'all'),
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Insert cloned offer
            result = self.collection.insert_one(cloned_offer_doc)
            cloned_offer_doc['_id'] = str(result.inserted_id)
            
            return cloned_offer_doc, None
            
        except Exception as e:
            return None, f"Error cloning offer: {str(e)}"
    
    def get_offer_by_id(self, offer_id):
        """Get offer by offer_id (ML-00001 format)"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.collection.find_one({'offer_id': offer_id, 'is_active': True})
        except:
            return None
    
    def update_offer(self, offer_id, update_data, updated_by):
        """Update an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate URL if provided
            if 'target_url' in update_data or 'preview_url' in update_data:
                url_pattern = re.compile(
                    r'^https?://'
                    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
                    r'localhost|'
                    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
                    r'(?::\d+)?'
                    r'(?:/?|[/?]\S+)$', re.IGNORECASE)
                
                if 'target_url' in update_data and not url_pattern.match(update_data['target_url']):
                    return False, "Invalid target URL format"
                if 'preview_url' in update_data and update_data['preview_url'] and not url_pattern.match(update_data['preview_url']):
                    return False, "Invalid preview URL format"
            
            # Validate payout if provided
            if 'payout' in update_data:
                try:
                    update_data['payout'] = float(update_data['payout'])
                except (ValueError, TypeError):
                    return False, "Payout must be a valid number"
            
            # Handle vertical field (replaces category)
            if 'vertical' in update_data or 'category' in update_data:
                vertical_input = update_data.get('vertical') or update_data.get('category')
                is_valid, vertical_result = validate_vertical(vertical_input)
                if not is_valid:
                    vertical_value = map_category_to_vertical(vertical_input)
                else:
                    vertical_value = vertical_result
                update_data['vertical'] = vertical_value
                update_data['category'] = vertical_value  # Keep in sync for backward compatibility
            
            # Handle allowed_countries for geo-restriction
            if 'allowed_countries' in update_data:
                allowed_countries = update_data['allowed_countries']
                if isinstance(allowed_countries, str):
                    update_data['allowed_countries'] = [c.strip().upper() for c in allowed_countries.split(',') if c.strip()]
            
            # Handle revenue_share_percent and payout_type, recalculate incentive_type
            if 'revenue_share_percent' in update_data or 'payout' in update_data or 'payout_type' in update_data:
                # Get current offer to check existing values
                current_offer = self.collection.find_one({'offer_id': offer_id, 'is_active': True})
                
                # Get payout_type (from update or current offer)
                payout_type = update_data.get('payout_type')
                if payout_type is None and current_offer:
                    payout_type = current_offer.get('payout_type', 'fixed')
                
                # Get revenue_share_percent (from update or current offer)
                revenue_share_percent = update_data.get('revenue_share_percent')
                if revenue_share_percent is None and current_offer:
                    revenue_share_percent = current_offer.get('revenue_share_percent', 0)
                
                if revenue_share_percent is not None:
                    revenue_share_percent_float = float(revenue_share_percent or 0)
                    
                    # Validate revenue_share_percent is between 0 and 100
                    if revenue_share_percent_float < 0 or revenue_share_percent_float > 100:
                        return False, "Revenue share percent must be between 0 and 100"
                    
                    update_data['revenue_share_percent'] = revenue_share_percent_float
                
                # Recalculate incentive_type based on payout_type
                update_data['incentive_type'] = calculate_incentive_type(payout_type, revenue_share_percent)
            
            update_data['updated_at'] = datetime.utcnow()
            update_data['updated_by'] = updated_by
            
            result = self.collection.update_one(
                {'offer_id': offer_id, 'is_active': True},
                {'$set': update_data}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            return False, f"Error updating offer: {str(e)}"
    
    def delete_offer(self, offer_id):
        """Soft delete an offer - moves to recycle bin"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id},
                {
                    '$set': {
                        'is_active': False,
                        'deleted': True,
                        'deleted_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except:
            return False
    
    def restore_offer(self, offer_id):
        """Restore a soft-deleted offer from recycle bin"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id, 'deleted': True},
                {
                    '$set': {
                        'is_active': True,
                        'deleted': False,
                        'deleted_at': None,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except:
            return False
    
    def permanent_delete_offer(self, offer_id):
        """Permanently delete an offer from database"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.delete_one({'offer_id': offer_id})
            return result.deleted_count > 0
        except:
            return False
    
    def get_deleted_offers(self, page=1, per_page=20, search=None):
        """Get all soft-deleted offers (recycle bin)"""
        if not self._check_db_connection():
            return [], 0
        
        try:
            query = {'deleted': True}
            
            if search:
                query['$or'] = [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'offer_id': {'$regex': search, '$options': 'i'}},
                    {'campaign_id': {'$regex': search, '$options': 'i'}}
                ]
            
            total = self.collection.count_documents(query)
            
            offers = list(self.collection.find(query)
                .sort('deleted_at', -1)
                .skip((page - 1) * per_page)
                .limit(per_page))
            
            # Convert ObjectId to string
            for offer in offers:
                offer['_id'] = str(offer['_id'])
            
            return offers, total
        except Exception as e:
            import logging
            logging.error(f"Error getting deleted offers: {str(e)}")
            return [], 0
    
    def empty_recycle_bin(self):
        """Permanently delete all offers in recycle bin"""
        if not self._check_db_connection():
            return 0
        
        try:
            result = self.collection.delete_many({'deleted': True})
            return result.deleted_count
        except:
            return 0
    
    def increment_hits(self, offer_id):
        """Increment hit count for an offer"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id, 'is_active': True},
                {'$inc': {'hits': 1}}
            )
            return result.modified_count > 0
        except:
            return False
    
    def get_offer_settings(self, offer_id):
        """Get advanced settings for an offer"""
        if not self._check_db_connection():
            return None
        
        try:
            # Get settings from offer_settings collection
            settings = self.settings_collection.find_one({'offer_id': offer_id})
            
            if settings:
                # Remove MongoDB _id field
                settings.pop('_id', None)
                settings.pop('offer_id', None)
                return settings
            
            return None
            
        except Exception as e:
            import logging
            logging.error(f"Error getting offer settings: {str(e)}")
            return None
    
    def update_offer_settings(self, offer_id, settings):
        """Update advanced settings for an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate offer exists
            offer = self.collection.find_one({'offer_id': offer_id})
            if not offer:
                return False, "Offer not found"
            
            # Prepare settings document
            settings_doc = {
                'offer_id': offer_id,
                'updated_at': datetime.utcnow(),
                **settings
            }
            
            # Upsert settings (update if exists, insert if not)
            result = self.settings_collection.update_one(
                {'offer_id': offer_id},
                {'$set': settings_doc},
                upsert=True
            )
            
            return True, None
            
        except Exception as e:
            import logging
            logging.error(f"Error updating offer settings: {str(e)}")
            return False, f"Error updating offer settings: {str(e)}"
    
    def update_approval_status(self, offer_id, status, approved_by=None, notes=None):
        """Update approval status of an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            update_data = {
                'approval_status': status,
                'updated_at': datetime.utcnow()
            }
            
            if approved_by:
                update_data['approved_by'] = approved_by
                update_data['approval_date'] = datetime.utcnow()
            
            if notes:
                update_data['approval_notes'] = notes
            
            result = self.collection.update_one(
                {'offer_id': offer_id, 'is_active': True},
                {'$set': update_data}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            import logging
            logging.error(f"Error updating approval status: {str(e)}")
            return False, f"Error updating approval status: {str(e)}"
    
    def check_and_lock_inactive_offers(self):
        """Check for offers that should be auto-locked due to inactivity"""
        if not self._check_db_connection():
            return []
        
        try:
            from bson import ObjectId
            
            # Get all approved offers with auto-lock settings
            pipeline = [
                {
                    '$match': {
                        'is_active': True,
                        'approval_status': 'active',
                        'approval_settings.max_inactive_days': {'$exists': True, '$gt': 0}
                    }
                }
            ]
            
            offers_to_check = list(self.collection.aggregate(pipeline))
            locked_offers = []
            
            # Get access requests collection for checking last activity
            access_requests_collection = db_instance.get_collection('affiliate_requests')
            
            for offer in offers_to_check:
                max_inactive_days = offer.get('approval_settings', {}).get('max_inactive_days', 30)
                cutoff_date = datetime.utcnow() - timedelta(days=max_inactive_days)
                
                # Check if there's any recent activity (approved requests)
                recent_activity = access_requests_collection.find_one({
                    'offer_id': offer['offer_id'],
                    'status': 'approved',
                    'approved_at': {'$gte': cutoff_date}
                })
                
                # If no recent activity, lock the offer
                if not recent_activity:
                    # Update offer to locked status
                    self.collection.update_one(
                        {'offer_id': offer['offer_id']},
                        {
                            '$set': {
                                'approval_status': 'locked',
                                'locked_at': datetime.utcnow(),
                                'lock_reason': f'Auto-locked due to {max_inactive_days} days of inactivity',
                                'updated_at': datetime.utcnow()
                            }
                        }
                    )
                    
                    locked_offers.append({
                        'offer_id': offer['offer_id'],
                        'name': offer.get('name'),
                        'locked_reason': f'Auto-locked due to {max_inactive_days} days of inactivity'
                    })
            
            return locked_offers
            
        except Exception as e:
            import logging
            logging.error(f"Error checking inactive offers: {str(e)}")
            return []
