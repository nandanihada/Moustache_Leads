"""
Migration script to fix offer categories based on offer name and description.
This script analyzes each offer and assigns the correct category based on keywords.

Run with: python migrations/fix_offer_categories.py
"""

import os
import sys
import re
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance

# Category detection rules - order matters (more specific first)
CATEGORY_RULES = {
    'SWEEPSTAKES': {
        'keywords': [
            'sweepstakes', 'sweeps', 'giveaway', 'prize', 'win a', 'chance to win',
            'winner', 'lottery', 'raffle', 'contest', 'jackpot', 'lucky draw',
            'grand prize', 'instant win', 'enter to win', 'free entry', 'prize draw'
        ],
        'negative_keywords': []  # Keywords that should NOT match this category
    },
    'SURVEY': {
        'keywords': [
            'survey', 'surveys', 'opinion', 'questionnaire', 'poll', 'feedback',
            'reward survey', 'paid survey', 'earn for opinions', 'share your opinion',
            'market research', 'consumer research'
        ],
        'negative_keywords': []  # Keywords that should NOT match this category
    },
    'GAMES_INSTALL': {
        'keywords': [
            'game', 'games', 'gaming', 'casino', 'slots', 'poker', 'bingo',
            'play now', 'mobile game', 'puzzle', 'match-3', 'rpg', 'mmorpg',
            'strategy game', 'action game', 'adventure game', 'simulation',
            'gambling', 'bet', 'betting', 'sportsbook', 'fantasy sports'
        ],
        'negative_keywords': []
    },
    'INSTALLS': {
        'keywords': [
            'install', 'download', 'app', 'application', 'mobile app',
            'android', 'ios', 'iphone', 'ipad', 'play store', 'app store',
            'software', 'program', 'utility', 'tool app'
        ],
        'negative_keywords': ['game', 'gaming', 'casino']
    },
    'FINANCE': {
        'keywords': [
            'finance', 'financial', 'bank', 'banking', 'credit card', 'debit card',
            'loan', 'mortgage', 'investment', 'invest', 'trading', 'forex',
            'crypto', 'cryptocurrency', 'bitcoin', 'stock', 'stocks',
            'savings', 'checking account', 'money transfer', 'payment',
            'fintech', 'wealth', 'portfolio', 'retirement', '401k', 'ira'
        ],
        'negative_keywords': []
    },
    'INSURANCE': {
        'keywords': [
            'insurance', 'insure', 'coverage', 'policy', 'premium',
            'life insurance', 'health insurance', 'auto insurance', 'car insurance',
            'home insurance', 'renters insurance', 'pet insurance',
            'medicare', 'medicaid', 'dental insurance', 'vision insurance'
        ],
        'negative_keywords': []
    },
    'LOAN': {
        'keywords': [
            'loan', 'loans', 'lending', 'borrow', 'personal loan', 'payday loan',
            'installment loan', 'auto loan', 'car loan', 'home loan',
            'student loan', 'debt consolidation', 'refinance', 'mortgage'
        ],
        'negative_keywords': []
    },
    'HEALTH': {
        'keywords': [
            'health', 'healthcare', 'medical', 'medicine', 'doctor', 'hospital',
            'fitness', 'workout', 'exercise', 'gym', 'weight loss', 'diet',
            'nutrition', 'vitamin', 'supplement', 'wellness', 'mental health',
            'therapy', 'counseling', 'pharmacy', 'prescription', 'telehealth',
            'beauty', 'skincare', 'cosmetic', 'hair care', 'dental', 'vision'
        ],
        'negative_keywords': ['insurance']
    },
    'EDUCATION': {
        'keywords': [
            'education', 'educational', 'learn', 'learning', 'course', 'courses',
            'training', 'certification', 'degree', 'university', 'college',
            'school', 'online class', 'tutorial', 'bootcamp', 'skill',
            'language learning', 'coding', 'programming course'
        ],
        'negative_keywords': []
    },
    'DATING': {
        'keywords': [
            'dating', 'date', 'singles', 'single', 'match', 'matchmaking',
            'relationship', 'romance', 'love', 'meet people', 'meet singles',
            'hookup', 'flirt', 'chat with singles', 'find love', 'soulmate',
            'tinder', 'bumble', 'hinge', 'okcupid', 'plenty of fish'
        ],
        'negative_keywords': ['survey', 'opinion', 'questionnaire']
    },
    'FREE_TRIAL': {
        'keywords': [
            'free trial', 'trial offer', 'try free', 'free sample', 'sample',
            'risk free', 'money back', 'cancel anytime', 'no obligation',
            'try before you buy', 'demo', 'test drive'
        ],
        'negative_keywords': []
    },
    'OTHER': {
        'keywords': [
            'lifestyle', 'entertainment', 'travel', 'shopping', 'ecommerce',
            'e-commerce', 'retail', 'subscription', 'streaming', 'music',
            'video', 'news', 'magazine', 'food delivery', 'grocery'
        ],
        'negative_keywords': []
    }
}


