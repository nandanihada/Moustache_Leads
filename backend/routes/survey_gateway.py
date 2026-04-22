"""
Survey Gateway Routes
- Admin CRUD for surveys
- Admin assignment management
- Admin analytics
- Public survey serving + submission (for end-user gateway)
"""
from flask import Blueprint, request, jsonify, render_template_string
from datetime import datetime
from bson import ObjectId
from database import db_instance
from models.survey import Survey, generate_captcha
import logging
import time
import json

logger = logging.getLogger(__name__)

survey_gateway_bp = Blueprint('survey_gateway', __name__)


# ── Helpers ──────────────────────────────────────────────────────────────

def _get_admin_user():
    """Extract admin user from token_required decorator."""
    from utils.auth import admin_required, token_required
    return getattr(request, 'current_user', None)


def _admin_guard(f):
    """Decorator combining token + admin check."""
    from utils.auth import token_required, admin_required
    from functools import wraps
    @wraps(f)
    @token_required
    @admin_required
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)
    return wrapper


# ═══════════════════════════════════════════════════════════════════════
# ADMIN: Survey CRUD
# ═══════════════════════════════════════════════════════════════════════

@survey_gateway_bp.route('/api/admin/surveys', methods=['GET'])
@_admin_guard
def list_surveys():
    """List all surveys with optional filters."""
    model = Survey()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filters = {
        'category': request.args.get('category'),
        'search': request.args.get('search'),
        'is_active': request.args.get('is_active'),
    }
    if filters['is_active'] is not None:
        filters['is_active'] = filters['is_active'].lower() == 'true'
    else:
        del filters['is_active']
    filters = {k: v for k, v in filters.items() if v is not None}
    surveys, total = model.list_surveys(filters, page, per_page)
    return jsonify({'success': True, 'surveys': surveys, 'total': total, 'page': page})


