#!/usr/bin/env python3
"""
Simple tracking endpoint for publisher links
Format: /track/{offer_id}?user_id={publisher_id}&sub1=...
"""

from flask import Blueprint, request, redirect, jsonify
from models.analytics import Analytics
from database import db_instance
from services.macro_replacement_service import macro_service
import logging
from datetime import datetime
import secrets

simple_tracking_bp = Blueprint('simple_tracking', __name__)
analytics_model = Analytics()
logger = logging.getLogger(__name__)

def generate_click_id():
    """Generate unique click ID"""
    return f"CLK-{secrets.token_hex(6).upper()}"

@simple_tracking_bp.route('/track/<offer_id>', methods=['GET'])
def track_offer_click(offer_id):
    """
    Simple tracking endpoint for publishers
    URL format: /track/{offer_id}?user_id={publisher_id}&sub1=val1&sub2=val2...
    
    1. Records click in database
    2. Redirects user to offer target URL
    """
    try:
        # Get parameters
        user_id = request.args.get('user_id')  # Publisher/affiliate ID
        sub1 = request.args.get('sub1', '')
        sub2 = request.args.get('sub2', '')
        sub3 = request.args.get('sub3', '')
        sub4 = request.args.get('sub4', '')
        sub5 = request.args.get('sub5', '')
        
        # Get user info
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')
        referer = request.headers.get('Referer', '')
        
        logger.info(f"📊 Tracking click: offer={offer_id}, user={user_id}, sub1={sub1}")
        
        # Get offer details
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            logger.error(f"❌ Offer not found: {offer_id}")
            return jsonify({'error': 'Offer not found'}), 404
        
        if offer.get('status', '').lower() != 'active':
            logger.error(f"❌ Offer not active: {offer_id}, status={offer.get('status')}")
            return jsonify({'error': 'Offer not active'}), 404
        
        target_url = offer.get('target_url')
        if not target_url:
            logger.error(f"❌ No target URL for offer: {offer_id}")
            return jsonify({'error': 'Invalid offer configuration'}), 400
        
        # Generate unique click ID
        click_id = generate_click_id()
        
        # 🔄 MACRO REPLACEMENT: Replace {user_id}, {click_id}, etc. in target URL
        macro_context = {
            'user_id': user_id or '',
            'username': user_id or '',  # Use user_id as username fallback
            'click_id': click_id,
            'session_id': sub1 or '',  # Use sub1 as session_id
            'placement_id': sub1 or '',  # Use sub1 as placement_id
            'publisher_id': user_id or '',
            'country': 'Unknown',  # Will be enhanced with geo-detection
            'device_type': 'unknown',
            'ip_address': ip_address,
            'offer_id': offer_id,
        }
        
        # Replace macros in target URL
        if macro_service.has_macros(target_url):
            logger.info(f"🔄 Replacing macros in URL for offer {offer_id}")
            target_url = macro_service.replace_macros(target_url, macro_context)
            logger.info(f"✅ Macros replaced. Final URL: {target_url}")
        
        # Prepare click data for database
        click_data = {
            'click_id': click_id,
            'offer_id': offer_id,
            'user_id': user_id,  # Publisher who shared the link
            'affiliate_id': user_id,  # Same as user_id for consistency
            'placement_id': sub1,  # Placement/offerwall ID (usually in sub1)
            'ip_address': ip_address,
            'user_agent': user_agent,
            'referer': referer,
            'sub_id1': sub1,
            'sub_id2': sub2,
            'sub_id3': sub3,
            'sub_id4': sub4,
            'sub_id5': sub5,
            'click_time': datetime.utcnow(),
            'timestamp': datetime.utcnow(),  # Add timestamp for sorting
            'converted': False,
            'country': 'Unknown',  # Will be enhanced later
            'device_type': 'unknown',  # Will be enhanced later
            'browser': 'unknown'  # Will be enhanced later
        }
        
        # Save click directly to database
        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is not None:
            try:
                clicks_collection.insert_one(click_data)
                logger.info(f"✅ Click tracked: {click_id} for offer {offer_id} by user {user_id}")
            except Exception as db_error:
                logger.error(f"❌ Failed to save click to database: {db_error}")
        else:
            logger.error("❌ Could not access clicks collection")
        
        # NOTE: We already replaced macros above, so target_url is ready to use
        # No need to append click_id since it's already in the URL if partner needs it
        redirect_url = target_url
        
        logger.info(f"↗️  Redirecting to: {redirect_url}")
        
        # Redirect to offer
        return redirect(redirect_url, code=302)
            
    except Exception as e:
        logger.error(f"❌ Error in track_offer_click: {str(e)}", exc_info=True)
        
        # Try to redirect to offer anyway
        try:
            offers_collection = db_instance.get_collection('offers')
            offer = offers_collection.find_one({'offer_id': offer_id})
            if offer and offer.get('target_url'):
                return redirect(offer['target_url'], code=302)
        except:
            pass
        
        return jsonify({'error': 'Tracking error'}), 500


@simple_tracking_bp.route('/track/<offer_id>/test', methods=['GET'])
def test_tracking_link(offer_id):
    """
    Test endpoint - shows what would happen without redirect
    """
    try:
        user_id = request.args.get('user_id')
        sub1 = request.args.get('sub1', '')
        
        offers_collection = db_instance.get_collection('offers')
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        return jsonify({
            'success': True,
            'offer_id': offer_id,
            'offer_name': offer.get('name'),
            'target_url': offer.get('target_url'),
            'user_id': user_id,
            'sub1': sub1,
            'message': 'Tracking link is valid! Remove /test to use real link.'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@simple_tracking_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'simple_tracking',
        'endpoints': [
            'GET /track/<offer_id>',
            'GET /track/<offer_id>/test'
        ]
    }), 200
