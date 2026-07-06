from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from database import db_instance
import logging
import os
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
preview_tracking_bp = safe_import_blueprint('routes.preview_tracking', 'preview_tracking_bp')
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
offerwall_analytics_dashboard_bp = safe_import_blueprint('routes.offerwall_analytics_dashboard', 'offerwall_analytics_dashboard_bp')
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
advertiser_dashboard_bp = safe_import_blueprint('routes.advertiser_dashboard', 'advertiser_dashboard_bp')
missing_offers_bp = safe_import_blueprint('routes.missing_offers', 'missing_offers_bp')
admin_overview_bp = safe_import_blueprint('routes.admin_overview', 'admin_overview_bp')
offer_insights_bp = safe_import_blueprint('routes.offer_insights_email', 'offer_insights_bp')
placement_proofs_bp = safe_import_blueprint('routes.placement_proofs', 'placement_proofs_bp')
support_bp = safe_import_blueprint('routes.support_messages', 'support_bp')
search_logs_bp = safe_import_blueprint('routes.search_logs', 'search_logs_bp')
admin_reports_bp = safe_import_blueprint('routes.admin_reports', 'admin_reports_bp')
admin_activity_logs_bp = safe_import_blueprint('routes.admin_activity_logs', 'admin_activity_logs_bp')
placement_approval_data_bp = safe_import_blueprint('routes.placement_approval_data', 'placement_approval_data_bp')
reactivation_bp = safe_import_blueprint('routes.reactivation', 'reactivation_bp')
referrals_bp = safe_import_blueprint('routes.referrals', 'referrals_bp')
user_payments_bp = safe_import_blueprint('routes.user_payments', 'user_payments_bp')
admin_payments_bp = safe_import_blueprint('routes.admin_payments', 'admin_payments_bp')
admin_campaigns_bp = safe_import_blueprint('routes.admin_campaigns', 'admin_campaigns_bp')
survey_gateway_bp = safe_import_blueprint('routes.survey_gateway', 'survey_gateway_bp')
admin_click_tracking_bp = safe_import_blueprint('routes.admin_click_tracking', 'admin_click_tracking_bp')
public_api_bp = safe_import_blueprint('routes.public_api', 'public_api_bp')
offer_access_bp = safe_import_blueprint('routes.offer_access', 'offer_access_bp')
poll_api_bp = safe_import_blueprint('routes.poll_api', 'poll_bp')
smart_link_bp = safe_import_blueprint('routes.smart_link', 'smart_link_bp')
api_keys_bp = safe_import_blueprint('routes.api_keys_routes', 'api_keys_bp')
api_tracking_bp = safe_import_blueprint('routes.api_tracking_routes', 'api_tracking_bp')
api_reports_routes_bp = safe_import_blueprint('routes.api_reports_routes', 'api_reports_routes_bp')
promo_v2_bp = safe_import_blueprint('routes.promo_v2_routes', 'promo_v2_bp')
user_offers_bp = safe_import_blueprint('routes.user_offers', 'user_offers_bp')
admin_notes_bp = safe_import_blueprint('routes.admin_notes', 'admin_notes_bp')
admin_publisher_email_bp = safe_import_blueprint('routes.admin_publisher_email', 'admin_publisher_email_bp')
admin_publisher_bulk_email_bp = safe_import_blueprint('routes.admin_publisher_bulk_email', 'admin_publisher_bulk_email_bp')
admin_level_progression_bp = safe_import_blueprint('routes.admin_level_progression', 'admin_level_progression_bp')
platform_settings_bp = safe_import_blueprint('routes.platform_settings', 'platform_settings_bp')
email_campaigns_bp = safe_import_blueprint('routes.email_campaigns', 'email_campaigns_bp')
automation_admin_bp = safe_import_blueprint('routes.automation_admin', 'automation_admin_bp')
support_hub_admin_bp = safe_import_blueprint('routes.support_hub_admin', 'support_hub_admin_bp')
review_submissions_bp = safe_import_blueprint('routes.review_submissions', 'review_submissions_bp')
search_intelligence_bp = safe_import_blueprint('routes.search_intelligence', 'search_intelligence_bp')
admin_offerwall_management_bp = safe_import_blueprint('routes.admin_offerwall_management', 'admin_offerwall_management_bp')
admin_surveys_bp = safe_import_blueprint('routes.admin_surveys', 'admin_surveys_bp')
admin_sub_walls_bp = safe_import_blueprint('routes.admin_sub_walls', 'admin_sub_walls_bp')
redirect_router_bp = safe_import_blueprint('routes.redirect_router', 'redirect_router_bp')
survey_funnel_bp = safe_import_blueprint('routes.survey_funnel', 'survey_funnel_bp')
survey_router_bp = safe_import_blueprint('routes.survey_router', 'survey_router_bp')
search_auto_activation_bp = safe_import_blueprint('routes.search_auto_activation', 'search_auto_activation_bp')
top_offers_bp = safe_import_blueprint('routes.top_offers', 'top_offers_bp')
admin_reversals_bp = safe_import_blueprint('routes.admin_reversals', 'admin_reversals_bp')
admin_invoices_bp = safe_import_blueprint('routes.admin_invoices', 'admin_invoices_bp')
admin_automation_bp = safe_import_blueprint('routes.admin_automation', 'admin_automation_bp')
offer_status_webhook_bp = safe_import_blueprint('routes.offer_status_webhook', 'offer_status_webhook_bp')
offer_status_signals_bp = safe_import_blueprint('routes.offer_status_signals', 'offer_status_signals_bp')

