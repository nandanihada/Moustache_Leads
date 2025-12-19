#!/usr/bin/env python3
"""
Script to update all admin route files to use subadmin_or_admin_required decorator
This script updates backend route files to support subadmin permissions
"""

import os
import re
from pathlib import Path

# Tab name mapping for routes
TAB_MAPPINGS = {
    'admin_offers.py': 'offers',
    'partners.py': 'partners',
    'postback_logs.py': 'postback-logs',
    'bonus_management.py': 'bonus-management',
    'admin_publishers.py': 'publishers',
    'admin_publishers_simple.py': 'publishers',
    'admin_promo_codes.py': 'promo-codes',
    'comprehensive_analytics.py': 'comprehensive-analytics',
    'admin_offerwall_analytics.py': 'offerwall-analytics',
    'analytics.py': 'analytics',
    'reports_api.py': 'reports',
    'tracking_api.py': 'tracking',
    'admin_offer_requests.py': 'offer-access-requests',
    'placements.py': 'placement-approval',
}

def update_route_file(filepath, tab_name):
    """Update a single route file to use subadmin_or_admin_required"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already updated
    if 'subadmin_or_admin_required' in content:
        print(f"✓ {filepath.name} already updated")
        return False
    
    # Add import if not present
    if 'from utils.auth import' in content:
        # Update existing import
        content = re.sub(
            r'from utils\.auth import ([^\n]+)',
            lambda m: f"from utils.auth import {m.group(1)}, subadmin_or_admin_required" if 'subadmin_or_admin_required' not in m.group(1) else m.group(0),
            content
        )
    
    # Replace @admin_required with @subadmin_or_admin_required('tab_name')
    content = re.sub(
        r'@admin_required\n',
        f"@subadmin_or_admin_required('{tab_name}')\n",
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✓ Updated {filepath.name} with tab '{tab_name}'")
    return True

def main():
    routes_dir = Path(__file__).parent
    updated_count = 0
    
    print("Updating backend route files for subadmin permissions...\n")
    
    for filename, tab_name in TAB_MAPPINGS.items():
        filepath = routes_dir / filename
        
        if not filepath.exists():
            print(f"⚠ {filename} not found, skipping")
            continue
        
        if update_route_file(filepath, tab_name):
            updated_count += 1
    
    print(f"\n✅ Updated {updated_count} route files")
    print("Note: login_logs.py was already updated manually")

if __name__ == '__main__':
    main()
