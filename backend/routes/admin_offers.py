from flask import Blueprint, request, jsonify
from models.offer import Offer
from models.offer_extended import OfferExtended
from utils.auth import token_required
from utils.json_serializer import safe_json_response, serialize_for_json
from utils.frontend_mapping import FrontendDatabaseMapper
from services.email_service import get_email_service
from database import db_instance
import logging

admin_offers_bp = Blueprint('admin_offers', __name__)
offer_model = Offer()
extended_offer_model = OfferExtended()  # For schedule + smart rules operations
admin_offer_model = offer_model  # Use the same model instance

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@admin_offers_bp.route('/offers', methods=['POST'])
@token_required
@admin_required
def create_offer():
    """Create a new offer (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # QA VERIFICATION: Log received data
        logging.info("📥 CREATE OFFER - Schedule received: %s", data.get("schedule"))
        logging.info("📥 CREATE OFFER - SmartRules received: %s", data.get("smartRules"))
        logging.info("📥 CREATE OFFER - Full payload keys: %s", list(data.keys()))
        
        # 🔥 CRITICAL FIX: Apply field mapping for schedule + smart rules
        if 'schedule' in data or 'smartRules' in data:
            mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
            logging.info("📥 CREATE OFFER - After mapping - Schedule: %s", mapped_data.get("schedule"))
            logging.info("📥 CREATE OFFER - After mapping - SmartRules: %s", mapped_data.get("smartRules"))
            data = mapped_data
        
        user = request.current_user
        
        # Use extended model if schedule/smart rules data is present
        if 'schedule' in data or 'smartRules' in data:
            offer_data, error = extended_offer_model.create_offer(data, str(user['_id']))
        else:
            offer_data, error = offer_model.create_offer(data, str(user['_id']))
        
        if error:
            return jsonify({'error': error}), 400
        
        logging.info("✅ Offer created successfully, now triggering email notifications...")
        
        # Send email notifications to all publishers (non-blocking)
        try:
            logging.info("📧 Preparing to send email notifications to publishers...")
            logging.info(f"📧 Offer data for email: {offer_data.get('name', 'Unknown')}")
            
            # Get all publishers from database
            users_collection = db_instance.get_collection('users')
            if users_collection is not None:
                publishers = list(users_collection.find(
                    {'role': 'publisher'},
                    {'email': 1, 'username': 1}
                ))
                
                # Extract email addresses
                publisher_emails = [
                    pub.get('email') for pub in publishers 
                    if pub.get('email')
                ]
                
                if publisher_emails:
                    logging.info(f"📧 Found {len(publisher_emails)} publisher emails")
                    
                    # Send emails asynchronously (non-blocking)
                    email_service = get_email_service()
                    email_service.send_new_offer_notification_async(
                        offer_data=offer_data,
                        recipients=publisher_emails
                    )
                    
                    logging.info("✅ Email notification process started in background")
                else:
                    logging.warning("⚠️ No publisher emails found")
            else:
                logging.warning("⚠️ Could not access users collection for email notifications")
                
        except Exception as email_error:
            # Don't fail offer creation if email fails
            logging.error(f"❌ Email notification error (non-critical): {str(email_error)}")
        
        return safe_json_response({
            'message': 'Offer created successfully',
            'offer': offer_data
        }, 201)
        
    except Exception as e:
        logging.error(f"Create offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers', methods=['GET'])
@token_required
@admin_required
def get_offers():
    """Get all offers with filtering and pagination (Admin only)"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)  # Max 100 per page
        status = request.args.get('status')
        network = request.args.get('network')
        search = request.args.get('search')
        
        # Build filters
        filters = {}
        if status and status != 'all':
            filters['status'] = status
        if network:
            filters['network'] = network
        if search:
            filters['search'] = search
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get offers
        offers, total = offer_model.get_offers(filters, skip, per_page)
        
        return safe_json_response({
            'offers': offers,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logging.error(f"Get offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offers: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['GET'])
@token_required
@admin_required
def get_offer(offer_id):
    """Get a specific offer by ID (Admin only)"""
    try:
        offer = offer_model.get_offer_by_id(offer_id)
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        return safe_json_response({'offer': offer})
        
    except Exception as e:
        logging.error(f"Get offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['PUT'])
@token_required
@admin_required
def update_offer(offer_id):
    """Update an offer (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # QA VERIFICATION: Log received data
        logging.info("📥 UPDATE OFFER - Schedule received: %s", data.get("schedule"))
        logging.info("📥 UPDATE OFFER - SmartRules received: %s", data.get("smartRules"))
        logging.info("📥 UPDATE OFFER - Full payload keys: %s", list(data.keys()))
        
        # 🔥 CRITICAL FIX: Apply field mapping for schedule + smart rules
        if 'schedule' in data or 'smartRules' in data:
            mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
            logging.info("📥 UPDATE OFFER - After mapping - Schedule: %s", mapped_data.get("schedule"))
            logging.info("📥 UPDATE OFFER - After mapping - SmartRules: %s", mapped_data.get("smartRules"))
            data = mapped_data
        
        user = request.current_user
        
        # Use extended model if schedule/smart rules data is present
        if 'schedule' in data or 'smartRules' in data:
            success, error = extended_offer_model.update_offer(offer_id, data, str(user['_id']))
        else:
            success, error = offer_model.update_offer(offer_id, data, str(user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update offer'}), 400
        
        # Get updated offer - use extended model if schedule/smart rules were updated
        if 'schedule' in data or 'smartRules' in data:
            updated_offer = extended_offer_model.get_offer_by_id(offer_id)
        else:
            updated_offer = offer_model.get_offer_by_id(offer_id)
        
        return safe_json_response({
            'message': 'Offer updated successfully',
            'offer': updated_offer
        })
        
    except Exception as e:
        logging.error(f"Update offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests', methods=['GET'])
@token_required
@admin_required
def get_access_requests():
    """Get access requests for an offer"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        requests = access_service.get_access_requests(offer_id)
        
        return jsonify({
            'requests': requests,
            'total': len(requests)
        })
        
    except Exception as e:
        logging.error(f"Get access requests error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get access requests: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests/<request_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_access_request():
    """Approve an access request"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        request_id = request.view_args.get('request_id')
        
        result = access_service.approve_access_request(request_id, offer_id)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Access request approved successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Approve access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve access request: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests/<request_id>/reject', methods=['POST'])
@token_required
@admin_required
def reject_access_request():
    """Reject an access request"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        request_id = request.view_args.get('request_id')
        data = request.get_json() or {}
        reason = data.get('reason', '')
        
        result = access_service.reject_access_request(request_id, offer_id, reason)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Access request rejected successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Reject access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject access request: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_offer(offer_id):
    """Delete an offer (Admin only)"""
    try:
        success = offer_model.delete_offer(offer_id)
        
        if not success:
            return jsonify({'error': 'Offer not found or already deleted'}), 404
        
        return jsonify({'message': 'Offer deleted successfully'}), 200
        
    except Exception as e:
        logging.error(f"Delete offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/clone', methods=['POST'])
@token_required
@admin_required
def clone_offer(offer_id):
    """Clone an existing offer (Admin only)"""
    try:
        # Get original offer
        original_offer = offer_model.get_offer_by_id(offer_id)
        
        if not original_offer:
            return jsonify({'error': 'Original offer not found'}), 404
        
        # Prepare cloned data
        clone_data = original_offer.copy()
        
        # Remove fields that shouldn't be cloned
        fields_to_remove = ['_id', 'offer_id', 'hits', 'created_at', 'updated_at', 'created_by']
        for field in fields_to_remove:
            clone_data.pop(field, None)
        
        # Modify name to indicate it's a clone
        clone_data['name'] = f"{clone_data['name']} (Copy)"
        clone_data['status'] = 'pending'  # Reset status to pending
        
        # Create cloned offer
        user = request.current_user
        cloned_offer, error = offer_model.create_offer(clone_data, str(user['_id']))
        
        if error:
            return jsonify({'error': error}), 400
        
        return safe_json_response({
            'message': 'Offer cloned successfully',
            'offer': cloned_offer
        }, 201)
        
    except Exception as e:
        logging.error(f"Clone offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to clone offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/settings', methods=['GET'])
@token_required
@admin_required
def get_offer_settings(offer_id):
    """Get advanced settings for an offer"""
    try:
        settings = admin_offer_model.get_offer_settings(offer_id)
        
        if settings is None:
            # Return default settings if none exist
            default_settings = {
                'enableClickTracking': True,
                'enableImpressionTracking': True,
                'enableConversionTracking': True,
                'fraudDetectionLevel': 'medium',
                'enableLinkMasking': False,
                'customDomain': '',
                'shortCodeLength': 8,
                'useCustomCode': False,
                'customCode': '',
                'enableGeoTargeting': False,
                'enableDeviceTargeting': False,
                'enableTimeBasedTargeting': False,
                'enableCapLimits': False,
                'dailyCapLimit': 1000,
                'enablePostbacks': True,
                'postbackUrl': '',
                'postbackParameters': 'subid={subid}&payout={payout}&status={status}',
                'enableIPWhitelist': False,
                'ipWhitelist': '',
                'enableReferrerCheck': False,
                'allowedReferrers': '',
                'cacheEnabled': True,
                'cacheTTL': 300,
                'enableCompression': True,
                'emailNotifications': True,
                'slackWebhook': '',
                'discordWebhook': ''
            }
            return jsonify({'settings': default_settings}), 200
        
        return jsonify({'settings': settings}), 200
        
    except Exception as e:
        logging.error(f"Get offer settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offer settings: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/settings', methods=['PUT'])
@token_required
@admin_required
def update_offer_settings(offer_id):
    """Update advanced settings for an offer"""
    try:
        data = request.get_json()
        
        if not data or 'settings' not in data:
            return jsonify({'error': 'Settings data required'}), 400
        
        settings = data['settings']
        
        # Validate settings
        if not isinstance(settings, dict):
            return jsonify({'error': 'Settings must be an object'}), 400
        
        # Update settings
        success, error = admin_offer_model.update_offer_settings(offer_id, settings)
        
        if not success:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Settings updated successfully'}), 200
        
    except Exception as e:
        logging.error(f"Update offer settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update offer settings: {str(e)}'}), 500

@admin_offers_bp.route('/offers/stats', methods=['GET'])
@token_required
@admin_required
def get_offers_stats():
    """Get offer statistics (Admin only)"""
    try:
        if not offer_model._check_db_connection():
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Get basic stats
        total_offers = offer_model.collection.count_documents({'is_active': True})
        active_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'active'})
        pending_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'pending'})
        inactive_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'inactive'})
        
        # Get top networks
        pipeline = [
            {'$match': {'is_active': True}},
            {'$group': {'_id': '$network', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        top_networks = list(offer_model.collection.aggregate(pipeline))
        
        # Get total hits
        pipeline = [
            {'$match': {'is_active': True}},
            {'$group': {'_id': None, 'total_hits': {'$sum': '$hits'}}}
        ]
        hits_result = list(offer_model.collection.aggregate(pipeline))
        total_hits = hits_result[0]['total_hits'] if hits_result else 0
        
        return jsonify({
            'stats': {
                'total_offers': total_offers,
                'active_offers': active_offers,
                'pending_offers': pending_offers,
                'inactive_offers': inactive_offers,
                'total_hits': total_hits,
                'top_networks': top_networks
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get offers stats error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500
