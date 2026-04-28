"""
Migration: Re-categorize offers with 'OTHER' or 'GENERAL' category.
Uses Groq AI to analyze offer name + description and assign the best matching category.
Falls back to keyword-based detection if AI fails.

Run from backend/: python migrations/recategorize_other_general.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from models.offer import detect_categories_from_text
from config import Config
import logging
import json
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VALID_CATEGORIES = [
    'HEALTH', 'SURVEY', 'SWEEPSTAKES', 'EDUCATION', 'INSURANCE',
    'LOAN', 'FINANCE', 'DATING', 'FREE_TRIAL', 'INSTALLS', 'GAMES_INSTALL'
]

def ai_categorize_batch(offers_batch):
    """Use Groq AI to categorize a batch of offers (up to 20 at a time)."""
    try:
        from groq import Groq
        api_key = Config.GROQ_API_KEY
        if not api_key:
            return {}

        client = Groq(api_key=api_key)

        offers_text = ""
        for i, o in enumerate(offers_batch):
            name = o.get('name', '')
            desc = (o.get('description', '') or '')[:200]
            network = o.get('network', '')
            offers_text += f"{i+1}. Name: {name} | Network: {network} | Desc: {desc}\n"

        prompt = f"""Categorize each offer into exactly ONE of these categories:
HEALTH, SURVEY, SWEEPSTAKES, EDUCATION, INSURANCE, LOAN, FINANCE, DATING, FREE_TRIAL, INSTALLS, GAMES_INSTALL

Rules:
- Apps/mobile downloads → INSTALLS
- Games/gaming apps → GAMES_INSTALL  
- Money/banking/crypto/trading/investment → FINANCE
- Loans/credit/lending → LOAN
- Insurance products → INSURANCE
- Health/medical/fitness/wellness/supplements → HEALTH
- Surveys/polls/questionnaires → SURVEY
- Sweepstakes/giveaways/contests/win prizes → SWEEPSTAKES
- Education/courses/learning → EDUCATION
- Dating/romance/relationships → DATING
- Free trials/subscriptions → FREE_TRIAL
- If truly unclear, pick the closest match based on the offer name

Offers:
{offers_text}

Return ONLY a JSON object mapping offer number to category. Example: {{"1": "FINANCE", "2": "INSTALLS"}}"""

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1000,
        )

        raw = completion.choices[0].message.content.strip()
        # Strip markdown code fences
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
            if raw.endswith('```'):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
        return result
    except Exception as e:
        logger.error(f"AI categorization failed: {e}")
        return {}


def recategorize():
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("ERROR: Could not connect to database")
        return

    # Find all offers with OTHER or GENERAL category
    query = {
        '$or': [
            {'vertical': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
            {'category': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
            {'categories': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
        ]
    }

    total = offers_col.count_documents(query)
    print(f"\nFound {total} offers with OTHER/GENERAL category\n")

    if total == 0:
        print("Nothing to do!")
        return

    # Process in batches of 15 for AI
    cursor = list(offers_col.find(query))
    batch_size = 15
    updated = 0
    ai_categorized = 0
    keyword_categorized = 0
    failed = 0

    for i in range(0, len(cursor), batch_size):
        batch = cursor[i:i + batch_size]
        print(f"\nProcessing batch {i // batch_size + 1} ({len(batch)} offers)...")

        # Try AI categorization first
        ai_results = ai_categorize_batch(batch)
        time.sleep(1)  # Rate limit

        for j, offer in enumerate(batch):
            offer_id = offer.get('offer_id', str(offer['_id']))
            name = offer.get('name', 'Unknown')
            old_cat = offer.get('vertical', offer.get('category', 'OTHER'))

            # Try AI result first
            ai_cat = ai_results.get(str(j + 1), '').upper().strip()
            if ai_cat in VALID_CATEGORIES:
                new_cat = ai_cat
                ai_categorized += 1
            else:
                # Fallback to keyword detection
                detected = detect_categories_from_text(name, offer.get('description', ''))
                # Filter out OTHER/GENERAL from detected
                detected = [c for c in detected if c not in ('OTHER', 'GENERAL', 'other', 'general')]
                if detected:
                    new_cat = detected[0]
                    keyword_categorized += 1
                else:
                    # Last resort: use SWEEPSTAKES as default (most common in affiliate marketing)
                    new_cat = 'SWEEPSTAKES'
                    failed += 1

            # Update the offer
            update_data = {
                'vertical': new_cat,
                'category': new_cat,
            }
            # Also update categories array — replace OTHER/GENERAL with new category
            categories = offer.get('categories', [])
            new_categories = [c for c in categories if c not in ('OTHER', 'GENERAL', 'other', 'general')]
            if new_cat not in new_categories:
                new_categories.insert(0, new_cat)
            update_data['categories'] = new_categories[:3]

            offers_col.update_one({'_id': offer['_id']}, {'$set': update_data})
            updated += 1

            print(f"  [{updated}/{total}] {name[:50]} | {old_cat} → {new_cat} {'(AI)' if ai_cat in VALID_CATEGORIES else '(keyword)' if new_cat != 'SWEEPSTAKES' else '(default)'}")

    print(f"\n{'='*60}")
    print(f"DONE! Processed {total} offers:")
    print(f"  AI categorized:      {ai_categorized}")
    print(f"  Keyword categorized: {keyword_categorized}")
    print(f"  Default fallback:    {failed}")
    print(f"  Total updated:       {updated}")


if __name__ == '__main__':
    print("=" * 60)
    print("Re-categorize OTHER/GENERAL Offers Migration")
    print("=" * 60)
    print("\nThis will re-assign all offers with OTHER or GENERAL category")
    print("to a proper category using AI + keyword detection.\n")

    # Show count first
    offers_col = db_instance.get_collection('offers')
    if offers_col is not None:
        query = {
            '$or': [
                {'vertical': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
                {'category': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
                {'categories': {'$in': ['OTHER', 'other', 'Other', 'GENERAL', 'general', 'General']}},
            ]
        }
        count = offers_col.count_documents(query)
        print(f"Offers to re-categorize: {count}")

        if count > 0:
            confirm = input("\nProceed? (y/n): ").strip().lower()
            if confirm == 'y':
                recategorize()
            else:
                print("Aborted.")
        else:
            print("No offers to re-categorize!")
