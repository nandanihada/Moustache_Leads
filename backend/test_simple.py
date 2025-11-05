"""
Simple test to check if distribution works
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing partner postback distribution...")
print("=" * 60)

try:
    print("\n1. Testing imports...")
    from services.partner_postback_service import partner_postback_service
    print("✅ partner_postback_service imported")
    
    from database import db_instance
    print("✅ db_instance imported")
    
    print("\n2. Testing database connection...")
    if db_instance.is_connected():
        print("✅ Database connected")
    else:
        print("❌ Database NOT connected")
        sys.exit(1)
    
    print("\n3. Getting active partners...")
    partners = partner_postback_service.get_active_partners(db_instance)
    print(f"✅ Found {len(partners)} active partners")
    
    for p in partners:
        print(f"   - {p.get('username')}: {p.get('postback_url')}")
    
    if len(partners) == 0:
        print("⚠️ No active partners found!")
        sys.exit(0)
    
    print("\n4. Testing distribution...")
    test_data = {
        'click_id': 'SIMPLE_TEST_123',
        'status': 'approved',
        'payout': '99.99',
        'offer_id': 'TEST_OFFER'
    }
    
    result = partner_postback_service.distribute_to_all_partners(
        postback_data=test_data,
        db_instance=db_instance,
        source_log_id='simple_test'
    )
    
    print(f"\n5. Distribution Results:")
    print(f"   Total Partners: {result.get('total_partners')}")
    print(f"   Successful: {result.get('successful')}")
    print(f"   Failed: {result.get('failed')}")
    
    print("\n6. Individual Results:")
    for r in result.get('results', []):
        status = "✅" if r.get('success') else "❌"
        print(f"   {status} {r.get('partner_name')}")
        print(f"      URL: {r.get('postback_url')}")
        if r.get('error'):
            print(f"      Error: {r.get('error')}")
        if r.get('status_code'):
            print(f"      Status: {r.get('status_code')}")
    
    print("\n" + "=" * 60)
    print("✅ Test completed!")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)
