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
        
        # Parse payout safely — handle unreplaced macros like '{payout}'
        raw_payout = merged_data.get('payout', '0') or '0'
        try:
            payout = float(raw_payout) if raw_payout and not raw_payout.startswith('{') else 0
        except (ValueError, TypeError):
            payout = 0
            logger.warning(f"⚠️ Could not parse payout value: '{raw_payout}' — defaulting to 0")
        
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
        
        # Try to find matching click by click_id (STRICT — click_id is REQUIRED)
        click_id_from_pb = merged_data.get('click_id') or merged_data.get('aff_click_id')
        click = None
        matched_by = 'click_id'
        
        # STRICT MODE: Only match by click_id — no fallback
        if not click_id_from_pb:
            user_id_from_pb = merged_data.get('user_id') or merged_data.get('affiliate_id') or merged_data.get('aff_id') or ''
            logger.warning(f"🚫 REJECTED postback {transaction_id} — no click_id provided. user_id={user_id_from_pb}")
            postbacks_collection.update_one(
                {'_id': postback['_id']},
                {'$set': {
                    'status': 'rejected_no_click_id',
                    'unmatched_reason': f'No click_id in postback. user_id={user_id_from_pb}. Strict mode requires click_id.',
                    'unmatched_at': datetime.utcnow()
                }}
            )
            return False, "Rejected: no click_id in postback (strict mode)"
        
        click = clicks_collection.find_one({'click_id': click_id_from_pb})
        
        # If click_id was provided but not found in our system, reject
        if not click:
            user_id_from_pb = merged_data.get('user_id') or merged_data.get('affiliate_id') or merged_data.get('aff_id') or ''
            logger.warning(f"🚫 REJECTED postback {transaction_id} — click_id={click_id_from_pb} NOT FOUND in our system. user_id={user_id_from_pb}")
            postbacks_collection.update_one(
                {'_id': postback['_id']},
                {'$set': {
                    'status': 'rejected_click_not_found',
                    'unmatched_reason': f'click_id={click_id_from_pb} not found in clicks collection. user_id={user_id_from_pb}',
                    'unmatched_at': datetime.utcnow()
                }}
            )
            return False, f"Rejected: click_id={click_id_from_pb} not found in our tracking"
        
        logger.info(f"✅ Click verified: click_id={click_id_from_pb}, user={click.get('user_id')}, offer={click.get('offer_id')}")
        
        # Fallback to offer payout if payout is 0 or missing
        if payout == 0 and click:
            # First try payout from the click record (stored at click time)
            click_payout = click.get('payout')
            if click_payout and float(click_payout or 0) > 0:
                payout = float(click_payout)
                logger.info(f"Using click-stored payout: {payout} for click {click.get('click_id')}")
            elif click.get('offer_id'):
                # Fallback to offer's current payout
                try:
                    offer_col = db_instance.get_collection('offers')
                    if offer_col is not None:
                        offer = offer_col.find_one({'offer_id': click.get('offer_id')})
                        if offer:
                            payout = float(offer.get('payout') or 0.0)
                            logger.info(f"Using offer default payout: {payout} for offer {click.get('offer_id')}")
                except Exception as e:
                    logger.error(f"Error fetching fallback payout from offer: {e}")
                
        # DUPLICATE CHECK: Reject if this click_id already has a conversion
        existing_conv_for_click = conversions_collection.find_one({'click_id': click_id_from_pb})
        if existing_conv_for_click:
            logger.warning(f"🚫 DUPLICATE: click_id={click_id_from_pb} already has conversion {existing_conv_for_click.get('conversion_id')} — rejecting")
            postbacks_collection.update_one(
                {'_id': postback['_id']},
                {'$set': {
                    'status': 'duplicate_click',
                    'duplicate_reason': f"click_id={click_id_from_pb} already converted as {existing_conv_for_click.get('conversion_id')}",
                    'existing_conversion_id': existing_conv_for_click.get('conversion_id'),
                    'duplicate_detected_at': datetime.utcnow()
                }}
            )
            return False, f"Rejected: click_id={click_id_from_pb} already has a conversion — one click, one conversion only"
        
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
        
        # Update advertiser campaign stats if this is an advertiser-sourced offer
        try:
            campaign_id = click.get('campaign_id')
            if campaign_id:
                from bson import ObjectId as _ObjId
                campaigns_col = db_instance.get_collection('campaigns')
                if campaigns_col:
                    campaigns_col.update_one(
                        {'_id': _ObjId(campaign_id)},
                        {'$inc': {'conversions': 1, 'spent': float(payout or 0)}}
                    )
                    # Deduct from advertiser balance
                    campaign = campaigns_col.find_one({'_id': _ObjId(campaign_id)}, {'advertiser_id': 1})
                    if campaign and campaign.get('advertiser_id') and float(payout or 0) > 0:
                        advertisers_col = db_instance.get_collection('advertisers')
                        if advertisers_col:
                            advertisers_col.update_one(
                                {'_id': _ObjId(campaign.get('advertiser_id'))},
                                {'$inc': {'balance': -float(payout or 0)}}
                            )
        except Exception:
            pass
        
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
