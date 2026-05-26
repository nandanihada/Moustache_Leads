import urllib.request
import json
import time

def test_endpoint(url):
    print(f"Testing URL: {url}")
    start = time.time()
    try:
        req = urllib.request.Request(url)
        # Add a dummy auth token if needed, or check if it returns 401/403 quickly
        with urllib.request.urlopen(req, timeout=5) as response:
            data = response.read()
            print(f"Success! Status: {response.status}, Time: {time.time() - start:.2f}s")
            print(data[:200])
    except Exception as e:
        print(f"Error: {e}, Time: {time.time() - start:.2f}s")

if __name__ == '__main__':
    # Test main flask server ping
    test_endpoint("http://localhost:5000/api/health")
    # Test auth / settings
    test_endpoint("http://localhost:5000/api/admin/automation/settings")
