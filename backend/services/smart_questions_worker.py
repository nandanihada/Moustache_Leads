"""
Smart Questions Worker
Runs every 30 seconds in a background thread.

Logic per open ticket:
  1. Check if ticket's publisher email has a Smart Questions config (enabled=True)
  2. If SQ has never fired on this ticket: wait `delay_seconds` after ticket was created
  3. Fire the next `ready` question as a system reply on the ticket
  4. Store which question was last fired + when (sq_state on the ticket doc)
  5. If publisher answered the question (a user reply after the SQ), fire the next one
     after the same delay
"""

import threading
import time
import logging
from datetime import datetime, timedelta
from bson import ObjectId

logger = logging.getLogger(__name__)

_worker_thread = None
_stop_event = threading.Event()


def _get_db():
    try:
        from database import db_instance
        return db_instance
    except Exception as e:
        logger.error(f'[SQ Worker] DB import failed: {e}')
        return None


def _col(name):
    db = _get_db()
    if db is None:
        return None
    return db.get_collection(name)


def _now():
    return datetime.utcnow()


def _get_settings():
    """Fetch support settings; fall back to defaults."""
    try:
        doc = _col('support_settings').find_one({})
        if doc:
            return doc
    except Exception:
        pass
    return {
        'smart_questions_enabled': True,
        'sq_delay_sec': 120,
    }


def _fire_question(ticket, question, config):
    """Insert a system reply with the smart question text."""
    try:
        ticket_id = str(ticket['_id'])
        q_text = question.get('question_text', '').strip()
        q_id = question.get('_id', '')

        if not q_text:
            return False

        reply_doc = {
            'text': q_text,
            'from': 'system',
            'is_smart_question': True,
            'sq_question_id': q_id,
            'sq_config_id': str(config.get('_id', '')),
            'answer_type': question.get('answer_type', 'text'),
            'options': question.get('options', []),
            'answered': False,
            'created_at': _now(),
            '_id': ObjectId(),
        }

        tickets_col = _col('support_messages')
        if tickets_col is None:
            return False

        tickets_col.update_one(
            {'_id': ticket['_id']},
            {
                '$push': {'replies': reply_doc},
                '$set': {
                    'updated_at': _now(),
                    'sq_state.last_fired_at': _now(),
                    'sq_state.last_fired_q_id': q_id,
                    'sq_state.fired_count': ticket.get('sq_state', {}).get('fired_count', 0) + 1,
                    'sq_state.waiting_for_answer': True,
                    'read_by_admin': True,
                    'read_by_user': False,
                }
            }
        )

        logger.info(f'[SQ Worker] Fired question "{q_text[:50]}" on ticket {ticket_id}')
        return True
    except Exception as e:
        logger.error(f'[SQ Worker] Fire question error: {e}')
        return False


def _get_next_question(config, sq_state):
    """
    Find the next `ready` question that hasn't been fired yet.
    Uses fired_question_ids list stored in sq_state.
    """
    questions = config.get('questions', [])
    fired_ids = sq_state.get('fired_q_ids', [])
    for q in questions:
        if q.get('status') == 'ready' and q.get('question_text', '').strip():
            if q.get('_id') not in fired_ids:
                return q
    return None


