"""
Enhanced Postback Endpoint - Captures ALL survey data
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from datetime import datetime
import logging
import secrets

logger = logging.getLogger(__name__)

postback_enhanced_bp = Blueprint('postback_enhanced', __name__)


def calculate_downward_payout(upward_payout, offer):
    """
    Calculate the payout to forward to downward partner based on revenue share settings.
    
    Args:
        upward_payout: The payout amount received from upward partner
        offer: Offer document with revenue_share_percent field
        
    Returns:
        dict: {
            'downward_payout': float,
            'is_percentage': bool,
            'revenue_share_percent': float,
            'calculation_method': str,
            'upward_payout': float
        }
    """
    try:
        upward_payout = float(upward_payout) if upward_payout else 0
        
        # Check if offer has revenue share percentage configured
        revenue_share_percent = offer.get('revenue_share_percent', 0)
        
        if revenue_share_percent and float(revenue_share_percent) > 0:
            # Percentage-based: forward percentage of upward payout
            percent = float(revenue_share_percent)
            downward_payout = upward_payout * (percent / 100)
            
            logger.info(f"💰 Revenue share calculation: {upward_payout} × {percent}% = {downward_payout}")
            
            return {
                'downward_payout': round(downward_payout, 2),
                'is_percentage': True,
                'revenue_share_percent': percent,
                'calculation_method': f'{percent}% of {upward_payout}',
                'upward_payout': upward_payout
            }
        else:
            # Fixed payout: use offer's fixed payout value
            fixed_payout = float(offer.get('payout', 0))
            
            logger.info(f"💰 Fixed payout: {fixed_payout} (upward was {upward_payout})")
            
            return {
                'downward_payout': fixed_payout,
                'is_percentage': False,
                'revenue_share_percent': 0,
                'calculation_method': f'Fixed: {fixed_payout}',
                'upward_payout': upward_payout
            }
            
    except Exception as e:
        logger.error(f"❌ Error calculating downward payout: {e}")
        # Fallback to offer's fixed payout
        return {
            'downward_payout': float(offer.get('payout', 0)),
            'is_percentage': False,
            'revenue_share_percent': 0,
            'calculation_method': 'Fallback to fixed payout',
            'upward_payout': upward_payout
        }

@postback_enhanced_bp.route('/postback', methods=['GET', 'POST'])
def handle_postback():
    """
    Enhanced postback endpoint that captures ALL data from survey partners
    
    Expected parameters from survey partner:
    - click_id (required) - Our unique click identifier
    - status (optional) - approved/pending/rejected (default: approved)
    - payout (optional) - Amount earned (default: 0)
    - transaction_id (optional) - Partner's transaction ID
    - offer_id (optional) - Partner's offer ID
    - user_response (optional) - Survey responses as JSON
    - ANY other parameters - All captured in custom_data
    """
    try:
        # Get ALL parameters (query string for GET, form data for POST)
        if request.method == 'GET':
            all_params = dict(request.args)
        else:
            all_params = dict(request.form)
        
        # Log all incoming data
        logger.info(f"📥 POSTBACK RECEIVED:")
        logger.info(f"   Method: {request.method}")
        logger.info(f"   IP: {request.remote_addr}")
        logger.info(f"   All Parameters: {all_params}")
        
        # Extract required/standard fields
        click_id = (all_params.get('click_id') or 
                   all_params.get('clickid') or 
                   all_params.get('subid') or 
                   all_params.get('s1'))
        
        if not click_id:
            logger.warning("❌ Postback missing click_id")
            return jsonify({'error': 'click_id required'}), 400
        
        # Find original click
        clicks_collection = db_instance.get_collection('clicks')
        click = clicks_collection.find_one({'click_id': click_id})
        
        if not click:
            logger.warning(f"❌ Click not found: {click_id}")
            return jsonify({'error': 'Click not found'}), 404
        
        # Extract standard fields
        status = all_params.get('status', 'approved').lower()
        upward_payout = float(all_params.get('payout', 0))  # Payout from upstream partner
        transaction_id = all_params.get('transaction_id') or all_params.get('txn_id') or f'TXN-{secrets.token_hex(8).upper()}'
        
        # Fetch offer to get revenue share settings
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': click.get('offer_id')})
        
        # Calculate downward payout (what we pay to affiliate)
        if offer:
            payout_calc = calculate_downward_payout(upward_payout, offer)
            affiliate_payout = payout_calc['downward_payout']
            
            logger.info(f"💰 Payout Calculation:")
            logger.info(f"   Upward (from partner): ${upward_payout}")
            logger.info(f"   Method: {payout_calc['calculation_method']}")
            logger.info(f"   Downward (to affiliate): ${affiliate_payout}")
        else:
            # Fallback if offer not found
            logger.warning(f"⚠️ Offer not found: {click.get('offer_id')}, using upward payout")
            affiliate_payout = upward_payout
            payout_calc = {
                'downward_payout': upward_payout,
                'is_percentage': False,
                'revenue_share_percent': 0,
                'calculation_method': 'Offer not found - using upward payout',
                'upward_payout': upward_payout
            }
        
        # Remove standard fields from params to get custom data
        custom_data = {k: v for k, v in all_params.items() 
                      if k not in ['click_id', 'clickid', 'subid', 's1', 'status', 'payout', 'transaction_id', 'txn_id']}
        
        # Create conversion record with ALL data
        conversions_collection = db_instance.get_collection('conversions')
        
        conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
        
        conversion_data = {
            'conversion_id': conversion_id,
            'click_id': click_id,
            'transaction_id': transaction_id,
            'offer_id': click.get('offer_id'),
            'user_id': click.get('user_id'),
            'affiliate_id': click.get('affiliate_id'),
            'status': status,
            
            # Payout fields - NEW: separate upward and downward payouts
            'payout': affiliate_payout,  # What we pay to affiliate (calculated)
            'upward_payout': upward_payout,  # What we received from partner
            'is_revenue_share': payout_calc['is_percentage'],
            'revenue_share_percent': payout_calc['revenue_share_percent'],
            'payout_calculation_method': payout_calc['calculation_method'],
            
            'currency': all_params.get('currency', 'USD'),
            'country': click.get('country', 'Unknown'),
            'device_type': click.get('device_type', 'unknown'),
            'ip_address': click.get('ip_address'),
            'sub_id1': click.get('sub_id1'),
            'sub_id2': click.get('sub_id2'),
            'sub_id3': click.get('sub_id3'),
            'sub_id4': click.get('sub_id4'),
            'sub_id5': click.get('sub_id5'),
            'conversion_time': datetime.utcnow(),
            
            # ✨ CAPTURE ALL SURVEY DATA
            'custom_data': custom_data,
            'raw_postback': all_params,
            
            # Survey-specific fields (if provided)
            'survey_id': all_params.get('survey_id'),
            'survey_name': all_params.get('survey_name'),
            'user_response': all_params.get('user_response'),
            'completion_time': all_params.get('completion_time'),
            'session_id': all_params.get('session_id'),
            
            # Partner info
            'partner_id': all_params.get('partner_id') or all_params.get('pid'),
            'partner_offer_id': all_params.get('offer_id'),
            
            # Metadata
            'postback_received_at': datetime.utcnow(),
            'postback_ip': request.remote_addr,
            'postback_user_agent': request.headers.get('User-Agent')
        }
        
        # Insert conversion
        result = conversions_collection.insert_one(conversion_data)
        
        # Mark click as converted
        clicks_collection.update_one(
            {'click_id': click_id},
            {'$set': {'converted': True, 'conversion_time': datetime.utcnow()}}
        )
        
        logger.info(f"✅ Conversion tracked successfully:")
        logger.info(f"   Conversion ID: {conversion_id}")
        logger.info(f"   Transaction ID: {transaction_id}")
        logger.info(f"   Status: {status}")
        logger.info(f"   Upward Payout (from partner): ${upward_payout}")
        logger.info(f"   Affiliate Payout (to user): ${affiliate_payout}")
        logger.info(f"   Revenue Share: {payout_calc['is_percentage']}")
        logger.info(f"   Custom Data Fields: {len(custom_data)}")
        
        # Return success (partners expect simple response)
        return "OK", 200
        
    except Exception as e:
        logger.error(f"❌ Postback error: {str(e)}", exc_info=True)
        return "ERROR", 500


@postback_enhanced_bp.route('/postback/test', methods=['GET'])
def test_postback():
    """
    Test endpoint to verify postback is working
    """
    return jsonify({
        'status': 'online',
        'endpoint': '/api/analytics/postback',
        'methods': ['GET', 'POST'],
        'required_params': ['click_id'],
        'optional_params': ['status', 'payout', 'transaction_id', '+ any custom fields'],
        'example': 'GET /api/analytics/postback?click_id=CLK-XXX&status=approved&payout=90.01&transaction_id=TXN-123&user_age=25&user_country=US'
    }), 200
