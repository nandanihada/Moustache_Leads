"""
Admin Automation Routes
Provides on-demand trigger endpoints for services that don't run as background threads.
Admin clicks a button → runs the task immediately → returns results.
"""

from flask import Blueprint, jsonify, request
from utils.auth import token_required, admin_required
from database import db_instance
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

admin_automation_bp = Blueprint('admin_automation', __name__)


@admin_automation_bp.route('/api/admin/automation/run-inactivity-check', methods=['POST'])
@token_required
@admin_required
def run_inactivity_check():
    """
    Manually trigger offer inactivity check.
    Deactivates offers with zero clicks in the last 30 days.
    Returns count of deactivated offers.
    """
    try:
        offers_col = db_instance.get_collection('offers')
        clicks_col = db_instance.get_collection('clicks')
        
        if offers_col is None or clicks_col is None:
            return jsonify({'error': 'Database not available'}), 500
        
        # Get all active offers
        active_offers = list(offers_col.find(
            {
                'status': {'$in': ['active', 'running']},
                '$or': [
                    {'deleted': {'$exists': False}},
                    {'deleted': False},
                    {'deleted': None}
                ]
            },
            {'offer_id': 1, 'name': 1, 'created_at': 1}
        ))
        
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        deactivated = []
        checked = 0
        skipped = 0
        
        for offer in active_offers:
            offer_id = offer.get('offer_id')
            if not offer_id:
                skipped += 1
                continue
            
            checked += 1
            
            # Skip offers created less than 30 days ago (give them time)
            created_at = offer.get('created_at')
            if created_at and isinstance(created_at, datetime) and created_at > thirty_days_ago:
                continue
            
            # Check if this offer has any clicks in the last 30 days
            recent_click = clicks_col.find_one({
                'offer_id': offer_id,
                'timestamp': {'$gte': thirty_days_ago}
            }, {'_id': 1})
            
            if not recent_click:
                # No clicks in 30 days — deactivate
                offers_col.update_one(
                    {'offer_id': offer_id},
                    {
                        '$set': {
                            'status': 'paused',
                            'is_active': False,
                            'inactivity_paused_at': datetime.utcnow(),
                            'inactivity_reason': 'No clicks in 30 days (manual check)'
                        }
                    }
                )
                deactivated.append({
                    'offer_id': offer_id,
                    'name': offer.get('name', 'Unknown')
                })
        
        logger.info(f"✅ Inactivity check complete: {len(deactivated)} offers deactivated out of {checked} checked")
        
        return jsonify({
            'success': True,
            'checked': checked,
            'skipped': skipped,
            'deactivated_count': len(deactivated),
            'deactivated_offers': deactivated[:50],  # Return first 50 for display
            'run_at': datetime.utcnow().isoformat() + 'Z'
        })
        
    except Exception as e:
        logger.error(f"Inactivity check failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/run-invoice-generation', methods=['POST'])
@token_required
@admin_required
def run_invoice_generation():
    """
    Manually trigger invoice generation for the previous month.
    Uses the same logic as the invoice scheduler service.
    """
    try:
        from routes.admin_invoices import _generate_invoices_for_month
        
        now = datetime.utcnow()
        # Generate for previous month
        prev_month_end = now.replace(day=1) - timedelta(days=1)
        year = prev_month_end.year
        month = prev_month_end.month
        
        count = _generate_invoices_for_month(year, month)
        
        logger.info(f"✅ Invoice generation triggered manually: {count} invoices for {year}-{month:02d}")
        
        return jsonify({
            'success': True,
            'message': f'Generated {count} invoices for {year}-{month:02d}',
            'count': count,
            'period': f'{year}-{month:02d}',
            'run_at': datetime.utcnow().isoformat() + 'Z'
        })
        
    except ImportError as e:
        logger.error(f"Invoice generation import failed: {str(e)}")
        return jsonify({'error': 'Invoice generation function not available. Check admin_invoices route.'}), 500
    except Exception as e:
        logger.error(f"Invoice generation failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/status', methods=['GET'])
@token_required
@admin_required
def get_automation_status():
    """
    Get status of all background services and manual tasks.
    Shows what's running, what's disabled, and last run times.
    """
    try:
        services = [
            {
                'name': 'Cap Monitoring',
                'status': 'running',
                'type': 'background',
                'description': 'Monitors offer click/conversion caps and pauses when hit'
            },
            {
                'name': 'Postback Processor',
                'status': 'running',
                'type': 'background',
                'description': 'Processes incoming conversion postbacks from ad networks'
            },
            {
                'name': 'Schedule Activation',
                'status': 'running',
                'type': 'background',
                'description': 'Auto-activates/deactivates offers based on start/end dates'
            },
            {
                'name': 'Price Boost',
                'status': 'running',
                'type': 'background',
                'description': 'Checks for expired price boosts every 5 minutes'
            },
            {
                'name': 'Scheduled Emails',
                'status': 'running',
                'type': 'background',
                'description': 'Sends queued notification emails to publishers'
            },
            {
                'name': 'Offer Rotation',
                'status': 'running',
                'type': 'background',
                'description': 'Rotates 1000 offers every 24 hours for visibility'
            },
            {
                'name': 'Campaign Processor',
                'status': 'running',
                'type': 'background',
                'description': 'Processes bulk email campaign queue'
            },
            {
                'name': 'Location Retry',
                'status': 'running',
                'type': 'background',
                'description': 'Retries failed IP geolocation lookups every 15 min'
            },
            {
                'name': 'Telegram Bot',
                'status': 'running',
                'type': 'background',
                'description': 'Posts trending offers to Telegram every 7 hours'
            },
            {
                'name': 'Voqall Auto-Sync',
                'status': 'running',
                'type': 'background',
                'description': 'Fetches & updates Voqall surveys every 23 hours with lookup enrichment'
            },
            {
                'name': 'Voqall Sub-Wall Automation',
                'status': 'running',
                'type': 'background',
                'description': 'After each Voqall sync: renames surveys to "YIS Survey", marks subwall-exclusive, adds to Moustache Survey\'s sub-wall'
            },
            {
                'name': 'MarketXcel Auto-Sync',
                'status': 'running',
                'type': 'background',
                'description': 'Fetches & updates MarketXcel surveys every 23 hours'
            },
            {
                'name': 'MarketXcel Sub-Wall Automation',
                'status': 'running',
                'type': 'background',
                'description': 'After each MarketXcel sync: renames surveys to "YIS Survey", marks subwall-exclusive, adds to Moustache Survey\'s sub-wall'
            },
            {
                'name': 'Offer Inactivity Check',
                'status': 'manual',
                'type': 'button',
                'description': 'Deactivates offers with 0 clicks in 30 days (click to run)'
            },
            {
                'name': 'Invoice Generation',
                'status': 'manual',
                'type': 'button',
                'description': 'Generates monthly invoices (click on 1st of month)'
            },
            {
                'name': 'Placement Auto-Approval',
                'status': 'disabled',
                'type': 'manual',
                'description': 'Admin approves placements manually from Placements page'
            },
            {
                'name': 'Automation Engine',
                'status': 'disabled',
                'type': 'disabled',
                'description': 'Custom automation rules (not in use)'
            },
            {
                'name': 'Search Auto-Activation',
                'status': 'disabled',
                'type': 'disabled',
                'description': 'Disabled — access request flow is used instead'
            },
        ]
        
        return jsonify({
            'services': services,
            'total_running': sum(1 for s in services if s['status'] == 'running'),
            'total_manual': sum(1 for s in services if s['status'] == 'manual'),
            'total_disabled': sum(1 for s in services if s['status'] == 'disabled'),
            'estimated_memory_mb': 220
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/voqall-sync/run', methods=['POST'])
@token_required
@admin_required
def run_voqall_sync_now():
    """
    Manually trigger a Voqall sync right now.
    Fetches all voqall presets, enriches with lookup data, imports/updates surveys.
    """
    try:
        from services.voqall_sync_service import get_voqall_sync_service
        svc = get_voqall_sync_service()
        result = svc.run_now()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"Manual Voqall sync failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/voqall-sync/status', methods=['GET'])
@token_required
@admin_required
def get_voqall_sync_status():
    """Get Voqall auto-sync service status (last run, next run, last result)."""
    try:
        from services.voqall_sync_service import get_voqall_sync_service
        svc = get_voqall_sync_service()
        return jsonify({'success': True, 'status': svc.get_status()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/voqall-subwall/run', methods=['POST'])
@token_required
@admin_required
def run_voqall_subwall_automation():
    """
    Manually trigger the Voqall sub-wall automation:
    - Rename all active Voqall offers to "YIS Survey"
    - Mark them as subwall_exclusive
    - Add them to the "Moustache Survey's" sub-wall (slug: moustache-survey-s)
    """
    try:
        from services.voqall_subwall_service import run_voqall_subwall_automation as _run
        result = _run()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"Voqall sub-wall automation manual run failed: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/market-excel-sync/run', methods=['POST'])
@token_required
@admin_required
def run_market_excel_sync_now():
    """Manually trigger a MarketXcel sync right now."""
    try:
        from services.market_excel_sync_service import get_market_excel_sync_service
        svc = get_market_excel_sync_service()
        result = svc.run_now()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"Manual MarketXcel sync failed: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/market-excel-sync/status', methods=['GET'])
@token_required
@admin_required
def get_market_excel_sync_status():
    """Get MarketXcel auto-sync service status (last run, next run, last result)."""
    try:
        from services.market_excel_sync_service import get_market_excel_sync_service
        svc = get_market_excel_sync_service()
        return jsonify({'success': True, 'status': svc.get_status()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/market-excel-subwall/run', methods=['POST'])
@token_required
@admin_required
def run_market_excel_subwall_automation():
    """
    Manually trigger the MarketXcel sub-wall automation:
    - Rename all active MarketXcel offers to "YIS Survey"
    - Mark them as subwall_exclusive
    - Add them to the "Moustache Survey's" sub-wall
    """
    try:
        from services.voqall_subwall_service import run_marketxcel_subwall_automation as _run
        result = _run()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"MarketXcel sub-wall automation manual run failed: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# ── OpinionSpark Manual Triggers ──────────────────────────────────────────────

@admin_automation_bp.route('/api/admin/automation/opinionspark-sync/run', methods=['POST'])
@token_required
@admin_required
def run_opinionspark_sync_now():
    """Manually trigger an OpinionSpark sync right now."""
    try:
        from services.opinionspark_sync_service import get_opinionspark_sync_service
        svc = get_opinionspark_sync_service()
        result = svc.run_now()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"Manual OpinionSpark sync failed: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/opinionspark-sync/status', methods=['GET'])
@token_required
@admin_required
def get_opinionspark_sync_status():
    """Get OpinionSpark auto-sync service status (last run, next run, last result)."""
    try:
        from services.opinionspark_sync_service import get_opinionspark_sync_service
        svc = get_opinionspark_sync_service()
        return jsonify({'success': True, 'status': svc.get_status()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/opinionspark-subwall/run', methods=['POST'])
@token_required
@admin_required
def run_opinionspark_subwall_automation():
    """
    Manually trigger the OpinionSpark sub-wall automation:
    - Rename all active OpinionSpark offers to "YIS Survey"
    - Mark them as subwall_exclusive
    - Add them to the "Moustache Survey's" sub-wall
    """
    try:
        from services.voqall_subwall_service import run_opinionspark_subwall_automation as _run
        result = _run()
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"OpinionSpark sub-wall automation manual run failed: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Expired Offer Cleanup ──────────────────────────────────────────────────────

@admin_automation_bp.route('/api/admin/automation/expired-offers/preview', methods=['GET'])
@token_required
@admin_required
def preview_expired_cleanup():
    """
    Preview what would be deleted — returns counts and a sample list.
    Always call this before the actual delete to show the admin what will be removed.
    Uses bulk $in queries — never loops per-offer.
    """
    try:
        offers_col = db_instance.get_collection('offers')
        clicks_col = db_instance.get_collection('clicks')
        conv_col   = db_instance.get_collection('conversions')

        if offers_col is None:
            return jsonify({'success': False, 'error': 'DB not available'}), 500

        # 1. Fetch all expired offers in one query
        expired = list(offers_col.find(
            {'status': 'expired'},
            {'offer_id': 1, 'name': 1, 'import_source': 1, 'offer_source': 1,
             'source': 1, 'hits': 1, 'updated_at': 1}
        ))

        if not expired:
            return jsonify({
                'success': True, 'total_expired': 0,
                'safe_to_delete': 0, 'has_history': 0,
                'sample_safe': [], 'sample_history': [],
            })

        all_ids = [o['offer_id'] for o in expired if o.get('offer_id')]

        # 2. One bulk query — which offer_ids have ANY clicks?
        ids_with_clicks = set()
        if clicks_col is not None:
            cursor = clicks_col.distinct('offer_id', {'offer_id': {'$in': all_ids}})
            ids_with_clicks = set(cursor)

        # 3. One bulk query — which offer_ids have ANY conversions?
        ids_with_conv = set()
        if conv_col is not None:
            cursor = conv_col.distinct('offer_id', {'offer_id': {'$in': all_ids}})
            ids_with_conv = set(cursor)

        # 4. Classify in memory — no more per-offer DB calls
        safe_to_delete = []
        has_history    = []

        for offer in expired:
            oid = offer.get('offer_id')
            if not oid:
                continue

            hits       = int(offer.get('hits') or 0)
            has_clicks = oid in ids_with_clicks
            has_conv   = oid in ids_with_conv
            source     = (offer.get('import_source') or offer.get('offer_source') or
                          offer.get('source') or 'unknown')

            updated_at = offer.get('updated_at')
            entry = {
                'offer_id': oid,
                'name':     offer.get('name', ''),
                'source':   source,
                'hits':     hits,
                'has_clicks':      has_clicks,
                'has_conversions': has_conv,
                'updated_at': updated_at.isoformat() + 'Z' if hasattr(updated_at, 'isoformat') else '',
            }

            if hits == 0 and not has_clicks and not has_conv:
                safe_to_delete.append(entry)
            else:
                has_history.append(entry)

        return jsonify({
            'success':       True,
            'total_expired': len(expired),
            'safe_to_delete': len(safe_to_delete),
            'has_history':   len(has_history),
            'sample_safe':   safe_to_delete[:20],
            'sample_history': has_history[:10],
        })

    except Exception as e:
        logger.error(f'preview_expired_cleanup error: {e}', exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/expired-offers/delete', methods=['DELETE'])
@token_required
@admin_required
def delete_expired_offers():
    """
    Hard-delete all expired offers that have:
      - hits = 0
      - no records in clicks collection
      - no records in conversions collection

    Offers with any click/conversion history are NEVER deleted — they are kept
    for audit trail and reporting purposes.
    """
    try:
        offers_col = db_instance.get_collection('offers')
        clicks_col = db_instance.get_collection('clicks')
        conv_col   = db_instance.get_collection('conversions')

        if offers_col is None:
            return jsonify({'success': False, 'error': 'DB not available'}), 500

        # 1. Fetch all expired offer_ids in one query
        expired = list(offers_col.find(
            {'status': 'expired'},
            {'offer_id': 1, 'hits': 1}
        ))

        if not expired:
            return jsonify({'success': True, 'deleted': 0, 'skipped': 0,
                            'message': 'No expired offers found'})

        all_ids = [o['offer_id'] for o in expired if o.get('offer_id')]

        # 2. One bulk query each — which IDs have clicks / conversions?
        ids_with_clicks = set()
        if clicks_col is not None:
            ids_with_clicks = set(clicks_col.distinct('offer_id', {'offer_id': {'$in': all_ids}}))

        ids_with_conv = set()
        if conv_col is not None:
            ids_with_conv = set(conv_col.distinct('offer_id', {'offer_id': {'$in': all_ids}}))

        # 3. Classify in memory
        safe_ids    = []
        skipped_ids = []

        for offer in expired:
            oid  = offer.get('offer_id')
            hits = int(offer.get('hits') or 0)
            if not oid:
                continue

            if hits == 0 and oid not in ids_with_clicks and oid not in ids_with_conv:
                safe_ids.append(oid)
            else:
                skipped_ids.append(oid)

        deleted = 0
        if safe_ids:
            # Remove from sub_walls before deleting
            sub_walls_col = db_instance.get_collection('sub_walls')
            if sub_walls_col is not None:
                sub_walls_col.update_many(
                    {},
                    {'$pull': {'offer_ids': {'$in': safe_ids}}}
                )

            result = offers_col.delete_many({'offer_id': {'$in': safe_ids}})
            deleted = result.deleted_count

            logger.info(
                f'Expired offer cleanup: deleted={deleted}, '
                f'skipped_has_history={len(skipped_ids)}, '
                f'run_by={getattr(request, "current_user", {}).get("username", "admin")}'
            )

        return jsonify({
            'success':  True,
            'deleted':  deleted,
            'skipped':  len(skipped_ids),
            'message':  (
                f'Deleted {deleted} expired offer(s) with no history. '
                f'Kept {len(skipped_ids)} offer(s) that have click/conversion records.'
            ),
        })

    except Exception as e:
        logger.error(f'delete_expired_offers error: {e}', exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
