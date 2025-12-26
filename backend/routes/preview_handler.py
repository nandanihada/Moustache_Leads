"""
Preview URL Handler with Timed Redirect
Shows a preview page with countdown before redirecting to non-access URL
"""

from flask import Blueprint, render_template_string, request, redirect
from models.offer import Offer
from services.geo_restriction_service import get_geo_restriction_service
import logging

logger = logging.getLogger(__name__)

preview_bp = Blueprint('preview', __name__)
offer_model = Offer()
geo_restriction_service = get_geo_restriction_service()


@preview_bp.route('/preview/<offer_id>')
def show_preview(offer_id):
    """
    Show preview page with 8-second countdown timer
    Then redirect to non-access URL or target URL based on geo-restrictions
    """
    
    try:
        # Get user's IP address
        user_ip = request.remote_addr
        if request.headers.get('X-Forwarded-For'):
            user_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        
        # Get the offer
        offer = offer_model.get_offer_by_id(offer_id)
        if not offer:
            logger.warning(f"❌ Offer {offer_id} not found for preview")
            return "Offer not found", 404
        
        # Check country-based access restrictions
        user_context = {
            'subid': request.args.get('subid', 'preview'),
            'source': 'preview',
            'user_agent': request.headers.get('User-Agent', ''),
            'referrer': request.headers.get('Referer', '')
        }
        
        access_check = geo_restriction_service.check_country_access(
            offer=offer,
            user_ip=user_ip,
            user_context=user_context
        )
        
        # Determine redirect URL based on geo-restriction
        if access_check['allowed']:
            # Country allowed - redirect to target URL
            redirect_url = offer.get('target_url', 'https://www.google.com')
            access_status = "allowed"
            country_message = f"Access granted from {access_check['country_name']} ({access_check['country_code']})"
        else:
            # Country blocked - redirect to non-access URL
            redirect_url = access_check['redirect_url'] or offer.get('non_access_url', 'https://www.example.com')
            access_status = "denied"
            country_message = f"Access restricted from {access_check['country_name']} ({access_check['country_code']})"
        
        logger.info(f"🔍 Preview for {offer_id}: {access_status} - {country_message}")
        
        # Render preview page with countdown
        return render_preview_page(
            offer=offer,
            redirect_url=redirect_url,
            access_status=access_status,
            country_message=country_message,
            countdown_seconds=8
        )
        
    except Exception as e:
        logger.error(f"Preview error for {offer_id}: {str(e)}", exc_info=True)
        return f"Error loading preview: {str(e)}", 500


def render_preview_page(offer, redirect_url, access_status, country_message, countdown_seconds=8):
    """Render preview page with countdown timer"""
    
    preview_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{ offer_name }} - Preview</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .preview-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 100%;
                padding: 50px 40px;
                text-align: center;
                animation: slideIn 0.5s ease-out;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .preview-icon {
                font-size: 80px;
                margin-bottom: 20px;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
            
            .preview-title {
                font-size: 32px;
                color: #2c3e50;
                margin-bottom: 15px;
                font-weight: bold;
            }
            
            .preview-description {
                font-size: 18px;
                color: #7f8c8d;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            
            .offer-info {
                background: #f8f9fa;
                padding: 25px;
                border-radius: 15px;
                margin-bottom: 30px;
            }
            
            .offer-name {
                font-size: 24px;
                color: #34495e;
                font-weight: bold;
                margin-bottom: 10px;
            }
            
            .offer-id {
                font-family: monospace;
                background: #ecf0f1;
                padding: 8px 15px;
                border-radius: 5px;
                font-size: 14px;
                color: #555;
                display: inline-block;
                margin-bottom: 15px;
            }
            
            .country-status {
                padding: 12px 20px;
                border-radius: 10px;
                font-size: 16px;
                margin-top: 15px;
            }
            
            .country-status.allowed {
                background: #d4edda;
                color: #155724;
                border: 2px solid #c3e6cb;
            }
            
            .country-status.denied {
                background: #f8d7da;
                color: #721c24;
                border: 2px solid #f5c6cb;
            }
            
            .countdown-container {
                margin: 40px 0;
            }
            
            .countdown-label {
                font-size: 18px;
                color: #7f8c8d;
                margin-bottom: 15px;
            }
            
            .countdown-timer {
                font-size: 72px;
                font-weight: bold;
                color: #667eea;
                margin: 20px 0;
                font-family: 'Courier New', monospace;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            }
            
            .progress-bar-container {
                width: 100%;
                height: 8px;
                background: #ecf0f1;
                border-radius: 10px;
                overflow: hidden;
                margin-top: 20px;
            }
            
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
                transition: width 0.1s linear;
                animation: progress {{ countdown_seconds }}s linear;
            }
            
            @keyframes progress {
                from {
                    width: 100%;
                }
                to {
                    width: 0%;
                }
            }
            
            .redirect-info {
                font-size: 14px;
                color: #95a5a6;
                margin-top: 20px;
            }
            
            .skip-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 15px 40px;
                border-radius: 30px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 20px;
                transition: transform 0.2s, box-shadow 0.2s;
                text-decoration: none;
                display: inline-block;
            }
            
            .skip-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
            }
            
            .skip-button:active {
                transform: translateY(0);
            }
            
            @media (max-width: 600px) {
                .preview-container {
                    padding: 30px 20px;
                }
                
                .preview-title {
                    font-size: 24px;
                }
                
                .countdown-timer {
                    font-size: 56px;
                }
                
                .offer-name {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="preview-container">
            <div class="preview-icon">⏱️</div>
            <h1 class="preview-title">Offer Preview</h1>
            <p class="preview-description">
                You're about to be redirected to this offer
            </p>
            
            <div class="offer-info">
                <div class="offer-name">{{ offer_name }}</div>
                <div class="offer-id">Offer ID: {{ offer_id }}</div>
                
                <div class="country-status {{ access_status }}">
                    {{ country_message }}
                </div>
            </div>
            
            <div class="countdown-container">
                <div class="countdown-label">Redirecting in</div>
                <div class="countdown-timer" id="countdown">{{ countdown_seconds }}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
            </div>
            
            <a href="{{ redirect_url }}" class="skip-button" id="skipButton">
                Skip Wait & Continue →
            </a>
            
            <div class="redirect-info">
                {% if access_status == 'allowed' %}
                    ✅ You will be redirected to the offer page
                {% else %}
                    ℹ️ You will be redirected to an alternative page
                {% endif %}
            </div>
        </div>
        
        <script>
            // Countdown timer
            let timeLeft = {{ countdown_seconds }};
            const countdownElement = document.getElementById('countdown');
            const redirectUrl = "{{ redirect_url }}";
            
            // Update countdown every second
            const countdownInterval = setInterval(() => {
                timeLeft--;
                countdownElement.textContent = timeLeft;
                
                // Add pulse animation
                countdownElement.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    countdownElement.style.transform = 'scale(1)';
                }, 100);
                
                // Redirect when countdown reaches 0
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    window.location.href = redirectUrl;
                }
            }, 1000);
            
            // Allow manual skip
            document.getElementById('skipButton').addEventListener('click', (e) => {
                clearInterval(countdownInterval);
            });
        </script>
    </body>
    </html>
    """
    
    return render_template_string(
        preview_template,
        offer_name=offer.get('name', 'Unknown Offer'),
        offer_id=offer.get('offer_id', 'N/A'),
        redirect_url=redirect_url,
        access_status=access_status,
        country_message=country_message,
        countdown_seconds=countdown_seconds
    )
