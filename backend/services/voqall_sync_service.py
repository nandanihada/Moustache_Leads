"""
Voqall Auto-Sync Service
========================
Background service that:
1. Fetches Voqall lookup tables (languages, industries, study types) once per session,
   caching them for 24 hours.
2. Every 23 hours, reads all network_presets with network_type='voqall' and
   auto-imports/updates surveys into the offers collection.
3. Deactivates surveys that are no longer returned by the Voqall API (stale detection).

The service runs as a daemon thread started once per worker process.
"""

import logging
import threading
import time
import concurrent.futures
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Lookup cache (in-memory, shared across calls within the same process) ──────
_LOOKUP_CACHE: Dict[str, dict] = {}       # key → {data, expires}
_LOOKUP_CACHE_TTL = 24 * 3600             # 24 hours


# ── Industry ID → vertical/category mapping (from Voqall docs) ─────────────────
# These are stable IDs; enriched further from /collection/industries at runtime
_INDUSTRY_VERTICAL_FALLBACK = {
    1:  'Technology',
    2:  'Finance',
    3:  'Healthcare',
    4:  'Retail',
    5:  'Automotive',
    6:  'Travel',
    7:  'Entertainment',
    8:  'Education',
    9:  'Food & Beverage',
    10: 'Politics',
    11: 'Sports',
    12: 'Beauty',
    13: 'Home & Garden',
    14: 'Pets',
    15: 'Gaming',
}


