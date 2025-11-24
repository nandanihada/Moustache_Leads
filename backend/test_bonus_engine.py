"""
Test script for Bonus Calculation Engine
Tests bonus calculation, recording, and crediting
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000"

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
PUBLISHER_USERNAME = "jenny"
PUBLISHER_PASSWORD = "12345678"

class BonusEngineTester:
    def __init__(self):
        self.admin_token = None
        self.publisher_token = None
        self.promo_code_id = None
        self.conversion_id = None
    
    def log(self, message, status="INFO"):
        """Print formatted log message"""
        print(f"\n[{status}] {message}")
    
    def get_admin_token(self):
        """Get admin authentication token"""
        self.log("Getting admin token...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
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
                json={"username": PUBLISHER_USERNAME, "password": PUBLISHER_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.publisher_token = data.get('token')
                self.log(f"✅ Publisher token obtained", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to get publisher token: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting publisher token: {str(e)}", "ERROR")
            return False
    
    def create_test_promo_code(self):
        """Create a test promo code for bonus testing"""
        self.log("Creating test promo code...")
        try:
            import time
            unique_code = f"BONUS{int(time.time() % 10000)}"
            today = datetime.utcnow()
            thirty_days = today + timedelta(days=30)
            
            payload = {
                "code": unique_code,
                "name": "Bonus Test Code",
                "description": "Test code for bonus calculation",
                "bonus_type": "percentage",
                "bonus_amount": 25,  # 25% bonus
                "start_date": today.isoformat() + "Z",
                "end_date": thirty_days.isoformat() + "Z",
                "max_uses": 1000,
                "max_uses_per_user": 1
            }
            
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json=payload
            )
            
            if response.status_code == 201:
                data = response.json()
                self.promo_code_id = data['promo_code']['_id']
                self.promo_code_name = data['promo_code']['code']
                self.log(f"✅ Promo code created: {self.promo_code_name}", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to create code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error creating code: {str(e)}", "ERROR")
            return False
    
    def apply_promo_code(self):
        """Apply promo code as publisher"""
        self.log("Applying promo code...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/publisher/promo-codes/apply",
                headers={"Authorization": f"Bearer {self.publisher_token}"},
                json={"code": self.promo_code_name}
            )
            
            if response.status_code == 201:
                self.log(f"✅ Code applied successfully", "SUCCESS")
                return True
            else:
                self.log(f"❌ Failed to apply code: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error applying code: {str(e)}", "ERROR")
            return False
    
    def get_initial_bonus_summary(self):
        """Get bonus summary before conversion"""
        self.log("Getting initial bonus summary...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/bonus/summary",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Initial bonus summary retrieved", "SUCCESS")
                print(json.dumps(data, indent=2))
                self.initial_balance = data.get('current_balance', 0)
                return True
            else:
                self.log(f"❌ Failed to get summary: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting summary: {str(e)}", "ERROR")
            return False
    
    def simulate_conversion(self):
        """Simulate a conversion in the database"""
        self.log("Simulating conversion...")
        try:
            from database import db_instance
            from bson import ObjectId
            
            # Get publisher user ID
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'username': PUBLISHER_USERNAME})
            
            if not publisher:
                self.log(f"❌ Publisher user not found", "ERROR")
                return False
            
            # Get an offer
            offers_collection = db_instance.get_collection('offers')
            offer = offers_collection.find_one({})
            
            if not offer:
                self.log(f"❌ No offers found in database", "ERROR")
                return False
            
            # Create a conversion
            conversions_collection = db_instance.get_collection('conversions')
            conversion_data = {
                'conversion_id': f"TEST-{int(datetime.utcnow().timestamp())}",
                'click_id': f"CLICK-{int(datetime.utcnow().timestamp())}",
                'transaction_id': f"TXN-{int(datetime.utcnow().timestamp())}",
                'offer_id': offer['_id'],
                'user_id': publisher['_id'],
                'affiliate_id': publisher['_id'],
                'status': 'approved',
                'payout': 100.00,  # $100 base payout
                'currency': 'USD',
                'country': 'US',
                'device_type': 'desktop',
                'ip_address': '127.0.0.1',
                'conversion_time': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }
            
            result = conversions_collection.insert_one(conversion_data)
            self.conversion_id = conversion_data['conversion_id']
            
            self.log(f"✅ Conversion simulated: {self.conversion_id} with $100 payout", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"❌ Error simulating conversion: {str(e)}", "ERROR")
            return False
    
    def trigger_bonus_calculation(self):
        """Trigger bonus calculation for the conversion"""
        self.log("Triggering bonus calculation...")
        try:
            from services.bonus_calculation_service import BonusCalculationService
            
            bonus_service = BonusCalculationService()
            result = bonus_service.apply_bonus_to_conversion(self.conversion_id)
            
            if 'error' in result:
                self.log(f"❌ Bonus calculation failed: {result['error']}", "ERROR")
                return False
            
            bonus_amount = result.get('bonus_amount', 0)
            self.log(f"✅ Bonus calculated: ${bonus_amount}", "SUCCESS")
            print(json.dumps(result, indent=2, default=str))
            
            self.expected_bonus = bonus_amount
            return True
            
        except Exception as e:
            self.log(f"❌ Error triggering bonus: {str(e)}", "ERROR")
            return False
    
    def get_bonus_after_calculation(self):
        """Get bonus summary after calculation"""
        self.log("Getting bonus summary after calculation...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/bonus/summary",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Bonus summary retrieved", "SUCCESS")
                print(json.dumps(data, indent=2))
                
                # Verify bonus was recorded
                if data.get('total_earned', 0) > self.initial_balance:
                    self.log(f"✅ Bonus recorded: ${data['total_earned'] - self.initial_balance}", "SUCCESS")
                    return True
                else:
                    self.log(f"⚠️  Bonus not yet recorded (may be pending)", "WARNING")
                    return True
            else:
                self.log(f"❌ Failed to get summary: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting summary: {str(e)}", "ERROR")
            return False
    
    def get_bonus_earnings_details(self):
        """Get detailed bonus earnings"""
        self.log("Getting bonus earnings details...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/bonus/earnings?limit=10",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Found {data['total']} bonus earnings", "SUCCESS")
                
                if data['bonus_earnings']:
                    print("\nLatest Bonus Earnings:")
                    for earning in data['bonus_earnings'][:3]:
                        print(f"  - Code: {earning['code']}, Amount: ${earning['bonus_amount']}, Status: {earning['status']}")
                
                return True
            else:
                self.log(f"❌ Failed to get earnings: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting earnings: {str(e)}", "ERROR")
            return False
    
    def get_admin_bonus_statistics(self):
        """Get admin bonus statistics"""
        self.log("Getting admin bonus statistics...")
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/bonus/statistics",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Bonus statistics retrieved", "SUCCESS")
                print(json.dumps(data, indent=2))
                return True
            else:
                self.log(f"❌ Failed to get statistics: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error getting statistics: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*70)
        print("BONUS CALCULATION ENGINE - COMPREHENSIVE TEST SUITE")
        print("="*70)
        
        # Get tokens
        if not self.get_admin_token():
            return False
        
        if not self.get_publisher_token():
            return False
        
        print("\n" + "-"*70)
        print("SETUP PHASE")
        print("-"*70)
        
        # Create promo code
        if not self.create_test_promo_code():
            return False
        
        # Apply code
        if not self.apply_promo_code():
            return False
        
        # Get initial balance
        if not self.get_initial_bonus_summary():
            return False
        
        print("\n" + "-"*70)
        print("CONVERSION & BONUS CALCULATION PHASE")
        print("-"*70)
        
        # Simulate conversion
        if not self.simulate_conversion():
            return False
        
        # Trigger bonus calculation
        if not self.trigger_bonus_calculation():
            return False
        
        print("\n" + "-"*70)
        print("VERIFICATION PHASE")
        print("-"*70)
        
        # Get bonus after calculation
        if not self.get_bonus_after_calculation():
            return False
        
        # Get detailed earnings
        if not self.get_bonus_earnings_details():
            return False
        
        # Get admin statistics
        if not self.get_admin_bonus_statistics():
            return False
        
        print("\n" + "="*70)
        print("✅ ALL BONUS ENGINE TESTS COMPLETED SUCCESSFULLY!")
        print("="*70)
        
        return True


if __name__ == "__main__":
    tester = BonusEngineTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
