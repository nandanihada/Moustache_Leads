#!/usr/bin/env python3
"""
Comprehensive Test Script for Country-Based Offer Access Control
Tests all aspects of the geo-restriction feature
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from models.offer import Offer
from services.geo_restriction_service import get_geo_restriction_service
from services.ip2location_service import get_ip2location_service
from database import db_instance
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GeoRestrictionTester:
    """Test suite for geo-restriction feature"""
    
    def __init__(self):
        self.offer_model = Offer()
        self.geo_service = get_geo_restriction_service()
        self.ip2location = get_ip2location_service()
        self.test_offer_id = None
        self.results = []
        
    def print_header(self, title):
        """Print a formatted header"""
        print("\n" + "="*80)
        print(f"  {title}")
        print("="*80 + "\n")
    
    def print_result(self, test_name, passed, details=""):
        """Print test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"   {details}")
        self.results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
    
    def test_1_create_test_offer(self):
        """Test 1: Create a test offer with country restrictions"""
        self.print_header("TEST 1: Create Test Offer with Geo-Restrictions")
        
        try:
            offer_data = {
                'campaign_id': 'GEO-TEST-001',
                'name': 'Geo-Restricted Test Offer',
                'description': 'Test offer for country-based access control',
                'payout': 5.00,
                'network': 'Test Network',
                'target_url': 'https://example.com/offer',
                'preview_url': 'https://example.com/preview',
                'allowed_countries': ['US', 'CA', 'GB'],  # Only US, Canada, UK
                'non_access_url': 'https://example.com/not-available',
                'status': 'active'
            }
            
            offer, error = self.offer_model.create_offer(offer_data, 'test_admin')
            
            if offer and not error:
                self.test_offer_id = offer['offer_id']
                self.print_result(
                    "Create offer with geo-restrictions",
                    True,
                    f"Offer ID: {self.test_offer_id}, Allowed: {offer.get('allowed_countries')}"
                )
                return True
            else:
                self.print_result("Create offer with geo-restrictions", False, f"Error: {error}")
                return False
                
        except Exception as e:
            self.print_result("Create offer with geo-restrictions", False, f"Exception: {str(e)}")
            return False
    
    def test_2_ip_geolocation(self):
        """Test 2: Test IP geolocation detection"""
        self.print_header("TEST 2: IP Geolocation Detection")
        
        test_ips = [
            ('8.8.8.8', 'US', 'Google DNS - Should be US'),
            ('1.1.1.1', 'AU', 'Cloudflare DNS - Should be AU'),
            ('208.67.222.222', 'US', 'OpenDNS - Should be US'),
        ]
        
        all_passed = True
        for ip, expected_country, description in test_ips:
            try:
                ip_data = self.ip2location.lookup_ip(ip)
                detected_country = ip_data.get('country_code', 'XX')
                
                passed = detected_country == expected_country
                self.print_result(
                    f"Detect country for {ip}",
                    passed,
                    f"{description} - Detected: {detected_country} ({ip_data.get('country')})"
                )
                
                if not passed:
                    all_passed = False
                    
            except Exception as e:
                self.print_result(f"Detect country for {ip}", False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def test_3_allowed_country_access(self):
        """Test 3: Test access from allowed country"""
        self.print_header("TEST 3: Access from Allowed Country")
        
        if not self.test_offer_id:
            self.print_result("Access from allowed country", False, "No test offer created")
            return False
        
        try:
            # Get the test offer
            offer = self.offer_model.get_offer_by_id(self.test_offer_id)
            if not offer:
                self.print_result("Access from allowed country", False, "Test offer not found")
                return False
            
            # Test with US IP (8.8.8.8 - Google DNS)
            us_ip = '8.8.8.8'
            access_check = self.geo_service.check_country_access(
                offer=offer,
                user_ip=us_ip,
                user_context={'test': 'allowed_country'}
            )
            
            passed = access_check['allowed'] == True
            self.print_result(
                "Access from US (allowed)",
                passed,
                f"IP: {us_ip}, Country: {access_check['country_code']}, Allowed: {access_check['allowed']}"
            )
            
            return passed
            
        except Exception as e:
            self.print_result("Access from allowed country", False, f"Exception: {str(e)}")
            return False
    
    def test_4_blocked_country_access(self):
        """Test 4: Test access from blocked country"""
        self.print_header("TEST 4: Access from Blocked Country")
        
        if not self.test_offer_id:
            self.print_result("Access from blocked country", False, "No test offer created")
            return False
        
        try:
            # Get the test offer
            offer = self.offer_model.get_offer_by_id(self.test_offer_id)
            if not offer:
                self.print_result("Access from blocked country", False, "Test offer not found")
                return False
            
            # Test with Australian IP (1.1.1.1 - Cloudflare DNS)
            au_ip = '1.1.1.1'
            access_check = self.geo_service.check_country_access(
                offer=offer,
                user_ip=au_ip,
                user_context={'test': 'blocked_country'}
            )
            
            # Should be blocked (AU is not in allowed list)
            passed = access_check['allowed'] == False
            self.print_result(
                "Block access from AU (not allowed)",
                passed,
                f"IP: {au_ip}, Country: {access_check['country_code']}, Allowed: {access_check['allowed']}, "
                f"Redirect URL: {access_check['redirect_url']}"
            )
            
            return passed
            
        except Exception as e:
            self.print_result("Access from blocked country", False, f"Exception: {str(e)}")
            return False
    
    def test_5_non_access_url(self):
        """Test 5: Verify non-access URL is returned for blocked users"""
        self.print_header("TEST 5: Non-Access URL for Blocked Users")
        
        if not self.test_offer_id:
            self.print_result("Non-access URL", False, "No test offer created")
            return False
        
        try:
            offer = self.offer_model.get_offer_by_id(self.test_offer_id)
            if not offer:
                self.print_result("Non-access URL", False, "Test offer not found")
                return False
            
            # Test with blocked country
            au_ip = '1.1.1.1'
            access_check = self.geo_service.check_country_access(
                offer=offer,
                user_ip=au_ip,
                user_context={'test': 'non_access_url'}
            )
            
            expected_url = 'https://example.com/not-available'
            passed = (
                access_check['allowed'] == False and
                access_check['redirect_url'] == expected_url
            )
            
            self.print_result(
                "Non-access URL returned",
                passed,
                f"Expected: {expected_url}, Got: {access_check['redirect_url']}"
            )
            
            return passed
            
        except Exception as e:
            self.print_result("Non-access URL", False, f"Exception: {str(e)}")
            return False
    
    def test_6_access_logging(self):
        """Test 6: Verify blocked access attempts are logged"""
        self.print_header("TEST 6: Access Logging")
        
        if not self.test_offer_id:
            self.print_result("Access logging", False, "No test offer created")
            return False
        
        try:
            # Get logs for the test offer
            logs = self.geo_service.get_blocked_access_logs(
                offer_id=self.test_offer_id,
                limit=10
            )
            
            # Should have at least 2 logs from previous tests
            passed = len(logs) >= 2
            self.print_result(
                "Blocked access logs created",
                passed,
                f"Found {len(logs)} log entries for offer {self.test_offer_id}"
            )
            
            # Print log details
            if logs:
                print("\n   Recent blocked access logs:")
                for log in logs[:3]:
                    print(f"   - {log['user_country_code']} ({log['user_country_name']}) "
                          f"from IP {log['user_ip']} at {log['blocked_at']}")
            
            return passed
            
        except Exception as e:
            self.print_result("Access logging", False, f"Exception: {str(e)}")
            return False
    
    def test_7_no_restrictions(self):
        """Test 7: Test offer with no country restrictions"""
        self.print_header("TEST 7: Offer with No Restrictions")
        
        try:
            # Create offer without restrictions
            offer_data = {
                'campaign_id': 'NO-GEO-001',
                'name': 'No Geo-Restrictions Offer',
                'payout': 3.00,
                'network': 'Test Network',
                'target_url': 'https://example.com/open-offer',
                'allowed_countries': [],  # No restrictions
                'status': 'active'
            }
            
            offer, error = self.offer_model.create_offer(offer_data, 'test_admin')
            
            if not offer:
                self.print_result("Create unrestricted offer", False, f"Error: {error}")
                return False
            
            # Test access from any country
            au_ip = '1.1.1.1'
            access_check = self.geo_service.check_country_access(
                offer=offer,
                user_ip=au_ip,
                user_context={'test': 'no_restrictions'}
            )
            
            passed = access_check['allowed'] == True
            self.print_result(
                "Access allowed without restrictions",
                passed,
                f"Country: {access_check['country_code']}, Allowed: {access_check['allowed']}"
            )
            
            return passed
            
        except Exception as e:
            self.print_result("Offer with no restrictions", False, f"Exception: {str(e)}")
            return False
    
    def test_8_statistics(self):
        """Test 8: Test geo-restriction statistics"""
        self.print_header("TEST 8: Geo-Restriction Statistics")
        
        try:
            stats = self.geo_service.get_blocked_access_stats(days=7)
            
            passed = 'total_blocked' in stats and stats['total_blocked'] >= 0
            self.print_result(
                "Get geo-restriction statistics",
                passed,
                f"Total blocked: {stats.get('total_blocked', 0)}, "
                f"Countries: {len(stats.get('by_country', []))}"
            )
            
            # Print top blocked countries
            if stats.get('by_country'):
                print("\n   Top blocked countries:")
                for country in stats['by_country'][:5]:
                    print(f"   - {country['_id']}: {country['count']} attempts")
            
            return passed
            
        except Exception as e:
            self.print_result("Geo-restriction statistics", False, f"Exception: {str(e)}")
            return False
    
    def test_9_update_restrictions(self):
        """Test 9: Update offer geo-restrictions"""
        self.print_header("TEST 9: Update Geo-Restrictions")
        
        if not self.test_offer_id:
            self.print_result("Update restrictions", False, "No test offer created")
            return False
        
        try:
            # Update to allow only India
            update_data = {
                'allowed_countries': ['IN'],
                'non_access_url': 'https://example.com/india-only'
            }
            
            success, error = self.offer_model.update_offer(
                self.test_offer_id,
                update_data,
                'test_admin'
            )
            
            if not success:
                self.print_result("Update restrictions", False, f"Error: {error}")
                return False
            
            # Verify update
            offer = self.offer_model.get_offer_by_id(self.test_offer_id)
            passed = offer.get('allowed_countries') == ['IN']
            
            self.print_result(
                "Update geo-restrictions",
                passed,
                f"New allowed countries: {offer.get('allowed_countries')}"
            )
            
            return passed
            
        except Exception as e:
            self.print_result("Update restrictions", False, f"Exception: {str(e)}")
            return False
    
    def cleanup(self):
        """Clean up test data"""
        self.print_header("CLEANUP")
        
        try:
            if self.test_offer_id:
                self.offer_model.delete_offer(self.test_offer_id)
                print(f"✅ Deleted test offer: {self.test_offer_id}")
        except Exception as e:
            print(f"⚠️ Cleanup error: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        self.print_header("TEST SUMMARY")
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r['passed'])
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%\n")
        
        if failed > 0:
            print("Failed Tests:")
            for result in self.results:
                if not result['passed']:
                    print(f"  ❌ {result['test']}")
                    if result['details']:
                        print(f"     {result['details']}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*80)
        print("  COUNTRY-BASED OFFER ACCESS CONTROL - COMPREHENSIVE TEST SUITE")
        print("="*80)
        
        # Check database connection
        if not db_instance.is_connected():
            print("\n❌ ERROR: Database not connected!")
            print("Please ensure MongoDB is running and configured correctly.\n")
            return False
        
        print("\n✅ Database connected successfully\n")
        
        # Run all tests
        try:
            self.test_1_create_test_offer()
            self.test_2_ip_geolocation()
            self.test_3_allowed_country_access()
            self.test_4_blocked_country_access()
            self.test_5_non_access_url()
            self.test_6_access_logging()
            self.test_7_no_restrictions()
            self.test_8_statistics()
            self.test_9_update_restrictions()
            
        except Exception as e:
            logger.error(f"Test suite error: {str(e)}", exc_info=True)
        
        finally:
            # Always cleanup
            self.cleanup()
            
            # Print summary
            self.print_summary()
        
        return True


def main():
    """Main test runner"""
    tester = GeoRestrictionTester()
    tester.run_all_tests()


if __name__ == '__main__':
    main()