def detect_category(name: str, description: str, current_category: str = None) -> tuple:
    """
    Detect the correct category based on offer name and description.
    Returns (detected_category, confidence, reason)
    """
    # Combine name and description for analysis
    text = f"{name or ''} {description or ''}".lower()
    
    # Track matches for each category
    category_scores = {}
    
    for category, rules in CATEGORY_RULES.items():
        score = 0
        matched_keywords = []
        
        # Check for negative keywords first
        has_negative = False
        for neg_kw in rules.get('negative_keywords', []):
            if neg_kw.lower() in text:
                has_negative = True
                break
        
        if has_negative:
            continue
        
        # Count keyword matches
        for keyword in rules['keywords']:
            # Use word boundary matching for better accuracy
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            matches = len(re.findall(pattern, text))
            if matches > 0:
                score += matches
                matched_keywords.append(keyword)
        
        if score > 0:
            category_scores[category] = {
                'score': score,
                'keywords': matched_keywords
            }
    
    # Find the best match
    if category_scores:
        best_category = max(category_scores.keys(), key=lambda k: category_scores[k]['score'])
        best_score = category_scores[best_category]
        
        # Calculate confidence based on score
        confidence = 'HIGH' if best_score['score'] >= 3 else 'MEDIUM' if best_score['score'] >= 2 else 'LOW'
        reason = f"Matched keywords: {', '.join(best_score['keywords'][:5])}"
        
        return best_category, confidence, reason
    
    # Default to OTHER if no matches
    return 'OTHER', 'LOW', 'No keyword matches found'


def analyze_offers(db, dry_run=True):
    """
    Analyze all offers and detect correct categories.
    """
    offers_collection = db['offers']
    
    # Get all offers
    offers = list(offers_collection.find({}))
    print(f"\n📊 Analyzing {len(offers)} offers...\n")
    
    changes = []
    category_stats = {}
    mismatches = []
    
    for offer in offers:
        offer_id = offer.get('offer_id', str(offer.get('_id')))
        name = offer.get('name', '')
        description = offer.get('description', '')
        current_category = (offer.get('vertical') or offer.get('category') or 'UNKNOWN').upper()
        
        # Detect correct category
        detected_category, confidence, reason = detect_category(name, description, current_category)
        
        # Track stats
        if detected_category not in category_stats:
            category_stats[detected_category] = {'total': 0, 'changed': 0}
        category_stats[detected_category]['total'] += 1
        
        # Check if category needs to change
        if current_category != detected_category:
            changes.append({
                'offer_id': offer_id,
                'name': name[:50] + '...' if len(name) > 50 else name,
                'current': current_category,
                'detected': detected_category,
                'confidence': confidence,
                'reason': reason
            })
            category_stats[detected_category]['changed'] += 1
            
            # Track significant mismatches (high confidence changes)
            if confidence in ['HIGH', 'MEDIUM']:
                mismatches.append({
                    'offer_id': offer_id,
                    'name': name[:80],
                    'description': description[:150] if description else 'N/A',
                    'current': current_category,
                    'detected': detected_category,
                    'reason': reason
                })
    
    return changes, category_stats, mismatches


def apply_changes(db, changes, dry_run=True):
    """
    Apply category changes to the database.
    """
    if dry_run:
        print("\n🔍 DRY RUN - No changes will be made\n")
    else:
        print("\n⚡ APPLYING CHANGES\n")
    
    offers_collection = db['offers']
    updated_count = 0
    
    for change in changes:
        if not dry_run:
            # Update the offer
            result = offers_collection.update_one(
                {'offer_id': change['offer_id']},
                {
                    '$set': {
                        'vertical': change['detected'],
                        'category': change['detected'],
                        'category_updated_at': datetime.utcnow(),
                        'category_update_reason': change['reason']
                    }
                }
            )
            if result.modified_count > 0:
                updated_count += 1
    
    return updated_count


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix offer categories based on content analysis')
    parser.add_argument('--apply', action='store_true', help='Actually apply changes (default is dry run)')
    parser.add_argument('--show-mismatches', action='store_true', help='Show detailed mismatches')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of changes to show')
    args = parser.parse_args()
    
    dry_run = not args.apply
    
    print("=" * 60)
    print("🔧 OFFER CATEGORY FIX MIGRATION")
    print("=" * 60)
    
    # Connect to database
    db = db_instance.get_db()
    if db is None:
        print("❌ Failed to connect to database")
        return
    
    print("✅ Connected to database")
    
    # Analyze offers
    changes, category_stats, mismatches = analyze_offers(db, dry_run)
    
    # Print statistics
    print("\n" + "=" * 60)
    print("📊 CATEGORY STATISTICS")
    print("=" * 60)
    for category, stats in sorted(category_stats.items()):
        print(f"  {category}: {stats['total']} offers ({stats['changed']} to be updated)")
    
    print(f"\n📝 Total offers to update: {len(changes)}")
    
    # Show sample changes
    if changes:
        print("\n" + "=" * 60)
        print("🔄 SAMPLE CHANGES (first 20)")
        print("=" * 60)
        for change in changes[:20]:
            print(f"\n  Offer: {change['name']}")
            print(f"  ID: {change['offer_id']}")
            print(f"  Current: {change['current']} → Detected: {change['detected']}")
            print(f"  Confidence: {change['confidence']}")
            print(f"  Reason: {change['reason']}")
    
    # Show mismatches if requested
    if args.show_mismatches and mismatches:
        print("\n" + "=" * 60)
        print("⚠️  SIGNIFICANT MISMATCHES (first 30)")
        print("=" * 60)
        for m in mismatches[:30]:
            print(f"\n  Offer: {m['name']}")
            print(f"  Description: {m['description']}...")
            print(f"  Current: {m['current']} → Should be: {m['detected']}")
            print(f"  Reason: {m['reason']}")
    
    # Apply changes if not dry run
    if not dry_run:
        print("\n" + "=" * 60)
        confirm = input("⚠️  Are you sure you want to apply these changes? (yes/no): ")
        if confirm.lower() == 'yes':
            updated = apply_changes(db, changes, dry_run=False)
            print(f"\n✅ Updated {updated} offers")
        else:
            print("\n❌ Cancelled")
    else:
        print("\n" + "=" * 60)
        print("💡 This was a DRY RUN. To apply changes, run with --apply flag:")
        print("   python migrations/fix_offer_categories.py --apply")
        print("=" * 60)


if __name__ == '__main__':
    main()
