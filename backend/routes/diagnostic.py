"""
Diagnostic Routes - For debugging postback distribution
"""

from flask import Blueprint, jsonify
from database import db_instance
import logging

diagnostic_bp = Blueprint('diagnostic', __name__)
logger = logging.getLogger(__name__)

@diagnostic_bp.route('/api/diagnostic/partner-distribution-status', methods=['GET'])
def check_distribution_status():
    """Check if partner distribution is working"""
    try:
        status = {
            'database_connected': False,
            'active_partners_count': 0,
            'active_partners': [],
            'recent_received_postbacks': 0,
            'recent_distribution_logs': 0,
            'service_import_ok': False,
            'error': None
        }
        
        # Check database
        if db_instance.is_connected():
            status['database_connected'] = True
            
            # Check active partners
            users_collection = db_instance.get_collection('users')
            if users_collection:
                partners = list(users_collection.find({
                    'role': 'partner',
                    'is_active': True,
                    'postback_url': {'$exists': True, '$ne': ''}
                }))
                
                status['active_partners_count'] = len(partners)
                status['active_partners'] = [
                    {
                        'username': p.get('username'),
                        'email': p.get('email'),
                        'postback_url': p.get('postback_url'),
                        'postback_method': p.get('postback_method', 'GET')
                    }
                    for p in partners
                ]
            
            # Check recent received postbacks
            received_collection = db_instance.get_collection('received_postbacks')
            if received_collection:
                from datetime import datetime, timedelta
                cutoff = datetime.utcnow() - timedelta(hours=24)
                status['recent_received_postbacks'] = received_collection.count_documents({
                    'timestamp': {'$gte': cutoff}
                })
            
            # Check distribution logs
            partner_logs_collection = db_instance.get_collection('partner_postback_logs')
            if partner_logs_collection:
                from datetime import datetime, timedelta
                cutoff = datetime.utcnow() - timedelta(hours=24)
                status['recent_distribution_logs'] = partner_logs_collection.count_documents({
                    'timestamp': {'$gte': cutoff}
                })
        
        # Check if service can be imported
        try:
            from services.partner_postback_service import partner_postback_service
            status['service_import_ok'] = True
        except Exception as e:
            status['service_import_ok'] = False
            status['error'] = f"Cannot import service: {str(e)}"
        
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"Diagnostic error: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'database_connected': False
        }), 500

@diagnostic_bp.route('/api/diagnostic/test-distribution', methods=['POST'])
def test_distribution():
    """Manually trigger a test distribution"""
    try:
        from services.partner_postback_service import partner_postback_service
        
        test_data = {
            'click_id': 'DIAGNOSTIC_TEST',
            'status': 'test',
            'payout': '0.00',
            'offer_id': 'TEST',
            'timestamp': str(int(__import__('time').time()))
        }
        
        result = partner_postback_service.distribute_to_all_partners(
            postback_data=test_data,
            db_instance=db_instance,
            source_log_id='diagnostic_test'
        )
        
        return jsonify({
            'success': True,
            'result': result
        }), 200
        
    except Exception as e:
        logger.error(f"Test distribution error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
