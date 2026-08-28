"""
OpinionSpark Auto-Sync Service
==============================
Background service that mirrors the Voqall sync pattern for the OpinionSpark
Supplier API (same wire format, different base URL and auth header).

Key differences from Voqall:
  - Base URL:  https://supplier-api.opinionspark.co/api/v1  (prod)
               https://supplier-api-sandbox.opinionspark.co/api/v1  (sandbox)
  - Auth header: ob-partner-access-key  (instead of EQ-PARTNER-ACCESS-KEY)
  - network_type stored as 'opinionspark' in network_presets and offers collections

The sync service:
1. Fetches lookup tables (languages, industries, study types) — same endpoints as Voqall.
2. Every 23 hours reads all network_presets with network_type='opinionspark' and
   auto-imports / updates surveys in the offers collection.
3. Deactivates surveys no longer returned by the API (stale detection).
"""

import logging
import threading
import time
import concurrent.futures
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Lookup cache shared with the OpinionSpark process ─────────────────────────
_OS_LOOKUP_CACHE: Dict[str, dict] = {}
_OS_LOOKUP_CACHE_TTL = 24 * 3600   # 24 hours

# ── Industry ID → vertical/category mapping (from OpinionSpark collection/industries) ─────
# These are the REAL IDs from the live API — different from Voqall's IDs
_INDUSTRY_VERTICAL_FALLBACK = {
    1:  'Automotive',
    2:  'Beauty/Cosmetics',
    3:  'Beverages - Alcoholic',
    4:  'Beverages - Non Alcoholic',
    5:  'Education',
    6:  'Electronics/Computer/Software',
    7:  'Entertainment (Movies, Music, TV, etc)',
    8:  'Fashion/Clothing',
    9:  'Financial Services/Insurance',
    10: 'Food/Snacks',
    11: 'Gambling/Lottery',
    12: 'Healthcare/Pharmaceuticals',
    13: 'Home (Utilities, Appliances, ...)',
    14: 'Home Entertainment',
    15: 'Home Improvement/RealEstates/Construction',
    16: 'IT (Servers, Databases, etc)',
    17: 'Personal Care/Toiletries',
    18: 'Pets',
    19: 'Politics',
    20: 'Publishing(Newspapers,magazines,Books)',
    21: 'Restaurants',
    22: 'Sports',
    23: 'Telecommunications',
    24: 'Tobacco',
    25: 'Toys',
    26: 'Transportation/Shipping',
    27: 'Travel',
    28: 'Video Games',
    29: 'Websites/Internet/Ecommerce',
    30: 'Other',
    31: 'Sensitive Content',
    32: 'Explicit Content',
}


