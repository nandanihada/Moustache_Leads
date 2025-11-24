#!/usr/bin/env python3

import requests
import json

BASE_URL = 'http://localhost:5000'

print("Testing admin offer access requests endpoint\n")

# Login as admin
print("1. Logging in as admin...")
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)

print(f"   Status: {login.status_code}")
if login.status_code != 200:
    print(f"   Error: {login.text}")
    exit(1)

token = login.json().get('token')
print(f"   Token: {token[:30]}...\n")

headers = {'Authorization': f'Bearer {token}'}

# Get access requests
print("2. Getting access requests...")
resp = requests.get(
    f'{BASE_URL}/api/admin/offer-access-requests',
    headers=headers
)

print(f"   Status: {resp.status_code}")
print(f"   Content-Type: {resp.headers.get('Content-Type')}")

if resp.status_code == 200:
    data = resp.json()
    print(f"   Requests found: {data.get('pagination', {}).get('total', 0)}")
    print(f"   Response keys: {list(data.keys())}")
else:
    print(f"   Error response:")
    print(f"   {resp.text[:500]}")

# Get stats
print("\n3. Getting access request stats...")
stats_resp = requests.get(
    f'{BASE_URL}/api/admin/offer-access-requests/stats',
    headers=headers
)

print(f"   Status: {stats_resp.status_code}")
if stats_resp.status_code == 200:
    data = stats_resp.json()
    print(f"   Stats: {data.get('stats', {})}")
else:
    print(f"   Error: {stats_resp.text[:500]}")
