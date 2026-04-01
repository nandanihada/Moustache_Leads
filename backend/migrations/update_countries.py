import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

p1 = db_instance.get_collection('referrals_p1')
p1.update_one({'referred_username': 'alice_media'}, {'$set': {'country': 'IN', 'country_code': 'IN', 'city': 'Mumbai'}})
p1.update_one({'referred_username': 'bob_affiliate'}, {'$set': {'country': 'IN', 'country_code': 'IN', 'city': 'Delhi'}})
p1.update_one({'referred_username': 'charlie_sus'}, {'$set': {'country': 'US', 'country_code': 'US', 'city': 'Unknown'}})
p1.update_one({'referred_username': 'diana_review'}, {'$set': {'country': 'IN', 'country_code': 'IN', 'city': 'Surat'}})
p1.update_one({'referred_username': 'testref'}, {'$set': {'country': 'US', 'country_code': 'US', 'city': 'Localhost'}})
print('Done - updated countries for all test referrals')
