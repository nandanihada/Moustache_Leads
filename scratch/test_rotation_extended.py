import requests
import time

url = "http://localhost:5000/smart-link/global?pub_id=68e4e41a4ad662563fdb568a"

print("Testing Smart Link Rotation and Pointer Persistence...")
results = []
for i in range(10):
    try:
        response = requests.get(url, allow_redirects=False)
        target = response.headers.get('Location', 'No Location')
        print(f"Click {i+1}: -> {target}")
        results.append(target)
    except Exception as e:
        print(f"Error: {e}")

unique_targets = len(set(results))
print(f"\nUnique targets: {unique_targets} out of 10 clicks")

if unique_targets > 1:
    print("SUCCESS: Offers are rotating.")
else:
    print("FAILURE: Offers are NOT rotating.")
