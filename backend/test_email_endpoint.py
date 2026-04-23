"""
Test script to verify email endpoint is accessible
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
# Replace with your actual admin token
TOKEN = "YOUR_ADMIN_TOKEN_HERE"

def test_endpoint_exists():
    """Test if the endpoint exists"""
    print("Testing email endpoint...")
    
    # Test with a dummy publisher ID
    publisher_id = "507f1f77bcf86cd799439011"  # Dummy ObjectId
    
    url = f"{BASE_URL}/api/admin/publishers/{publisher_id}/send-email"
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    data = {
        "subject": "Test Email",
        "message": "This is a test message"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print("\n❌ ERROR: Endpoint not found!")
            print("The route is not registered properly.")
        elif response.status_code == 403:
            print("\n⚠️ WARNING: Access denied (need admin token)")
        elif response.status_code == 401:
            print("\n⚠️ WARNING: Unauthorized (invalid token)")
        else:
            print(f"\n✅ Endpoint exists! Status: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to backend!")
        print("Make sure the backend is running on http://localhost:5000")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")

if __name__ == "__main__":
    print("=" * 50)
    print("Email Endpoint Test")
    print("=" * 50)
    test_endpoint_exists()
