"""
Seed Network Presets
Pre-populates the network_presets collection with all known network credentials.
Run once: python migrations/seed_network_presets.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime


PRESETS = [
    {
        'display_name': 'ChameleonAds',
        'network_type': 'hasoffers',
        'network_id': 'chameleonads',
        'api_key': '0d120fbf45ecceafadc93a0208b3f314c6e901fbad3a2ae613a44338abdca351',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'CPA Merchant',
        'network_type': 'hasoffers',
        'network_id': 'cpamerchant',
        'api_key': 'eeb0f8b62e03dde5844adb2bba29bc6583b941e39bf09e0a94d2ab6e38863a5c',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'Quiver',
        'network_type': 'hasoffers',
        'network_id': 'quiver',
        'api_key': 'dcc775cb3127732d01aba5977fba1b06f9bb3143c6ea8c71a2ad32153584f9b1',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'LeadAds',
        'network_type': 'hasoffers',
        'network_id': 'leadads',
        'api_key': 'd94df039d5b629fa1241abcd637015bb323ce8ec85ec1cfdce08c84d8d76de6f',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'TriadMedia',
        'network_type': 'everflow',
        'network_id': '',
        'api_key': 'mLND6ZqET6GYlUsG5Og6A',
        'api_url': 'https://api.eflow.team',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'AdToGame',
        'network_type': 'everflow',
        'network_id': '',
        'api_key': 'P55nWCEMQA6dyYEAgDNXA',
        'api_url': 'https://api.eflow.team',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'AdscendMedia',
        'network_type': 'adscendmedia',
        'network_id': '115620',
        'api_key': 'Qy8AqNh9ANppdP0bZkvB7QjzCmNiDxRlbbiTR3wilrbdeagRDeXBUEeDmLDz',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'MarketXcel',
        'network_type': 'marketxcel',
        'network_id': '18c3bc911a7ea7070de8de15848315f6',
        'api_key': '96a0f72f32d315daac3bc1e52cec2832',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'MobPlus',
        'network_type': 'mobplus',
        'network_id': '',
        'api_key': 'c8f485d2a99a49529fdfaacb2fbdc93f',
        'api_url': 'https://mob.mobplus.net',
        'fetch_mode': 'my_offers',
    },
    {
        'display_name': 'Lootably',
        'network_type': 'lootably',
        'network_id': 'cmmfyeprm06nj01x0dcyjafos',
        'api_key': '0s894ydz8nk53qu3l78mv93u1fmesvw3r3zzn3oa9ias',
        'api_url': '',
        'fetch_mode': 'my_offers',
    },
]


def seed_presets():
    """Insert all network presets into MongoDB (skips if already exists by display_name)"""
    presets_col = db_instance.get_collection('network_presets')
    if presets_col is None:
        print("❌ Database not connected")
        return
    
    inserted = 0
    skipped = 0
    
    for preset in PRESETS:
        # Check if already exists
        existing = presets_col.find_one({'display_name': preset['display_name']})
        if existing:
            print(f"  ⏭️  Skipped '{preset['display_name']}' (already exists)")
            skipped += 1
            continue
        
        doc = {
            **preset,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': 'system_seed',
        }
        presets_col.insert_one(doc)
        print(f"  ✅ Inserted '{preset['display_name']}' ({preset['network_type']})")
        inserted += 1
    
    print(f"\n🎯 Done: {inserted} inserted, {skipped} skipped")


if __name__ == '__main__':
    print("🔖 Seeding Network Presets...")
    print("=" * 50)
    seed_presets()
