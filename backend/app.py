from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from database import db_instance
import logging
from datetime import datetime
from flask.json.provider import DefaultJSONProvider

# Import partner postback service to ensure it's available
try:
    from services.partner_postback_service import partner_postback_service
    logging.info("✅ Partner postback service imported successfully at startup")
except Exception as e:
    logging.error(f"❌ Failed to import partner_postback_service: {str(e)}")
    partner_postback_service = None

# Import routes with error handling
def safe_import_blueprint(module_path, blueprint_name):
    """Safely import blueprint with error handling"""
    try:
        module = __import__(module_path, fromlist=[blueprint_name])
        return getattr(module, blueprint_name)
    except Exception as e:
        logging.error(f"Failed to import {blueprint_name} from {module_path}: {str(e)}")
        return None

# Import all blueprints
auth_bp = safe_import_blueprint('routes.auth', 'auth_bp')
placements_bp = safe_import_blueprint('routes.placements', 'placements_bp')
offerwall_bp = safe_import_blueprint('routes.offerwall', 'offerwall_bp')
admin_offers_bp = safe_import_blueprint('routes.admin_offers', 'admin_offers_bp')
schedule_rules_bp = safe_import_blueprint('routes.offer_schedule_rules', 'schedule_rules_bp')
click_handler_bp = safe_import_blueprint('routes.offer_click_handler', 'click_handler_bp')
link_masking_bp = safe_import_blueprint('routes.link_masking', 'link_masking_bp')
link_redirect_bp = safe_import_blueprint('routes.link_masking', 'link_redirect_bp')
analytics_bp = safe_import_blueprint('routes.analytics', 'analytics_bp')
offer_serving_bp = safe_import_blueprint('routes.offer_serving', 'offer_serving_bp')
file_upload_bp = safe_import_blueprint('routes.file_upload', 'file_upload_bp')
partners_bp = safe_import_blueprint('routes.partners', 'partners_bp')
postback_logs_bp = safe_import_blueprint('routes.postback_logs', 'postback_logs_bp')
postback_receiver_bp = safe_import_blueprint('routes.postback_receiver', 'postback_receiver_bp')
tracking_api_bp = safe_import_blueprint('routes.tracking_api', 'tracking_api_bp')
reports_api_bp = safe_import_blueprint('routes.reports_api', 'reports_api_bp')
tracking_click_bp = safe_import_blueprint('routes.tracking_click_handler', 'tracking_click_bp')
partner_profile_bp = safe_import_blueprint('routes.partner_profile', 'partner_profile_bp')
partner_postback_logs_bp = safe_import_blueprint('routes.partner_postback_logs', 'partner_postback_logs_bp')
diagnostic_bp = safe_import_blueprint('routes.diagnostic', 'diagnostic_bp')
user_reports_bp = safe_import_blueprint('routes.user_reports', 'user_reports_bp')
simple_tracking_bp = safe_import_blueprint('routes.simple_tracking', 'simple_tracking_bp')
publisher_offers_bp = safe_import_blueprint('routes.publisher_offers', 'publisher_offers_bp')
test_postback_bp = safe_import_blueprint('routes.test_postback', 'test_postback_bp')
admin_publishers_simple_bp = safe_import_blueprint('routes.admin_publishers_simple', 'admin_publishers_simple_bp')
admin_offer_requests_bp = safe_import_blueprint('routes.admin_offer_requests', 'admin_offer_requests_bp')
publisher_settings_bp = safe_import_blueprint('routes.publisher_settings', 'publisher_settings_bp')
admin_promo_codes_bp = safe_import_blueprint('routes.admin_promo_codes', 'admin_promo_codes_bp')
publisher_promo_codes_bp = safe_import_blueprint('routes.publisher_promo_codes', 'publisher_promo_codes_bp')
publisher_promo_codes_mgmt_bp = safe_import_blueprint('routes.publisher_promo_codes_management', 'publisher_promo_codes_mgmt_bp')
bonus_management_bp = safe_import_blueprint('routes.bonus_management', 'bonus_management_bp')
admin_offerwall_analytics_bp = safe_import_blueprint('routes.admin_offerwall_analytics', 'admin_offerwall_analytics_bp')
user_offerwall_rewards_bp = safe_import_blueprint('routes.user_offerwall_rewards', 'user_offerwall_rewards_bp')
comprehensive_analytics_bp = safe_import_blueprint('routes.comprehensive_analytics', 'comprehensive_analytics_bp')
login_logs_bp = safe_import_blueprint('routes.login_logs', 'login_logs_bp')
admin_subadmin_management_bp = safe_import_blueprint('routes.admin_subadmin_management', 'admin_subadmin_management_bp')
gift_cards_bp = safe_import_blueprint('routes.gift_cards', 'gift_cards_bp')
forwarded_postbacks_bp = safe_import_blueprint('routes.forwarded_postbacks', 'forwarded_postbacks_bp')
setup_bp = safe_import_blueprint('routes.setup', 'setup_bp')
user_dashboard_bp = safe_import_blueprint('routes.user_dashboard', 'user_dashboard_bp')
payout_settings_bp = safe_import_blueprint('routes.payout_settings', 'payout_settings_bp')
admin_geo_restriction_bp = safe_import_blueprint('routes.admin_geo_restrictions', 'admin_geo_restriction_bp')
preview_bp = safe_import_blueprint('routes.preview_handler', 'preview_bp')
fix_incentives_bp = safe_import_blueprint('routes.fix_incentives', 'fix_incentives_bp')
traffic_sources_bp = safe_import_blueprint('routes.traffic_sources', 'traffic_sources_bp')
advertiser_auth_bp = safe_import_blueprint('routes.advertiser_auth', 'advertiser_auth_bp')
publisher_auth_bp = safe_import_blueprint('routes.publisher_auth', 'publisher_auth_bp')
admin_advertisers_bp = safe_import_blueprint('routes.admin_advertisers', 'admin_advertisers_bp')


