#!/usr/bin/env python3

import requests

print("Testing IPv4 localhost...")
try:
    resp = requests.post('http://127.0.0.1:5000/api/auth/login',
        json={'username': 'admin', 'password': 'admin123'},
        timeout=2
    )
    print(f"IPv4 Status: {resp.status_code}")
    print(f"IPv4 Content-Type: {resp.headers.get('Content-Type')}")
except Exception as e:
    print(f"IPv4 Error: {e}")

print("\nTesting IPv6 localhost...")
try:
    resp = requests.post('http://[::1]:5000/api/auth/login',
        json={'username': 'admin', 'password': 'admin123'},
        timeout=2
    )
    print(f"IPv6 Status: {resp.status_code}")
    print(f"IPv6 Content-Type: {resp.headers.get('Content-Type')}")
    if resp.status_code == 200:
        print(f"IPv6 Response: {resp.json()}")
except Exception as e:
    print(f"IPv6 Error: {e}")

print("\nTesting localhost...")
try:
    resp = requests.post('http://localhost:5000/api/auth/login',
        json={'username': 'admin', 'password': 'admin123'},
        timeout=2
    )
    print(f"localhost Status: {resp.status_code}")
    print(f"localhost Content-Type: {resp.headers.get('Content-Type')}")
except Exception as e:
    print(f"localhost Error: {e}")
