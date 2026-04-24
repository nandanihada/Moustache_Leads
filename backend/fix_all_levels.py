from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta, timezone

def determine_correct_level(user_id, username):
    """Determine correct level based on actual activity"""
    
    # Count clicks from ALL collections
    total_clicks = 0
    
    clicks = db_instance.get_collection('clicks')
    if clicks is not None:
        total_clicks += clicks.count_documents({'$or': [
            {'user_id': user_id},
            {'affiliate_id': user_id},
            {'username': username}
        ]})
    
    dashboard_clicks = db_instance.get_collection('dashboard_clicks')
    if dashboard_clicks is not None:
        total_clicks += dashboard_clicks.count_documents({'$or': [
            {'user_id': user_id},
            {'username': username}
        ]})
    
    offerwall_clicks = db_instance.get_collection('offerwall_clicks')
    if offerwall_clicks is not None:
        total_clicks += offerwall_clicks.count_documents({'$or': [
            {'user_id': user_id},
            {'publisher_id': user_id},
            {'username': username}
        ]})
    
    offerwall_detailed = db_instance.get_collection('offerwall_clicks_detailed')
    if offerwall_detailed is not None:
        total_clicks += offerwall_detailed.count_documents({'$or': [
            {'user_id': user_id},
            {'publisher_name': username}
        ]})
    
    # Count affiliate requests
    requests = db_instance.get_collection('affiliate_requests')
    req_count = 0
    approved_count = 0
    if requests is not None:
        req_count = requests.count_documents({'$or': [
            {'user_id': user_id},
            {'user_id': ObjectId(user_id)},
            {'username': username}
        ]})
        approved_count = requests.count_documents({'$or': [
            {'user_id': user_id},
            {'user_id': ObjectId(user_id)},
            {'username': username}
        ], 'status': 'approved'})
    
    # Count logins (last 7 days)
    login_logs = db_instance.get_collection('login_logs')
    login_count = 0
    if login_logs is not None:
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        login_count = login_logs.count_documents({
            '$or': [
                {'user_id': user_id},
                {'username': username}
            ],
            'status': 'success',
            'login_time': {'$gte': seven_days_ago}
        })
    
    # Get suspicious flag from user document
    users = db_instance.get_collection('users')
    user = users.find_one({'_id': ObjectId(user_id)})
    suspicious = user.get('suspicious', False) if user else False
    
    # Determine level based on priority
    if suspicious:
        return 'L6', f'Suspicious activity'
    elif approved_count > 0:
        return 'L5', f'{approved_count} approved offers'
    elif req_count > 0:
        return 'L4', f'{req_count} offers requested'
    elif login_count > 0:
        return 'L3', f'{login_count} logins in last 7 days'
    elif total_clicks > 0:
        return 'L2', f'{total_clicks} offers viewed'
    else:
        return 'L1', 'No engagement'

# Get all approved users
users_col = db_instance.get_collection('users')
users = list(users_col.find({'account_status': 'approved'}))

print(f'Found {len(users)} approved users')
print('=' * 80)

fixed_count = 0
already_correct = 0

for user in users:
    user_id = str(user['_id'])
    username = user.get('username', '')
    current_level = user.get('level', 'L1')
    
    # Determine correct level
    correct_level, reason = determine_correct_level(user_id, username)
    
    if current_level != correct_level:
        print(f'FIXING: {username:20} | {current_level} -> {correct_level} | {reason}')
        
        # Update user level
        users_col.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'level': correct_level,
                    'previous_level': current_level,
                    'level_updated_at': datetime.now(timezone.utc)
                }
            }
        )
        fixed_count += 1
    else:
        already_correct += 1

print('=' * 80)
print(f'Fixed: {fixed_count} users')
print(f'Already correct: {already_correct} users')
print(f'Total: {len(users)} users')
