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
    # Test with user IPs
    test_lookup("42.104.246.86")  # Aryan
    test_lookup("183.179.43.247")  # gamesbrothersoft37
    test_lookup("42.106.142.202")  # Aryan old
