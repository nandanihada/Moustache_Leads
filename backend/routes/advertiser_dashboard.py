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
        
        # Get advertiser balance and total deposited
        balance = float(advertiser.get('balance', 0.0))
        tx_col = db_instance.get_collection('wallet_transactions')
        total_deposited = 0.0
        if tx_col is not None:
            pipeline = [
                {'$match': {'advertiser_id': advertiser_id, 'type': 'deposit', 'status': 'confirmed'}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]
            agg = list(tx_col.aggregate(pipeline))
            if agg:
                total_deposited = float(agg[0].get('total', 0.0))

        return jsonify({
            'account_status': account_status,
            'stats': stats,
            'advertiser': {
                'company_name': advertiser.get('company_name', ''),
                'email': advertiser.get('email', ''),
                'first_name': advertiser.get('first_name', ''),
                'balance': balance,
                'total_deposited': total_deposited
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


@advertiser_dashboard_bp.route('/deposit', methods=['POST'])
@advertiser_token_required
def deposit_funds():
    """Deposit funds to advertiser account (manual/USDT fallback)"""
    try:
        advertiser_id = request.advertiser_id
        collection = get_advertisers_collection()
        
        data = request.get_json()
        amount = float(data.get('amount', 0))
        
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
            
        collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$inc': {'balance': amount}}
        )
        
        # Log to wallet transaction history if collection exists
        tx_collection = db_instance.get_collection('wallet_transactions')
        if tx_collection is not None:
            tx_collection.insert_one({
                'advertiser_id': advertiser_id,
                'type': 'deposit',
                'method': 'card',
                'amount': amount,
                'status': 'confirmed',
                'external_ref': 'CARD-' + datetime.utcnow().strftime('%Y%m%d%H%M%S'),
                'created_at': datetime.utcnow()
            })
        
        # Get updated advertiser
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        new_balance = float(advertiser.get('balance', 0.0))
        
        logger.info(f"Advertiser {advertiser_id} deposited ${amount}. New balance: ${new_balance}")
        
        return jsonify({
            'message': 'Deposit successful',
            'balance': new_balance
        }), 200
        
    except Exception as e:
        logger.error(f"Error depositing funds: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to deposit: {str(e)}'}), 500


def get_paypal_access_token():
    """Helper to authenticate with PayPal API and retrieve bearer token"""
    import requests
    from requests.auth import HTTPBasicAuth
    
    client_id = Config.PAYPAL_CLIENT_ID
    client_secret = Config.PAYPAL_CLIENT_SECRET
    
    if not client_secret or client_secret == "":
        return None
        
    mode = Config.PAYPAL_MODE or "sandbox"
    base_url = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"
    
    try:
        url = f"{base_url}/v1/oauth2/token"
        headers = {"Accept": "application/json", "Accept-Language": "en_US"}
        data = {"grant_type": "client_credentials"}
        response = requests.post(url, auth=HTTPBasicAuth(client_id, client_secret), headers=headers, data=data, timeout=10)
        
        if response.status_code == 200:
            return response.json().get("access_token")
    except Exception as e:
        logger.error(f"Error getting PayPal access token: {str(e)}")
    return None


@advertiser_dashboard_bp.route('/paypal/config', methods=['GET'])
@advertiser_token_required
def get_paypal_config():
    """Retrieve PayPal Client ID for the frontend dynamically"""
    return jsonify({
        'clientId': Config.PAYPAL_CLIENT_ID or "sb",
        'mode': Config.PAYPAL_MODE or "sandbox"
    }), 200


@advertiser_dashboard_bp.route('/paypal/create-order', methods=['POST'])
@advertiser_token_required
def create_paypal_order():
    """Create a PayPal checkout order"""
    try:
        data = request.get_json()
        amount = float(data.get('amount', 0))
        
        if amount < 25:
            return jsonify({'error': 'Minimum deposit is $25'}), 400
            
        access_token = get_paypal_access_token()
        
        if not access_token:
            # Sandbox/Mock fallback if no secret configured
            import uuid
            mock_order_id = f"MOCK-PAYPAL-{uuid.uuid4().hex[:8].upper()}"
            return jsonify({'id': mock_order_id, 'status': 'CREATED'}), 200
            
        mode = Config.PAYPAL_MODE or "sandbox"
        base_url = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"
        
        import requests
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {
                    "currency_code": "USD",
                    "value": f"{amount:.2f}"
                },
                "description": "Moustache Leads Advertiser Wallet Deposit"
            }]
        }
        
        url = f"{base_url}/v2/checkout/orders"
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code in [200, 201]:
            order_data = response.json()
            return jsonify({'id': order_data.get('id'), 'status': order_data.get('status')}), 200
        else:
            logger.error(f"PayPal create order failed: {response.text}")
            return jsonify({'error': 'Failed to create PayPal order'}), 400
            
    except Exception as e:
        logger.error(f"PayPal create order exception: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@advertiser_dashboard_bp.route('/paypal/capture-order', methods=['POST'])
@advertiser_token_required
def capture_paypal_order():
    """Capture a completed PayPal checkout order and update balance"""
    try:
        advertiser_id = request.advertiser_id
        collection = get_advertisers_collection()
        
        data = request.get_json()
        order_id = data.get('orderID')
        amount = float(data.get('amount', 0))
        
        if not order_id:
            return jsonify({'error': 'Order ID is required'}), 400
            
        is_mock = order_id.startswith("MOCK-PAYPAL-") or not Config.PAYPAL_CLIENT_SECRET
        
        if is_mock:
            # Mock success path
            if amount <= 0:
                amount = 50.0  # Fallback
            status = "COMPLETED"
        else:
            access_token = get_paypal_access_token()
            if not access_token:
                return jsonify({'error': 'PayPal authentication failed'}), 500
                
            mode = Config.PAYPAL_MODE or "sandbox"
            base_url = "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"
            
            import requests
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            url = f"{base_url}/v2/checkout/orders/{order_id}/capture"
            response = requests.post(url, headers=headers, timeout=15)
            
            if response.status_code not in [200, 201]:
                logger.error(f"PayPal capture order failed: {response.text}")
                return jsonify({'error': 'PayPal capture payment failed'}), 400
                
            order_data = response.json()
            status = order_data.get('status')
            
            if status != "COMPLETED":
                return jsonify({'error': f'PayPal payment status: {status}'}), 400
                
            try:
                amount_str = order_data['purchase_units'][0]['payments']['captures'][0]['amount']['value']
                amount = float(amount_str)
            except Exception as parse_err:
                logger.error(f"Failed to parse PayPal captured amount: {str(parse_err)}")
                
        if amount <= 0:
            return jsonify({'error': 'Invalid transaction amount'}), 400
            
        # Increment advertiser balance
        collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$inc': {'balance': amount}}
        )
        
        # Get updated advertiser
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        new_balance = float(advertiser.get('balance', 0.0))
        
        # Log to wallet transaction history if collection exists
        tx_collection = db_instance.get_collection('wallet_transactions')
        if tx_collection is not None:
            tx_collection.insert_one({
                'advertiser_id': advertiser_id,
                'type': 'deposit',
                'method': 'paypal',
                'amount': amount,
                'status': 'confirmed',
                'external_ref': order_id,
                'created_at': datetime.utcnow()
            })
            
        logger.info(f"PayPal Order {order_id} captured. Advertiser {advertiser_id} balance credited with ${amount}. New balance: ${new_balance}")
        
        return jsonify({
            'message': 'Payment captured successfully',
            'balance': new_balance
        }), 200
        
    except Exception as e:
        logger.error(f"PayPal capture exception: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

