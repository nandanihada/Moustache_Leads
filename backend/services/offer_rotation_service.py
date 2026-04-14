"""
Offer Rotation Service
Automatically rotates inactive offers in batches.
- Activates BATCH_SIZE offers at a time for WINDOW_HOURS hours
- Deduplicates by name+country (keeps highest payout)
- Promotes clicked offers to "running" status (never deactivated)
- Deactivates previous batch only if not "running"
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from database import db_instance

logger = logging.getLogger(__name__)

_rotation_service_instance = None
_lock = threading.Lock()


class OfferRotationService:
    DEFAULT_BATCH_SIZE = 1000
    DEFAULT_WINDOW_HOURS = 7
    DEFAULT_WINDOW_MINUTES = 420  # 7 hours in minutes

    def __init__(self):
        self.offers_col = db_instance.get_collection('offers')
        self.rotation_col = db_instance.get_collection('offer_rotation_state')
        self._thread = None
        self._stop_event = threading.Event()

    # ------------------------------------------------------------------ helpers
    def _get_state(self):
        """Get or create the singleton rotation state document."""
        state = self.rotation_col.find_one({'_id': 'rotation_config'})
        if not state:
            state = {
                '_id': 'rotation_config',
                'enabled': False,
                'batch_size': self.DEFAULT_BATCH_SIZE,
                'window_hours': self.DEFAULT_WINDOW_HOURS,
                'window_minutes': self.DEFAULT_WINDOW_MINUTES,
                'current_batch_ids': [],
                'previous_batch_ids': [],
                'running_offer_ids': [],
                'batch_index': 0,
                'batch_activated_at': None,
                'total_rotations': 0,
                'last_rotation_at': None,
                'selected_networks': [],  # empty = all networks (system rules)
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }
            self.rotation_col.insert_one(state)
        # Migrate old docs that only have window_hours
        if 'window_minutes' not in state:
            wm = state.get('window_hours', self.DEFAULT_WINDOW_HOURS) * 60
            self.rotation_col.update_one({'_id': 'rotation_config'}, {'$set': {'window_minutes': wm}})
            state['window_minutes'] = wm
        # Migrate old docs without selected_networks
        if 'selected_networks' not in state:
            self.rotation_col.update_one({'_id': 'rotation_config'}, {'$set': {'selected_networks': []}})
            state['selected_networks'] = []
        return state

    def _save_state(self, update_fields: dict):
        update_fields['updated_at'] = datetime.utcnow()
        self.rotation_col.update_one(
            {'_id': 'rotation_config'},
            {'$set': update_fields}
        )

    # --------------------------------------------------------- deduplication
    def _calculate_best_score(self, doc):
        """
        Calculate a composite 'best offer' score for deduplication ranking.
        Factors (weighted):
          - Highest payout (40%)
          - Most clicked (25%)
          - Most approved/conversions (20%)
          - Most requested (15%)
        All values are normalized per-group, so we use raw values and let
        the comparison pick the highest composite.
        """
        payout = float(doc.get('payout', 0) or 0)
        clicks = int(doc.get('clicks', 0) or doc.get('hits', 0) or 0)
        conversions = int(doc.get('conversions', 0) or 0)
        requests_count = int(doc.get('request_count', 0) or doc.get('requests', 0) or 0)
        return (payout * 0.40) + (clicks * 0.25) + (conversions * 0.20) + (requests_count * 0.15)

    def _deduplicate_candidates(self, candidates):
        """
        Given a list of offer docs, group by (name_lower, first_country).
        Keep only the BEST offer per group using composite scoring:
        highest payout, most clicked, most approved, most requested.
        Returns list of offer_id strings.
        """
        groups = {}  # (name, country) -> (best_score, best_doc)
        for doc in candidates:
            name_key = (doc.get('name') or '').strip().lower()
            countries = doc.get('allowed_countries') or doc.get('countries') or []
            country_key = countries[0].upper() if countries else '__global__'
            group_key = (name_key, country_key)

            score = self._calculate_best_score(doc)
            existing = groups.get(group_key)
            if not existing or score > existing[0]:
                groups[group_key] = (score, doc)

        return [item[1]['offer_id'] for item in groups.values()]

    # --------------------------------------------------- click promotion
    def promote_to_running(self, offer_id: str):
        """Called when an offer receives a click during its active rotation window."""
        state = self._get_state()
        running = set(state.get('running_offer_ids', []))
        if offer_id not in running:
            running.add(offer_id)
            self._save_state({'running_offer_ids': list(running)})
            # Mark the offer with a rotation_running flag
            self.offers_col.update_one(
                {'offer_id': offer_id},
                {'$set': {
                    'rotation_running': True,
                    'rotation_promoted_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                }}
            )
            logger.info(f"🏃 Offer {offer_id} promoted to running (clicked during rotation window)")

    # --------------------------------------------------- core rotation
    def _rotate_batch(self):
        """Execute one rotation cycle."""
        state = self._get_state()
        if not state.get('enabled'):
            return

        batch_size = state.get('batch_size', self.DEFAULT_BATCH_SIZE)
        window_minutes = state.get('window_minutes', self.DEFAULT_WINDOW_MINUTES)
        batch_activated_at = state.get('batch_activated_at')
        running_ids = set(state.get('running_offer_ids', []))
        selected_networks = state.get('selected_networks', [])

        # Check if current window is still active
        if batch_activated_at:
            elapsed = (datetime.utcnow() - batch_activated_at).total_seconds()
            if elapsed < window_minutes * 60:
                return  # Window still active, nothing to do

        # --- Time to rotate ---
        previous_batch = state.get('current_batch_ids', [])
        batch_index = state.get('batch_index', 0)

        # 1. Deactivate previous batch (skip running offers)
        #    Also deactivate any orphaned rotation-activated offers not in the new batch
        if previous_batch:
            ids_to_deactivate = [oid for oid in previous_batch if oid not in running_ids]
            if ids_to_deactivate:
                result = self.offers_col.update_many(
                    {
                        'offer_id': {'$in': ids_to_deactivate},
                        'rotation_running': {'$ne': True},
                    },
                    {'$set': {
                        'status': 'inactive',
                        'rotation_deactivated_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                    }}
                )
                logger.info(f"🔄 Deactivated {result.modified_count} offers from previous batch (skipped {len(previous_batch) - len(ids_to_deactivate)} running)")

        # 1b. Cleanup: deactivate any orphaned rotation-activated offers
        #     These are offers that were activated by rotation in past cycles
        #     but are no longer tracked in current/previous batch state
        orphan_query = {
            'status': 'active',
            'rotation_activated_at': {'$exists': True},
            'rotation_running': {'$ne': True},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        }
        # Exclude offers in the current running list
        if running_ids:
            orphan_query['offer_id'] = {'$nin': list(running_ids)}
        orphan_result = self.offers_col.update_many(
            orphan_query,
            {'$set': {
                'status': 'inactive',
                'rotation_deactivated_at': datetime.utcnow(),
                'rotation_orphan_cleanup': True,
                'updated_at': datetime.utcnow(),
            }}
        )
        if orphan_result.modified_count > 0:
            logger.info(f"🧹 Cleaned up {orphan_result.modified_count} orphaned rotation-activated offers")

        # 2. Get all inactive, non-deleted, non-running candidates
        query = {
            'status': 'inactive',
            'is_active': True,
            'rotation_running': {'$ne': True},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        }
        # If admin selected specific networks, only rotate those networks' offers
        if selected_networks:
            # Case-insensitive network matching
            network_regex = [{'network': {'$regex': f'^{n}$', '$options': 'i'}} for n in selected_networks]
            query['$and'] = [{'$or': network_regex}]
            # Move the deleted check into $and to avoid $or conflict
            del query['$or']
            query['$and'].append({'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]})

        total_inactive = self.offers_col.count_documents(query)

        if total_inactive == 0:
            logger.info("🔄 No inactive offers available for rotation")
            self._save_state({
                'current_batch_ids': [],
                'previous_batch_ids': previous_batch,
                'batch_activated_at': None,
            })
            return

        # 3. Fetch candidates with skip for pagination through the pool
        skip_count = (batch_index * batch_size) % max(total_inactive, 1)
        candidates = list(
            self.offers_col.find(query)
            .sort('payout', -1)
            .skip(skip_count)
            .limit(batch_size * 3)  # Fetch extra for dedup headroom
        )

        # If we got fewer than batch_size, wrap around
        if len(candidates) < batch_size * 3 and skip_count > 0:
            remaining = batch_size * 3 - len(candidates)
            wrap_candidates = list(
                self.offers_col.find(query)
                .sort('payout', -1)
                .limit(remaining)
            )
            seen = {c['offer_id'] for c in candidates}
            for c in wrap_candidates:
                if c['offer_id'] not in seen:
                    candidates.append(c)

        # 4. Deduplicate
        deduped_ids = self._deduplicate_candidates(candidates)

        # 5. Take batch_size from deduped
        new_batch = deduped_ids[:batch_size]

        if not new_batch:
            logger.info("🔄 No offers after deduplication")
            self._save_state({
                'current_batch_ids': [],
                'previous_batch_ids': previous_batch,
                'batch_activated_at': None,
                'batch_index': 0,
            })
            return

        # 6. Activate the new batch
        result = self.offers_col.update_many(
            {'offer_id': {'$in': new_batch}},
            {'$set': {
                'status': 'active',
                'rotation_activated_at': datetime.utcnow(),
                'rotation_batch_index': batch_index + 1,
                'updated_at': datetime.utcnow(),
            }}
        )

        now = datetime.utcnow()
        self._save_state({
            'current_batch_ids': new_batch,
            'previous_batch_ids': previous_batch,
            'batch_index': batch_index + 1,
            'batch_activated_at': now,
            'last_rotation_at': now,
            'total_rotations': state.get('total_rotations', 0) + 1,
        })

        logger.info(
            f"🔄 Rotation #{batch_index + 1}: Activated {result.modified_count} offers "
            f"(batch of {len(new_batch)}, {total_inactive} inactive remaining)"
        )

        # Log rotation activity
        try:
            from services.admin_activity_log_service import log_admin_activity
            # Fetch activated offer details for the log
            activated_docs = list(self.offers_col.find(
                {'offer_id': {'$in': new_batch}},
                {'offer_id': 1, 'name': 1, 'network': 1, 'payout': 1, 'category': 1, 'status': 1, 'clicks': 1, 'conversions': 1}
            ))
            log_admin_activity(
                action='rotation_batch_activated',
                category='rotation',
                details={
                    'batch_index': batch_index + 1,
                    'activated_count': result.modified_count,
                    'deactivated_count': len(previous_batch) - len([oid for oid in previous_batch if oid in running_ids]) if previous_batch else 0,
                    'total_inactive_remaining': total_inactive - len(new_batch),
                    'window_minutes': window_minutes,
                    'batch_size': batch_size,
                },
                affected_items=[{
                    'offer_id': d.get('offer_id', ''),
                    'name': d.get('name', ''),
                    'network': d.get('network', ''),
                    'payout': d.get('payout', 0),
                    'clicks': d.get('clicks', 0),
                    'conversions': d.get('conversions', 0),
                } for d in activated_docs[:50]],  # Cap at 50 to avoid huge docs
                affected_count=result.modified_count,
            )
        except Exception as log_err:
            logger.error(f"Failed to log rotation activity: {log_err}")

    # --------------------------------------------------- service lifecycle
    def start(self):
        """Start the background rotation thread."""
        if self._thread and self._thread.is_alive():
            logger.warning("Rotation service already running")
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("🔄 Offer rotation service thread started")

    def stop(self):
        self._stop_event.set()
        logger.info("🔄 Offer rotation service stopped")

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                self._rotate_batch()
            except Exception as e:
                logger.error(f"Rotation loop error: {e}", exc_info=True)
            # Check every 60 seconds
            self._stop_event.wait(60)

    # --------------------------------------------------- admin API helpers
    def get_status(self):
        state = self._get_state()
        window_minutes = state.get('window_minutes', self.DEFAULT_WINDOW_MINUTES)
        batch_activated_at = state.get('batch_activated_at')

        time_remaining = None
        next_rotation_at = None
        if batch_activated_at and state.get('enabled'):
            window_end = batch_activated_at + timedelta(minutes=window_minutes)
            remaining_secs = (window_end - datetime.utcnow()).total_seconds()
            time_remaining = max(0, remaining_secs)
            next_rotation_at = window_end.isoformat() + 'Z' if remaining_secs > 0 else None

        # Count inactive offers available
        inactive_count = self.offers_col.count_documents({
            'status': 'inactive',
            'is_active': True,
            'rotation_running': {'$ne': True},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        })

        selected_networks = state.get('selected_networks', [])

        # If networks are selected, also count filtered inactive pool
        filtered_inactive_count = inactive_count
        if selected_networks:
            network_regex = [{'network': {'$regex': f'^{n}$', '$options': 'i'}} for n in selected_networks]
            filtered_inactive_count = self.offers_col.count_documents({
                'status': 'inactive',
                'is_active': True,
                'rotation_running': {'$ne': True},
                '$and': [
                    {'$or': network_regex},
                    {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
                ],
            })

        return {
            'enabled': state.get('enabled', False),
            'batch_size': state.get('batch_size', self.DEFAULT_BATCH_SIZE),
            'window_minutes': window_minutes,
            'current_batch_count': len(state.get('current_batch_ids', [])),
            'current_batch_ids': state.get('current_batch_ids', []),
            'running_count': len(state.get('running_offer_ids', [])),
            'running_offer_ids': state.get('running_offer_ids', []),
            'batch_index': state.get('batch_index', 0),
            'batch_activated_at': state.get('batch_activated_at'),
            'total_rotations': state.get('total_rotations', 0),
            'last_rotation_at': state.get('last_rotation_at'),
            'time_remaining_seconds': time_remaining,
            'next_rotation_at': next_rotation_at,
            'inactive_pool_count': inactive_count,
            'filtered_inactive_count': filtered_inactive_count,
            'selected_networks': selected_networks,
        }

    def update_config(self, batch_size=None, window_minutes=None, selected_networks=None):
        updates = {}
        if batch_size is not None:
            updates['batch_size'] = int(batch_size)
        if window_minutes is not None:
            updates['window_minutes'] = max(1, int(window_minutes))
        if selected_networks is not None:
            # Ensure it's a list of strings; empty list = all networks
            updates['selected_networks'] = [str(n).strip() for n in selected_networks if str(n).strip()]
        if updates:
            self._save_state(updates)
        return self.get_status()

    def enable(self):
        self._save_state({'enabled': True})
        self.start()
        # Trigger immediate rotation if no active batch
        state = self._get_state()
        if not state.get('batch_activated_at'):
            self._rotate_batch()
        return self.get_status()

    def disable(self):
        self._save_state({'enabled': False})
        return self.get_status()

    def force_rotate(self):
        """Force an immediate rotation regardless of window timer."""
        state = self._get_state()
        if not state.get('enabled'):
            return {'error': 'Rotation is not enabled'}
        # Reset the timer to force rotation
        self._save_state({'batch_activated_at': None})
        self._rotate_batch()
        return self.get_status()

    def reset(self):
        """Reset all rotation state. Deactivates current batch and all orphaned rotation offers (except running)."""
        state = self._get_state()
        running_ids = set(state.get('running_offer_ids', []))
        current = state.get('current_batch_ids', [])

        # Deactivate current batch (skip running)
        ids_to_deactivate = [oid for oid in current if oid not in running_ids]
        if ids_to_deactivate:
            self.offers_col.update_many(
                {'offer_id': {'$in': ids_to_deactivate}, 'rotation_running': {'$ne': True}},
                {'$set': {'status': 'inactive', 'updated_at': datetime.utcnow()}}
            )

        # Also deactivate ALL orphaned rotation-activated offers
        orphan_query = {
            'status': 'active',
            'rotation_activated_at': {'$exists': True},
            'rotation_running': {'$ne': True},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        }
        if running_ids:
            orphan_query['offer_id'] = {'$nin': list(running_ids)}
        orphan_result = self.offers_col.update_many(
            orphan_query,
            {'$set': {
                'status': 'inactive',
                'rotation_deactivated_at': datetime.utcnow(),
                'rotation_orphan_cleanup': True,
                'updated_at': datetime.utcnow(),
            }}
        )
        if orphan_result.modified_count > 0:
            logger.info(f"🧹 Reset cleanup: deactivated {orphan_result.modified_count} orphaned rotation offers")

        self._save_state({
            'enabled': False,
            'current_batch_ids': [],
            'previous_batch_ids': [],
            'batch_index': 0,
            'batch_activated_at': None,
            'total_rotations': 0,
            'last_rotation_at': None,
        })
        return self.get_status()


def get_rotation_service():
    global _rotation_service_instance
    with _lock:
        if _rotation_service_instance is None:
            _rotation_service_instance = OfferRotationService()
        return _rotation_service_instance
