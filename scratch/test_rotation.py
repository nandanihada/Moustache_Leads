import requests
import time

url = "http://localhost:5000/smart-link/global?pub_id=68e4e41a4ad662563fdb568a"

print("Testing Smart Link Rotation...")
results = []
for i in range(5):
    try:
        # We use allow_redirects=False to see where it's going
        response = requests.get(url, allow_redirects=False)
        target = response.headers.get('Location', 'No Location')
        print(f"Click {i+1}: Redirects to -> {target}")
        results.append(target)
    except Exception as e:
        print(f"Error: {e}")

if len(set(results)) > 1:
    print("\nSUCCESS: Offers are rotating!")
else:
    print("\nFAILURE: Offers are NOT rotating (or only one offer matches).")
