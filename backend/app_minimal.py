"""
Minimal version of app.py for debugging server loading issues
This version loads only essential components to identify the problem
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import logging

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def create_minimal_app():
    """Create minimal Flask application for debugging"""
    app = Flask(__name__)
    
    # Enable CORS
    CORS(app, origins=["http://localhost:3000", "http://localhost:5173"], 
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization'])
    
    # Basic health check
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'message': 'Minimal Ascend Backend API is running',
            'version': 'debug'
        }), 200
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'message': 'Minimal Ascend Backend API - Debug Mode',
            'status': 'running'
        }), 200
    
    # Test config import
    @app.route('/test-config', methods=['GET'])
    def test_config():
        try:
            from config import Config
            return jsonify({
                'config_loaded': True,
                'port': getattr(Config, 'PORT', 'Not found'),
                'flask_env': getattr(Config, 'FLASK_ENV', 'Not found')
            }), 200
        except Exception as e:
            return jsonify({
                'config_loaded': False,
                'error': str(e)
            }), 500
    
    # Test database import
    @app.route('/test-database', methods=['GET'])
    def test_database():
        try:
            from database import db_instance
            return jsonify({
                'database_imported': True,
                'connected': db_instance.is_connected() if hasattr(db_instance, 'is_connected') else False
            }), 200
        except Exception as e:
            return jsonify({
                'database_imported': False,
                'error': str(e)
            }), 500
    
    # Test route imports
    @app.route('/test-routes', methods=['GET'])
    def test_routes():
        results = {}
        
        routes_to_test = [
            ('routes.auth', 'auth_bp'),
            ('routes.admin_offers', 'admin_offers_bp'),
            ('routes.offer_schedule_rules', 'schedule_rules_bp'),
            ('routes.offer_click_handler', 'click_handler_bp'),
        ]
        
        for module_path, blueprint_name in routes_to_test:
            try:
                module = __import__(module_path, fromlist=[blueprint_name])
                blueprint = getattr(module, blueprint_name)
                results[module_path] = {
                    'imported': True,
                    'blueprint_name': blueprint.name if hasattr(blueprint, 'name') else 'Unknown'
                }
            except Exception as e:
                results[module_path] = {
                    'imported': False,
                    'error': str(e)
                }
        
        return jsonify({
            'route_imports': results
        }), 200
    
    # Test service imports
    @app.route('/test-services', methods=['GET'])
    def test_services():
        results = {}
        
        services_to_test = [
            'services.schedule_activation_service',
            'services.smart_rules_resolver',
            'services.tracking_service',
            'services.cap_monitoring_service'
        ]
        
        for service_path in services_to_test:
            try:
                __import__(service_path)
                results[service_path] = {'imported': True}
            except Exception as e:
                results[service_path] = {
                    'imported': False,
                    'error': str(e)
                }
        
        return jsonify({
            'service_imports': results
        }), 200
    
    return app

if __name__ == '__main__':
    print("🔧 Starting minimal debug server...")
    
    try:
        app = create_minimal_app()
        print("✅ Minimal app created successfully")
        
        # Try to get port from config
        try:
            from config import Config
            port = Config.PORT
            print(f"✅ Config loaded, using port: {port}")
        except Exception as e:
            port = 5000
            print(f"⚠️ Config failed, using default port 5000: {str(e)}")
        
        print(f"🚀 Starting server on http://localhost:{port}")
        print("📋 Debug endpoints available:")
        print("   - GET /health - Health check")
        print("   - GET /test-config - Test config import")
        print("   - GET /test-database - Test database import")
        print("   - GET /test-routes - Test route imports")
        print("   - GET /test-services - Test service imports")
        
        app.run(
            host='0.0.0.0',
            port=port,
            debug=True
        )
        
    except Exception as e:
        print(f"❌ Failed to start minimal server: {str(e)}")
        import traceback
        traceback.print_exc()
