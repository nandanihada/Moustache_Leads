"""
Check what IPHub.info returns for your actual production IPs
"""

import requests
import json

# IPs from your screenshot
production_ips = [
    "105.207.219.12",  # From screenshot
    "23.106.249.53",   # From earlier screenshot
]

print("="*70)
print("CHECKING IPHUB.INFO API FOR YOUR IPs")
print("="*70)

for ip in production_ips:
    print(f"\n{'='*70}")
    print(f"IP: {ip}")
    print(f"{'='*70}")
    
    try:
        url = f"http://v2.api.iphub.info/ip/{ip}"
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Print full response
            print(f"\nFull API Response:")
            print(json.dumps(data, indent=2))
            
            # Extract key fields
            block = data.get('block', 0)
            isp = data.get('isp', 'Unknown')
            country = data.get('countryName', 'Unknown')
            country_code = data.get('countryCode', 'Unknown')
            
            print(f"\nKey Fields:")
            print(f"  Block Level: {block}")
            print(f"  ISP: {isp}")
            print(f"  Country: {country} ({country_code})")
            
            # Check if ISP contains VPN keywords
            isp_lower = isp.lower()
            vpn_keywords = ['vpn', 'proxy', 'browsec', 'zenmate']
            
            has_vpn_keyword = any(kw in isp_lower for kw in vpn_keywords)
            
            print(f"\nVPN Detection:")
            print(f"  ISP contains VPN keyword: {has_vpn_keyword}")
            
            if block == 0:
                print(f"  IPHub Classification: Residential IP (Clean)")
            elif block == 1:
                print(f"  IPHub Classification: Datacenter/Hosting/Proxy")
            else:
                print(f"  IPHub Classification: Mixed")
            
            # Determine if our code would detect this as VPN
            would_detect = block >= 1 or has_vpn_keyword
            
            print(f"\nWOULD OUR CODE DETECT VPN: {would_detect}")
            
            if not would_detect:
                print(f"\n  WHY NOT DETECTED:")
                print(f"    - Block level is 0 (residential)")
                print(f"    - ISP name '{isp}' doesn't contain VPN keywords")
                print(f"\n  POSSIBLE REASONS:")
                print(f"    1. You're not actually using VPN")
                print(f"    2. VPN is using residential IPs (harder to detect)")
                print(f"    3. IPHub doesn't recognize this VPN provider")
                
        elif response.status_code == 429:
            print(f"  ERROR: Rate limit exceeded")
        else:
            print(f"  ERROR: API returned status {response.status_code}")
            print(f"  Response: {response.text}")
            
    except Exception as e:
        print(f"  ERROR: {e}")

print("\n" + "="*70)
print("SUMMARY")
print("="*70)
print("\nIf IPHub returns block=0 and ISP doesn't contain 'VPN',")
print("then our detection won't flag it as VPN.")
print("\nThis could mean:")
print("  1. VPN is using residential IPs (Browsec/ZenMate sometimes do this)")
print("  2. IPHub's free tier doesn't detect all VPNs")
print("  3. Need to use a different VPN detection API")
