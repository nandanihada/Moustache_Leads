import re
import datetime

file_path = 'backend/routes/admin_click_tracking.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the collection selection snippet
old_code = '''        days = int(request.args.get('days', 7))
        start_date = datetime.utcnow() - timedelta(days=days)
        clicks_collection = db_instance.get_collection('clicks')
        
        # Match clicks in date range
        match_query = {'created_at': {'$gte': start_date}}'''

new_code = '''        days = int(request.args.get('days', 365))
        source = request.args.get('source', 'offerwall')
        start_date = datetime.utcnow() - timedelta(days=days)
        
        if source == 'dashboard':
            clicks_collection = db_instance.get_collection('dashboard_clicks')
            match_query = {'timestamp': {'$gte': start_date}}
            user_field = '$user_id' # or affiliate_id
            offer_field = '$offer_id'
        else:
            clicks_collection = db_instance.get_collection('offerwall_clicks_detailed')
            if clicks_collection.count_documents({}) == 0:
                clicks_collection = db_instance.get_collection('offerwall_clicks')
            match_query = {'timestamp': {'$gte': start_date}}
            user_field = '$user_id'
            offer_field = '$offer_id'
'''
content = content.replace(old_code, new_code)

old_agg1 = """        top_users_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': '$affiliate_id', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
new_agg1 = """        top_users_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': user_field, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
content = content.replace(old_agg1, new_agg1)

old_agg2 = """        top_offers_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
new_agg2 = """        top_offers_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': offer_field, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
content = content.replace(old_agg2, new_agg2)

old_agg3 = """        top_countries_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': '$country', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
new_agg3 = """        top_countries_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': {'$ifNull': ['$geo.country', '$country']}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
content = content.replace(old_agg3, new_agg3)

old_loop = '''        clicks_cursor = clicks_collection.find(match_query).sort('created_at', -1).limit(1000)
        clicks = list(clicks_cursor)
        
        # Analyze suspicious clicks'''
        
new_loop = '''        clicks_cursor = clicks_collection.find(match_query).sort('timestamp', -1).limit(1000)
        clicks = list(clicks_cursor)
        
        # Analyze suspicious clicks'''
content = content.replace(old_loop, new_loop)

old_user_id = """user_id = click.get('affiliate_id', 'Unknown')"""
new_user_id = """user_id = click.get('user_id') or click.get('affiliate_id') or click.get('publisher_id', 'Unknown')"""
content = content.replace(old_user_id, new_user_id)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched completely!")