# Custom JSON provider to handle datetime serialization with UTC 'Z' suffix
class CustomJSONProvider(DefaultJSONProvider):
    """Custom JSON provider that handles datetime and ObjectId serialization"""
    def default(self, obj):
        if isinstance(obj, datetime):
            # Convert datetime to ISO format with 'Z' suffix for UTC
            return obj.isoformat() + 'Z'
        from bson import ObjectId
        if isinstance(obj, ObjectId):
            return str(obj)
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
    (preview_tracking_bp, ''),
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
    (offerwall_analytics_dashboard_bp, ''),
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
    (admin_advertisers_bp, '/api/admin'),
    (advertiser_dashboard_bp, '/api/advertiser'),
    (missing_offers_bp, ''),
    (admin_overview_bp, ''),
    (offer_insights_bp, '/api/admin'),
    (placement_proofs_bp, '/api/placement-proofs'),
    (support_bp, ''),
    (search_logs_bp, '/api/admin'),
    (admin_reports_bp, ''),
    (admin_activity_logs_bp, '/api/admin'),
    (placement_approval_data_bp, '/api/admin'),
    (reactivation_bp, '/api/admin'),
    (referrals_bp, '/api'),
    (user_payments_bp, '/api/payments'),
    (admin_payments_bp, '/api/admin/payments'),
    (admin_campaigns_bp, ''),
    (survey_gateway_bp, ''),
    (admin_click_tracking_bp, '/api/admin/click-tracking'),
    (public_api_bp, '/api'),
    (offer_access_bp, '/api'),
    (poll_api_bp, '/api'),
    (smart_link_bp, ''),
    (api_keys_bp, '/api'),
    (api_tracking_bp, '/v1'),
    (api_reports_routes_bp, '/v1'),
    (promo_v2_bp, ''),
    (user_offers_bp, '/api/admin'),
    (admin_notes_bp, ''),
    (admin_publisher_email_bp, ''),
    (admin_publisher_bulk_email_bp, ''),
    (admin_level_progression_bp, ''),
    (platform_settings_bp, ''),
    (email_campaigns_bp, '/api/admin'),
    (automation_admin_bp, '/api/admin'),
    (support_hub_admin_bp, '/api/admin'),
    (review_submissions_bp, ''),
    (search_intelligence_bp, '/api/admin/search-intelligence'),
    (admin_offerwall_management_bp, '/api/admin'),
    (admin_surveys_bp, '/api/admin'),
    (admin_sub_walls_bp, '/api/admin'),
    (redirect_router_bp, ''),
    (survey_funnel_bp, ''),
    (survey_router_bp, ''),
    (search_auto_activation_bp, '/api/admin'),
    (top_offers_bp, '/api/admin'),
    (admin_reversals_bp, ''),
    (admin_invoices_bp, ''),
    (admin_automation_bp, ''),
    (offer_status_webhook_bp, ''),
    (offer_status_signals_bp, '/api/admin'),
]

