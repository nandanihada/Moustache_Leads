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
    
    # IPQualityScore API key for referral fraud detection
    IPQUALITYSCORE_API_KEY = os.getenv('IPQUALITYSCORE_API_KEY', '')

    # Groq API key for AI-powered offer name extraction
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

    # fal.ai API key for AI image generation
    FAL_API_KEY = os.getenv('FAL_API_KEY', '')
