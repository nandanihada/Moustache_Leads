"""
Migration: Rename 'Eflow' network offers based on upload date.
- May 8 -> Adtogame
- May 23 -> Triod
- After May 23 -> Adtogame
"""
from database import db_instance
from datetime import datetime

def run():
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Cannot connect to offers collection")
        return
    
    total = offers_col.count_documents({'network': 'Eflow'})
    print(f"Total 'Eflow' offers: {total}")
    
    if total == 0:
        print("No Eflow offers to rename")
        return
    
    # Date boundaries
    may8_start = datetime(2026, 5, 8, 0, 0, 0)
    may8_end = datetime(2026, 5, 9, 0, 0, 0)
    may23_start = datetime(2026, 5, 23, 0, 0, 0)
    may23_end = datetime(2026, 5, 24, 0, 0, 0)
    after_may23 = datetime(2026, 5, 24, 0, 0, 0)
    
    # Count each group
    may8_count = offers_col.count_documents({'network': 'Eflow', 'created_at': {'$gte': may8_start, '$lt': may8_end}})
    may23_count = offers_col.count_documents({'network': 'Eflow', 'created_at': {'$gte': may23_start, '$lt': may23_end}})
    after23_count = offers_col.count_documents({'network': 'Eflow', 'created_at': {'$gte': after_may23}})
    other_count = total - may8_count - may23_count - after23_count
    
    print(f"\nDate distribution:")
    print(f"  May 8:       {may8_count} offers -> Adtogame")
    print(f"  May 23:      {may23_count} offers -> Triod")
    print(f"  After May 23: {after23_count} offers -> Adtogame")
    print(f"  Other dates: {other_count} offers -> Adtogame (default)")
    
    # Rename May 8 -> Adtogame
    r1 = offers_col.update_many(
        {'network': 'Eflow', 'created_at': {'$gte': may8_start, '$lt': may8_end}},
        {'$set': {'network': 'Adtogame'}}
    )
    print(f"\n  May 8 -> Adtogame: {r1.modified_count} updated")
    
    # Rename May 23 -> Triod
    r2 = offers_col.update_many(
        {'network': 'Eflow', 'created_at': {'$gte': may23_start, '$lt': may23_end}},
        {'$set': {'network': 'Triod'}}
    )
    print(f"  May 23 -> Triod: {r2.modified_count} updated")
    
    # Rename after May 23 -> Adtogame
    r3 = offers_col.update_many(
        {'network': 'Eflow', 'created_at': {'$gte': after_may23}},
        {'$set': {'network': 'Adtogame'}}
    )
    print(f"  After May 23 -> Adtogame: {r3.modified_count} updated")
    
    # Rename any remaining Eflow (other dates) -> Adtogame
    r4 = offers_col.update_many(
        {'network': 'Eflow'},
        {'$set': {'network': 'Adtogame'}}
    )
    print(f"  Remaining -> Adtogame: {r4.modified_count} updated")
    
    # Verify
    remaining = offers_col.count_documents({'network': 'Eflow'})
    print(f"\nRemaining 'Eflow' offers: {remaining}")
    print("Done!")

if __name__ == '__main__':
    run()