# Custom JSON provider to handle datetime serialization with UTC 'Z' suffix
class CustomJSONProvider(DefaultJSONProvider):
    """Custom JSON provider that adds 'Z' suffix to UTC datetime strings"""
    def default(self, obj):
        if isinstance(obj, datetime):
            # Convert datetime to ISO format with 'Z' suffix for UTC
            return obj.isoformat() + 'Z'
        return super().default(obj)

# Define blueprints with their URL prefixes
blueprints = [
    (auth_bp, '/api/auth'),
    (placements_bp, '/api/placements'),
    (offerwall_bp, ''),
    (admin_offers_bp, '/api/admin'),
    (schedule_rules_bp, '/api/admin'),
    (click_handler_bp, '/api'),
    (link_masking_bp, '/api/masking'),
    (link_redirect_bp, ''),
    (analytics_bp, '/api/analytics'),
    (user_reports_bp, '/api'),
    (offer_serving_bp, ''),
    (file_upload_bp, '/api'),
    (partners_bp, '/api/admin'),
    (postback_logs_bp, '/api/admin'),
    (postback_receiver_bp, ''),
    (tracking_api_bp, '/api'),
    (reports_api_bp, '/api/admin'),
    (tracking_click_bp, ''),
    (partner_profile_bp, '/api'),
    (partner_postback_logs_bp, ''),
    (diagnostic_bp, ''),
    (simple_tracking_bp, ''),
    (setup_bp, ''),
    (publisher_offers_bp, '/api/publisher'),
    (admin_publishers_simple_bp, '/api/admin'),
    (admin_offer_requests_bp, '/api/admin'),
    (publisher_settings_bp, ''),
    (admin_promo_codes_bp, ''),
    (publisher_promo_codes_bp, ''),
    (publisher_promo_codes_mgmt_bp, ''),
    (bonus_management_bp, ''),
    (admin_offerwall_analytics_bp, ''),
    (user_offerwall_rewards_bp, ''),
    (comprehensive_analytics_bp, ''),
    (login_logs_bp, '/api/admin'),
    (admin_subadmin_management_bp, '/api/admin'),
    (gift_cards_bp, '/api'),
    (forwarded_postbacks_bp, '/api'),
    (user_dashboard_bp, '/api'),
    (payout_settings_bp, '/api/payout'),
    (admin_geo_restriction_bp, '/api'),
    (preview_bp, ''),
    (fix_incentives_bp, '/api'),
    (test_postback_bp, '/api/admin'),
    (traffic_sources_bp, '/api'),
    (advertiser_auth_bp, '/api/auth/advertiser'),
    (publisher_auth_bp, '/api/auth/publisher'),
    (admin_advertisers_bp, '/api/admin')
]

