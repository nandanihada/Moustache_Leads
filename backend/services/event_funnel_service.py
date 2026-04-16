"""
Event Funnel Tracking Service (Phase 1.2)

Tracks 4 event types in a conversion funnel:
  install → signup → ftd (first deposit) → purchase

Each event is linked to a click_id and stored in the 'tracking_events_funnel' collection.
Also updates the parent click record's event_status and postback fields.

This service is called from postback_processor.py when a conversion is created,
and can also be called via API for manual event ingestion.
"""

import uuid
import logging
from datetime import datetime
from database import db_instance

logger = logging.getLogger(__name__)

# Valid event types in funnel order
FUNNEL_EVENT_TYPES = ['install', 'signup', 'ftd', 'purchase']

# Mapping of common network goal/event names to our 4 standard types
EVENT_TYPE_MAPPING = {
    # Install variants
    'install': 'install', 'app_install': 'install', 'cpi': 'install',
    'download': 'install', 'app_open': 'install', 'first_open': 'install',
    # Signup variants
    'signup': 'signup', 'sign_up': 'signup', 'register': 'signup',
    'registration': 'signup', 'create_account': 'signup', 'cpa': 'signup',
    'lead': 'signup', 'cpl': 'signup', 'submit': 'signup',
    'complete_registration': 'signup', 'survey_complete': 'signup',
    # FTD variants
    'ftd': 'ftd', 'first_deposit': 'ftd', 'deposit': 'ftd',
    'first_purchase': 'ftd', 'first_payment': 'ftd',
    # Purchase variants
    'purchase': 'purchase', 'sale': 'purchase', 'cps': 'purchase',
    'order': 'purchase', 'transaction': 'purchase', 'revenue': 'purchase',
    'in_app_purchase': 'purchase', 'subscription': 'purchase',
}


def normalize_event_type(raw_event_type):
    """
    Map a raw event type string from a network postback to one of our 4 standard types.
    Returns the normalized type or 'signup' as default (most common conversion type).
    """
    if not raw_event_type:
        return 'signup'  # Default — most postbacks are simple conversions
    
    normalized = raw_event_type.lower().strip().replace('-', '_').replace(' ', '_')
    return EVENT_TYPE_MAPPING.get(normalized, 'signup')


def determine_event_status(event_type):
    """
    Determine the click's event_status based on the highest event in the funnel.
    install/signup = partial_event, ftd/purchase = full_conversion
    """
    if event_type in ('ftd', 'purchase'):
        return 'full_conversion'
    return 'partial_event'


def record_funnel_event(click_id, offer_id, user_id, event_type_raw,
                        revenue=0, source='postback', campaign_id='',
                        metadata=None):
    """
    Record a funnel event and update the parent click record.
    
    Args:
        click_id: The click this event belongs to
        offer_id: Offer ID
        user_id: Publisher/affiliate ID
        event_type_raw: Raw event type from network (will be normalized)
        revenue: Revenue amount for this event
        source: 'postback' | 'api' | 'manual'
        campaign_id: Campaign ID (from click or offer)
        metadata: Extra data dict
    
    Returns:
        (event_id, error) tuple
    """
    try:
        funnel_col = db_instance.get_collection('tracking_events_funnel')
        clicks_col = db_instance.get_collection('clicks')
        
        if funnel_col is None:
            return None, 'Database not available'
        
        # Normalize the event type
        event_type = normalize_event_type(event_type_raw)
        event_status = determine_event_status(event_type)
        
        # Generate event ID
        event_id = f"EVT-{uuid.uuid4().hex[:12].upper()}"
        
        # Build event document
        event_doc = {
            'event_id': event_id,
            'click_id': click_id or '',
            'offer_id': offer_id or '',
            'user_id': user_id or '',
            'campaign_id': campaign_id or '',
            'event_type': event_type,
            'event_type_raw': event_type_raw or '',
            'revenue': float(revenue) if revenue else 0,
            'source': source,
            'timestamp': datetime.utcnow(),
            'metadata': metadata or {},
        }
        
        funnel_col.insert_one(event_doc)
        logger.info(f"📊 Funnel event recorded: {event_id} | type={event_type} | click={click_id} | offer={offer_id} | revenue={revenue}")
        
        # Update the parent click record with postback/event info
        if click_id and clicks_col is not None:
            try:
                # Only upgrade event_status, never downgrade
                # (e.g., don't overwrite full_conversion with partial_event)
                click = clicks_col.find_one({'click_id': click_id}, {'event_status': 1})
                current_status = (click or {}).get('event_status', 'no_event')
                
                # Determine if we should upgrade
                status_order = {'no_event': 0, 'partial_event': 1, 'full_conversion': 2}
                new_order = status_order.get(event_status, 1)
                current_order = status_order.get(current_status, 0)
                
                update_fields = {
                    'postback_received': True,
                    'postback_event_type': event_type,
                    'postback_revenue': float(revenue) if revenue else 0,
                    'converted': True,
                }
                
                if new_order > current_order:
                    update_fields['event_status'] = event_status
                
                clicks_col.update_one(
                    {'click_id': click_id},
                    {'$set': update_fields}
                )
                logger.info(f"   ↳ Click {click_id} updated: postback_received=True, event_status={event_status}")
            except Exception as click_err:
                logger.warning(f"⚠️ Could not update click {click_id}: {click_err}")
        
        return event_id, None
        
    except Exception as e:
        logger.error(f"❌ Error recording funnel event: {e}")
        return None, str(e)


