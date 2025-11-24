#!/usr/bin/env python3
"""
Comprehensive test for offer approval workflow fix
Tests that publishers cannot access offers requiring approval until they request and get approved
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000/api"

# Test data
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
PUBLISHER_EMAIL = "publisher@test.com"
PUBLISHER_PASSWORD = "pub123"

def log_test(step, status, message=""):
    """Log test results"""
    emoji = "✅" if status else "❌"
    print(f"{emoji} {step}: {message}")

def get_admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get('token')
    return None

def get_publisher_token():
    """Get publisher authentication token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PUBLISHER_EMAIL,
        "password": PUBLISHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get('token')
    return None

def create_offer_with_approval(admin_token, approval_type="manual"):
    """Create an offer with approval workflow"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    offer_data = {
        "campaign_id": f"TEST-{approval_type.upper()}-{int(datetime.now().timestamp())}",
        "name": f"Test Offer - {approval_type} Approval",
        "description": f"Test offer requiring {approval_type} approval",
        "status": "active",
        "payout": 10.0,
        "currency": "USD",
        "network": "TestNetwork",
        "target_url": "https://example.com/offer",
        "countries": ["US"],
        "affiliates": "all",  # Will be auto-set to 'request'
        # Approval workflow settings
        "approval_type": approval_type,
        "require_approval": True if approval_type == "manual" else False,
        "auto_approve_delay": 5 if approval_type == "time_based" else 0,
        "approval_message": f"This offer requires {approval_type} approval from admin",
        "max_inactive_days": 30
    }
    
    response = requests.post(f"{BASE_URL}/admin/offers", json=offer_data, headers=headers)
    
    if response.status_code == 200:
        return response.json().get('offer')
    else:
        print(f"❌ Failed to create offer: {response.text}")
        return None

def get_publisher_offers(publisher_token):
    """Get available offers for publisher"""
    headers = {"Authorization": f"Bearer {publisher_token}"}
    response = requests.get(f"{BASE_URL}/publisher/offers/available", headers=headers)
    
    if response.status_code == 200:
        return response.json().get('offers', [])
    return []

def check_offer_access(publisher_token, offer_id):
    """Check if publisher has access to offer"""
    headers = {"Authorization": f"Bearer {publisher_token}"}
    response = requests.get(f"{BASE_URL}/publisher/offers/{offer_id}/access-status", headers=headers)
    
    if response.status_code == 200:
        return response.json()
    return None

def request_offer_access(publisher_token, offer_id, message=""):
    """Request access to an offer"""
    headers = {"Authorization": f"Bearer {publisher_token}"}
    response = requests.post(
        f"{BASE_URL}/publisher/offers/{offer_id}/request-access",
        json={"message": message},
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    return None

def get_access_requests(admin_token):
    """Get all access requests"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/admin/offer-access-requests", headers=headers)
    
    if response.status_code == 200:
        return response.json().get('requests', [])
    return []

def approve_access_request(admin_token, request_id):
    """Approve an access request"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/admin/offer-access-requests/{request_id}/approve",
        json={"notes": "Approved for testing"},
        headers=headers
    )
    
    return response.status_code == 200

def update_offer_approval(admin_token, offer_id, approval_type="manual"):
    """Update offer approval settings"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    update_data = {
        "approval_type": approval_type,
        "require_approval": True if approval_type == "manual" else False,
        "auto_approve_delay": 5 if approval_type == "time_based" else 0,
        "approval_message": f"Updated to {approval_type} approval"
    }
    
    response = requests.put(f"{BASE_URL}/admin/offers/{offer_id}", json=update_data, headers=headers)
    
    return response.status_code == 200

