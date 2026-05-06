import os
from services.ipinfo_service import get_ipinfo_service
from dotenv import load_dotenv

# Load .env
load_dotenv()

def test_lookup(ip):
    service = get_ipinfo_service()
    print(f"Testing IP: {ip}")
    data = service.lookup_ip(ip)
    print(f"Result: {data.get('country')} ({data.get('country_code')})")
    print(f"City: {data.get('city')}")
    print(f"ISP: {data.get('isp')}")
    print("-" * 20)

if __name__ == "__main__":
    # Test with some IPs
    test_lookup("8.8.8.8")  # Google (US)
    test_lookup("103.232.1.1")  # Bangladesh IP
    test_lookup("106.213.1.1")  # India IP
    test_lookup("127.0.0.1")  # Localhost
