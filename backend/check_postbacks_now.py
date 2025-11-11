#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

col = db_instance.get_collection('received_postbacks')

total = col.count_documents({})
received = col.count_documents({'status': 'received'})
processed = col.count_documents({'status': 'processed'})

print(f'\n📊 POSTBACKS STATUS:')
print(f'   Total: {total}')
print(f'   Received (unprocessed): {received}')
print(f'   Processed: {processed}')

if total == 0:
    print('\n❌ COLLECTION IS EMPTY!')
    print('\nPossible reasons:')
    print('1. Database was cleared')
    print('2. Collection was dropped')
    print('3. Connected to wrong database')
    print('\nCheck MongoDB connection!')
else:
    latest = list(col.find().sort('_id', -1).limit(3))
    print(f'\n📋 Latest 3 postbacks:')
    for pb in latest:
        print(f'   - {pb.get("timestamp")} | Status: {pb.get("status")} | Partner: {pb.get("partner_name")}')

# Check conversions too
conv_col = db_instance.get_collection('conversions')
conv_total = conv_col.count_documents({})
print(f'\n💰 Conversions: {conv_total}')

# Check clicks
clicks_col = db_instance.get_collection('clicks')
clicks_total = clicks_col.count_documents({})
print(f'👆 Clicks: {clicks_total}')