def get_funnel_events(filters=None, limit=100, skip=0):
    """
    Query funnel events with optional filters.
    
    Args:
        filters: dict with optional keys: click_id, offer_id, user_id, event_type, campaign_id
        limit: max results
        skip: offset
    
    Returns:
        list of event dicts
    """
    try:
        funnel_col = db_instance.get_collection('tracking_events_funnel')
        if funnel_col is None:
            return []
        
        query = {}
        if filters:
            for key in ('click_id', 'offer_id', 'user_id', 'event_type', 'campaign_id'):
                if filters.get(key):
                    query[key] = filters[key]
        
        events = list(funnel_col.find(query).sort('timestamp', -1).skip(skip).limit(limit))
        for e in events:
            e['_id'] = str(e['_id'])
        
        return events
    except Exception as e:
        logger.error(f"❌ Error querying funnel events: {e}")
        return []


def get_funnel_summary(filters=None):
    """
    Get funnel summary counts: how many clicks → installs → signups → ftds → purchases.
    
    Args:
        filters: dict with optional keys: offer_id, user_id, campaign_id, start_date, end_date
    
    Returns:
        dict with counts per event type + total clicks
    """
    try:
        funnel_col = db_instance.get_collection('tracking_events_funnel')
        clicks_col = db_instance.get_collection('clicks')
        
        if funnel_col is None:
            return {}
        
        # Build match stage
        match = {}
        if filters:
            if filters.get('offer_id'):
                match['offer_id'] = filters['offer_id']
            if filters.get('user_id'):
                match['user_id'] = filters['user_id']
            if filters.get('campaign_id'):
                match['campaign_id'] = filters['campaign_id']
            if filters.get('start_date') or filters.get('end_date'):
                match['timestamp'] = {}
                if filters.get('start_date'):
                    match['timestamp']['$gte'] = filters['start_date']
                if filters.get('end_date'):
                    match['timestamp']['$lte'] = filters['end_date']
        
        # Aggregate event counts by type
        pipeline = [
            {'$match': match} if match else {'$match': {}},
            {'$group': {
                '_id': '$event_type',
                'count': {'$sum': 1},
                'total_revenue': {'$sum': '$revenue'},
            }},
        ]
        
        results = list(funnel_col.aggregate(pipeline))
        
        # Build summary
        summary = {
            'install': 0, 'signup': 0, 'ftd': 0, 'purchase': 0,
            'install_revenue': 0, 'signup_revenue': 0, 'ftd_revenue': 0, 'purchase_revenue': 0,
        }
        for r in results:
            etype = r['_id']
            if etype in summary:
                summary[etype] = r['count']
                summary[f'{etype}_revenue'] = round(r.get('total_revenue', 0), 2)
        
        # Get total clicks for the same filters
        click_match = {}
        if filters:
            if filters.get('offer_id'):
                click_match['offer_id'] = filters['offer_id']
            if filters.get('user_id'):
                click_match['user_id'] = filters['user_id']
            if filters.get('campaign_id'):
                click_match['campaign_id'] = filters['campaign_id']
            if filters.get('start_date') or filters.get('end_date'):
                click_match['timestamp'] = {}
                if filters.get('start_date'):
                    click_match['timestamp']['$gte'] = filters['start_date']
                if filters.get('end_date'):
                    click_match['timestamp']['$lte'] = filters['end_date']
        
        if clicks_col is not None:
            summary['clicks'] = clicks_col.count_documents(click_match) if click_match else clicks_col.estimated_document_count()
        else:
            summary['clicks'] = 0
        
        # Calculate conversion rates
        total_clicks = summary['clicks'] or 1  # avoid division by zero
        summary['install_rate'] = round((summary['install'] / total_clicks) * 100, 2)
        summary['signup_rate'] = round((summary['signup'] / total_clicks) * 100, 2)
        summary['ftd_rate'] = round((summary['ftd'] / total_clicks) * 100, 2)
        summary['purchase_rate'] = round((summary['purchase'] / total_clicks) * 100, 2)
        
        return summary
    except Exception as e:
        logger.error(f"❌ Error getting funnel summary: {e}")
        return {}
