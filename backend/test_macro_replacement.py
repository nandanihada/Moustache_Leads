#!/usr/bin/env python3
"""
Test script for macro replacement functionality
"""

from services.macro_replacement_service import macro_service

def test_macro_replacement():
    """Test macro replacement with various scenarios"""
    
    print("=" * 60)
    print("MACRO REPLACEMENT TEST")
    print("=" * 60)
    
    # Test 1: LeadAds URL
    print("\n📋 Test 1: LeadAds URL")
    print("-" * 60)
    url1 = "https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub={user_id}"
    context1 = {
        'user_id': '507f1f77bcf86cd799439011',
        'click_id': 'CLK-ABC123',
        'username': 'john123'
    }
    
    print(f"Original URL: {url1}")
    print(f"Context: {context1}")
    result1 = macro_service.replace_macros(url1, context1)
    print(f"Result URL:   {result1}")
    print(f"✅ Expected: https://leadads.go2jump.org/aff_c?offer_id=75999&aff_id=10843&aff_sub=507f1f77bcf86cd799439011")
    
    # Test 2: CPALead URL with multiple macros
    print("\n📋 Test 2: CPALead URL (Multiple Macros)")
    print("-" * 60)
    url2 = "https://cpalead.com/offer?id=12345&subid={user_id}&s2={click_id}"
    context2 = {
        'user_id': '608g2g88cdf97de890550122',
        'click_id': 'CLK-XYZ789',
    }
    
    print(f"Original URL: {url2}")
    print(f"Context: {context2}")
    result2 = macro_service.replace_macros(url2, context2)
    print(f"Result URL:   {result2}")
    print(f"✅ Expected: https://cpalead.com/offer?id=12345&subid=608g2g88cdf97de890550122&s2=CLK-XYZ789")
    
    # Test 3: Generic Partner with many macros
    print("\n📋 Test 3: Generic Partner (Many Macros)")
    print("-" * 60)
    url3 = "https://partner.com/offer?oid=99999&uid={user_id}&cid={click_id}&ts={timestamp}&country={country}"
    context3 = {
        'user_id': '709h3h99def08ef901661233',
        'click_id': 'CLK-TEST-001',
        'country': 'US',
    }
    
    print(f"Original URL: {url3}")
    print(f"Context: {context3}")
    result3 = macro_service.replace_macros(url3, context3)
    print(f"Result URL:   {result3}")
    print(f"✅ Timestamp will be current Unix time")
    
    # Test 4: URL without macros (should remain unchanged)
    print("\n📋 Test 4: Static URL (No Macros)")
    print("-" * 60)
    url4 = "https://static-partner.com/offer?id=12345&ref=direct"
    context4 = {
        'user_id': '507f1f77bcf86cd799439011',
    }
    
    print(f"Original URL: {url4}")
    print(f"Context: {context4}")
    result4 = macro_service.replace_macros(url4, context4)
    print(f"Result URL:   {result4}")
    print(f"✅ Should be unchanged: {url4 == result4}")
    
    # Test 5: Check for macros
    print("\n📋 Test 5: Macro Detection")
    print("-" * 60)
    test_urls = [
        "https://partner.com?uid={user_id}",
        "https://partner.com?uid=static_value",
        "https://partner.com?uid={user_id}&cid={click_id}",
    ]
    
    for url in test_urls:
        has_macros = macro_service.has_macros(url)
        macros = macro_service.extract_macros(url)
        print(f"URL: {url}")
        print(f"  Has macros: {has_macros}")
        print(f"  Macros found: {macros}")
    
    # Test 6: Validate macros
    print("\n📋 Test 6: Macro Validation")
    print("-" * 60)
    test_validation_urls = [
        "https://partner.com?uid={user_id}&cid={click_id}",  # Valid
        "https://partner.com?uid={invalid_macro}",  # Invalid
        "https://partner.com?uid={user_id}&bad={unknown_param}",  # Mixed
    ]
    
    for url in test_validation_urls:
        is_valid, unsupported = macro_service.validate_macros(url)
        print(f"URL: {url}")
        print(f"  Valid: {is_valid}")
        if unsupported:
            print(f"  Unsupported macros: {unsupported}")
    
    # Test 7: List supported macros
    print("\n📋 Test 7: Supported Macros")
    print("-" * 60)
    supported = macro_service.get_supported_macros()
    print("Supported macros:")
    for macro, description in supported.items():
        print(f"  {{{macro}}} - {description}")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED")
    print("=" * 60)


if __name__ == '__main__':
    test_macro_replacement()
