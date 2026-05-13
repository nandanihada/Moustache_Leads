"""
Admin Sub-Walls API
Provides sub-wall creation, management, and public endpoints for curated offer collections.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging
import re

logger = logging.getLogger(__name__)

admin_sub_walls_bp = Blueprint('admin_sub_walls_bp', __name__)


def serialize_sub_wall(doc):
    """Serialize a sub-wall document for JSON response."""
    if doc is None:
        return None
    doc['_id'] = str(doc['_id'])
    if 'created_by' in doc and isinstance(doc.get('created_by'), ObjectId):
        doc['created_by'] = str(doc['created_by'])
    if 'created_at' in doc and isinstance(doc.get('created_at'), datetime):
        doc['created_at'] = doc['created_at'].isoformat() + 'Z'
    if 'pre_screening_survey_id' in doc and isinstance(doc.get('pre_screening_survey_id'), ObjectId):
        doc['pre_screening_survey_id'] = str(doc['pre_screening_survey_id'])
    return doc


def generate_slug(name):
    """Generate a URL-friendly slug from a name."""
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


# ============================================================
# ADMIN ENDPOINTS (require authentication)
# ============================================================

@admin_sub_walls_bp.route('/sub-walls', methods=['GET'])
@token_required
def list_sub_walls():
    """List all sub-walls."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '').strip()

        query = {}
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}
        if status_filter:
            query['status'] = status_filter

        total = collection.count_documents(query)
        sub_walls = list(collection.find(query).sort('display_order', 1))

        for sw in sub_walls:
            serialize_sub_wall(sw)

        return jsonify({
            'success': True,
            'sub_walls': sub_walls,
            'total': total
        }), 200

    except Exception as e:
        logger.error(f"Error listing sub-walls: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls', methods=['POST'])
@token_required
def create_sub_wall():
    """Create a new sub-wall."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Sub-wall name is required'}), 400

        slug = data.get('slug', '').strip() or generate_slug(name)

        # Check slug uniqueness
        existing = collection.find_one({'slug': slug})
        if existing:
            return jsonify({'error': f'Slug "{slug}" already exists'}), 400

        sub_wall_doc = {
            'name': name,
            'slug': slug,
            'description': data.get('description', ''),
            'image_url': data.get('image_url', ''),
            'offer_ids': data.get('offer_ids', []),
            'pre_screening_enabled': data.get('pre_screening_enabled', False),
            'pre_screening_survey_id': data.get('pre_screening_survey_id', None),
            'filter_by_answers': data.get('filter_by_answers', False),
            'filter_rules': data.get('filter_rules', {}),
            'visibility': data.get('visibility', 'everyone'),  # everyone | specific_publishers | by_country | link_only
            'visible_to_publishers': data.get('visible_to_publishers', []),  # publisher user_ids
            'visible_countries': data.get('visible_countries', []),  # country codes
            'status': data.get('status', 'draft'),
            'display_order': data.get('display_order', 0),
            # Customization fields
            'heading_text': data.get('heading_text', ''),
            'theme_color': data.get('theme_color', '#6366f1'),
            'banner_image': data.get('banner_image', ''),
            'button_text': data.get('button_text', 'Click to Earn'),
            'survey_frequency': data.get('survey_frequency', 'every_time'),
            'created_at': datetime.utcnow(),
            'created_by': str(request.current_user.get('_id', '')) if hasattr(request, 'current_user') and request.current_user else None
        }

        result = collection.insert_one(sub_wall_doc)
        sub_wall_doc['_id'] = str(result.inserted_id)
        if isinstance(sub_wall_doc.get('created_at'), datetime):
            sub_wall_doc['created_at'] = sub_wall_doc['created_at'].isoformat() + 'Z'

        return jsonify({
            'success': True,
            'sub_wall': sub_wall_doc,
            'message': 'Sub-wall created successfully'
        }), 201

    except Exception as e:
        logger.error(f"Error creating sub-wall: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls/generate-slug', methods=['POST'])
@token_required
def generate_slug_endpoint():
    """Generate a slug from a name (utility endpoint)."""
    try:
        data = request.get_json()
        name = data.get('name', '').strip() if data else ''
        if not name:
            return jsonify({'error': 'Name is required'}), 400

        slug = generate_slug(name)

        # Check uniqueness
        collection = db_instance.get_collection('sub_walls')
        if collection is not None:
            existing = collection.find_one({'slug': slug})
            if existing:
                slug = f"{slug}-{int(datetime.utcnow().timestamp())}"

        return jsonify({'success': True, 'slug': slug}), 200

    except Exception as e:
        logger.error(f"Error generating slug: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls/<sub_wall_id>', methods=['GET'])
@token_required
def get_sub_wall(sub_wall_id):
    """Get a single sub-wall by ID."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(sub_wall_id)
        except Exception:
            return jsonify({'error': 'Invalid sub-wall ID'}), 400

        sub_wall = collection.find_one({'_id': obj_id})
        if not sub_wall:
            return jsonify({'error': 'Sub-wall not found'}), 404

        serialize_sub_wall(sub_wall)
        return jsonify({'success': True, 'sub_wall': sub_wall}), 200

    except Exception as e:
        logger.error(f"Error getting sub-wall: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls/<sub_wall_id>', methods=['PUT'])
@token_required
def update_sub_wall(sub_wall_id):
    """Update an existing sub-wall."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(sub_wall_id)
        except Exception:
            return jsonify({'error': 'Invalid sub-wall ID'}), 400

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Build update fields
        update_fields = {}
        allowed_fields = [
            'name', 'slug', 'description', 'image_url', 'offer_ids',
            'pre_screening_enabled', 'pre_screening_survey_id',
            'filter_by_answers', 'filter_rules', 'status', 'display_order',
            'visibility', 'visible_to_publishers', 'visible_countries',
            'heading_text', 'theme_color', 'banner_image', 'button_text',
            'survey_frequency'
        ]
        for field in allowed_fields:
            if field in data:
                update_fields[field] = data[field]

        if not update_fields:
            return jsonify({'error': 'No valid fields to update'}), 400

        # If name changed, regenerate slug if slug not explicitly provided
        if 'name' in update_fields and 'slug' not in update_fields:
            update_fields['slug'] = generate_slug(update_fields['name'])

        # Check slug uniqueness if slug is being updated
        if 'slug' in update_fields:
            existing = collection.find_one({'slug': update_fields['slug'], '_id': {'$ne': obj_id}})
            if existing:
                return jsonify({'error': f'Slug "{update_fields["slug"]}" already exists'}), 400

        update_fields['updated_at'] = datetime.utcnow()

        result = collection.update_one({'_id': obj_id}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'error': 'Sub-wall not found'}), 404

        return jsonify({'success': True, 'message': 'Sub-wall updated successfully'}), 200

    except Exception as e:
        logger.error(f"Error updating sub-wall: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls/<sub_wall_id>', methods=['DELETE'])
@token_required
def delete_sub_wall(sub_wall_id):
    """Delete a sub-wall."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        try:
            obj_id = ObjectId(sub_wall_id)
        except Exception:
            return jsonify({'error': 'Invalid sub-wall ID'}), 400

        result = collection.delete_one({'_id': obj_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Sub-wall not found'}), 404

        # Also delete associated pre-screening responses
        responses_collection = db_instance.get_collection('pre_screening_responses')
        if responses_collection is not None:
            responses_collection.delete_many({'sub_wall_id': obj_id})

        return jsonify({'success': True, 'message': 'Sub-wall deleted successfully'}), 200

    except Exception as e:
        logger.error(f"Error deleting sub-wall: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================================
# PUBLIC ENDPOINTS (no auth required)
# ============================================================

@admin_sub_walls_bp.route('/sub-walls/public/list', methods=['GET'])
def list_public_sub_walls():
    """List all active sub-walls visible to the given user (for offerwall display, no auth)."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'success': True, 'sub_walls': []}), 200

        user_id = request.args.get('user_id', '').strip()

        # Get all active sub-walls
        all_active = list(collection.find({'status': 'active'}).sort('display_order', 1))

        public_list = []
        for sw in all_active:
            visibility = sw.get('visibility', 'everyone')
            
            # Check visibility rules
            if visibility == 'everyone':
                pass  # Always show
            elif visibility == 'link_only':
                pass  # Show in offerwall too (accessible via link and listing)
            elif visibility == 'specific_publishers' or visibility == 'specific_users':
                # Only show if user_id is in the visible_to_publishers list
                visible_users = sw.get('visible_to_publishers', [])
                if not user_id:
                    continue
                # Check if user_id matches any entry (could be _id, user_id, or username)
                if user_id not in visible_users:
                    # Also try to look up the user by user_id field to get their _id
                    users_collection = db_instance.get_collection('users')
                    if users_collection is not None:
                        user_doc = users_collection.find_one({
                            '$or': [
                                {'user_id': user_id},
                                {'username': user_id}
                            ]
                        })
                        if user_doc:
                            user_mongo_id = str(user_doc['_id'])
                            if user_mongo_id not in visible_users:
                                continue
                        else:
                            continue
                    else:
                        continue
            elif visibility == 'by_country':
                # Skip country-based filtering for now (would need geo lookup)
                continue
            else:
                continue

            public_list.append({
                '_id': str(sw['_id']),
                'name': sw.get('name', ''),
                'slug': sw.get('slug', ''),
                'description': sw.get('description', ''),
                'image_url': sw.get('image_url', ''),
                'offer_count': len(sw.get('offer_ids', [])),
                'theme_color': sw.get('theme_color', '#6366f1'),
                'heading_text': sw.get('heading_text', '')
            })

        return jsonify({'success': True, 'sub_walls': public_list}), 200

    except Exception as e:
        logger.error(f"Error listing public sub-walls: {str(e)}")
        return jsonify({'success': True, 'sub_walls': []}), 200

@admin_sub_walls_bp.route('/sub-walls/public/<slug>', methods=['GET'])
def get_public_sub_wall(slug):
    """Get sub-wall data + offers for end user (no auth)."""
    try:
        collection = db_instance.get_collection('sub_walls')
        if collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        sub_wall = collection.find_one({'slug': slug, 'status': 'active'})
        if not sub_wall:
            return jsonify({'error': 'Sub-wall not found or inactive'}), 404

        # Fetch associated offers
        offers = []
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is not None and sub_wall.get('offer_ids'):
            offer_ids = sub_wall['offer_ids']
            
            # Try to convert to ObjectIds for _id matching
            from bson import ObjectId as BsonObjectId
            object_ids = []
            string_ids = []
            for oid in offer_ids:
                try:
                    object_ids.append(BsonObjectId(oid))
                except Exception:
                    pass
                string_ids.append(str(oid))
            
            # Query by both _id and offer_id fields
            query_filter = {
                '$or': [
                    {'offer_id': {'$in': string_ids}},
                    {'_id': {'$in': object_ids}}
                ]
            }
            
            offers_cursor = offers_collection.find(query_filter)
            for offer in offers_cursor:
                offer['_id'] = str(offer['_id'])
                # Build a clean click URL by replacing macros in target_url
                target_url = offer.get('target_url', '')
                if target_url:
                    offer_id = offer.get('offer_id', '')
                    clean_url = target_url.replace('{offer_id}', offer_id) \
                        .replace('{payout}', str(offer.get('payout', 0))) \
                        .replace('{user_id}', 'subwall_user') \
                        .replace('{transaction_id}', f"sw_{slug}_{offer_id}") \
                        .replace('{sub1}', 'subwall') \
                        .replace('{sub2}', slug) \
                        .replace('{sub3}', '') \
                        .replace('{aff_sub}', 'subwall_user')
                    offer['click_url'] = clean_url
                offers.append(offer)

        # Build public response
        public_data = {
            '_id': str(sub_wall['_id']),
            'name': sub_wall.get('name', ''),
            'slug': sub_wall.get('slug', ''),
            'description': sub_wall.get('description', ''),
            'image_url': sub_wall.get('image_url', ''),
            'offer_count': len(offers),
            'offers': offers,
            'pre_screening_enabled': sub_wall.get('pre_screening_enabled', False),
            'pre_screening_survey_id': str(sub_wall['pre_screening_survey_id']) if sub_wall.get('pre_screening_survey_id') else None,
            # Customization
            'heading_text': sub_wall.get('heading_text', ''),
            'theme_color': sub_wall.get('theme_color', '#6366f1'),
            'banner_image': sub_wall.get('banner_image', ''),
            'button_text': sub_wall.get('button_text', 'Click to Earn'),
            'survey_frequency': sub_wall.get('survey_frequency', 'every_time')
        }

        return jsonify({'success': True, 'sub_wall': public_data}), 200

    except Exception as e:
        logger.error(f"Error getting public sub-wall: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_sub_walls_bp.route('/sub-walls/public/<slug>/screen', methods=['POST'])
def submit_pre_screening(slug):
    """Submit pre-screening answers for a sub-wall (no auth)."""
    try:
        collection = db_instance.get_collection('sub_walls')
        responses_collection = db_instance.get_collection('pre_screening_responses')
        if collection is None or responses_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500

        sub_wall = collection.find_one({'slug': slug, 'status': 'active'})
        if not sub_wall:
            return jsonify({'error': 'Sub-wall not found or inactive'}), 404

        if not sub_wall.get('pre_screening_enabled'):
            return jsonify({'error': 'Pre-screening is not enabled for this sub-wall'}), 400

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        answers = data.get('answers', {})
        user_id = data.get('user_id', 'anonymous')

        # Determine eligible offers based on filter rules
        eligible_offers = list(sub_wall.get('offer_ids', []))

        if sub_wall.get('filter_by_answers') and sub_wall.get('filter_rules'):
            filter_rules = sub_wall['filter_rules']
            filtered_offers = set()
            has_rules = False

            for question_key, answer_value in answers.items():
                if question_key in filter_rules:
                    has_rules = True
                    rule_mapping = filter_rules[question_key]
                    if isinstance(rule_mapping, dict) and answer_value in rule_mapping:
                        matched_offers = rule_mapping[answer_value]
                        if isinstance(matched_offers, list):
                            filtered_offers.update(matched_offers)

            if has_rules and filtered_offers:
                eligible_offers = [oid for oid in eligible_offers if oid in filtered_offers]
            elif has_rules and not filtered_offers:
                eligible_offers = []

        # Store response
        response_doc = {
            'sub_wall_id': sub_wall['_id'],
            'user_id': user_id,
            'answers': answers,
            'eligible_offers': eligible_offers,
            'completed_at': datetime.utcnow()
        }

        responses_collection.insert_one(response_doc)

        # Fetch eligible offer details
        offers = []
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is not None and eligible_offers:
            offers_cursor = offers_collection.find({
                'offer_id': {'$in': eligible_offers},
                'status': 'running'
            })
            for offer in offers_cursor:
                offer['_id'] = str(offer['_id'])
                offers.append(offer)

        return jsonify({
            'success': True,
            'eligible_offers': eligible_offers,
            'offers': offers,
            'message': 'Pre-screening completed'
        }), 200

    except Exception as e:
        logger.error(f"Error submitting pre-screening: {str(e)}")
        return jsonify({'error': str(e)}), 500