def worker_tick():
    """Single tick of the worker — called every 30 seconds."""
    try:
        settings = _get_settings()
        if not settings.get('smart_questions_enabled', True):
            return

        global_delay = int(settings.get('sq_delay_sec', 120))

        tickets_col = _col('support_messages')
        sq_col = _col('smart_question_configs')
        if tickets_col is None or sq_col is None:
            return

        # Find all open tickets that haven't been replied to by admin
        # (status='open' means no admin reply yet)
        open_tickets = list(tickets_col.find(
            {'status': 'open', 'is_broadcast': {'$ne': True}},
            {
                '_id': 1, 'email': 1, 'user_id': 1, 'created_at': 1,
                'replies': 1, 'sq_state': 1, 'updated_at': 1, 'subject': 1
            }
        ))

        now = _now()

        for ticket in open_tickets:
            try:
                ticket_id = str(ticket['_id'])
                email = ticket.get('email', '').lower().strip()
                sq_state = ticket.get('sq_state') or {}

                # Find SQ config for this publisher's email
                config = sq_col.find_one({'email': email, 'enabled': True})
                if not config:
                    continue

                # Use per-config delay or fall back to global
                delay_sec = int(config.get('delay_seconds', global_delay))
                created_at = ticket.get('created_at')
                if not created_at:
                    continue

                # --- State machine ---
                last_fired_at = sq_state.get('last_fired_at')
                waiting_for_answer = sq_state.get('waiting_for_answer', False)
                fired_q_ids = sq_state.get('fired_q_ids', [])

                # Check if publisher has answered since the last SQ was fired
                if waiting_for_answer and last_fired_at:
                    # Look for a user reply AFTER last_fired_at
                    user_replied_after = any(
                        r.get('from') == 'user'
                        and r.get('created_at')
                        and r['created_at'] > last_fired_at
                        for r in ticket.get('replies', [])
                    )
                    if user_replied_after:
                        # Mark question as answered, prepare to fire next one
                        last_fired_q_id = sq_state.get('last_fired_q_id')
                        if last_fired_q_id and last_fired_q_id not in fired_q_ids:
                            fired_q_ids = fired_q_ids + [last_fired_q_id]
                        tickets_col.update_one(
                            {'_id': ticket['_id']},
                            {'$set': {
                                'sq_state.waiting_for_answer': False,
                                'sq_state.fired_q_ids': fired_q_ids,
                                'sq_state.last_answered_at': now,
                            }}
                        )
                        # Refresh state
                        sq_state['waiting_for_answer'] = False
                        sq_state['fired_q_ids'] = fired_q_ids
                        sq_state['last_answered_at'] = now
                        last_fired_at = now  # reset timer for next question
                    else:
                        # Still waiting for answer — don't fire next
                        continue

                # Determine reference time: when to measure delay from
                # - First SQ: delay from ticket creation
                # - Subsequent SQs: delay from when publisher answered last question
                if not last_fired_at:
                    # First SQ — delay from ticket creation
                    ref_time = created_at
                else:
                    # Next SQ — delay from when publisher last answered
                    ref_time = sq_state.get('last_answered_at') or now
                    # If we just set waiting_for_answer=False, fire immediately
                    ref_time = ref_time - timedelta(seconds=delay_sec)

                time_elapsed = (now - ref_time).total_seconds()
                if time_elapsed < delay_sec:
                    continue

                # Get the next ready question to fire
                next_q = _get_next_question(config, sq_state)
                if next_q is None:
                    # All questions fired — nothing more to do
                    continue

                # Fire it
                fired = _fire_question(ticket, next_q, config)
                if fired:
                    # Update fired_q_ids
                    new_fired_ids = fired_q_ids + [next_q.get('_id')]
                    tickets_col.update_one(
                        {'_id': ticket['_id']},
                        {'$set': {'sq_state.fired_q_ids': new_fired_ids}}
                    )

            except Exception as e:
                logger.error(f'[SQ Worker] Error processing ticket {ticket.get("_id")}: {e}')
                continue

    except Exception as e:
        logger.error(f'[SQ Worker] Tick error: {e}')


def _run_loop():
    """Main worker loop — runs every 30 seconds."""
    logger.info('[SQ Worker] Started')
    while not _stop_event.is_set():
        try:
            worker_tick()
        except Exception as e:
            logger.error(f'[SQ Worker] Loop error: {e}')
        _stop_event.wait(30)
    logger.info('[SQ Worker] Stopped')


def start_worker():
    """Start the background worker thread (safe to call multiple times)."""
    global _worker_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        logger.info('[SQ Worker] Already running')
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_run_loop, daemon=True, name='SmartQuestionsWorker')
    _worker_thread.start()
    logger.info('[SQ Worker] Thread launched')


def stop_worker():
    """Stop the background worker thread."""
    _stop_event.set()
    if _worker_thread:
        _worker_thread.join(timeout=5)
    logger.info('[SQ Worker] Stopped')
