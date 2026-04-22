"""
Survey Model - MongoDB document model for bot-detection surveys.
Collections: surveys, survey_responses, survey_assignments
"""
from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging
import random
import re

logger = logging.getLogger(__name__)


# ── Pre-built captcha templates ─────────────────────────────────────────

CAPTCHA_TYPES = ['math', 'word_scramble', 'pattern', 'color_pick', 'odd_one_out']

def generate_captcha():
    """Generate a random captcha challenge. Returns dict with type, question, answer, options."""
    ctype = random.choice(CAPTCHA_TYPES)

    if ctype == 'math':
        a, b = random.randint(2, 15), random.randint(2, 15)
        op = random.choice(['+', '-', '×'])
        if op == '+':
            answer = a + b
        elif op == '-':
            a, b = max(a, b), min(a, b)
            answer = a - b
        else:
            a, b = random.randint(2, 9), random.randint(2, 9)
            answer = a * b
        wrong = set()
        while len(wrong) < 3:
            w = answer + random.choice([-3, -2, -1, 1, 2, 3])
            if w != answer and w > 0:
                wrong.add(w)
        options = list(wrong) + [answer]
        random.shuffle(options)
        return {
            'type': 'math',
            'question': f'What is {a} {op} {b}?',
            'answer': str(answer),
            'options': [str(o) for o in options],
        }

    if ctype == 'word_scramble':
        words = ['apple', 'house', 'river', 'cloud', 'music', 'green', 'chair', 'light',
                 'ocean', 'bread', 'stone', 'plant', 'dream', 'flame', 'tiger']
        word = random.choice(words)
        scrambled = list(word)
        while ''.join(scrambled) == word:
            random.shuffle(scrambled)
        return {
            'type': 'word_scramble',
            'question': f'Unscramble this word: {"".join(scrambled).upper()}',
            'answer': word,
            'options': None,
        }

    if ctype == 'pattern':
        patterns = [
            {'sequence': '2, 4, 6, 8, ?', 'answer': '10', 'options': ['9', '10', '11', '12']},
            {'sequence': '1, 3, 5, 7, ?', 'answer': '9', 'options': ['8', '9', '10', '11']},
            {'sequence': '3, 6, 9, 12, ?', 'answer': '15', 'options': ['13', '14', '15', '16']},
            {'sequence': '5, 10, 15, 20, ?', 'answer': '25', 'options': ['22', '24', '25', '30']},
            {'sequence': '1, 4, 9, 16, ?', 'answer': '25', 'options': ['20', '24', '25', '36']},
            {'sequence': '2, 6, 12, 20, ?', 'answer': '30', 'options': ['28', '30', '32', '36']},
            {'sequence': '1, 1, 2, 3, 5, ?', 'answer': '8', 'options': ['6', '7', '8', '10']},
            {'sequence': '100, 90, 80, 70, ?', 'answer': '60', 'options': ['50', '55', '60', '65']},
        ]
        p = random.choice(patterns)
        return {
            'type': 'pattern',
            'question': f'What comes next: {p["sequence"]}',
            'answer': p['answer'],
            'options': p['options'],
        }

    if ctype == 'color_pick':
        colors = [
            {'name': 'Red', 'hex': '#EF4444'},
            {'name': 'Blue', 'hex': '#3B82F6'},
            {'name': 'Green', 'hex': '#22C55E'},
            {'name': 'Yellow', 'hex': '#EAB308'},
            {'name': 'Purple', 'hex': '#A855F7'},
            {'name': 'Orange', 'hex': '#F97316'},
        ]
        target = random.choice(colors)
        others = [c for c in colors if c['name'] != target['name']]
        picks = random.sample(others, 3) + [target]
        random.shuffle(picks)
        return {
            'type': 'color_pick',
            'question': f'Click the {target["name"]} color',
            'answer': target['hex'],
            'options': [c['hex'] for c in picks],
        }

    # odd_one_out
    groups = [
        {'items': ['Dog', 'Cat', 'Fish', 'Car'], 'answer': 'Car', 'hint': 'Which one is NOT an animal?'},
        {'items': ['Apple', 'Banana', 'Carrot', 'Grape'], 'answer': 'Carrot', 'hint': 'Which one is NOT a fruit?'},
        {'items': ['Piano', 'Guitar', 'Drum', 'Table'], 'answer': 'Table', 'hint': 'Which one is NOT an instrument?'},
        {'items': ['Red', 'Blue', 'Happy', 'Green'], 'answer': 'Happy', 'hint': 'Which one is NOT a color?'},
        {'items': ['London', 'Paris', 'Pizza', 'Tokyo'], 'answer': 'Pizza', 'hint': 'Which one is NOT a city?'},
        {'items': ['Monday', 'Friday', 'March', 'Sunday'], 'answer': 'March', 'hint': 'Which one is NOT a day?'},
    ]
    g = random.choice(groups)
    random.shuffle(g['items'])
    return {
        'type': 'odd_one_out',
        'question': g['hint'],
        'answer': g['answer'],
        'options': g['items'],
    }


