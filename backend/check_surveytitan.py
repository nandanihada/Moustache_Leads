from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta

# Find surveytitan user
users = db_instance.get_collection('users')
user = users.find_one({'username': 'surveytitan'})

if not user:
    print('User surveytitan not found')
    exit()

user_id = str(user['_id'])
username = user.get('username')
print(f'\n=== USER: {username} ===')
print(f'ID: {user_id}')
print(f'Current Level: {user.get("level", "L1")}')
print(f'Suspicious: {user.get("suspicious", False)}')

# Check ALL click collections
print('\n=== CLICKS ===')
total_clicks = 0

clicks = db_instance.get_collection('clicks')
if clicks is not None:
    count = clicks.count_documents({'$or': [
        {'user_id': user_id},
        {'affiliate_id': user_id},
        {'username': username}
    ]})
    print(f'clicks: {count}')
    total_clicks += count

dashboard_clicks = db_instance.get_collection('dashboard_clicks')
if dashboard_clicks is not None:
    count = dashboard_clicks.count_documents({'$or': [
        {'user_id': user_id},
        {'username': username}
    ]})
    print(f'dashboard_clicks: {count}')
    total_clicks += count

offerwall_clicks = db_instance.get_collection('offerwall_clicks')
if offerwall_clicks is not None:
    count = offerwall_clicks.count_documents({'$or': [
        {'user_id': user_id},
        {'publisher_id': user_id},
        {'username': username}
    ]})
    print(f'offerwall_clicks: {count}')
    total_clicks += count

offerwall_detailed = db_instance.get_collection('offerwall_clicks_detailed')
if offerwall_detailed is not None:
    count = offerwall_detailed.count_documents({'$or': [
        {'user_id': user_id},
        {'publisher_name': username}
    ]})
    print(f'offerwall_clicks_detailed: {count}')
    total_clicks += count

print(f'TOTAL CLICKS: {total_clicks}')

# Check affiliate requests
print('\n=== AFFILIATE REQUESTS ===')
requests = db_instance.get_collection('affiliate_requests')
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
    rejected_count = requests.count_documents({'$or': [
        {'user_id': user_id},
        {'user_id': ObjectId(user_id)},
        {'username': username}
    ], 'status': 'rejected'})
    print(f'Total Requests: {req_count}')
    print(f'Approved: {approved_count}')
    print(f'Rejected: {rejected_count}')

# Check logins
print('\n=== LOGINS (Last 7 days) ===')
login_logs = db_instance.get_collection('login_logs')
if login_logs is not None:
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    login_count = login_logs.count_documents({
        '$or': [
            {'user_id': user_id},
            {'username': username}
        ],
        'status': 'success',
        'login_time': {'$gte': seven_days_ago}
    })
    print(f'Logins (7d): {login_count}')

# Check conversions
print('\n=== CONVERSIONS ===')
conversions = db_instance.get_collection('forwarded_postbacks')
if conversions is not None:
    conv_count = conversions.count_documents({'publisher_id': user_id})
    print(f'Conversions: {conv_count}')

# Determine correct level
print('\n=== LEVEL DETERMINATION ===')
suspicious = user.get('suspicious', False)

if suspicious:
    correct_level = 'L6'
    reason = 'Suspicious activity'
elif approved_count > 0:
    correct_level = 'L5'
    reason = f'{approved_count} approved offers'
elif req_count > 0:
    correct_level = 'L4'
    reason = f'{req_count} offers requested'
elif login_count > 0:
    correct_level = 'L3'
    reason = f'{login_count} logins in last 7 days'
elif total_clicks > 0:
    correct_level = 'L2'
    reason = f'{total_clicks} offers viewed'
else:
    correct_level = 'L1'
    reason = 'No engagement'

print(f'Current Level: {user.get("level", "L1")}')
print(f'Correct Level: {correct_level}')
print(f'Reason: {reason}')

if user.get('level', 'L1') != correct_level:
    print(f'\n⚠️  LEVEL MISMATCH! User should be at {correct_level}, not {user.get("level", "L1")}')
else:
    print(f'\n✓ Level is correct')
