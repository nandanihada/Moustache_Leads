"""
Search Session Model - Enhanced search event logging
Tracks the full lifecycle of a publisher's search session:
  search_query, autocomplete picks, result views, card expansions,
  filter usage, placement intents, missing inventory signals, final picks.
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class SearchSession:
    """Model for managing enhanced search sessions"""

    COLLECTION = 'search_sessions'

    @classmethod
    def get_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.COLLECTION]

    @classmethod
    def create(cls, user_id: str, username: str, query: str,
               autocorrected_to: str = None, result_count: int = 0,
               inventory_status: str = 'available') -> str | None:
        """Create a new search session. Returns session_id string."""
        col = cls.get_collection()
        if col is None:
            return None
        try:
            doc = {
                'user_id': user_id,
                'username': username,
                'query': query.strip(),
                'autocorrected_to': autocorrected_to,
                'result_count': result_count,
                'inventory_status': inventory_status,  # available | in_inventory_not_active | not_in_inventory
                'session_outcome': 'active',  # active | picked | skipped_all | abandoned | placement_intent | not_found
                'final_pick_offer_id': None,
                'final_pick_position': None,
                # Event arrays
                'events': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }
            result = col.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create search session: {e}")
            return None

    @classmethod
    def add_event(cls, session_id: str, event_type: str, data: dict = None) -> bool:
        """
        Append an event to a search session.
        event_type: suggestion_picked | result_shown | card_expanded |
                    next_requested | filter_applied | placement_intent |
                    not_in_inventory | final_pick
        """
        col = cls.get_collection()
        if col is None or not ObjectId.is_valid(session_id):
            return False
        try:
            event = {
                'type': event_type,
                'data': data or {},
                'timestamp': datetime.utcnow(),
            }
            update = {
                '$push': {'events': event},
                '$set': {'updated_at': datetime.utcnow()},
            }
            # Auto-set session_outcome for terminal events
            if event_type == 'final_pick':
                update['$set']['session_outcome'] = 'picked'
                update['$set']['final_pick_offer_id'] = (data or {}).get('offer_id')
                update['$set']['final_pick_position'] = (data or {}).get('position')
            elif event_type == 'placement_intent':
                update['$set']['session_outcome'] = 'placement_intent'
            elif event_type == 'not_in_inventory':
                update['$set']['session_outcome'] = 'not_found'

            col.update_one({'_id': ObjectId(session_id)}, update)
            return True
        except Exception as e:
            logger.error(f"Failed to add event to session {session_id}: {e}")
            return False

    @classmethod
    def mark_abandoned(cls, session_id: str) -> bool:
        """Mark a session as abandoned (user left without picking)."""
        col = cls.get_collection()
        if col is None or not ObjectId.is_valid(session_id):
            return False
        try:
            col.update_one(
                {'_id': ObjectId(session_id), 'session_outcome': 'active'},
                {'$set': {'session_outcome': 'abandoned', 'updated_at': datetime.utcnow()}}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to mark session abandoned: {e}")
            return False
