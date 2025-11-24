#!/usr/bin/env python3

import requests
import json

def test_publisher_offers_endpoint():
    """Test the publisher offers endpoint"""
    
    # Test health endpoint first
    try:
        print("🔍 Testing health endpoint...")
        health_response = requests.get('http://localhost:5000/api/publisher/health')
        print(f"Health Status: {health_response.status_code}")
        if health_response.status_code == 200:
            print(f"Health Response: {health_response.json()}")
        else:
            print(f"Health Error: {health_response.text}")
    except Exception as e:
        print(f"❌ Health endpoint error: {str(e)}")
    
    # Test offers endpoint without authentication
    try:
        print("\n🔍 Testing offers endpoint (no auth)...")
        offers_response = requests.get(
            'http://localhost:5000/api/publisher/offers/available',
            params={
                'page': 1,
                'per_page': 5,
                'status': 'active'
            }
        )
        print(f"Offers Status: {offers_response.status_code}")
        print(f"Offers Response: {offers_response.text[:500]}...")
        
    except Exception as e:
        print(f"❌ Offers endpoint error: {str(e)}")

if __name__ == "__main__":
    test_publisher_offers_endpoint()
