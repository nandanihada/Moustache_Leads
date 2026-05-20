from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

search_intelligence_bp = Blueprint('search_intelligence', __name__)

@search_intelligence_bp.route('/publishers', methods=['GET'])
@token_required
def get_publishers():
    """Get list of publishers with their search summary."""
    try:
        user = request.current_user
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = db_instance.get_collection('search_logs')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Aggregate searches by user_id
        pipeline = [
            {
                '$group': {
                    '_id': '$user_id',
                    'username': {'$first': '$username'},
                    'total_searches': {'$sum': 1},
                    'conversions': {
                        '$sum': {'$cond': [{'$ne': ['$picked_offer', None]}, 1, 0]}
                    },
                    'unique_queries': {'$addToSet': '$keyword'},
                    'last_search_at': {'$max': '$searched_at'},
                    'no_result_count': {
                        '$sum': {'$cond': [{'$eq': ['$no_result', True]}, 1, 0]}
                    },
                    'not_in_inventory_count': {
                        '$sum': {'$cond': [{'$eq': ['$inventory_status', 'not_in_inventory']}, 1, 0]}
                    },
                    'not_active_count': {
                        '$sum': {'$cond': [{'$eq': ['$inventory_status', 'in_inventory_not_active']}, 1, 0]}
                    }
                }
            },
            {'$sort': {'last_search_at': -1}}
        ]

        publishers = list(collection.aggregate(pipeline))

        result = []
        for p in publishers:
            unique_queries_count = len(p['unique_queries'])
            
            # Determine behavior signal
            behavior = 'Standard'
            if p['conversions'] > 0:
                behavior = 'High-Intent Buyer'
            elif p['not_in_inventory_count'] > 0 or p['not_active_count'] > 0:
                behavior = 'On Watchlist'
                
            watchlist_count = p['not_in_inventory_count'] + p['not_active_count']
                
            result.append({
                'user_id': str(p['_id']),
                'username': p.get('username', 'Unknown'),
                'total_searches': p['total_searches'],
                'unique_queries': unique_queries_count,
                'conversions': p['conversions'],
                'watchlist_count': watchlist_count,
                'behavior': behavior,
                'last_search_at': p['last_search_at'].isoformat() + 'Z' if isinstance(p['last_search_at'], datetime) else p['last_search_at']
            })

        return jsonify({'success': True, 'publishers': result}), 200

    except Exception as e:
        logger.error(f"Error fetching search intelligence publishers: {e}")
        return jsonify({'error': str(e)}), 500


