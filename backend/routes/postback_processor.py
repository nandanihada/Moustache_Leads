"""
Auto-process postbacks from received_postbacks collection
This runs after postbacks are saved to convert them to conversions
"""

from flask import Blueprint
from database import db_instance
from datetime import datetime
import secrets
import logging

logger = logging.getLogger(__name__)

postback_processor_bp = Blueprint('postback_processor', __name__)

def process_single_postback(postback):
    """
    Process a single postback and create conversion
    Returns (success, conversion_id or error_message)
    """
    try:
        conversions_collection = db_instance.get_collection('conversions')
        clicks_collection = db_instance.get_collection('clicks')
        postbacks_collection = db_instance.get_collection('received_postbacks')
        
        post_data = postback.get('post_data', {})
        
        # Extract data
        transaction_id = post_data.get('transaction_id')
        payout = float(post_data.get('payout', 0))
        status = 'approved' if post_data.get('status') == 'pass' else 'pending'
        survey_id = post_data.get('survey_id')
        session_id = post_data.get('session_id')
        
        # Check if already processed
        existing = conversions_collection.find_one({'transaction_id': transaction_id})
        if existing:
            logger.info(f"Conversion already exists for {transaction_id}")
            postbacks_collection.update_one(
                {'_id': postback['_id']},
                {'$set': {'status': 'processed', 'conversion_id': existing['conversion_id']}}
            )
            return True, existing['conversion_id']
        
        # Try to find matching click
        click_id_from_pb = post_data.get('click_id') or post_data.get('aff_sub')
        click = None
        
        if click_id_from_pb:
            click = clicks_collection.find_one({'click_id': click_id_from_pb})
        
        # Fallback: get most recent click
        if not click:
            click = clicks_collection.find_one({}, sort=[('click_time', -1)])
        
        if not click:
            logger.warning(f"No click found for postback {transaction_id}")
            return False, "No click found"
        
        # Create conversion
        conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
        
        conversion_data = {
            'conversion_id': conversion_id,
            'click_id': click.get('click_id'),
            'transaction_id': transaction_id,
            'offer_id': click.get('offer_id'),
            'user_id': click.get('user_id'),
            'affiliate_id': click.get('affiliate_id'),
            'status': status,
            'payout': payout,
            'currency': post_data.get('currency', 'USD'),
            'country': click.get('country', 'Unknown'),
            'device_type': click.get('device_type', 'unknown'),
            'ip_address': postback.get('ip_address'),
            'sub_id1': click.get('sub_id1'),
            'sub_id2': click.get('sub_id2'),
            'sub_id3': click.get('sub_id3'),
            'conversion_time': datetime.utcnow(),
            
            # Survey data
            'survey_id': survey_id,
            'session_id': session_id,
            'survey_responses': post_data.get('responses', {}),
            'responses_count': post_data.get('responses_count'),
            'completion_time': post_data.get('completion_time'),
            'username': post_data.get('username'),
            
            # All postback data
            'raw_postback': post_data,
            'custom_data': post_data,
            'postback_id': str(postback['_id']),
            'partner_id': postback.get('partner_id'),
            'partner_name': postback.get('partner_name'),
        }
        
        # Insert conversion
        conversions_collection.insert_one(conversion_data)
        
        # Mark postback as processed
        postbacks_collection.update_one(
            {'_id': postback['_id']},
            {'$set': {'status': 'processed', 'conversion_id': conversion_id}}
        )
        
        # Mark click as converted
        clicks_collection.update_one(
            {'click_id': click['click_id']},
            {'$set': {'converted': True}}
        )
        
        logger.info(f"✅ Created conversion: {conversion_id} from postback {transaction_id}")
        return True, conversion_id
        
    except Exception as e:
        logger.error(f"Error processing postback: {e}", exc_info=True)
        return False, str(e)


def process_pending_postbacks():
    """Process all pending postbacks"""
    try:
        postbacks_collection = db_instance.get_collection('received_postbacks')
        
        # Get unprocessed postbacks
        pending = list(postbacks_collection.find({'status': 'received'}))
        
        logger.info(f"Processing {len(pending)} pending postbacks")
        
        success_count = 0
        for pb in pending:
            success, result = process_single_postback(pb)
            if success:
                success_count += 1
        
        logger.info(f"Processed {success_count}/{len(pending)} postbacks successfully")
        return success_count, len(pending)
        
    except Exception as e:
        logger.error(f"Error in batch processing: {e}", exc_info=True)
        return 0, 0


@postback_processor_bp.route('/process-postbacks', methods=['POST'])
def manual_process():
    """Manual endpoint to trigger processing"""
    success, total = process_pending_postbacks()
    return {
        'success': True,
        'processed': success,
        'total': total,
        'message': f'Processed {success} of {total} postbacks'
    }, 200
