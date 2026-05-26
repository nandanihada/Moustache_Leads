import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from app import app
    from database import db_instance
    
    with app.test_client() as client:
        users_col = db_instance.get_collection('users')
        user = users_col.find_one({'role': 'publisher'})
        if not user:
            user = users_col.find_one()
            
        print(f"Mocking request for user: {user.get('username')} ({user.get('role')})")
        
        import jwt
        from config import Config
        token = jwt.encode({'user_id': str(user['_id'])}, Config.JWT_SECRET_KEY, algorithm='HS256')
        
        headers = {'Authorization': f'Bearer {token}'}
        res = client.get('/api/publisher/offers/available?page=1&per_page=10000', headers=headers)
        print(f"Response status: {res.status_code}")
        
        data = json.loads(res.data)
        offers = data.get('offers', [])
        print(f"Total offers returned by API: {len(offers)}")
        
        print("\nPinned offers returned by the API in their returned order:")
        found_pinned = []
        for idx, offer in enumerate(offers):
            if offer.get('is_pinned'):
                found_pinned.append((idx + 1, offer.get('offer_id'), offer.get('name'), offer.get('pinnedPosition')))
                
        for index_pos, offer_id, name, pinned_pos in found_pinned:
            print(f"Index Position {index_pos}: {offer_id} | {name} | pinnedPosition={pinned_pos}")

except Exception as e:
    print(f"Error: {e}")
