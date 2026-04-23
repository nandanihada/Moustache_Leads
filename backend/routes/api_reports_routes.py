from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.api_keys_model import ApiKeyModel
from models.api_stats_model import ApiStatsModel
from models.api_conversions_model import ApiConversionsModel
import logging

logger = logging.getLogger(__name__)

api_reports_routes_bp = Blueprint('api_reports_routes', __name__)

api_keys_model = ApiKeyModel()
stats_model = ApiStatsModel()
conversions_model = ApiConversionsModel()

@api_reports_routes_bp.route('/report/stats', methods=['GET'])
@token_required
def get_stats_report():
    try:
        user_id = str(request.current_user['_id'])
        
        # 1. Get all keys for this user
        user_keys = api_keys_model.get_keys_by_user(user_id)
        if not user_keys:
            return jsonify({'success': True, 'stats': []})
            
        # 2. Get stats for all keys
        all_stats = []
        # Filter optionally
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        for k in user_keys:
            key_id = k['_id']
            stats = stats_model.get_stats_by_key(key_id, start_date, end_date)
            for s in stats:
                s['key_name'] = k['key_name']  # Attach name for UI
            all_stats.extend(stats)
            
        return jsonify({'success': True, 'stats': all_stats}), 200
        
    except Exception as e:
        logger.error(f"Error serving stats report: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_reports_routes_bp.route('/report/conversions', methods=['GET'])
@token_required
def get_conversions_report():
    try:
        user_id = str(request.current_user['_id'])
        
        user_keys = api_keys_model.get_keys_by_user(user_id)
        if not user_keys:
            return jsonify({'success': True, 'conversions': []})
            
        all_convs = []
        status_filter = request.args.get('status')
        
        for k in user_keys:
            key_id = k['_id']
            convs = conversions_model.get_conversions_by_key(key_id, status_filter)
            for c in convs:
                c['key_name'] = k['key_name']
            all_convs.extend(convs)
            
        return jsonify({'success': True, 'conversions': all_convs}), 200
        
    except Exception as e:
        logger.error(f"Error serving conversions report: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_reports_routes_bp.route('/admin/report/stats', methods=['GET'])
@token_required
def admin_api_stats():
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'success': False, 'error': 'Admin required'}), 403

    try:
        from database import db_instance
        keys_col = db_instance.get_collection('api_keys')
        users_col = db_instance.get_collection('users')
        stats_col = db_instance.get_collection('api_stats')
        
        all_keys = list(keys_col.find())
        key_map = {str(k['_id']): k for k in all_keys}
        
        user_ids = list(set([k['user_id'] for k in all_keys]))
        users = list(users_col.find({'_id': {'$in': user_ids}}))
        user_map = {str(u['_id']): u for u in users}
        
        merged_keys = []
        for k in all_keys:
            uid = str(k['user_id'])
            user_info = user_map.get(uid, {})
            merged_keys.append({
                'key_id': str(k['_id']),
                'key_name': k.get('key_name', ''),
                'status': k.get('status', 'Active'),
                'created_at': k.get('created_at').strftime('%Y-%m-%d') if k.get('created_at') else '',
                'username': user_info.get('username', 'Unknown'),
                'company_name': user_info.get('company_name', 'Unknown')
            })
            
        all_stats = list(stats_col.find())
        
        merged_stats = []
        for s in all_stats:
            kid = str(s['api_key_id'])
            kinfo = key_map.get(kid, {})
            uinfo = user_map.get(str(kinfo.get('user_id')), {}) if kinfo else {}
            
            merged_stats.append({
                'stat_id': str(s['_id']),
                'api_key_id': kid,
                'key_name': kinfo.get('key_name', 'Unknown') if kinfo else 'Unknown',
                'username': uinfo.get('username', 'Unknown') if uinfo else 'Unknown',
                'company_name': uinfo.get('company_name', 'Unknown') if uinfo else 'Unknown',
                'date': s.get('date'),
                'clicks': s.get('clicks', 0),
                'impressions': s.get('impressions', 0),
                'revenue': s.get('revenue', 0.0),
                'leads': s.get('leads', 0)
            })
            
        return jsonify({
            'success': True,
            'api_keys': merged_keys,
            'stats': merged_stats
        }), 200

    except Exception as e:
        logger.error(f"Error serving admin api stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