@search_intelligence_bp.route('/publishers/<user_id>', methods=['GET'])
@token_required
def get_publisher_intelligence(user_id):
    """Get detailed search intelligence for a specific publisher."""
    try:
        user = request.current_user
        if user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = db_instance.get_collection('search_logs')
        clicks_col = db_instance.get_collection('clicks')
        email_logs_col = db_instance.get_collection('email_activity_logs')
        
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Fetch the target user to get their email
        users_col = db_instance.get_collection('users')
        user_email = None
        if users_col is not None:
            target_user = users_col.find_one({'_id': ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
            if target_user and target_user.get('email'):
                user_email = target_user['email']

        # Fetch all searches for this user
        searches = list(collection.find({'user_id': user_id}).sort('searched_at', -1))
        
        if not searches:
            return jsonify({'success': False, 'error': 'No search logs found for this user'}), 404
            
        username = searches[0].get('username', 'Unknown')
        
        # Calculate summary metrics
        total_searches = len(searches)
        unique_keywords = len(set(s.get('keyword', '').lower() for s in searches))
        
        conversions = 0
        no_result_count = 0
        not_active_count = 0
        not_in_inventory_count = 0
        
        # Prepare timeline and keyword stats
        timeline = []
        keyword_stats = {}
        
        for s in searches:
            s_id = str(s['_id'])
            keyword = s.get('keyword', '')
            keyword_lower = keyword.lower()
            results_count = s.get('results_count', 0)
            inventory_status = s.get('inventory_status', 'not_in_inventory')
            picked_offer = s.get('picked_offer')
            
            # Outcome logic
            outcome = 'Not picked'  # Default if available but nothing picked
            outcome_color = 'dark_red'
            
            if inventory_status == 'not_in_inventory' or s.get('no_result'):
                outcome = 'No offers'
                outcome_color = 'red'
                no_result_count += 1
                not_in_inventory_count += 1
            elif inventory_status == 'in_inventory_not_active':
                outcome = 'Not active'
                outcome_color = 'orange'
                not_active_count += 1
            elif picked_offer or s.get('picked_offer_id') or s.get('clicked_request') or s.get('clicked_preview') or s.get('clicked_tracking'):
                outcome = 'Converted'
                outcome_color = 'green'
                conversions += 1
            else:
                # Check for ID lookup pattern
                import re
                if re.match(r'^[\w-]*\d+[\w-]*$', keyword) or len(keyword) < 5:
                    outcome = 'ID lookup'
                    outcome_color = 'blue'
            
            if keyword_lower not in keyword_stats:
                keyword_stats[keyword_lower] = {
                    'keyword': keyword,
                    'count': 0,
                    'results_count': results_count,
                    'outcome': outcome,
                    'outcome_color': outcome_color
                }
            keyword_stats[keyword_lower]['count'] += 1
                
            timeline.append({
                'id': s_id,
                'date': s['searched_at'].isoformat() + 'Z' if isinstance(s['searched_at'], datetime) else s['searched_at'],
                'keyword': keyword,
                'outcome': outcome,
                'outcome_color': outcome_color,
                'results_count': results_count,
                'inventory_status': inventory_status,
                'total_inventory_count': s.get('total_inventory_count', 0),
                'active_inventory_count': s.get('active_inventory_count', 0)
            })
            
        watchlist_count = not_in_inventory_count + not_active_count
        zero_result_percentage = round((no_result_count / total_searches) * 100) if total_searches > 0 else 0
        
        # Mails sent
        mails_sent = 0
        mail_history = []
        if email_logs_col is not None:
            or_conditions = [
                {'user_id': user_id},
                {'recipient_user_ids': user_id}
            ]
            if user_email:
                or_conditions.append({'recipient_email': user_email})
                
            logs = list(email_logs_col.find({
                '$or': or_conditions
            }).sort('created_at', -1))
            mails_sent = len(logs)
            for log in logs:
                mail_history.append({
                    'id': str(log['_id']),
                    'subject': log.get('offer_names', [''])[0] if log.get('offer_names') else 'Email sent',
                    'type': log.get('source', 'Email'),
                    'offers_count': log.get('offer_count', 0),
                    'sent_at': log['created_at'].isoformat() + 'Z' if isinstance(log.get('created_at'), datetime) else log.get('created_at')
                })

        # Clicks for engagement funnel
        total_clicks = 0
        unique_clicks = 0
        if clicks_col is not None:
            clicks = list(clicks_col.find({'user_id': user_id}))
            total_clicks = len(clicks)
            unique_clicks = len(set(c.get('offer_id') for c in clicks if c.get('offer_id')))
            
        conversion_rate = round((conversions / total_clicks) * 100) if total_clicks > 0 else 0
        
        # Chart Data
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        def calculate_chart_data(time_limit=None):
            chart_searches = searches
            if time_limit:
                chart_searches = [s for s in searches if isinstance(s.get('searched_at'), datetime) and s['searched_at'] >= time_limit]
                
            outcomes = {'No offers': 0, 'Not active': 0, 'Converted': 0, 'Not picked': 0, 'ID lookup': 0}
            total = len(chart_searches)
            
            for s in chart_searches:
                keyword = s.get('keyword', '')
                inventory_status = s.get('inventory_status', 'not_in_inventory')
                picked_offer = s.get('picked_offer')
                
                if inventory_status == 'not_in_inventory' or s.get('no_result'):
                    outcomes['No offers'] += 1
                elif inventory_status == 'in_inventory_not_active':
                    outcomes['Not active'] += 1
                elif picked_offer:
                    outcomes['Converted'] += 1
                else:
                    import re
                    if re.match(r'^[\w-]*\d+[\w-]*$', keyword) or len(keyword) < 5:
                        outcomes['ID lookup'] += 1
                    else:
                        outcomes['Not picked'] += 1
                        
            return {
                'total': total,
                'outcomes': outcomes
            }
            
        charts = {
            'today': calculate_chart_data(today_start),
            'last_7d': calculate_chart_data(seven_days_ago),
            'last_30d': calculate_chart_data(thirty_days_ago)
        }
        
        top_keywords = sorted(list(keyword_stats.values()), key=lambda x: x['count'], reverse=True)[:10]
        
        # Calculate merged bursts: search groups within 5 minutes of each other
        merged_bursts_count = 0
        if searches:
            # Sort chronologically to cluster
            chrono_searches = sorted(searches, key=lambda x: x.get('searched_at') or datetime.min)
            bursts = []
            current_burst = []
            for s in chrono_searches:
                s_time = s.get('searched_at')
                if not isinstance(s_time, datetime):
                    continue
                if not current_burst:
                    current_burst.append(s_time)
                else:
                    diff = (s_time - current_burst[-1]).total_seconds()
                    if diff <= 300: # 5 minutes
                        current_burst.append(s_time)
                    else:
                        bursts.append(current_burst)
                        current_burst = [s_time]
            if current_burst:
                bursts.append(current_burst)
            merged_bursts_count = len([b for b in bursts if len(b) > 1])

        # Calculate exact outcome counts
        id_lookup_count = 0
        not_picked_count = 0
        for s in searches:
            keyword = s.get('keyword', '')
            inventory_status = s.get('inventory_status', 'not_in_inventory')
            picked_offer = s.get('picked_offer')
            
            if inventory_status == 'not_in_inventory' or s.get('no_result'):
                pass
            elif inventory_status == 'in_inventory_not_active':
                pass
            elif picked_offer or s.get('picked_offer_id') or s.get('clicked_request') or s.get('clicked_preview') or s.get('clicked_tracking'):
                pass
            else:
                import re
                if re.match(r'^[\w-]*\d+[\w-]*$', keyword) or len(keyword) < 5:
                    id_lookup_count += 1
                else:
                    not_picked_count += 1

        behavior_signals = {
            'merged_bursts': merged_bursts_count,
            'no_offers': not_in_inventory_count,
            'inactive': not_active_count,
            'not_picked': not_picked_count,
            'id_lookups': id_lookup_count,
            'converted': conversions
        }
        
        behavior_label = 'Standard'
        if conversions > 0:
            behavior_label = 'High-Intent Buyer'
        elif watchlist_count > 0:
            behavior_label = 'On Watchlist'
            
        summary = {
            'username': username,
            'behavior': behavior_label,
            'total_searches': total_searches,
            'unique_keywords': unique_keywords,
            'watchlist_count': watchlist_count,
            'zero_result_percentage': zero_result_percentage,
            'conversions': conversions,
            'mails_sent': mails_sent
        }

        return jsonify({
            'success': True,
            'summary': summary,
            'charts': charts,
            'top_keywords': top_keywords,
            'timeline': timeline,
            'funnel': {
                'total_clicks': total_clicks,
                'real_clicks': unique_clicks,
                'conversions': conversions,
                'conversion_rate': conversion_rate
            },
            'mail_history': mail_history,
            'behavior_signals': behavior_signals
        }), 200

    except Exception as e:
        logger.error(f"Error fetching publisher intelligence: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

