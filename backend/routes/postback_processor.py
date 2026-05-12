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
        query_params = postback.get('query_params', {})
        
        # Merge: query_params first, post_data overrides (upward partners may send in either)
        merged_data = {}
        merged_data.update(query_params)
        merged_data.update(post_data)
        
        # Extract data
        transaction_id = merged_data.get('transaction_id')
        payout = float(merged_data.get('payout', 0))
        status = 'approved' if merged_data.get('status') == 'pass' else 'pending'
        survey_id = merged_data.get('survey_id')
        session_id = merged_data.get('session_id')
        
        # Extract offer identifiers (support cid/cname aliases from partners)
        offer_id_from_pb = merged_data.get('offer_id') or merged_data.get('cid') or merged_data.get('survey_id') or ''
        offer_name_from_pb = merged_data.get('offer_name') or merged_data.get('cname') or ''
        
        # Check if already processed — only if transaction_id is not empty
        if transaction_id:
            existing = conversions_collection.find_one({'transaction_id': transaction_id})
            if existing:
                logger.info(f"Conversion already exists for {transaction_id}")
                postbacks_collection.update_one(
                    {'_id': postback['_id']},
                    {'$set': {'status': 'processed', 'conversion_id': existing['conversion_id']}}
                )
                return True, existing['conversion_id']
        
        # Try to find matching click by click_id (primary strategy)
        click_id_from_pb = merged_data.get('click_id') or merged_data.get('aff_sub')
        click = None
        matched_by = 'click_id'
        
        if click_id_from_pb:
            click = clicks_collection.find_one({'click_id': click_id_from_pb})
        
        # SECONDARY FALLBACK: Match by user_id + most recent unconverted click
        # This handles partners (like cpamerchant) that only send user_id back
        if not click:
            user_id_from_pb = merged_data.get('user_id') or merged_data.get('affiliate_id') or merged_data.get('aff_id')
            
            if user_id_from_pb:
                logger.info(f"🔄 Primary match failed. Trying secondary match: user_id={user_id_from_pb}, offer_id={offer_id_from_pb}")
                
                # Strategy A: find most recent unconverted click for this user
                fallback_query = {
                    'user_id': user_id_from_pb,
                    'converted': {'$ne': True}
                }
                
                # If we have offer_id (from offer_id or cid), narrow it down further
                if offer_id_from_pb:
                    fallback_query['offer_id'] = offer_id_from_pb
                
                # Get the most recent unconverted click for this user (sorted by click_time desc)
                click = clicks_collection.find_one(
                    fallback_query,
                    sort=[('click_time', -1)]
                )
                
                if click:
                    # DEDUPLICATION: Check if a conversion already exists for this click
                    existing_conv = conversions_collection.find_one({'click_id': click.get('click_id')})
                    if existing_conv:
                        logger.info(f"⚠️ Duplicate detected: conversion already exists for click {click.get('click_id')} — skipping")
                        postbacks_collection.update_one(
                            {'_id': postback['_id']},
                            {'$set': {
                                'status': 'duplicate',
                                'duplicate_reason': f"Conversion {existing_conv.get('conversion_id')} already exists for click {click.get('click_id')}",
                                'existing_conversion_id': existing_conv.get('conversion_id'),
                                'duplicate_detected_at': datetime.utcnow()
                            }}
                        )
                        return True, existing_conv.get('conversion_id')
                    
                    matched_by = 'user_id_fallback'
                    logger.info(f"✅ Secondary match found: click_id={click.get('click_id')}, offer={click.get('offer_id')}, user={user_id_from_pb}")
                else:
                    # Strategy B: All clicks are already converted. Find the most recent click
                    # that does NOT already have a conversion linked to THIS postback's transaction_id.
                    # This handles partners that send multiple conversions for the same user
                    # (e.g., user completes multiple offers or same offer multiple times).
                    logger.info(f"🔄 Strategy A failed (no unconverted clicks). Trying Strategy B: recent click without duplicate conversion")
                    
                    fallback_query_b = {
                        'user_id': user_id_from_pb,
                    }
                    if offer_id_from_pb:
                        fallback_query_b['offer_id'] = offer_id_from_pb
                    
                    # Get recent clicks for this user (check up to 10 most recent)
                    recent_clicks = list(clicks_collection.find(
                        fallback_query_b,
                        sort=[('click_time', -1)]
                    ).limit(10))
                    
                    for candidate_click in recent_clicks:
                        candidate_click_id = candidate_click.get('click_id')
                        # Check if this click already has a conversion
                        existing_conv = conversions_collection.find_one({'click_id': candidate_click_id})
                        if not existing_conv:
                            # Found a click without a conversion — use it
                            click = candidate_click
                            matched_by = 'user_id_fallback_strategy_b'
                            logger.info(f"✅ Strategy B match: click_id={candidate_click_id}, offer={click.get('offer_id')}")
                            break
                    
                    if not click and recent_clicks:
                        # Strategy C: ALL clicks already have conversions. This is likely a NEW
                        # conversion for a different offer. Use the most recent click as context
                        # but create a fresh conversion record anyway (the user earned it).
                        click = recent_clicks[0]
                        matched_by = 'user_id_fallback_force'
                        logger.info(f"✅ Strategy C (force match): using most recent click {click.get('click_id')} for user {user_id_from_pb} — all clicks already converted but postback is new")
                    
                    if not click:
                        logger.warning(f"⚠️ Secondary match also failed for user_id={user_id_from_pb}")
        
        # If still no match after both strategies, mark as unmatched
        if not click:
            user_id_from_pb = merged_data.get('user_id') or merged_data.get('affiliate_id') or merged_data.get('aff_id') or ''
            logger.warning(f"⚠️ UNMATCHED postback {transaction_id} — no click found for click_id={click_id_from_pb}, user_id={user_id_from_pb}")
            postbacks_collection.update_one(
                {'_id': postback['_id']},
                {'$set': {
                    'status': 'unmatched',
                    'unmatched_reason': f'No click found for click_id={click_id_from_pb}, user_id={user_id_from_pb}',
                    'unmatched_at': datetime.utcnow()
                }}
            )
            return False, "No matching click found — postback logged as unmatched"
        
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
            'currency': merged_data.get('currency', 'USD'),
            'country': click.get('country') or postback.get('country') or 'Unknown',
            'country_code': click.get('country_code') or postback.get('country_code', ''),
            'city': click.get('city') or postback.get('city', ''),
            'region': click.get('region') or postback.get('region', ''),
            'device_type': click.get('device_type', 'unknown'),
            'ip_address': postback.get('ip_address'),
            'sub_id1': click.get('sub_id1'),
            'sub_id2': click.get('sub_id2'),
            'sub_id3': click.get('sub_id3'),
            'conversion_time': datetime.utcnow(),
            
            # Survey data
            'survey_id': survey_id,
            'session_id': session_id,
            'survey_responses': merged_data.get('responses', {}),
            'responses_count': merged_data.get('responses_count'),
            'completion_time': merged_data.get('completion_time'),
            'username': merged_data.get('username'),
            
            # All postback data
            'raw_postback': merged_data,
            'custom_data': merged_data,
            'postback_id': str(postback['_id']),
            'partner_id': postback.get('partner_id'),
            'partner_name': postback.get('partner_name'),
            
            # Data integrity fields
            'source': 'postback',  # Real postback conversion
            'verified': True,  # Click was matched
            'matched_by': matched_by,
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
            {'$set': {'converted': True, 'postback_received': True, 'postback_revenue': payout}}
        )
        
        # === PHASE 1.2: Record funnel event + update click postback fields ===
        try:
            from services.event_funnel_service import record_funnel_event
            
            # Try to determine event type from postback data
            raw_event_type = (
                merged_data.get('event_type') or merged_data.get('goal') or
                merged_data.get('event') or merged_data.get('action') or
                merged_data.get('conversion_type') or ''
            )
            
            record_funnel_event(
                click_id=click.get('click_id', ''),
                offer_id=click.get('offer_id', ''),
                user_id=click.get('user_id', ''),
                event_type_raw=raw_event_type,
                revenue=payout,
                source='postback',
                campaign_id=click.get('campaign_id', ''),
                metadata={
                    'conversion_id': conversion_id,
                    'transaction_id': transaction_id,
                    'partner_id': postback.get('partner_id', ''),
                    'partner_name': postback.get('partner_name', ''),
                }
            )
        except Exception as funnel_err:
            # Non-critical — don't break existing conversion flow
            logger.warning(f"⚠️ Funnel event recording failed (non-critical): {funnel_err}")
        
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
