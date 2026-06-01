"""
Revert bad country migration and only fix offers with clear Name-CC-Carrier pattern.
"""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Step 1: Reset ALL non-US offers that were changed by the bad migration back to US
# (offers that had US before and now have something else wrong)
# We identify them by: they have countries that are clearly wrong (false positives)
FALSE_POSITIVE_CODES = {'RS', 'CO', 'MY', 'FM', 'TV', 'IO', 'AM', 'PM', 'AS', 'VC', 
                        'ST', 'RE', 'IR', 'IQ', 'AD', 'CC', 'FI', 'MO', 'SC', 'SS',
                        'AL', 'NC', 'GA', 'VA', 'PA', 'MD', 'LA', 'TN', 'KY', 'MS',
                        'AR', 'ID', 'NE', 'MT', 'AZ', 'SD', 'MN', 'TT', 'GI', 'LT',
                        'NA', 'TD', 'SJ', 'CK', 'MM', 'VG', 'LU', 'TM', 'TH', 'CH',
                        'CV', 'BL', 'CR'}

# Get all active offers that DON'T have US and are likely wrong
all_offers = list(offers_col.find(
    {'is_active': True, 'countries': {'$ne': ['US'], '$exists': True}},
    {'name': 1, 'offer_id': 1, 'countries': 1, 'network': 1}
))

print(f"Checking {len(all_offers)} non-US offers...")

# Known good patterns: offers from networks that encode country in name
# Pattern: "Name-XX-Carrier" where XX is a real country code
CARRIER_PATTERN = re.compile(
    r'^.+[-–](DZ|QA|PS|EG|SA|AE|KW|BH|OM|JO|IQ|LB|SY|YE|TN|MA|LY|SD|'
    r'NG|GH|KE|TZ|UG|ZA|CM|CI|SN|ML|BF|NE|TD|CG|CD|GA|MZ|ZM|ZW|MW|AO|'
    r'RW|BI|ET|SO|DJ|ER|MR|GM|GN|SL|LR|TG|BJ|'
    r'PK|BD|LK|NP|MM|KH|LA|VN|TH|MY|ID|PH|SG|'
    r'BR|MX|AR|CL|CO|PE|EC|VE|BO|PY|UY|PA|CR|GT|HN|SV|NI|CU|DO|HT|JM|TT|'
    r'US|GB|CA|AU|DE|FR|ES|IT|NL|BE|AT|CH|SE|NO|DK|FI|PL|PT|GR|CZ|HU|RO|BG|HR|'
    r'RU|UA|TR|IL|IN|JP|KR|CN|TW|HK|NZ)[-–]',
    re.IGNORECASE
)

# Also keep offers that have WW, or from Everflow with proper country data
reverted = 0
kept = 0

for offer in all_offers:
    countries = offer.get('countries', [])
    name = offer.get('name', '')
    network = offer.get('network', '')
    
    # Keep WW offers
    if 'WW' in countries:
        kept += 1
        continue
    
    # Keep offers with the carrier pattern (MobPlus-style)
    if CARRIER_PATTERN.match(name):
        kept += 1
        continue
    
    # Keep offers from Everflow that have proper country codes (not from text extraction)
    # These were likely set correctly by the API
    if network and network.lower() not in ('', 'hasoffers', 'cpamerchant'):
        # Check if countries look legitimate (not false positives)
        if all(c not in FALSE_POSITIVE_CODES for c in countries):
            kept += 1
            continue
    
    # Keep offers with underscore pattern like "Brand_US_CA_UK"
    if re.search(r'_[A-Z]{2}(_[A-Z]{2})*$', name) or re.search(r'_[A-Z]{2}[_,]', name):
        kept += 1
        continue
    
    # Check if ALL countries are false positives
    if all(c in FALSE_POSITIVE_CODES for c in countries):
        offers_col.update_one({'_id': offer['_id']}, {'$set': {'countries': ['US']}})
        reverted += 1
    else:
        # Has mix of real and false - keep the real ones
        real_countries = [c for c in countries if c not in FALSE_POSITIVE_CODES]
        if real_countries:
            kept += 1
        else:
            offers_col.update_one({'_id': offer['_id']}, {'$set': {'countries': ['US']}})
            reverted += 1

print(f"Reverted: {reverted} offers back to US")
print(f"Kept: {kept} offers with their current countries")
