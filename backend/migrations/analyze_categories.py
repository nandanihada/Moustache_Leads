"""
Quick script to analyze current offer categories and find mismatches.
Run with: python migrations/analyze_categories.py
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance

def main():
    db = db_instance.get_db()
    if db is None:
        print("❌ Failed to connect to database")
        return
    
    offers = db['offers']
    
    # Get category distribution
    print("\n" + "=" * 60)
    print("📊 CURRENT CATEGORY DISTRIBUTION")
    print("=" * 60)
    
    pipeline = [
        {
            '$group': {
                '_id': {'$ifNull': ['$vertical', '$category']},
                'count': {'$sum': 1}
            }
        },
        {'$sort': {'count': -1}}
    ]
    
    results = list(offers.aggregate(pipeline))
    total = sum(r['count'] for r in results)
    
    for r in results:
        category = r['_id'] or 'NULL/EMPTY'
        count = r['count']
        pct = (count / total * 100) if total > 0 else 0
        print(f"  {category}: {count} ({pct:.1f}%)")
    
    print(f"\n  TOTAL: {total} offers")
    
    # Find potential mismatches - offers with "survey" in description but not in SURVEY category
    print("\n" + "=" * 60)
    print("⚠️  POTENTIAL MISMATCHES (Survey offers not in SURVEY category)")
    print("=" * 60)
    
    survey_mismatches = list(offers.find({
        '$and': [
            {'$or': [
                {'name': {'$regex': 'survey', '$options': 'i'}},
                {'description': {'$regex': 'survey', '$options': 'i'}},
                {'description': {'$regex': 'opinion', '$options': 'i'}}
            ]},
            {'vertical': {'$nin': ['SURVEY', 'Survey', 'survey', 'SURVEYS']}}
        ]
    }).limit(20))
    
    for offer in survey_mismatches:
        print(f"\n  Offer: {offer.get('name', 'N/A')[:60]}")
        print(f"  Current Category: {offer.get('vertical') or offer.get('category', 'N/A')}")
        print(f"  Description: {(offer.get('description') or 'N/A')[:100]}...")
    
    print(f"\n  Found {len(survey_mismatches)} potential survey mismatches (showing first 20)")
    
    # Find Dating offers that might be wrong
    print("\n" + "=" * 60)
    print("⚠️  DATING CATEGORY OFFERS (verify these are correct)")
    print("=" * 60)
    
    dating_offers = list(offers.find({
        '$or': [
            {'vertical': {'$in': ['DATING', 'Dating', 'dating']}},
            {'category': {'$in': ['DATING', 'Dating', 'dating']}}
        ]
    }).limit(15))
    
    for offer in dating_offers:
        print(f"\n  Offer: {offer.get('name', 'N/A')[:60]}")
        print(f"  Description: {(offer.get('description') or 'N/A')[:120]}...")
    
    print(f"\n  Found {len(dating_offers)} dating offers (showing first 15)")
    
    print("\n" + "=" * 60)
    print("💡 TO FIX CATEGORIES, RUN:")
    print("   python migrations/fix_offer_categories.py --show-mismatches")
    print("   python migrations/fix_offer_categories.py --apply")
    print("=" * 60)


if __name__ == '__main__':
    main()
