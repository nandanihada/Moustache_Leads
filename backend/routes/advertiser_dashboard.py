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
        
        # Get advertiser balance - compute dynamically as (deposited - spent)
        # This ensures balance is always accurate even if historical deductions were missed
        stored_balance = float(advertiser.get('balance', 0.0))
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
        
        # Calculate actual spent from conversions using advertiser_rate
        total_spent = float(stats.get('total_spent', 0.0))
        
        # Use computed balance (deposited - spent) if it's more accurate than stored balance
        # This covers cases where historical conversions didn't trigger balance deductions
        computed_balance = total_deposited - total_spent
        if total_deposited > 0:
            balance = computed_balance
        else:
            balance = stored_balance

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
        
        # Enrich campaigns with real-time stats from clicks/conversions collections
        db = db_instance.get_db()
        if db is not None:
            for c in campaigns:
                campaign_id = c.get('_id') or ''
                # Find the offer linked to this campaign (try both campaign_id and campaign_request_id)
                offer = db.offers.find_one(
                    {'$or': [
                        {'campaign_id': str(campaign_id), 'offer_source': 'advertiser'},
                        {'campaign_request_id': str(campaign_id), 'offer_source': 'advertiser'}
                    ]},
                    {'offer_id': 1, 'advertiser_rate': 1, 'payout': 1}
                )
                if offer and offer.get('offer_id'):
                    offer_id = offer['offer_id']
                    # Count real clicks
                    real_clicks = db.clicks.count_documents({'offer_id': offer_id})
                    # Count real conversions
                    real_conversions = db.conversions.count_documents({'offer_id': offer_id})
                    # Calculate spend using advertiser_rate if available
                    adv_rate = offer.get('advertiser_rate')
                    if adv_rate and float(adv_rate) > 0:
                        real_spent = real_conversions * float(adv_rate)
                    else:
                        # Fallback: use campaign bid_amount or sum from conversions
                        bid_amount = float(c.get('bid_amount', 0))
                        if bid_amount > 0:
                            real_spent = real_conversions * bid_amount
                        else:
                            spend_pipeline = [
                                {'$match': {'offer_id': offer_id}},
                                {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': {'$ifNull': ['$payout', 0]}}}}}
                            ]
                            spend_result = list(db.conversions.aggregate(spend_pipeline))
                            real_spent = spend_result[0]['total'] if spend_result else 0.0
                    
                    c['clicks'] = real_clicks
                    c['conversions'] = real_conversions
                    c['spent'] = round(real_spent, 2)
                    c['impressions'] = real_clicks  # Use clicks as proxy for impressions
        
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
            'created_at': advertiser.get('created_at').isoformat() if advertiser.get('created_at') else None,
            'unique_postback_key': advertiser.get('unique_postback_key'),
            'postback_receiver_url': advertiser.get('postback_receiver_url'),
            'postback_parameters': advertiser.get('postback_parameters'),
            'postback_parameter_mappings': advertiser.get('postback_parameter_mappings'),
            'balance': float(advertiser.get('balance', 0.0))
        }
        
        return jsonify({'profile': profile}), 200
        
    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500


