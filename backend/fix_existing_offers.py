"""
Fix Existing Offers - Apply Enhancements to Old Data
Cleans HTML from descriptions and formats offer names for existing offers
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import Database
from utils.html_cleaner import clean_html_description, format_offer_name
from datetime import datetime


def fix_existing_offers():
    """Apply enhancements to existing offers in database"""
    
    print("="*80)
    print("🔧 FIXING EXISTING OFFERS")
    print("="*80)
    
    try:
        # Connect to database
        db = Database()
        offers_collection = db.get_collection('offers')
        
        # Get all offers
        all_offers = list(offers_collection.find({}))
        total_offers = len(all_offers)
        
        print(f"\n📊 Found {total_offers} offers in database")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n" + "-"*80)
        
        fixed_count = 0
        skipped_count = 0
        error_count = 0
        
        for i, offer in enumerate(all_offers, 1):
            try:
                offer_id = offer.get('offer_id', 'unknown')
                name = offer.get('name', '')
                description = offer.get('description', '')
                
                print(f"\n[{i}/{total_offers}] Processing: {name[:50]}...")
                
                # Track what needs updating
                updates = {}
                changes = []
                
                # 1. Fix offer name (remove underscores, format properly)
                if name and '_' in name:
                    formatted_name = format_offer_name(name)
                    if formatted_name != name:
                        updates['name'] = formatted_name
                        changes.append(f"Name: '{name[:30]}...' → '{formatted_name[:30]}...'")
                
                # 2. Clean HTML from description
                if description and ('<' in description or '&' in description):
                    clean_desc = clean_html_description(description)
                    if clean_desc != description:
                        updates['description'] = clean_desc
                        changes.append(f"Description: Cleaned HTML ({len(description)} → {len(clean_desc)} chars)")
                
                # 3. Add missing fields with defaults
                if 'tracking_protocol' not in offer:
                    updates['tracking_protocol'] = 'pixel'
                    changes.append("Added: tracking_protocol = 'pixel'")
                
                if 'payout_model' not in offer:
                    updates['payout_model'] = offer.get('offer_type', 'CPA')
                    changes.append(f"Added: payout_model = '{updates['payout_model']}'")
                
                if 'category' not in offer:
                    updates['category'] = offer.get('vertical', 'Lifestyle')
                    changes.append(f"Added: category = '{updates['category']}'")
                
                if 'conversion_window' not in offer:
                    updates['conversion_window'] = 30
                    changes.append("Added: conversion_window = 30")
                
                if 'incentive_type' not in offer:
                    # Detect from name
                    name_lower = name.lower()
                    if 'non incent' in name_lower or 'non-incent' in name_lower:
                        updates['incentive_type'] = 'Non-Incent'
                    else:
                        updates['incentive_type'] = 'Incent'
                    changes.append(f"Added: incentive_type = '{updates['incentive_type']}'")
                
                # 4. Add created_at if missing (use current time as fallback)
                if 'created_at' not in offer:
                    updates['created_at'] = datetime.now()
                    changes.append("Added: created_at (current timestamp)")
                
                # Apply updates if any
                if updates:
                    offers_collection.update_one(
                        {'_id': offer['_id']},
                        {'$set': updates}
                    )
                    fixed_count += 1
                    print(f"   ✅ FIXED ({len(changes)} changes):")
                    for change in changes:
                        print(f"      • {change}")
                else:
                    skipped_count += 1
                    print(f"   ⏭️  SKIPPED (no changes needed)")
                
            except Exception as e:
                error_count += 1
                print(f"   ❌ ERROR: {str(e)}")
                continue
        
        # Summary
        print("\n" + "="*80)
        print("📊 SUMMARY")
        print("="*80)
        print(f"Total Offers:    {total_offers}")
        print(f"✅ Fixed:        {fixed_count}")
        print(f"⏭️  Skipped:      {skipped_count}")
        print(f"❌ Errors:       {error_count}")
        print(f"⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        if fixed_count > 0:
            print("\n✨ Success! Existing offers have been updated with enhancements.")
            print("\n📝 Changes applied:")
            print("   • Cleaned HTML from descriptions")
            print("   • Formatted offer names (removed underscores)")
            print("   • Added missing fields (protocol, payout_model, etc.)")
            print("\n💡 Tip: Refresh your browser to see the changes!")
        else:
            print("\n✅ All offers are already up to date!")
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def preview_changes():
    """Preview what changes would be made without applying them"""
    
    print("="*80)
    print("👀 PREVIEW MODE - No changes will be made")
    print("="*80)
    
    try:
        db = Database()
        offers_collection = db.get_collection('offers')
        
        all_offers = list(offers_collection.find({}))
        total_offers = len(all_offers)
        
        print(f"\n📊 Found {total_offers} offers in database")
        print("\n" + "-"*80)
        
        needs_fix_count = 0
        
        for i, offer in enumerate(all_offers, 1):
            name = offer.get('name', '')
            description = offer.get('description', '')
            
            changes = []
            
            # Check name
            if name and '_' in name:
                formatted_name = format_offer_name(name)
                if formatted_name != name:
                    changes.append(f"Name: '{name}' → '{formatted_name}'")
            
            # Check description
            if description and ('<' in description or '&' in description):
                changes.append(f"Description: Has HTML tags (will be cleaned)")
            
            # Check missing fields
            if 'tracking_protocol' not in offer:
                changes.append("Missing: tracking_protocol")
            if 'payout_model' not in offer:
                changes.append("Missing: payout_model")
            if 'category' not in offer:
                changes.append("Missing: category")
            if 'conversion_window' not in offer:
                changes.append("Missing: conversion_window")
            if 'incentive_type' not in offer:
                changes.append("Missing: incentive_type")
            if 'created_at' not in offer:
                changes.append("Missing: created_at")
            
            if changes:
                needs_fix_count += 1
                print(f"\n[{i}/{total_offers}] {name[:50]}...")
                for change in changes:
                    print(f"   • {change}")
        
        print("\n" + "="*80)
        print("📊 PREVIEW SUMMARY")
        print("="*80)
        print(f"Total Offers:           {total_offers}")
        print(f"Needs Fixing:           {needs_fix_count}")
        print(f"Already Up to Date:     {total_offers - needs_fix_count}")
        print("="*80)
        
        if needs_fix_count > 0:
            print(f"\n💡 Run without --preview flag to apply changes to {needs_fix_count} offers")
        else:
            print("\n✅ All offers are already up to date!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    import sys
    
    if '--preview' in sys.argv:
        preview_changes()
    else:
        print("\n⚠️  WARNING: This will modify existing offers in the database!")
        print("💡 Run with --preview flag to see what changes would be made first")
        print("\nPress Enter to continue or Ctrl+C to cancel...")
        try:
            input()
        except KeyboardInterrupt:
            print("\n\n❌ Cancelled by user")
            sys.exit(0)
        
        fix_existing_offers()
