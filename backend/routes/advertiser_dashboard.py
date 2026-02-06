"""Advertiser Dashboard Routes"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
import logging
import jwt
from functools import wraps
from config import Config
from database import db_instance
from models.campaign import get_campaign_model

advertiser_dashboard_bp = Blueprint('advertiser_dashboard', __name__)
logger = logging.getLogger(__name__)


def get_advertisers_collection():
    return db_instance.get_collection('advertisers')


def advertiser_token_required(f):
    """Decorator to require valid advertiser JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
            
            # Verify this is an advertiser token
            if data.get('user_type') != 'advertiser':
                return jsonify({'error': 'Invalid token type'}), 401
            
            advertiser_id = data.get('user_id')
            collection = get_advertisers_collection()
            
            if collection is None:
                return jsonify({'error': 'Database not connected'}), 500
            
            advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
            
            if not advertiser:
                return jsonify({'error': 'Advertiser not found'}), 401
            
            request.current_advertiser = advertiser
            request.advertiser_id = str(advertiser['_id'])
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return jsonify({'error': 'Token verification failed'}), 401
        
        return f(*args, **kwargs)
    return decorated


@advertiser_dashboard_bp.route('/dashboard/stats', methods=['GET'])
@advertiser_token_required
def get_dashboard_stats():
    """Get advertiser dashboard statistics"""
    try:
        advertiser = request.current_advertiser
        advertiser_id = request.advertiser_id
        
        # Check account status
        account_status = advertiser.get('account_status', 'pending_approval')
        
        if account_status != 'approved':
            return jsonify({
                'account_status': account_status,
                'message': 'Your account is under review. You will be able to create campaigns once approved.',
                'stats': None
            }), 200
        
        # Get campaign stats
        campaign_model = get_campaign_model()
        stats = campaign_model.get_campaign_stats(advertiser_id)
        
        return jsonify({
            'account_status': account_status,
            'stats': stats,
            'advertiser': {
                'company_name': advertiser.get('company_name', ''),
                'email': advertiser.get('email', ''),
                'first_name': advertiser.get('first_name', '')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns', methods=['GET'])
@advertiser_token_required
def get_campaigns():
    """Get all campaigns for the advertiser"""
    try:
        advertiser = request.current_advertiser
        advertiser_id = request.advertiser_id
        
        # Check account status
        if advertiser.get('account_status') != 'approved':
            return jsonify({
                'error': 'Account not approved',
                'campaigns': []
            }), 403
        
        status_filter = request.args.get('status')
        
        campaign_model = get_campaign_model()
        campaigns = campaign_model.get_advertiser_campaigns(advertiser_id, status_filter)
        
        # Format datetime fields
        for c in campaigns:
            if c.get('created_at'):
                c['created_at'] = c['created_at'].isoformat()
            if c.get('updated_at'):
                c['updated_at'] = c['updated_at'].isoformat()
        
        return jsonify({
            'campaigns': campaigns,
            'total': len(campaigns)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting campaigns: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get campaigns: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns', methods=['POST'])
@advertiser_token_required
def create_campaign():
    """Create a new campaign"""
    try:
        advertiser = request.current_advertiser
        advertiser_id = request.advertiser_id
        
        # Check account status
        if advertiser.get('account_status') != 'approved':
            return jsonify({'error': 'Account not approved'}), 403
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if not data.get('name'):
            return jsonify({'error': 'Campaign name is required'}), 400
        
        campaign_model = get_campaign_model()
        campaign = campaign_model.create_campaign(advertiser_id, data)
        
        # Format datetime fields
        if campaign.get('created_at'):
            campaign['created_at'] = campaign['created_at'].isoformat()
        if campaign.get('updated_at'):
            campaign['updated_at'] = campaign['updated_at'].isoformat()
        
        logger.info(f"Campaign created: {campaign['_id']} by advertiser {advertiser_id}")
        
        return jsonify({
            'message': 'Campaign created successfully',
            'campaign': campaign
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating campaign: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create campaign: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns/<campaign_id>', methods=['GET'])
@advertiser_token_required
def get_campaign(campaign_id):
    """Get a specific campaign"""
    try:
        advertiser_id = request.advertiser_id
        
        campaign_model = get_campaign_model()
        campaign = campaign_model.get_campaign(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        # Verify ownership
        if campaign.get('advertiser_id') != advertiser_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Format datetime fields
        if campaign.get('created_at'):
            campaign['created_at'] = campaign['created_at'].isoformat()
        if campaign.get('updated_at'):
            campaign['updated_at'] = campaign['updated_at'].isoformat()
        
        return jsonify({'campaign': campaign}), 200
        
    except Exception as e:
        logger.error(f"Error getting campaign: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get campaign: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns/<campaign_id>', methods=['PUT'])
@advertiser_token_required
def update_campaign(campaign_id):
    """Update a campaign"""
    try:
        advertiser_id = request.advertiser_id
        
        campaign_model = get_campaign_model()
        campaign = campaign_model.get_campaign(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        # Verify ownership
        if campaign.get('advertiser_id') != advertiser_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        success = campaign_model.update_campaign(campaign_id, data)
        
        if not success:
            return jsonify({'error': 'Failed to update campaign'}), 500
        
        logger.info(f"Campaign updated: {campaign_id}")
        
        return jsonify({'message': 'Campaign updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error updating campaign: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update campaign: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns/<campaign_id>', methods=['DELETE'])
@advertiser_token_required
def delete_campaign(campaign_id):
    """Delete a campaign"""
    try:
        advertiser_id = request.advertiser_id
        
        campaign_model = get_campaign_model()
        campaign = campaign_model.get_campaign(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        # Verify ownership
        if campaign.get('advertiser_id') != advertiser_id:
            return jsonify({'error': 'Access denied'}), 403
        
        success = campaign_model.delete_campaign(campaign_id)
        
        if not success:
            return jsonify({'error': 'Failed to delete campaign'}), 500
        
        logger.info(f"Campaign deleted: {campaign_id}")
        
        return jsonify({'message': 'Campaign deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting campaign: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete campaign: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/campaigns/<campaign_id>/status', methods=['PUT'])
@advertiser_token_required
def update_campaign_status(campaign_id):
    """Update campaign status (pause/resume)"""
    try:
        advertiser_id = request.advertiser_id
        
        campaign_model = get_campaign_model()
        campaign = campaign_model.get_campaign(campaign_id)
        
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404
        
        # Verify ownership
        if campaign.get('advertiser_id') != advertiser_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
        
        success = campaign_model.update_campaign_status(campaign_id, new_status)
        
        if not success:
            return jsonify({'error': 'Invalid status or update failed'}), 400
        
        logger.info(f"Campaign {campaign_id} status changed to {new_status}")
        
        return jsonify({
            'message': f'Campaign status updated to {new_status}',
            'status': new_status
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating campaign status: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update status: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/profile', methods=['GET'])
@advertiser_token_required
def get_profile():
    """Get advertiser profile"""
    try:
        advertiser = request.current_advertiser
        
        # Remove sensitive fields
        profile = {
            '_id': str(advertiser['_id']),
            'first_name': advertiser.get('first_name', ''),
            'last_name': advertiser.get('last_name', ''),
            'email': advertiser.get('email', ''),
            'phone_number': advertiser.get('phone_number', ''),
            'company_name': advertiser.get('company_name', ''),
            'website_url': advertiser.get('website_url', ''),
            'country': advertiser.get('country', ''),
            'city': advertiser.get('city', ''),
            'account_status': advertiser.get('account_status', 'pending_approval'),
            'email_verified': advertiser.get('email_verified', False),
            'created_at': advertiser.get('created_at').isoformat() if advertiser.get('created_at') else None
        }
        
        return jsonify({'profile': profile}), 200
        
    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500