def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Set custom JSON provider for proper datetime serialization
    app.json = CustomJSONProvider(app)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Enable CORS with detailed configuration - Allow all moustacheleads.com subdomains
    CORS(app, 
         resources={
             r"/*": {  # Match ALL routes, not just /api/*
                 "origins": [
                     "http://localhost:3000",
                     "http://localhost:5173",
                     "http://localhost:8080",
                     "http://localhost:8081",
                     "http://localhost:8082",
                     "http://127.0.0.1:3000",
                     "http://127.0.0.1:5173",
                     "http://127.0.0.1:8080",
                     "http://127.0.0.1:8081",
                     "http://127.0.0.1:8082",
                     "http://192.168.1.15:8080",
                     "http://192.168.1.15:8081",
                     "http://192.168.1.15:8082",
                     "http://192.168.1.15:5173",
                     "http://10.59.206.163:3000",
                     "http://10.59.206.163:5173",
                     "http://10.59.206.163:8080",
                     "http://10.59.206.163:8081",
                     "http://10.59.206.163:8082",
                     "https://moustache-leads.vercel.app",
                     "https://theinterwebsite.space",
                     "https://www.theinterwebsite.space",
                     "https://api.theinterwebsite.space",
                     "https://moustacheleads.com",
                     "https://www.moustacheleads.com",
                     "https://dashboard.moustacheleads.com",
                     "https://offers.moustacheleads.com",
                     "https://offerwall.moustacheleads.com",
                     "https://landing.moustacheleads.com"
                 ],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                 "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
                 "expose_headers": ["Content-Type", "Authorization"],
                 "supports_credentials": True,
                 "max_age": 3600
             }
         },
         supports_credentials=True)
    
    # Custom CORS handler for additional origins (Vercel deployments and production)
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        method = request.method
        path = request.path
        
        # DEBUG: Log every request
        logging.info(f"🔍 Request: {method} {path} from origin: {origin}")
        
        # List of allowed origins
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://localhost:8081",
            "http://localhost:8082",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8081",
            "http://127.0.0.1:8082",
            "http://192.168.1.15:8080",
            "http://192.168.1.15:8081",
            "http://192.168.1.15:8082",
            "http://192.168.1.15:5173",
            "http://10.59.206.163:3000",
            "http://10.59.206.163:5173",
            "http://10.59.206.163:8080",
            "http://10.59.206.163:8081",
            "http://10.59.206.163:8082",
            "https://moustache-leads.vercel.app",
            "https://theinterwebsite.space",
            "https://www.theinterwebsite.space",
            "https://api.theinterwebsite.space",
            "https://moustacheleads.com",
            "https://www.moustacheleads.com",
            "https://dashboard.moustacheleads.com",
            "https://offers.moustacheleads.com",
            "https://offerwall.moustacheleads.com",
            "https://landing.moustacheleads.com"
        ]
        
        # Allow all Vercel preview deployments, theinterwebsite.space subdomains, and moustacheleads.com subdomains
        if origin and (origin in allowed_origins or '.vercel.app' in origin or 'theinterwebsite.space' in origin or 'moustacheleads.com' in origin):
            logging.info(f"✅ CORS: Allowing origin {origin}")
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Max-Age'] = '3600'
        else:
            logging.warning(f"❌ CORS: Rejecting origin {origin}")
        
        return response
    
    # Handle OPTIONS preflight requests explicitly
    @app.before_request
    def handle_preflight():
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            path = request.path
            
            logging.info(f"🔍 OPTIONS preflight: {path} from {origin}")
            
            # Check if origin is allowed
            if origin and ('moustacheleads.com' in origin or 'vercel.app' in origin or 'theinterwebsite.space' in origin or 'localhost' in origin or '127.0.0.1' in origin):
                logging.info(f"✅ OPTIONS: Allowing preflight from {origin}")
                response = app.make_default_options_response()
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
                response.headers['Access-Control-Max-Age'] = '3600'
                return response
            else:
                logging.warning(f"❌ OPTIONS: Rejecting preflight from {origin}")
    
    # Register blueprints (only if successfully imported)
    for blueprint, url_prefix in blueprints:
        if blueprint:
            app.register_blueprint(blueprint, url_prefix=url_prefix)
            print(f"✅ Registered blueprint: {blueprint.name} at {url_prefix}")
        else:
            print(f"❌ Failed to register blueprint with prefix: {url_prefix}")
    
    # Initialize comprehensive analytics tracker
    try:
        from models.comprehensive_tracking import ComprehensiveOfferwallTracker
        from routes.comprehensive_analytics import set_tracker
        from routes.offerwall import set_comprehensive_tracker
        
        tracker = ComprehensiveOfferwallTracker(db_instance)
        set_tracker(tracker, db_instance)
        set_comprehensive_tracker(tracker)
        print("✅ Comprehensive analytics tracker initialized")
    except Exception as e:
        print(f"❌ Failed to initialize comprehensive analytics tracker: {str(e)}")
    
    # NOTE: Background services are started OUTSIDE create_app() to avoid duplicate starts
    # when Gunicorn creates multiple workers
    # # Start postback processor
    # try:
    #     from services.tracking_service import TrackingService
    #     tracking_service = TrackingService()
    #     tracking_service.start_postback_processor()
    #     print("✅ Postback processor started")
    # except Exception as e:
    #     print(f"❌ Failed to start postback processor: {str(e)}")
    # 
    # # Start offer scheduler service
    # try:
    #     from services.offer_scheduler_service import offer_scheduler_service
    #     offer_scheduler_service.start_scheduler()
    #     print("✅ Offer scheduler service started")
    # except Exception as e:
    #     print(f"❌ Failed to start offer scheduler service: {str(e)}")
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        try:
            # Test database connection
            if db_instance.is_connected():
                db_instance.get_db().command('ping')
                return jsonify({
                    'status': 'healthy',
                    'database': 'connected',
                    'message': 'Ascend Backend API is running'
                }), 200
            else:
                return jsonify({
                    'status': 'healthy',
                    'database': 'disconnected',
                    'message': 'Ascend Backend API is running (without database)'
                }), 200
        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': str(e)
            }), 500
    
    # Test CORS endpoint - no auth required
    @app.route('/api/test-cors', methods=['GET', 'OPTIONS'])
    def test_cors():
        """Simple endpoint to test CORS without authentication"""
        logging.info(f"🔍 TEST-CORS: {request.method} from {request.headers.get('Origin')}")
        return jsonify({
            'message': 'CORS is working!',
            'origin': request.headers.get('Origin'),
            'method': request.method,
            'cors_pattern': 'r"/*"',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'message': 'Ascend Backend API',
            'version': '1.0.0',
            'endpoints': {
                'health': '/health',
                'auth': '/api/auth',
                'login': '/api/auth/login',
                'register': '/api/auth/register',
                'verify-token': '/api/auth/verify-token',
                'placements': '/api/placements',
                'publisher': '/api/placements/publisher/me',
                'offerwall': '/offerwall',
                'offers': '/api/offerwall/offers',
                'admin_offers': '/api/admin/offers',
                'offer_schedule': '/api/admin/offers/{id}/schedule',
                'offer_smart_rules': '/api/admin/offers/{id}/smart-rules',
                'activation_check': '/api/admin/offers/{id}/activation-check',
                'track_impression': '/api/offerwall/track/impression',
                'track_click': '/api/offerwall/track/click'
            }
        }), 200
    
    # Legacy login endpoint for frontend compatibility
    @app.route('/login', methods=['POST'])
    def legacy_login():
        """Legacy login endpoint to maintain frontend compatibility"""
        from routes.auth import login
        return login()
    
    # Test endpoint for debugging
    @app.route('/test-auth', methods=['POST'])
    def test_auth():
        """Test authentication without database"""
        from models.user import User
        data = request.get_json()
        user_model = User()
        result = user_model.verify_password(data.get('username'), data.get('password'))
        return jsonify({
            'db_connected': user_model._check_db_connection(),
            'auth_result': result is not None,
            'user_data': str(result) if result else None
        })
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