def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Set custom JSON provider for proper datetime serialization
    app.json = CustomJSONProvider(app)
    
    # Configure logging with proper shutdown handling
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True  # Force reconfiguration to avoid conflicts
    )
    
    # Disable logging during shutdown to prevent daemon thread errors
    import atexit
    def shutdown_logging():
        logging.shutdown()
    atexit.register(shutdown_logging)
    
    # Enable CORS - simplified config, detailed handling in after_request/before_request
    CORS(app, supports_credentials=True)
    
    # Custom CORS handler - single handler replaces the triple CORS processing
    # (Previously: Flask-CORS middleware + after_request + before_request = 3x processing)
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        
        if origin and ('moustacheleads.com' in origin or 'vercel.app' in origin or 
                       'theinterwebsite.space' in origin or 'localhost' in origin or 
                       '127.0.0.1' in origin or '192.168.' in origin or '10.' in origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Max-Age'] = '3600'
        
        # GZIP compression for responses > 500 bytes
        # Reduces response size by 60-70% — makes pages load faster
        if (response.status_code == 200 
            and response.content_type 
            and ('json' in response.content_type or 'text' in response.content_type)
            and response.content_length and response.content_length > 500):
            import gzip
            accept_encoding = request.headers.get('Accept-Encoding', '')
            if 'gzip' in accept_encoding:
                try:
                    data = response.get_data()
                    compressed = gzip.compress(data, compresslevel=6)
                    if len(compressed) < len(data):  # Only use if actually smaller
                        response.set_data(compressed)
                        response.headers['Content-Encoding'] = 'gzip'
                        response.headers['Content-Length'] = len(compressed)
                except Exception:
                    pass  # If compression fails, send uncompressed
        
        return response
    
    # Handle OPTIONS preflight requests
    @app.before_request
    def handle_preflight():
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin')
            if origin and ('moustacheleads.com' in origin or 'vercel.app' in origin or 
                          'theinterwebsite.space' in origin or 'localhost' in origin or 
                          '127.0.0.1' in origin):
                response = app.make_default_options_response()
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
                response.headers['Access-Control-Max-Age'] = '3600'
                return response
    
    # Register blueprints (only if successfully imported)
    for blueprint, url_prefix in blueprints:
        if blueprint:
            app.register_blueprint(blueprint, url_prefix=url_prefix)
            print(f"[+] Registered blueprint: {blueprint.name} at {url_prefix}")
        else:
            print(f"Failed to register blueprint with prefix: {url_prefix}")
    
    # Initialize comprehensive analytics tracker
    try:
        from models.comprehensive_tracking import ComprehensiveOfferwallTracker
        from routes.comprehensive_analytics import set_tracker
        from routes.offerwall import set_comprehensive_tracker
        
        tracker = ComprehensiveOfferwallTracker(db_instance)
        set_tracker(tracker, db_instance)
        set_comprehensive_tracker(tracker)
        print("[+] Comprehensive analytics tracker initialized")
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
    
    # Serve uploaded files (placement proofs, etc.)
    @app.route('/uploads/<path:filepath>', methods=['GET'])
    def serve_uploads(filepath):
        from flask import send_from_directory
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        return send_from_directory(upload_dir, filepath)

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
    
    # Debug endpoint - no auth, shows DB status and deploy version
    @app.route('/api/debug/status', methods=['GET'])
    def debug_status():
        """No-auth debug endpoint to check DB connection and deploy version"""
        from config import Config
        db_connected = db_instance.is_connected()
        db_ping = False
        db_error = None
        user_count = None
        
        if db_connected:
            try:
                db_instance.get_db().command('ping')
                db_ping = True
                # Try to count users
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    user_count = users_col.count_documents({})
            except Exception as e:
                db_error = str(e)
        
        return jsonify({
            'deploy_version': 'debug-v2-20260320',
            'db_connected': db_connected,
            'db_ping': db_ping,
            'db_error': db_error,
            'user_count': user_count,
            'mongodb_uri_set': bool(Config.MONGODB_URI),
            'mongodb_uri_prefix': Config.MONGODB_URI[:30] + '...' if Config.MONGODB_URI else None,
            'jwt_secret_set': bool(Config.JWT_SECRET_KEY),
            'flask_env': Config.FLASK_ENV,
        }), 200
    
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

# Add signal handlers for graceful shutdown
import signal
import sys

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    logging.info(f"Received signal {sig}, shutting down gracefully...")
    logging.shutdown()
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# Track whether background services have been started (to avoid duplicates)
_background_services_started = False

def start_background_services():
    """Start background services — called once per process.
    
    Under Gunicorn with preload_app=False, each worker calls this independently.
    We use a module-level flag to ensure services start only once per worker process.
    Only the designated background worker (RUN_BACKGROUND_SERVICES=1) will start them.
    """
    global _background_services_started
    if _background_services_started:
        return
    _background_services_started = True
    
    # Check if this worker is designated for background services
    # When running under Gunicorn, only worker.age==1 sets RUN_BACKGROUND_SERVICES=1
    # When running directly (python run.py), the env var won't exist, so default to running
    run_bg = os.environ.get('RUN_BACKGROUND_SERVICES', '1')
    if run_bg == '0':
        logging.info("ℹ️ This worker is NOT the background services worker — skipping background services")
        return
    
    if not db_instance.is_connected():
        logging.warning("Database connection failed - skipping background services")
        return
    
    logging.info("Database connection established — starting background services")
    
    # Ensure critical indexes exist (fast, idempotent — skips if already created)
    try:
        from pymongo import ASCENDING, DESCENDING
        db = db_instance.get_db()
        # Publisher offers compound index
        db['offers'].create_index(
            [('status', ASCENDING), ('deleted', ASCENDING), ('is_pinned', DESCENDING), ('created_at', DESCENDING)],
            name='publisher_offers_idx', background=True
        )
        # Clicks indexes
        db['clicks'].create_index([('ip_address', ASCENDING), ('timestamp', DESCENDING)], background=True)
        db['clicks'].create_index([('user_id', ASCENDING), ('offer_id', ASCENDING), ('timestamp', DESCENDING)], background=True)
        db['clicks'].create_index([('publisher_id', ASCENDING)], background=True)
        db['clicks'].create_index([('username', ASCENDING)], background=True)
        
        # Offer Views indexes
        db['offer_views'].create_index([('user_id', ASCENDING)], background=True)
        db['offer_views'].create_index([('username', ASCENDING)], background=True)
        
        # Send history indexes
        db['offer_send_history'].create_index([('user_id', ASCENDING)], background=True)
        db['offer_send_history'].create_index([('recipient_user_ids', ASCENDING)], background=True)
        
        # Affiliate requests indexes
        db['affiliate_requests'].create_index([('user_id', ASCENDING)], background=True)
        db['affiliate_requests'].create_index([('username', ASCENDING)], background=True)
        
        # Login logs indexes
        db['login_logs'].create_index([('user_id', ASCENDING)], background=True)
        db['login_logs'].create_index([('email', ASCENDING)], background=True)
        db['login_logs'].create_index([('username', ASCENDING)], background=True)

        # Tracking events indexes
        db['tracking_events'].create_index([('user_id', ASCENDING)], background=True)
        
        logging.info("✅ Critical indexes ensured")
    except Exception as idx_err:
        logging.warning(f"Index creation skipped: {idx_err}")
    
    # PRE-WARM CACHES: Load offers into memory so first user gets instant response
    try:
        import threading
        def _prewarm_caches():
            try:
                from routes.simple_tracking import _get_offer_cached
                offers_col = db_instance.get_collection('offers')
                if offers_col:
                    # Load top 50 active offers into tracking cache (minimal for 22 users/day)
                    active_offers = offers_col.find(
                        {'status': {'$in': ['active', 'running', 'rotating']}},
                        {'offer_id': 1, 'name': 1, 'status': 1, 'target_url': 1, 'payout': 1,
                         'currency': 1, 'network': 1, 'category': 1, 'vertical': 1,
                         'campaign_id': 1, 'fallback_redirect_enabled': 1,
                         'fallback_redirect_url': 1, 'fallback_redirect_timer': 1}
                    ).limit(50)
                    
                    import time as _time
                    from routes.simple_tracking import _offer_cache, _OFFER_CACHE_TTL
                    count = 0
                    for offer in active_offers:
                        oid = offer.get('offer_id')
                        if oid:
                            _offer_cache[oid] = {'data': offer, 'expires': _time.time() + _OFFER_CACHE_TTL}
                            count += 1
                    logging.info(f"✅ Pre-warmed offer cache with {count} offers")
            except Exception as e:
                logging.warning(f"Cache pre-warm failed (non-critical): {e}")
        
        # Run in background thread so it doesn't block startup
        threading.Thread(target=_prewarm_caches, daemon=True).start()
    except Exception:
        pass
    
    # =========================================================================
    # ACTIVE BACKGROUND SERVICES (4 kept — critical for platform operation)
    # Memory optimization: disabled 11 non-critical services to stay within 512MB
    # No data is lost — all MongoDB collections remain untouched.
    # Disabled services can be re-enabled or moved to Render Cron Jobs later.
    # =========================================================================
    try:
        # KEEP: Cap Monitoring — prevents advertiser over-delivery
        try:
            from services.cap_monitoring_service import CapMonitoringService
            cap_service = CapMonitoringService()
            cap_service.start_monitoring_service()
            logging.info("✅ Cap monitoring service started")
        except Exception as e:
            logging.warning(f"⚠️ Cap monitoring service failed to start: {str(e)}")
        
        # KEEP: Postback Processor — core revenue tracking, non-negotiable
        try:
            from services.tracking_service import TrackingService
            tracking_service = TrackingService()
            tracking_service.start_postback_processor()
            logging.info("✅ Tracking service started - Postbacks will be processed")
        except Exception as e:
            logging.warning(f"⚠️ Tracking service failed to start: {str(e)}")
        
        # KEEP: Schedule Activation — offers must auto-start/stop on their dates
        try:
            from services.schedule_activation_service import setup_activation_scheduler
            setup_activation_scheduler()
            logging.info("✅ Schedule activation service started")
        except Exception as e:
            logging.warning(f"⚠️ Schedule activation service failed to start: {str(e)}")
        
        # KEEP: Price Boost Expiration — checks for expired boosts
        try:
            from services.price_boost_service import price_boost_service
            price_boost_service.start()
            logging.info("✅ Price boost expiration service started")
        except Exception as e:
            logging.warning(f"⚠️ Price boost service failed to start: {str(e)}")

        # KEEP: Scheduled Email Service — publishers need their email notifications
        try:
            from services.scheduled_email_service import get_scheduled_email_service
            email_service = get_scheduled_email_service()
            email_service.start_service()
            logging.info("✅ Scheduled email service started")
        except Exception as e:
            logging.warning(f"⚠️ Scheduled email service failed to start: {str(e)}")
        
        # =====================================================================
        # DISABLED SERVICES (admin manages via Automation tab buttons)
        # All data remains in MongoDB. These can be re-enabled anytime.
        # =====================================================================
        
        # DISABLED: Placement Auto-Approval — admin approves manually
        logging.info("ℹ️ Placement auto-approval service DISABLED (admin does manually)")
        
        # DISABLED: Offer Inactivity — admin triggers via Automation tab button
        logging.info("ℹ️ Offer inactivity service DISABLED (admin button in Automation tab)")

        # =====================================================================
        # RE-ENABLED SERVICES (essential for 20K offers + platform operation)
        # =====================================================================
        
        # RE-ENABLED: Offer Rotation — 20K offers need rotation for visibility
        try:
            from services.offer_rotation_service import get_rotation_service
            rotation_service = get_rotation_service()
            rot_state = rotation_service._get_state()
            if rot_state.get('enabled'):
                rotation_service.start()
                logging.info("✅ Offer rotation service started (was enabled)")
            else:
                logging.info("ℹ️ Offer rotation service loaded (currently disabled in settings)")
        except Exception as e:
            logging.warning(f"⚠️ Offer rotation service failed to start: {str(e)}")
        
        # RE-ENABLED: Campaign Processor — processes bulk email campaigns
        try:
            from services.campaign_processor import get_campaign_processor
            campaign_processor = get_campaign_processor()
            campaign_processor.start()
            logging.info("✅ Campaign processor started (email queue processing)")
        except Exception as e:
            logging.warning(f"⚠️ Campaign processor failed to start: {str(e)}")

        # RE-ENABLED: Location Retry — resolves failed geo lookups (15 min interval)
        try:
            from services.location_retry_service import get_location_retry_service
            location_retry_service = get_location_retry_service()
            location_retry_service.start_service()
            logging.info("✅ Location retry service started")
        except Exception as e:
            logging.warning(f"⚠️ Location retry service failed to start: {str(e)}")

        # DISABLED: Automation Engine — not in use
        logging.info("ℹ️ Automation Engine DISABLED (not in use)")

        # DISABLED: Search Auto-Activation — access request flow handles this
        logging.info("ℹ️ Search auto-activation DISABLED (access request flow is used)")
        
        # DISABLED: Invoice Scheduler — admin triggers via Automation tab button
        logging.info("ℹ️ Invoice scheduler DISABLED (admin button in Automation tab)")
        
        # RE-ENABLED: Telegram Bot — posts trending offers every 12 hours
        try:
            from services.telegram_trending_bot import start_scheduler as start_telegram_scheduler
            start_telegram_scheduler()
            logging.info("✅ Telegram trending bot scheduler started (every 12 hours)")
        except Exception as e:
            logging.warning(f"⚠️ Telegram trending bot failed to start: {str(e)}")
        
        logging.info("✅ Background services initialization completed (9 active, 5 disabled)")
    except Exception as e:
        logging.error(f"Error in background services initialization: {str(e)}")

# Start background services on first request (lazy init, safe for Gunicorn workers)
@app.before_request
def _ensure_background_services():
    """Lazily start background services on the first request this worker handles."""
    if not _background_services_started:
        start_background_services()

if __name__ == '__main__':
    # Running directly (not via Gunicorn) — start services immediately
    start_background_services()
    logging.info(f"Starting Ascend Backend API on port {Config.PORT}")
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=Config.FLASK_ENV == 'development'
    )
