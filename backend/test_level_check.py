"""
Test script to check level progression eligibility
Run this to debug the level check endpoint
"""
import requests
import json

# Configuration
API_BASE_URL = "http://localhost:5000"  # Change if needed
ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"  # Replace with actual admin token

def test_level_check():
    """Test the level check endpoint"""
    
    # First, get list of users
    print("Fetching users...")
    response = requests.get(
        f"{API_BASE_URL}/api/auth/admin/users",
        headers={
            'Authorization': f'Bearer {ADMIN_TOKEN}',
            'Content-Type': 'application/json'
        }
    )
    
    if response.status_code != 200:
        print(f"Failed to fetch users: {response.status_code}")
        print(response.text)
        return
    
    users_data = response.json()
    users = users_data.get('users', [])
    approved_users = [u for u in users if u.get('account_status') == 'approved']
    
    print(f"Found {len(approved_users)} approved users")
    
    if not approved_users:
        print("No approved users found!")
        return
    
    # Get first 5 user IDs
    user_ids = [u['_id'] for u in approved_users[:5]]
    print(f"Checking level eligibility for {len(user_ids)} users...")
    print(f"User IDs: {user_ids}")
    
    # Check level eligibility
    response = requests.post(
        f"{API_BASE_URL}/api/admin/publishers/level-check",
        headers={
            'Authorization': f'Bearer {ADMIN_TOKEN}',
            'Content-Type': 'application/json'
        },
        json={'publisher_ids': user_ids}
    )
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body:")
    print(json.dumps(response.json(), indent=2))
    
    # Count eligible
    if response.status_code == 200:
        results = response.json().get('results', [])
        eligible = [r for r in results if r.get('eligible')]
        print(f"\n✅ {len(eligible)} out of {len(results)} users are eligible for upgrade")
        
        for user in eligible:
            print(f"  - {user['username']}: {user['current_level']} → {user['next_level']} ({user['reason']})")

if __name__ == '__main__':
    print("Level Progression Test Script")
    print("=" * 50)
    test_level_check()