# Create app instance for Gunicorn
app = create_app()

# Initialize background services (for both Gunicorn and direct run)
if db_instance.is_connected():
    logging.info("Database connection established successfully")
    
    # Start background services (with graceful failure handling)
    try:
        # Try to import and start cap monitoring service
        try:
            from services.cap_monitoring_service import CapMonitoringService
            cap_service = CapMonitoringService()
            cap_service.start_monitoring_service()
            logging.info("✅ Cap monitoring service started")
        except Exception as e:
            logging.warning(f"⚠️ Cap monitoring service failed to start: {str(e)}")
        
        # Try to import and start tracking service (IMPORTANT for postbacks!)
        try:
            from services.tracking_service import TrackingService
            tracking_service = TrackingService()
            tracking_service.start_postback_processor()
            logging.info("✅ Tracking service started - Postbacks will be processed")
        except Exception as e:
            logging.warning(f"⚠️ Tracking service failed to start: {str(e)}")
        
        # Try to import and start schedule activation service
        try:
            from services.schedule_activation_service import setup_activation_scheduler
            setup_activation_scheduler()
            logging.info("✅ Schedule activation service started")
        except Exception as e:
            logging.warning(f"⚠️ Schedule activation service failed to start: {str(e)}")
        
        # Try to import and start placement auto-approval service
        try:
            from services.placement_auto_approval_service import get_placement_auto_approval_service
            auto_approval_service = get_placement_auto_approval_service()
            auto_approval_service.start_service()
            logging.info("✅ Placement auto-approval service started (3 days)")
        except Exception as e:
            logging.warning(f"⚠️ Placement auto-approval service failed to start: {str(e)}")
        
        logging.info("Background services initialization completed")
    except Exception as e:
        logging.error(f"Error in background services initialization: {str(e)}")
else:
    logging.warning("Database connection failed - app will run without database")

if __name__ == '__main__':
    # Run the application directly (not via Gunicorn)
    logging.info(f"Starting Ascend Backend API on port {Config.PORT}")
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=Config.FLASK_ENV == 'development'
    )
