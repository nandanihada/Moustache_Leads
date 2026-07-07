"""
Bulk Refinement Background Service
Processes offer refinement requests one-by-one with delays between each.
Stores results and sends notifications when complete.
"""
import logging
import threading
import time
from datetime import datetime, timezone
from typing import List, Dict, Optional

from database import db_instance

logger = logging.getLogger(__name__)

# In-memory state for active bulk refinement jobs
_active_jobs: Dict[str, dict] = {}
_jobs_lock = threading.Lock()


class BulkRefinementService:
    """Manages background bulk refinement of offers."""

    DELAY_BETWEEN_OFFERS = 120  # 2 minutes between each offer refinement

    def start_bulk_job(self, job_id: str, offer_ids: List[str], field: str, admin_user_id: str) -> dict:
        """
        Start a background bulk refinement job.
        
        Args:
            job_id: Unique job identifier
            offer_ids: List of offer IDs to refine
            field: Which field to refine (device, description, title, category, event, country, cap)
            admin_user_id: The admin who initiated the job
            
        Returns:
            Job status dict
        """
        with _jobs_lock:
            if job_id in _active_jobs and _active_jobs[job_id].get('status') == 'running':
                return {'error': 'Job already running', 'job_id': job_id}

        job = {
            'job_id': job_id,
            'offer_ids': offer_ids,
            'field': field,
            'admin_user_id': admin_user_id,
            'status': 'running',
            'total': len(offer_ids),
            'completed': 0,
            'failed': 0,
            'results': [],
            'started_at': datetime.now(timezone.utc).isoformat(),
            'completed_at': None,
        }

        with _jobs_lock:
            _active_jobs[job_id] = job

        # Store job in MongoDB for persistence across restarts
        jobs_col = db_instance.get_collection('bulk_refinement_jobs')
        if jobs_col is not None:
            jobs_col.update_one(
                {'job_id': job_id},
                {'$set': job},
                upsert=True
            )

        # Start background thread
        thread = threading.Thread(
            target=self._process_job,
            args=(job_id,),
            daemon=True,
            name=f"bulk-refine-{job_id}"
        )
        thread.start()

        return {'success': True, 'job_id': job_id, 'total': len(offer_ids)}

    def _process_job(self, job_id: str):
        """Background thread that processes offers one by one."""
        try:
            with _jobs_lock:
                job = _active_jobs.get(job_id)
                if not job:
                    return

            offer_ids = job['offer_ids']
            field = job['field']
            total = len(offer_ids)

            # Parse multiple fields (comma-separated)
            fields_list = [f.strip() for f in field.split(',') if f.strip()] if ',' in field else [field]

            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                self._fail_job(job_id, 'Database connection failed')
                return

            for idx, offer_id in enumerate(offer_ids):
                # Check if job was cancelled
                with _jobs_lock:
                    current_job = _active_jobs.get(job_id)
                    if not current_job or current_job.get('status') == 'cancelled':
                        logger.info(f"Bulk refine job {job_id} cancelled at {idx}/{total}")
                        return

                logger.info(f"[BulkRefine {job_id}] Processing {idx+1}/{total}: {offer_id} (fields: {fields_list})")

                try:
                    if len(fields_list) > 1:
                        # OPTIMIZED: Single combined Groq call for multiple fields
                        result = self._refine_offer_combined(offers_col, offer_id, fields_list)
                    else:
                        # Single field - use existing single-field logic
                        val = self._refine_single_offer(offers_col, offer_id, fields_list[0])
                        result = {fields_list[0]: val}
                    
                    with _jobs_lock:
                        _active_jobs[job_id]['completed'] += 1
                        _active_jobs[job_id]['results'].append({
                            'offer_id': offer_id,
                            'success': True,
                            'value': result
                        })
                except Exception as e:
                    logger.error(f"[BulkRefine {job_id}] Failed {offer_id}: {e}")
                    with _jobs_lock:
                        _active_jobs[job_id]['failed'] += 1
                        _active_jobs[job_id]['results'].append({
                            'offer_id': offer_id,
                            'success': False,
                            'error': str(e)[:200]
                        })

                # Update progress in MongoDB
                self._update_job_progress(job_id)

                # Wait between offers (except for the last one)
                if idx < total - 1:
                    time.sleep(self.DELAY_BETWEEN_OFFERS)

            # Job complete
            self._complete_job(job_id)

        except Exception as e:
            logger.error(f"[BulkRefine {job_id}] Fatal error: {e}", exc_info=True)
            self._fail_job(job_id, str(e))

    def _refine_offer_combined(self, offers_col, offer_id: str, fields: List[str]) -> dict:
        """
        Refine multiple fields for a single offer in ONE Groq API call.
        Builds a combined prompt asking for all requested fields at once.
        """
        from config import Config
        from groq import Groq, AuthenticationError as GroqAuthError, RateLimitError as GroqRateLimitError
        import json as json_module

        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            raise ValueError(f'Offer {offer_id} not found')

        name = offer.get('name', '')
        description = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)
        existing_countries = offer.get('countries', []) or offer.get('allowed_countries', []) or []

        if not description and not name:
            raise ValueError(f'Offer {offer_id} has no content to refine')

        # Build combined prompt requesting all fields at once
        field_instructions = []
        json_schema_parts = []

        if 'device' in fields:
            field_instructions.append('- "device": Detect device/platform from name/description. One of: "android", "ios", "mobile", "desktop", "all".')
            json_schema_parts.append('"device": "android|ios|mobile|desktop|all"')
        if 'title' in fields:
            field_instructions.append('- "refined_name": Create a SHORT clean display name. Remove country codes, network junk, tracking IDs. Max 80 chars.')
            json_schema_parts.append('"refined_name": "Clean short name"')
        if 'description' in fields:
            field_instructions.append('- "summary": Write 1-2 sentence user-friendly description. NO dollar amounts.')
            json_schema_parts.append('"summary": "User-friendly description"')
        if 'event' in fields:
            field_instructions.append('- "steps": List conversion EVENTS (milestones). NO dollar amounts in names.')
            json_schema_parts.append('"steps": ["Event 1", "Event 2"]')
        if 'country' in fields:
            field_instructions.append('- "countries": Extract ISO 2-letter country codes. "WW"/"GLOBAL" → ["WW"].')
            json_schema_parts.append('"countries": ["US", "UK"]')
        if 'category' in fields:
            field_instructions.append('- "category": Best category from: FINANCE, GAMING, DATING, ECOMMERCE, UTILITIES, CRYPTO, HEALTH, ENTERTAINMENT, EDUCATION, SURVEYS, SPORTS, TRAVEL, FOOD, SOCIAL, OTHER.')
            json_schema_parts.append('"category": "PRIMARY_CATEGORY"')
        if 'cap' in fields:
            field_instructions.append('- "daily_cap": Suggested daily cap (number). "monthly_cap": Suggested monthly cap (number).')
            json_schema_parts.append('"daily_cap": 100, "monthly_cap": 2000')

        combined_prompt = f"""You are an offer analyzer for an affiliate marketing platform.
Given the offer details below, extract/generate the following fields.

RULES:
- Write for END USERS, not advertisers
- NEVER include dollar amounts or payout values in text fields
- Keep text short and professional
- For device: check name/description for "Android", "iOS", "iPhone", "Desktop" etc.
- For countries: look for geo codes in name/description. US state codes (CT, MI, NY) are NOT countries.

FIELDS TO EXTRACT:
{chr(10).join(field_instructions)}

OFFER NAME: {name}
OFFER PAYOUT: ${payout}
EXISTING COUNTRIES: {', '.join(existing_countries) if existing_countries else 'None'}
RAW DESCRIPTION:
{description}

Return ONLY valid JSON with these fields:
{{{', '.join(json_schema_parts)}}}"""

        keys = Config.get_groq_api_keys()
        if not keys:
            raise ValueError('GROQ_API_KEY not configured')

        last_error = None
        result = None
        for api_key in keys:
            try:
                client = Groq(api_key=api_key)
                response = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": combined_prompt}],
                    temperature=0.3,
                    max_tokens=600,
                    response_format={"type": "json_object"}
                )
                result = json_module.loads(response.choices[0].message.content.strip())
                break
            except (GroqAuthError, GroqRateLimitError) as key_err:
                logger.warning(f"Groq key rotation in combined refine ({type(key_err).__name__})")
                last_error = key_err
                continue
            except Exception as key_err:
                logger.error(f"Groq error in combined refine: {str(key_err)[:100]}")
                raise

        if result is None:
            raise last_error or Exception("All Groq API keys exhausted")

        # Extract values and save to DB
        now = datetime.now(timezone.utc)
        extracted = {}
        update_sets = {'last_refined_at': now, 'bulk_refined': True, 'bulk_refined_at': now, 'refined_via_admin': True}
        log_entries = []

        if 'device' in fields:
            val = str(result.get('device', 'all')).strip().lower()
            if val not in ('android', 'ios', 'mobile', 'desktop', 'all'):
                val = 'all'
            extracted['device'] = val
            update_sets['refined_description.device'] = val
            log_entries.append({'field': 'device', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'title' in fields:
            val = str(result.get('refined_name', '')).strip()[:80]
            extracted['title'] = val
            update_sets['refined_description.refined_name'] = val
            log_entries.append({'field': 'title', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'description' in fields:
            val = str(result.get('summary', '')).strip()
            extracted['description'] = val
            update_sets['refined_description.summary'] = val
            log_entries.append({'field': 'description', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'event' in fields:
            val = result.get('steps', [])
            if not isinstance(val, list):
                val = []
            extracted['event'] = val
            update_sets['refined_description.steps'] = val
            log_entries.append({'field': 'event', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'country' in fields:
            val = result.get('countries', [])
            if isinstance(val, list):
                val = [str(c).strip().upper() for c in val if len(str(c).strip()) == 2]
            else:
                val = []
            extracted['country'] = val
            update_sets['refined_description.allowed_countries'] = val
            log_entries.append({'field': 'country', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'category' in fields:
            val = str(result.get('category', 'OTHER')).upper()
            extracted['category'] = val
            update_sets['refined_description.category_info'] = val
            log_entries.append({'field': 'category', 'value': val, 'timestamp': now, 'source': 'bulk'})

        if 'cap' in fields:
            val = {'daily_cap': result.get('daily_cap', 100), 'monthly_cap': result.get('monthly_cap', 2000)}
            extracted['cap'] = val
            update_sets['refined_description.cap_suggestion'] = val
            log_entries.append({'field': 'cap', 'value': val, 'timestamp': now, 'source': 'bulk'})

        # Single DB update with all fields
        update_ops = {
            '$set': update_sets,
            '$push': {'refinement_log': {'$each': log_entries}},
            '$inc': {'refinement_count': len(log_entries)}
        }

        offers_col.update_one({'offer_id': offer_id}, update_ops)
        logger.info(f"  ✅ Combined refine done for {offer_id}: {list(extracted.keys())}")

        return extracted

    def _refine_single_offer(self, offers_col, offer_id: str, field: str) -> any:
        """Refine a single offer's field using Groq AI."""
        from routes.admin_offerwall_management import FIELD_PROMPTS, get_collection
        from config import Config
        from groq import Groq, AuthenticationError as GroqAuthError, RateLimitError as GroqRateLimitError
        import json as json_module
        import re

        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            raise ValueError(f'Offer {offer_id} not found')

        name = offer.get('name', '')
        description = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)

        # Map our field names to FIELD_PROMPTS keys
        field_map = {
            'device': 'device',
            'description': 'summary',
            'title': 'refined_name',
            'category': 'event_flow',  # We'll use a custom prompt for category
            'event': 'steps',
            'country': 'countries',
            'cap': 'estimated_time',  # Closest mapping; we'll handle custom
        }

        prompt_key = field_map.get(field, field)
        
        # Custom prompts for fields not directly in FIELD_PROMPTS
        custom_prompts = {
            'category': """Analyze this offer and determine the best category/vertical for it.
Choose from: FINANCE, GAMING, DATING, ECOMMERCE, UTILITIES, CRYPTO, HEALTH, ENTERTAINMENT, EDUCATION, SURVEYS, SPORTS, TRAVEL, FOOD, SOCIAL, OTHER.
Also provide 2-3 alternate categories if applicable.
Return JSON: {"category": "PRIMARY_CATEGORY", "categories": ["CAT1", "CAT2"]}""",
            'cap': """Based on this offer's payout and type, suggest reasonable daily/monthly cap limits.
Consider: high-payout offers need lower caps, low-payout mass-install offers can have higher caps.
Return JSON: {"daily_cap": 100, "monthly_cap": 2000, "reasoning": "brief explanation"}"""
        }

        if field in custom_prompts:
            system_prompt = custom_prompts[field]
        elif prompt_key in FIELD_PROMPTS:
            system_prompt = FIELD_PROMPTS[prompt_key]
        else:
            raise ValueError(f'Unknown field: {field}')

        user_content = f"OFFER NAME: {name}\nOFFER PAYOUT: ${payout}\nRAW DESCRIPTION:\n{description}"

        keys = Config.get_groq_api_keys()
        if not keys:
            raise ValueError('GROQ_API_KEY not configured')

        last_error = None
        result = None
        for api_key in keys:
            try:
                client = Groq(api_key=api_key)
                response = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    temperature=0.3,
                    max_tokens=300,
                    response_format={"type": "json_object"}
                )
                result = json_module.loads(response.choices[0].message.content.strip())
                break
            except (GroqAuthError, GroqRateLimitError) as key_err:
                logger.warning(f"Groq key rotation in bulk refine ({type(key_err).__name__})")
                last_error = key_err
                continue
            except Exception as key_err:
                logger.error(f"Groq error in bulk refine: {str(key_err)[:100]}")
                raise

        if result is None:
            raise last_error or Exception("All Groq API keys exhausted")

        # Extract the value based on field type
        value = self._extract_field_value(result, field, prompt_key, name)

        # Save to DB with refinement log
        now = datetime.now(timezone.utc)
        
        # Build the update for refined_description sub-field
        update_key = self._get_db_field_key(field)
        update_ops = {
            '$set': {
                f'refined_description.{update_key}': value,
                'last_refined_at': now,
            },
            '$push': {
                'refinement_log': {
                    'field': field,
                    'value': value,
                    'timestamp': now,
                    'source': 'bulk'
                }
            },
            '$inc': {
                'refinement_count': 1
            }
        }

        # Mark as bulk-refined (for highlight) and as refined via admin
        update_ops['$set']['bulk_refined'] = True
        update_ops['$set']['bulk_refined_at'] = now
        update_ops['$set']['refined_via_admin'] = True

        offers_col.update_one({'offer_id': offer_id}, update_ops)

        return value

    def _extract_field_value(self, result: dict, field: str, prompt_key: str, name: str):
        """Extract and validate the field value from AI response."""
        if field == 'device':
            value = str(result.get('device', 'all')).strip().lower()
            if value not in ('android', 'ios', 'mobile', 'desktop', 'all'):
                name_lower = name.lower()
                if 'android' in name_lower and 'ios' not in name_lower:
                    value = 'android'
                elif ('ios' in name_lower or 'iphone' in name_lower) and 'android' not in name_lower:
                    value = 'ios'
                else:
                    value = 'all'
            return value
        elif field == 'description':
            return str(result.get('summary', '')).strip()
        elif field == 'title':
            return str(result.get('refined_name', '')).strip()[:80]
        elif field == 'category':
            return {
                'category': str(result.get('category', 'OTHER')).upper(),
                'categories': result.get('categories', [])
            }
        elif field == 'event':
            steps = result.get('steps', [])
            return steps if isinstance(steps, list) else []
        elif field == 'country':
            countries = result.get('countries', [])
            if isinstance(countries, list):
                return [str(c).strip().upper() for c in countries if len(str(c).strip()) == 2]
            return []
        elif field == 'cap':
            return {
                'daily_cap': result.get('daily_cap', 100),
                'monthly_cap': result.get('monthly_cap', 2000),
                'reasoning': str(result.get('reasoning', ''))
            }
        else:
            return result.get(prompt_key, result)

    def _get_db_field_key(self, field: str) -> str:
        """Map field name to the refined_description sub-key in MongoDB."""
        mapping = {
            'device': 'device',
            'description': 'summary',
            'title': 'refined_name',
            'category': 'category_info',
            'event': 'steps',
            'country': 'allowed_countries',
            'cap': 'cap_suggestion',
        }
        return mapping.get(field, field)

    def _update_job_progress(self, job_id: str):
        """Update job progress in MongoDB."""
        with _jobs_lock:
            job = _active_jobs.get(job_id)
            if not job:
                return

        jobs_col = db_instance.get_collection('bulk_refinement_jobs')
        if jobs_col is not None:
            jobs_col.update_one(
                {'job_id': job_id},
                {'$set': {
                    'completed': job['completed'],
                    'failed': job['failed'],
                    'status': job['status']
                }}
            )

    def _complete_job(self, job_id: str):
        """Mark job as complete and create notification."""
        now = datetime.now(timezone.utc)
        
        with _jobs_lock:
            job = _active_jobs.get(job_id)
            if job:
                job['status'] = 'completed'
                job['completed_at'] = now.isoformat()

        # Update in MongoDB
        jobs_col = db_instance.get_collection('bulk_refinement_jobs')
        if jobs_col is not None:
            jobs_col.update_one(
                {'job_id': job_id},
                {'$set': {
                    'status': 'completed',
                    'completed_at': now,
                    'completed': job['completed'] if job else 0,
                    'failed': job['failed'] if job else 0,
                }}
            )

        # Create admin notification
        self._create_notification(job_id, job)
        
        logger.info(f"[BulkRefine {job_id}] COMPLETE — {job['completed']} success, {job['failed']} failed")

    def _fail_job(self, job_id: str, error: str):
        """Mark job as failed."""
        with _jobs_lock:
            job = _active_jobs.get(job_id)
            if job:
                job['status'] = 'failed'
                job['error'] = error

        jobs_col = db_instance.get_collection('bulk_refinement_jobs')
        if jobs_col is not None:
            jobs_col.update_one(
                {'job_id': job_id},
                {'$set': {'status': 'failed', 'error': error}}
            )

    def _create_notification(self, job_id: str, job: dict):
        """Create a notification for the admin about job completion."""
        notif_col = db_instance.get_collection('admin_notifications')
        if notif_col is None:
            return

        notif_col.insert_one({
            'type': 'bulk_refinement_complete',
            'job_id': job_id,
            'admin_user_id': job.get('admin_user_id'),
            'field': job.get('field'),
            'total': job.get('total', 0),
            'completed': job.get('completed', 0),
            'failed': job.get('failed', 0),
            'offer_ids': job.get('offer_ids', []),
            'message': f"Bulk refinement complete: {job.get('completed', 0)}/{job.get('total', 0)} offers refined ({job.get('field')} field)",
            'read': False,
            'created_at': datetime.now(timezone.utc),
        })

    def get_job_status(self, job_id: str) -> Optional[dict]:
        """Get current status of a bulk refinement job."""
        with _jobs_lock:
            job = _active_jobs.get(job_id)
            if job:
                return {
                    'job_id': job['job_id'],
                    'status': job['status'],
                    'total': job['total'],
                    'completed': job['completed'],
                    'failed': job['failed'],
                    'field': job['field'],
                    'started_at': job['started_at'],
                    'completed_at': job.get('completed_at'),
                }

        # Check MongoDB
        jobs_col = db_instance.get_collection('bulk_refinement_jobs')
        if jobs_col is not None:
            job = jobs_col.find_one({'job_id': job_id}, {'results': 0})
            if job:
                job.pop('_id', None)
                return job

        return None

    def get_active_jobs(self, admin_user_id: str = None) -> List[dict]:
        """Get all active/recent jobs for an admin."""
        results = []
        with _jobs_lock:
            for job in _active_jobs.values():
                if admin_user_id and job.get('admin_user_id') != admin_user_id:
                    continue
                results.append({
                    'job_id': job['job_id'],
                    'status': job['status'],
                    'total': job['total'],
                    'completed': job['completed'],
                    'failed': job['failed'],
                    'field': job['field'],
                    'started_at': job['started_at'],
                })
        return results

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        with _jobs_lock:
            job = _active_jobs.get(job_id)
            if job and job['status'] == 'running':
                job['status'] = 'cancelled'
                return True
        return False

    def mark_offers_reviewed(self, offer_ids: List[str]) -> int:
        """Remove the bulk_refined highlight from offers after admin reviews them."""
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return 0

        result = offers_col.update_many(
            {'offer_id': {'$in': offer_ids}},
            {'$unset': {'bulk_refined': '', 'bulk_refined_at': ''}}
        )
        return result.modified_count

    def get_unreviewed_notifications(self, admin_user_id: str) -> List[dict]:
        """Get unread bulk refinement notifications for an admin."""
        notif_col = db_instance.get_collection('admin_notifications')
        if notif_col is None:
            return []

        notifications = list(notif_col.find(
            {
                'type': 'bulk_refinement_complete',
                'admin_user_id': admin_user_id,
                'read': False
            },
            {'_id': 0}
        ).sort('created_at', -1).limit(10))

        return notifications

    def mark_notification_read(self, job_id: str) -> bool:
        """Mark a notification as read."""
        notif_col = db_instance.get_collection('admin_notifications')
        if notif_col is None:
            return False

        result = notif_col.update_one(
            {'job_id': job_id, 'type': 'bulk_refinement_complete'},
            {'$set': {'read': True}}
        )
        return result.modified_count > 0


# Singleton instance
_bulk_refinement_service = None


def get_bulk_refinement_service() -> BulkRefinementService:
    global _bulk_refinement_service
    if _bulk_refinement_service is None:
        _bulk_refinement_service = BulkRefinementService()
    return _bulk_refinement_service
