import re

file_path = 'backend/routes/admin_click_tracking.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the $ifNull syntax issue that Atlas rejects
old_agg3 = """        top_countries_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': {'$ifNull': ['$geo.country', '$country']}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
new_agg3 = """        top_countries_pipeline = [
            {'$match': match_query},
            {'$group': {'_id': '$country', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]"""
content = content.replace(old_agg3, new_agg3)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched country aggregation completely!")
