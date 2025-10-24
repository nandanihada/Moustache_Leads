"""
Offer Schedule and Smart Rules API Routes
Handles CRUD operations for offer scheduling and smart rules management
"""

from flask import Blueprint, request, jsonify
from models.offer_extended import OfferExtended
from utils.auth import token_required
from utils.frontend_mapping import frontend_to_database, database_to_frontend, validate_frontend_data
from bson import ObjectId
from datetime import datetime
import logging

def convert_objectids_to_strings(obj):
    """Recursively convert ObjectId objects to strings in a dictionary or list"""
    if isinstance(obj, dict):
        return {key: convert_objectids_to_strings(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectids_to_strings(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj

# Create blueprint
schedule_rules_bp = Blueprint('offer_schedule_rules', __name__)
offer_model = OfferExtended()

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def validate_offer_exists(offer_id):
    """Helper function to validate offer exists"""
    try:
        if not offer_model._check_db_connection():
            return None, "Database connection not available"
        
        offer = offer_model.collection.find_one({'offer_id': offer_id, 'is_active': True})
        if not offer:
            return None, "Offer not found"
        
        return offer, None
    except Exception as e:
        return None, f"Error validating offer: {str(e)}"

# ============================================================================
# SCHEDULE ROUTES
# ============================================================================

@schedule_rules_bp.route('/offers/<offer_id>/schedule', methods=['POST'])
@token_required
@admin_required
def create_offer_schedule(offer_id):
    """Create or update offer schedule"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get schedule data from request
        data = request.get_json()
        if not data or 'schedule' not in data:
            return jsonify({'error': 'Schedule data is required'}), 400
        
        schedule_data = data['schedule']
        
        # Validate frontend schedule data
        is_valid, validation_errors = validate_frontend_data({'schedule': schedule_data})
        if not is_valid:
            return jsonify({
                'error': 'Schedule validation failed',
                'details': validation_errors
            }), 400
        
        # Map frontend data to database format
        mapped_data = frontend_to_database({'schedule': schedule_data})
        db_schedule = mapped_data['schedule']
        
        # Update offer with new schedule
        result = offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$set': {
                    'schedule': db_schedule,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to update schedule'}), 500
        
        # Return the created/updated schedule in frontend format
        frontend_schedule = database_to_frontend({'schedule': db_schedule})['schedule']
        
        return jsonify({
            'message': 'Schedule created/updated successfully',
            'schedule': frontend_schedule
        }), 201
        
    except Exception as e:
        logging.error(f"Create schedule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create schedule: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/<offer_id>/schedule', methods=['GET'])
@token_required
@admin_required
def get_offer_schedule(offer_id):
    """Get offer schedule"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get schedule from offer
        db_schedule = offer.get('schedule', {})
        
        # Convert to frontend format
        if db_schedule:
            frontend_data = database_to_frontend({'schedule': db_schedule})
            schedule = frontend_data['schedule']
        else:
            # Return default empty schedule
            schedule = {
                'startDate': None,
                'endDate': None,
                'startTime': '',
                'endTime': '',
                'isRecurring': False,
                'weekdays': [],
                'status': 'Active'
            }
        
        return jsonify({
            'schedule': schedule,
            'offer_id': offer_id
        }), 200
        
    except Exception as e:
        logging.error(f"Get schedule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get schedule: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/<offer_id>/schedule', methods=['PUT'])
@token_required
@admin_required
def update_offer_schedule(offer_id):
    """Update offer schedule"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get schedule data from request
        data = request.get_json()
        if not data or 'schedule' not in data:
            return jsonify({'error': 'Schedule data is required'}), 400
        
        schedule_data = data['schedule']
        
        # Validate frontend schedule data
        is_valid, validation_errors = validate_frontend_data({'schedule': schedule_data})
        if not is_valid:
            return jsonify({
                'error': 'Schedule validation failed',
                'details': validation_errors
            }), 400
        
        # Map frontend data to database format
        mapped_data = frontend_to_database({'schedule': schedule_data})
        db_schedule = mapped_data['schedule']
        
        # Update offer schedule
        result = offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$set': {
                    'schedule': db_schedule,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'No changes made to schedule'}), 400
        
        # Return updated schedule in frontend format
        frontend_schedule = database_to_frontend({'schedule': db_schedule})['schedule']
        
        return jsonify({
            'message': 'Schedule updated successfully',
            'schedule': frontend_schedule
        }), 200
        
    except Exception as e:
        logging.error(f"Update schedule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update schedule: {str(e)}'}), 500

# ============================================================================
# SMART RULES ROUTES
# ============================================================================

@schedule_rules_bp.route('/offers/<offer_id>/smart-rules', methods=['POST'])
@token_required
@admin_required
def create_smart_rule(offer_id):
    """Add a new smart rule to an offer"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get rule data from request
        data = request.get_json()
        if not data or 'rule' not in data:
            return jsonify({'error': 'Smart rule data is required'}), 400
        
        rule_data = data['rule']
        
        # Validate frontend rule data
        is_valid, validation_errors = validate_frontend_data({'smartRules': [rule_data]})
        if not is_valid:
            return jsonify({
                'error': 'Smart rule validation failed',
                'details': validation_errors
            }), 400
        
        # Map frontend data to database format
        mapped_data = frontend_to_database({'smartRules': [rule_data]})
        db_rule = mapped_data['smartRules'][0]
        
        # Generate ObjectId for the rule
        db_rule['_id'] = ObjectId()
        db_rule['createdAt'] = datetime.utcnow()
        
        # Check for duplicate priorities
        existing_rules = offer.get('smartRules', [])
        existing_priorities = [rule.get('priority') for rule in existing_rules]
        
        if db_rule['priority'] in existing_priorities:
            return jsonify({
                'error': f'Priority {db_rule["priority"]} already exists. Please use a unique priority.'
            }), 400
        
        # Add rule to offer
        result = offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$push': {'smartRules': db_rule},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to add smart rule'}), 500
        
        # Return created rule in frontend format
        frontend_rule = database_to_frontend({'smartRules': [db_rule]})['smartRules'][0]
        
        return jsonify({
            'message': 'Smart rule created successfully',
            'rule': frontend_rule
        }), 201
        
    except Exception as e:
        logging.error(f"Create smart rule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create smart rule: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/<offer_id>/smart-rules', methods=['GET'])
@token_required
@admin_required
def get_smart_rules(offer_id):
    """Get all smart rules for an offer"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get smart rules from offer
        db_rules = offer.get('smartRules', [])
        
        # Convert to frontend format
        if db_rules:
            frontend_data = database_to_frontend({'smartRules': db_rules})
            rules = frontend_data['smartRules']
        else:
            rules = []
        
        # Sort by priority
        rules.sort(key=lambda x: x.get('priority', 999))
        
        return jsonify({
            'smartRules': rules,
            'total': len(rules),
            'offer_id': offer_id
        }), 200
        
    except Exception as e:
        logging.error(f"Get smart rules error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get smart rules: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/<offer_id>/smart-rules/<rule_id>', methods=['PUT'])
@token_required
@admin_required
def update_smart_rule(offer_id, rule_id):
    """Update a specific smart rule"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Get rule data from request
        data = request.get_json()
        if not data or 'rule' not in data:
            return jsonify({'error': 'Smart rule data is required'}), 400
        
        rule_data = data['rule']
        
        # Validate frontend rule data
        is_valid, validation_errors = validate_frontend_data({'smartRules': [rule_data]})
        if not is_valid:
            return jsonify({
                'error': 'Smart rule validation failed',
                'details': validation_errors
            }), 400
        
        # Map frontend data to database format
        mapped_data = frontend_to_database({'smartRules': [rule_data]})
        db_rule = mapped_data['smartRules'][0]
        
        # Validate rule_id is valid ObjectId
        try:
            rule_object_id = ObjectId(rule_id)
        except:
            return jsonify({'error': 'Invalid rule ID format'}), 400
        
        # Check if rule exists
        existing_rules = offer.get('smartRules', [])
        rule_exists = any(str(rule.get('_id')) == rule_id for rule in existing_rules)
        
        if not rule_exists:
            return jsonify({'error': 'Smart rule not found'}), 404
        
        # Check for duplicate priorities (excluding current rule)
        existing_priorities = [
            rule.get('priority') for rule in existing_rules 
            if str(rule.get('_id')) != rule_id
        ]
        
        if db_rule['priority'] in existing_priorities:
            return jsonify({
                'error': f'Priority {db_rule["priority"]} already exists. Please use a unique priority.'
            }), 400
        
        # Update the specific rule
        update_fields = {}
        for field, value in db_rule.items():
            if field != '_id':  # Don't update the _id field
                update_fields[f'smartRules.$.{field}'] = value
        
        update_fields['updated_at'] = datetime.utcnow()
        
        result = offer_model.collection.update_one(
            {
                'offer_id': offer_id,
                'smartRules._id': rule_object_id
            },
            {'$set': update_fields}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'No changes made to smart rule'}), 400
        
        # Return updated rule in frontend format
        db_rule['_id'] = rule_object_id
        frontend_rule = database_to_frontend({'smartRules': [db_rule]})['smartRules'][0]
        
        return jsonify({
            'message': 'Smart rule updated successfully',
            'rule': frontend_rule
        }), 200
        
    except Exception as e:
        logging.error(f"Update smart rule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update smart rule: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/<offer_id>/smart-rules/<rule_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_smart_rule(offer_id, rule_id):
    """Delete a specific smart rule"""
    try:
        # Validate offer exists
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Validate rule_id is valid ObjectId
        try:
            rule_object_id = ObjectId(rule_id)
        except:
            return jsonify({'error': 'Invalid rule ID format'}), 400
        
        # Check if rule exists
        existing_rules = offer.get('smartRules', [])
        rule_exists = any(str(rule.get('_id')) == rule_id for rule in existing_rules)
        
        if not rule_exists:
            return jsonify({'error': 'Smart rule not found'}), 404
        
        # Remove the rule
        result = offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$pull': {'smartRules': {'_id': rule_object_id}},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to delete smart rule'}), 500
        
        return jsonify({
            'message': 'Smart rule deleted successfully',
            'rule_id': rule_id
        }), 200
        
    except Exception as e:
        logging.error(f"Delete smart rule error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete smart rule: {str(e)}'}), 500

# ============================================================================
# ACTIVATION AND STATUS ROUTES
# ============================================================================

@schedule_rules_bp.route('/offers/<offer_id>/activation-check', methods=['GET'])
@token_required
def check_offer_activation(offer_id):
    """Check if offer is currently active based on schedule and rules"""
    try:
        # Validate offer exists (allow non-admin access for activation checks)
        offer, error = validate_offer_exists(offer_id)
        if error:
            return jsonify({'error': error}), 404 if "not found" in error else 500
        
        # Check basic offer status
        if offer.get('status') != 'Active' or not offer.get('is_active', True):
            return jsonify({
                'active': False,
                'reason': 'Offer is not active',
                'offer_id': offer_id
            }), 200
        
        # Check schedule activation
        schedule = offer.get('schedule', {})
        schedule_active = True
        schedule_reason = None
        
        if schedule:
            now = datetime.utcnow()
            
            # Check schedule status
            if schedule.get('status') != 'Active':
                schedule_active = False
                schedule_reason = 'Schedule is paused'
            
            # Check date range
            elif schedule.get('startAt') and now < schedule.get('startAt'):
                schedule_active = False
                schedule_reason = 'Offer has not started yet'
            
            elif schedule.get('endAt') and now > schedule.get('endAt'):
                schedule_active = False
                schedule_reason = 'Offer has expired'
            
            # Check recurring days
            elif schedule.get('isRecurring') and schedule.get('recurringDays'):
                day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                current_day = day_names[now.weekday()]
                
                if current_day not in schedule.get('recurringDays', []):
                    schedule_active = False
                    schedule_reason = f'Offer not active on {current_day}'
        
        # Check smart rules
        smart_rules = offer.get('smartRules', [])
        active_rules = [rule for rule in smart_rules if rule.get('active', True)]
        
        # Get rule statistics
        rule_stats = {
            'total_rules': len(smart_rules),
            'active_rules': len(active_rules),
            'rule_types': {}
        }
        
        for rule in active_rules:
            rule_type = rule.get('type', 'Unknown')
            rule_stats['rule_types'][rule_type] = rule_stats['rule_types'].get(rule_type, 0) + 1
        
        # Determine overall activation status
        is_active = schedule_active and len(active_rules) > 0
        
        reasons = []
        if not schedule_active and schedule_reason:
            reasons.append(schedule_reason)
        if len(active_rules) == 0:
            reasons.append('No active smart rules configured')
        
        return jsonify({
            'active': is_active,
            'reasons': reasons if not is_active else [],
            'schedule_active': schedule_active,
            'rules_active': len(active_rules) > 0,
            'rule_stats': rule_stats,
            'offer_id': offer_id,
            'checked_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logging.error(f"Check activation error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to check activation: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/active-with-schedule', methods=['GET'])
@token_required
def get_active_offers_with_schedule():
    """Get all currently active offers considering their schedules"""
    try:
        # Use the extended model method
        active_offers = offer_model.get_active_offers_with_schedule()
        
        # Convert to frontend format
        frontend_offers = []
        for offer in active_offers:
            # Convert ObjectIds to strings
            offer = convert_objectids_to_strings(offer)
            
            # Convert schedule and smart rules to frontend format
            if 'schedule' in offer or 'smartRules' in offer:
                frontend_data = database_to_frontend(offer)
                offer.update(frontend_data)
            
            frontend_offers.append(offer)
        
        return jsonify({
            'offers': frontend_offers,
            'total': len(frontend_offers),
            'checked_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logging.error(f"Get active offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get active offers: {str(e)}'}), 500

@schedule_rules_bp.route('/offers/geo/<country_code>', methods=['GET'])
@token_required
def get_offers_by_geo(country_code):
    """Get offers with active GEO rules for specific country"""
    try:
        # Validate country code
        if not country_code or len(country_code) != 2:
            return jsonify({'error': 'Invalid country code. Must be 2-letter ISO code.'}), 400
        
        # Use the extended model method
        geo_offers = offer_model.get_offers_by_geo_rules(country_code.upper())
        
        # Convert to frontend format
        frontend_offers = []
        for offer in geo_offers:
            # Convert ObjectIds to strings
            offer = convert_objectids_to_strings(offer)
            
            # Convert schedule and smart rules to frontend format
            if 'schedule' in offer or 'smartRules' in offer:
                frontend_data = database_to_frontend(offer)
                offer.update(frontend_data)
            
            frontend_offers.append(offer)
        
        return jsonify({
            'offers': frontend_offers,
            'total': len(frontend_offers),
            'country_code': country_code.upper(),
            'checked_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logging.error(f"Get geo offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get geo offers: {str(e)}'}), 500
