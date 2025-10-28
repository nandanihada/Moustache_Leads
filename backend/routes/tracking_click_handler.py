"""
Integrated Tracking Click Handler
Handles the complete flow: Click → Track → Redirect → Postback
"""

from flask import Blueprint, request, redirect, jsonify
from services.tracking_service import TrackingService
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)

tracking_click_bp = Blueprint('tracking_click', __name__)
tracking_service = TrackingService()

@tracking_click_bp.route('/track/click/<click_id>')
def handle_tracking_click(click_id):
    """
    Handle tracking click - the main endpoint for our tracking system
    This is what gets called when someone clicks a tracking link
    
    Expected URL format: /track/click/{click_id}?offer_id=ML-001&aff_id=123&hash=abc123
    """
    try:
        logger.info(f"🌐 Full request URL: {request.url}")
        logger.info(f"📋 URL args: {dict(request.args)}")
        
        # Extract request information
        request_info = {
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'referer': request.headers.get('Referer', ''),
            'country': request.args.get('country', 'US'),
            'offer_id': request.args.get('offer_id'),
            'aff_id': request.args.get('aff_id'),  # Fixed: was 'affiliate_id'
            'hash': request.args.get('hash'),
            'sub1': request.args.get('sub1', ''),
            'sub2': request.args.get('sub2', ''),
            'sub3': request.args.get('sub3', ''),
            'sub4': request.args.get('sub4', ''),
            'sub5': request.args.get('sub5', ''),
            'timestamp': datetime.utcnow()
        }
        
        logger.info(f"🔗 Processing tracking click: {click_id}")
        logger.info(f"📊 Request info: offer_id={request_info['offer_id']}, aff_id={request_info['aff_id']}")
        logger.info(f"📋 All URL params: {dict(request.args)}")
        
        # Record the click using our tracking service
        result = tracking_service.record_click(click_id, request_info)
        
        if 'error' in result:
            logger.error(f"❌ Click tracking failed: {result['error']}")
            return jsonify({'error': result['error']}), 400
        
        # Get redirect URL
        redirect_url = result.get('redirect_url')
        if not redirect_url:
            logger.error(f"❌ No redirect URL found for click {click_id}")
            return jsonify({'error': 'No redirect URL available'}), 400
        
        logger.info(f"✅ Click tracked successfully: {click_id}")
        logger.info(f"🎯 Redirecting to: {redirect_url}")
        
        # Redirect user to the offer
        return redirect(redirect_url, code=302)
        
    except Exception as e:
        logger.error(f"❌ Error handling tracking click {click_id}: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@tracking_click_bp.route('/generate-tracking-link', methods=['POST'])
def generate_tracking_link():
    """
    Generate a tracking link for an offer
    This is what publishers/affiliates call to get tracking links
    
    POST body: {
        "offer_id": "ML-001",
        "affiliate_id": "123",
        "sub_ids": ["sub1", "sub2", ...]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        offer_id = data.get('offer_id')
        affiliate_id = data.get('affiliate_id')
        sub_ids = data.get('sub_ids', [])
        
        if not offer_id or not affiliate_id:
            return jsonify({'error': 'offer_id and affiliate_id are required'}), 400
        
        logger.info(f"🔗 Generating tracking link: offer_id={offer_id}, affiliate_id={affiliate_id}")
        
        # Generate tracking link
        result = tracking_service.generate_tracking_link(offer_id, affiliate_id, sub_ids)
        
        if 'error' in result:
            logger.error(f"❌ Failed to generate tracking link: {result['error']}")
            return jsonify({'error': result['error']}), 400
        
        logger.info(f"✅ Tracking link generated: {result['click_id']}")
        
        return jsonify({
            'success': True,
            'tracking_url': result['tracking_url'],
            'click_id': result['click_id'],
            'expires_at': result['expires_at'].isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error generating tracking link: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@tracking_click_bp.route('/test-complete-flow', methods=['POST'])
def test_complete_flow():
    """
    Test the complete tracking flow: Generate Link → Click → Complete → Postback
    This is for testing the end-to-end functionality
    
    POST body: {
        "offer_id": "ML-001",
        "affiliate_id": "test_user",
        "payout": 5.00,
        "test_completion": true
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            logger.error("❌ No JSON data provided in request")
            return jsonify({'error': 'No data provided'}), 400
        
        logger.info(f"📥 Received test request data: {data}")
        
        offer_id = data.get('offer_id')
        affiliate_id = data.get('affiliate_id')
        payout = data.get('payout', 1.0)
        test_completion = data.get('test_completion', False)
        
        logger.info(f"📊 Parsed data: offer_id={offer_id}, affiliate_id={affiliate_id}, payout={payout}")
        
        if not offer_id or not affiliate_id:
            logger.error(f"❌ Missing required fields: offer_id={offer_id}, affiliate_id={affiliate_id}")
            return jsonify({'error': 'offer_id and affiliate_id are required'}), 400
        
        logger.info(f"🧪 Testing complete flow for offer_id={offer_id}, affiliate_id={affiliate_id}")
        
        results = {
            'offer_id': offer_id,
            'affiliate_id': affiliate_id,
            'steps': []
        }
        
        # Step 1: Generate tracking link
        logger.info("📝 Step 1: Generating tracking link...")
        link_result = tracking_service.generate_tracking_link(offer_id, affiliate_id, [])
        
        if 'error' in link_result:
            return jsonify({'error': f'Step 1 failed: {link_result["error"]}'}), 400
        
        results['steps'].append({
            'step': 1,
            'action': 'generate_tracking_link',
            'success': True,
            'data': {
                'tracking_url': link_result['tracking_url'],
                'click_id': link_result['click_id']
            }
        })
        
        # Step 2: Simulate click
        logger.info("🖱️ Step 2: Simulating click...")
        click_id = link_result['click_id']
        
        # Create mock request info
        mock_request_info = {
            'ip_address': '127.0.0.1',
            'user_agent': 'Test Bot',
            'referer': 'https://test.com',
            'country': 'US',
            'offer_id': offer_id,
            'affiliate_id': affiliate_id,
            'hash': request.args.get('hash', ''),  # This would come from the URL
            'sub1': 'test_sub1',
            'sub2': '',
            'sub3': '',
            'sub4': '',
            'sub5': '',
            'timestamp': datetime.utcnow()
        }
        
        click_result = tracking_service.record_click(click_id, mock_request_info)
        
        if 'error' in click_result:
            return jsonify({'error': f'Step 2 failed: {click_result["error"]}'}), 400
        
        results['steps'].append({
            'step': 2,
            'action': 'record_click',
            'success': True,
            'data': {
                'click_id': click_id,
                'redirect_url': click_result.get('redirect_url')
            }
        })
        
        # Step 3: Simulate completion (if requested)
        if test_completion:
            logger.info("✅ Step 3: Simulating completion...")
            
            completion_data = {
                'click_id': click_id,
                'transaction_id': f'test_txn_{uuid.uuid4().hex[:8]}',
                'payout': payout,
                'status': 'approved',
                'external_id': f'ext_{uuid.uuid4().hex[:8]}',
                'revenue': payout * 2,  # Assume 2x revenue
                'response_data': {'test': True}
            }
            
            completion_result = tracking_service.record_conversion(completion_data)
            
            if 'error' in completion_result:
                results['steps'].append({
                    'step': 3,
                    'action': 'record_conversion',
                    'success': False,
                    'error': completion_result['error']
                })
            else:
                results['steps'].append({
                    'step': 3,
                    'action': 'record_conversion',
                    'success': True,
                    'data': {
                        'conversion_id': completion_result['conversion']['conversion_id'],
                        'payout': completion_result['conversion']['payout'],
                        'postback_queued': 'postback_queued' in completion_result
                    }
                })
        
        logger.info(f"✅ Test flow completed successfully for {offer_id}")
        
        return jsonify({
            'success': True,
            'message': 'Test flow completed',
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error in test flow: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@tracking_click_bp.route('/debug/click/<click_id>')
def debug_click(click_id):
    """
    Debug endpoint to check click information without processing
    """
    try:
        # This would normally query the database for click info
        # For now, return the request information
        
        debug_info = {
            'click_id': click_id,
            'query_params': dict(request.args),
            'headers': {
                'user_agent': request.headers.get('User-Agent'),
                'referer': request.headers.get('Referer'),
                'ip_address': request.remote_addr
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(debug_info), 200
        
    except Exception as e:
        logger.error(f"❌ Error in debug endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tracking_click_bp.route('/health')
def health_check():
    """Health check for tracking click handler"""
    return jsonify({
        'status': 'healthy',
        'service': 'tracking_click_handler',
        'endpoints': [
            '/track/click/<click_id>',
            '/generate-tracking-link',
            '/test-complete-flow',
            '/debug/click/<click_id>'
        ],
        'timestamp': datetime.utcnow().isoformat()
    }), 200