class VoqallSyncService:
    """Singleton background service for Voqall offer auto-sync."""

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
        logger.info("VoqallSyncService initialized")

    # ── Public API ───────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            logger.warning("VoqallSyncService is already running")
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name='voqall-sync'
        )
        self._thread.start()
        logger.info("✅ Voqall auto-sync service started (every 23 hours)")

    def stop(self):
        self._running = False
        logger.info("VoqallSyncService stopped")

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
        logger.info("🔄 Voqall sync triggered manually")
        return self._sync_all_voqall_presets()

    # ── Background loop ──────────────────────────────────────────────────────────

    def _loop(self):
        logger.info("🔄 Voqall sync loop started")
        while self._running:
            try:
                result = self._sync_all_voqall_presets()
                self._last_run = datetime.utcnow()
                self._last_result = result
            except Exception as e:
                logger.error(f"Voqall sync loop error: {e}", exc_info=True)
            # Sleep for 23 hours before next run
            time.sleep(self._interval)

    # ── Core sync logic ──────────────────────────────────────────────────────────

    def _sync_all_voqall_presets(self) -> dict:
        """
        Read all network_presets with network_type='voqall' and sync each one.
        Returns a summary dict.
        """
        from database import db_instance

        presets_col = db_instance.get_collection('network_presets')
        if presets_col is None:
            logger.warning("Voqall sync: DB not available")
            return {'error': 'DB not available', 'synced': 0}

        voqall_presets = list(presets_col.find({'network_type': 'voqall'}))
        if not voqall_presets:
            logger.info("Voqall sync: No voqall presets configured — skipping")
            return {'message': 'No voqall presets configured', 'synced': 0}

        logger.info(f"🔄 Voqall sync: found {len(voqall_presets)} preset(s)")

        total_created = 0
        total_updated = 0
        total_deactivated = 0
        total_errors = 0
        preset_results = []

        for preset in voqall_presets:
            try:
                result = self._sync_single_preset(preset)
                total_created    += result.get('created', 0)
                total_updated    += result.get('updated', 0)
                total_deactivated += result.get('deactivated', 0)
                total_errors     += result.get('errors', 0)
                preset_results.append({
                    'preset': preset.get('display_name', str(preset.get('_id'))),
                    **result,
                })
            except Exception as e:
                logger.error(
                    f"Voqall sync error for preset {preset.get('display_name')}: {e}",
                    exc_info=True
                )
                total_errors += 1
                preset_results.append({
                    'preset': preset.get('display_name', str(preset.get('_id'))),
                    'error': str(e),
                })

        summary = {
            'run_at': datetime.utcnow().isoformat() + 'Z',
            'presets_synced': len(voqall_presets),
            'total_created': total_created,
            'total_updated': total_updated,
            'total_deactivated': total_deactivated,
            'total_errors': total_errors,
            'preset_details': preset_results,
        }
        logger.info(
            f"✅ Voqall sync complete: created={total_created}, "
            f"updated={total_updated}, deactivated={total_deactivated}, "
            f"errors={total_errors}"
        )
        return summary

    def _sync_single_preset(self, preset: dict) -> dict:
        """Sync surveys for a single network preset."""
        from services.network_api_service import network_api_service
        from services.network_field_mapper import network_field_mapper
        from utils.bulk_operations import get_bulk_offer_processor
        from services.tracking_link_generator import apply_network_offer_params
        from database import db_instance

        network_id   = preset.get('network_id', 'voqall')
        api_key      = preset.get('api_key', '')
        fetch_mode   = preset.get('fetch_mode', 'my_offers')
        display_name = preset.get('display_name', 'voqall')

        if not api_key:
            return {'error': 'No api_key in preset', 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1}

        logger.info(f"🔄 Syncing Voqall preset: {display_name}")

        # 1. Fetch lookup tables (cached for 24h)
        lookups = self._fetch_lookups_cached(api_key, network_id)

        # 2. Fetch surveys from Voqall
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, 'voqall', {}, None, fetch_mode
        )
        if error:
            logger.error(f"Voqall fetch error for {display_name}: {error}")
            return {'error': error, 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1}

        if not offers:
            logger.info(f"Voqall sync: No surveys returned for {display_name}")
            return {'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 0, 'fetched': 0}

        logger.info(f"Voqall sync: {len(offers)} surveys fetched for {display_name}")

        # 3. Enrich raw offer data with lookups before mapping
        enriched_offers = [self._enrich_survey(o, lookups) for o in offers]

        # 4. Map to DB format
        mapped_offers = []
        mapping_errors = []
        for idx, offer_data in enumerate(enriched_offers):
            try:
                mapped = network_field_mapper.map_to_db_format(offer_data, 'voqall', network_id)
                if not mapped:
                    mapping_errors.append(f"Row {idx+1}: failed to map")
                    continue
                # Use display_name as the network label (lowercased)
                mapped['network'] = display_name.lower()
                mapped['show_in_offerwall'] = True
                mapped['status'] = 'active'
                mapped['show_in_offerwall_source'] = 'api_import'
                mapped['show_in_offerwall_added_at'] = datetime.utcnow()
                mapped['show_in_offerwall_added_by'] = 'voqall_auto_sync'
                mapped['approval_settings'] = {
                    'type': 'auto_approve',
                    'require_approval': False,
                    'auto_approve_delay': 0,
                    'approval_message': '',
                    'max_inactive_days': 0,
                }
                mapped['approval_type'] = 'auto_approve'
                mapped['require_approval'] = False
                # Apply partner network params to URL
                mapped.update(apply_network_offer_params(mapped))
                mapped_offers.append(mapped)
            except Exception as e:
                mapping_errors.append(f"Row {idx+1}: {e}")

        if mapping_errors:
            logger.warning(f"Voqall mapping errors for {display_name}: {mapping_errors[:5]}")

        # 5. Bulk upsert (update existing, create new)
        bulk_processor = get_bulk_offer_processor(db_instance)
        result = bulk_processor.bulk_create_offers_optimized(
            mapped_offers,
            created_by='voqall_auto_sync',
            duplicate_strategy='update',  # update existing surveys with fresh data
        )

        created = result['stats'].get('created', 0)
        updated = result['stats'].get('updated', 0)

        # 6. Stale detection — deactivate surveys no longer in the API response
        deactivated = self._deactivate_stale_surveys(
            offers, display_name, db_instance
        )

        return {
            'fetched': len(offers),
            'created': created,
            'updated': updated,
            'deactivated': deactivated,
            'errors': len(mapping_errors) + result['stats'].get('errors', 0),
        }

    # ── Lookup fetching with 24h cache ───────────────────────────────────────────

    def _fetch_lookups_cached(self, api_key: str, network_id: str) -> dict:
        """
        Fetch /collection/languages, /collection/industries, /collection/studytypes
        in parallel.  Results are cached for 24 hours per api_key.
        """
        cache_key = f"voqall_lookups_{api_key[:12]}"
        now = time.time()

        if cache_key in _LOOKUP_CACHE:
            entry = _LOOKUP_CACHE[cache_key]
            if entry['expires'] > now:
                logger.debug("Voqall lookups: using cached data")
                return entry['data']

        from services.network_api_service import network_api_service
        base_url = network_api_service._voqall_resolve_base_url(network_id, api_key)

        endpoints = {
            'languages':  f"{base_url}/collection/languages",
            'industries': f"{base_url}/collection/industries",
            'studytypes': f"{base_url}/collection/studytypes",
        }

        raw = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                key: executor.submit(
                    network_api_service.session.get,
                    url,
                    headers={'EQ-PARTNER-ACCESS-KEY': api_key},
                    timeout=12,
                )
                for key, url in endpoints.items()
            }
            for key, future in futures.items():
                try:
                    resp = future.result()
                    resp.raise_for_status()
                    raw[key] = resp.json()
                except Exception as e:
                    logger.warning(f"Voqall lookup fetch failed for {key}: {e}")
                    raw[key] = {}

        # Build usable lookup dicts
        lookups = {
            'language_map': self._build_language_map(raw.get('languages', {})),
            'industry_map': self._build_industry_map(raw.get('industries', {})),
            'studytype_map': self._build_studytype_map(raw.get('studytypes', {})),
        }

        _LOOKUP_CACHE[cache_key] = {'data': lookups, 'expires': now + _LOOKUP_CACHE_TTL}
        logger.info(
            f"Voqall lookups fetched: "
            f"{len(lookups['language_map'])} languages, "
            f"{len(lookups['industry_map'])} industries, "
            f"{len(lookups['studytype_map'])} study types"
        )
        return lookups

    def _build_language_map(self, raw: dict) -> Dict[int, dict]:
        """
        Build {language_id: {'name': str, 'country_code': str}} from
        GET /collection/languages response.

        Response shape: {"Languages": [{"Id": 1, "Name": "English - United Kingdom", "CountryCode": "GB"}, ...]}
        """
        result = {}
        for item in raw.get('Languages', []):
            lid = item.get('Id')
            if lid is not None:
                result[int(lid)] = {
                    'name': item.get('Name', ''),
                    'country_code': item.get('CountryCode', ''),
                }
        return result

    def _build_industry_map(self, raw: dict) -> Dict[int, str]:
        """
        Build {industry_id: industry_name} from GET /collection/industries response.

        Response shape: {"Industries": [{"Id": 1, "Name": "Technology"}, ...]}
        """
        result = {}
        for item in raw.get('Industries', []):
            iid = item.get('Id')
            if iid is not None:
                result[int(iid)] = item.get('Name', '')
        return result

    def _build_studytype_map(self, raw: dict) -> Dict[int, str]:
        """
        Build {study_type_id: study_type_name} from GET /collection/studytypes.

        Response shape: {"StudyTypes": [{"Id": 1, "Name": "Online Survey"}, ...]}
        """
        result = {}
        for item in raw.get('StudyTypes', []):
            sid = item.get('Id')
            if sid is not None:
                result[int(sid)] = item.get('Name', '')
        return result

    # ── Survey enrichment ────────────────────────────────────────────────────────

    def _enrich_survey(self, survey: dict, lookups: dict) -> dict:
        """
        Inject resolved country/language/industry data into the raw survey dict
        so _map_voqall_offer can use it directly.
        """
        survey = dict(survey)  # don't mutate original

        language_map = lookups.get('language_map', {})
        industry_map = lookups.get('industry_map', {})
        studytype_map = lookups.get('studytype_map', {})

        # Resolve LanguageId → country code + language name
        lang_id = survey.get('LanguageId')
        if lang_id and int(lang_id) in language_map:
            lang_info = language_map[int(lang_id)]
            survey['_resolved_country_code'] = lang_info.get('country_code', 'WW')
            survey['_resolved_language_name'] = lang_info.get('name', '')
        else:
            survey['_resolved_country_code'] = 'WW'
            survey['_resolved_language_name'] = ''

        # Resolve IndustryId → industry name (vertical)
        industry_id = survey.get('IndustryId')
        if industry_id and int(industry_id) in industry_map:
            survey['_resolved_industry'] = industry_map[int(industry_id)]
        elif industry_id and int(industry_id) in _INDUSTRY_VERTICAL_FALLBACK:
            survey['_resolved_industry'] = _INDUSTRY_VERTICAL_FALLBACK[int(industry_id)]
        else:
            survey['_resolved_industry'] = 'SURVEY'

        # Resolve StudyTypeId → study type name
        study_id = survey.get('StudyTypeId')
        if study_id and int(study_id) in studytype_map:
            survey['_resolved_study_type'] = studytype_map[int(study_id)]
        else:
            survey['_resolved_study_type'] = ''

        return survey

    # ── Stale detection ──────────────────────────────────────────────────────────

    def _deactivate_stale_surveys(
        self, live_surveys: List[dict], network_name: str, db_instance
    ) -> int:
        """
        Surveys in our DB from this network that were NOT returned by the latest
        API call get marked as 'paused' (stale).
        Returns count of deactivated surveys.
        """
        try:
            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                return 0

            live_ids = set(str(s.get('SurveyId', '')) for s in live_surveys if s.get('SurveyId'))

            # Find all active/running Voqall offers in our DB from this network
            # Use import_source to catch ALL voqall offers regardless of network display name
            existing = list(offers_col.find(
                {
                    'import_source': 'voqall',
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
                    'status': 'paused',
                    'is_active': False,
                    'voqall_stale_at': datetime.utcnow(),
                    'voqall_stale_reason': 'Not returned by Voqall API',
                    'updated_at': datetime.utcnow(),
                }}
            )
            logger.info(
                f"Voqall stale detection: deactivated {len(stale)} surveys "
                f"for network '{network_name}'"
            )
            return len(stale)

        except Exception as e:
            logger.error(f"Voqall stale detection error: {e}", exc_info=True)
            return 0


# ── Singleton accessor ────────────────────────────────────────────────────────

def get_voqall_sync_service() -> VoqallSyncService:
    return VoqallSyncService()
