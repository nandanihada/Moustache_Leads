"""
Test script for Promo Code Feature
Run this to test all promo code functionality
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000"

# Test credentials - Update these to match your actual users
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # Change to your admin password
PUBLISHER_USERNAME = "jenny"
PUBLISHER_PASSWORD = "12345678"  # Change to your publisher password

class PromoCodeTester:
    def __init__(self):
        self.admin_token = None
        self.publisher_token = None
        self.created_code_id = None
        self.created_code_name = None  # Store dynamically created code name
        self.user_promo_code_id = None
    
    def log(self, message, status="INFO"):
        """Print formatted log message"""
        print(f"\n[{status}] {message}")
    
    def get_admin_token(self):
        """Get admin authentication token"""
        self.log("Getting admin token...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                }
            )
            if response.status_code == 200:
                self.admin_token = response.json().get('token')
                self.log(f"✅ Admin token obtained", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to get admin token: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting admin token: {str(e)}", "ERROR")
            return False
    
    def get_publisher_token(self):
        """Get publisher authentication token"""
        self.log("Getting publisher token...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "username": PUBLISHER_USERNAME,
                    "password": PUBLISHER_PASSWORD
                }
            )
            if response.status_code == 200:
                self.publisher_token = response.json().get('token')
                self.log(f"✅ Publisher token obtained", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to get publisher token: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting publisher token: {str(e)}", "ERROR")
            return False
    
    def create_promo_code(self):
        """Test: Create a new promo code"""
        self.log("Creating promo code...")
        try:
            import time
            # Generate unique code with timestamp
            unique_code = f"TEST{int(time.time() % 10000)}"
            today = datetime.utcnow()
            thirty_days = today + timedelta(days=30)
            
            payload = {
                "code": unique_code,
                "name": "Test 20% Bonus",
                "description": "Test promo code with 20% bonus",
                "bonus_type": "percentage",
                "bonus_amount": 20,
                "start_date": today.isoformat() + "Z",
                "end_date": thirty_days.isoformat() + "Z",
                "max_uses": 1000,
                "max_uses_per_user": 1,
                "min_payout": 0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json=payload
            )
            
            if response.status_code == 201:
                data = response.json()
                self.created_code_id = data['promo_code']['_id']
                self.created_code_name = data['promo_code']['code']  # Store code name
                self.log(f"✅ Promo code created: {data['promo_code']['code']}", "SUCCESS")
                print(json.dumps(data['promo_code'], indent=2, default=str))
                return True
            else:
                self.log(f"❌ Failed to create code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error creating code: {str(e)}", "ERROR")
            return False
    
    def list_promo_codes(self):
        """Test: List all promo codes"""
        self.log("Listing all promo codes...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/promo-codes?page=1&limit=10",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Found {data['total']} promo codes", "SUCCESS")
                for code in data['promo_codes']:
                    print(f"  - {code['code']}: {code['name']} ({code['status']})")
                return True
            else:
                self.log(f"❌ Failed to list codes: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error listing codes: {str(e)}", "ERROR")
            return False
    
    def get_code_details(self):
        """Test: Get specific code details"""
        self.log(f"Getting code details for {self.created_code_id}...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/promo-codes/{self.created_code_id}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Code details retrieved", "SUCCESS")
                print(json.dumps(data['promo_code'], indent=2, default=str))
                return True
            else:
                self.log(f"❌ Failed to get code details: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting code details: {str(e)}", "ERROR")
            return False
    
    def apply_promo_code(self):
        """Test: Apply promo code as publisher"""
        self.log("Applying promo code as publisher...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/publisher/promo-codes/apply",
                headers={"Authorization": f"Bearer {self.publisher_token}"},
                json={"code": self.created_code_name}  # Use dynamically created code
            )
            
            if response.status_code == 201:
                data = response.json()
                self.user_promo_code_id = data['user_promo_code']['_id']
                self.log(f"✅ Code applied successfully", "SUCCESS")
                print(json.dumps(data, indent=2, default=str))
                return True
            else:
                self.log(f"❌ Failed to apply code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error applying code: {str(e)}", "ERROR")
            return False
    
    def get_active_codes(self):
        """Test: Get publisher's active codes"""
        self.log("Getting publisher's active codes...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/promo-codes/active",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Found {data['total']} active codes", "SUCCESS")
                for code in data['active_codes']:
                    print(f"  - {code['code']}: ${code['total_bonus_earned']} earned")
                return True
            else:
                self.log(f"❌ Failed to get active codes: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting active codes: {str(e)}", "ERROR")
            return False
    
    def get_available_codes(self):
        """Test: Get available codes for publisher"""
        self.log("Getting available codes for publisher...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/promo-codes/available?page=1&limit=10",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Found {data['total']} available codes", "SUCCESS")
                for code in data['available_codes']:
                    status = "Already applied" if code.get('already_applied') else "Available"
                    print(f"  - {code['code']}: {code['bonus_amount']}% ({status})")
                return True
            else:
                self.log(f"❌ Failed to get available codes: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting available codes: {str(e)}", "ERROR")
            return False
    
    def get_bonus_balance(self):
        """Test: Get publisher's bonus balance"""
        self.log("Getting publisher's bonus balance...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/promo-codes/balance",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                balance = data['bonus_balance']
                self.log(f"✅ Bonus balance retrieved", "SUCCESS")
                print(f"  Total Earned: ${balance['total_earned']}")
                print(f"  Pending: ${balance['pending']}")
                print(f"  Credited: ${balance['credited']}")
                print(f"  Available: ${balance['available']}")
                return True
            else:
                self.log(f"❌ Failed to get balance: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting balance: {str(e)}", "ERROR")
            return False
    
    def get_analytics(self):
        """Test: Get code analytics"""
        self.log(f"Getting analytics for {self.created_code_id}...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/promo-codes/{self.created_code_id}/analytics",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                analytics = data['analytics']
                self.log(f"✅ Analytics retrieved", "SUCCESS")
                print(f"  Total Uses: {analytics['total_uses']}")
                print(f"  Users Applied: {analytics['users_applied']}")
                print(f"  Total Bonus Distributed: ${analytics['total_bonus_distributed']}")
                return True
            else:
                self.log(f"❌ Failed to get analytics: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting analytics: {str(e)}", "ERROR")
            return False
    
    def pause_code(self):
        """Test: Pause a code"""
        self.log(f"Pausing code {self.created_code_id}...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes/{self.created_code_id}/pause",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                self.log(f"✅ Code paused successfully", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to pause code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error pausing code: {str(e)}", "ERROR")
            return False
    
    def resume_code(self):
        """Test: Resume a code"""
        self.log(f"Resuming code {self.created_code_id}...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes/{self.created_code_id}/resume",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                self.log(f"✅ Code resumed successfully", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to resume code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error resuming code: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*60)
        print("PROMO CODE FEATURE - COMPREHENSIVE TEST SUITE")
        print("="*60)
        
        # Get tokens
        if not self.get_admin_token():
            return False
        
        if not self.get_publisher_token():
            return False
        
        # Admin tests
        print("\n" + "-"*60)
        print("ADMIN TESTS")
        print("-"*60)
        
        if not self.create_promo_code():
            return False
        
        if not self.list_promo_codes():
            return False
        
        if not self.get_code_details():
            return False
        
        # Publisher tests
        print("\n" + "-"*60)
        print("PUBLISHER TESTS")
        print("-"*60)
        
        if not self.get_available_codes():
            return False
        
        if not self.apply_promo_code():
            return False
        
        if not self.get_active_codes():
            return False
        
        if not self.get_bonus_balance():
            return False
        
        # Admin analytics
        print("\n" + "-"*60)
        print("ANALYTICS & MANAGEMENT")
        print("-"*60)
        
        if not self.get_analytics():
            return False
        
        if not self.pause_code():
            return False
        
        if not self.resume_code():
            return False
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
        print("="*60 + "\n")
        return True

if __name__ == "__main__":
    tester = PromoCodeTester()
    tester.run_all_tests()
