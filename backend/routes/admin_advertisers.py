"""Admin Advertiser Management Routes"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import threading
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_verification_service import get_email_verification_service

admin_advertisers_bp = Blueprint('admin_advertisers', __name__)
logger = logging.getLogger(__name__)


def get_advertisers_collection():
    return db_instance.get_collection('advertisers')


@admin_advertisers_bp.route('/advertisers', methods=['GET'])
@token_required
@admin_required
def get_advertisers():
    """Get all advertisers with optional status filter"""
    try:
        logger.info("GET /advertisers called")
        collection = get_advertisers_collection()
        if collection is None:
            logger.error("Database collection is None")
            return jsonify({'error': 'Database not connected'}), 500
        
        status_filter = request.args.get('status')
        
        query = {}
        if status_filter and status_filter != 'all':
            query['account_status'] = status_filter
        
        advertisers = list(collection.find(query).sort('created_at', -1))
        
        for adv in advertisers:
            adv['_id'] = str(adv['_id'])
            if adv.get('created_at'):
                adv['created_at'] = adv['created_at'].isoformat()
            if adv.get('updated_at'):
                adv['updated_at'] = adv['updated_at'].isoformat()
            if adv.get('account_status_updated_at'):
                adv['account_status_updated_at'] = adv['account_status_updated_at'].isoformat()
            if adv.get('terms_agreed_at'):
                adv['terms_agreed_at'] = adv['terms_agreed_at'].isoformat()
            adv.pop('password', None)

        # Get counts
        pending_count = collection.count_documents({'account_status': 'pending_approval'})
        approved_count = collection.count_documents({'account_status': 'approved'})
        rejected_count = collection.count_documents({'account_status': 'rejected'})
        total_count = collection.count_documents({})
        
        logger.info(f"Returning {len(advertisers)} advertisers")
        
        return jsonify({
            'advertisers': advertisers,
            'total': len(advertisers),
            'counts': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'total': total_count
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting advertisers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get advertisers: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>', methods=['GET'])
@token_required
@admin_required
def get_advertiser_details(advertiser_id):
    """Get full details of a specific advertiser"""
    try:
        collection = get_advertisers_collection()
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        advertiser['_id'] = str(advertiser['_id'])
        if advertiser.get('created_at'):
            advertiser['created_at'] = advertiser['created_at'].isoformat()
        if advertiser.get('updated_at'):
            advertiser['updated_at'] = advertiser['updated_at'].isoformat()
        if advertiser.get('account_status_updated_at'):
            advertiser['account_status_updated_at'] = advertiser['account_status_updated_at'].isoformat()
        if advertiser.get('terms_agreed_at'):
            advertiser['terms_agreed_at'] = advertiser['terms_agreed_at'].isoformat()
        advertiser.pop('password', None)
        
        return jsonify({'advertiser': advertiser}), 200
        
    except Exception as e:
        logger.error(f"Error getting advertiser details: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_advertiser(advertiser_id):
    """Approve an advertiser account and send activation email"""
    try:
        admin_user = request.current_user
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        if advertiser.get('account_status') == 'approved':
            return jsonify({'error': 'Advertiser is already approved'}), 400
        
        result = collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {
                '$set': {
                    'account_status': 'approved',
                    'is_active': True,
                    'account_status_updated_at': datetime.utcnow(),
                    'approved_by': str(admin_user['_id']),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to approve advertiser'}), 500
        
        logger.info(f"Advertiser {advertiser_id} approved by admin {admin_user['_id']}")
        
        email_sent = False
        email_error = None
        try:
            verification_service = get_email_verification_service()
            email = advertiser.get('email')
            name = advertiser.get('first_name') or advertiser.get('company_name', 'Advertiser')
            company = advertiser.get('company_name', '')
            
            if verification_service.is_configured:
                email_sent = verification_service.send_advertiser_account_activated_email(email, name, company)
                if not email_sent:
                    email_error = "Email service returned false"
            else:
                email_error = "Email service not configured"
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            email_error = str(e)
        
        return jsonify({
            'message': 'Advertiser approved successfully',
            'advertiser_id': advertiser_id,
            'email_sent': email_sent,
            'email_error': email_error
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving advertiser: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/reject', methods=['POST'])
@token_required
@admin_required
def reject_advertiser(advertiser_id):
    """Reject an advertiser account"""
    try:
        admin_user = request.current_user
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        result = collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {
                '$set': {
                    'account_status': 'rejected',
                    'is_active': False,
                    'rejection_reason': reason,
                    'account_status_updated_at': datetime.utcnow(),
                    'rejected_by': str(admin_user['_id']),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to reject advertiser'}), 500
        
        logger.info(f"Advertiser {advertiser_id} rejected - Reason: {reason}")
        
        return jsonify({
            'message': 'Advertiser rejected',
            'advertiser_id': advertiser_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting advertiser: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/auto-approve-check', methods=['POST'])
@token_required
@admin_required
def run_advertiser_auto_approval():
    """Auto-approve advertisers pending > 3 days"""
    try:
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        
        advertisers_to_approve = list(collection.find({
            'account_status': 'pending_approval',
            'created_at': {'$lte': three_days_ago}
        }))
        
        approved_count = 0
        verification_service = get_email_verification_service()
        
        for advertiser in advertisers_to_approve:
            advertiser_id = advertiser['_id']
            
            result = collection.update_one(
                {'_id': advertiser_id},
                {
                    '$set': {
                        'account_status': 'approved',
                        'is_active': True,
                        'account_status_updated_at': datetime.utcnow(),
                        'auto_approved': True,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                approved_count += 1
                
                def send_email(email, name, company):
                    try:
                        verification_service.send_advertiser_account_activated_email(email, name, company)
                    except Exception as e:
                        logger.error(f"Failed to send auto-approval email: {e}")
                
                email = advertiser.get('email')
                name = advertiser.get('first_name') or advertiser.get('company_name', 'Advertiser')
                company = advertiser.get('company_name', '')
                threading.Thread(target=send_email, args=(email, name, company), daemon=True).start()
        
        return jsonify({
            'message': f'Auto-approval complete. {approved_count} advertisers approved.',
            'approved_count': approved_count,
            'checked_count': len(advertisers_to_approve)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in auto-approval: {str(e)}", exc_info=True)
        return jsonify({'error': f'Auto-approval failed: {str(e)}'}), 500
