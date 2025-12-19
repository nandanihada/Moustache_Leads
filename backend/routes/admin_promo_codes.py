"""
Admin Promo Code Management Routes
Handles creation, editing, and management of promotional codes
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from models.promo_code import PromoCode
from database import db_instance
from services.email_service import get_email_service
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

admin_promo_codes_bp = Blueprint('admin_promo_codes', __name__)


@admin_promo_codes_bp.route('/api/admin/promo-codes', methods=['POST'])
@token_required
@subadmin_or_admin_required('promo-codes')
def create_promo_code():
    """Create a new promo code and notify all publishers"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        promo_code_model = PromoCode()
        promo_code_doc, error = promo_code_model.create_promo_code(data, current_user['_id'])
        
        if error:
            return jsonify({'error': error}), 400
        
        logger.info(f"✅ Admin {current_user.get('username')} created promo code: {promo_code_doc['code']}")
        
        # Send email to all publishers about new promo code
        try:
            users_collection = db_instance.get_collection('users')
            publishers = users_collection.find({'role': 'publisher'})
            email_service = get_email_service()
            
            email_count = 0
            for publisher in publishers:
                if publisher.get('email'):
                    try:
                        email_service.send_new_promo_code_available(
                            recipient_email=publisher['email'],
                            code=promo_code_doc['code'],
                            bonus_amount=promo_code_doc['bonus_amount'],
                            bonus_type=promo_code_doc['bonus_type'],
                            description=promo_code_doc.get('description', '')
                        )
                        email_count += 1
                    except Exception as e:
                        logger.error(f"Failed to send email to {publisher['email']}: {str(e)}")
            
            logger.info(f"📧 New promo code notification sent to {email_count} publishers")
        except Exception as e:
            logger.error(f"Failed to send promo code notifications: {str(e)}")
        
        return jsonify({
            'message': 'Promo code created successfully and notifications sent',
            'promo_code': promo_code_doc,
            'emails_sent': email_count if 'email_count' in locals() else 0
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Error creating promo code: {str(e)}")
        return jsonify({'error': f'Error creating promo code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_promo_codes():
    """Get all promo codes with filtering and pagination"""
    try:
        current_user = request.current_user
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        # Get filter params
        status = request.args.get('status')
        search = request.args.get('search')
        
        promo_code_model = PromoCode()
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        if search:
            query['$or'] = [
                {'code': {'$regex': search, '$options': 'i'}},
                {'name': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get collection
        collection = db_instance.get_collection('promo_codes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Auto-expire codes that have passed their end_date
        from datetime import datetime
        now = datetime.utcnow()
        collection.update_many(
            {
                'status': 'active',
                'end_date': {'$lt': now}
            },
            {
                '$set': {
                    'status': 'expired',
                    'updated_at': now
                }
            }
        )
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get promo codes
        codes = list(collection.find(query)
                    .sort('created_at', -1)
                    .skip(skip)
                    .limit(limit))
        
        # Convert ObjectIds to strings
        for code in codes:
            code['_id'] = str(code['_id'])
            code['created_by'] = str(code['created_by'])
        
        return jsonify({
            'promo_codes': codes,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching promo codes: {str(e)}")
        return jsonify({'error': f'Error fetching promo codes: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_promo_code(code_id):
    """Get a specific promo code"""
    try:
        promo_code_model = PromoCode()
        code_obj = promo_code_model.get_promo_code_by_id(code_id)
        
        if not code_obj:
            return jsonify({'error': 'Promo code not found'}), 404
        
        return jsonify({
            'promo_code': code_obj
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching promo code: {str(e)}")
        return jsonify({'error': f'Error fetching promo code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('promo-codes')
def update_promo_code(code_id):
    """Update a promo code"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        promo_code_model = PromoCode()
        success, error = promo_code_model.update_promo_code(code_id, data, current_user['_id'])
        
        if not success:
            return jsonify({'error': error or 'Failed to update promo code'}), 400
        
        # Get updated code
        code_obj = promo_code_model.get_promo_code_by_id(code_id)
        
        logger.info(f"✅ Admin {current_user.get('username')} updated promo code: {code_obj['code']}")
        
        return jsonify({
            'message': 'Promo code updated successfully',
            'promo_code': code_obj
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error updating promo code: {str(e)}")
        return jsonify({'error': f'Error updating promo code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/pause', methods=['POST'])
@token_required
@subadmin_or_admin_required('promo-codes')
def pause_promo_code(code_id):
    """Pause a promo code"""
    try:
        current_user = request.current_user
        promo_code_model = PromoCode()
        
        success, error = promo_code_model.pause_promo_code(code_id)
        
        if not success:
            return jsonify({'error': error or 'Failed to pause promo code'}), 400
        
        code_obj = promo_code_model.get_promo_code_by_id(code_id)
        
        logger.info(f"✅ Admin {current_user.get('username')} paused promo code: {code_obj['code']}")
        
        return jsonify({
            'message': 'Promo code paused successfully',
            'promo_code': code_obj
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error pausing promo code: {str(e)}")
        return jsonify({'error': f'Error pausing promo code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/resume', methods=['POST'])
@token_required
@subadmin_or_admin_required('promo-codes')
def resume_promo_code(code_id):
    """Resume a paused promo code"""
    try:
        current_user = request.current_user
        promo_code_model = PromoCode()
        
        success, error = promo_code_model.resume_promo_code(code_id)
        
        if not success:
            return jsonify({'error': error or 'Failed to resume promo code'}), 400
        
        code_obj = promo_code_model.get_promo_code_by_id(code_id)
        
        logger.info(f"✅ Admin {current_user.get('username')} resumed promo code: {code_obj['code']}")
        
        return jsonify({
            'message': 'Promo code resumed successfully',
            'promo_code': code_obj
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error resuming promo code: {str(e)}")
        return jsonify({'error': f'Error resuming promo code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/analytics', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_promo_code_analytics(code_id):
    """Get analytics for a promo code"""
    try:
        promo_code_model = PromoCode()
        analytics = promo_code_model.get_promo_code_analytics(code_id)
        
        if not analytics:
            return jsonify({'error': 'Promo code not found'}), 404
        
        return jsonify({
            'analytics': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching analytics: {str(e)}")
        return jsonify({'error': f'Error fetching analytics: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/users', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_promo_code_users(code_id):
    """Get users who applied a promo code"""
    try:
        from bson import ObjectId
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        collection = db_instance.get_collection('user_promo_codes')
        if not collection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Get total count
        total = collection.count_documents({'promo_code_id': ObjectId(code_id)})
        
        # Get users
        users = list(collection.find({'promo_code_id': ObjectId(code_id)})
                    .sort('applied_at', -1)
                    .skip(skip)
                    .limit(limit))
        
        # Convert ObjectIds to strings
        for user in users:
            user['_id'] = str(user['_id'])
            user['user_id'] = str(user['user_id'])
            user['promo_code_id'] = str(user['promo_code_id'])
        
        return jsonify({
            'users': users,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching users: {str(e)}")
        return jsonify({'error': f'Error fetching users: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/bulk-apply', methods=['POST'])
@token_required
@subadmin_or_admin_required('promo-codes')
def bulk_apply_to_offers():
    """Apply a promo code to multiple offers"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data or 'code_id' not in data or 'offer_ids' not in data:
            return jsonify({'error': 'code_id and offer_ids are required'}), 400
        
        code_id = data['code_id']
        offer_ids = data['offer_ids']
        
        if not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids must be a non-empty array'}), 400
        
        promo_code_model = PromoCode()
        code_obj = promo_code_model.get_promo_code_by_id(code_id)
        
        if not code_obj:
            return jsonify({'error': 'Promo code not found'}), 404
        
        # Update applicable offers
        from bson import ObjectId
        success, error = promo_code_model.update_promo_code(
            code_id,
            {'applicable_offers': offer_ids},
            current_user['_id']
        )
        
        if not success:
            return jsonify({'error': error or 'Failed to apply code to offers'}), 400
        
        logger.info(f"✅ Admin {current_user.get('username')} applied promo code {code_obj['code']} to {len(offer_ids)} offers")
        
        return jsonify({
            'message': f'Promo code applied to {len(offer_ids)} offers',
            'code': code_obj['code'],
            'offers_count': len(offer_ids)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error bulk applying promo code: {str(e)}")
        return jsonify({'error': f'Error applying code: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/offer-analytics', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_offer_analytics(code_id):
    """Get breakdown of which offers a promo code was used on"""
    try:
        promo_code_model = PromoCode()
        analytics = promo_code_model.get_offer_analytics(code_id)
        
        if not analytics:
            return jsonify({'error': 'Promo code not found or no data available'}), 404
        
        return jsonify({
            'analytics': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching offer analytics: {str(e)}")
        return jsonify({'error': f'Error fetching analytics: {str(e)}'}), 500


@admin_promo_codes_bp.route('/api/admin/promo-codes/<code_id>/user-applications', methods=['GET'])
@token_required
@subadmin_or_admin_required('promo-codes')
def get_user_applications(code_id):
    """Get detailed list of user applications with offer information"""
    try:
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        promo_code_model = PromoCode()
        applications, total = promo_code_model.get_user_applications(code_id, skip, limit)
        
        return jsonify({
            'applications': applications,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit if total > 0 else 0
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching user applications: {str(e)}")
        return jsonify({'error': f'Error fetching applications: {str(e)}'}), 500