class OpinionSparkSyncService:
    """Singleton background service for OpinionSpark offer auto-sync."""

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
        self._interval = 23 * 3600
        self._last_run: Optional[datetime] = None
        self._last_result: Optional[dict] = None
        logger.info("OpinionSparkSyncService initialized")

    # ── Public API ───────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            logger.warning("OpinionSparkSyncService is already running")
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name='opinionspark-sync'
        )
        self._thread.start()
        logger.info("✅ OpinionSpark auto-sync service started (every 23 hours)")

    def stop(self):
        self._running = False
        logger.info("OpinionSparkSyncService stopped")

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
        logger.info("🔄 OpinionSpark sync triggered manually")
        return self._sync_all_opinionspark_presets()

    # ── Background loop ──────────────────────────────────────────────────────────

    def _loop(self):
        logger.info("🔄 OpinionSpark sync loop started")
        while self._running:
            try:
                result = self._sync_all_opinionspark_presets()
                self._last_run = datetime.utcnow()
                self._last_result = result
            except Exception as e:
                logger.error(f"OpinionSpark sync loop error: {e}", exc_info=True)
            time.sleep(self._interval)

    # ── Core sync logic ──────────────────────────────────────────────────────────

    def _sync_all_opinionspark_presets(self) -> dict:
        """Read all network_presets with network_type='opinionspark' and sync each."""
        from database import db_instance

        presets_col = db_instance.get_collection('network_presets')
        if presets_col is None:
            logger.warning("OpinionSpark sync: DB not available")
            return {'error': 'DB not available', 'synced': 0}

        os_presets = list(presets_col.find({'network_type': 'opinionspark'}))
        if not os_presets:
            logger.info("OpinionSpark sync: No opinionspark presets configured — skipping")
            return {'message': 'No opinionspark presets configured', 'synced': 0}

        logger.info(f"🔄 OpinionSpark sync: found {len(os_presets)} preset(s)")

        total_created = total_updated = total_deactivated = total_errors = 0
        preset_results = []

        for preset in os_presets:
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
                    f"OpinionSpark sync error for preset {preset.get('display_name')}: {e}",
                    exc_info=True
                )
                total_errors += 1
                preset_results.append({
                    'preset': preset.get('display_name', str(preset.get('_id'))),
                    'error': str(e),
                })

        summary = {
            'run_at': datetime.utcnow().isoformat() + 'Z',
            'presets_synced': len(os_presets),
            'total_created': total_created,
            'total_updated': total_updated,
            'total_deactivated': total_deactivated,
            'total_errors': total_errors,
            'preset_details': preset_results,
        }
        logger.info(
            f"✅ OpinionSpark sync complete: created={total_created}, "
            f"updated={total_updated}, deactivated={total_deactivated}, "
            f"errors={total_errors}"
        )
        return summary

    def _sync_single_preset(self, preset: dict) -> dict:
        """Sync surveys for a single OpinionSpark network preset."""
        from services.network_api_service import network_api_service
        from services.network_field_mapper import network_field_mapper
        from utils.bulk_operations import get_bulk_offer_processor
        from services.tracking_link_generator import apply_network_offer_params
        from database import db_instance

        network_id   = preset.get('network_id', 'opinionspark')
        api_key      = preset.get('api_key', '')
        fetch_mode   = preset.get('fetch_mode', 'my_offers')
        display_name = preset.get('display_name', 'opinionspark')

        if not api_key:
            return {'error': 'No api_key in preset', 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1}

        logger.info(f"🔄 Syncing OpinionSpark preset: {display_name}")

        # 1. Fetch lookup tables (cached for 24h)
        lookups = self._fetch_lookups_cached(api_key, network_id)

        # 2. Fetch surveys from OpinionSpark
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, 'opinionspark', {}, None, fetch_mode
        )
        if error:
            logger.error(f"OpinionSpark fetch error for {display_name}: {error}")
            return {'error': error, 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 1}

        if not offers:
            logger.info(f"OpinionSpark sync: No surveys returned for {display_name}")
            return {'created': 0, 'updated': 0, 'deactivated': 0, 'errors': 0, 'fetched': 0}

        logger.info(f"OpinionSpark sync: {len(offers)} surveys fetched for {display_name}")

        # 3. Enrich raw survey data with lookups before mapping
        enriched_offers = [self._enrich_survey(o, lookups) for o in offers]

        # 4. Map to DB format
        mapped_offers = []
        mapping_errors = []
        for idx, offer_data in enumerate(enriched_offers):
            try:
                mapped = network_field_mapper.map_to_db_format(offer_data, 'opinionspark', network_id)
                if not mapped:
                    mapping_errors.append(f"Row {idx+1}: failed to map")
                    continue
                mapped['network'] = display_name.lower()
                mapped['show_in_offerwall'] = True
                mapped['status'] = 'active'
                mapped['show_in_offerwall_source'] = 'api_import'
                mapped['show_in_offerwall_added_at'] = datetime.utcnow()
                mapped['show_in_offerwall_added_by'] = 'opinionspark_auto_sync'
                mapped['approval_settings'] = {
                    'type': 'auto_approve',
                    'require_approval': False,
                    'auto_approve_delay': 0,
                    'approval_message': '',
                    'max_inactive_days': 0,
                }
                mapped['approval_type'] = 'auto_approve'
                mapped['require_approval'] = False
                mapped['_preserve_name'] = True
                mapped.update(apply_network_offer_params(mapped))
                mapped_offers.append(mapped)
            except Exception as e:
                mapping_errors.append(f"Row {idx+1}: {e}")

        if mapping_errors:
            logger.warning(f"OpinionSpark mapping errors for {display_name}: {mapping_errors[:5]}")

        if not mapped_offers:
            return {'fetched': len(offers), 'created': 0, 'updated': 0, 'deactivated': 0, 'errors': len(mapping_errors)}

        # 5. Bulk upsert
        bulk_processor = get_bulk_offer_processor(db_instance)
        result = bulk_processor.bulk_create_offers_optimized(
            mapped_offers,
            created_by='opinionspark_auto_sync',
            duplicate_strategy='update',
        )

        created = result['stats'].get('created', 0)
        updated = result['stats'].get('updated', 0)

        # 6. Stale detection
        deactivated = self._deactivate_stale_surveys(offers, display_name, db_instance)

        # 7. Post-sync automation — rename to "YIS Survey" + add to Moustache Survey sub-wall
        try:
            from services.voqall_subwall_service import run_opinionspark_subwall_automation
            subwall_result = run_opinionspark_subwall_automation(db_instance)
            logger.info(
                f'OpinionSpark sub-wall automation: renamed={subwall_result.get("renamed", 0)}, '
                f'added_to_subwall={subwall_result.get("added_to_subwall", 0)}'
            )
        except Exception as e:
            logger.warning(f'OpinionSpark sub-wall automation error (non-fatal): {e}')

        return {
            'fetched': len(offers),
            'created': created,
            'updated': updated,
            'deactivated': deactivated,
            'errors': len(mapping_errors) + result['stats'].get('errors', 0),
        }

    # ── Lookup fetching with 24h cache ───────────────────────────────────────────

    def _fetch_lookups_cached(self, api_key: str, network_id: str) -> dict:
        """Fetch /collection/languages, /collection/industries, /collection/studytypes.
        Results cached for 24 hours per api_key.
        """
        cache_key = f"os_lookups_{api_key[:12]}"
        now = time.time()

        if cache_key in _OS_LOOKUP_CACHE:
            entry = _OS_LOOKUP_CACHE[cache_key]
            if entry['expires'] > now:
                logger.debug("OpinionSpark lookups: using cached data")
                return entry['data']

        from services.network_api_service import network_api_service
        base_url = network_api_service._opinionspark_resolve_base_url(network_id, api_key)

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
                    headers={'ob-partner-access-key': api_key},
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
                    logger.warning(f"OpinionSpark lookup fetch failed for {key}: {e}")
                    raw[key] = {}

        lookups = {
            'language_map': self._build_language_map(raw.get('languages', {})),
            'industry_map': self._build_industry_map(raw.get('industries', {})),
            'studytype_map': self._build_studytype_map(raw.get('studytypes', {})),
        }

        _OS_LOOKUP_CACHE[cache_key] = {'data': lookups, 'expires': now + _OS_LOOKUP_CACHE_TTL}
        logger.info(
            f"OpinionSpark lookups fetched: "
            f"{len(lookups['language_map'])} languages, "
            f"{len(lookups['industry_map'])} industries, "
            f"{len(lookups['studytype_map'])} study types"
        )
        return lookups

    def _build_language_map(self, raw: dict) -> Dict[int, dict]:
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
        result = {}
        for item in raw.get('Industries', []):
            iid = item.get('Id')
            if iid is not None:
                result[int(iid)] = item.get('Name', '')
        return result

    def _build_studytype_map(self, raw: dict) -> Dict[int, str]:
        result = {}
        for item in raw.get('StudyTypes', []):
            sid = item.get('Id')
            if sid is not None:
                result[int(sid)] = item.get('Name', '')
        return result

    # ── Survey enrichment ────────────────────────────────────────────────────────

    def _enrich_survey(self, survey: dict, lookups: dict) -> dict:
        """Inject resolved country/language/industry data into the raw survey dict."""
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
        """Mark surveys no longer returned by the API as 'paused' (stale)."""
        try:
            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                return 0

            live_ids = set(str(s.get('SurveyId', '')) for s in live_surveys if s.get('SurveyId'))

            existing = list(offers_col.find(
                {
                    'import_source': 'opinionspark',
                    'status': {'$in': ['active', 'running']},
                },
                {'campaign_id': 1, '_id': 1}
            ))

            stale = [
                o for o in existing
                if str(o.get('campaign_id', '')).strip() not in live_ids
            ]

            if not stale:
                return 0

            stale_ids = [o['_id'] for o in stale]
            result = offers_col.update_many(
                {'_id': {'$in': stale_ids}},
                {'$set': {
                    'status': 'expired',
                    'is_active': False,
                    'opinionspark_stale_at': datetime.utcnow(),
                    'opinionspark_stale_reason': 'Not returned by OpinionSpark API',
                    'updated_at': datetime.utcnow(),
                }}
            )
            deactivated = result.modified_count
            logger.info(f"OpinionSpark stale detection: expired {deactivated} surveys for {network_name}")
            return deactivated

        except Exception as e:
            logger.error(f"OpinionSpark stale detection error: {e}", exc_info=True)
            return 0


# ── Module-level singleton accessor ─────────────────────────────────────────────

_sync_service: Optional[OpinionSparkSyncService] = None
_sync_service_lock = threading.Lock()


def get_opinionspark_sync_service() -> OpinionSparkSyncService:
    global _sync_service
    if _sync_service is None:
        with _sync_service_lock:
            if _sync_service is None:
                _sync_service = OpinionSparkSyncService()
    return _sync_service
