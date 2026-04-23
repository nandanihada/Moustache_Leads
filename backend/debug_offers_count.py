import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance

def run():
    offers_col = db_instance.get_collection('offers')
    
    total = offers_col.count_documents({})
    print(f"Total offers in DB: {total}")
    
    active_status = offers_col.count_documents({'status': 'active'})
    print(f"Offers with status='active': {active_status}")
    
    is_act = offers_col.count_documents({'is_active': True})
    print(f"Offers with is_active=True: {is_act}")
    
    app_status = offers_col.count_documents({'$or': [{'approval_status': 'approved'}, {'approval_status': 'active'}]})
    print(f"Offers with approval_status in (approved, active): {app_status}")
    
    public_status = offers_col.count_documents({'$or': [{'is_public': True}, {'access_type': 'public'}]})
    print(f"Offers that are public: {public_status}")
    
    # Run the exact query from smart_link_service base
    query = {
        'status': 'active',
        'is_active': True,
        '$and': [
            {'$or': [
                {'approval_status': 'approved'},
                {'approval_status': 'active'}
            ]},
            {'$or': [
                {'is_public': True},
                {'access_type': 'public'}
            ]},
            {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
        ]
    }
    
    final_eligible = offers_col.count_documents(query)
    print(f"\nFinal eligible public offers via query: {final_eligible}")

if __name__ == '__main__':
    run()
