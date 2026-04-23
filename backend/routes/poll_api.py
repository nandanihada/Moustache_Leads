import logging
from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required

# Since we don't have a specific admin_required decorator available here, 
# we'll implement a simple role check inside the routes.
poll_bp = Blueprint('polls', __name__)

# --- ADMIN ENDPOINTS ---

@poll_bp.route('/admin/polls', methods=['GET'])
@token_required
def get_all_polls():
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    polls_col = db_instance.get_collection('polls')
    if polls_col is None:
        return jsonify({'error': 'Database connect failed', 'polls': []}), 500

    polls = list(polls_col.find().sort('created_at', -1))
    for p in polls:
        p['_id'] = str(p['_id'])
    return jsonify({'success': True, 'polls': polls})

@poll_bp.route('/admin/polls', methods=['POST'])
@token_required
def create_poll():
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.json
    question = data.get('question')
    if not question:
        return jsonify({'error': 'Question is required'}), 400
        
    polls_col = db_instance.get_collection('polls')
    
    from datetime import datetime
    
    is_active = data.get('is_active', False)
    if is_active:
        polls_col.update_many({'is_active': True}, {'$set': {'is_active': False}})
        
    poll = {
        'question': question,
        'is_active': is_active,
        'target_countries': data.get('target_countries', []),
        'target_users': data.get('target_users', []),
        'require_placement': data.get('require_placement', None), # None='all', True='yes', False='no'
        'options': data.get('options', [
            {'id': 'yes', 'text': 'Yes', 'votes': 0},
            {'id': 'no', 'text': 'No', 'votes': 0}
        ]),
        'voted_users': [],
        'viewed_users': [],
        'vote_details': [],
        'view_details': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = polls_col.insert_one(poll)
    poll['_id'] = str(result.inserted_id)
    return jsonify({'success': True, 'poll': poll})

@poll_bp.route('/admin/polls/<poll_id>', methods=['PUT'])
@token_required
def update_poll(poll_id):
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    from bson import ObjectId
    from datetime import datetime

    data = request.json
    polls_col = db_instance.get_collection('polls')
    
    update_fields = {'updated_at': datetime.utcnow()}
    if 'question' in data:
        update_fields['question'] = data['question']
    if 'target_countries' in data:
        update_fields['target_countries'] = data['target_countries']
    if 'target_users' in data:
        update_fields['target_users'] = data['target_users']
    if 'require_placement' in data:
        update_fields['require_placement'] = data['require_placement']
    if 'options' in data:
        update_fields['options'] = data['options']
    if 'is_active' in data:
        update_fields['is_active'] = data['is_active']
        if data['is_active']:
            polls_col.update_many({'_id': {'$ne': ObjectId(poll_id)}}, {'$set': {'is_active': False}})
            
    polls_col.update_one({'_id': ObjectId(poll_id)}, {'$set': update_fields})
    return jsonify({'success': True})

@poll_bp.route('/admin/polls/<poll_id>', methods=['DELETE'])
@token_required
def delete_poll(poll_id):
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    from bson import ObjectId
    polls_col = db_instance.get_collection('polls')
    polls_col.delete_one({'_id': ObjectId(poll_id)})
    return jsonify({'success': True})

# --- ADMIN ANALYTICS ---
@poll_bp.route('/admin/polls/analytics', methods=['GET'])
@token_required
def get_poll_analytics():
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    polls_col = db_instance.get_collection('polls')
    # Get last 10 polls
    recent_polls = list(polls_col.find().sort('created_at', -1).limit(10))
    recent_polls.reverse() # chronological order for chart
    
    chart_data = []
    for p in recent_polls:
        views = len(p.get('viewed_users', []))
        responses = len(p.get('voted_users', []))
        chart_data.append({
            'name': p['question'][:20] + '...' if len(p['question']) > 20 else p['question'],
            'views': views,
            'responses': responses
        })
        
    return jsonify({'success': True, 'chart_data': chart_data})

@poll_bp.route('/admin/polls/<poll_id>/details', methods=['GET'])
@token_required
def get_poll_details(poll_id):
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    from bson import ObjectId
    polls_col = db_instance.get_collection('polls')
    users_col = db_instance.get_collection('users')
    
    poll = polls_col.find_one({'_id': ObjectId(poll_id)})
    if not poll:
        return jsonify({'error': 'Not found'}), 404

    viewed_ids = set(poll.get('viewed_users', []))
    voted_ids = set(poll.get('voted_users', []))
    
    all_target_ids = viewed_ids.union(voted_ids)
    
    # Fetch user info
    users = list(users_col.find({'_id': {'$in': [ObjectId(uid) for uid in all_target_ids if getattr(ObjectId, 'is_valid', lambda x: True)(uid)]}}))
    user_map = {str(u['_id']): u for u in users}
    
    vote_details_list = poll.get('vote_details', [])
    vote_map = {v['user_id']: v for v in vote_details_list}
    
    view_details_list = poll.get('view_details', [])
    view_map = {v['user_id']: v for v in view_details_list}
    
    details = []
    for uid in all_target_ids:
        uinfo = user_map.get(uid, {})
        has_voted = uid in voted_ids
        v_data = vote_map.get(uid)
        view_data = view_map.get(uid)
        
        # Favor live tracked country if available
        user_country = view_data.get('country') if view_data and view_data.get('country') and view_data.get('country') not in ('Unknown', 'XX') else None
        if not user_country:
            user_country = v_data.get('country') if v_data and v_data.get('country') and v_data.get('country') not in ('Unknown', 'XX') else None
            
        if not user_country:
            user_country = uinfo.get('address', {}).get('country') or uinfo.get('country')
            
        if not user_country or user_country in ('Unknown', 'XX'):
            # Fallback for localhost admin tests
            if uinfo.get('role') == 'admin':
                user_country = 'IN' 
            else:
                user_country = getattr(uinfo, 'country', 'N/A')
                
        # Fallback for legacy votes cast before vote_details tracking was deployed
        response_val = v_data['option_id'] if v_data else ('yes' if has_voted else None)
        response_time = v_data['timestamp'] if v_data else (poll.get('updated_at') if has_voted else None)
        view_time = view_data['timestamp'] if view_data else None
        
        details.append({
            'user_id': uid,
            'username': uinfo.get('username', 'Unknown'),
            'email': uinfo.get('email', 'Unknown'),
            'country': user_country if user_country else 'N/A',
            'viewed': True,
            'responded': has_voted,
            'response': response_val,
            'response_time': response_time,
            'view_time': view_time
        })
        
    return jsonify({'success': True, 'details': details})

@poll_bp.route('/admin/polls/targetable-users', methods=['GET'])
@token_required
def get_targetable_users():
    user = request.current_user
    if user.get('role') not in ['admin', 'subadmin']:
        return jsonify({'error': 'Unauthorized'}), 403

    users_col = db_instance.get_collection('users')
    placements_col = db_instance.get_collection('placements')
    
    users = list(users_col.find({'role': {'$ne': 'admin'}}, {'_id': 1, 'username': 1, 'email': 1, 'country': 1, 'address': 1, 'verticals': 1}))
    
    placements = list(placements_col.find({'deleted': {'$ne': True}}, {'user_id': 1, 'publisherId': 1}))
    users_with_placements = set()
    for p in placements:
        if p.get('user_id'):
            users_with_placements.add(str(p['user_id']))
        if p.get('publisherId'):
            users_with_placements.add(str(p['publisherId']))
            
    result = []
    for u in users:
        uid_str = str(u['_id'])
        user_country = u.get('address', {}).get('country') or u.get('country') or 'N/A'
        
        result.append({
            'id': uid_str,
            'username': u.get('username', ''),
            'email': u.get('email', ''),
            'country': user_country,
            'verticals': u.get('verticals', []),
            'has_placement': uid_str in users_with_placements
        })
        
    return jsonify({'success': True, 'users': result})

# --- USER ENDPOINTS ---

@poll_bp.route('/user/polls/active', methods=['GET'])
@token_required
def get_active_poll():
    from bson import ObjectId
    polls_col = db_instance.get_collection('polls')
    if polls_col is None:
        return jsonify({'success': True, 'poll': None})

    active_poll = polls_col.find_one({'is_active': True})
    
    if not active_poll:
        return jsonify({'success': True, 'poll': None})
        
    user = request.current_user
    user_id = str(user['_id'])
    
    # --- Check Targeting ---
    target_users = active_poll.get('target_users', [])
    if target_users and isinstance(target_users, list) and len(target_users) > 0:
        if user_id not in target_users:
            return jsonify({'success': True, 'poll': None})
            
    target_countries = active_poll.get('target_countries', [])
    if target_countries and isinstance(target_countries, list) and len(target_countries) > 0:
        user_country = user.get('address', {}).get('country') or user.get('country') or ''
        
        # basic fuzzy match mapping since users might type "United States" or "US"
        country_map = {'UNITED STATES': 'US', 'USA': 'US', 'UNITED KINGDOM': 'GB', 'UK': 'GB', 'CANADA': 'CA', 'AUSTRALIA': 'AU', 'GERMANY': 'DE', 'FRANCE': 'FR', 'INDIA': 'IN', 'BRAZIL': 'BR', 'JAPAN': 'JP'}
        uc_upper = user_country.upper().strip()
        normalized_user_country = country_map.get(uc_upper, uc_upper)

        target_upper = [c.upper().strip() for c in target_countries]
        if normalized_user_country not in target_upper and uc_upper not in target_upper:
            return jsonify({'success': True, 'poll': None})
            
    require_placement = active_poll.get('require_placement')
    if require_placement is not None:
        placements_col = db_instance.get_collection('placements')
        placement_count = placements_col.count_documents({'user_id': user_id, 'deleted': {'$ne': True}})
        has_placement = placement_count > 0
        
        if require_placement is True and not has_placement:
            return jsonify({'success': True, 'poll': None})
        if require_placement is False and has_placement:
            return jsonify({'success': True, 'poll': None})

    # Record view
    if user_id not in active_poll.get('viewed_users', []):
        from datetime import datetime
        
        # Track live country
        country_code = 'Unknown'
        try:
            from services.ipinfo_service import get_ipinfo_service
            ip_address = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
            ip_data = get_ipinfo_service().lookup_ip(ip_address)
            if ip_data:
                country_code = ip_data.get('country_code', 'Unknown')
        except Exception as e:
            pass
            
        polls_col.update_one({'_id': active_poll['_id']}, {
            '$addToSet': {'viewed_users': user_id},
            '$push': {'view_details': {'user_id': user_id, 'timestamp': datetime.utcnow(), 'country': country_code}}
        })
        active_poll['viewed_users'] = active_poll.get('viewed_users', []) + [user_id]
        
    has_voted = user_id in active_poll.get('voted_users', [])
    
    active_poll['_id'] = str(active_poll['_id'])
    
    response_poll = {
        '_id': active_poll['_id'],
        'question': active_poll['question'],
        'has_voted': has_voted,
    }
    
    if has_voted:
        total_votes = sum(opt['votes'] for opt in active_poll['options'])
        response_poll['total_votes'] = total_votes
        response_poll['options'] = active_poll['options']
    else:
        response_poll['options'] = [{'id': opt['id'], 'text': opt['text']} for opt in active_poll['options']]
        
    return jsonify({'success': True, 'poll': response_poll})

@poll_bp.route('/user/polls/<poll_id>/vote', methods=['POST'])
@token_required
def vote_poll(poll_id):
    from bson import ObjectId
    from datetime import datetime

    data = request.json
    option_id = data.get('option_id')
    user_id = str(request.current_user['_id'])
    
    if not option_id:
        return jsonify({'error': 'Option ID is required'}), 400
        
    polls_col = db_instance.get_collection('polls')
    poll = polls_col.find_one({'_id': ObjectId(poll_id)})
    
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
        
    if user_id in poll.get('voted_users', []):
        return jsonify({'error': 'Already voted'}), 400
        
    # Track live country
    country_code = 'Unknown'
    try:
        from services.ipinfo_service import get_ipinfo_service
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
        ip_data = get_ipinfo_service().lookup_ip(ip_address)
        if ip_data:
            country_code = ip_data.get('country_code', 'Unknown')
    except Exception as e:
        pass
        
    polls_col.update_one(
        {'_id': ObjectId(poll_id), 'options.id': option_id},
        {
            '$inc': {'options.$.votes': 1},
            '$addToSet': {'viewed_users': user_id},
            '$push': {
                'voted_users': user_id,
                'vote_details': {
                    'user_id': user_id,
                    'option_id': option_id,
                    'timestamp': datetime.utcnow(),
                    'country': country_code
                }
            }
        }
    )
    
    updated_poll = polls_col.find_one({'_id': ObjectId(poll_id)})
    total_votes = sum(opt['votes'] for opt in updated_poll['options'])
    
    return jsonify({
        'success': True, 
        'options': updated_poll['options'],
        'total_votes': total_votes
    })
