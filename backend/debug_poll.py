import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

# Check active poll
polls_col = db_instance.get_collection('polls')
active_poll = polls_col.find_one({'is_active': True})

if active_poll:
    print("=" * 60)
    print("ACTIVE POLL FOUND")
    print("=" * 60)
    print(f"Question: {active_poll.get('question')}")
    print(f"Target Countries: {active_poll.get('target_countries', [])}")
    print(f"Target Users: {active_poll.get('target_users', [])}")
    print(f"Require Placement: {active_poll.get('require_placement')}")
    print(f"Viewed Users: {len(active_poll.get('viewed_users', []))}")
    print(f"Voted Users: {len(active_poll.get('voted_users', []))}")
else:
    print("NO ACTIVE POLL FOUND")

print("\n" + "=" * 60)
print("CHECKING USERS")
print("=" * 60)

# Check users
users_col = db_instance.get_collection('users')
users = list(users_col.find({'role': {'$ne': 'admin'}}, {'_id': 1, 'username': 1, 'email': 1, 'country': 1, 'address': 1}).limit(10))

for user in users:
    user_country = user.get('address', {}).get('country') or user.get('country') or 'NOT SET'
    print(f"\nUser: {user.get('username')}")
    print(f"  Email: {user.get('email')}")
    print(f"  Country (direct): {user.get('country')}")
    print(f"  Country (address): {user.get('address', {}).get('country')}")
    print(f"  Final Country: {user_country}")
    
    # Check if user has placement
    placements_col = db_instance.get_collection('placements')
    placement_count = placements_col.count_documents({'user_id': str(user['_id']), 'deleted': {'$ne': True}})
    print(f"  Has Placement: {placement_count > 0} ({placement_count} placements)")
    
    # Check if user would see the poll
    if active_poll:
        target_countries = active_poll.get('target_countries', [])
        require_placement = active_poll.get('require_placement')
        
        # Country check
        country_match = True
        if target_countries and len(target_countries) > 0:
            uc_upper = user_country.upper().strip()
            target_upper = [c.upper().strip() for c in target_countries]
            country_match = uc_upper in target_upper
            print(f"  Country Match: {country_match} (user: '{uc_upper}' vs targets: {target_upper})")
        
        # Placement check
        placement_match = True
        if require_placement is not None:
            has_placement = placement_count > 0
            if require_placement is True and not has_placement:
                placement_match = False
            if require_placement is False and has_placement:
                placement_match = False
            print(f"  Placement Match: {placement_match} (required: {require_placement}, has: {has_placement})")
        
        would_see = country_match and placement_match
        print(f"  WOULD SEE POLL: {would_see}")
