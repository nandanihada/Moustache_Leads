"""
Preview URL Handler with Timed Redirect
Shows preview_url in iframe with countdown before redirecting to YouTube
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
    Show preview page with the offer's preview_url loaded
    Then redirect to YouTube after 8 seconds
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
        
        # Get preview URL from offer (defaults to google.com if not set)
        preview_url = offer.get('preview_url', 'https://www.google.com')
        
        # Always redirect to YouTube after 8 seconds
        redirect_url = 'https://www.youtube.com'
        
        # Check country-based access restrictions (for display purposes)
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
        
        if access_check['allowed']:
            # Country allowed
            access_status = "allowed"
            country_message = f"Access granted from {access_check['country_name']} ({access_check['country_code']})"
        else:
            # Country blocked
            access_status = "denied"
            country_message = f"Access restricted from {access_check['country_name']} ({access_check['country_code']})"
        
        logger.info(f"🔍 Preview for {offer_id}: Loading {preview_url}, will redirect to YouTube in 8s")
        
        # Render preview page with the actual preview_url loaded
        return render_preview_page(
            offer=offer,
            preview_url=preview_url,
            redirect_url=redirect_url,
            access_status=access_status,
            country_message=country_message,
            countdown_seconds=8
        )
        
    except Exception as e:
        logger.error(f"Preview error for {offer_id}: {str(e)}", exc_info=True)
        return f"Error loading preview: {str(e)}", 500



def render_preview_page(offer, preview_url, redirect_url, access_status, country_message, countdown_seconds=8):
    """Render preview page with the preview_url loaded in iframe and countdown timer"""
    
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
                background: #000;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            
            /* Top banner with countdown */
            .countdown-banner {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                position: relative;
                z-index: 1000;
            }
            
            .banner-left {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .offer-info-compact {
                display: flex;
                flex-direction: column;
            }
            
            .offer-name-small {
                font-size: 16px;
                font-weight: bold;
            }
            
            .offer-id-small {
                font-size: 12px;
                opacity: 0.9;
            }
            
            .banner-center {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .countdown-label-small {
                font-size: 14px;
                opacity: 0.9;
            }
            
            .countdown-timer-small {
                font-size: 32px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                min-width: 50px;
                text-align: center;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
            
            .skip-button-small {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 2px solid white;
                padding: 8px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
                text-decoration: none;
                white-space: nowrap;
            }
            
            .skip-button-small:hover {
                background: white;
                color: #667eea;
            }
            
            /* Progress bar */
            .progress-bar-container {
                width: 100%;
                height: 4px;
                background: rgba(255, 255, 255, 0.3);
                position: absolute;
                bottom: 0;
                left: 0;
            }
            
            .progress-bar {
                height: 100%;
                background: white;
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
            
            /* Preview iframe container */
            .preview-container {
                flex: 1;
                width: 100%;
                height: calc(100vh - 70px);
                position: relative;
            }
            
            .preview-iframe {
                width: 100%;
                height: 100%;
                border: none;
            }
            
            /* Loading overlay */
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                z-index: 999;
            }
            
            .loading-overlay.hidden {
                display: none;
            }
            
            .spinner {
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .countdown-banner {
                    flex-direction: column;
                    gap: 10px;
                    padding: 10px;
                }
                
                .banner-center {
                    width: 100%;
                    justify-content: space-between;
                }
                
                .offer-name-small {
                    font-size: 14px;
                }
                
                .countdown-timer-small {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <!-- Top countdown banner -->
        <div class="countdown-banner">
            <div class="banner-left">
                <div class="offer-info-compact">
                    <div class="offer-name-small">{{ offer_name }}</div>
                    <div class="offer-id-small">{{ offer_id }}</div>
                </div>
            </div>
            
            <div class="banner-center">
                <span class="countdown-label-small">Redirecting in</span>
                <div class="countdown-timer-small" id="countdown">{{ countdown_seconds }}</div>
                <a href="{{ redirect_url }}" class="skip-button-small" id="skipButton">
                    Skip →
                </a>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
        </div>
        
        <!-- Preview content -->
        <div class="preview-container">
            <div class="loading-overlay" id="loadingOverlay">
                <div style="text-align: center;">
                    <div class="spinner"></div>
                    <div>Loading preview...</div>
                </div>
            </div>
            <iframe 
                id="previewFrame"
                class="preview-iframe" 
                src="{{ preview_url }}"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                onload="document.getElementById('loadingOverlay').classList.add('hidden')"
            ></iframe>
        </div>
        
        <script>
            // Countdown timer
            let timeLeft = {{ countdown_seconds }};
            const countdownElement = document.getElementById('countdown');
            const redirectUrl = "{{ redirect_url }}";
            
            console.log('Preview page loaded');
            console.log('Initial timeLeft:', timeLeft);
            console.log('Redirect URL:', redirectUrl);
            
            // Update countdown every second
            const countdownInterval = setInterval(() => {
                timeLeft--;
                countdownElement.textContent = timeLeft;
                console.log('Countdown:', timeLeft);
                
                // Redirect when countdown reaches 0
                if (timeLeft <= 0) {
                    console.log('Redirecting to:', redirectUrl);
                    clearInterval(countdownInterval);
                    window.location.href = redirectUrl;
                }
            }, 1000);
            
            // Allow manual skip
            document.getElementById('skipButton').addEventListener('click', (e) => {
                console.log('Skip button clicked');
                clearInterval(countdownInterval);
                // Let the link handle the redirect
            });
            
            // Hide loading overlay after 5 seconds even if iframe doesn't load
            setTimeout(() => {
                document.getElementById('loadingOverlay').classList.add('hidden');
            }, 5000);
        </script>
    </body>
    </html>
    """
    
    return render_template_string(
        preview_template,
        offer_name=offer.get('name', 'Unknown Offer'),
        offer_id=offer.get('offer_id', 'N/A'),
        preview_url=preview_url,
        redirect_url=redirect_url,
        access_status=access_status,
        country_message=country_message,
        countdown_seconds=countdown_seconds
    )
