#!/usr/bin/env python3

import requests

BASE_URL = 'http://localhost:5000'

print("Testing basic connectivity...")

try:
    resp = requests.get(f'{BASE_URL}/', timeout=5)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:200]}")
except Exception as e:
    print(f"Error: {e}")

print("\nTesting login endpoint...")
try:
    resp = requests.post(f'{BASE_URL}/api/auth/login',
        json={'username': 'admin', 'password': 'admin123'},
        timeout=5
    )
    print(f"Status: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    print(f"Response length: {len(resp.text)}")
    if resp.text:
        print(f"Response: {resp.text[:200]}")
    else:
        print("Empty response!")
except Exception as e:
    print(f"Error: {e}")
