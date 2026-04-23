import sys
import os

target_file = r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\backend\routes\public_api.py'

with open(target_file, 'r') as f:
    content = f.read()

# Make sure we don't duplicate
if '@public_api_bp.route(\'/v1/statistics\'' not in content:
    # 1. Update /v1/offers response
    content = content.replace('''        return jsonify({
            'success': True,
            'publisher': publisher.get('username'),
            'detected_geo': country_code,
            'offers_count': len(result_offers),
            'offers': result_offers
        })''', '''        return jsonify({
            'status': 'success',
            'publisher': publisher.get('username'),
            'detected_geo': country_code,
            'data': result_offers
        })''')

    # 2. Add /v1/statistics and /v1/postback
    new_endpoints = """

@public_api_bp.route('/v1/statistics', methods=['GET'])
def get_public_statistics():
    try:
        from models.api_keys_model import ApiKeyModel
        from datetime import datetime
        
        api_key = request.args.get('api_key')
        start_date = request.args.get('from')
        end_date = request.args.get('to')
        group_by = request.args.get('group_by')
        
        if not api_key:
            return jsonify({'status': 'error', 'message': 'Missing API Key'}), 401
            
        if not start_date or not end_date:
            return jsonify({'status': 'error', 'message': 'Missing required parameters: from, to'}), 400
            
        key_doc = ApiKeyModel().verify_api_key(api_key)
        if not key_doc:
            # Fallback legacy lookup
            user = db_instance.get_collection('users').find_one({'api_key': api_key})
            if not user:
                return jsonify({'status': 'error', 'message': 'Invalid API Key'}), 401
            subid = str(user['_id'])
        else:
            subid = str(key_doc['_id'])
            
        # Compile Stats
        from bson import ObjectId
        query = {
            'api_key_id': ObjectId(subid),
            'date': {'$gte': start_date, '$lte': end_date}
        }
        
        stats_col = db_instance.get_collection('api_stats')
        records = list(stats_col.find(query))
        
        total_clicks = sum(r.get('clicks', 0) for r in records)
        total_leads = sum(r.get('leads', 0) for r in records)
        total_revenue = sum(float(r.get('revenue', 0)) for r in records)
        
        conversion_rate = round((total_leads / total_clicks * 100), 2) if total_clicks > 0 else 0.0
        
        return jsonify({
            'status': 'success',
            'data': {
                'clicks': total_clicks,
                'leads': total_leads,
                'revenue': round(total_revenue, 2),
                'conversion_rate': conversion_rate
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@public_api_bp.route('/v1/postback', methods=['POST', 'GET'])
def public_postback_receiver():
    try:
        click_id = request.args.get('click_id', '')
        offer_id = request.args.get('offer_id', '')
        payout = request.args.get('payout', '0')
        status = request.args.get('status', 'approved')
        s1 = request.args.get('s1', '')
        s2 = request.args.get('s2', '')
        s3 = request.args.get('s3', '')
        s4 = request.args.get('s4', '')
        
        if not click_id:
            return jsonify({'status': 'error', 'message': 'Missing click_id'}), 400
            
        from database import db_instance
        from datetime import datetime
        
        record = {
            'click_id': click_id,
            'offer_id': offer_id,
            'payout': float(payout),
            'status': status,
            'sub_ids': {'s1': s1, 's2': s2, 's3': s3, 's4': s4},
            'timestamp': datetime.utcnow()
        }
        
        db_instance.get_collection('api_conversions').insert_one(record)
        
        return jsonify({'status': 'success', 'message': 'Postback recorded successfully'})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
"""
    content += new_endpoints
    
    with open(target_file, 'w') as f:
        f.write(content)
    print("public_api.py successfully patched.")
else:
    print("Already patched.")