# ── Category keyword mapping for auto-assignment ────────────────────────

CATEGORY_KEYWORDS = {
    'Gaming': ['game', 'play', 'casino', 'slot', 'bet', 'poker', 'rpg', 'mobile game', 'esport'],
    'Finance': ['loan', 'credit', 'bank', 'invest', 'insurance', 'mortgage', 'trading', 'crypto', 'forex'],
    'Shopping': ['shop', 'buy', 'deal', 'coupon', 'discount', 'store', 'ecommerce', 'fashion', 'clothing'],
    'Health': ['health', 'fitness', 'diet', 'weight', 'supplement', 'vitamin', 'wellness', 'medical'],
    'Education': ['learn', 'course', 'study', 'school', 'university', 'training', 'tutorial', 'degree'],
    'Entertainment': ['stream', 'movie', 'music', 'video', 'tv', 'show', 'watch', 'listen', 'podcast'],
    'Technology': ['software', 'app', 'vpn', 'antivirus', 'cloud', 'hosting', 'tech', 'saas', 'tool'],
    'Travel': ['travel', 'hotel', 'flight', 'booking', 'vacation', 'trip', 'tour', 'cruise'],
    'Dating': ['date', 'dating', 'match', 'relationship', 'singles', 'love', 'romance'],
    'Lifestyle': ['lifestyle', 'home', 'garden', 'food', 'recipe', 'beauty', 'skincare', 'pet'],
}


