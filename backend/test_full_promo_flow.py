"""
Complete End-to-End Test for Promo Code Feature
Tests the full flow: Create Code → Apply Code → Track Earnings → Process Bonuses
"""

import requests
import json
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:5000"

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
PUBLISHER_USERNAME = "jenny"
PUBLISHER_PASSWORD = "12345678"

class FullPromoCodeTester:
    def __init__(self):
        self.admin_token = None
        self.publisher_token = None
        self.promo_code_id = None
        self.user_promo_code_id = None
        self.test_results = []
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def log(self, message, status="INFO"):
        """Print formatted log message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        status_symbol = {
            "INFO": "ℹ️ ",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️ ",
            "TEST": "🧪"
        }.get(status, "→ ")
        
        print(f"[{timestamp}] {status_symbol} {message}")
    
    def test_result(self, test_name, passed, details=""):
        """Record test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        if passed:
            self.log(f"✅ {test_name}", "SUCCESS")
        else:
            self.log(f"❌ {test_name}: {details}", "ERROR")
    
    def print_summary(self):
        """Print test summary"""
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = total - passed
        
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        print("="*60 + "\n")
        
        if failed > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
    
    # ==================== AUTHENTICATION ====================
    
    def get_admin_token(self):
        """Get admin authentication token"""
        self.log("Getting admin token...", "TEST")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
                self.test_result("Get Admin Token", True)
                return True
            else:
                self.test_result("Get Admin Token", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Admin Token", False, str(e))
            return False
    
    def get_publisher_token(self):
        """Get publisher authentication token"""
        self.log("Getting publisher token...", "TEST")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": PUBLISHER_USERNAME, "password": PUBLISHER_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.publisher_token = data.get('token')
                self.test_result("Get Publisher Token", True)
                return True
            else:
                self.test_result("Get Publisher Token", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Publisher Token", False, str(e))
            return False
    
    # ==================== PROMO CODE CREATION ====================
    
    def create_promo_code(self):
        """Create a test promo code"""
        self.log("Creating promo code...", "TEST")
        
        code_data = {
            "code": f"TEST{self.timestamp}",
            "name": f"Test Promo Code {self.timestamp}",
            "description": "Test promo code for full flow testing",
            "bonus_type": "percentage",
            "bonus_amount": 20,
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "max_uses": 100,
            "max_uses_per_user": 5,
            "applicable_offers": [],
            "applicable_categories": []
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes",
                json=code_data,
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 201:
                data = response.json()
                self.promo_code_id = data.get('promo_code', {}).get('_id')
                self.test_result("Create Promo Code", True)
                self.log(f"Code: {code_data['code']}, ID: {self.promo_code_id}", "SUCCESS")
                return True
            else:
                self.test_result("Create Promo Code", False, response.text)
                return False
        except Exception as e:
            self.test_result("Create Promo Code", False, str(e))
            return False
    
    # ==================== PROMO CODE APPLICATION ====================
    
    def apply_promo_code(self):
        """Apply promo code as publisher"""
        self.log("Applying promo code...", "TEST")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/publisher/promo-codes/apply",
                json={"code": f"TEST{self.timestamp}"},
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.user_promo_code_id = data.get('user_promo_code', {}).get('_id')
                self.test_result("Apply Promo Code", True)
                self.log(f"Applied code, ID: {self.user_promo_code_id}", "SUCCESS")
                return True
            else:
                self.test_result("Apply Promo Code", False, response.text)
                return False
        except Exception as e:
            self.test_result("Apply Promo Code", False, str(e))
            return False
    
    # ==================== VERIFY APPLICATION ====================
    
    def verify_code_applied(self):
        """Verify code appears in active codes"""
        self.log("Verifying code is active...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/promo-codes/active",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                codes = data.get('codes', [])
                
                # Check if our code is in the list
                found = any(c['code'] == f"TEST{self.timestamp}" for c in codes)
                
                if found:
                    self.test_result("Verify Code Applied", True)
                    self.log(f"Found code in active codes list", "SUCCESS")
                    return True
                else:
                    self.test_result("Verify Code Applied", False, "Code not found in active list")
                    return False
            else:
                self.test_result("Verify Code Applied", False, response.text)
                return False
        except Exception as e:
            self.test_result("Verify Code Applied", False, str(e))
            return False
    
    # ==================== BONUS SUMMARY ====================
    
    def check_bonus_summary(self):
        """Check publisher bonus summary"""
        self.log("Checking bonus summary...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/bonus/summary",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_result("Get Bonus Summary", True)
                self.log(f"Total Earned: ${data.get('total_earned', 0):.2f}", "SUCCESS")
                self.log(f"Pending: ${data.get('pending', 0):.2f}", "SUCCESS")
                self.log(f"Credited: ${data.get('credited', 0):.2f}", "SUCCESS")
                self.log(f"Balance: ${data.get('current_balance', 0):.2f}", "SUCCESS")
                return True
            else:
                self.test_result("Get Bonus Summary", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Bonus Summary", False, str(e))
            return False
    
    # ==================== ADMIN ANALYTICS ====================
    
    def check_promo_analytics(self):
        """Check promo code analytics"""
        self.log("Checking promo code analytics...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/promo-codes/{self.promo_code_id}/analytics",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                analytics = data.get('analytics', {})
                self.test_result("Get Promo Analytics", True)
                self.log(f"Usage Count: {analytics.get('usage_count', 0)}", "SUCCESS")
                self.log(f"Total Distributed: ${analytics.get('total_bonus_distributed', 0):.2f}", "SUCCESS")
                self.log(f"Unique Users: {analytics.get('unique_users_count', 0)}", "SUCCESS")
                return True
            else:
                self.test_result("Get Promo Analytics", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Promo Analytics", False, str(e))
            return False
    
    # ==================== ADMIN BONUS STATS ====================
    
    def check_admin_bonus_stats(self):
        """Check admin bonus statistics"""
        self.log("Checking admin bonus statistics...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/bonus/statistics",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_result("Get Bonus Statistics", True)
                self.log(f"Total Bonus: ${data.get('total_bonus', 0):.2f}", "SUCCESS")
                self.log(f"Pending: ${data.get('pending_bonus', 0):.2f}", "SUCCESS")
                self.log(f"Credited: ${data.get('credited_bonus', 0):.2f}", "SUCCESS")
                self.log(f"Unique Users: {data.get('unique_users_count', 0)}", "SUCCESS")
                return True
            else:
                self.test_result("Get Bonus Statistics", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Bonus Statistics", False, str(e))
            return False
    
    # ==================== PAUSE/RESUME ====================
    
    def pause_promo_code(self):
        """Pause the promo code"""
        self.log("Pausing promo code...", "TEST")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes/{self.promo_code_id}/pause",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                self.test_result("Pause Promo Code", True)
                return True
            else:
                self.test_result("Pause Promo Code", False, response.text)
                return False
        except Exception as e:
            self.test_result("Pause Promo Code", False, str(e))
            return False
    
    def resume_promo_code(self):
        """Resume the promo code"""
        self.log("Resuming promo code...", "TEST")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/promo-codes/{self.promo_code_id}/resume",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                self.test_result("Resume Promo Code", True)
                return True
            else:
                self.test_result("Resume Promo Code", False, response.text)
                return False
        except Exception as e:
            self.test_result("Resume Promo Code", False, str(e))
            return False
    
    # ==================== AVAILABLE CODES ====================
    
    def check_available_codes(self):
        """Check available codes for publisher"""
        self.log("Checking available codes...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/promo-codes/available",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                codes = data.get('codes', [])
                self.test_result("Get Available Codes", True)
                self.log(f"Found {len(codes)} available codes", "SUCCESS")
                return True
            else:
                self.test_result("Get Available Codes", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Available Codes", False, str(e))
            return False
    
    # ==================== BONUS EARNINGS ====================
    
    def check_bonus_earnings(self):
        """Check publisher bonus earnings"""
        self.log("Checking bonus earnings...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/publisher/bonus/earnings",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                earnings = data.get('bonus_earnings', [])
                self.test_result("Get Bonus Earnings", True)
                self.log(f"Found {len(earnings)} bonus earnings", "SUCCESS")
                
                if earnings:
                    for earning in earnings[:3]:  # Show first 3
                        self.log(f"  - Code: {earning.get('code')}, Amount: ${earning.get('bonus_amount', 0):.2f}, Status: {earning.get('status')}", "INFO")
                
                return True
            else:
                self.test_result("Get Bonus Earnings", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Bonus Earnings", False, str(e))
            return False
    
    # ==================== ADMIN EARNINGS ====================
    
    def check_admin_earnings(self):
        """Check admin bonus earnings list"""
        self.log("Checking admin bonus earnings...", "TEST")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/bonus/earnings?limit=10",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                earnings = data.get('bonus_earnings', [])
                self.test_result("Get Admin Bonus Earnings", True)
                self.log(f"Found {len(earnings)} bonus earnings", "SUCCESS")
                return True
            else:
                self.test_result("Get Admin Bonus Earnings", False, response.text)
                return False
        except Exception as e:
            self.test_result("Get Admin Bonus Earnings", False, str(e))
            return False
    
    # ==================== PROCESS BONUSES ====================
    
    def process_pending_bonuses(self):
        """Process pending bonuses"""
        self.log("Processing pending bonuses...", "TEST")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin/bonus/process-pending?limit=50",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_result("Process Pending Bonuses", True)
                self.log(f"Processed {data.get('processed', 0)} bonuses", "SUCCESS")
                self.log(f"Total: ${data.get('total_bonus', 0):.2f}", "SUCCESS")
                return True
            else:
                self.test_result("Process Pending Bonuses", False, response.text)
                return False
        except Exception as e:
            self.test_result("Process Pending Bonuses", False, str(e))
            return False
    
    # ==================== REMOVE CODE ====================
    
    def remove_promo_code(self):
        """Remove the applied promo code"""
        self.log("Removing promo code...", "TEST")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/publisher/promo-codes/{self.user_promo_code_id}/remove",
                headers={"Authorization": f"Bearer {self.publisher_token}"}
            )
            
            if response.status_code == 200:
                self.test_result("Remove Promo Code", True)
                return True
            else:
                self.test_result("Remove Promo Code", False, response.text)
                return False
        except Exception as e:
            self.test_result("Remove Promo Code", False, str(e))
            return False
    
    # ==================== MAIN TEST FLOW ====================
    
    def run_full_test(self):
        """Run the complete test flow"""
        print("\n" + "="*60)
        print("PROMO CODE FULL FLOW TEST")
        print("="*60 + "\n")
        
        # Step 1: Authentication
        self.log("STEP 1: AUTHENTICATION", "TEST")
        if not self.get_admin_token():
            self.log("Cannot proceed without admin token", "ERROR")
            return
        
        if not self.get_publisher_token():
            self.log("Cannot proceed without publisher token", "ERROR")
            return
        
        # Step 2: Create Promo Code
        self.log("\nSTEP 2: CREATE PROMO CODE", "TEST")
        if not self.create_promo_code():
            self.log("Cannot proceed without promo code", "ERROR")
            return
        
        # Step 3: Check Available Codes
        self.log("\nSTEP 3: CHECK AVAILABLE CODES", "TEST")
        self.check_available_codes()
        
        # Step 4: Apply Promo Code
        self.log("\nSTEP 4: APPLY PROMO CODE", "TEST")
        if not self.apply_promo_code():
            self.log("Cannot proceed without applying code", "ERROR")
            return
        
        # Step 5: Verify Application
        self.log("\nSTEP 5: VERIFY CODE APPLIED", "TEST")
        self.verify_code_applied()
        
        # Step 6: Check Bonus Summary
        self.log("\nSTEP 6: CHECK BONUS SUMMARY", "TEST")
        self.check_bonus_summary()
        
        # Step 7: Check Bonus Earnings
        self.log("\nSTEP 7: CHECK BONUS EARNINGS", "TEST")
        self.check_bonus_earnings()
        
        # Step 8: Admin Analytics
        self.log("\nSTEP 8: ADMIN PROMO ANALYTICS", "TEST")
        self.check_promo_analytics()
        
        # Step 9: Admin Bonus Stats
        self.log("\nSTEP 9: ADMIN BONUS STATISTICS", "TEST")
        self.check_admin_bonus_stats()
        
        # Step 10: Admin Earnings
        self.log("\nSTEP 10: ADMIN BONUS EARNINGS", "TEST")
        self.check_admin_earnings()
        
        # Step 11: Pause Code
        self.log("\nSTEP 11: PAUSE PROMO CODE", "TEST")
        self.pause_promo_code()
        
        # Step 12: Resume Code
        self.log("\nSTEP 12: RESUME PROMO CODE", "TEST")
        self.resume_promo_code()
        
        # Step 13: Process Bonuses
        self.log("\nSTEP 13: PROCESS PENDING BONUSES", "TEST")
        self.process_pending_bonuses()
        
        # Step 14: Remove Code
        self.log("\nSTEP 14: REMOVE PROMO CODE", "TEST")
        self.remove_promo_code()
        
        # Print Summary
        self.print_summary()

def main():
    """Main entry point"""
    tester = FullPromoCodeTester()
    tester.run_full_test()

if __name__ == "__main__":
    main()
