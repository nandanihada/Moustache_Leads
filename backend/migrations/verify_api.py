import requests
r = requests.get('http://localhost:5000/api/offerwall/offers?placement_id=test123&user_id=user456&limit=10', timeout=30)
data = r.json()
offers = data.get('offers', [])
refined_count = sum(1 for o in offers if o.get('refined_description'))
print(f"First {len(offers)} offers: {refined_count} have refined_description")
for o in offers[:5]:
    rd = o.get('refined_description')
    has = "YES" if rd else "NO"
    summary = rd.get('summary', '')[:60] if rd else ''
    print(f"  {o['id']} ({o['title'][:30]}) — refined: {has}")
    if summary:
        print(f"    -> {summary}")
