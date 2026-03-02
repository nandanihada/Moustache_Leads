"""
Offer Health Check Service

Stateless service that evaluates offers against six health criteria.
Health is computed on-the-fly (not persisted) to avoid stale data.

Criteria:
1. tracking_url    - offer must have non-empty target_url
2. upward_partner  - offer's network name must exist as a partner (case-insensitive)
3. image           - offer must have non-empty image_url
4. country         - offer must have at least one country in allowed_countries or countries
5. payout          - offer must have payout field that is a number >= 0
6. payout_model    - offer must have payout_model or offer_type (CPA/CPS/CPI/CPL/CPC/CPM/RevShare)
"""

import logging
from database import db_instance

logger = logging.getLogger(__name__)

FAILURE_DESCRIPTIONS = {
    'tracking_url': 'Missing tracking URL (target_url is empty or not set)',
    'upward_partner': 'Network not found in upward partners',
    'image': 'Missing offer image (no image_url and no category for default image)',
    'country': 'No target countries set (both allowed_countries and countries are empty)',
    'payout': 'Invalid or missing payout (must be a number >= 0)',
    'payout_model': 'Invalid or missing payout model (must be CPA, CPS, CPI, CPL, CPC, CPM, or RevShare)',
}


class HealthCheckService:
    """Evaluates offers against six health criteria."""

    def __init__(self):
        try:
            self.partners_collection = db_instance.get_collection('partners')
        except Exception:
            logger.warning("Could not access partners collection during init")
            self.partners_collection = None

    def evaluate_offer(self, offer: dict, has_upward_partner: bool = False) -> dict:
        failures = []

        checks = [
            ('tracking_url', self._check_tracking_url(offer)),
            ('upward_partner', has_upward_partner),
            ('image', self._check_image(offer)),
            ('country', self._check_country(offer)),
            ('payout', self._check_payout(offer)),
            ('payout_model', self._check_payout_model(offer)),
        ]

        for criterion, passed in checks:
            if not passed:
                failures.append({
                    'criterion': criterion,
                    'description': FAILURE_DESCRIPTIONS[criterion],
                })

        status = 'healthy' if len(failures) == 0 else 'unhealthy'
        return {'status': status, 'failures': failures}

    def evaluate_offers_batch(self, offers: list) -> dict:
        """
        Evaluate multiple offers. Fetches all partner names once,
        then checks if each offer's network exists as a partner (case-insensitive).
        """
        # Build a set of all partner names (lowercase) from the DB
        partner_names_lower = set()
        if self.partners_collection is not None:
            try:
                for pdoc in self.partners_collection.find({}, {'partner_name': 1}):
                    pname = pdoc.get('partner_name', '')
                    if pname and isinstance(pname, str):
                        partner_names_lower.add(pname.strip().lower())
            except Exception as e:
                logger.warning(f"Failed to fetch partners: {e}")

        results = {}
        for offer in offers:
            offer_id = offer.get('offer_id', '')
            network = (offer.get('network') or '').strip().lower()
            has_upward_partner = network != '' and network in partner_names_lower
            results[offer_id] = self.evaluate_offer(offer, has_upward_partner)

        return results

    # ------------------------------------------------------------------
    # Individual check methods
    # ------------------------------------------------------------------

    def _check_tracking_url(self, offer: dict) -> bool:
        target_url = offer.get('target_url')
        return bool(target_url and isinstance(target_url, str) and target_url.strip())

    def _check_image(self, offer: dict) -> bool:
        # Has an explicit image_url set
        image_url = offer.get('image_url')
        if image_url and isinstance(image_url, str) and image_url.strip():
            return True
        # Has a category/vertical — frontend auto-assigns a default image
        vertical = offer.get('vertical') or offer.get('category')
        if vertical and isinstance(vertical, str) and vertical.strip():
            return True
        return False

    def _check_country(self, offer: dict) -> bool:
        allowed = offer.get('allowed_countries')
        countries = offer.get('countries')
        if isinstance(allowed, list) and len(allowed) > 0:
            return True
        if isinstance(countries, list) and len(countries) > 0:
            return True
        return False

    def _check_payout(self, offer: dict) -> bool:
        payout = offer.get('payout')
        if payout is None:
            return False
        if isinstance(payout, (int, float)):
            return payout >= 0
        if isinstance(payout, str):
            try:
                return float(payout) >= 0
            except (ValueError, TypeError):
                return False
        return False

    def _check_payout_model(self, offer: dict) -> bool:
        valid_models = ('CPA', 'CPS', 'CPI', 'CPL', 'CPC', 'CPM', 'REVSHARE')
        payout_model = offer.get('payout_model')
        if payout_model and isinstance(payout_model, str) and payout_model.strip():
            return payout_model.strip().upper() in valid_models
        offer_type = offer.get('offer_type')
        if offer_type and isinstance(offer_type, str) and offer_type.strip():
            return offer_type.strip().upper() in valid_models
        return False