@advertiser_dashboard_bp.route('/transactions', methods=['GET'])
@advertiser_token_required
def get_transactions():
    """Get wallet transactions history for the logged-in advertiser"""
    try:
        advertiser_id = request.advertiser_id
        tx_collection = db_instance.get_collection('wallet_transactions')
        if tx_collection is None:
            return jsonify({'transactions': []}), 200
            
        txs = list(tx_collection.find({'advertiser_id': advertiser_id}).sort('created_at', -1))
        
        transactions_list = []
        for tx in txs:
            transactions_list.append({
                'id': str(tx['_id']),
                'type': tx.get('type', 'deposit'),
                'method': tx.get('method', 'usdt'),
                'amount': float(tx.get('amount', 0.0)),
                'deposit_amount': float(tx.get('deposit_amount', tx.get('amount', 0.0))),
                'charge_amount': float(tx.get('charge_amount', tx.get('amount', 0.0))),
                'fee': float(tx.get('fee', 0.0)),
                'bonus': float(tx.get('bonus', 0.0)),
                'status': tx.get('status', 'pending'),
                'external_ref': tx.get('external_ref', ''),
                'created_at': tx.get('created_at').isoformat() if tx.get('created_at') else None
            })
            
        return jsonify({'transactions': transactions_list}), 200
        
    except Exception as e:
        logger.error(f"Error getting transactions: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get transactions: {str(e)}'}), 500


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


@advertiser_dashboard_bp.route('/deposit/manual', methods=['POST'])
@advertiser_token_required
def deposit_manual_funds():
    """Submit a manual deposit (USDT/crypto) request for admin verification"""
    try:
        advertiser_id = request.advertiser_id
        
        data = request.get_json()
        amount = float(data.get('amount', 0))
        method = data.get('method', 'usdt')
        txid = data.get('txid', '').strip()
        
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        if not txid:
            return jsonify({'error': 'Transaction hash (TXID) is required'}), 400
            
        tx_collection = db_instance.get_collection('wallet_transactions')
        if tx_collection is not None:
            # Check for duplicate txid to prevent double spending
            duplicate = tx_collection.find_one({'external_ref': txid})
            if duplicate:
                return jsonify({'error': 'This transaction hash (TXID) has already been submitted'}), 400
                
            tx_collection.insert_one({
                'advertiser_id': advertiser_id,
                'type': 'deposit',
                'method': method,
                'amount': amount,
                'deposit_amount': float(data.get('deposit_amount', amount)),
                'charge_amount': float(data.get('charge_amount', amount)),
                'fee': float(data.get('fee', 0.0)),
                'bonus': float(data.get('bonus', 0.0)),
                'status': 'pending',
                'external_ref': txid,
                'created_at': datetime.utcnow()
            })
            
        logger.info(f"Manual {method} deposit of ${amount} submitted by advertiser {advertiser_id}. TXID: {txid}")
        
        return jsonify({
            'message': 'Deposit request submitted successfully. It will be credited after admin verification.',
            'success': True
        }), 200
        
    except Exception as e:
        logger.error(f"Error submitting manual deposit: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to submit deposit: {str(e)}'}), 500


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
                captured_amount = float(amount_str)
                
                # Check expected fee and charge
                expected_fee_pct = 0.07 if amount < 1000 else (0.03 if amount < 2000 else 0.02)
                expected_charge = amount + (amount * expected_fee_pct)
                
                # Verify captured_amount matches expected_charge within a small margin
                if abs(captured_amount - expected_charge) > 0.1:
                    logger.warning(f"PayPal captured amount {captured_amount} does not match expected charge {expected_charge} for deposit {amount}. Crediting calculated deposit amount instead.")
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


@advertiser_dashboard_bp.route('/postback', methods=['POST'])
@advertiser_token_required
def save_own_postback():
    """Advertiser saves or updates their own postback configuration"""
    try:
        data = request.get_json() or {}
        parameters = data.get('parameters', [])
        custom_params = data.get('custom_params', [])
        parameter_mappings = data.get('parameter_mappings', {})
        
        advertiser = request.current_advertiser
        advertiser_id = request.advertiser_id
        
        unique_key = advertiser.get('unique_postback_key')
        if not unique_key:
            import secrets
            unique_key = secrets.token_urlsafe(24)
            
        # Build base URL and full URL
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        all_params = parameters + custom_params
        
        if all_params:
            param_parts = []
            for param in all_params:
                if param.strip():
                    partner_macro = parameter_mappings.get(param.strip(), param.strip())
                    param_parts.append(f"{param.strip()}={{{partner_macro}}}")
            if param_parts:
                full_url = f"{base_url}?{'&'.join(param_parts)}"
            else:
                full_url = base_url
        else:
            full_url = base_url
            
        collection = get_advertisers_collection()
        collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$set': {
                'unique_postback_key': unique_key,
                'postback_receiver_url': full_url,
                'postback_parameters': parameters,
                'postback_custom_params': custom_params,
                'postback_parameter_mappings': parameter_mappings,
                'updated_at': datetime.utcnow()
            }}
        )
        
        # Also sync to partners collection so name resolves correctly in received postback logs
        partners_collection = db_instance.get_collection('partners')
        if partners_collection is not None:
            partner_id = f"adv_{advertiser_id}"
            partner_name = advertiser.get('company_name') or f"{advertiser.get('first_name', '')} {advertiser.get('last_name', '')}".strip()
            if not partner_name:
                partner_name = f"Advertiser {advertiser_id}"
            partner_name = f"{partner_name} (Advertiser)"
            
            partners_collection.update_one(
                {'partner_id': partner_id},
                {'$set': {
                    'partner_id': partner_id,
                    'partner_name': partner_name,
                    'postback_url': '',
                    'method': 'GET',
                    'status': 'active',
                    'description': f"Advertiser postback for {partner_name}",
                    'unique_postback_key': unique_key,
                    'updated_at': datetime.utcnow()
                }},
                upsert=True
            )
            
        return jsonify({
            'message': 'Postback configuration saved successfully',
            'unique_key': unique_key,
            'full_url': full_url,
            'parameters': parameters,
            'custom_params': custom_params,
            'parameter_mappings': parameter_mappings
        }), 200
        
    except Exception as e:
        logger.error(f"Error saving own postback: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@advertiser_dashboard_bp.route('/reports', methods=['GET'])
@advertiser_token_required
def get_reports():
    """Get performance reports for the advertiser"""
    try:
        advertiser_id = request.advertiser_id
        db = db_instance.get_db()
        
        # Get query parameters
        date_range_str = request.args.get('range', 'last_7_days')
        breakdown = request.args.get('breakdown', 'date')
        
        # Parse date range
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        
        if date_range_str == 'today':
            start_date = datetime(now.year, now.month, now.day)
            end_date = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
        elif date_range_str == 'yesterday':
            yesterday = now - timedelta(days=1)
            start_date = datetime(yesterday.year, yesterday.month, yesterday.day)
            end_date = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59, 999999)
        elif date_range_str == 'last_7_days':
            start_date = now - timedelta(days=7)
            end_date = now
        elif date_range_str == 'last_30_days':
            start_date = now - timedelta(days=30)
            end_date = now
        elif date_range_str == 'this_month':
            start_date = datetime(now.year, now.month, 1)
            end_date = now
        else: # all time
            start_date = datetime(2020, 1, 1)
            end_date = now
            
        # Get advertiser offers/campaigns
        # Include both advertiser-sourced offers AND offers mapped via partner_id
        adv_partner_id = f"adv_{advertiser_id}"
        offers = list(db.offers.find(
            {'$or': [
                {'offer_source': 'advertiser', 'advertiser_id': advertiser_id},
                {'partner_id': adv_partner_id}
            ]},
            {'offer_id': 1, 'name': 1, 'payout': 1, 'advertiser_rate': 1, 'campaign_request_id': 1, 'campaign_id': 1, 'offer_source': 1}
        ))
        offer_ids = [o.get('offer_id') for o in offers if o.get('offer_id')]
        offer_names = {o.get('offer_id'): o.get('name', 'Unknown Offer') for o in offers}
        
        if not offer_ids:
            return jsonify({
                'kpis': {
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'conversions': 0,
                    'cr': 0,
                    'spend': 0,
                    'avg_cpa': 0
                },
                'breakdown': [],
                'conversions': []
            }), 200

        # Query Clicks
        click_query = {
            'offer_id': {'$in': offer_ids},
            'click_time': {'$gte': start_date, '$lte': end_date}
        }
        clicks = list(db.clicks.find(click_query, {
            'click_time': 1, 'offer_id': 1, 'country': 1, 'country_code': 1, 'device_type': 1
        }))

        # Query Conversions
        conv_query = {
            'offer_id': {'$in': offer_ids},
            'conversion_time': {'$gte': start_date, '$lte': end_date}
        }
        conversions = list(db.conversions.find(conv_query, {
            'conversion_time': 1, 'offer_id': 1, 'country': 1, 'country_code': 1, 'device_type': 1,
            'payout': 1, 'conversion_id': 1, 'status': 1, 'verified': 1
        }))
        
        # Query Impressions/Views
        view_query = {
            'offer_id': {'$in': offer_ids},
            'timestamp': {'$gte': start_date, '$lte': end_date}
        }
        views = list(db.offer_views.find(view_query, {
            'timestamp': 1, 'offer_id': 1
        }))

        # Calculate KPIs
        total_impressions = len(views)
        total_clicks = len(clicks)
        total_conversions = len(conversions)
        
        # Build offer payout map for fallback when conversion payout is 0
        # Use advertiser_rate if set, otherwise check linked campaign bid_amount, finally fallback to offer payout
        offer_payouts = {}
        for o in offers:
            adv_rate = o.get('advertiser_rate')
            if adv_rate and float(adv_rate) > 0:
                offer_payouts[o.get('offer_id')] = float(adv_rate)
            else:
                # Fallback: check if this offer has a linked campaign with bid_amount
                campaign_id = o.get('campaign_request_id') or o.get('campaign_id')
                if campaign_id and o.get('offer_source') == 'advertiser':
                    try:
                        from bson import ObjectId as _BsonObjId
                        camp = db.campaigns.find_one({'_id': _BsonObjId(campaign_id)}, {'bid_amount': 1})
                        if camp and camp.get('bid_amount') and float(camp['bid_amount']) > 0:
                            offer_payouts[o.get('offer_id')] = float(camp['bid_amount'])
                            continue
                    except Exception:
                        pass
                offer_payouts[o.get('offer_id')] = float(o.get('payout') or 0)
        
        total_spend = 0.0
        for c in conversions:
            try:
                # For advertiser reports, use advertiser_rate from offer (not publisher payout)
                offer_rate = offer_payouts.get(c.get('offer_id'), 0.0)
                if offer_rate > 0:
                    total_spend += offer_rate
                else:
                    conv_payout = float(c.get('payout') or 0.0)
                    total_spend += conv_payout
            except (ValueError, TypeError):
                pass
                
        ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
        cr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0.0
        avg_cpa = (total_spend / total_conversions) if total_conversions > 0 else 0.0

        kpis = {
            'impressions': total_impressions,
            'clicks': total_clicks,
            'ctr': round(ctr, 2),
            'conversions': total_conversions,
            'cr': round(cr, 2),
            'spend': round(total_spend, 2),
            'avg_cpa': round(avg_cpa, 2)
        }

        # Process breakdown
        breakdown_data = {}
        
        # Helper to get grouping key
        def get_group_key(item, date_field):
            if breakdown == 'date':
                dt = item.get(date_field)
                return dt.strftime('%Y-%m-%d') if dt else 'Unknown'
            elif breakdown == 'country':
                return item.get('country') or item.get('country_code') or 'Unknown'
            elif breakdown == 'device':
                return item.get('device_type') or 'Unknown'
            elif breakdown == 'campaign':
                return item.get('offer_id') or 'Unknown'
            return 'Unknown'

        # Count views
        for v in views:
            key = get_group_key(v, 'timestamp')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['impressions'] += 1

        # Count clicks
        for c in clicks:
            key = get_group_key(c, 'click_time')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['clicks'] += 1

        # Count conversions and spend
        for c in conversions:
            key = get_group_key(c, 'conversion_time')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['conversions'] += 1
            try:
                # Use advertiser_rate from offer if available, otherwise use conversion payout
                offer_rate = offer_payouts.get(c.get('offer_id'), 0.0)
                if offer_rate > 0:
                    breakdown_data[key]['spend'] += offer_rate
                else:
                    conv_payout = float(c.get('payout') or 0.0)
                    breakdown_data[key]['spend'] += conv_payout
            except (ValueError, TypeError):
                pass

        # Format breakdown results
        breakdown_list = []
        for key, stats in breakdown_data.items():
            b_ctr = (stats['clicks'] / stats['impressions'] * 100) if stats['impressions'] > 0 else 0.0
            b_cr = (stats['conversions'] / stats['clicks'] * 100) if stats['clicks'] > 0 else 0.0
            b_cpa = (stats['spend'] / stats['conversions']) if stats['conversions'] > 0 else 0.0
            
            row = {
                'key': key,
                'impressions': stats['impressions'],
                'clicks': stats['clicks'],
                'ctr': round(b_ctr, 2),
                'conversions': stats['conversions'],
                'cr': round(b_cr, 2),
                'spend': round(stats['spend'], 2),
                'cpa': round(b_cpa, 2)
            }
            if breakdown == 'campaign':
                row['campaign_name'] = offer_names.get(key, 'Unknown Offer')
            breakdown_list.append(row)

        # Sort breakdown
        if breakdown == 'date':
            breakdown_list.sort(key=lambda x: x['key'], reverse=True)
        else:
            breakdown_list.sort(key=lambda x: x['conversions'], reverse=True)

        # Format conversions list (Conversion log)
        conversions_list = []
        for c in conversions[:100]: # limit to 100 recent
            # Show advertiser_rate to advertiser, not publisher payout
            display_payout = offer_payouts.get(c.get('offer_id'), 0.0)
            if display_payout == 0:
                display_payout = float(c.get('payout') or 0)
            # For advertiser view: verified postback conversions are "approved"
            # Only show "rejected" if explicitly rejected by admin
            conv_status = c.get('status', 'approved')
            if conv_status == 'pending' and c.get('verified', False):
                conv_status = 'approved'
            conversions_list.append({
                'time': c.get('conversion_time').isoformat() if c.get('conversion_time') else '',
                'conversion_id': c.get('conversion_id', ''),
                'offer_name': offer_names.get(c.get('offer_id'), 'Unknown Offer'),
                'geo': c.get('country') or c.get('country_code') or 'Unknown',
                'device': c.get('device_type') or 'unknown',
                'goal': 'Conversion',
                'payout': display_payout,
                'status': conv_status
            })

        return jsonify({
            'kpis': kpis,
            'breakdown': breakdown_list,
            'conversions': conversions_list
        }), 200

    except Exception as e:
        logger.error(f"Error in advertiser reports endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500



