"""
Quick test to verify IPInfo API is working
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

token = os.getenv('IPINFO_API_TOKEN')
test_ip = '8.8.8.8'  # Google DNS

print(f"\n🔍 Testing IPInfo API with IP: {test_ip}")
print(f"📝 API Token: {token[:10]}..." if token else "❌ No token found")

if token:
    url = f"https://ipinfo.io/{test_ip}/json"
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        print(f"\n📡 API Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ SUCCESS! IPInfo API is working!\n")
            print(f"📍 Location Data:")
            print(f"   IP:       {data.get('ip')}")
            print(f"   City:     {data.get('city', 'N/A')}")
            print(f"   Region:   {data.get('region', 'N/A')}")
            print(f"   Country:  {data.get('country', 'N/A')}")
            print(f"   Timezone: {data.get('timezone', 'N/A')}")
            print(f"   Org/ISP:  {data.get('org', 'N/A')}")
            print(f"   Postal:   {data.get('postal', 'N/A')}")
            print(f"   Loc:      {data.get('loc', 'N/A')}")
        else:
            print(f"\n❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
else:
    print("\n❌ No API token configured!")
