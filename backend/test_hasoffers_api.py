"""
Test HasOffers API directly to see raw response
Run this to debug the API response structure
"""

import requests
import json

# REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
NETWORK_ID = "cpamerchant"  # Replace with your network ID
API_KEY = "your_api_key_here"  # Replace with your API key

def test_hasoffers_api():
    """Test HasOffers API and print raw response"""
    
    url = f"https://{NETWORK_ID}.api.hasoffers.com/Apiv3/json"
    
    params = {
        'NetworkId': NETWORK_ID,
        'Target': 'Affiliate_Offer',
        'Method': 'findMyOffers',
        'api_key': API_KEY,
        'limit': 5
    }
    
    print("="*80)
    print("🔍 Testing HasOffers API")
    print(f"URL: {url}")
    print(f"Network ID: {NETWORK_ID}")
    print("="*80)
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        print(f"\n✅ Status Code: {response.status_code}")
        
        data = response.json()
        
        print(f"\n📊 Response Structure:")
        print(f"   Top-level keys: {list(data.keys())}")
        
        if 'response' in data:
            resp = data['response']
            print(f"   Response status: {resp.get('status')}")
            print(f"   Response keys: {list(resp.keys())}")
            
            if 'data' in resp:
                data_obj = resp['data']
                print(f"\n📦 Data Object:")
                print(f"   Type: {type(data_obj)}")
                
                if isinstance(data_obj, dict):
                    print(f"   Number of items: {len(data_obj)}")
                    print(f"   First 5 keys: {list(data_obj.keys())[:5]}")
                    
                    # Check first offer
                    if data_obj:
                        first_key = list(data_obj.keys())[0]
                        first_offer = data_obj[first_key]
                        
                        print(f"\n🎯 First Offer (ID: {first_key}):")
                        print(f"   Type: {type(first_offer)}")
                        
                        if isinstance(first_offer, dict):
                            print(f"   Keys: {list(first_offer.keys())}")
                            
                            if 'Offer' in first_offer:
                                offer_data = first_offer['Offer']
                                print(f"\n   Offer Details:")
                                print(f"      ID: {offer_data.get('id')}")
                                print(f"      Name: {offer_data.get('name')}")
                                print(f"      Payout: {offer_data.get('default_payout')}")
                                print(f"      Currency: {offer_data.get('currency')}")
                                print(f"      Status: {offer_data.get('status')}")
                elif isinstance(data_obj, list):
                    print(f"   Number of items: {len(data_obj)}")
                    if data_obj:
                        print(f"   First item keys: {list(data_obj[0].keys()) if isinstance(data_obj[0], dict) else 'Not a dict'}")
        
        print("\n" + "="*80)
        print("📄 Full JSON Response:")
        print("="*80)
        print(json.dumps(data, indent=2))
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_hasoffers_api()
