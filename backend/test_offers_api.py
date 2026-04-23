import requests
import json

# First login to get token
login_response = requests.post('http://localhost:5000/api/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})

if login_response.status_code != 200:
    print(f"Login failed: {login_response.text}")
    exit()

token = login_response.json().get('token')
print(f"Got token: {token[:20]}...")

# Get leopard user ID
user_id = "69c0af4ff221f1dd8be0cd22"

# Call the user offers endpoint
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(f'http://localhost:5000/api/admin/users/{user_id}/offers', headers=headers)

print(f"\nStatus Code: {response.status_code}")
print(f"Response:")
print(json.dumps(response.json(), indent=2))
