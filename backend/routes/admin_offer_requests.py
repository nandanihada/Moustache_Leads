from flask import Blueprint, request, jsonify
from services.access_control_service import AccessControlService
from services.email_service import get_email_service
from models.offer import Offer
from models.user import User
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from database import db_instance
import logging
from datetime import datetime

admin_offer_requests_bp = Blueprint('admin_offer_requests', __name__)
access_service = AccessControlService()
offer_model = Offer()

@admin_offer_requests_bp.route('/offer-access-requests', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_all_access_requests():
    """Get all offer access requests with advanced filtering"""
    try:
        from datetime import datetime as dt
        
        # Get query parameters
        status = request.args.get('status', 'all')
        offer_id = request.args.get('offer_id', '')
        offer_name = request.args.get('offer_name', '')
        user_id = request.args.get('user_id', '')
        user_name = request.args.get('user_name', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        category = request.args.get('category', '')
        device = request.args.get('device', '')
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Build query
        query = {}
        
        # Status filter
        if status != 'all':
            query['status'] = status
        
        # Offer ID filter
        if offer_id:
            query['offer_id'] = {'$regex': offer_id, '$options': 'i'}
        
        # User ID filter
        if user_id:
            query['user_id'] = user_id
        
        # Date range filter
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query['$gte'] = dt.fromisoformat(date_from)
            if date_to:
                # Add one day to include the entire day
                date_to_dt = dt.fromisoformat(date_to)
                date_query['$lte'] = date_to_dt.replace(hour=23, minute=59, second=59)
            if date_query:
                query['requested_at'] = date_query
        
        # General search filter (searches username, email, offer_id)
        if search:
            query['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get requests collection
        requests_collection = db_instance.get_collection('affiliate_requests')
        offers_collection = db_instance.get_collection('offers')
        users_collection = db_instance.get_collection('users')
        
        # Get total count
        total = requests_collection.count_documents(query)
        
        # Get requests with pagination
        skip = (page - 1) * per_page
        requests = list(requests_collection.find(query)
                       .sort('requested_at', -1)
                       .skip(skip)
                       .limit(per_page))
        
        # Enrich requests with offer and user information
        for req in requests:
            # Convert ObjectId to string
            req['_id'] = str(req['_id'])
            
            # Get offer details
            offer = offers_collection.find_one({'offer_id': req['offer_id']})
            if offer:
                # Check if offer matches name filter
                if offer_name and offer_name.lower() not in offer.get('name', '').lower():
                    continue
                
                # Check if offer matches category filter
                if category and offer.get('category', '') != category:
                    continue
                
                # Check if offer matches device filter
                if device and offer.get('device_targeting', 'all') != device and device != 'all':
                    continue
                
                req['offer_details'] = {
                    'name': offer.get('name'),
                    'payout': offer.get('payout'),
                    'network': offer.get('network'),
                    'category': offer.get('category', ''),
                    'device_targeting': offer.get('device_targeting', 'all'),
                    'approval_settings': offer.get('approval_settings', {})
                }
            
            # Get user details
            user = users_collection.find_one({'_id': req['user_id']})
            if user:
                # Check if user matches name filter
                if user_name and user_name.lower() not in user.get('username', '').lower():
                    continue
                
                req['user_details'] = {
                    'username': user.get('username'),
                    'email': user.get('email'),
                    'account_type': user.get('account_type', 'basic')
                }
        
        # Filter out requests that didn't match secondary filters
        filtered_requests = [r for r in requests if 'offer_details' in r and 'user_details' in r]
        
        return safe_json_response({
            'requests': filtered_requests,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': len(filtered_requests),
                'pages': (len(filtered_requests) + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logging.error(f"Get access requests error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get access requests: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/approve', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def approve_access_request(request_id):
    """Approve an access request"""
    try:
        from bson import ObjectId
        
        data = request.get_json() or {}
        notes = data.get('notes', '')
        user = request.current_user
        
        # Get the request to find offer_id
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Try to find by request_id first, then by _id (ObjectId)
        access_request = requests_collection.find_one({'request_id': request_id})
        if not access_request:
            try:
                access_request = requests_collection.find_one({'_id': ObjectId(request_id)})
            except:
                pass
        
        if not access_request:
            return jsonify({'error': 'Access request not found'}), 404
        
        # Approve the request using the correct request_id from database
        actual_request_id = access_request.get('request_id')
        result = access_service.approve_access_request(
            actual_request_id, 
            access_request['offer_id']
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Update with admin details using the correct request_id
        requests_collection.update_one(
            {'_id': access_request['_id']},
            {
                '$set': {
                    'approved_by': str(user['_id']),
                    'approved_by_username': user.get('username'),
                    'approval_notes': notes,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Send approval email notification
        try:
            logging.info(f"📧 Preparing to send approval email for request {request_id}")
            
            # Get publisher email - use user_id field (not publisher_id)
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'_id': access_request.get('user_id')})
            
            logging.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get offer name
                offers_collection = db_instance.get_collection('offers')
                offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                
                logging.info(f"📧 Offer found: {offer_name}")
                logging.info(f"📧 Sending approval email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=offer_name,
                    status='approved',
                    reason='',
                    offer_id=str(access_request.get('offer_id', ''))
                )
                logging.info(f"✅ Approval email sent to {publisher['email']} for offer {offer_name}")
            else:
                logging.warning(f"⚠️ Publisher not found or no email: {access_request.get('user_id')}")
        except Exception as e:
            logging.error(f"❌ Failed to send approval email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Access request approved successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Approve access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve request: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/reject', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def reject_access_request(request_id):
    """Reject an access request"""
    try:
        from bson import ObjectId
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        user = request.current_user
        
        # Get the request to find offer_id
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Try to find by request_id first, then by _id (ObjectId)
        access_request = requests_collection.find_one({'request_id': request_id})
        if not access_request:
            try:
                access_request = requests_collection.find_one({'_id': ObjectId(request_id)})
            except:
                pass
        
        if not access_request:
            return jsonify({'error': 'Access request not found'}), 404
        
        # Reject the request using the correct request_id from database
        actual_request_id = access_request.get('request_id')
        result = access_service.reject_access_request(
            actual_request_id,
            access_request['offer_id'],
            reason
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Update with admin details using the correct _id
        requests_collection.update_one(
            {'_id': access_request['_id']},
            {
                '$set': {
                    'rejected_by': str(user['_id']),
                    'rejected_by_username': user.get('username'),
                    'rejection_reason': reason,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Send rejection email notification
        try:
            logging.info(f"📧 Preparing to send rejection email for request {request_id}")
            
            # Get publisher email - use user_id field (not publisher_id)
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'_id': access_request.get('user_id')})
            
            logging.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get offer name
                offers_collection = db_instance.get_collection('offers')
                offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                
                logging.info(f"📧 Offer found: {offer_name}")
                logging.info(f"📧 Sending rejection email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=offer_name,
                    status='rejected',
                    reason=reason,
                    offer_id=str(access_request.get('offer_id', ''))
                )
                logging.info(f"✅ Rejection email sent to {publisher['email']} for offer {offer_name}")
            else:
                logging.warning(f"⚠️ Publisher not found or no email: {access_request.get('user_id')}")
        except Exception as e:
            logging.error(f"❌ Failed to send rejection email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Access request rejected successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Reject access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject request: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_access_requests_stats():
    """Get statistics for access requests"""
    try:
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Get basic stats
        total_requests = requests_collection.count_documents({})
        pending_requests = requests_collection.count_documents({'status': 'pending'})
        approved_requests = requests_collection.count_documents({'status': 'approved'})
        rejected_requests = requests_collection.count_documents({'status': 'rejected'})
        
        # Get requests by offer
        pipeline = [
            {
                '$group': {
                    '_id': '$offer_id',
                    'total_requests': {'$sum': 1},
                    'pending': {'$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}},
                    'approved': {'$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}},
                    'rejected': {'$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}}
                }
            },
            {'$sort': {'total_requests': -1}},
            {'$limit': 10}
        ]
        
        requests_by_offer = list(requests_collection.aggregate(pipeline))
        
        # Enrich with offer names
        offers_collection = db_instance.get_collection('offers')
        for item in requests_by_offer:
            offer = offers_collection.find_one({'offer_id': item['_id']})
            if offer:
                item['offer_name'] = offer.get('name', 'Unknown')
                item['offer_payout'] = offer.get('payout', 0)
        
        return jsonify({
            'stats': {
                'total_requests': total_requests,
                'pending_requests': pending_requests,
                'approved_requests': approved_requests,
                'rejected_requests': rejected_requests,
                'approval_rate': round((approved_requests / total_requests * 100) if total_requests > 0 else 0, 2),
                'requests_by_offer': requests_by_offer
            }
        })
        
    except Exception as e:
        logging.error(f"Get access requests stats error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offers/<offer_id>/approval-settings', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def update_offer_approval_settings(offer_id):
    """Update approval settings for an offer"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate approval settings
        approval_settings = data.get('approval_settings', {})
        approval_type = approval_settings.get('type', 'auto_approve')
        
        if approval_type not in ['auto_approve', 'time_based', 'manual']:
            return jsonify({'error': 'Invalid approval type'}), 400
        
        # Update offer with new approval settings
        update_data = {
            'approval_settings': approval_settings,
            'updated_at': datetime.utcnow()
        }
        
        # If changing approval status
        if 'approval_status' in data:
            update_data['approval_status'] = data['approval_status']
        
        success, error = offer_model.update_offer(offer_id, update_data, str(request.current_user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update approval settings'}), 400
        
        return jsonify({
            'message': 'Approval settings updated successfully',
            'offer_id': offer_id
        })
        
    except Exception as e:
        logging.error(f"Update approval settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update approval settings: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offers/check-inactive', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def check_inactive_offers():
    """Manually trigger check for inactive offers that should be locked"""
    try:
        locked_offers = offer_model.check_and_lock_inactive_offers()
        
        return jsonify({
            'message': f'Checked inactive offers, locked {len(locked_offers)} offers',
            'locked_offers': locked_offers
        })
        
    except Exception as e:
        logging.error(f"Check inactive offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to check inactive offers: {str(e)}'}), 500
