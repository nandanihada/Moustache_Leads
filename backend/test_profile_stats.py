"""
Test the profile-stats endpoint
"""
import requests
import json

# Login first to get token
login_url = "http://localhost:5000/api/auth/login"
login_data = {
    "username": "admin",
    "password": "admin123"
}

response = requests.post(login_url, json=login_data)
if response.status_code != 200:
    print(f"Login failed: {response.text}")
    exit()

token = response.json().get('token')
print(f"Token: {token[:20]}...")

# Get user ID for leopard
users_url = "http://localhost:5000/api/auth/admin/users"
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(users_url, headers=headers)

if response.status_code != 200:
    print(f"Failed to get users: {response.text}")
    exit()

users = response.json().get('users', [])
leopard_user = next((u for u in users if u.get('username') == 'leopard'), None)

if not leopard_user:
    print("Leopard user not found!")
    exit()

user_id = leopard_user['_id']
print(f"\nLeopard User ID: {user_id}")

# Call profile-stats endpoint
stats_url = f"http://localhost:5000/api/admin/users/{user_id}/profile-stats"
response = requests.get(stats_url, headers=headers)

print(f"\nStatus Code: {response.status_code}")
print(f"\nResponse:")
print(json.dumps(response.json(), indent=2))