@survey_gateway_bp.route('/api/admin/surveys', methods=['POST'])
@_admin_guard
def create_survey():
    """Create a new survey."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'success': False, 'error': 'Survey name is required'}), 400
    model = Survey()
    user = getattr(request, 'current_user', {})
    survey = model.create_survey(data, created_by=user.get('username', 'admin'))
    return jsonify({'success': True, 'survey': survey}), 201


@survey_gateway_bp.route('/api/admin/surveys/<survey_id>', methods=['GET'])
@_admin_guard
def get_survey(survey_id):
    """Get a single survey."""
    model = Survey()
    survey = model.get_survey(survey_id)
    if not survey:
        return jsonify({'success': False, 'error': 'Survey not found'}), 404
    return jsonify({'success': True, 'survey': survey})


@survey_gateway_bp.route('/api/admin/surveys/<survey_id>', methods=['PUT'])
@_admin_guard
def update_survey(survey_id):
    """Update a survey."""
    data = request.get_json()
    model = Survey()
    survey = model.update_survey(survey_id, data)
    if not survey:
        return jsonify({'success': False, 'error': 'Survey not found'}), 404
    return jsonify({'success': True, 'survey': survey})


@survey_gateway_bp.route('/api/admin/surveys/<survey_id>', methods=['DELETE'])
@_admin_guard
def delete_survey(survey_id):
    """Soft-delete a survey."""
    model = Survey()
    model.delete_survey(survey_id)
    return jsonify({'success': True, 'message': 'Survey deactivated'})


# ═══════════════════════════════════════════════════════════════════════
# ADMIN: Assignments
# ═══════════════════════════════════════════════════════════════════════

@survey_gateway_bp.route('/api/admin/surveys/assignments', methods=['GET'])
@_admin_guard
def list_assignments():
    """List all survey-to-offer assignments."""
    model = Survey()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    docs, total = model.get_all_assignments(page, per_page)
    return jsonify({'success': True, 'assignments': docs, 'total': total})


@survey_gateway_bp.route('/api/admin/surveys/assign', methods=['POST'])
@_admin_guard
def assign_survey():
    """Assign a survey to one or more offers."""
    data = request.get_json()
    survey_id = data.get('survey_id')
    offer_ids = data.get('offer_ids', [])
    offer_id = data.get('offer_id')
    if offer_id:
        offer_ids = [offer_id]
    if not survey_id or not offer_ids:
        return jsonify({'success': False, 'error': 'survey_id and offer_ids required'}), 400
    model = Survey()
    user = getattr(request, 'current_user', {})
    if len(offer_ids) == 1:
        model.assign_survey_to_offer(offer_ids[0], survey_id, user.get('username', 'admin'))
    else:
        model.bulk_assign(offer_ids, survey_id, user.get('username', 'admin'))
    return jsonify({'success': True, 'message': f'Survey assigned to {len(offer_ids)} offer(s)'})


@survey_gateway_bp.route('/api/admin/surveys/unassign', methods=['POST'])
@_admin_guard
def unassign_survey():
    """Remove survey assignment from an offer."""
    data = request.get_json()
    offer_id = data.get('offer_id')
    if not offer_id:
        return jsonify({'success': False, 'error': 'offer_id required'}), 400
    model = Survey()
    model.unassign_survey_from_offer(offer_id)
    return jsonify({'success': True, 'message': 'Survey unassigned'})


# ═══════════════════════════════════════════════════════════════════════
# ADMIN: Analytics
# ═══════════════════════════════════════════════════════════════════════

@survey_gateway_bp.route('/api/admin/surveys/analytics', methods=['GET'])
@_admin_guard
def survey_analytics():
    """Get survey analytics."""
    model = Survey()
    survey_id = request.args.get('survey_id')
    offer_id = request.args.get('offer_id')
    days = int(request.args.get('days', 30))
    stats = model.get_survey_analytics(survey_id, offer_id, days)
    return jsonify({'success': True, 'analytics': stats})


@survey_gateway_bp.route('/api/admin/surveys/offer-coverage', methods=['GET'])
@_admin_guard
def offer_coverage():
    """Get offer coverage stats (how many have descriptions, verticals, etc.)."""
    model = Survey()
    stats = model.get_offer_coverage_stats()
    return jsonify({'success': True, 'coverage': stats})


@survey_gateway_bp.route('/api/admin/surveys/preview/<survey_id>', methods=['GET'])
@_admin_guard
def preview_survey_admin(survey_id):
    """Return survey data for admin live preview."""
    model = Survey()
    survey = model.get_survey(survey_id)
    if not survey:
        return jsonify({'success': False, 'error': 'Survey not found'}), 404
    captcha = generate_captcha() if survey.get('captcha_enabled', True) else None
    return jsonify({'success': True, 'survey': survey, 'captcha': captcha})


@survey_gateway_bp.route('/api/admin/surveys/response/<response_id>', methods=['GET'])
@_admin_guard
def get_response_detail(response_id):
    """Get full details of a single survey response."""
    model = Survey()
    detail = model.get_response_details(response_id)
    if not detail:
        return jsonify({'success': False, 'error': 'Response not found'}), 404
    # Also fetch the survey questions for context
    survey = None
    if detail.get('survey_id'):
        try:
            survey = model.get_survey(detail['survey_id'])
        except Exception:
            pass
    return jsonify({'success': True, 'response': detail, 'survey': survey})


# ═══════════════════════════════════════════════════════════════════════
# ADMIN: Seed pre-built surveys
# ═══════════════════════════════════════════════════════════════════════

@survey_gateway_bp.route('/api/admin/surveys/seed', methods=['POST'])
@_admin_guard
def seed_surveys():
    """Seed pre-built surveys for all categories."""
    model = Survey()
    existing = model.collection.count_documents({})
    if existing > 0:
        return jsonify({'success': False, 'error': f'Already have {existing} surveys. Delete them first or skip seeding.'}), 400

    seeded = _seed_default_surveys(model)
    return jsonify({'success': True, 'message': f'Seeded {seeded} surveys'})


# ═══════════════════════════════════════════════════════════════════════
# PUBLIC: Survey Gateway (served to end users before redirect)
# ═══════════════════════════════════════════════════════════════════════

@survey_gateway_bp.route('/survey/<click_id>', methods=['GET'])
def serve_survey(click_id):
    """Serve the survey page to an end user before redirecting to the offer."""
    try:
        # Look up the click to get offer info
        clicks_col = db_instance.get_collection('clicks')
        click = clicks_col.find_one({'click_id': click_id})
        if not click:
            return '<h1>Link expired</h1>', 404

        offer_id = click.get('offer_id', '')
        offers_col = db_instance.get_collection('offers')
        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            return '<h1>Offer not available</h1>', 404

        # ── GEO RESTRICTION: Block users from non-target countries ──
        offer_countries = offer.get('countries', [])
        if offer_countries and len(offer_countries) > 0:
            # Get user's real IP and country
            user_ip = request.headers.get('X-Forwarded-For', request.remote_addr or '')
            user_ip = user_ip.split(',')[0].strip() if ',' in user_ip else user_ip.strip()
            try:
                from models.geolocation import GeolocationService
                geo_svc = GeolocationService()
                ip_info = geo_svc.get_ip_info(user_ip)
                user_country = (ip_info.get('country_code') or '').upper()
                offer_countries_upper = [c.upper() for c in offer_countries]
                # Only block if we have a valid 2-letter country code (not XX, empty, or local)
                # Skip blocking for private/local IPs where geo can't be determined
                is_valid_country = (
                    user_country
                    and len(user_country) == 2
                    and user_country not in ('XX', 'ZZ', 'T1', 'A1', 'A2')
                    and user_ip not in ('127.0.0.1', 'localhost', '::1', '')
                    and not user_ip.startswith(('10.', '192.168.', '172.'))
                )
                if is_valid_country and user_country not in offer_countries_upper:
                    logger.info(f"Geo blocked: user from {user_country}, offer requires {offer_countries_upper}")
                    return render_template_string(GEO_BLOCKED_TEMPLATE, user_country=user_country, offer_countries=', '.join(offer_countries_upper))
            except Exception as geo_err:
                logger.warning(f"Geo check failed: {geo_err}")
                # Don't block on geo check failure — let them through

        model = Survey()
        survey = model.get_survey_for_offer(offer)
        if not survey:
            # No survey available — redirect directly
            target_url = click.get('target_url') or offer.get('target_url', '')
            return f'<script>window.location.href="{target_url}";</script>'

        captcha = generate_captcha() if survey.get('captcha_enabled', True) else None

        # Store captcha answer in a server-side token (simple HMAC)
        import hashlib, hmac
        captcha_token = ''
        if captcha:
            secret = 'ml_survey_secret_2024'
            raw = f"{click_id}:{captcha['answer']}"
            captcha_token = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()

        return render_template_string(
            SURVEY_PAGE_TEMPLATE,
            survey=survey,
            captcha=captcha,
            captcha_token=captcha_token,
            click_id=click_id,
            offer_name=offer.get('name', 'Special Offer'),
            offer_image=offer.get('image_url', ''),
        )
    except Exception as e:
        logger.error(f"Survey serve error: {e}", exc_info=True)
        return '<h1>Something went wrong</h1>', 500


@survey_gateway_bp.route('/survey/<click_id>/submit', methods=['POST'])
def submit_survey(click_id):
    """Process survey submission and redirect to target URL."""
    try:
        data = request.get_json()
        clicks_col = db_instance.get_collection('clicks')
        click = clicks_col.find_one({'click_id': click_id})
        if not click:
            return jsonify({'success': False, 'error': 'Invalid link'}), 404

        offer_id = click.get('offer_id', '')
        offers_col = db_instance.get_collection('offers')
        offer = offers_col.find_one({'offer_id': offer_id})
        target_url = offer.get('target_url', '') if offer else ''

        # Validate captcha
        captcha_answer = data.get('captcha_answer', '')
        captcha_token = data.get('captcha_token', '')
        captcha_passed = False

        if captcha_token and captcha_answer:
            import hashlib, hmac
            secret = 'ml_survey_secret_2024'
            raw = f"{click_id}:{captcha_answer}"
            expected = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
            captcha_passed = hmac.compare_digest(expected, captcha_token)

        # Bot detection checks
        total_time = data.get('total_time_ms', 0)
        honeypot = data.get('honeypot_filled', False)
        mouse_moved = data.get('mouse_moved', True)

        is_bot = False
        if honeypot:
            is_bot = True
        if total_time < 3000:  # Less than 3 seconds = bot
            is_bot = True
        if not mouse_moved:
            is_bot = True

        if not captcha_passed:
            result = 'failed'
        elif is_bot:
            result = 'failed'
        else:
            result = 'passed'

        # Record response
        model = Survey()
        model.record_response({
            'survey_id': data.get('survey_id', ''),
            'offer_id': offer_id,
            'click_id': click_id,
            'user_id': click.get('user_id', ''),
            'ip_address': request.headers.get('X-Forwarded-For', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', ''),
            'answers': data.get('answers', []),
            'captcha_passed': captcha_passed,
            'captcha_type': data.get('captcha_type', ''),
            'total_time_ms': total_time,
            'result': result,
            'abandoned_at_question': data.get('abandoned_at_question'),
            'honeypot_filled': honeypot,
            'mouse_moved': mouse_moved,
        })

        # Mark click with survey result
        try:
            clicks_col.update_one(
                {'click_id': click_id},
                {'$set': {'survey_result': result, 'survey_completed_at': datetime.utcnow()}}
            )
        except Exception:
            pass

        if result == 'passed':
            return jsonify({'success': True, 'redirect_url': target_url})
        else:
            return jsonify({'success': False, 'error': 'Verification failed. Please try again.', 'retry': True})

    except Exception as e:
        logger.error(f"Survey submit error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Something went wrong'}), 500


# ═══════════════════════════════════════════════════════════════════════
# Seed default surveys
# ═══════════════════════════════════════════════════════════════════════

def _seed_default_surveys(model):
    """Create pre-built surveys for common offer categories."""
    surveys = [
        {
            'name': 'Quick Gaming Check',
            'description': 'Short verification for gaming offers',
            'category': 'Gaming',
            'questions': [
                {'type': 'multiple_choice', 'question': 'How often do you play mobile games?', 'options': ['Daily', 'A few times a week', 'Rarely', 'Never'], 'required': True},
                {'type': 'multiple_choice', 'question': 'What type of games do you enjoy most?', 'options': ['Puzzle', 'Action', 'Strategy', 'Casino/Card games'], 'required': True},
            ],
        },
        {
            'name': 'Finance Interest Survey',
            'description': 'Verification for finance and banking offers',
            'category': 'Finance',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What financial products interest you?', 'options': ['Credit cards', 'Personal loans', 'Savings accounts', 'Investment apps'], 'required': True},
                {'type': 'multiple_choice', 'question': 'How do you manage your finances?', 'options': ['Mobile banking app', 'Desktop/laptop', 'In-person at bank', 'I don\'t actively manage'], 'required': True},
            ],
        },
        {
            'name': 'Shopping Preferences',
            'description': 'Quick check for shopping and e-commerce offers',
            'category': 'Shopping',
            'questions': [
                {'type': 'multiple_choice', 'question': 'How often do you shop online?', 'options': ['Multiple times a week', 'Weekly', 'Monthly', 'Rarely'], 'required': True},
                {'type': 'multiple_choice', 'question': 'What do you usually shop for online?', 'options': ['Clothing & Fashion', 'Electronics', 'Home & Garden', 'Groceries'], 'required': True},
            ],
        },
        {
            'name': 'Health & Wellness Check',
            'description': 'Verification for health and fitness offers',
            'category': 'Health',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What health topics interest you most?', 'options': ['Weight management', 'Fitness & exercise', 'Nutrition & supplements', 'Mental wellness'], 'required': True},
                {'type': 'yes_no', 'question': 'Do you currently use any health or fitness apps?', 'required': True},
            ],
        },
        {
            'name': 'Learning Interests',
            'description': 'Quick survey for education and course offers',
            'category': 'Education',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What would you like to learn?', 'options': ['Programming & Tech', 'Business & Marketing', 'Creative skills', 'Languages'], 'required': True},
                {'type': 'multiple_choice', 'question': 'How do you prefer to learn?', 'options': ['Video courses', 'Reading articles', 'Interactive exercises', 'Live classes'], 'required': True},
            ],
        },
        {
            'name': 'Entertainment Preferences',
            'description': 'Verification for streaming and entertainment offers',
            'category': 'Entertainment',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What do you watch or listen to most?', 'options': ['Movies & TV shows', 'Music & podcasts', 'Live sports', 'YouTube/short videos'], 'required': True},
                {'type': 'multiple_choice', 'question': 'How many streaming services do you use?', 'options': ['None', '1-2', '3-4', '5 or more'], 'required': True},
            ],
        },
        {
            'name': 'Tech & Software Check',
            'description': 'Quick verification for technology offers',
            'category': 'Technology',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What device do you use most?', 'options': ['iPhone', 'Android phone', 'Windows PC', 'Mac'], 'required': True},
                {'type': 'multiple_choice', 'question': 'What software interests you?', 'options': ['VPN/Security', 'Productivity tools', 'Cloud storage', 'Design/Creative'], 'required': True},
            ],
        },
        {
            'name': 'Travel Interest Survey',
            'description': 'Verification for travel and booking offers',
            'category': 'Travel',
            'questions': [
                {'type': 'multiple_choice', 'question': 'How often do you travel?', 'options': ['Monthly', 'A few times a year', 'Once a year', 'Rarely'], 'required': True},
                {'type': 'multiple_choice', 'question': 'What type of travel do you prefer?', 'options': ['Beach/Resort', 'City exploration', 'Adventure/Outdoor', 'Cultural/Historical'], 'required': True},
            ],
        },
        {
            'name': 'Dating & Social Check',
            'description': 'Quick verification for dating app offers',
            'category': 'Dating',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What are you looking for?', 'options': ['Serious relationship', 'Casual dating', 'New friends', 'Just browsing'], 'required': True},
                {'type': 'yes_no', 'question': 'Have you used dating apps before?', 'required': True},
            ],
        },
        {
            'name': 'Lifestyle Preferences',
            'description': 'General lifestyle verification survey',
            'category': 'Lifestyle',
            'questions': [
                {'type': 'multiple_choice', 'question': 'What interests you most right now?', 'options': ['Home improvement', 'Cooking & recipes', 'Beauty & skincare', 'Pet care'], 'required': True},
                {'type': 'multiple_choice', 'question': 'How do you spend your free time?', 'options': ['Reading', 'Outdoor activities', 'Social media', 'DIY projects'], 'required': True},
            ],
        },
        {
            'name': 'General Verification',
            'description': 'General-purpose verification survey for any offer type',
            'category': 'General',
            'questions': [
                {'type': 'multiple_choice', 'question': 'How did you find this offer?', 'options': ['Social media', 'Search engine', 'Friend/referral', 'Email/newsletter'], 'required': True},
                {'type': 'multiple_choice', 'question': 'What device are you using right now?', 'options': ['Mobile phone', 'Tablet', 'Laptop', 'Desktop computer'], 'required': True},
            ],
        },
    ]

    count = 0
    for s in surveys:
        s['captcha_enabled'] = True
        model.create_survey(s, created_by='system')
        count += 1
    return count


# ═══════════════════════════════════════════════════════════════════════
# Geo Blocked HTML Template
# ═══════════════════════════════════════════════════════════════════════

GEO_BLOCKED_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Not Available</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#333}
.container{text-align:center;max-width:420px;padding:40px 24px}
.icon{font-size:64px;margin-bottom:20px}
h1{font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e}
p{font-size:14px;color:#666;line-height:1.6;margin-bottom:8px}
.country-tag{display:inline-block;background:#e8e8ff;color:#5b5bd6;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-top:12px}
.footer{margin-top:32px;font-size:10px;color:#bbb}
</style>
</head>
<body>
<div class="container">
<div class="icon">🌍</div>
<h1>This offer is not available in your region</h1>
<p>This offer is only available in specific countries. Your location ({{ user_country }}) is not eligible.</p>
<p class="country-tag">Available in: {{ offer_countries }}</p>
<div class="footer">moustacheleads</div>
</div>
</body>
</html>'''

# Survey Page HTML Template (served to end users)
# ═══════════════════════════════════════════════════════════════════════

SURVEY_PAGE_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ offer_name }}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
min-height:100vh;background:#fafafa;color:#1a1a2e;display:flex;flex-direction:column}
.survey-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;min-height:calc(100vh - 40px)}
.step{display:none;width:100%;max-width:560px;animation:fadeIn .35s ease}
.step.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.progress-bar{width:100%;max-width:560px;height:3px;background:#e5e7eb;border-radius:2px;margin-bottom:40px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#8b5cf6,#6d28d9);border-radius:2px;transition:width .4s ease}
.question{font-size:26px;font-weight:700;color:#111;margin-bottom:36px;line-height:1.35;text-align:center}
.options{display:flex;flex-direction:column;gap:12px;max-width:440px;margin:0 auto}
.opt{display:flex;align-items:center;gap:14px;padding:18px 22px;border:2px solid #e5e7eb;border-radius:14px;
cursor:pointer;transition:all .2s;font-size:16px;color:#374151;background:#fff}
.opt:hover{border-color:#8b5cf6;background:#faf5ff}
.opt.selected{border-color:#8b5cf6;background:#ede9fe;color:#4c1d95;font-weight:600;box-shadow:0 0 0 3px rgba(139,92,246,.12)}
.opt .radio{width:22px;height:22px;border-radius:50%;border:2px solid #d1d5db;display:flex;align-items:center;
justify-content:center;flex-shrink:0;transition:all .2s}
.opt.selected .radio{border-color:#8b5cf6;background:#8b5cf6}
.opt.selected .radio::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}
.yn-row{display:flex;gap:16px;max-width:320px;margin:0 auto}
.yn-btn{flex:1;padding:20px;border:2px solid #e5e7eb;border-radius:14px;cursor:pointer;text-align:center;
font-size:17px;font-weight:600;transition:all .2s;background:#fff;color:#374151}
.yn-btn:hover{border-color:#8b5cf6;background:#faf5ff}
.yn-btn.selected{border-color:#8b5cf6;background:#ede9fe;color:#4c1d95;box-shadow:0 0 0 3px rgba(139,92,246,.12)}
.text-input{width:100%;max-width:440px;margin:0 auto;display:block;padding:18px 22px;border:2px solid #e5e7eb;border-radius:14px;font-size:16px;
outline:none;transition:all .2s;font-family:inherit;background:#fff}
.text-input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.08)}
.captcha-box{background:#f8f5ff;border:2px solid #e9d5ff;border-radius:16px;padding:32px;text-align:center;max-width:440px;margin:0 auto}
.captcha-q{font-size:20px;font-weight:700;color:#1e1b4b;margin-bottom:24px}
.color-grid{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.color-swatch{width:56px;height:56px;border-radius:14px;cursor:pointer;border:3px solid transparent;
transition:all .2s;box-shadow:0 4px 12px rgba(0,0,0,.08)}
.color-swatch:hover{transform:scale(1.1)}
.color-swatch.selected{border-color:#1e1b4b;transform:scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,.15)}
.captcha-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:320px;margin:0 auto}
.captcha-opt{padding:16px;border:2px solid #e5e7eb;border-radius:12px;cursor:pointer;text-align:center;
font-size:16px;font-weight:600;transition:all .2s;background:#fff}
.captcha-opt:hover{border-color:#8b5cf6;background:#faf5ff}
.captcha-opt.selected{border-color:#8b5cf6;background:#ede9fe;color:#4c1d95}
.scramble-input{width:100%;max-width:300px;margin:0 auto;display:block;padding:18px;border:2px solid #e5e7eb;border-radius:14px;font-size:20px;
text-align:center;letter-spacing:4px;text-transform:lowercase;outline:none;font-family:inherit;background:#fff}
.scramble-input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.08)}
.btn-row{display:flex;gap:14px;margin-top:40px;max-width:440px;margin-left:auto;margin-right:auto;justify-content:center}
.btn{padding:14px 32px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;
transition:all .2s;font-family:inherit}
.btn-next{background:#7c3aed;color:#fff;box-shadow:0 4px 16px rgba(124,58,237,.3)}
.btn-next:hover{background:#6d28d9;box-shadow:0 6px 20px rgba(109,40,217,.4);transform:translateY(-1px)}
.btn-next:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
.btn-back{background:#f3f4f6;color:#6b7280}
.btn-back:hover{background:#e5e7eb}
.error-msg{background:#fef2f2;color:#dc2626;padding:14px 18px;border-radius:12px;font-size:13px;
margin-top:16px;display:none;text-align:center;font-weight:500;max-width:440px;margin-left:auto;margin-right:auto}
.success-anim{text-align:center;padding:60px 20px}
.success-anim .check{width:72px;height:72px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;display:flex;
align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px rgba(34,197,94,.3);animation:popIn .4s ease}
@keyframes popIn{from{transform:scale(0)}60%{transform:scale(1.15)}to{transform:scale(1)}}
.honeypot{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.loading{display:inline-block;width:18px;height:18px;border:2px solid #fff;border-top-color:transparent;
border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.footer-brand{text-align:center;padding:12px;font-size:10px;color:#ccc;letter-spacing:.5px}
.footer-brand img{height:14px;opacity:.3;vertical-align:middle;margin-right:4px}
@media(max-width:600px){
.question{font-size:20px;margin-bottom:28px}
.survey-wrap{padding:20px 16px}
.opt{padding:14px 16px;font-size:14px}
.yn-btn{padding:16px;font-size:15px}
}
</style>
</head>
<body>

<div class="survey-wrap">
  <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
  <div id="stepsContainer"></div>
  <div class="error-msg" id="errorMsg"></div>
  <input type="text" class="honeypot" id="hp_field" name="website" tabindex="-1" autocomplete="off">
</div>

<div class="footer-brand">
  <img src="https://moustacheleads.com/logo.png" alt="" onerror="this.style.display='none'" />
  moustacheleads
</div>

<script>
(function(){
  const SURVEY = {{ survey | tojson }};
  const CAPTCHA = {{ captcha | tojson }};
  const CLICK_ID = "{{ click_id }}";
  const CAPTCHA_TOKEN = "{{ captcha_token }}";
  const startTime = Date.now();
  let mouseMoved = false;
  let currentStep = 0;
  let answers = [];
  let captchaAnswer = '';
  let stepTimestamps = [Date.now()];

  document.addEventListener('mousemove', () => { mouseMoved = true; }, { once: true });
  document.addEventListener('touchstart', () => { mouseMoved = true; }, { once: true });

  const questions = SURVEY.questions || [];
  const totalSteps = questions.length + (CAPTCHA ? 1 : 0);
  const container = document.getElementById('stepsContainer');

  function updateCounter() {
    const pct = ((currentStep + 1) / totalSteps) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
  }

  // Build question steps
  questions.forEach((q, idx) => {
    const step = document.createElement('div');
    step.className = 'step';
    step.dataset.idx = idx;
    let html = '<div class="question">' + escHtml(q.question) + '</div>';

    if (q.type === 'multiple_choice') {
      html += '<div class="options">';
      (q.options || []).forEach((opt, oi) => {
        html += '<div class="opt" data-val="' + escAttr(opt) + '" onclick="selectOpt(this,' + idx + ')">' +
                '<div class="radio"></div><span>' + escHtml(opt) + '</span></div>';
      });
      html += '</div>';
    } else if (q.type === 'yes_no') {
      html += '<div class="yn-row">' +
              '<div class="yn-btn" data-val="Yes" onclick="selectYN(this,' + idx + ')">Yes</div>' +
              '<div class="yn-btn" data-val="No" onclick="selectYN(this,' + idx + ')">No</div></div>';
    } else if (q.type === 'short_text') {
      html += '<input type="text" class="text-input" placeholder="Type your answer..." ' +
              'oninput="textAnswer(this,' + idx + ')" maxlength="200">';
    } else if (q.type === 'rating') {
      html += '<div class="options">';
      for (let r = 1; r <= 5; r++) {
        html += '<div class="opt" data-val="' + r + '" onclick="selectOpt(this,' + idx + ')">' +
                '<div class="radio"></div><span>' + r + ' — ' +
                ['Poor','Fair','Good','Very Good','Excellent'][r-1] + '</span></div>';
      }
      html += '</div>';
    }

    html += '<div class="btn-row">';
    if (idx > 0) html += '<button class="btn btn-back" onclick="goBack()">Back</button>';
    html += '<button class="btn btn-next" id="nextBtn' + idx + '" onclick="nextStep()" disabled>Continue</button>';
    html += '</div>';
    step.innerHTML = html;
    container.appendChild(step);
  });

  // Build captcha step
  if (CAPTCHA) {
    const cStep = document.createElement('div');
    cStep.className = 'step';
    cStep.dataset.idx = questions.length;
    let cHtml = '<div class="captcha-box"><div class="captcha-q">' + escHtml(CAPTCHA.question) + '</div>';

    if (CAPTCHA.type === 'color_pick') {
      cHtml += '<div class="color-grid">';
      CAPTCHA.options.forEach(hex => {
        cHtml += '<div class="color-swatch" style="background:' + hex + '" data-val="' + hex + '" ' +
                 'onclick="selectCaptcha(this)"></div>';
      });
      cHtml += '</div>';
    } else if (CAPTCHA.type === 'word_scramble') {
      cHtml += '<input type="text" class="scramble-input" placeholder="Type the word..." ' +
               'oninput="captchaText(this)" maxlength="20">';
    } else {
      // math, pattern, odd_one_out
      cHtml += '<div class="captcha-opts">';
      (CAPTCHA.options || []).forEach(opt => {
        cHtml += '<div class="captcha-opt" data-val="' + escAttr(opt) + '" ' +
                 'onclick="selectCaptcha(this)">' + escHtml(opt) + '</div>';
      });
      cHtml += '</div>';
    }
    cHtml += '</div>';
    cHtml += '<div class="btn-row">';
    cHtml += '<button class="btn btn-back" onclick="goBack()">Back</button>';
    cHtml += '<button class="btn btn-next" id="submitBtn" onclick="submitSurvey()" disabled>Continue</button>';
    cHtml += '</div>';
    cStep.innerHTML = cHtml;
    container.appendChild(cStep);
  }

  showStep(0);

  function showStep(idx) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const step = document.querySelector('.step[data-idx="' + idx + '"]');
    if (step) step.classList.add('active');
    currentStep = idx;
    stepTimestamps.push(Date.now());
    updateCounter();
  }

  window.selectOpt = function(el, qIdx) {
    el.parentElement.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    answers[qIdx] = { question_index: qIdx, answer: el.dataset.val, time_spent_ms: Date.now() - stepTimestamps[stepTimestamps.length - 1] };
    const btn = document.getElementById('nextBtn' + qIdx);
    if (btn) btn.disabled = false;
  };

  window.selectYN = function(el, qIdx) {
    el.parentElement.querySelectorAll('.yn-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    answers[qIdx] = { question_index: qIdx, answer: el.dataset.val, time_spent_ms: Date.now() - stepTimestamps[stepTimestamps.length - 1] };
    const btn = document.getElementById('nextBtn' + qIdx);
    if (btn) btn.disabled = false;
  };

  window.textAnswer = function(el, qIdx) {
    answers[qIdx] = { question_index: qIdx, answer: el.value, time_spent_ms: Date.now() - stepTimestamps[stepTimestamps.length - 1] };
    const btn = document.getElementById('nextBtn' + qIdx);
    if (btn) btn.disabled = el.value.trim().length === 0;
  };

  window.selectCaptcha = function(el) {
    el.parentElement.querySelectorAll('.captcha-opt,.color-swatch').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    captchaAnswer = el.dataset.val;
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = false;
  };

  window.captchaText = function(el) {
    captchaAnswer = el.value.trim().toLowerCase();
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = captchaAnswer.length === 0;
  };

  window.nextStep = function() {
    if (currentStep < totalSteps - 1) showStep(currentStep + 1);
  };

  window.goBack = function() {
    if (currentStep > 0) showStep(currentStep - 1);
  };

  window.submitSurvey = function() {
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>Please wait...';
    document.getElementById('errorMsg').style.display = 'none';

    const payload = {
      survey_id: SURVEY._id || '',
      answers: answers.filter(Boolean),
      captcha_answer: captchaAnswer,
      captcha_token: CAPTCHA_TOKEN,
      captcha_type: CAPTCHA ? CAPTCHA.type : '',
      total_time_ms: Date.now() - startTime,
      honeypot_filled: document.getElementById('hp_field').value.length > 0,
      mouse_moved: mouseMoved,
    };

    fetch('/survey/' + CLICK_ID + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(res => {
      if (res.success && res.redirect_url) {
        container.innerHTML = '<div class="success-anim">' +
          '<div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
          '<polyline points="20 6 9 17 4 12"></polyline></svg></div></div>';
        setTimeout(() => { window.location.href = res.redirect_url; }, 800);
      } else {
        document.getElementById('errorMsg').textContent = res.error || 'Something went wrong';
        document.getElementById('errorMsg').style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Continue';
        // Reload page for new captcha on retry
        if (res.retry) {
          setTimeout(() => { window.location.reload(); }, 2000);
        }
      }
    })
    .catch(() => {
      document.getElementById('errorMsg').textContent = 'Network error. Please try again.';
      document.getElementById('errorMsg').style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Continue';
    });
  };

  function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();
</script>
</body>
</html>'''
