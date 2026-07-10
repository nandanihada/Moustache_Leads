import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGODB_URI = os.getenv('MONGODB_URI')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    PORT = int(os.getenv('PORT', 5000))
    
    # Database name
    DATABASE_NAME = 'ascend_db'
    
    # JWT token expiration (in seconds)
    JWT_EXPIRATION_DELTA = 86400  # 24 hours
    
    # Tracking URL base - uses offers subdomain in production
    TRACKING_BASE_URL = os.getenv('TRACKING_BASE_URL', 'https://offers.moustacheleads.com')
    
    # Admin impersonation secret (must match to allow login-as-user)
    ADMIN_IMPERSONATE_SECRET = os.getenv('ADMIN_IMPERSONATE_SECRET', '')

    # IPQualityScore API key for referral fraud detection
    IPQUALITYSCORE_API_KEY = os.getenv('IPQUALITYSCORE_API_KEY', '')

    # Groq API key for AI-powered offer name extraction
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
    
    # Multiple Groq API keys (comma-separated) for rotation on rate limits
    # Falls back to single GROQ_API_KEY if not set
    @staticmethod
    def get_groq_api_keys():
        """Return list of all configured Groq API keys for rotation."""
        keys = []
        # Check for comma-separated list in GROQ_API_KEYS first
        multi_keys = os.getenv('GROQ_API_KEYS', '')
        if multi_keys:
            keys = [k.strip() for k in multi_keys.split(',') if k.strip()]
        # Also split GROQ_API_KEY by comma (in case it contains a list)
        single_key = os.getenv('GROQ_API_KEY', '')
        if single_key:
            for k in single_key.split(','):
                k = k.strip()
                if k and k not in keys:
                    keys.append(k)
        return keys

    # fal.ai API key for AI image generation
    FAL_API_KEY = os.getenv('FAL_API_KEY', '')

    # PayPal Configuration
    PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID', 'sb')
    PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET', '')
    PAYPAL_MODE = os.getenv('PAYPAL_MODE', 'sandbox')

    # Geekflare API (link health checking)
    GEEKFLARE_API_KEY = os.getenv('GEEKFLARE_API_KEY', '')

