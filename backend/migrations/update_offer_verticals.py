"""
Migration script to update vertical field for all existing offers
based on auto-detection from name and description.

Run this script once to update all existing offers that have 'Lifestyle' 
or empty vertical to the auto-detected value.

Usage:
    cd backend
    python migrations/update_offer_verticals.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from models.offer import detect_vertical_from_text, VALID_VERTICALS

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
    
    args = parser.parse_args()
    
    if args.show:
        show_current_distribution()
    else:
        update_offer_verticals(dry_run=not args.live)
