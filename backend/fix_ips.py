from database import db_instance
import requests
import json
import time

col = db_instance.get_collection('login_logs')
logs = col.find({'$or': [
    {'location.country_code': 'XX'},
    {'location.country': 'Unknown'},
    {'location.city': 'Unknown'}
]})
ips_to_resolve = set()
for log in logs:
    ip = log.get('ip_address')
    if ip and ip not in ['127.0.0.1', 'localhost', '::1', '']:
        ips_to_resolve.add(ip)

ip_list = list(ips_to_resolve)
print(f'Need to resolve {len(ip_list)} IPs.')

ip_data = {}
for i in range(0, len(ip_list), 100):
    batch = ip_list[i:i+100]
    res = requests.post('http://ip-api.com/batch?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,asname,query', json=batch).json()
    for item in res:
        if item.get('status') == 'success':
            ip_data[item['query']] = item
    time.sleep(2)

count = 0
for ip, info in ip_data.items():
    loc = {
        'ip': ip,
        'city': info.get('city', 'Unknown'),
        'region': info.get('regionName', 'Unknown'),
        'country': info.get('country', 'Unknown'),
        'country_code': info.get('countryCode', 'XX'),
        'latitude': info.get('lat', 0),
        'longitude': info.get('lon', 0),
        'timezone': info.get('time_zone', 'UTC'),
        'isp': info.get('isp', 'Unknown'),
        'domain': '',
        'asn': info.get('as', ''),
        'org': info.get('org', 'Unknown')
    }
    col.update_many({'ip_address': ip}, {'$set': {'location': loc}})
    count += 1

print(f'Successfully resolved and updated {count} unique IPs.')
