from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from database import db_instance
import logging

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
analytics_bp = safe_import_blueprint('routes.analytics', 'analytics_bp')
offer_serving_bp = safe_import_blueprint('routes.offer_serving', 'offer_serving_bp')
file_upload_bp = safe_import_blueprint('routes.file_upload', 'file_upload_bp')
test_schedule_rules_bp = safe_import_blueprint('routes.test_schedule_rules', 'test_schedule_rules_bp')
partners_bp = safe_import_blueprint('routes.partners', 'partners_bp')
postback_logs_bp = safe_import_blueprint('routes.postback_logs', 'postback_logs_bp')

# Define blueprints with their URL prefixes
blueprints = [
    (auth_bp, '/api/auth'),
    (placements_bp, '/api/placements'),
    (offerwall_bp, ''),
    (admin_offers_bp, '/api/admin'),
    (schedule_rules_bp, '/api/admin'),
    (click_handler_bp, '/api'),
    (link_masking_bp, '/api'),
    (analytics_bp, '/api/analytics'),
    (offer_serving_bp, ''),  # No prefix so /track/click works directly
    (file_upload_bp, '/api'),
    (test_schedule_rules_bp, '/api'),  # Test routes
    (partners_bp, '/api/admin'),  # Partner management
    (postback_logs_bp, '/api/admin')  # Postback logs
]

def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Enable CORS for all routes (local + production)
    CORS(app, origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://localhost:8080", 
        "http://localhost:8081", 
        "http://127.0.0.1:3000", 
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:8080", 
        "http://127.0.0.1:8081",
        "https://moustache-leads.vercel.app",  # Production frontend
        "https://*.vercel.app",  # Allow all Vercel preview deployments
        "https://vercel.app"
    ], 
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization'],
         supports_credentials=True)
    
    # Register blueprints (only if successfully imported)
    for blueprint, url_prefix in blueprints:
        if blueprint is not None:
            if url_prefix:
                app.register_blueprint(blueprint, url_prefix=url_prefix)
            else:
                app.register_blueprint(blueprint)
            logging.info(f"✅ Registered blueprint: {blueprint.name}")
        else:
            logging.warning(f"⚠️ Skipped blueprint registration (import failed)")
    
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
