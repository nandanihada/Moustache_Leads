"""
MarketXcel Auto-Sync Service
=============================
Background service that:
1. Every 23 hours, reads all network_presets with network_type='marketxcel' and
   auto-imports/updates surveys into the offers collection.
2. Deactivates surveys that are no longer returned by the MarketXcel API (stale detection).
3. After each sync, runs the sub-wall automation:
   - Renames all active MarketXcel offers to "YIS Survey"
   - Marks them as subwall_exclusive
   - Adds them to the "Moustache Survey's" sub-wall

Identical pattern to VoqallSyncService.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class MarketExcelSyncService:
    """Singleton background service for MarketXcel offer auto-sync."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._running = False
        self._thread = None
        self._interval = 23 * 3600          # 23 hours in seconds
        self._last_run: Optional[datetime] = None
        self._last_result: Optional[dict] = None
        logger.info('MarketExcelSyncService initialized')

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            logger.warning('MarketExcelSyncService is already running')
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name='market-excel-sync'
        )
        self._thread.start()
        logger.info('✅ MarketXcel auto-sync service started (every 23 hours)')

    def stop(self):
        self._running = False
        logger.info('MarketExcelSyncService stopped')

    def get_status(self) -> dict:
        return {
            'running': self._running,
            'interval_hours': self._interval / 3600,
            'last_run': self._last_run.isoformat() + 'Z' if self._last_run else None,
            'next_run': (
                (self._last_run + timedelta(seconds=self._interval)).isoformat() + 'Z'
                if self._last_run else 'on next loop'
            ),
            'last_result': self._last_result,
        }

    def run_now(self) -> dict:
        """Manual trigger — run the sync immediately and return results."""
        logger.info('🔄 MarketXcel sync triggered manually')
        return self._sync_all_marketxcel_presets()

    # ── Background loop ───────────────────────────────────────────────────────

    def _loop(self):
        logger.info('🔄 MarketXcel sync loop started')
        while self._running:
            try:
                result = self._sync_all_marketxcel_presets()
                self._last_run = datetime.utcnow()
                self._last_result = result
            except Exception as e:
                logger.error(f'MarketXcel sync loop error: {e}', exc_info=True)
            time.sleep(self._interval)

    # ── Core sync logic ───────────────────────────────────────────────────────

    def _sync_all_marketxcel_presets(self) -> dict:
        """
        Read all network_presets with network_type='marketxcel' and sync each one.
        """
        from database import db_instance

        presets_col = db_instance.get_collection('network_presets')
        if presets_col is None:
            logger.warning('MarketXcel sync: DB not available')
            return {'error': 'DB not available', 'synced': 0}

        presets = list(presets_col.find({'network_type': 'marketxcel'}))
        if not presets:
            logger.info('MarketXcel sync: No marketxcel presets configured — skipping')
            return {'message': 'No marketxcel presets configured', 'synced': 0}

        logger.info(f'🔄 MarketXcel sync: found {len(presets)} preset(s)')

        total_created = 0
        total_updated = 0
        total_deactivated = 0
        total_errors = 0
        preset_results = []

        for preset in presets:
            try:
                result = self._sync_single_preset(preset)
                total_created     += result.get('created', 0)
                total_updated     += result.get('updated', 0)
                total_deactivated += result.get('deactivated', 0)
                total_errors      += result.get('errors', 0)
                preset_results.append({
                    'preset': preset.get('display_name', str(preset.get('_id'))),
                    **result,
                })
            except Exception as e:
                logger.error(
                    f'MarketXcel sync error for preset {preset.get("display_name")}: {e}',
                    exc_info=True
                )
                total_errors += 1
                preset_results.append({
                    'preset': preset.get('display_name', str(preset.get('_id'))),
                    'error': str(e),
                })

        summary = {
            'run_at': datetime.utcnow().isoformat() + 'Z',
            'presets_synced': len(presets),
            'total_created': total_created,
            'total_updated': total_updated,
            'total_deactivated': total_deactivated,
            'total_errors': total_errors,
            'preset_details': preset_results,
        }
        logger.info(
            f'✅ MarketXcel sync complete: created={total_created}, '
            f'updated={total_updated}, deactivated={total_deactivated}, '
            f'errors={total_errors}'
        )
        return summary

    def _sync_single_preset(self, preset: dict) -> dict:
        """Sync surveys for a single MarketXcel network preset."""
        from services.network_api_service import network_api_service
        from services.network_field_mapper import network_field_mapper
        from utils.bulk_operations import get_bulk_offer_processor
        from database import db_instance

        network_id   = preset.get('network_id', '')
        api_key      = preset.get('api_key', '')
        display_name = preset.get('display_name', 'MarketXcel')

        if not network_id or not api_key:
            return {
                'error': 'Missing network_id or api_key in preset',
                'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1,
            }

        logger.info(f'🔄 Syncing MarketXcel preset: {display_name}')

        # 1. Fetch surveys from MarketXcel API
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, 'marketxcel', {}, None
        )
        if error:
            logger.error(f'MarketXcel fetch error for {display_name}: {error}')
            return {'error': error, 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1}

        if not offers:
            logger.info(f'MarketXcel sync: No surveys returned for {display_name}')
            return {'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 0, 'fetched': 0}

        logger.info(f'MarketXcel sync: {len(offers)} surveys fetched for {display_name}')

        # 2. Map to DB format
        mapped_offers = []
        mapping_errors = []
        for idx, offer_data in enumerate(offers):
            try:
                mapped = network_field_mapper.map_to_db_format(offer_data, 'marketxcel', network_id)
                if not mapped:
                    mapping_errors.append(f'Row {idx+1}: failed to map')
                    continue
                # Use display_name as the network label
                mapped['network'] = display_name
                mapped['show_in_offerwall'] = True
                mapped['status'] = 'active'
                mapped['show_in_offerwall_source'] = 'api_import'
                mapped['show_in_offerwall_added_at'] = datetime.utcnow()
                mapped['show_in_offerwall_added_by'] = 'market_excel_auto_sync'
                mapped['approval_settings'] = {
                    'type': 'auto_approve',
                    'require_approval': False,
                    'auto_approve_delay': 0,
                    'approval_message': '',
                    'max_inactive_days': 0,
                }
                mapped['approval_type'] = 'auto_approve'
                mapped['require_approval'] = False
                mapped_offers.append(mapped)
            except Exception as e:
                mapping_errors.append(f'Row {idx+1}: {e}')

        if mapping_errors:
            logger.warning(f'MarketXcel mapping errors for {display_name}: {mapping_errors[:5]}')

        # 3. Bulk upsert
        bulk_processor = get_bulk_offer_processor(db_instance)
        result = bulk_processor.bulk_create_offers_optimized(
            mapped_offers,
            created_by='market_excel_auto_sync',
            duplicate_strategy='update',
        )

        created = result['stats'].get('created', 0)
        updated = result['stats'].get('updated', 0)

        # 4. Stale detection
        deactivated = self._deactivate_stale_surveys(offers, db_instance)

        # 5. Post-sync automation — rename to "YIS Survey" + add to sub-wall
        try:
            from services.voqall_subwall_service import run_marketxcel_subwall_automation
            subwall_result = run_marketxcel_subwall_automation(db_instance)
            logger.info(
                f'MarketXcel sub-wall automation: renamed={subwall_result.get("renamed", 0)}, '
                f'added_to_subwall={subwall_result.get("added_to_subwall", 0)}'
            )
        except Exception as e:
            logger.warning(f'MarketXcel sub-wall automation error (non-fatal): {e}')

        return {
            'fetched': len(offers),
            'created': created,
            'updated': updated,
            'deactivated': deactivated,
            'errors': len(mapping_errors) + result['stats'].get('errors', 0),
        }

    def _deactivate_stale_surveys(self, live_surveys: list, db_instance) -> int:
        """
        Surveys in our DB from MarketXcel that were NOT returned by the latest
        API call get marked as 'paused' (stale).
        """
        try:
            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                return 0

            # Live project_ids from the API response
            live_ids = set(
                str(s.get('project_id', ''))
                for s in live_surveys
                if s.get('project_id')
            )

            existing = list(offers_col.find(
                {
                    'import_source': 'marketxcel',
                    'status': {'$in': ['active', 'running']},
                    '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
                },
                {'offer_id': 1, 'campaign_id': 1, 'name': 1}
            ))

            stale = [
                o for o in existing
                if str(o.get('campaign_id', '')) not in live_ids
            ]

            if not stale:
                return 0

            stale_offer_ids = [o['offer_id'] for o in stale if o.get('offer_id')]
            offers_col.update_many(
                {'offer_id': {'$in': stale_offer_ids}},
                {'$set': {
                    'status': 'expired',
                    'is_active': False,
                    'market_excel_stale_at': datetime.utcnow(),
                    'market_excel_stale_reason': 'Not returned by MarketXcel API',
                    'updated_at': datetime.utcnow(),
                }}
            )
            logger.info(f'MarketXcel stale detection: expired {len(stale)} surveys')
            return len(stale)

        except Exception as e:
            logger.error(f'MarketXcel stale detection error: {e}', exc_info=True)
            return 0


# ── Singleton accessor ────────────────────────────────────────────────────────

def get_market_excel_sync_service() -> MarketExcelSyncService:
    return MarketExcelSyncService()
