"""
Survey Description Refiner Service
====================================
Generates user-friendly descriptions for synced survey offers
(MarketXcel, Voqall, OpinionSpark, Pepperwahl) that are displayed
on the Moustache Surveys sub-wall.

Option B behaviour (smart delta detection):
  - Once a survey is refined, it keeps its refined description.
  - On every sync update, the refiner checks key metrics (LOI, IR, category,
    audience_type, country) against the values captured at refinement time.
  - If *any* tracked field has changed beyond its tolerance, the offer is
    reset to description_refined=False and enters the refinement queue again.

New fields added to offers:
  description_refined          bool   – True once description has been refined
  description_raw              str    – Original machine-generated description (backup)
  description_override         str    – The human-friendly refined description
  description_refined_at       str    – ISO timestamp of last refinement
  description_refined_by       str    – 'auto' | 'admin'
  description_snapshot         dict   – Values of tracked fields at refinement time
                                        (used for delta detection)

Usage
-----
  from services.survey_description_refiner import SurveyDescriptionRefiner

  refiner = SurveyDescriptionRefiner()
  result  = refiner.refine_all(batch_size=100)   # bulk refine unrefined offers
  result  = refiner.refine_one(offer_id)          # refine a single offer
  reset_n = refiner.check_delta_and_reset([offer_doc, ...])  # called by sync pipelines
  stats   = refiner.get_stats()
"""

import logging
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ── Sources that belong to the Moustache Surveys sub-wall ─────────────────────
SURVEY_SOURCES = {'voqall', 'marketxcel', 'opinionspark', 'pepperwahl'}

# ── Delta tolerance: how much a value can change before we reset refinement ───
# LOI and IR changes larger than these trigger a reset
LOI_DELTA_MINUTES = 5        # > 5 min change → reset
IR_DELTA_PERCENT  = 15       # > 15% change in incidence rate → reset


# ─────────────────────────────────────────────────────────────────────────────
# Vertical → friendly label
# ─────────────────────────────────────────────────────────────────────────────

_VERTICAL_LABELS = {
    'TECH':          'Technology',
    'FINANCE':       'Finance',
    'HEALTH':        'Health & Wellness',
    'SHOPPING':      'Retail & Shopping',
    'AUTOMOTIVE':    'Automotive',
    'TRAVEL':        'Travel & Tourism',
    'ENTERTAINMENT': 'Entertainment',
    'EDUCATION':     'Education',
    'FOOD':          'Food & Beverage',
    'POLITICS':      'Politics & Society',
    'SPORTS':        'Sports & Fitness',
    'BEAUTY':        'Beauty & Personal Care',
    'HOME':          'Home & Lifestyle',
    'PETS':          'Pets',
    'GAMING':        'Gaming',
    'SURVEY':        'Consumer Research',
    'GENERAL':       'General',
}

# Audience / study-type → friendly label
_AUDIENCE_LABELS = {
    'b2c':         'Consumer',
    'b2b':         'Business',
    'consumer':    'Consumer',
    'business':    'Business',
    'general':     'General Audience',
    'professional':'Professionals',
    'healthcare':  'Healthcare Professionals',
    'youth':       'Youth (18-24)',
    'seniors':     'Seniors (55+)',
    'parents':     'Parents',
}


# ─────────────────────────────────────────────────────────────────────────────
# Core refiner class
# ─────────────────────────────────────────────────────────────────────────────