class Survey:
    """Survey model for bot-detection gateway surveys."""

    def __init__(self):
        self.collection = db_instance.get_collection('surveys')
        self.responses_col = db_instance.get_collection('survey_responses')
        self.assignments_col = db_instance.get_collection('survey_assignments')

    # ── Survey CRUD ──────────────────────────────────────────────────────

    def create_survey(self, data, created_by='admin'):
        """Create a new survey."""
        doc = {
            'name': data['name'].strip(),
            'description': data.get('description', '').strip(),
            'category': data.get('category', 'General'),
            'questions': data.get('questions', []),  # [{type, question, options, required}]
            'captcha_enabled': data.get('captcha_enabled', True),
            'is_active': True,
            'created_by': created_by,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'total_responses': 0,
            'total_passed': 0,
            'total_failed': 0,
            'total_abandoned': 0,
            'avg_completion_time': 0,
        }
        result = self.collection.insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        return doc

    def update_survey(self, survey_id, data):
        """Update an existing survey."""
        update_fields = {}
        allowed = ['name', 'description', 'category', 'questions', 'captcha_enabled', 'is_active']
        for k in allowed:
            if k in data:
                update_fields[k] = data[k]
        update_fields['updated_at'] = datetime.utcnow()
        self.collection.update_one({'_id': ObjectId(survey_id)}, {'$set': update_fields})
        return self.get_survey(survey_id)

    def get_survey(self, survey_id):
        """Get a single survey by ID."""
        doc = self.collection.find_one({'_id': ObjectId(survey_id)})
        if doc:
            doc['_id'] = str(doc['_id'])
        return doc

    def list_surveys(self, filters=None, page=1, per_page=20):
        """List surveys with optional filters."""
        query = {}
        if filters:
            if filters.get('category'):
                query['category'] = filters['category']
            if filters.get('is_active') is not None:
                query['is_active'] = filters['is_active']
            if filters.get('search'):
                query['$or'] = [
                    {'name': {'$regex': filters['search'], '$options': 'i'}},
                    {'description': {'$regex': filters['search'], '$options': 'i'}},
                ]
        total = self.collection.count_documents(query)
        docs = list(self.collection.find(query)
                     .sort('created_at', -1)
                     .skip((page - 1) * per_page)
                     .limit(per_page))
        for d in docs:
            d['_id'] = str(d['_id'])
        return docs, total

    def delete_survey(self, survey_id):
        """Soft-delete a survey."""
        self.collection.update_one(
            {'_id': ObjectId(survey_id)},
            {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
        )

    # ── Assignment logic ─────────────────────────────────────────────────

    def assign_survey_to_offer(self, offer_id, survey_id, assigned_by='admin'):
        """Manually assign a survey to an offer (upsert)."""
        self.assignments_col.update_one(
            {'offer_id': offer_id},
            {'$set': {
                'offer_id': offer_id,
                'survey_id': survey_id,
                'assigned_by': assigned_by,
                'assignment_type': 'manual',
                'assigned_at': datetime.utcnow(),
            }},
            upsert=True
        )

    def unassign_survey_from_offer(self, offer_id):
        """Remove survey assignment from an offer."""
        self.assignments_col.delete_one({'offer_id': offer_id})

    def get_assignment(self, offer_id):
        """Get the survey assignment for an offer."""
        return self.assignments_col.find_one({'offer_id': offer_id})

    def bulk_assign(self, offer_ids, survey_id, assigned_by='admin'):
        """Assign a survey to multiple offers."""
        ops = []
        from pymongo import UpdateOne
        for oid in offer_ids:
            ops.append(UpdateOne(
                {'offer_id': oid},
                {'$set': {
                    'offer_id': oid,
                    'survey_id': survey_id,
                    'assigned_by': assigned_by,
                    'assignment_type': 'manual',
                    'assigned_at': datetime.utcnow(),
                }},
                upsert=True
            ))
        if ops:
            self.assignments_col.bulk_write(ops)

    def get_survey_for_offer(self, offer):
        """
        Determine which survey to show for an offer.
        Priority: manual assignment > category match > name keyword match > random general.
        """
        offer_id = offer.get('offer_id', '')

        # 1. Check manual assignment
        assignment = self.assignments_col.find_one({'offer_id': offer_id})
        if assignment:
            survey = self.get_survey(assignment['survey_id'])
            if survey and survey.get('is_active'):
                return survey

        # 2. Match by offer category/vertical
        category = offer.get('vertical') or offer.get('category') or ''
        if category:
            survey = self.collection.find_one({
                'category': {'$regex': f'^{re.escape(category)}$', '$options': 'i'},
                'is_active': True
            })
            if survey:
                survey['_id'] = str(survey['_id'])
                return survey

        # 3. Match by description/name keywords
        text = f"{offer.get('name', '')} {offer.get('description', '')}".lower()
        best_match = None
        best_score = 0
        for cat, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > best_score:
                best_score = score
                best_match = cat
        if best_match and best_score > 0:
            survey = self.collection.find_one({
                'category': {'$regex': f'^{re.escape(best_match)}$', '$options': 'i'},
                'is_active': True
            })
            if survey:
                survey['_id'] = str(survey['_id'])
                return survey

        # 4. Fallback: random active survey
        pipeline = [{'$match': {'is_active': True}}, {'$sample': {'size': 1}}]
        results = list(self.collection.aggregate(pipeline))
        if results:
            results[0]['_id'] = str(results[0]['_id'])
            return results[0]

        return None

    # ── Response recording ───────────────────────────────────────────────

    def record_response(self, data):
        """Record a full survey response with all tracking details."""
        # Parse user agent for browser/device/OS
        ua = data.get('user_agent', '').lower()
        browser = 'Unknown'
        if 'edg' in ua: browser = 'Edge'
        elif 'chrome' in ua and 'edg' not in ua: browser = 'Chrome'
        elif 'firefox' in ua: browser = 'Firefox'
        elif 'safari' in ua and 'chrome' not in ua: browser = 'Safari'
        elif 'opera' in ua or 'opr' in ua: browser = 'Opera'

        device = 'Desktop'
        if any(m in ua for m in ['mobile', 'android', 'iphone', 'ipad']): device = 'Mobile'
        elif 'tablet' in ua: device = 'Tablet'

        os_name = 'Unknown'
        if 'windows' in ua: os_name = 'Windows'
        elif 'mac' in ua and 'iphone' not in ua and 'ipad' not in ua: os_name = 'macOS'
        elif 'android' in ua: os_name = 'Android'
        elif 'iphone' in ua or 'ipad' in ua: os_name = 'iOS'
        elif 'linux' in ua: os_name = 'Linux'

        # Bot detection signals
        bot_signals = []
        if data.get('honeypot_filled', False): bot_signals.append('honeypot_filled')
        if not data.get('mouse_moved', True): bot_signals.append('no_mouse_movement')
        if (data.get('total_time_ms', 0) or 0) < 3000: bot_signals.append('too_fast')
        if not data.get('captcha_passed', False): bot_signals.append('captcha_failed')
        # Check for headless browser signatures
        if any(b in ua for b in ['headless', 'phantomjs', 'selenium', 'puppeteer', 'playwright']): bot_signals.append('headless_browser')
        is_bot = len(bot_signals) >= 2

        # Lookup offer name
        offer_name = ''
        offer_id = data.get('offer_id', '')
        if offer_id:
            try:
                offers_col = db_instance.get_collection('offers')
                if offers_col is not None:
                    o = offers_col.find_one({'offer_id': offer_id}, {'name': 1})
                    if o: offer_name = o.get('name', '')
            except Exception: pass

        # Lookup user name and country from click or user collection
        user_name = ''
        country = ''
        country_code = ''
        user_id = data.get('user_id', '')
        click_id = data.get('click_id', '')
        if click_id:
            try:
                clicks_col = db_instance.get_collection('clicks')
                if clicks_col is not None:
                    click = clicks_col.find_one({'click_id': click_id}, {'country': 1, 'country_code': 1})
                    if click:
                        country = click.get('country', '')
                        country_code = click.get('country_code', '')
            except Exception: pass
        if user_id:
            try:
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    from bson import ObjectId as BsonOid
                    try:
                        u = users_col.find_one({'_id': BsonOid(user_id)}, {'username': 1, 'first_name': 1, 'last_name': 1})
                    except Exception:
                        u = users_col.find_one({'username': user_id}, {'username': 1, 'first_name': 1, 'last_name': 1})
                    if u:
                        user_name = u.get('username', '') or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
            except Exception: pass

        # VPN detection — use GeolocationService for proper detection
        ip = data.get('ip_address', '')
        # Clean IP: take the first (client) IP if multiple are present
        clean_ip = ip.split(',')[0].strip() if ',' in ip else ip.strip()
        is_vpn = False
        try:
            from models.geolocation import GeolocationService
            geo_svc = GeolocationService()
            ip_info = geo_svc.get_ip_info(clean_ip)
            is_vpn = ip_info.get('vpn_detected', False) or ip_info.get('proxy_detected', False) or ip_info.get('tor_detected', False)
            # Also fill country from IP if not already set
            if not country_code and ip_info.get('country_code'):
                country_code = ip_info['country_code']
                country = ip_info.get('country', '')
        except Exception as vpn_err:
            logger.warning(f"VPN detection failed for {clean_ip}: {vpn_err}")

        doc = {
            'survey_id': data['survey_id'],
            'offer_id': offer_id,
            'offer_name': offer_name,
            'click_id': click_id,
            'user_id': user_id,
            'user_name': user_name,
            'ip_address': clean_ip,
            'user_agent': data.get('user_agent', ''),
            'browser': browser,
            'device': device,
            'os': os_name,
            'country': country,
            'country_code': country_code,
            'is_vpn': is_vpn,
            'is_bot': is_bot,
            'bot_signals': bot_signals,
            'answers': data.get('answers', []),
            'captcha_passed': data.get('captcha_passed', False),
            'captcha_type': data.get('captcha_type', ''),
            'total_time_ms': data.get('total_time_ms', 0),
            'result': data.get('result', 'abandoned'),
            'abandoned_at_question': data.get('abandoned_at_question'),
            'honeypot_filled': data.get('honeypot_filled', False),
            'mouse_moved': data.get('mouse_moved', True),
            'created_at': datetime.utcnow(),
        }
        result = self.responses_col.insert_one(doc)
        doc['_id'] = str(result.inserted_id)

        # Update survey stats
        inc_fields = {'total_responses': 1}
        if doc['result'] == 'passed':
            inc_fields['total_passed'] = 1
        elif doc['result'] == 'failed':
            inc_fields['total_failed'] = 1
        else:
            inc_fields['total_abandoned'] = 1

        try:
            self.collection.update_one(
                {'_id': ObjectId(data['survey_id'])},
                {'$inc': inc_fields}
            )
        except Exception:
            pass

        return doc

    def get_survey_analytics(self, survey_id=None, offer_id=None, days=30):
        """Get analytics for surveys."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        match = {'created_at': {'$gte': cutoff}}
        if survey_id:
            match['survey_id'] = survey_id
        if offer_id:
            match['offer_id'] = offer_id

        pipeline = [
            {'$match': match},
            {'$group': {
                '_id': '$result',
                'count': {'$sum': 1},
                'avg_time': {'$avg': '$total_time_ms'},
            }}
        ]
        results = list(self.responses_col.aggregate(pipeline))
        stats = {'passed': 0, 'failed': 0, 'abandoned': 0, 'avg_time_ms': 0, 'total': 0}
        total_time = 0
        for r in results:
            stats[r['_id']] = r['count']
            stats['total'] += r['count']
            total_time += (r['avg_time'] or 0) * r['count']
        if stats['total'] > 0:
            stats['avg_time_ms'] = total_time / stats['total']
            stats['pass_rate'] = round(stats['passed'] / stats['total'] * 100, 1)
            stats['bot_detection_rate'] = round((stats['failed'] + stats['abandoned']) / stats['total'] * 100, 1)
        else:
            stats['pass_rate'] = 0
            stats['bot_detection_rate'] = 0

        # Recent responses (enriched)
        recent = list(self.responses_col.find(match).sort('created_at', -1).limit(100))
        for r in recent:
            r['_id'] = str(r['_id'])

        stats['recent_responses'] = recent
        return stats

    def get_response_details(self, response_id):
        """Get full details of a single response."""
        doc = self.responses_col.find_one({'_id': ObjectId(response_id)})
        if doc:
            doc['_id'] = str(doc['_id'])
        return doc

    def get_all_assignments(self, page=1, per_page=50):
        """List all survey-to-offer assignments."""
        total = self.assignments_col.count_documents({})
        docs = list(self.assignments_col.find()
                     .sort('assigned_at', -1)
                     .skip((page - 1) * per_page)
                     .limit(per_page))
        for d in docs:
            d['_id'] = str(d['_id'])
        return docs, total

    def get_offer_coverage_stats(self):
        """Check how many offers have descriptions, verticals, etc."""
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return {}
        # Total offers in system (not soft-deleted)
        total_all = offers_col.count_documents({'is_active': True})
        total_all_with_desc = offers_col.count_documents({'is_active': True, 'description': {'$nin': [None, '']}})
        # Active offers = status is 'active' (what users actually see)
        active_query = {'is_active': True, 'status': 'active'}
        total_active = offers_col.count_documents(active_query)
        active_with_desc = offers_col.count_documents({**active_query, 'description': {'$nin': [None, '']}})
        active_with_vertical = offers_col.count_documents({**active_query, 'vertical': {'$nin': [None, '']}})
        assigned = self.assignments_col.count_documents({})

        # Category distribution (active status only)
        pipeline = [
            {'$match': active_query},
            {'$group': {'_id': {'$ifNull': ['$vertical', 'Unknown']}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        cat_dist = list(offers_col.aggregate(pipeline))

        return {
            'total_offers': total_all,
            'total_with_description': total_all_with_desc,
            'total_without_description': total_all - total_all_with_desc,
            'active_offers': total_active,
            'active_with_description': active_with_desc,
            'active_without_description': total_active - active_with_desc,
            'active_with_vertical': active_with_vertical,
            'active_without_vertical': total_active - active_with_vertical,
            'manually_assigned': assigned,
            'category_distribution': [{'category': c['_id'], 'count': c['count']} for c in cat_dist],
        }
