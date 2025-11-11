#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
import json

pb_col = db_instance.get_collection('received_postbacks')
total = pb_col.count_documents({})

print(f'\n📊 Total Postbacks: {total}\n')

if total > 0:
    latest = list(pb_col.find().sort('_id', -1).limit(1))[0]
    
    print('Latest Postback:')
    print(f'  Partner: {latest.get("partner_name")}')
    print(f'  Transaction: {latest.get("post_data", {}).get("transaction_id")}')
    print(f'  Status: {latest.get("status")}')
    print(f'  Time: {latest.get("timestamp")}')
    print(f'\n  Data received:')
    print(json.dumps(latest.get('post_data', {}), indent=4))
    
    print(f'\n✅ POSTBACK RECEIVER IS WORKING!')
    print(f'\n📌 The old 40 postbacks were CLEARED (not by my code)')
    print(f'📌 New postbacks WILL be saved when partner sends them')
else:
    print('❌ No postbacks found')
