#!/usr/bin/env python3

from models.user import User
from models.placement import Placement

def check_users_and_placements():
    print("=== CHECKING USERS ===")
    user_model = User()
    users = list(user_model.collection.find({}, {'username': 1, 'email': 1, 'role': 1}))
    
    print(f"Found {len(users)} users:")
    for user in users:
        username = user.get('username', 'N/A')
        email = user.get('email', 'N/A')
        role = user.get('role', 'user')
        print(f"  - {username} ({email}) - Role: {role}")
    
    print("\n=== CHECKING PLACEMENTS ===")
    placement_model = Placement()
    placements, total, error = placement_model.get_all_placements_for_admin()
    
    if error:
        print(f"Error fetching placements: {error}")
    else:
        print(f"Found {total} placements:")
        for placement in placements[:5]:  # Show first 5
            publisher = placement.get('publisher', {})
            print(f"  - {placement.get('offerwallTitle', 'N/A')} by {publisher.get('username', 'N/A')} - Status: {placement.get('approvalStatus', 'N/A')}")
    
    print("\n=== CHECKING PENDING PLACEMENTS ===")
    pending_count = placement_model.get_pending_placements_count()
    print(f"Pending placements: {pending_count}")

if __name__ == "__main__":
    check_users_and_placements()
