"""
Migration script to update vertical field for all existing offers
based on auto-detection from name and description.

Run this script once to update all existing offers that have 'Lifestyle' 
or empty vertical to the auto-detected value.

Usage:
    cd backend
    python migrations/update_offer_verticals.py
    python migrations/update_offer_verticals.py --show
    python migrations/update_offer_verticals.py --live
    python migrations/update_offer_verticals.py --map-legacy --live
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from models.offer import detect_vertical_from_text, VALID_VERTICALS, LEGACY_CATEGORY_MAP, map_category_to_new_system

def update_offer_verticals(dry_run=True):
    """
    Update vertical field for all existing offers.
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    collection = db_instance.get_collection('offers')
    
    if collection is None:
        print("❌ Failed to connect to database")
        return
    
    # Find all offers that need vertical update
    # (vertical is empty, 'Lifestyle', or doesn't exist)
    query = {
        '$or': [
            {'vertical': {'$exists': False}},
            {'vertical': ''},
            {'vertical': None},
            {'vertical': 'Lifestyle'}
        ]
    }
    
    offers = list(collection.find(query))
    total_offers = len(offers)
    
    print(f"\n{'='*60}")
    print(f"VERTICAL AUTO-DETECTION MIGRATION")
    print(f"{'='*60}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE UPDATE'}")
    print(f"Found {total_offers} offers to process")
    print(f"{'='*60}\n")
    
    # Track statistics
    stats = {vertical: 0 for vertical in VALID_VERTICALS}
    updated_count = 0
    skipped_count = 0
    
    for i, offer in enumerate(offers, 1):
        offer_id = offer.get('offer_id', 'Unknown')
        name = offer.get('name', '')
        description = offer.get('description', '')
        current_vertical = offer.get('vertical', 'None')
        
        # Detect vertical from name and description
        detected_vertical = detect_vertical_from_text(name, description)
        
        # Skip if detected is still Lifestyle (no keywords matched)
        if detected_vertical == 'Lifestyle' and current_vertical in ['Lifestyle', '', None]:
            skipped_count += 1
            continue
        
        # Only update if detected is different from current
        if detected_vertical != current_vertical:
            stats[detected_vertical] += 1
            updated_count += 1
            
            print(f"[{i}/{total_offers}] {offer_id}")
            print(f"   Name: {name[:60]}{'...' if len(name) > 60 else ''}")
            print(f"   Current: {current_vertical} → Detected: {detected_vertical}")
            
            if not dry_run:
                # Update the offer
                collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {
                        'vertical': detected_vertical,
                        'category': detected_vertical  # Keep in sync
                    }}
                )
                print(f"   ✅ Updated!")
            else:
                print(f"   📝 Would update")
            print()
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total offers processed: {total_offers}")
    print(f"Offers updated: {updated_count}")
    print(f"Offers skipped (no change): {skipped_count}")
    print(f"\nVertical distribution of updates:")
    for vertical, count in sorted(stats.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  {vertical}: {count}")
    print(f"{'='*60}\n")
    
    if dry_run:
        print("⚠️  This was a DRY RUN. No changes were made.")
        print("    Run with --live to apply changes.")
    else:
        print("✅ Migration complete!")


def map_legacy_categories(dry_run=True):
    """
    Map all old category/vertical values to the new 11-category system.
    
    This handles offers that have old values like 'Finance', 'Gaming', 'Dating', etc.
    and maps them to the new uppercase format: FINANCE, GAMES_INSTALL, DATING, etc.
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    collection = db_instance.get_collection('offers')
    
    if collection is None:
        print("❌ Failed to connect to database")
        return
    
    # Get all offers
    offers = list(collection.find({}))
    total_offers = len(offers)
    
    print(f"\n{'='*60}")
    print(f"LEGACY CATEGORY MAPPING MIGRATION")
    print(f"{'='*60}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE UPDATE'}")
    print(f"Found {total_offers} total offers")
    print(f"{'='*60}\n")
    
    # Track statistics
    stats = {vertical: 0 for vertical in VALID_VERTICALS}
    mapping_stats = {}  # old_value -> new_value counts
    updated_count = 0
    already_correct = 0
    
    for i, offer in enumerate(offers, 1):
        offer_id = offer.get('offer_id', 'Unknown')
        name = offer.get('name', '')
        current_vertical = offer.get('vertical') or offer.get('category') or ''
        
        # Check if already in new format (uppercase and valid)
        if current_vertical.upper() in VALID_VERTICALS and current_vertical == current_vertical.upper():
            already_correct += 1
            stats[current_vertical] += 1
            continue
        
        # Map to new category system
        new_vertical = map_category_to_new_system(current_vertical)
        
        # If mapping didn't change anything meaningful, try auto-detection
        if new_vertical == 'OTHER' and current_vertical.lower() not in ['other', 'lifestyle', 'entertainment', 'travel', 'utilities', 'e-commerce', 'ecommerce', 'shopping', 'video', 'signup', 'general']:
            # Try auto-detection from name and description
            description = offer.get('description', '')
            detected = detect_vertical_from_text(name, description)
            if detected != 'OTHER':
                new_vertical = detected
        
        # Track mapping
        mapping_key = f"{current_vertical} → {new_vertical}"
        mapping_stats[mapping_key] = mapping_stats.get(mapping_key, 0) + 1
        
        # Only update if different
        if new_vertical != current_vertical:
            stats[new_vertical] += 1
            updated_count += 1
            
            if updated_count <= 20:  # Only show first 20 for brevity
                print(f"[{i}/{total_offers}] {offer_id}")
                print(f"   Name: {name[:50]}{'...' if len(name) > 50 else ''}")
                print(f"   {current_vertical} → {new_vertical}")
            
            if not dry_run:
                # Update the offer
                collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {
                        'vertical': new_vertical,
                        'category': new_vertical  # Keep in sync
                    }}
                )
    
    if updated_count > 20:
        print(f"   ... and {updated_count - 20} more offers")
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total offers: {total_offers}")
    print(f"Already correct: {already_correct}")
    print(f"Offers to update: {updated_count}")
    
    print(f"\nMapping breakdown:")
    for mapping, count in sorted(mapping_stats.items(), key=lambda x: -x[1]):
        print(f"  {mapping}: {count}")
    
    print(f"\nFinal category distribution:")
    for vertical, count in sorted(stats.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  {vertical}: {count}")
    print(f"{'='*60}\n")
    
    if dry_run:
        print("⚠️  This was a DRY RUN. No changes were made.")
        print("    Run with --map-legacy --live to apply changes.")
    else:
        print("✅ Legacy category mapping complete!")


def show_current_distribution():
    """Show current vertical distribution in the database."""
    collection = db_instance.get_collection('offers')
    
    if collection is None:
        print("❌ Failed to connect to database")
        return
    
    print(f"\n{'='*60}")
    print(f"CURRENT VERTICAL DISTRIBUTION")
    print(f"{'='*60}")
    
    # Aggregate by vertical
    pipeline = [
        {'$group': {'_id': '$vertical', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    
    results = list(collection.aggregate(pipeline))
    total = sum(r['count'] for r in results)
    
    for result in results:
        vertical = result['_id'] or 'None/Empty'
        count = result['count']
        percentage = (count / total * 100) if total > 0 else 0
        print(f"  {vertical}: {count} ({percentage:.1f}%)")
    
    print(f"\n  Total offers: {total}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Update offer verticals based on auto-detection')
    parser.add_argument('--live', action='store_true', help='Apply changes (default is dry run)')
    parser.add_argument('--show', action='store_true', help='Show current vertical distribution')
    parser.add_argument('--map-legacy', action='store_true', help='Map old category values to new 11-category system')
    
    args = parser.parse_args()
    
    if args.show:
        show_current_distribution()
    elif args.map_legacy:
        map_legacy_categories(dry_run=not args.live)
    else:
        update_offer_verticals(dry_run=not args.live)
