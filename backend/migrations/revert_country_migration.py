"""
REVERT: Undo the bad fix_offer_countries.py migration.
Uses bulk_write for speed instead of individual update_one calls.
"""
import sys
import os
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance
from pymongo import UpdateOne

offers_col = db_instance.get_collection('offers')

# ============================================================
# STEP 1: Bulk revert ALL offers changed by the bad migration
# ============================================================

print("=" * 70)
print("STEP 1: Reverting ALL offers changed by fix_offer_countries.py")
print("=" * 70)

# The bad migration only touched active offers that had countries != ['US']
# and don't have API-provided geo data (allowed_countries).
# Use update_many for a single fast DB call instead of looping.

result = offers_col.update_many(
    {
        'is_active': True,
        'countries': {'$nin': [['US'], ['WW']]},
        '$or': [
            {'allowed_countries': {'$exists': False}},
            {'allowed_countries': []},
            {'allowed_countries': None}
        ]
    },
    {'$set': {'countries': ['US']}}
)

print(f"Reverted {result.modified_count} offers back to ['US']")
print()

# ============================================================
# STEP 2: Re-run with STRICT patterns only (using bulk_write)
# ============================================================

print("=" * 70)
print("STEP 2: Re-extracting countries with STRICT patterns only")
print("=" * 70)

ALL_ISO_CODES = {
    'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
    'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
    'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
    'DE','DJ','DK','DM','DO','DZ',
    'EC','EE','EG','EH','ER','ES','ET',
    'FI','FJ','FK','FM','FO','FR',
    'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
    'HK','HM','HN','HR','HT','HU',
    'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
    'JE','JM','JO','JP',
    'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
    'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
    'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
    'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
    'OM',
    'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
    'QA',
    'RE','RO','RS','RU','RW',
    'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
    'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
    'UA','UG','UM','US','UY','UZ',
    'VA','VC','VE','VG','VI','VN','VU',
    'WF','WS','XK','YE','YT','ZA','ZM','ZW','UK','WW'
}

STRICT_FALSE_POSITIVES = {
    'OK', 'CC', 'AI', 'BE', 'AT', 'BY', 'IN', 'IS', 'IT', 'TO', 'ME',
    'NO', 'OR', 'SO', 'DO', 'AN', 'ON', 'UP',
    'AM', 'PM', 'TV', 'IO', 'CO', 'MY', 'RS', 'MS',
}

# Extra false positives only for last-token pattern (more ambiguous)
LAST_TOKEN_FALSE_POSITIVES = STRICT_FALSE_POSITIVES | {'US'}


def strict_extract_countries(name):
    if not name:
        return []
    countries = []
    name_upper = name.upper()

    # Pattern 1: MobPlus "-CC-"
    for code in re.findall(r'-([A-Z]{2})-', name_upper):
        if code in ALL_ISO_CODES and code not in {'MS', 'OK', 'CC', 'AI'}:
            countries.append('GB' if code == 'UK' else code)

    # Pattern 2: Underscore "_CC"
    for code in re.findall(r'_([A-Z]{2})(?=_|$)', name_upper):
        if code in ALL_ISO_CODES and code not in STRICT_FALSE_POSITIVES:
            countries.append('GB' if code == 'UK' else code)

    # Pattern 3: Bracketed "[CC]"
    for match in re.findall(r'\[([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)\]', name_upper):
        for code in re.findall(r'[A-Z]{2}', match):
            if code in ALL_ISO_CODES and code not in STRICT_FALSE_POSITIVES:
                countries.append('GB' if code == 'UK' else code)

    # Pattern 4: Dash-separated segment
    for segment in re.split(r'\s*[-\u2013\u2014]\s*', name):
        s = segment.strip().upper()
        if len(s) == 2 and s.isalpha() and s in ALL_ISO_CODES and s not in STRICT_FALSE_POSITIVES:
            countries.append('GB' if s == 'UK' else s)

    # Pattern 5: Last token
    tokens = name.strip().split()
    if len(tokens) >= 2:
        last = tokens[-1].upper()
        if len(last) == 2 and last.isalpha() and last in ALL_ISO_CODES and last not in LAST_TOKEN_FALSE_POSITIVES:
            countries.append('GB' if last == 'UK' else last)

    return list(dict.fromkeys(countries))


# Fetch all US-only active offers
us_only_offers = list(offers_col.find(
    {'countries': ['US'], 'is_active': True},
    {'name': 1, 'offer_id': 1}
))

print(f"Found {len(us_only_offers)} active offers with countries=['US'] to re-check")

# Build bulk operations
bulk_ops = []
for offer in us_only_offers:
    name = offer.get('name', '')
    extracted = strict_extract_countries(name)
    if extracted and set(extracted) != {'US'}:
        new_countries = [c for c in extracted if c != 'US'] if len(extracted) > 1 else extracted
        if new_countries:
            bulk_ops.append(UpdateOne({'_id': offer['_id']}, {'$set': {'countries': new_countries}}))
            if len(bulk_ops) <= 20:
                print(f"  {offer.get('offer_id', '?'):12s} | {name[:50]:50s} -> {new_countries}")

if len(bulk_ops) > 20:
    print(f"  ... and {len(bulk_ops) - 20} more")

# Execute all at once
if bulk_ops:
    result = offers_col.bulk_write(bulk_ops)
    print(f"\nFixed {result.modified_count} offers with strict country extraction")
else:
    print("\nNo offers needed country re-extraction")

print("\n" + "=" * 70)
print("DONE!")
print("=" * 70)
