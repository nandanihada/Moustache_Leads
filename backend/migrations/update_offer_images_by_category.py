"""
Migration: Update offer images based on category/vertical
This script updates all offers to use category-based default images
instead of random Unsplash images.

Run with: python -m migrations.update_offer_images_by_category
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime

# Category to image URL mapping
# These URLs point to the frontend public folder assets
# Format: /category-images/{category}.png
CATEGORY_IMAGE_MAP = {
    'HEALTH': '/category-images/health.png',
    'SURVEY': '/category-images/survey.png',
    'SWEEPSTAKES': '/category-images/sweepstakes.png',
    'EDUCATION': '/category-images/education.png',
    'INSURANCE': '/category-images/insurance.png',
    'LOAN': '/category-images/loan.png',
    'FINANCE': '/category-images/finance.png',
    'DATING': '/category-images/dating.png',
    'FREE_TRIAL': '/category-images/free_trial.png',
    'INSTALLS': '/category-images/installs.png',
    'GAMES_INSTALL': '/category-images/games_install.png',
    'OTHER': '/category-images/other.png',
}

# Legacy category mappings
LEGACY_CATEGORY_MAP = {
    'lifestyle': 'OTHER',
    'general': 'OTHER',
    'entertainment': 'OTHER',
    'ecommerce': 'OTHER',
    'e-commerce': 'OTHER',
    'shopping': 'OTHER',
    'travel': 'OTHER',
    'food': 'OTHER',
    'utilities': 'OTHER',
    'gaming': 'GAMES_INSTALL',
    'game': 'GAMES_INSTALL',
    'games': 'GAMES_INSTALL',
    'healthcare': 'HEALTH',
    'medical': 'HEALTH',
    'fitness': 'HEALTH',
    'wellness': 'HEALTH',
    'crypto': 'FINANCE',
    'cryptocurrency': 'FINANCE',
    'banking': 'FINANCE',
    'investment': 'FINANCE',
    'trading': 'FINANCE',
    'sweeps': 'SWEEPSTAKES',
    'giveaway': 'SWEEPSTAKES',
    'contest': 'SWEEPSTAKES',
    'prize': 'SWEEPSTAKES',
    'app': 'INSTALLS',
    'download': 'INSTALLS',
    'mobile': 'INSTALLS',
    'trial': 'FREE_TRIAL',
    'demo': 'FREE_TRIAL',
    'romance': 'DATING',
    'relationship': 'DATING',
    'learning': 'EDUCATION',
    'course': 'EDUCATION',
    'training': 'EDUCATION',
    'policy': 'INSURANCE',
    'coverage': 'INSURANCE',
    'lending': 'LOAN',
    'credit': 'LOAN',
    'borrowing': 'LOAN',
    'poll': 'SURVEY',
    'questionnaire': 'SURVEY',
    'feedback': 'SURVEY',
}


def get_category_image(category: str) -> str:
    """Get the image URL for a category"""
    if not category:
        return CATEGORY_IMAGE_MAP['OTHER']
    
    # Normalize category
    cat_upper = category.upper().strip()
    cat_lower = category.lower().strip()
    
    # Direct match
    if cat_upper in CATEGORY_IMAGE_MAP:
        return CATEGORY_IMAGE_MAP[cat_upper]
    
    # Legacy mapping
    if cat_lower in LEGACY_CATEGORY_MAP:
        mapped_cat = LEGACY_CATEGORY_MAP[cat_lower]
        return CATEGORY_IMAGE_MAP[mapped_cat]
    
    # Default
    return CATEGORY_IMAGE_MAP['OTHER']


def is_unsplash_or_placeholder(url: str) -> bool:
    """Check if URL is an Unsplash image or placeholder"""
    if not url:
        return True
    
    placeholder_indicators = [
        'unsplash.com',
        'placeholder',
        'via.placeholder',
        'picsum.photos',
        'lorempixel',
        'dummyimage',
        'placekitten',
        'placehold.it',
    ]
    
    url_lower = url.lower()
    return any(indicator in url_lower for indicator in placeholder_indicators)


def run_migration(dry_run: bool = True):
    """
    Update all offers to use category-based images
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    print("=" * 60)
    print("MIGRATION: Update Offer Images by Category")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (making changes)'}")
    print()
    
    offers_collection = db_instance.get_collection('offers')
    
    if offers_collection is None:
        print("❌ Could not connect to database")
        return
    
    # Get all offers
    all_offers = list(offers_collection.find({}))
    print(f"📊 Total offers in database: {len(all_offers)}")
    
    # Track statistics
    stats = {
        'total': len(all_offers),
        'updated': 0,
        'skipped_has_custom': 0,
        'skipped_already_category': 0,
        'by_category': {}
    }
    
    updates = []
    
    for offer in all_offers:
        offer_id = offer.get('offer_id', str(offer.get('_id')))
        current_image = offer.get('image_url', '')
        current_thumbnail = offer.get('thumbnail_url', '')
        category = offer.get('vertical') or offer.get('category') or 'OTHER'
        
        # Get the category image
        category_image = get_category_image(category)
        
        # Track by category
        cat_key = category.upper() if category else 'UNKNOWN'
        if cat_key not in stats['by_category']:
            stats['by_category'][cat_key] = {'total': 0, 'updated': 0}
        stats['by_category'][cat_key]['total'] += 1
        
        # Check if offer already has a custom (non-placeholder) image
        has_custom_image = current_image and not is_unsplash_or_placeholder(current_image)
        has_custom_thumbnail = current_thumbnail and not is_unsplash_or_placeholder(current_thumbnail)
        
        # Check if already using category image
        already_category_image = (
            current_image and '/category-images/' in current_image
        ) or (
            current_thumbnail and '/category-images/' in current_thumbnail
        )
        
        if has_custom_image or has_custom_thumbnail:
            stats['skipped_has_custom'] += 1
            continue
        
        if already_category_image:
            stats['skipped_already_category'] += 1
            continue
        
        # This offer needs updating
        updates.append({
            'offer_id': offer_id,
            'name': offer.get('name', 'Unknown')[:50],
            'category': category,
            'old_image': current_image[:50] if current_image else 'None',
            'new_image': category_image,
        })
        
        stats['updated'] += 1
        stats['by_category'][cat_key]['updated'] += 1
    
    # Print summary
    print()
    print("📈 SUMMARY")
    print("-" * 40)
    print(f"Total offers: {stats['total']}")
    print(f"Will update: {stats['updated']}")
    print(f"Skipped (has custom image): {stats['skipped_has_custom']}")
    print(f"Skipped (already category image): {stats['skipped_already_category']}")
    print()
    
    print("📊 BY CATEGORY:")
    for cat, cat_stats in sorted(stats['by_category'].items()):
        print(f"  {cat}: {cat_stats['updated']}/{cat_stats['total']} to update")
    print()
    
    if not updates:
        print("✅ No offers need updating!")
        return
    
    # Show sample updates
    print("📝 SAMPLE UPDATES (first 10):")
    for update in updates[:10]:
        print(f"  [{update['offer_id']}] {update['name']}")
        print(f"    Category: {update['category']}")
        print(f"    Old: {update['old_image']}")
        print(f"    New: {update['new_image']}")
        print()
    
    if dry_run:
        print("=" * 60)
        print("DRY RUN COMPLETE - No changes made")
        print("Run with --live to apply changes")
        print("=" * 60)
        return
    
    # Apply updates
    print("🔄 Applying updates...")
    success_count = 0
    error_count = 0
    
    for update in updates:
        try:
            result = offers_collection.update_one(
                {'offer_id': update['offer_id']},
                {
                    '$set': {
                        'image_url': update['new_image'],
                        'thumbnail_url': update['new_image'],
                        'category_image_applied': True,
                        'category_image_applied_at': datetime.utcnow(),
                    }
                }
            )
            if result.modified_count > 0:
                success_count += 1
            else:
                # Try by _id if offer_id didn't match
                result = offers_collection.update_one(
                    {'_id': update['offer_id']},
                    {
                        '$set': {
                            'image_url': update['new_image'],
                            'thumbnail_url': update['new_image'],
                            'category_image_applied': True,
                            'category_image_applied_at': datetime.utcnow(),
                        }
                    }
                )
                if result.modified_count > 0:
                    success_count += 1
        except Exception as e:
            error_count += 1
            print(f"  ❌ Error updating {update['offer_id']}: {e}")
    
    print()
    print("=" * 60)
    print(f"✅ MIGRATION COMPLETE")
    print(f"   Successfully updated: {success_count}")
    print(f"   Errors: {error_count}")
    print("=" * 60)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Update offer images by category')
    parser.add_argument('--live', action='store_true', help='Apply changes (default is dry run)')
    args = parser.parse_args()
    
    run_migration(dry_run=not args.live)
