import random
from datetime import datetime, timedelta


class OffersService:
    """Service to provide dynamic offers for offerwalls"""
    
    def __init__(self):
        self.mock_offers = [
            {
                'id': 'SURVEY_001',
                'title': 'Complete Market Research Survey',
                'description': 'Share your opinion on consumer products and earn rewards',
                'reward_amount': 150,
                'reward_currency': 'points',
                'category': 'survey',
                'difficulty': 'easy',
                'estimated_time': '5-10 minutes',
                'image_url': 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Survey',
                'click_url': 'https://example.com/survey/001',
                'requirements': ['Age 18+', 'US residents only'],
                'conversion_rate': 0.85
            },
            {
                'id': 'APP_002',
                'title': 'Download & Play Mobile Game',
                'description': 'Install the new puzzle game and reach level 10',
                'reward_amount': 300,
                'reward_currency': 'coins',
                'category': 'app_install',
                'difficulty': 'medium',
                'estimated_time': '15-30 minutes',
                'image_url': 'https://via.placeholder.com/300x200/10B981/FFFFFF?text=Game',
                'click_url': 'https://example.com/app/002',
                'requirements': ['iOS/Android device', 'Reach level 10'],
                'conversion_rate': 0.65
            },
            {
                'id': 'SIGNUP_003',
                'title': 'Sign Up for Premium Service',
                'description': 'Create account and verify email for streaming service',
                'reward_amount': 500,
                'reward_currency': 'cash',
                'category': 'signup',
                'difficulty': 'easy',
                'estimated_time': '3-5 minutes',
                'image_url': 'https://via.placeholder.com/300x200/F59E0B/FFFFFF?text=Signup',
                'click_url': 'https://example.com/signup/003',
                'requirements': ['Valid email address', 'Credit card for verification'],
                'conversion_rate': 0.45
            },
            {
                'id': 'QUIZ_004',
                'title': 'Take Knowledge Quiz',
                'description': 'Test your knowledge on various topics and win prizes',
                'reward_amount': 100,
                'reward_currency': 'points',
                'category': 'quiz',
                'difficulty': 'easy',
                'estimated_time': '5 minutes',
                'image_url': 'https://via.placeholder.com/300x200/8B5CF6/FFFFFF?text=Quiz',
                'click_url': 'https://example.com/quiz/004',
                'requirements': ['No special requirements'],
                'conversion_rate': 0.75
            },
            {
                'id': 'SHOPPING_005',
                'title': 'Make Your First Purchase',
                'description': 'Shop at our partner store and get cashback rewards',
                'reward_amount': 1000,
                'reward_currency': 'cashback',
                'category': 'shopping',
                'difficulty': 'medium',
                'estimated_time': '10-20 minutes',
                'image_url': 'https://via.placeholder.com/300x200/EF4444/FFFFFF?text=Shop',
                'click_url': 'https://example.com/shop/005',
                'requirements': ['Minimum $25 purchase', 'New customers only'],
                'conversion_rate': 0.35
            },
            {
                'id': 'VIDEO_006',
                'title': 'Watch Product Demo Video',
                'description': 'Watch a 3-minute product demonstration video',
                'reward_amount': 50,
                'reward_currency': 'points',
                'category': 'video',
                'difficulty': 'easy',
                'estimated_time': '3 minutes',
                'image_url': 'https://via.placeholder.com/300x200/06B6D4/FFFFFF?text=Video',
                'click_url': 'https://example.com/video/006',
                'requirements': ['Watch full video'],
                'conversion_rate': 0.90
            },
            {
                'id': 'TRIAL_007',
                'title': 'Start Free Trial',
                'description': 'Begin 7-day free trial of productivity software',
                'reward_amount': 750,
                'reward_currency': 'credits',
                'category': 'trial',
                'difficulty': 'medium',
                'estimated_time': '5-10 minutes',
                'image_url': 'https://via.placeholder.com/300x200/84CC16/FFFFFF?text=Trial',
                'click_url': 'https://example.com/trial/007',
                'requirements': ['Valid payment method', 'Cancel anytime'],
                'conversion_rate': 0.55
            },
            {
                'id': 'NEWSLETTER_008',
                'title': 'Subscribe to Newsletter',
                'description': 'Get weekly deals and tips delivered to your inbox',
                'reward_amount': 25,
                'reward_currency': 'points',
                'category': 'newsletter',
                'difficulty': 'easy',
                'estimated_time': '1 minute',
                'image_url': 'https://via.placeholder.com/300x200/F97316/FFFFFF?text=News',
                'click_url': 'https://example.com/newsletter/008',
                'requirements': ['Valid email address'],
                'conversion_rate': 0.95
            }
        ]
    
    def get_offers(self, placement_id, user_id, limit=10, category=None, min_reward=None):
        """Get dynamic offers for a placement"""
        
        # Filter offers based on criteria
        filtered_offers = self.mock_offers.copy()
        
        if category:
            filtered_offers = [offer for offer in filtered_offers if offer['category'] == category]
        
        if min_reward:
            filtered_offers = [offer for offer in filtered_offers if offer['reward_amount'] >= min_reward]
        
        # Randomize order to simulate dynamic content
        random.shuffle(filtered_offers)
        
        # Limit results
        offers = filtered_offers[:limit]
        
        # Add dynamic elements
        for offer in offers:
            # Add placement-specific tracking parameters
            offer['tracking_params'] = {
                'placement_id': placement_id,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Simulate dynamic pricing (±20% variation)
            base_reward = offer['reward_amount']
            variation = random.uniform(0.8, 1.2)
            offer['reward_amount'] = int(base_reward * variation)
            
            # Add urgency elements
            if random.random() < 0.3:  # 30% chance
                offer['urgency'] = {
                    'type': 'limited_time',
                    'message': f'Limited time: {random.randint(2, 24)} hours left!',
                    'expires_at': (datetime.utcnow() + timedelta(hours=random.randint(2, 24))).isoformat()
                }
            elif random.random() < 0.2:  # 20% chance
                offer['urgency'] = {
                    'type': 'limited_spots',
                    'message': f'Only {random.randint(5, 50)} spots remaining!',
                    'spots_left': random.randint(5, 50)
                }
        
        return {
            'offers': offers,
            'total_count': len(offers),
            'placement_id': placement_id,
            'user_id': user_id,
            'generated_at': datetime.utcnow().isoformat()
        }
    
    def get_offer_by_id(self, offer_id):
        """Get specific offer by ID"""
        for offer in self.mock_offers:
            if offer['id'] == offer_id:
                return offer
        return None
    
    def get_categories(self):
        """Get available offer categories"""
        categories = list(set(offer['category'] for offer in self.mock_offers))
        return sorted(categories)