class SurveyDescriptionRefiner:
    """Generates and manages human-friendly descriptions for survey offers."""

    def __init__(self):
        from database import db_instance
        self.offers_col = db_instance.get_collection('offers')

    # ── Public API ────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """Return refinement stats for the admin UI."""
        if self.offers_col is None:
            return {}

        base_q = self._survey_offer_query()
        total       = self.offers_col.count_documents(base_q)
        refined     = self.offers_col.count_documents({**base_q, 'description_refined': True})
        unrefined   = total - refined

        # Per-source breakdown
        source_breakdown = []
        for src in sorted(SURVEY_SOURCES):
            q = {'import_source': src}
            q_active = {**q, 'status': {'$in': ['active', 'running']}}
            t = self.offers_col.count_documents(q_active)
            r = self.offers_col.count_documents({**q_active, 'description_refined': True})
            source_breakdown.append({'source': src, 'total': t, 'refined': r, 'unrefined': t - r})

        # Pepperwahl uses offer_source instead of import_source
        pw_q_active = {'offer_source': 'pepperwahl', 'status': {'$in': ['active', 'running']}}
        pw_t = self.offers_col.count_documents(pw_q_active)
        pw_r = self.offers_col.count_documents({**pw_q_active, 'description_refined': True})
        source_breakdown.append({'source': 'pepperwahl', 'total': pw_t, 'refined': pw_r, 'unrefined': pw_t - pw_r})

        return {
            'total':     total,
            'refined':   refined,
            'unrefined': unrefined,
            'pct_refined': round(refined / total * 100, 1) if total else 0,
            'sources': source_breakdown,
        }

    def list_unrefined(self, page: int = 1, per_page: int = 30) -> tuple:
        """Return paginated list of offers pending refinement."""
        if self.offers_col is None:
            return [], 0

        q = {**self._survey_offer_query(), 'description_refined': {'$ne': True}}
        total = self.offers_col.count_documents(q)
        docs = list(
            self.offers_col.find(q, {
                'offer_id': 1, 'name': 1, 'description': 1, 'description_raw': 1,
                'vertical': 1, 'category': 1, 'countries': 1, 'import_source': 1,
                'offer_source': 1, 'source': 1,
                'voqall_loi': 1, 'voqall_ir': 1,
                'opinionspark_loi': 1, 'opinionspark_ir': 1,
                'marketxcel_loi': 1, 'marketxcel_ir': 1,
                'loi_minutes': 1,                        # pepperwahl
                'audience_type': 1, 'payout': 1,
                'updated_at': 1,
            })
            .sort('updated_at', -1)
            .skip((page - 1) * per_page)
            .limit(per_page)
        )
        for d in docs:
            d['_id'] = str(d['_id'])
            # Attach a preview of what the refined description will look like
            d['description_preview'] = self._build_description(d)
        return docs, total

    def list_refined(self, page: int = 1, per_page: int = 30) -> tuple:
        """Return paginated list of already-refined offers."""
        if self.offers_col is None:
            return [], 0

        q = {**self._survey_offer_query(), 'description_refined': True}
        total = self.offers_col.count_documents(q)
        docs = list(
            self.offers_col.find(q, {
                'offer_id': 1, 'name': 1, 'description': 1,
                'description_raw': 1, 'description_override': 1,
                'description_refined_at': 1, 'description_refined_by': 1,
                'vertical': 1, 'import_source': 1, 'offer_source': 1,
                'payout': 1, 'countries': 1,
            })
            .sort('description_refined_at', -1)
            .skip((page - 1) * per_page)
            .limit(per_page)
        )
        for d in docs:
            d['_id'] = str(d['_id'])
        return docs, total

    def refine_one(self, offer_id: str, refined_by: str = 'admin') -> dict:
        """Refine the description for a single offer by offer_id."""
        if self.offers_col is None:
            return {'success': False, 'error': 'DB not available'}

        offer = self.offers_col.find_one({'offer_id': offer_id})
        if not offer:
            return {'success': False, 'error': f'Offer {offer_id} not found'}

        refined_desc = self._build_description(offer)
        snapshot = self._build_snapshot(offer)

        self.offers_col.update_one(
            {'offer_id': offer_id},
            {'$set': {
                'description':             refined_desc,
                'description_override':    refined_desc,
                'description_raw':         offer.get('description', ''),
                'description_refined':     True,
                'description_refined_at':  datetime.utcnow(),
                'description_refined_by':  refined_by,
                'description_snapshot':    snapshot,
                'updated_at':              datetime.utcnow(),
            }}
        )
        return {'success': True, 'offer_id': offer_id, 'description': refined_desc}

    def refine_all(self, batch_size: int = 100, refined_by: str = 'auto') -> dict:
        """Refine all unrefined survey offers in batches. Returns summary."""
        if self.offers_col is None:
            return {'success': False, 'error': 'DB not available', 'refined': 0}

        q = {**self._survey_offer_query(), 'description_refined': {'$ne': True}}
        total_pending = self.offers_col.count_documents(q)

        refined_count = 0
        errors = []

        # Process in batches to avoid memory issues with large collections
        processed = 0
        while processed < total_pending:
            batch = list(
                self.offers_col.find(q).skip(processed).limit(batch_size)
            )
            if not batch:
                break

            for offer in batch:
                try:
                    offer_id = offer.get('offer_id', '')
                    if not offer_id:
                        continue
                    refined_desc = self._build_description(offer)
                    snapshot = self._build_snapshot(offer)
                    self.offers_col.update_one(
                        {'offer_id': offer_id},
                        {'$set': {
                            'description':            refined_desc,
                            'description_override':   refined_desc,
                            'description_raw':        offer.get('description', ''),
                            'description_refined':    True,
                            'description_refined_at': datetime.utcnow(),
                            'description_refined_by': refined_by,
                            'description_snapshot':   snapshot,
                            'updated_at':             datetime.utcnow(),
                        }}
                    )
                    refined_count += 1
                except Exception as e:
                    errors.append(f"{offer.get('offer_id', '?')}: {e}")

            processed += len(batch)

        logger.info(
            f'SurveyDescriptionRefiner.refine_all: refined={refined_count}, '
            f'errors={len(errors)}'
        )
        return {
            'success': True,
            'total_pending': total_pending,
            'refined': refined_count,
            'errors': errors[:10],   # cap error list in response
        }

    def check_delta_and_reset(self, updated_offers: list) -> int:
        """
        Option B — Delta detection.

        Called by sync pipelines after bulk upsert with the list of newly synced
        offer dicts (already mapped to DB format).  For each offer that has
        description_refined=True, compare key metrics against the snapshot taken
        at refinement time.  If any metric changed beyond tolerance, reset to
        description_refined=False so it re-enters the queue.

        Returns the number of offers reset.
        """
        if self.offers_col is None or not updated_offers:
            return 0

        reset_count = 0
        for offer in updated_offers:
            offer_id = offer.get('offer_id') or offer.get('campaign_id')
            if not offer_id:
                continue
            try:
                db_doc = self.offers_col.find_one(
                    {'offer_id': offer_id},
                    {'description_refined': 1, 'description_snapshot': 1}
                )
                if not db_doc or not db_doc.get('description_refined'):
                    continue   # not refined yet — nothing to reset

                snapshot = db_doc.get('description_snapshot') or {}
                if self._has_significant_change(offer, snapshot):
                    self.offers_col.update_one(
                        {'offer_id': offer_id},
                        {'$set': {
                            'description_refined': False,
                            'description_delta_detected_at': datetime.utcnow(),
                        }}
                    )
                    reset_count += 1
                    logger.info(
                        f'[delta] Reset description_refined for {offer_id} — '
                        f'data changed since last refinement'
                    )
            except Exception as e:
                logger.warning(f'[delta] Error checking {offer_id}: {e}')

        if reset_count:
            logger.info(f'[delta] Reset {reset_count} offer(s) to unrefined after sync')
        return reset_count

    # ── Delta detection helpers ───────────────────────────────────────────────

    def _build_snapshot(self, offer: dict) -> dict:
        """Capture the key fields used in description generation, for future comparison."""
        return {
            'loi':          self._extract_loi(offer),
            'ir':           self._extract_ir(offer),
            'vertical':     (offer.get('vertical') or '').upper(),
            'category':     offer.get('category', ''),
            'audience_type':offer.get('audience_type', ''),
            'countries':    sorted(offer.get('countries') or []),
            'source':       self._resolve_source(offer),
        }

    def _has_significant_change(self, new_offer: dict, snapshot: dict) -> bool:
        """Return True if any tracked metric changed beyond its tolerance."""
        # LOI change > LOI_DELTA_MINUTES
        old_loi = snapshot.get('loi') or 0
        new_loi = self._extract_loi(new_offer) or 0
        if abs(new_loi - old_loi) > LOI_DELTA_MINUTES:
            return True

        # IR change > IR_DELTA_PERCENT
        old_ir = snapshot.get('ir') or 0
        new_ir = self._extract_ir(new_offer) or 0
        if abs(new_ir - old_ir) > IR_DELTA_PERCENT:
            return True

        # Vertical / category changed
        old_vertical = (snapshot.get('vertical') or '').upper()
        new_vertical = (new_offer.get('vertical') or '').upper()
        if old_vertical and new_vertical and old_vertical != new_vertical:
            return True

        # Audience type changed
        old_aud = (snapshot.get('audience_type') or '').lower()
        new_aud = (new_offer.get('audience_type') or '').lower()
        if old_aud and new_aud and old_aud != new_aud:
            return True

        # Countries changed
        old_countries = set(snapshot.get('countries') or [])
        new_countries = set(new_offer.get('countries') or [])
        if old_countries and new_countries and old_countries != new_countries:
            return True

        return False

    # ── Description builder ───────────────────────────────────────────────────

    def _build_description(self, offer: dict) -> str:
        """
        Build a clean, user-facing description from the offer's survey metadata.

        Format:
          <Audience> <category> survey. Takes about <LOI> min, <IR>% qualify.
          [Country context if specific country.] [Payout line if > 0.]

        Examples:
          "Consumer Technology survey. Takes about 12 min, 30% qualify."
          "Business Finance & Insurance survey for India. Takes about 20 min, 45% qualify."
          "General Consumer Research survey. Takes about 8 min."
        """
        source   = self._resolve_source(offer)
        loi      = self._extract_loi(offer)
        ir       = self._extract_ir(offer)
        vertical = (offer.get('vertical') or '').upper()
        category = offer.get('category', '')
        audience = (offer.get('audience_type') or '').lower()
        countries = offer.get('countries') or []
        payout   = float(offer.get('payout') or 0)

        # ── Friendly category label ───────────────────────────────────────────
        vertical_label = _VERTICAL_LABELS.get(vertical, '')
        if not vertical_label and category:
            # Try to map raw category string
            cat_upper = category.upper()
            vertical_label = _VERTICAL_LABELS.get(cat_upper, _clean_category(category))
        if not vertical_label:
            vertical_label = 'Consumer Research'

        # ── Audience label ────────────────────────────────────────────────────
        audience_label = _AUDIENCE_LABELS.get(audience, '')
        if not audience_label:
            # Try to infer from category / vertical
            if 'b2b' in category.lower() or vertical in ('TECH', 'FINANCE'):
                audience_label = 'Business'
            else:
                audience_label = 'Consumer'

        # ── Country context ───────────────────────────────────────────────────
        country_ctx = ''
        if countries and countries not in (['WW'], [''], [None]):
            cc = [c for c in countries if c and c.upper() not in ('WW', 'WORLDWIDE', 'ALL')]
            if cc:
                country_ctx = self._country_codes_to_phrase(cc)

        # ── Build sentences ───────────────────────────────────────────────────
        parts = []

        # Sentence 1 — what is it
        geo_suffix = f' for {country_ctx}' if country_ctx else ''
        parts.append(f'{audience_label} {vertical_label} survey{geo_suffix}.')

        # Sentence 2 — time & qualification
        if loi and ir:
            parts.append(f'Takes about {loi:.0f} min, {ir:.0f}% of participants qualify.')
        elif loi:
            parts.append(f'Takes about {loi:.0f} min to complete.')
        elif ir:
            parts.append(f'{ir:.0f}% of participants qualify.')

        # Sentence 3 — payout hint (optional, only if reasonable value)
        if payout and 0 < payout < 50:
            parts.append(f'Earn up to ${payout:.2f} per completion.')

        # Source attribution (subtle)
        source_labels = {
            'voqall':       'Voqall',
            'marketxcel':   'Market Excel',
            'opinionspark': 'Opinion Spark',
            'pepperwahl':   'Pepperwahl',
        }
        src_label = source_labels.get(source, '')
        if src_label:
            parts.append(f'Powered by {src_label}.')

        return ' '.join(parts)

    # ── Extraction helpers ────────────────────────────────────────────────────

    def _extract_loi(self, offer: dict) -> Optional[float]:
        """Extract LOI (minutes) from whichever field is available."""
        for key in ('voqall_loi', 'opinionspark_loi', 'marketxcel_loi', 'loi_minutes', 'loi'):
            val = offer.get(key)
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass
        # Fallback: parse from raw description string "LOI: 12 min"
        desc = offer.get('description_raw') or offer.get('description') or ''
        m = re.search(r'LOI:\s*(\d+(?:\.\d+)?)', desc, re.IGNORECASE)
        if m:
            return float(m.group(1))
        return None

    def _extract_ir(self, offer: dict) -> Optional[float]:
        """Extract incidence rate (%) from whichever field is available."""
        for key in ('voqall_ir', 'opinionspark_ir', 'marketxcel_ir', 'ir'):
            val = offer.get(key)
            if val is not None:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass
        # Fallback: parse from raw description string "IR: 60%"
        desc = offer.get('description_raw') or offer.get('description') or ''
        m = re.search(r'IR:\s*(\d+(?:\.\d+)?)', desc, re.IGNORECASE)
        if m:
            return float(m.group(1))
        return None

    def _resolve_source(self, offer: dict) -> str:
        """Determine the canonical source name for an offer."""
        for key in ('import_source', 'offer_source', 'source'):
            val = (offer.get(key) or '').lower()
            if val in SURVEY_SOURCES:
                return val
        # Fallback: check network field
        network = (offer.get('network') or '').lower()
        for src in SURVEY_SOURCES:
            if src in network:
                return src
        return 'unknown'

    def _survey_offer_query(self) -> dict:
        """MongoDB query that matches all survey offers in the sub-wall."""
        return {
            'subwall_exclusive': True,
            'status': {'$in': ['active', 'running']},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        }

    # ── Country code helpers ──────────────────────────────────────────────────

    _COUNTRY_NAMES = {
        'IN': 'India', 'US': 'United States', 'UK': 'United Kingdom',
        'GB': 'United Kingdom', 'AU': 'Australia', 'CA': 'Canada',
        'DE': 'Germany', 'FR': 'France', 'BR': 'Brazil', 'MX': 'Mexico',
        'JP': 'Japan', 'KR': 'South Korea', 'CN': 'China', 'SG': 'Singapore',
        'MY': 'Malaysia', 'PH': 'Philippines', 'ID': 'Indonesia', 'TH': 'Thailand',
        'NG': 'Nigeria', 'ZA': 'South Africa', 'KE': 'Kenya', 'EG': 'Egypt',
        'AE': 'UAE', 'SA': 'Saudi Arabia', 'PK': 'Pakistan', 'BD': 'Bangladesh',
        'TR': 'Turkey', 'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands',
        'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'PL': 'Poland',
        'AR': 'Argentina', 'CO': 'Colombia', 'CL': 'Chile', 'PE': 'Peru',
        'NZ': 'New Zealand', 'HK': 'Hong Kong', 'TW': 'Taiwan',
    }

    def _country_codes_to_phrase(self, codes: list) -> str:
        if len(codes) == 1:
            return self._COUNTRY_NAMES.get(codes[0].upper(), codes[0].upper())
        if len(codes) == 2:
            a = self._COUNTRY_NAMES.get(codes[0].upper(), codes[0].upper())
            b = self._COUNTRY_NAMES.get(codes[1].upper(), codes[1].upper())
            return f'{a} and {b}'
        if len(codes) <= 4:
            names = [self._COUNTRY_NAMES.get(c.upper(), c.upper()) for c in codes]
            return ', '.join(names[:-1]) + f' and {names[-1]}'
        # Many countries — don't list them all
        return f'{len(codes)} countries'


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clean_category(raw: str) -> str:
    """Title-case a raw category string, strip underscores/slashes."""
    return re.sub(r'[_/]+', ' ', raw).strip().title() if raw else 'Research'


# ── Module-level singleton ─────────────────────────────────────────────────────

_refiner_instance: Optional[SurveyDescriptionRefiner] = None


def get_refiner() -> SurveyDescriptionRefiner:
    global _refiner_instance
    if _refiner_instance is None:
        _refiner_instance = SurveyDescriptionRefiner()
    return _refiner_instance
