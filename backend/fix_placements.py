#!/usr/bin/env python3
"""
Fix placements - add placementIdentifier field
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def fix_placements():
    """Add placementIdentifier to existing placements"""
    
    try:
        placements = db_instance.get_collection('placements')
        
        if placements is None:
            print("❌ Could not access placements collection")
            return
        
        print("\n" + "="*80)
        print("🔧 Fixing Placements - Adding placementIdentifier")
        print("="*80)
        
        # Get all placements
        all_placements = list(placements.find())
        print(f"\nTotal placements: {len(all_placements)}")
        
        # Show current state
        print("\n📋 Current Placements:")
        for i, p in enumerate(all_placements, 1):
            _id = str(p.get('_id'))
            placement_id = p.get('placement_id')
            placementId = p.get('placementId')
            placementIdentifier = p.get('placementIdentifier')
            
            print(f"\n{i}. _id: {_id}")
            print(f"   placement_id: {placement_id}")
            print(f"   placementId: {placementId}")
            print(f"   placementIdentifier: {placementIdentifier}")
            print(f"   offerwallTitle: {p.get('offerwallTitle', 'N/A')}")
            print(f"   publisherId: {p.get('publisherId', 'N/A')}")
        
        # Find placements without placementIdentifier
        need_fix = list(placements.find({'placementIdentifier': {'$exists': False}}))
        
        print(f"\n⚠️  Placements needing placementIdentifier: {len(need_fix)}")
        
        if len(need_fix) == 0:
            print("\n✅ All placements already have placementIdentifier!")
            return
        
        # Ask for confirmation
        response = input(f"\n✅ Add placementIdentifier to {len(need_fix)} placements? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Cancelled")
            return
        
        # Fix each placement
        import secrets
        import string
        
        def generate_placement_identifier():
            return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
        
        fixed_count = 0
        for p in need_fix:
            identifier = generate_placement_identifier()
            
            result = placements.update_one(
                {'_id': p['_id']},
                {'$set': {'placementIdentifier': identifier}}
            )
            
            if result.modified_count > 0:
                fixed_count += 1
                print(f"✅ Added placementIdentifier to {p.get('offerwallTitle', 'Unknown')}: {identifier}")
        
        print(f"\n🎉 Fixed {fixed_count} placements!")
        
        # Show updated state
        print("\n📋 Updated Placements:")
        all_placements = list(placements.find())
        for i, p in enumerate(all_placements, 1):
            print(f"\n{i}. {p.get('offerwallTitle', 'Unknown')}")
            print(f"   placementIdentifier: {p.get('placementIdentifier', 'N/A')}")
            print(f"   Use this in URL: ?placement_id={p.get('placementIdentifier')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    fix_placements()
