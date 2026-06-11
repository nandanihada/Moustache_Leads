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
        # Check for comma-separated list first
        multi_keys = os.getenv('GROQ_API_KEYS', '')
        if multi_keys:
            keys = [k.strip() for k in multi_keys.split(',') if k.strip()]
        # Always include the single key if set and not already in list
        single_key = os.getenv('GROQ_API_KEY', '')
        if single_key and single_key not in keys:
            keys.append(single_key)
        return keys

    # fal.ai API key for AI image generation
    FAL_API_KEY = os.getenv('FAL_API_KEY', '')
