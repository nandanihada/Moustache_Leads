import requests
import json

res = requests.get('http://localhost:5000/api/admin/activity-logs', params={"limit": 5})
print(json.dumps(res.json(), indent=2))
