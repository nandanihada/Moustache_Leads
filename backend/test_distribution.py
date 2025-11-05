"""
Test partner postback distribution manually
"""

from services.partner_postback_service import partner_postback_service
from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_distribution():
    """Test the distribution service directly"""
    
    print("\n" + "="*60)
    print("TESTING PARTNER POSTBACK DISTRIBUTION")
    print("="*60 + "\n")
    
    # Sample postback data
    test_data = {
        'click_id': 'TEST_CLICK_123',
        'status': 'approved',
        'payout': '15.50',
        'offer_id': 'OFFER_789',
        'conversion_id': 'CONV_ABC',
        'transaction_id': 'TXN_XYZ',
        'timestamp': '1699200000'
    }
    
    print("📤 Test postback data:")
    for key, value in test_data.items():
        print(f"  {key}: {value}")
    
    print("\n🚀 Starting distribution...\n")
    
    # Run distribution
    result = partner_postback_service.distribute_to_all_partners(
        postback_data=test_data,
        db_instance=db_instance,
        source_log_id='manual_test'
    )
    
    print("\n" + "="*60)
    print("DISTRIBUTION RESULTS")
    print("="*60 + "\n")
    
    print(f"Total Partners: {result.get('total_partners', 0)}")
    print(f"Successful: {result.get('successful', 0)}")
    print(f"Failed: {result.get('failed', 0)}")
    
    if result.get('error'):
        print(f"\n❌ Error: {result.get('error')}")
    
    print("\n📋 Individual Results:")
    print("-" * 60)
    
    for r in result.get('results', []):
        print(f"\nPartner: {r.get('partner_name')}")
        print(f"Email: {r.get('partner_email')}")
        print(f"URL: {r.get('postback_url')}")
        print(f"Method: {r.get('method')}")
        print(f"Success: {'✅' if r.get('success') else '❌'}")
        if r.get('status_code'):
            print(f"Status Code: {r.get('status_code')}")
        if r.get('error'):
            print(f"Error: {r.get('error')}")
        if r.get('response_time'):
            print(f"Response Time: {r.get('response_time'):.3f}s")
        print("-" * 60)
    
    print("\n" + "="*60)

if __name__ == '__main__':
    test_distribution()
