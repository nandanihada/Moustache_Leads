"""
Admin Survey Builder API
Provides survey creation (manual + AI-generated), management, and public submission endpoints.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging
import re

logger = logging.getLogger(__name__)

admin_surveys_bp = Blueprint('admin_surveys_bp', __name__)


def serialize_survey(doc):
    """Serialize a survey document for JSON response."""
    if doc is None:
        return None
    doc['_id'] = str(doc['_id'])
    if 'created_by' in doc and isinstance(doc.get('created_by'), ObjectId):
        doc['created_by'] = str(doc['created_by'])
    if 'created_at' in doc and isinstance(doc.get('created_at'), datetime):
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
    return doc


def serialize_response(doc):
    """Serialize a survey response document for JSON response."""
    if doc is None:
        return None
    doc['_id'] = str(doc['_id'])
    if 'survey_id' in doc and isinstance(doc.get('survey_id'), ObjectId):
        doc['survey_id'] = str(doc['survey_id'])
    if 'completed_at' in doc and isinstance(doc.get('completed_at'), datetime):
        doc['completed_at'] = doc['completed_at'].isoformat() + 'Z'
    return doc


def generate_questions_from_prompt(prompt):
    """
    Rule-based survey question generator.
    Parses the prompt for keywords and generates appropriate questions.
    """
    prompt_lower = prompt.lower()
    questions = []
    q_counter = 1

    # Age detection
    if any(word in prompt_lower for word in ['age', 'old', 'year', 'young', 'senior', 'adult']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What is your age range?",
            "type": "mcq",
            "options": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
            "required": True
        })
        q_counter += 1

    # Gender detection
    if any(word in prompt_lower for word in ['gender', 'male', 'female', 'sex']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What is your gender?",
            "type": "mcq",
            "options": ["Male", "Female", "Non-binary", "Prefer not to say"],
            "required": True
        })
        q_counter += 1

    # Income detection
    if any(word in prompt_lower for word in ['income', 'salary', 'earn', 'money', 'financial', 'wealth']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What is your annual household income?",
            "type": "mcq",
            "options": ["Under $25,000", "$25,000-$49,999", "$50,000-$74,999", "$75,000-$99,999", "$100,000-$149,999", "$150,000+"],
            "required": True
        })
        q_counter += 1

    # Location/country detection
    if any(word in prompt_lower for word in ['location', 'country', 'region', 'state', 'city', 'where', 'geo']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What country do you currently reside in?",
            "type": "text",
            "options": [],
            "required": True
        })
        q_counter += 1

    # Interest/category detection
    if any(word in prompt_lower for word in ['interest', 'category', 'hobby', 'like', 'prefer', 'favorite']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "Which categories interest you the most?",
            "type": "mcq",
            "options": ["Technology", "Health & Fitness", "Finance", "Entertainment", "Shopping", "Travel", "Education", "Food & Dining"],
            "required": True
        })
        q_counter += 1

    # Employment detection
    if any(word in prompt_lower for word in ['employ', 'job', 'work', 'career', 'occupation', 'profession']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What is your current employment status?",
            "type": "mcq",
            "options": ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Student", "Retired"],
            "required": True
        })
        q_counter += 1

    # Education detection
    if any(word in prompt_lower for word in ['education', 'degree', 'school', 'college', 'university', 'study']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "What is your highest level of education?",
            "type": "mcq",
            "options": ["High school", "Some college", "Bachelor's degree", "Master's degree", "Doctorate", "Trade/vocational"],
            "required": True
        })
        q_counter += 1

    # Health/insurance detection
    if any(word in prompt_lower for word in ['health', 'insurance', 'medical', 'doctor', 'wellness']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "Do you currently have health insurance?",
            "type": "yes_no",
            "options": ["Yes", "No"],
            "required": True
        })
        q_counter += 1

    # Homeowner detection
    if any(word in prompt_lower for word in ['home', 'house', 'rent', 'own', 'property', 'mortgage']):
        questions.append({
            "id": f"q{q_counter}",
            "text": "Do you own or rent your home?",
            "type": "mcq",
            "options": ["Own", "Rent", "Live with family", "Other"],
            "required": True
        })
        q_counter += 1

    # If no keywords matched, generate generic qualification questions
    if len(questions) == 0:
        questions = [
            {
                "id": "q1",
                "text": "What is your age range?",
                "type": "mcq",
                "options": ["18-24", "25-34", "35-44", "45-54", "55+"],
                "required": True
            },
            {
                "id": "q2",
                "text": "What is your gender?",
                "type": "mcq",
                "options": ["Male", "Female", "Non-binary", "Prefer not to say"],
                "required": True
            },
            {
                "id": "q3",
                "text": "What are your primary interests?",
                "type": "mcq",
                "options": ["Technology", "Health", "Finance", "Entertainment", "Shopping", "Travel"],
                "required": True
            }
        ]

    # Ensure at least 2 questions
    if len(questions) < 2:
        if not any(q['text'].startswith("What is your age") for q in questions):
            questions.append({
                "id": f"q{len(questions) + 1}",
                "text": "What is your age range?",
                "type": "mcq",
                "options": ["18-24", "25-34", "35-44", "45-54", "55+"],
                "required": True
            })

    # Cap at 6 questions max
    questions = questions[:6]

    return questions


# ============================================================
# ADMIN ENDPOINTS (require authentication)
# ============================================================

@admin_surveys_bp.route('/surveys', methods=['GET'])
@token_required
def list_surveys():
    """List all surveys with pagination and search."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Pagination params
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '').strip()

        # Build query
        query = {}
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}
        if status_filter:
            query['status'] = status_filter

        # Get total count
        total = collection.count_documents(query)

        # Fetch surveys with pagination
        skip = (page - 1) * per_page
        surveys = list(collection.find(query).sort('created_at', -1).skip(skip).limit(per_page))

        # Get response counts for each survey
        responses_collection = db_instance.get_collection('survey_responses')
        for survey in surveys:
            if responses_collection is not None:
                survey['response_count'] = responses_collection.count_documents({'survey_id': survey['_id']})
            else:
                survey['response_count'] = 0
            serialize_survey(survey)

        return jsonify({
            'success': True,
            'surveys': surveys,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.error(f"Error listing surveys: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys', methods=['POST'])
@token_required
def create_survey():
    """Create a new survey manually."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Survey name is required'}), 400

        questions = data.get('questions', [])
        if not questions:
            return jsonify({'error': 'At least one question is required'}), 400

        # Build survey document
        survey_doc = {
            'name': name,
            'description': data.get('description', ''),
            'type': data.get('type', 'manual'),
            'status': data.get('status', 'draft'),
            'questions': questions,
            'placement': data.get('placement', 'offerwall_card'),
            'target_offer_ids': data.get('target_offer_ids', []),
            'target_subwall_id': data.get('target_subwall_id', None),
            'image_url': data.get('image_url', ''),
            'created_at': datetime.utcnow(),
            'created_by': str(request.current_user.get('_id', '')) if hasattr(request, 'current_user') and request.current_user else None,
            'ai_prompt': data.get('ai_prompt', None)
        }

        result = collection.insert_one(survey_doc)
        survey_doc['_id'] = str(result.inserted_id)
        if isinstance(survey_doc.get('created_at'), datetime):
            survey_doc['created_at'] = survey_doc['created_at'].isoformat() + 'Z'

        return jsonify({
            'success': True,
            'survey': survey_doc,
            'message': 'Survey created successfully'
        }), 201

    except Exception as e:
        logger.error(f"Error creating survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/generate', methods=['POST'])
@token_required
def generate_survey():
    """AI-generate a survey from a text prompt (rule-based)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        prompt = data.get('prompt', '').strip()
        name = data.get('name', '').strip()

        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        if not name:
            return jsonify({'error': 'Survey name is required'}), 400

        # Generate questions from prompt
        questions = generate_questions_from_prompt(prompt)

        # Return generated survey (not saved — admin reviews first)
        generated_survey = {
            'name': name,
            'description': f'AI-generated survey based on prompt: {prompt[:100]}',
            'type': 'ai_generated',
            'status': 'draft',
            'questions': questions,
            'placement': 'before_wall',
            'target_offer_ids': [],
            'ai_prompt': prompt
        }

        return jsonify({
            'success': True,
            'survey': generated_survey,
            'message': f'Generated {len(questions)} questions from prompt'
        }), 200

    except Exception as e:
        logger.error(f"Error generating survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/<survey_id>', methods=['GET'])
@token_required
def get_survey(survey_id):
    """Get a single survey by ID."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        survey = collection.find_one({'_id': obj_id})
        if not survey:
            return jsonify({'error': 'Survey not found'}), 404

        serialize_survey(survey)
        return jsonify({'success': True, 'survey': survey}), 200

    except Exception as e:
        logger.error(f"Error getting survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/<survey_id>', methods=['PUT'])
@token_required
def update_survey(survey_id):
    """Update an existing survey."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Build update fields
        update_fields = {}
        allowed_fields = ['name', 'description', 'status', 'questions', 'placement', 'target_offer_ids', 'target_subwall_id', 'image_url']
        for field in allowed_fields:
            if field in data:
                update_fields[field] = data[field]

        if not update_fields:
            return jsonify({'error': 'No valid fields to update'}), 400

        update_fields['updated_at'] = datetime.utcnow()

        result = collection.update_one({'_id': obj_id}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'error': 'Survey not found'}), 404

        return jsonify({'success': True, 'message': 'Survey updated successfully'}), 200

    except Exception as e:
        logger.error(f"Error updating survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/<survey_id>', methods=['DELETE'])
@token_required
def delete_survey(survey_id):
    """Delete a survey."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        result = collection.delete_one({'_id': obj_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Survey not found'}), 404

        # Also delete associated responses
        responses_collection = db_instance.get_collection('survey_responses')
        if responses_collection is not None:
            responses_collection.delete_many({'survey_id': obj_id})

        return jsonify({'success': True, 'message': 'Survey deleted successfully'}), 200

    except Exception as e:
        logger.error(f"Error deleting survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/<survey_id>/responses', methods=['GET'])
@token_required
def get_survey_responses(survey_id):
    """Get all responses for a survey."""
    try:
        responses_collection = db_instance.get_collection('survey_responses')
        if responses_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        skip = (page - 1) * per_page

        total = responses_collection.count_documents({'survey_id': obj_id})
        responses = list(
            responses_collection.find({'survey_id': obj_id})
            .sort('completed_at', -1)
            .skip(skip)
            .limit(per_page)
        )

        for resp in responses:
            serialize_response(resp)

        return jsonify({
            'success': True,
            'responses': responses,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.error(f"Error getting survey responses: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================================
# PUBLIC ENDPOINTS (no auth required)
# ============================================================

@admin_surveys_bp.route('/surveys/public/<survey_id>', methods=['GET'])
def get_public_survey(survey_id):
    """Get survey questions for end user to fill (no auth)."""
    try:
        collection = db_instance.get_collection('surveys')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        survey = collection.find_one({'_id': obj_id, 'status': 'active'})
        if not survey:
            return jsonify({'error': 'Survey not found or inactive'}), 404

        # Return only public-facing fields
        public_survey = {
            '_id': str(survey['_id']),
            'name': survey.get('name', ''),
            'description': survey.get('description', ''),
            'questions': survey.get('questions', []),
            'placement': survey.get('placement', 'offerwall_card'),
            'image_url': survey.get('image_url', ''),
            'public_link': f"/survey/{str(survey['_id'])}"
        }

        return jsonify({'success': True, 'survey': public_survey}), 200

    except Exception as e:
        logger.error(f"Error getting public survey: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_surveys_bp.route('/surveys/public/<survey_id>/submit', methods=['POST'])
def submit_survey_response(survey_id):
    """Submit survey answers (no auth — end user submission)."""
    try:
        collection = db_instance.get_collection('surveys')
        responses_collection = db_instance.get_collection('survey_responses')
        if collection is None or responses_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(survey_id)
        except Exception:
            return jsonify({'error': 'Invalid survey ID'}), 400

        # Verify survey exists and is active
        survey = collection.find_one({'_id': obj_id, 'status': 'active'})
        if not survey:
            return jsonify({'error': 'Survey not found or inactive'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        answers = data.get('answers', [])
        if not answers:
            return jsonify({'error': 'No answers provided'}), 400

        user_id = data.get('user_id', 'anonymous')
        time_spent = data.get('time_spent_seconds', 0)

        # Build response document
        response_doc = {
            'survey_id': obj_id,
            'user_id': user_id,
            'answers': answers,
            'completed_at': datetime.utcnow(),
            'time_spent_seconds': time_spent,
            'qualified': True  # Default — can be updated by rules later
        }

        result = responses_collection.insert_one(response_doc)

        return jsonify({
            'success': True,
            'message': 'Survey submitted successfully',
            'response_id': str(result.inserted_id)
        }), 201

    except Exception as e:
        logger.error(f"Error submitting survey response: {str(e)}")
        return jsonify({'error': str(e)}), 500