def run_tests():
    """Run comprehensive approval workflow tests"""
    print("\n" + "="*80)
    print("🧪 OFFER APPROVAL WORKFLOW FIX - COMPREHENSIVE TEST")
    print("="*80 + "\n")
    
    # Step 1: Get tokens
    print("📝 Step 1: Authentication")
    admin_token = get_admin_token()
    log_test("Admin login", admin_token is not None)
    
    publisher_token = get_publisher_token()
    log_test("Publisher login", publisher_token is not None)
    
    if not admin_token or not publisher_token:
        print("\n❌ Failed to authenticate. Ensure test users exist in database.")
        return
    
    # Step 2: Create offer with MANUAL approval
    print("\n📝 Step 2: Create Offer with MANUAL Approval")
    offer = create_offer_with_approval(admin_token, "manual")
    log_test("Offer created", offer is not None, f"Offer ID: {offer.get('offer_id') if offer else 'N/A'}")
    
    if not offer:
        return
    
    offer_id = offer['offer_id']
    
    # Verify affiliates field is set to 'request'
    log_test("Affiliates set to 'request'", offer.get('affiliates') == 'request', 
             f"Actual value: {offer.get('affiliates')}")
    
    # Step 3: Check publisher can see offer but doesn't have access
    print("\n📝 Step 3: Publisher Views Offer (Should NOT have access)")
    offers = get_publisher_offers(publisher_token)
    found_offer = next((o for o in offers if o['offer_id'] == offer_id), None)
    log_test("Offer visible to publisher", found_offer is not None)
    
    if found_offer:
        log_test("Publisher has NO access", not found_offer.get('has_access'),
                 f"has_access: {found_offer.get('has_access')}")
        log_test("Tracking URL NOT visible", 'target_url' not in found_offer,
                 f"Keys: {list(found_offer.keys())}")
        log_test("Preview mode enabled", found_offer.get('is_preview', False))
    
    # Step 4: Publisher requests access
    print("\n📝 Step 4: Publisher Requests Access")
    request_result = request_offer_access(publisher_token, offer_id, "Please grant me access to this offer")
    log_test("Access request submitted", request_result is not None)
    
    if request_result and 'request' in request_result:
        request_id = request_result['request']['request_id']
        log_test("Request status is PENDING", 
                 request_result['request'].get('status') == 'pending',
                 f"Status: {request_result['request'].get('status')}")
    
    # Step 5: Check publisher still doesn't have access
    print("\n📝 Step 5: Verify Publisher Still NO Access (Request Pending)")
    access_status = check_offer_access(publisher_token, offer_id)
    log_test("Publisher still has NO access", not access_status.get('has_access'),
             f"has_access: {access_status.get('has_access')}")
    log_test("Request status is PENDING", access_status.get('request_status') == 'pending')
    
    # Step 6: Admin approves request
    print("\n📝 Step 6: Admin Approves Access Request")
    requests_list = get_access_requests(admin_token)
    pending_request = next((r for r in requests_list if r.get('status') == 'pending'), None)
    
    if pending_request:
        request_id = pending_request['_id']
        approved = approve_access_request(admin_token, request_id)
        log_test("Request approved by admin", approved)
    
    # Step 7: Check publisher NOW has access
    print("\n📝 Step 7: Verify Publisher NOW Has Access")
    access_status = check_offer_access(publisher_token, offer_id)
    log_test("Publisher NOW has access", access_status.get('has_access'),
             f"has_access: {access_status.get('has_access')}")
    log_test("Request status is APPROVED", access_status.get('request_status') == 'approved')
    
    # Step 8: Verify tracking URL is visible
    print("\n📝 Step 8: Verify Tracking URL Visible")
    offers = get_publisher_offers(publisher_token)
    found_offer = next((o for o in offers if o['offer_id'] == offer_id), None)
    
    if found_offer:
        log_test("Tracking URL now visible", 'target_url' in found_offer,
                 f"URL: {found_offer.get('target_url', 'N/A')}")
        log_test("Preview mode disabled", not found_offer.get('is_preview', False))
    
    # Step 9: Test EDITING offer to change approval type
    print("\n📝 Step 9: Edit Offer - Change to TIME-BASED Approval")
    updated = update_offer_approval(admin_token, offer_id, "time_based")
    log_test("Offer approval settings updated", updated)
    
    # Step 10: Verify new approval settings
    print("\n📝 Step 10: Verify Updated Approval Settings")
    offers = get_publisher_offers(publisher_token)
    found_offer = next((o for o in offers if o['offer_id'] == offer_id), None)
    
    if found_offer:
        log_test("Approval type updated", found_offer.get('approval_type') == 'time_based',
                 f"Type: {found_offer.get('approval_type')}")
    
    print("\n" + "="*80)
    print("✅ ALL TESTS COMPLETED")
    print("="*80 + "\n")

if __name__ == "__main__":
    run_tests()
