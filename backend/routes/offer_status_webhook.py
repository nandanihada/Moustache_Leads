"""
Offer Status Webhook Routes
Receives offer status/watch notifications from affiliate networks.
Uses the same unique_postback_key as conversion postbacks but on a different path.

URL format:
  GET /offer-status/<unique_key>?typ=[TYP]&oid=[OID]&onm=[ONM]&pay=[PAY]&pyo=[PYO]

Auto-applies:
  - paused → status = paused
  - activated → status = active
  - sleeping → status = inactive
  - daily_cap → status = paused
  - rate_change → updates payout to [PAY] value
"""

from flask import Blueprint, request
from datetime import datetime
import logging

offer_status_webhook_bp = Blueprint('offer_status_webhook', __name__)
logger = logging.getLogger(__name__)


def get_collection(name):
    from database import db_instance
    return db_instance.get_collection(name)


# Status mapping: TYP value → internal status
STATUS_MAP = {
    'paused': 'paused',
    'activated': 'active',
    'sleeping': 'inactive',
    'daily_cap': 'paused',
    'removed': 'inactive',
    'expired': 'inactive',
    'capped': 'paused',
}


@offer_status_webhook_bp.route('/offer-status/<unique_key>', methods=['GET', 'POST'])
def receive_offer_status(unique_key):
    """
    Receive offer status notifications from networks.
    Looks up partner by unique_postback_key, then auto-applies status/payout changes.
    """
    try:
        # Get all params
        params = dict(request.args)
        if request.method == 'POST':
            if request.is_json:
                params.update(request.get_json(silent=True) or {})
            else:
                params.update(dict(request.form))

        # Extract params using OUR standard names (admin maps their macros to these)
        typ = (params.get('type') or params.get('typ') or params.get('TYP') or
               params.get('status') or '').strip().lower()
        oid = (params.get('oid') or params.get('OID') or params.get('offer_id') or
               params.get('camp') or params.get('campaign_id') or '').strip()
        onm = (params.get('onm') or params.get('ONM') or params.get('offer_name') or '').strip()
        npay = params.get('npay') or params.get('pay') or params.get('PAY') or params.get('payout') or params.get('new_payout') or ''
        opay = params.get('opay') or params.get('pyo') or params.get('PYO') or params.get('old_payout') or params.get('previous_payout') or ''

        ip = request.headers.get('X-Forwarded-For', request.remote_addr)

        # Find partner by unique key
        partners_col = get_collection('partners')
        partner = None
        partner_name = 'Unknown'
        partner_id = ''

        if partners_col is not None:
            partner = partners_col.find_one({'unique_postback_key': unique_key})
            if partner:
                partner_name = partner.get('partner_name', 'Unknown')
                partner_id = partner.get('partner_id', '')

        if not partner:
            logger.warning(f"⚠️ Offer status webhook: unknown key {unique_key}")
            return 'OK', 200

        logger.info(
            f"📡 Offer status: partner={partner_name}, typ={typ}, oid={oid}, "
            f"onm={onm}, npay={npay}, opay={opay}"
        )

        # Try to match offer in DB
        offers_col = get_collection('offers')
        matched_offer = None
        matched_offer_id = None
        matched_offer_name = None
        current_status = None
        current_payout = None

        if oid and offers_col is not None:
            matched_offer = offers_col.find_one(
                {'campaign_id': str(oid)},
                {'offer_id': 1, 'name': 1, 'status': 1, 'payout': 1, 'campaign_id': 1}
            )
            if matched_offer:
                matched_offer_id = matched_offer.get('offer_id', str(matched_offer.get('_id', '')))
                matched_offer_name = matched_offer.get('name', '')
                current_status = matched_offer.get('status', '')
                current_payout = matched_offer.get('payout', 0)

        # Auto-apply changes
        applied = False
        action_taken = ''
        new_status = None
        new_payout = None

        if matched_offer and offers_col is not None:
            update_fields = {'updated_at': datetime.utcnow()}

            if typ == 'rate_change' and npay:
                # Update payout
                try:
                    new_payout = float(npay)
                    update_fields['payout'] = new_payout
                    action_taken = f'payout_changed: {current_payout} → {new_payout}'
                    applied = True
                except (ValueError, TypeError):
                    action_taken = f'rate_change received but invalid npay value: {npay}'
            elif typ in STATUS_MAP:
                new_status = STATUS_MAP[typ]
                if new_status != current_status:
                    update_fields['status'] = new_status
                    action_taken = f'status_changed: {current_status} → {new_status}'
                    applied = True
                else:
                    action_taken = f'status already {current_status}, no change needed'
            else:
                action_taken = f'unknown typ value: {typ}'

            if applied and len(update_fields) > 1:
                offers_col.update_one(
                    {'_id': matched_offer['_id']},
                    {'$set': update_fields}
                )
                logger.info(f"✅ Auto-applied: {action_taken} for offer {oid} ({matched_offer_name})")

        # Log signal
        signals_col = get_collection('offer_status_signals')
        if signals_col is not None:
            signals_col.insert_one({
                'network': partner_name,
                'partner_id': partner_id,
                'offer_id_received': str(oid),
                'status_received': typ,
                'offer_name_received': onm,
                'new_payout_received': npay,
                'old_payout_received': opay,
                'raw_params': params,
                'matched_offer_id': matched_offer_id,
                'matched_offer_name': matched_offer_name or onm,
                'current_status': current_status,
                'suggested_status': new_status,
                'applied': applied,
                'applied_at': datetime.utcnow() if applied else None,
                'applied_status': new_status if applied else None,
                'action_taken': action_taken,
                'new_payout': new_payout,
                'ignored': False,
                'received_at': datetime.utcnow(),
                'ip': ip,
                'source': 'offer_watch_webhook',
                'unique_key': unique_key,
            })

        return 'OK', 200

    except Exception as e:
        logger.error(f"Offer status webhook error: {str(e)}", exc_info=True)
        return 'OK', 200
