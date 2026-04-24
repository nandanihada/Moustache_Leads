from database import db_instance
from collections import Counter

users = db_instance.get_collection('users')
levels = [u.get('level', 'L1') for u in users.find({'account_status': 'approved'})]
distribution = Counter(levels)

print('\nLevel Distribution After Fix:')
print('=' * 40)
for level in ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']:
    count = distribution.get(level, 0)
    bar = '#' * (count // 2)
    print(f'{level}: {count:3d} users {bar}')
print('=' * 40)
print(f'Total: {len(levels)} users')
