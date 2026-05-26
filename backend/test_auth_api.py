import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import app
import json

# Setup test client
client = app.test_client()

print("Sending POST to /api/auth/publisher/login with admin / admin123...")

try:
    response = client.post(
        '/api/auth/publisher/login',
        data=json.dumps({
            'username': 'admin',
            'password': 'admin123',
            'public_ip': '1.1.1.1'
        }),
        content_type='application/json'
    )
    
    print("Response Status Code:", response.status_code)
    print("Response Data:", response.get_data(as_text=True))
except Exception as e:
    import traceback
    traceback.print_exc()
