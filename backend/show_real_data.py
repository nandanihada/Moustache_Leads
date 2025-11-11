#!/usr/bin/env python3
"""
Show real conversion data with survey responses
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
import json

# Get partner conversions (with survey data)
convs = list(db_instance.get_collection('conversions').find({'partner_name': {'$exists': True}}).limit(3))

if not convs:
    print('No partner conversions found')
    sys.exit(1)

for i, conv in enumerate(convs, 1):
    print(f'\n🎯 REAL CONVERSION #{i} (FROM YOUR PARTNER):')
    print('='*70)
    print(f'\nTransaction ID: {conv.get("transaction_id")}')
    print(f'Conversion ID: {conv.get("conversion_id")}')
    print(f'Survey ID: {conv.get("survey_id")}')
    print(f'Partner: {conv.get("partner_name")}')
    print(f'Payout: ${conv.get("payout")}')
    print(f'Status: {conv.get("status")}')
    print(f'Session ID: {conv.get("session_id")}')
    
    print(f'\n📊 Survey Responses:')
    responses = conv.get('survey_responses', {})
    if responses:
        print(json.dumps(responses, indent=2))
    else:
        print('  (no survey responses)')
    
    print(f'\n📦 Raw Postback Data (All Fields):')
    postback = conv.get('raw_postback', {})
    if postback:
        for key, value in postback.items():
            print(f'  {key}: {value}')
    else:
        print('  (no raw postback)')
    
    print(f'\n✨ Total Fields in Custom Data: {len(conv.get("custom_data", {}))}')
    print('='*70)

print(f'\n💰 TOTAL CONVERSIONS: {db_instance.get_collection("conversions").count_documents({})}')
print(f'🎯 PARTNER CONVERSIONS: {len(convs)}')
print('='*70)
