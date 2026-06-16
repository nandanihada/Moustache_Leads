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
            if users_collection is not None:
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
            if received_collection is not None:
                from datetime import datetime, timedelta
                cutoff = datetime.utcnow() - timedelta(hours=24)
                status['recent_received_postbacks'] = received_collection.count_documents({
                    'timestamp': {'$gte': cutoff}
                })
            
            # Check distribution logs
            partner_logs_collection = db_instance.get_collection('partner_postback_logs')
            if partner_logs_collection is not None:
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

@diagnostic_bp.route('/api/diagnostic/smtp-status', methods=['GET'])
def check_smtp_status():
    """Diagnostic route to check SMTP configuration on the server"""
    import os
    from services.email_verification_service import get_email_verification_service
    from services.email_service import EmailService
    
    try:
        email_verify_service = get_email_verification_service()
        main_email_service = EmailService()
        
        status = {
            'smtp_host': os.getenv('SMTP_HOST'),
            'smtp_port': os.getenv('SMTP_PORT'),
            'smtp_user': os.getenv('SMTP_USER'),
            'from_email': os.getenv('FROM_EMAIL'),
            'smtp_pass_set': bool(os.getenv('SMTP_PASS')),
            'email_debug': os.getenv('EMAIL_DEBUG'),
            'frontend_url': os.getenv('FRONTEND_URL'),
            'backend_url': os.getenv('BACKEND_URL'),
            'email_verification_service_configured': email_verify_service.is_configured,
            'main_email_service_configured': main_email_service.is_configured
        }
        return jsonify(status), 200
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500
