#!/usr/bin/env python3
"""
Test geo-restriction with different IPs
"""

import sys
sys.path.append('.')

from services.ipinfo_service import get_ipinfo_service
from services.geo_restriction_service import get_geo_restriction_service
from database import db_instance

def test_ip_detection(ip_address):
    """Test IP detection"""
    print(f"\n{'='*80}")
    print(f"  Testing IP: {ip_address}")
    print(f"{'='*80}\n")
    
    ipinfo = get_ipinfo_service()
    ip_data = ipinfo.lookup_ip(ip_address)
    
    print(f"🌍 Country: {ip_data.get('country')} ({ip_data.get('country_code')})")
    print(f"📍 City: {ip_data.get('city')}")
    print(f"📍 Region: {ip_data.get('region')}")
    print(f"🏢 ISP: {ip_data.get('isp')}")
    print(f"🔒 VPN Detected: {ip_data.get('vpn_detection', {}).get('is_vpn', False)}")
    print(f"🔒 Proxy Detected: {ip_data.get('vpn_detection', {}).get('is_proxy', False)}")
    print(f"⚠️  Fraud Score: {ip_data.get('fraud_score', 0)}")
    
    return ip_data

def test_geo_restriction(ip_address, offer_id='ML-00135'):
    """Test geo-restriction for an IP"""
    print(f"\n{'='*80}")
    print(f"  Testing Geo-Restriction for IP: {ip_address}")
    print(f"{'='*80}\n")
    
    # Get offer
    offers_collection = db_instance.get_collection('offers')
    offer = offers_collection.find_one({'offer_id': offer_id})
    
    if not offer:
        print(f"❌ Offer {offer_id} not found!")
        return
    
    print(f"📝 Offer: {offer.get('name')}")
    print(f"🌍 Allowed Countries: {offer.get('allowed_countries', [])}")
    print(f"🔗 Non-Access URL: {offer.get('non_access_url', '(not set)')}")
    
    # Check access
    geo_service = get_geo_restriction_service()
    access_check = geo_service.check_country_access(
        offer=offer,
        user_ip=ip_address,
        user_context={'test': True}
    )
    
    print(f"\n{'='*80}")
    print(f"  ACCESS CHECK RESULT")
    print(f"{'='*80}\n")
    
    print(f"✅ Allowed: {access_check['allowed']}")
    print(f"🌍 Detected Country: {access_check['country_code']} ({access_check['country_name']})")
    print(f"📝 Reason: {access_check['reason']}")
    print(f"🔗 Redirect URL: {access_check['redirect_url'] or '(none - show error page)'}")
    
    if access_check['allowed']:
        print(f"\n✅ ACCESS GRANTED - User will be redirected to target URL")
    else:
        print(f"\n🚫 ACCESS DENIED - User will be redirected to non-access URL or shown error page")
    
    return access_check

if __name__ == '__main__':
    print("\n" + "="*80)
    print("  GEO-RESTRICTION TESTING WITH DIFFERENT IPs")
    print("="*80)
    
    # Test different IPs
    test_ips = [
        ('8.8.8.8', 'US - Google DNS'),
        ('1.1.1.1', 'AU - Cloudflare DNS'),
        ('103.21.124.1', 'IN - Indian IP'),
        ('127.0.0.1', 'Localhost'),
    ]
    
    for ip, description in test_ips:
        print(f"\n\n{'#'*80}")
        print(f"# {description}")
        print(f"{'#'*80}")
        
        # Test IP detection
        ip_data = test_ip_detection(ip)
        
        # Test geo-restriction
        access_check = test_geo_restriction(ip)
        
        print(f"\n")
    
    print(f"\n{'='*80}")
    print(f"  TESTING COMPLETE")
    print(f"{'='*80}\n")
