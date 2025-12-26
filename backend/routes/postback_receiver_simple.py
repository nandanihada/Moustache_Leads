"""
SIMPLE Postback Receiver - Just receive and broadcast
No complex tracking, no placement matching
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
import logging
import requests

postback_receiver_simple_bp = Blueprint('postback_receiver_simple', __name__)
logger = logging.getLogger(__name__)

def get_collection(collection_name):
    """Get collection from database instance"""
    from database import db_instance
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return None
    return db_instance.get_collection(collection_name)

@postback_receiver_simple_bp.route('/postback/<key>', methods=['GET', 'POST'])
def receive_postback_simple(key):
    """
    Simple postback receiver - just forward to all users with postback_url
    """
    try:
        # Get POST data
        post_data = {}
        if request.is_json:
            post_data = request.get_json() or {}
        elif request.form:
            post_data = request.form.to_dict()
        
        # Get query params
        query_params = request.args.to_dict()
        
        # Combine all data
        all_data = {**query_params, **post_data}
        
        logger.info("="*80)
        logger.info("📥 RECEIVED POSTBACK")
        logger.info(f"   Key: {key}")
        logger.info(f"   Data: {all_data}")
        logger.info("="*80)
        
        # Get survey_id or offer_id
        survey_id = all_data.get('survey_id') or all_data.get('offer_id')
        transaction_id = all_data.get('transaction_id', 'unknown')
        payout = all_data.get('payout', '0')
        status = all_data.get('status', 'unknown')
        
        # Save to received_postbacks
        received_postbacks = get_collection('received_postbacks')
        if received_postbacks:
            received_postbacks.insert_one({
                'timestamp': datetime.utcnow(),
                'key': key,
                'survey_id': survey_id,
                'transaction_id': transaction_id,
                'payout': payout,
                'status': status,
                'all_data': all_data
            })
        
        # Get ALL users with postback_url configured
        users_collection = get_collection('users')
        if not users_collection:
            return jsonify({'message': 'Database error'}), 500
        
        users_with_postback = list(users_collection.find({
            'postback_url': {'$exists': True, '$ne': '', '$ne': None}
        }))
        
        logger.info(f"📤 Forwarding to {len(users_with_postback)} users")
        
        # Forward to each user
        for user in users_with_postback:
            try:
                username = user.get('username')
                postback_url = user.get('postback_url')
                
                # Replace macros
                final_url = postback_url
                replacements = {
                    '{survey_id}': survey_id or '',
                    '{offer_id}': survey_id or '',
                    '{transaction_id}': transaction_id,
                    '{payout}': payout,
                    '{points}': payout,
                    '{status}': status,
                    '{username}': 'user',  # Generic username
                }
                
                for macro, value in replacements.items():
                    final_url = final_url.replace(macro, str(value))
                
                logger.info(f"   → Sending to {username}: {final_url}")
                
                # Send
                response = requests.get(final_url, timeout=10)
                logger.info(f"   ✅ {username}: {response.status_code}")
                
                # Log forwarded
                forwarded_postbacks = get_collection('forwarded_postbacks')
                if forwarded_postbacks:
                    forwarded_postbacks.insert_one({
                        'timestamp': datetime.utcnow(),
                        'publisher_name': username,
                        'forward_url': final_url,
                        'forward_status': 'success' if response.status_code == 200 else 'failed',
                        'response_code': response.status_code,
                        'survey_id': survey_id,
                        'transaction_id': transaction_id
                    })
                    
            except Exception as e:
                logger.error(f"   ❌ Error forwarding to {username}: {e}")
        
        return jsonify({'message': 'Postback received and forwarded'}), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return jsonify({'error': str(e)}), 500
