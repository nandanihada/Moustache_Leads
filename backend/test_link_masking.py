#!/usr/bin/env python3
"""
Test script for Link Masking System
Tests domain management and masked link creation functionality
"""

import requests
import json
import sys

def test_link_masking_system():
    """Test the complete link masking system"""
    
    base_url = "http://localhost:5000"
    
    print("🔗 Testing Link Masking System")
    print("=" * 50)
    
    # Step 1: Login as admin
    print("\n🔐 Logging in as admin...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    login_response = requests.post(f"{base_url}/api/auth/login", json=login_data)
    
    if login_response.status_code == 200:
        login_result = login_response.json()
        token = login_result['token']
        print(f"✅ Login successful! User: {login_result['user']['username']}")
    else:
        print(f"❌ Login failed: {login_response.text}")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 2: Create a masking domain
    print("\n🌐 Creating masking domain...")
    domain_data = {
        "domain": "short.ly",
        "name": "Short Links Domain",
        "description": "Primary domain for link masking",
        "ssl_enabled": True,
        "default_redirect_type": "302",
        "status": "active",
        "priority": 1
    }
    
    domain_response = requests.post(f"{base_url}/api/masking/domains", 
                                   json=domain_data, headers=headers)
    
    if domain_response.status_code == 201:
        domain_result = domain_response.json()
        domain_id = domain_result['domain']['_id']
        print(f"✅ Domain created successfully!")
        print(f"   Domain: {domain_result['domain']['domain']}")
        print(f"   ID: {domain_id}")
    else:
        print(f"❌ Failed to create domain: {domain_response.text}")
        return False
    
    # Step 3: Get all domains
    print("\n📋 Getting all domains...")
    domains_response = requests.get(f"{base_url}/api/masking/domains", headers=headers)
    
    if domains_response.status_code == 200:
        domains_result = domains_response.json()
        print(f"✅ Retrieved {len(domains_result['domains'])} domains")
        for domain in domains_result['domains']:
            print(f"   - {domain['domain']} ({domain['status']})")
    else:
        print(f"❌ Failed to get domains: {domains_response.text}")
    
    # Step 4: Create a test offer (if needed)
    print("\n📝 Creating test offer for masking...")
    offer_data = {
        "campaign_id": "MASK-001",
        "name": "Test Masking Offer",
        "description": "Test offer for link masking",
        "status": "active",
        "countries": ["US", "CA"],
        "payout": 3.00,
        "network": "TestNetwork",
        "target_url": "https://example.com/test-offer",
        "preview_url": "https://example.com/preview"
    }
    
    offer_response = requests.post(f"{base_url}/api/admin/offers", 
                                  json=offer_data, headers=headers)
    
    if offer_response.status_code == 201:
        offer_result = offer_response.json()
        offer_id = offer_result['offer']['offer_id']
        print(f"✅ Test offer created!")
        print(f"   Offer ID: {offer_id}")
        print(f"   Target URL: {offer_result['offer']['target_url']}")
    else:
        print(f"❌ Failed to create test offer: {offer_response.text}")
        return False
    
    # Step 5: Create masked link
    print(f"\n🔗 Creating masked link for offer {offer_id}...")
    masked_link_data = {
        "offer_id": offer_id,
        "target_url": offer_data["target_url"],
        "masking_settings": {
            "domain_id": domain_id,
            "use_custom_code": False,
            "code_length": 8,
            "redirect_type": "302",
            "subid_append": True,
            "preview_mode": False,
            "auto_rotation": False,
            "rotation_urls": []
        }
    }
    
    masked_link_response = requests.post(f"{base_url}/api/masking/masked-links", 
                                        json=masked_link_data, headers=headers)
    
    if masked_link_response.status_code == 201:
        masked_link_result = masked_link_response.json()
        masked_link = masked_link_result['masked_link']
        print(f"✅ Masked link created successfully!")
        print(f"   Masked URL: {masked_link['masked_url']}")
        print(f"   Short Code: {masked_link['short_code']}")
        print(f"   Sequence ID: {masked_link['sequence_id']}")
    else:
        print(f"❌ Failed to create masked link: {masked_link_response.text}")
        return False
    
    # Step 6: Create custom coded link
    print(f"\n🎯 Creating custom coded masked link...")
    custom_link_data = {
        "offer_id": offer_id,
        "target_url": offer_data["target_url"],
        "masking_settings": {
            "domain_id": domain_id,
            "use_custom_code": True,
            "custom_code": "CUSTOM123",
            "redirect_type": "301",
            "subid_append": True,
            "preview_mode": False,
            "auto_rotation": False,
            "rotation_urls": []
        }
    }
    
    custom_link_response = requests.post(f"{base_url}/api/masking/masked-links", 
                                        json=custom_link_data, headers=headers)
    
    if custom_link_response.status_code == 201:
        custom_link_result = custom_link_response.json()
        custom_link = custom_link_result['masked_link']
        print(f"✅ Custom masked link created!")
        print(f"   Masked URL: {custom_link['masked_url']}")
        print(f"   Custom Code: {custom_link['short_code']}")
    else:
        print(f"❌ Failed to create custom masked link: {custom_link_response.text}")
    
    # Step 7: Create link with URL rotation
    print(f"\n🔄 Creating masked link with URL rotation...")
    rotation_link_data = {
        "offer_id": offer_id,
        "target_url": offer_data["target_url"],
        "masking_settings": {
            "domain_id": domain_id,
            "use_custom_code": False,
            "code_length": 6,
            "redirect_type": "302",
            "subid_append": True,
            "preview_mode": False,
            "auto_rotation": True,
            "rotation_urls": [
                "https://example.com/alternate1",
                "https://example.com/alternate2",
                "https://example.com/alternate3"
            ]
        }
    }
    
    rotation_link_response = requests.post(f"{base_url}/api/masking/masked-links", 
                                          json=rotation_link_data, headers=headers)
    
    if rotation_link_response.status_code == 201:
        rotation_link_result = rotation_link_response.json()
        rotation_link = rotation_link_result['masked_link']
        print(f"✅ Rotation masked link created!")
        print(f"   Masked URL: {rotation_link['masked_url']}")
        print(f"   Rotation URLs: {len(rotation_link['rotation_urls']) + 1} total")
    else:
        print(f"❌ Failed to create rotation masked link: {rotation_link_response.text}")
    
    # Step 8: Get all masked links
    print(f"\n📋 Getting all masked links...")
    links_response = requests.get(f"{base_url}/api/masking/masked-links", headers=headers)
    
    if links_response.status_code == 200:
        links_result = links_response.json()
        print(f"✅ Retrieved {len(links_result['masked_links'])} masked links")
        for link in links_result['masked_links']:
            print(f"   - {link['short_code']} → {link['offer_id']} (clicks: {link['click_count']})")
    else:
        print(f"❌ Failed to get masked links: {links_response.text}")
    
    # Step 9: Test redirect functionality (preview mode)
    print(f"\n🔍 Testing redirect functionality...")
    preview_link_data = {
        "offer_id": offer_id,
        "target_url": offer_data["target_url"],
        "masking_settings": {
            "domain_id": domain_id,
            "use_custom_code": True,
            "custom_code": "PREVIEW",
            "redirect_type": "302",
            "subid_append": True,
            "preview_mode": True,
            "auto_rotation": False,
            "rotation_urls": []
        }
    }
    
    preview_response = requests.post(f"{base_url}/api/masking/masked-links", 
                                    json=preview_link_data, headers=headers)
    
    if preview_response.status_code == 201:
        preview_result = preview_response.json()
        preview_link = preview_result['masked_link']
        print(f"✅ Preview link created: {preview_link['masked_url']}")
        
        # Test the redirect endpoint
        domain_name = preview_link['domain_name']
        short_code = preview_link['short_code']
        
        redirect_response = requests.get(f"{base_url}/{domain_name}/{short_code}")
        
        if redirect_response.status_code == 200:
            redirect_result = redirect_response.json()
            print(f"✅ Preview mode working!")
            print(f"   Preview data: {redirect_result}")
        else:
            print(f"❌ Redirect test failed: {redirect_response.text}")
    
    # Step 10: Generate preview link utility
    print(f"\n🎯 Testing preview link generation utility...")
    preview_util_response = requests.get(f"{base_url}/api/masking/generate-preview/{offer_id}", 
                                        headers=headers)
    
    if preview_util_response.status_code == 200:
        preview_util_result = preview_util_response.json()
        print(f"✅ Preview link generated!")
        print(f"   Preview URL: {preview_util_result['preview_url']}")
        print(f"   Short Code: {preview_util_result['short_code']}")
    else:
        print(f"❌ Failed to generate preview link: {preview_util_response.text}")
    
    print(f"\n🎉 Link Masking System test completed!")
    print("=" * 50)
    
    return True

if __name__ == "__main__":
    try:
        success = test_link_masking_system()
        if success:
            print("\n✅ All tests passed!")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test script error: {str(e)}")
        sys.exit(1)
