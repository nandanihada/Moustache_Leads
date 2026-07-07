"""
Admin Reports API Routes
Admin-facing endpoints for performance and conversion reports
Shows ALL publishers' data with extra admin columns (publisher name, IP, end-user info)
"""

from flask import Blueprint, request, jsonify
from models.user_reports import UserReports
from utils.auth import token_required, subadmin_or_admin_required
from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import csv
import io

logger = logging.getLogger(__name__)

admin_reports_bp = Blueprint('admin_reports', __name__)
user_reports_model = UserReports()


def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


@admin_reports_bp.route('/api/admin/reports/performance', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_performance_report():
    """Admin performance report - shows ALL publishers' data"""
    try:
        user = request.current_user
        user_id = str(user['_id'])

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not start_date_str or not end_date_str:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
        else:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                if len(start_date_str) == 10:
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                if len(end_date_str) == 10:
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format'}), 400

        # if (end_date - start_date).days > 365:
        #     return jsonify({'error': 'Date range cannot exceed 365 days'}), 400

        filters = {}
        if request.args.get('offer_id'):
            filters['offer_id'] = request.args.get('offer_id').split(',')
        if request.args.get('country'):
            filters['country'] = request.args.get('country').split(',')
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('publisher_id'):
            filters['publisher_id'] = request.args.get('publisher_id')
        if request.args.get('device_type'):
            filters['device_type'] = request.args.get('device_type')
        for i in range(1, 6):
            sub_key = f'sub_id{i}'
            if request.args.get(sub_key):
                filters[sub_key] = request.args.get(sub_key)

        group_by_str = request.args.get('group_by', 'date,offer_id')
        group_by = group_by_str.split(',') if group_by_str else ['date', 'offer_id']

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 400)
        pagination = {'page': page, 'per_page': per_page}

        sort_field = request.args.get('sort_field', 'date')
        sort_order = request.args.get('sort_order', 'desc')
        sort = {'field': sort_field, 'order': sort_order}

        # Additional filters: region, city, category, network, source, granularity
        region_filter = request.args.get('region')
        city_filter = request.args.get('city')
        category_filter = request.args.get('category')
        network_filter = request.args.get('network')
        source_filter = request.args.get('source')  # 'offerwall' = only offerwall collections
        granularity = request.args.get('granularity', 'daily')  # hourly, daily, weekly, monthly
        
        if source_filter:
            filters['source'] = source_filter
        if granularity:
            filters['granularity'] = granularity

        date_range = {'start': start_date, 'end': end_date}
        report = user_reports_model.get_performance_report(
            user_id=user_id,
            date_range=date_range,
            filters=filters,
            group_by=group_by,
            pagination=pagination,
            sort=sort
        )

        if 'error' in report:
            return jsonify({'error': report['error']}), 500

        # Post-enrichment filtering for fields that come from click/offer enrichment
        if region_filter or city_filter or category_filter or network_filter:
            filtered = []
            for row in report.get('data', []):
                if region_filter and (row.get('region') or '').lower() != region_filter.lower():
                    continue
                if city_filter and (row.get('city') or '').lower() != city_filter.lower():
                    continue
                if category_filter and (row.get('category') or '').lower() != category_filter.lower():
                    continue
                if network_filter and (row.get('network') or '').lower() != network_filter.lower():
                    continue
                filtered.append(row)
            report['data'] = filtered
            report['pagination']['total'] = len(filtered)
            report['pagination']['pages'] = (len(filtered) + per_page - 1) // per_page if filtered else 0

        # Secure sensitive platform margin data in admin views
        if user.get('role') == 'subadmin':
            if 'data' in report:
                for row in report['data']:
                    row['total_revenue'] = row.get('total_payout', 0.0)
                    row['profit'] = 0.0
                    row['roi'] = 0.0
            if 'summary' in report:
                summary = report['summary']
                summary['total_revenue'] = summary.get('total_payout', 0.0)
                summary['profit'] = 0.0
                summary['roi'] = 0.0

        return jsonify({'success': True, 'report': report}), 200

    except Exception as e:
        logger.error(f"Error in admin_performance_report: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@admin_reports_bp.route('/api/admin/reports/conversions', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_conversion_report():
    """Admin conversion report - shows ALL conversions across all publishers"""
    try:
        user = request.current_user
        user_id = str(user['_id'])

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not start_date_str or not end_date_str:
            end_date = datetime.utcnow()
            start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                if len(start_date_str) == 10:
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                if len(end_date_str) == 10:
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format'}), 400

        source_filter = request.args.get('source')  # 'offerwall' = query offerwall_conversions

        # === OFFERWALL SOURCE: query offerwall_conversions directly ===
        if source_filter == 'offerwall':
            # Try offerwall_conversions first, fall back to forwarded_postbacks filtered by placement
            convs_col = db_instance.get_collection('offerwall_conversions')
            use_forwarded_fallback = False
            
            # Check if offerwall_conversions has data
            if convs_col is not None:
                test_count = convs_col.count_documents({'timestamp': {'$gte': start_date, '$lte': end_date}})
                if test_count == 0:
                    use_forwarded_fallback = True
            else:
                use_forwarded_fallback = True
            
            # Fallback: use forwarded_postbacks (which definitely has conversion data)
            # Filter to offerwall conversions by checking placement_id is set
            if use_forwarded_fallback:
                convs_col = db_instance.get_collection('forwarded_postbacks')
                if convs_col is None:
                    return jsonify({'error': 'Database not available'}), 503

            query = {'timestamp': {'$gte': start_date, '$lte': end_date}}
            
            # If using forwarded_postbacks fallback, filter to only offerwall conversions
            # These have a placement_id set (from offerwall click tracking)
            if use_forwarded_fallback:
                query['placement_id'] = {'$exists': True, '$nin': ['', None, 'default']}
            
            publisher_id_filter = request.args.get('publisher_id')
            user_id_filter = request.args.get('user_id')
            offer_id_filter = request.args.get('offer_id')
            status_filter = request.args.get('status')
            country_filter = request.args.get('country')
            device_filter = request.args.get('device_type')
            network_filter = request.args.get('network')
            category_filter = request.args.get('category')
            search_filter = request.args.get('search')
            
            if publisher_id_filter:
                if use_forwarded_fallback:
                    query['publisher_id'] = publisher_id_filter
                else:
                    query['publisher_id'] = publisher_id_filter
            if user_id_filter:
                if use_forwarded_fallback:
                    query['$or'] = [{'username': user_id_filter}, {'end_user_id': user_id_filter}]
                else:
                    query['user_id'] = user_id_filter
            if offer_id_filter:
                query['offer_id'] = offer_id_filter
            if status_filter and status_filter != 'all':
                if use_forwarded_fallback:
                    query['forward_status'] = status_filter
                else:
                    query['status'] = status_filter
            if country_filter:
                query['country'] = country_filter
            if device_filter:
                query['device_type'] = device_filter
            
            # Network/category filter: find matching offer_ids first
            if network_filter or category_filter:
                offers_col_filter = db_instance.get_collection('offers')
                if offers_col_filter is not None:
                    offer_query = {}
                    if network_filter:
                        offer_query['network'] = {'$regex': f'^{network_filter}$', '$options': 'i'}
                    if category_filter:
                        offer_query['$or'] = [
                            {'category': {'$regex': f'^{category_filter}$', '$options': 'i'}},
                            {'vertical': {'$regex': f'^{category_filter}$', '$options': 'i'}},
                        ]
                    matching_offer_ids = [o['offer_id'] for o in offers_col_filter.find(offer_query, {'offer_id': 1}) if o.get('offer_id')]
                    if matching_offer_ids:
                        if 'offer_id' in query:
                            # Intersect
                            query['offer_id'] = {'$in': [query['offer_id']] if isinstance(query['offer_id'], str) else query['offer_id']}
                        else:
                            query['offer_id'] = {'$in': matching_offer_ids}
                    else:
                        query['offer_id'] = {'$in': []}  # No matches
            
            # Search filter: match offer_name or publisher_name
            if search_filter:
                search_conditions = [
                    {'offer_name': {'$regex': search_filter, '$options': 'i'}},
                    {'publisher_name': {'$regex': search_filter, '$options': 'i'}},
                ]
                if use_forwarded_fallback:
                    search_conditions.append({'username': {'$regex': search_filter, '$options': 'i'}})
                if '$and' not in query:
                    query['$and'] = []
                query['$and'].append({'$or': search_conditions})

            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 50)), 200)
            sort_field = request.args.get('sort_field', 'timestamp')
            sort_order = -1 if request.args.get('sort_order', 'desc') == 'desc' else 1

            total = convs_col.count_documents(query)
            skip = (page - 1) * per_page
            conversions_raw = list(convs_col.find(query, allow_disk_use=True).sort(sort_field, sort_order).skip(skip).limit(per_page))

            # Batch-load offer data
            offer_ids = list(set(c.get('offer_id') for c in conversions_raw if c.get('offer_id')))
            offers_map = {}
            if offer_ids:
                offers_col = db_instance.get_collection('offers')
                if offers_col is not None:
                    for o in offers_col.find({'offer_id': {'$in': offer_ids}}, {'offer_id': 1, 'name': 1, 'network': 1, 'category': 1, 'payout': 1, 'revenue': 1, 'currency': 1, 'postback_url': 1}):
                        offers_map[o['offer_id']] = o

            # Batch-load publisher data
            pub_ids = list(set(c.get('publisher_id') for c in conversions_raw if c.get('publisher_id')))
            users_map = {}
            if pub_ids:
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    from bson import ObjectId as BsonObjectId
                    valid_oids = []
                    for pid in pub_ids:
                        try:
                            valid_oids.append(BsonObjectId(pid))
                        except Exception:
                            pass
                    if valid_oids:
                        for u in users_col.find({'_id': {'$in': valid_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1}):
                            users_map[str(u['_id'])] = u
                    # Also try by username for publisher_name field
                    unmatched = [pid for pid in pub_ids if pid not in users_map]
                    if unmatched:
                        for u in users_col.find({'username': {'$in': unmatched}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1}):
                            users_map[u['username']] = u
                    # Also try publisher_name field values
                    pub_names = list(set(c.get('publisher_name') for c in conversions_raw if c.get('publisher_name') and c.get('publisher_name') != 'Unknown'))
                    if pub_names:
                        for u in users_col.find({'username': {'$in': pub_names}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1}):
                            users_map[u['username']] = u

            # Enrich and build response
            conversions = []
            for conv in conversions_raw:
                offer_data = offers_map.get(conv.get('offer_id', ''), {})
                pub_key = conv.get('publisher_id', '') or conv.get('publisher_name', '')
                pub_data = users_map.get(pub_key, {})
                # Also try publisher_name as username
                if not pub_data and conv.get('publisher_name'):
                    pub_data = users_map.get(conv.get('publisher_name', ''), {})
                
                # Timestamp
                ts = conv.get('timestamp')
                if ts and hasattr(ts, 'strftime'):
                    ist_ts = ts + timedelta(hours=5, minutes=30)
                    time_str = ist_ts.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    time_str = str(ts) if ts else ''

                # Payout/Revenue handling differs between collections
                if use_forwarded_fallback:
                    payout = conv.get('points', 0) or offer_data.get('payout', 0)
                    revenue = offer_data.get('revenue') or offer_data.get('payout', 0) or payout
                    status = conv.get('forward_status', 'pending')
                    # Map forward_status to display status
                    if status in ('forwarded', 'success'):
                        status = 'completed'
                    elif status == 'not_forwarded':
                        status = 'completed'  # Conversion happened, just no publisher postback
                else:
                    payout = conv.get('payout_amount') or conv.get('payout') or offer_data.get('payout', 0)
                    revenue = conv.get('revenue') or offer_data.get('revenue') or payout
                    status = conv.get('status', 'pending')

                points = conv.get('points_awarded') or conv.get('points', 0)

                conversions.append({
                    '_id': str(conv['_id']),
                    'conversion_id': conv.get('conversion_id', str(conv['_id'])),
                    'click_id': conv.get('click_id', ''),
                    'offer_id': conv.get('offer_id', ''),
                    'offer_name': conv.get('offer_name', '') or offer_data.get('name', ''),
                    'publisher_id': conv.get('publisher_id', ''),
                    'publisher_name': pub_data.get('name') or pub_data.get('username') or conv.get('publisher_name', '') or conv.get('publisher_id', ''),
                    'publisher_email': pub_data.get('email', ''),
                    'publisher_role': pub_data.get('role', 'partner'),
                    'user_id': conv.get('end_user_id') or conv.get('user_id') or conv.get('username', ''),
                    'placement_id': conv.get('placement_id', ''),
                    'placement_title': conv.get('placement_title', ''),
                    'status': status,
                    'time': time_str,
                    'timestamp': time_str,
                    'payout': float(payout) if payout else 0,
                    'points': int(points) if points else 0,
                    'revenue': float(revenue) if revenue else 0,
                    'profit': round(float(revenue or 0) - float(payout or 0), 2),
                    'currency': conv.get('currency') or offer_data.get('currency', 'USD'),
                    'network': offer_data.get('network', ''),
                    'category': offer_data.get('category', ''),
                    'advertiser_name': offer_data.get('network', ''),
                    'postback_url': offer_data.get('postback_url', ''),
                    'forward_status': conv.get('forward_status', ''),
                    'reversed_at': str(conv['reversed_at']) if conv.get('reversed_at') else '',
                    'conversion_type': conv.get('conversion_type', 'conversion'),
                    'transaction_id': conv.get('transaction_id', ''),
                    'country': conv.get('country', ''),
                    'device_type': conv.get('device_type', ''),
                    'ip_address': conv.get('ip_address', ''),
                })

            return jsonify({
                'success': True,
                'report': {
                    'conversions': conversions,
                    'pagination': {
                        'page': page, 'per_page': per_page,
                        'total': total, 'pages': (total + per_page - 1) // per_page
                    }
                }
            }), 200

        # if (end_date - start_date).days > 365:
        #     return jsonify({'error': 'Date range cannot exceed 365 days'}), 400

        filters = {}
        if request.args.get('offer_id'):
            filters['offer_id'] = request.args.get('offer_id')
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('country'):
            filters['country'] = request.args.get('country')
        if request.args.get('transaction_id'):
            filters['transaction_id'] = request.args.get('transaction_id')
        if request.args.get('publisher_name'):
            filters['publisher_name'] = request.args.get('publisher_name')
        if request.args.get('publisher_id'):
            filters['publisher_id'] = request.args.get('publisher_id')
        if request.args.get('device_type'):
            filters['device_type'] = request.args.get('device_type')
        if request.args.get('click_id'):
            filters['click_id'] = request.args.get('click_id')

        # Additional post-enrichment filter params
        region_filter = request.args.get('region')
        city_filter = request.args.get('city')
        category_filter = request.args.get('category')
        network_filter = request.args.get('network')

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        pagination = {'page': page, 'per_page': per_page}

        sort_field = request.args.get('sort_field', 'timestamp')
        sort_order = request.args.get('sort_order', 'desc')

        date_range = {'start': start_date, 'end': end_date}
        report = user_reports_model.get_conversion_report(
            user_id=user_id,
            date_range=date_range,
            filters=filters,
            pagination=pagination
        )

        if 'error' in report:
            return jsonify({'error': report['error']}), 500

        # Enrich conversions with click-level data (IP, country, device, browser, sub IDs)
        # Search ALL click collections since clicks can come from different sources
        clicks_collection = db_instance.get_collection('clicks')
        offerwall_clicks_detailed = db_instance.get_collection('offerwall_clicks_detailed')
        offerwall_clicks = db_instance.get_collection('offerwall_clicks')
        dashboard_clicks = db_instance.get_collection('dashboard_clicks')

        conversions = report.get('conversions', [])

        # Batch-load offers for postback_url enrichment
        conv_offer_ids = set(c.get('offer_id', '') for c in conversions if c.get('offer_id'))
        offers_cache = {}
        if conv_offer_ids:
            offers_col = db_instance.get_collection('offers')
            if offers_col is not None:
                for o in offers_col.find({'offer_id': {'$in': list(conv_offer_ids)}},
                                         {'offer_id': 1, 'postback_url': 1, 'network': 1, 'category': 1}):
                    offers_cache[o['offer_id']] = o

        for conv in conversions:
            conv['publisher_name'] = conv.get('publisher_name', 'Unknown')
            conv['click_id'] = conv.get('click_id', '')
            conv['placement_title'] = conv.get('placement_title', '')
            conv['points'] = conv.get('points', 0)
            conv['conversion_id'] = conv.get('_id', '')
            # Secure sensitive platform margin data in admin views
            if user.get('role') == 'subadmin':
                conv['revenue'] = conv.get('points', 0)
                conv['profit'] = 0.0
            else:
                conv['revenue'] = conv.get('revenue', conv.get('points', 0))
                conv['profit'] = round(float(conv.get('revenue', conv.get('points', 0))) - float(conv.get('points', 0)), 2)
            conv['currency'] = conv.get('currency', 'USD')
            conv['conversion_type'] = conv.get('conversion_type', 'conversion')
            conv['postback_received_time'] = conv.get('postback_received_time', conv.get('time', ''))

            # Enrich with offer-level data (postback_url, network, category)
            offer_data = offers_cache.get(conv.get('offer_id', ''))
            if offer_data:
                conv['postback_url'] = offer_data.get('postback_url', '')
                conv['network'] = conv.get('network') or offer_data.get('network', '')
                conv['category'] = conv.get('category') or offer_data.get('category', '')

            # Enrich from click record if click_id exists — search all click collections
            click_id = conv.get('click_id', '')
            if click_id and click_id != 'unknown':
                try:
                    click = None
                    source = None

                    # 1. Simple clicks (flat fields)
                    if clicks_collection is not None:
                        click = clicks_collection.find_one({'click_id': click_id})
                        if click:
                            source = 'simple'

                    # 2. Offerwall clicks detailed
                    if not click and offerwall_clicks_detailed is not None:
                        click = offerwall_clicks_detailed.find_one({'click_id': click_id})
                        if click:
                            source = 'offerwall_detailed'

                    # 3. Offerwall clicks (regular)
                    if not click and offerwall_clicks is not None:
                        click = offerwall_clicks.find_one({'click_id': click_id})
                        if click:
                            source = 'offerwall'

                    # 4. Dashboard clicks (nested fields)
                    if not click and dashboard_clicks is not None:
                        click = dashboard_clicks.find_one({'click_id': click_id})
                        if click:
                            source = 'dashboard'

                    if click:
                        if source == 'dashboard':
                            # Dashboard clicks — rich nested data
                            geo = click.get('geo', {})
                            net = click.get('network', {})
                            dev = click.get('device', {})
                            fraud = click.get('fraud_indicators', {})

                            conv['ip_address'] = net.get('ip_address', '')
                            conv['asn'] = net.get('asn', '')
                            conv['isp'] = net.get('isp', '')
                            conv['organization'] = net.get('organization', '')
                            conv['vpn_detected'] = net.get('vpn_detected', False)
                            conv['proxy_detected'] = net.get('proxy_detected', False)
                            conv['tor_detected'] = net.get('tor_detected', False)

                            conv['country'] = conv.get('country') or geo.get('country', '')
                            conv['country_code'] = geo.get('country_code', '')
                            conv['region'] = geo.get('region', '')
                            conv['city'] = geo.get('city', '')
                            conv['postal_code'] = geo.get('postal_code', '')
                            conv['latitude'] = geo.get('latitude', '')
                            conv['longitude'] = geo.get('longitude', '')
                            conv['timezone'] = geo.get('timezone', '')

                            conv['device_type'] = dev.get('type', '')
                            conv['browser'] = dev.get('browser', '')
                            conv['os'] = dev.get('os', '')
                            conv['referer'] = click.get('referrer', '')

                            conv['fraud_status'] = fraud.get('fraud_status', '')
                            conv['fraud_score'] = fraud.get('fraud_score', 0)

                            conv['user_email'] = click.get('user_email', '')
                            conv['user_role'] = click.get('user_role', '')
                            conv['click_source'] = 'dashboard'
                        else:
                            # Simple/offerwall clicks — flat fields
                            conv['ip_address'] = click.get('ip_address', '')
                            conv['country'] = conv.get('country') or click.get('country', '')
                            conv['country_code'] = click.get('country_code', '')
                            conv['city'] = click.get('city', '')
                            conv['region'] = click.get('region', '')
                            conv['device_type'] = click.get('device_type', '')
                            conv['browser'] = click.get('browser', '')
                            conv['os'] = click.get('os', '')
                            conv['referer'] = click.get('referer', '')
                            conv['click_source'] = source

                        conv['click_time'] = click.get('timestamp', click.get('click_time', ''))
                        if isinstance(conv['click_time'], datetime):
                            conv['click_time'] = conv['click_time'].strftime('%Y-%m-%d %H:%M:%S')
                        for i in range(1, 6):
                            conv[f'sub_id{i}'] = click.get(f'sub_id{i}', '')

                        # Look up publisher email if not already set
                        if not conv.get('user_email'):
                            pub_id = conv.get('publisher_id', '')
                            if pub_id:
                                try:
                                    users_col = db_instance.get_collection('users')
                                    pub = users_col.find_one(
                                        {'_id': ObjectId(pub_id)} if ObjectId.is_valid(pub_id) else {'username': pub_id},
                                        {'email': 1, 'role': 1}
                                    )
                                    if pub:
                                        conv['user_email'] = pub.get('email', '')
                                        conv['user_role'] = conv.get('user_role') or pub.get('role', '')
                                except Exception:
                                    pass
                except Exception as e:
                    logger.warning(f"Could not enrich conversion with click data: {e}")

        # Post-enrichment filtering for fields that come from click records or offer data
        filter_country = request.args.get('country')
        filter_device = request.args.get('device_type')
        if filter_country or filter_device or region_filter or city_filter or category_filter or network_filter:
            filtered = []
            for conv in conversions:
                if filter_country and conv.get('country', '').lower() != filter_country.lower():
                    continue
                if filter_device and conv.get('device_type', '').lower() != filter_device.lower():
                    continue
                if region_filter and (conv.get('region') or '').lower() != region_filter.lower():
                    continue
                if city_filter and (conv.get('city') or '').lower() != city_filter.lower():
                    continue
                if category_filter and (conv.get('category') or '').lower() != category_filter.lower():
                    continue
                if network_filter and (conv.get('network') or '').lower() != network_filter.lower():
                    continue
                filtered.append(conv)
            report['conversions'] = filtered
            # Adjust pagination total to reflect filtered count
            report['pagination']['total'] = len(filtered)
            report['pagination']['pages'] = (len(filtered) + per_page - 1) // per_page if len(filtered) > 0 else 0

        return jsonify({'success': True, 'report': report}), 200

    except Exception as e:
        logger.error(f"Error in admin_conversion_report: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@admin_reports_bp.route('/api/admin/reports/clicks', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_clicks_report():
    """Admin clicks report - raw click data with enriched offer/publisher info"""
    try:
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not start_date_str or not end_date_str:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=1)
        else:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                if len(start_date_str) == 10:
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                if len(end_date_str) == 10:
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format'}), 400

        offer_id = request.args.get('offer_id')
        publisher_id = request.args.get('publisher_id')
        user_id_filter = request.args.get('user_id')  # end user filter for offerwall
        country_filter = request.args.get('country')
        city_filter = request.args.get('city')
        region_filter = request.args.get('region')
        device_filter = request.args.get('device_type')
        category_filter = request.args.get('category')
        network_filter = request.args.get('network')
        source_filter = request.args.get('source')  # 'offerwall' = use offerwall_clicks_detailed
        status_filter = request.args.get('status')  # picked, clicked, pending, completed, reversed

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 200)

        # Determine which collection to query based on source
        if source_filter == 'offerwall':
            # Use offer_picks as the unified source — it has the complete lifecycle:
            # picked → clicked (when Start Offer pressed). Sorted by picked_at desc.
            # The offer_picks collection is the single source of truth for offerwall activity.
            clicks_collection = db_instance.get_collection('offer_picks')
            if clicks_collection is None:
                clicks_collection = db_instance.get_collection('offerwall_clicks')
        else:
            clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is None:
            return jsonify({'error': 'Database not available'}), 503

        # For offer_picks, the timestamp field is 'picked_at' not 'timestamp'
        if source_filter == 'offerwall':
            query = {'picked_at': {'$gte': start_date, '$lte': end_date}}
        else:
            query = {'timestamp': {'$gte': start_date, '$lte': end_date}}
        if offer_id:
            query['offer_id'] = offer_id
        if source_filter == 'offerwall':
            # For offer_picks: filter by publisher via placement lookup
            if publisher_id:
                from bson import ObjectId as BsonOidMain
                placements_col_main = db_instance.get_collection('placements')
                if placements_col_main is not None:
                    try:
                        pub_placements_main = list(placements_col_main.find(
                            {'publisherId': BsonOidMain(publisher_id)},
                            {'placementIdentifier': 1}
                        ))
                        pub_pids = [p['placementIdentifier'] for p in pub_placements_main if p.get('placementIdentifier')]
                        if pub_pids:
                            query['placement_id'] = {'$in': pub_pids}
                        else:
                            query['placement_id'] = {'$in': []}
                    except Exception:
                        query['placement_id'] = {'$in': []}
            # user_id is the end user passed via iframe
            if user_id_filter:
                query['user_id'] = user_id_filter
        else:
            if publisher_id:
                query['$or'] = [{'user_id': publisher_id}, {'affiliate_id': publisher_id}]
        if country_filter:
            if source_filter == 'offerwall':
                # Country in offerwall_clicks_detailed is stored as full name ("India") or code ("IN")
                # Support both formats with case-insensitive match
                if '$and' not in query:
                    query['$and'] = []
                # Try exact match on geo.country OR country field (case insensitive)
                country_regex = {'$regex': f'^{country_filter}$', '$options': 'i'}
                query['$and'].append({'$or': [
                    {'geo.country': country_regex},
                    {'geo.country': {'$regex': country_filter, '$options': 'i'}},
                    {'country': country_regex},
                    {'country': {'$regex': country_filter, '$options': 'i'}},
                ]})
            else:
                query['country'] = country_filter
        if city_filter:
            query['city'] = city_filter
        if region_filter:
            query['region'] = region_filter
        if device_filter:
            if source_filter == 'offerwall':
                # Device stored as device.type (nested) - case insensitive
                device_regex = {'$regex': f'^{device_filter}$', '$options': 'i'}
                if '$and' not in query:
                    query['$and'] = []
                query['$and'].append({'$or': [{'device.type': device_regex}, {'device_type': device_regex}]})
            else:
                query['device_type'] = device_filter

        # Status filter (for offerwall: picked, clicked, pending, completed, reversed)
        if status_filter and status_filter != 'all':
            query['status'] = status_filter

        # Search filter (offer_name or publisher_name)
        search_filter = request.args.get('search')
        if search_filter and source_filter == 'offerwall':
            search_regex = {'$regex': search_filter, '$options': 'i'}
            if '$and' not in query:
                query['$and'] = []
            query['$and'].append({'$or': [
                {'offer_name': search_regex},
                {'publisher_name': search_regex},
                {'user_id': search_regex},
            ]})

        # Phase 1.3: Postback status and event status filters
        # Use $and to combine multiple $or conditions safely
        extra_conditions = []
        
        postback_filter = request.args.get('postback_status')
        if postback_filter == 'received':
            query['postback_received'] = True
        elif postback_filter == 'no_postback':
            query['postback_received'] = {'$ne': True}
        
        event_status_filter = request.args.get('event_status')
        if event_status_filter and event_status_filter != 'all':
            if event_status_filter == 'no_event':
                extra_conditions.append({'$or': [{'event_status': 'no_event'}, {'event_status': {'$exists': False}}]})
            else:
                query['event_status'] = event_status_filter

        fraud_class_filter = request.args.get('fraud_classification')
        if fraud_class_filter and fraud_class_filter != 'all':
            if fraud_class_filter == 'genuine':
                extra_conditions.append({'$or': [{'fraud_classification': 'genuine'}, {'fraud_classification': {'$exists': False}}]})
            else:
                query['fraud_classification'] = fraud_class_filter
        
        # Merge extra conditions into query using $and
        if extra_conditions:
            if '$and' in query:
                query['$and'].extend(extra_conditions)
            else:
                query['$and'] = extra_conditions

        # If category or network filter, get matching offer_ids first
        if category_filter or network_filter:
            offers_col = db_instance.get_collection('offers')
            if offers_col is not None:
                offer_query = {}
                if category_filter:
                    import re as re_mod
                    offer_query['$or'] = [
                        {'category': {'$regex': f'^{re_mod.escape(category_filter)}$', '$options': 'i'}},
                        {'vertical': {'$regex': f'^{re_mod.escape(category_filter)}$', '$options': 'i'}},
                    ]
                if network_filter:
                    import re as re_mod
                    offer_query['network'] = {'$regex': f'^{re_mod.escape(network_filter)}$', '$options': 'i'}
                matching_offers = [o['offer_id'] for o in offers_col.find(offer_query, {'offer_id': 1}) if o.get('offer_id')]
                if 'offer_id' in query:
                    # Intersect with existing offer_id filter
                    query['offer_id'] = {'$in': [query['offer_id']] if isinstance(query['offer_id'], str) else query['offer_id']['$in']}
                    query['offer_id']['$in'] = [oid for oid in query['offer_id']['$in'] if oid in matching_offers]
                else:
                    query['offer_id'] = {'$in': matching_offers}

        total = clicks_collection.count_documents(query)
        skip = (page - 1) * per_page

        clicks = list(clicks_collection.find(query, allow_disk_use=True).sort('picked_at' if source_filter == 'offerwall' else 'timestamp', -1).skip(skip).limit(per_page))

        # Get status counts for filter pills (offerwall source only)
        # IMPORTANT: Use the same base query (minus status filter) so counts reflect active filters
        status_counts = {}
        if source_filter == 'offerwall':
            # Build count query matching the main query but without status filter
            count_query = dict(query)  # Copy the main query
            count_query.pop('status', None)  # Remove status filter for counting all statuses
            
            pipeline = [
                {'$match': count_query},
                {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
            ]
            for doc in clicks_collection.aggregate(pipeline):
                status_counts[doc['_id'] or 'clicked'] = doc['count']
            
            # Also count picks from offer_picks collection (with same filters applied)
            picks_col = db_instance.get_collection('offer_picks')
            if picks_col is not None:
                picks_count_query = {'picked_at': {'$gte': start_date, '$lte': end_date}}
                if user_id_filter:
                    picks_count_query['user_id'] = user_id_filter
                if offer_id:
                    picks_count_query['offer_id'] = offer_id
                # For publisher filter on picks, we need to find placements owned by this publisher
                if publisher_id:
                    placements_col_count = db_instance.get_collection('placements')
                    if placements_col_count is not None:
                        from bson import ObjectId as BsonOidCount
                        try:
                            from bson import ObjectId as BsonOidPub
                            pub_id_query = publisher_id
                            try:
                                pub_id_query = BsonOidPub(publisher_id)
                            except Exception:
                                pass
                            pub_placements = list(placements_col_count.find(
                                {'publisherId': pub_id_query},
                                {'placementIdentifier': 1}
                            ))
                            pub_placement_ids = [p['placementIdentifier'] for p in pub_placements if p.get('placementIdentifier')]
                            if pub_placement_ids:
                                picks_count_query['placement_id'] = {'$in': pub_placement_ids}
                            else:
                                picks_count_query['placement_id'] = {'$in': []}  # No placements = no picks
                        except Exception:
                            pass
                picked_count = picks_col.count_documents(picks_count_query)
                status_counts['picked'] = picked_count
            
            # Count conversions (pending/completed/reversed) from forwarded_postbacks
            fwd_col = db_instance.get_collection('forwarded_postbacks')
            if fwd_col is not None:
                conv_count_query = {
                    'timestamp': {'$gte': start_date, '$lte': end_date},
                    'placement_id': {'$exists': True, '$nin': ['', None, 'default']}
                }
                if offer_id:
                    conv_count_query['offer_id'] = offer_id
                if publisher_id:
                    conv_count_query['publisher_id'] = publisher_id
                # Count completed (forwarded/success/not_forwarded = completed conversions)
                completed_query = {**conv_count_query, 'forward_status': {'$in': ['forwarded', 'success', 'not_forwarded']}}
                status_counts['completed'] = fwd_col.count_documents(completed_query)
                # Count pending
                pending_query = {**conv_count_query, 'forward_status': 'pending'}
                status_counts['pending'] = fwd_col.count_documents(pending_query)
                # Reversed (has reversed_at field)
                reversed_query = {**conv_count_query, 'reversed_at': {'$exists': True, '$ne': None}}
                status_counts['reversed'] = fwd_col.count_documents(reversed_query)
            
            status_counts['all'] = sum(status_counts.values())

        # Status=picked is now handled by the main query on offer_picks (no separate path needed)

        # If filtering by completed/pending/reversed, query forwarded_postbacks
        if source_filter == 'offerwall' and status_filter in ('completed', 'pending', 'reversed'):
            fwd_col = db_instance.get_collection('forwarded_postbacks')
            if fwd_col is None:
                return jsonify({'error': 'Database not available'}), 503
            
            fwd_query = {
                'timestamp': {'$gte': start_date, '$lte': end_date},
                'placement_id': {'$exists': True, '$nin': ['', None, 'default']}
            }
            if publisher_id:
                fwd_query['publisher_id'] = publisher_id
            if offer_id:
                fwd_query['offer_id'] = offer_id
            if status_filter == 'completed':
                fwd_query['forward_status'] = {'$in': ['forwarded', 'success', 'not_forwarded']}
            elif status_filter == 'pending':
                fwd_query['forward_status'] = 'pending'
            elif status_filter == 'reversed':
                fwd_query['reversed_at'] = {'$exists': True, '$ne': None}
            
            total = fwd_col.count_documents(fwd_query)
            skip = (page - 1) * per_page
            fwd_records = list(fwd_col.find(fwd_query, allow_disk_use=True).sort('timestamp', -1).skip(skip).limit(per_page))
            
            # Enrich with offer data
            fwd_offer_ids = list(set(r.get('offer_id') for r in fwd_records if r.get('offer_id')))
            fwd_offers_map = {}
            if fwd_offer_ids:
                offers_col = db_instance.get_collection('offers')
                if offers_col is not None:
                    for o in offers_col.find({'offer_id': {'$in': fwd_offer_ids}}, {'offer_id': 1, 'name': 1, 'network': 1, 'category': 1, 'payout': 1, 'revenue': 1, 'currency': 1}):
                        fwd_offers_map[o['offer_id']] = o
            
            clicks = []
            for r in fwd_records:
                offer_data = fwd_offers_map.get(r.get('offer_id', ''), {})
                ts = r.get('timestamp')
                if ts and hasattr(ts, 'strftime'):
                    ist_ts = ts + timedelta(hours=5, minutes=30)
                    time_str = ist_ts.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    time_str = str(ts) if ts else ''
                
                fwd_status = r.get('forward_status', '')
                if r.get('reversed_at'):
                    display_status = 'reversed'
                elif fwd_status in ('forwarded', 'success', 'not_forwarded'):
                    display_status = 'completed'
                elif fwd_status == 'pending':
                    display_status = 'pending'
                else:
                    display_status = 'completed'
                
                payout = r.get('points', 0) or offer_data.get('payout', 0)
                revenue = offer_data.get('revenue') or offer_data.get('payout', 0) or payout
                
                clicks.append({
                    '_id': str(r['_id']),
                    'click_id': r.get('click_id', ''),
                    'offer_id': r.get('offer_id', ''),
                    'offer_name': r.get('offer_name', '') or offer_data.get('name', ''),
                    'publisher_id': r.get('publisher_id', ''),
                    'publisher_name': r.get('publisher_name', ''),
                    'publisher_role': 'partner',
                    'end_user_id': r.get('end_user_id') or r.get('username', ''),
                    'user_id': r.get('end_user_id') or r.get('username', ''),
                    'status': display_status,
                    'time': time_str,
                    'timestamp': time_str,
                    'when_clicked': time_str,
                    'payout': float(payout),
                    'revenue': float(revenue),
                    'margin': round(float(revenue) - float(payout), 2),
                    'network': offer_data.get('network', ''),
                    'category': offer_data.get('category', ''),
                    'advertiser_name': offer_data.get('network', ''),
                    'currency': offer_data.get('currency', 'USD'),
                    'country': r.get('country', ''),
                    'device_type': r.get('device_type', ''),
                    'ip_address': r.get('ip_address', ''),
                    'is_vpn': False,
                    'is_duplicate': False,
                    'fraud_score': 0,
                    'adv_postback_status': 'received',
                    'pub_postback_status': r.get('forward_status', ''),
                })
            
            return jsonify({
                'success': True,
                'clicks': clicks,
                'status_counts': status_counts,
                'pagination': {
                    'page': page, 'per_page': per_page,
                    'total': total, 'pages': (total + per_page - 1) // per_page
                }
            }), 200

        # Batch-load offer data for enrichment
        offer_ids_in_page = list(set(c.get('offer_id') for c in clicks if c.get('offer_id')))
        offers_map = {}
        if offer_ids_in_page:
            offers_col = db_instance.get_collection('offers')
            if offers_col is not None:
                for o in offers_col.find({'offer_id': {'$in': offer_ids_in_page}}, {'offer_id': 1, 'name': 1, 'network': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'revenue': 1, 'currency': 1, 'target_url': 1, 'postback_url': 1, 'advertiser_id': 1, 'advertiser_name': 1}):
                    offers_map[o['offer_id']] = o

        # Batch-load publisher data
        if source_filter == 'offerwall':
            # For offerwall, resolve publisher via publisher_id field OR placement_id
            pub_ids_in_page = list(set(c.get('publisher_id') for c in clicks if c.get('publisher_id')))
            placement_ids_in_page_ow = list(set(c.get('placement_id') for c in clicks if c.get('placement_id')))
            users_map = {}
            placement_publisher_map = {}

            # First try direct publisher_id lookup
            if pub_ids_in_page:
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    from bson import ObjectId as BsonObjectId
                    valid_oids = []
                    for pid in pub_ids_in_page:
                        try:
                            valid_oids.append(BsonObjectId(pid))
                        except Exception:
                            pass
                    if valid_oids:
                        for u in users_col.find({'_id': {'$in': valid_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u
                    # Also try by username for any unmatched
                    unmatched = [pid for pid in pub_ids_in_page if pid not in users_map]
                    if unmatched:
                        for u in users_col.find({'username': {'$in': unmatched}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[u['username']] = u

            # Also resolve via placement_id for clicks that don't have publisher_id
            if placement_ids_in_page_ow:
                placements_col_ow = db_instance.get_collection('placements')
                users_col_ow = db_instance.get_collection('users')
                if placements_col_ow is not None and users_col_ow is not None:
                    from bson import ObjectId as BsonObjectId
                    placements_data_ow = list(placements_col_ow.find(
                        {'placementIdentifier': {'$in': placement_ids_in_page_ow}},
                        {'placementIdentifier': 1, 'publisherId': 1}
                    ))
                    pub_oids_ow = []
                    placement_to_pubid_ow = {}
                    for p in placements_data_ow:
                        pid = p.get('publisherId')
                        if pid:
                            placement_to_pubid_ow[p.get('placementIdentifier')] = str(pid)
                            try:
                                pub_oids_ow.append(BsonObjectId(str(pid)))
                            except:
                                pass
                    if pub_oids_ow:
                        for u in users_col_ow.find({'_id': {'$in': pub_oids_ow}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u
                    for plc_id, pub_id in placement_to_pubid_ow.items():
                        if pub_id in users_map:
                            placement_publisher_map[plc_id] = users_map[pub_id]
                            placement_publisher_map[plc_id]['_pub_id'] = pub_id

        else:
            # Original logic for simple clicks (user_id = end user, publisher resolved from placement_id)
            user_ids_in_page = list(set(c.get('user_id') for c in clicks if c.get('user_id')))
            affiliate_ids_in_page = list(set(c.get('affiliate_id') for c in clicks if c.get('affiliate_id')))
            placement_ids_in_page = list(set(c.get('placement_id') for c in clicks if c.get('placement_id')))
            users_map = {}

            # Resolve publishers from placement_id → placements → publisherId → users
            placement_publisher_map = {}  # placement_id -> publisher user data
            if placement_ids_in_page:
                placements_col_lookup = db_instance.get_collection('placements')
                users_col = db_instance.get_collection('users')
                if placements_col_lookup is not None and users_col is not None:
                    from bson import ObjectId as BsonObjectId
                    placements_data = list(placements_col_lookup.find(
                        {'placementIdentifier': {'$in': placement_ids_in_page}},
                        {'placementIdentifier': 1, 'publisherId': 1}
                    ))
                    pub_oids = []
                    placement_to_pubid = {}
                    for p in placements_data:
                        pid = p.get('publisherId')
                        if pid:
                            placement_to_pubid[p.get('placementIdentifier')] = str(pid)
                            try:
                                pub_oids.append(BsonObjectId(str(pid)))
                            except:
                                pass
                    if pub_oids:
                        for u in users_col.find({'_id': {'$in': pub_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u
                    # Build placement_id -> user data map
                    for plc_id, pub_id in placement_to_pubid.items():
                        if pub_id in users_map:
                            placement_publisher_map[plc_id] = users_map[pub_id]
                            placement_publisher_map[plc_id]['_pub_id'] = pub_id

            # Also try resolving by username/ObjectId for any user_ids that look like publisher identifiers
            if user_ids_in_page:
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    for u in users_col.find({'username': {'$in': user_ids_in_page}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                        users_map[u['username']] = u
                    # Try ObjectId
                    from bson import ObjectId as BsonObjectId
                    valid_oids = []
                    for uid in user_ids_in_page:
                        try:
                            valid_oids.append(BsonObjectId(uid))
                        except:
                            pass
                    if valid_oids:
                        for u in users_col.find({'_id': {'$in': valid_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u

            # Also resolve affiliate_ids
            if affiliate_ids_in_page:
                users_col = db_instance.get_collection('users')
                if users_col is not None:
                    from bson import ObjectId as BsonObjectId
                    valid_aff_oids = []
                    for aid in affiliate_ids_in_page:
                        try:
                            valid_aff_oids.append(BsonObjectId(aid))
                        except:
                            pass
                    if valid_aff_oids:
                        for u in users_col.find({'_id': {'$in': valid_aff_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u
                    # Try by username
                    for u in users_col.find({'username': {'$in': affiliate_ids_in_page}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                        users_map[u['username']] = u

        # Also load conversion data for offerwall clicks to determine completed/reversed status
        conversions_map = {}
        if source_filter == 'offerwall':
            click_ids_in_page = [c.get('click_id') for c in clicks if c.get('click_id')]
            if click_ids_in_page:
                convs_col = db_instance.get_collection('offerwall_conversions')
                if convs_col is None:
                    convs_col = db_instance.get_collection('forwarded_postbacks')
                if convs_col is not None:
                    for conv in convs_col.find({'click_id': {'$in': click_ids_in_page}}, {'click_id': 1, 'status': 1, 'payout': 1, 'revenue': 1, 'points': 1, 'postback_url': 1, 'forward_status': 1, 'reversed_at': 1}):
                        conversions_map[conv['click_id']] = conv

        for click in clicks:
            click['_id'] = str(click['_id'])

            # FLATTEN NESTED FIELDS for offerwall_clicks_detailed and offerwall_clicks
            # These collections store geo/device/fraud/network in nested objects
            if source_filter == 'offerwall':
                geo = click.get('geo', {})
                device = click.get('device', {})
                fraud = click.get('fraud_indicators', {})
                fingerprint = click.get('fingerprint', {})
                offer_nested = click.get('offer', {})
                network_nested = click.get('network', {})
                
                # Handle 'network' field — can be a nested object (offerwall_clicks) or a string
                if isinstance(network_nested, dict):
                    # offerwall_clicks stores network info as {asn, ip_address, isp, organization, proxy_detected, vpn_detected}
                    click['ip_address'] = click.get('ip_address') or network_nested.get('ip_address', '')
                    click['isp'] = network_nested.get('isp', '')
                    click['asn'] = network_nested.get('asn', '')
                    click['organization'] = network_nested.get('organization', '')
                    click['vpn_detected'] = network_nested.get('vpn_detected', False)
                    click['proxy_detected'] = network_nested.get('proxy_detected', False)
                    click['network'] = ''  # Reset to empty string (not the object)
                
                # Flatten geo fields to top level
                if isinstance(geo, dict) and geo:
                    click['ip_address'] = click.get('ip_address') or geo.get('ip_address', '')
                    click['country'] = click.get('country') or geo.get('country', '')
                    click['country_code'] = click.get('country_code') or geo.get('country_code', '')
                    click['city'] = click.get('city') or geo.get('city', '')
                    click['region'] = click.get('region') or geo.get('region', '')
                    click['isp'] = click.get('isp') or geo.get('isp', '')
                    click['asn'] = click.get('asn') or geo.get('asn', '')
                    click['organization'] = click.get('organization') or geo.get('organization', '')
                
                # Flatten device fields
                if isinstance(device, dict) and device:
                    click['device_type'] = click.get('device_type') or device.get('type', '')
                    click['browser'] = click.get('browser') or device.get('browser', '')
                    click['os'] = click.get('os') or device.get('os', '')
                
                # Flatten fraud indicators
                if isinstance(fraud, dict) and fraud:
                    click['vpn_detected'] = fraud.get('vpn_detected', False)
                    click['proxy_detected'] = fraud.get('proxy_detected', False)
                    click['tor_detected'] = fraud.get('tor_detected', False)
                    click['duplicate_click'] = fraud.get('duplicate_click', False)
                    click['fraud_score'] = fraud.get('fraud_score', 0)
                    click['fraud_status'] = fraud.get('fraud_status', '')
                
                # Flatten offer nested data
                if isinstance(offer_nested, dict) and offer_nested:
                    click['category'] = click.get('category') or offer_nested.get('category', '')
                    if not isinstance(click.get('network'), str) or not click.get('network'):
                        click['network'] = offer_nested.get('network', '')
                    click['payout'] = click.get('payout') or offer_nested.get('payout', 0)
                
                # Flatten user_agent from fingerprint
                if isinstance(fingerprint, dict) and fingerprint:
                    click['user_agent'] = click.get('user_agent') or fingerprint.get('user_agent', '')
                
                # Ensure all potentially-object fields are strings
                for field in ['ip_address', 'country', 'city', 'region', 'device_type', 'browser', 'os', 'network', 'category']:
                    if isinstance(click.get(field), dict):
                        click[field] = ''

            ts = click.get('picked_at') or click.get('timestamp') or click.get('click_time')
            # Convert UTC to IST (UTC+5:30)
            if ts:
                if hasattr(ts, 'strftime'):
                    ist_ts = ts + timedelta(hours=5, minutes=30)
                    click['time'] = ist_ts.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    click['time'] = str(ts)
            else:
                click['time'] = ''

            # Enrich with offer data
            offer_data = offers_map.get(click.get('offer_id'), {})
            if not click.get('offer_name'):
                click['offer_name'] = offer_data.get('name', '')
            click['network'] = click.get('network') or offer_data.get('network', '')
            click['category'] = click.get('category') or offer_data.get('category') or offer_data.get('vertical', '')
            click['payout'] = click.get('payout') or offer_data.get('payout', 0)
            click['revenue'] = click.get('revenue') or offer_data.get('revenue') or click['payout']
            click['currency'] = click.get('currency') or offer_data.get('currency', 'USD')
            click['offer_postback_url'] = offer_data.get('postback_url', '')
            click['target_url'] = offer_data.get('target_url', '')
            click['advertiser_name'] = offer_data.get('advertiser_name') or offer_data.get('network', '')

            # Enrich with publisher data
            if source_filter == 'offerwall':
                pub_key = click.get('publisher_id', '')
                pub_data = users_map.get(pub_key, {})
                # Fallback: resolve from placement_id if publisher_id lookup failed
                if not pub_data and click.get('placement_id'):
                    plc_id_ow = click.get('placement_id', '')
                    if plc_id_ow in placement_publisher_map:
                        pub_data = placement_publisher_map[plc_id_ow]
                        pub_key = pub_data.get('_pub_id', pub_key)
                click['publisher_name'] = pub_data.get('username') or pub_data.get('name') or pub_key
                click['publisher_id'] = pub_data.get('_pub_id', '') or pub_key
                click['publisher_email'] = pub_data.get('email', '')
                click['publisher_role'] = pub_data.get('role', 'partner')
                click['pub_postback_url'] = pub_data.get('postback_url', '')
                # user_id stays as-is (end user)
                click['end_user_id'] = click.get('user_id', '')
            else:
                # Try resolving publisher from placement_id first (most reliable)
                pub_data = {}
                pub_id_resolved = ''
                plc_id = click.get('placement_id', '')
                if plc_id and plc_id in placement_publisher_map:
                    pub_data = placement_publisher_map[plc_id]
                    pub_id_resolved = pub_data.get('_pub_id', '')
                # Fallback: try user_id as username/ObjectId
                if not pub_data:
                    pub_data = users_map.get(click.get('user_id'), {})
                    if pub_data:
                        pub_id_resolved = str(pub_data.get('_id', ''))
                # Fallback: try affiliate_id
                if not pub_data and click.get('affiliate_id'):
                    pub_data = users_map.get(click.get('affiliate_id'), {})
                    if pub_data:
                        pub_id_resolved = str(pub_data.get('_id', ''))

                click['publisher_name'] = pub_data.get('username') or pub_data.get('name') or ''
                click['publisher_id'] = pub_id_resolved
                click['publisher_email'] = pub_data.get('email', '')
                click['publisher_role'] = pub_data.get('role', 'partner')
                click['pub_postback_url'] = pub_data.get('postback_url', '')
                click['end_user_id'] = click.get('user_id', '')

            # Compute margin
            payout = float(click.get('payout') or 0)
            revenue = float(click.get('revenue') or payout)
            click['margin'] = round(revenue - payout, 2)

            # Conversion enrichment for offerwall
            if source_filter == 'offerwall':
                conv_data = conversions_map.get(click.get('click_id', ''), {})
                if conv_data:
                    # Override status if conversion exists
                    conv_status = conv_data.get('status', '')
                    if conv_data.get('reversed_at'):
                        click['status'] = 'reversed'
                    elif conv_status in ('completed', 'approved', 'credited'):
                        click['status'] = 'completed'
                    elif conv_status == 'pending':
                        click['status'] = 'pending'
                    click['adv_postback_status'] = 'received'
                    click['pub_postback_status'] = conv_data.get('forward_status', '')
                else:
                    click['adv_postback_status'] = ''
                    click['pub_postback_status'] = ''
                # Ensure status field exists
                if not click.get('status'):
                    click['status'] = 'clicked'
            else:
                click['postback_url'] = click.get('pub_postback_url') or click.get('offer_postback_url', '')

            # Ensure OS field exists
            if not click.get('os'):
                ua = (click.get('user_agent') or '').lower()
                if 'windows' in ua: click['os'] = 'Windows'
                elif 'mac' in ua: click['os'] = 'macOS'
                elif 'linux' in ua: click['os'] = 'Linux'
                elif 'android' in ua: click['os'] = 'Android'
                elif 'iphone' in ua or 'ipad' in ua: click['os'] = 'iOS'
                else: click['os'] = 'Unknown'

            # Re-enrich geo data if still Unknown and IP is available
            ip = click.get('ip_address', '')
            if ip and click.get('country') in ('Unknown', '', None) and not ip.startswith('127.') and not ip.startswith('192.168.') and not ip.startswith('10.'):
                try:
                    from services.ipinfo_service import get_ipinfo_service
                    ipinfo_svc = get_ipinfo_service()
                    ip_data = ipinfo_svc.lookup_ip(ip)
                    if ip_data and ip_data.get('country', 'Unknown') != 'Unknown':
                        click['country'] = ip_data.get('country', 'Unknown')
                        click['country_code'] = ip_data.get('country_code', '')
                        click['city'] = ip_data.get('city', 'Unknown')
                        click['region'] = ip_data.get('region', 'Unknown')
                        try:
                            clicks_collection.update_one(
                                {'_id': ObjectId(click['_id'])},
                                {'$set': {'country': click['country'], 'country_code': click.get('country_code', ''), 'city': click['city'], 'region': click['region']}}
                            )
                        except Exception:
                            pass
                except Exception:
                    pass

            # Timing fields
            click['when_clicked'] = click['time']
            when_closed = click.get('when_closed')
            if when_closed:
                if hasattr(when_closed, 'strftime'):
                    ist_closed = when_closed + timedelta(hours=5, minutes=30)
                    click['when_closed'] = ist_closed.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    click['when_closed'] = str(when_closed)
            else:
                click['when_closed'] = ''
            time_spent_sec = click.get('time_spent_seconds')
            if time_spent_sec is not None and time_spent_sec > 0:
                mins = int(time_spent_sec) // 60
                secs = int(time_spent_sec) % 60
                click['time_spent'] = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
            elif click.get('beacon_received'):
                click['time_spent'] = 'Opened'
            else:
                click['time_spent'] = ''

            # Integrity fields
            click['is_vpn'] = click.get('vpn_detected', False) or click.get('proxy_detected', False) or click.get('is_vpn', False)
            click['is_duplicate'] = click.get('duplicate_click', False) or click.get('is_duplicate', False) or (not click.get('is_unique', True))
            click['geo_match'] = click.get('geo_match', True)  # Default true unless flagged
            click['fraud_score'] = click.get('fraud_score', 0)

        return jsonify({
            'success': True,
            'clicks': clicks,
            'status_counts': status_counts if source_filter == 'offerwall' else {},
            'pagination': {
                'page': page, 'per_page': per_page,
                'total': total, 'pages': (total + per_page - 1) // per_page
            }
        }), 200

    except Exception as e:
        logger.error(f"Error in admin_clicks_report: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_reports_bp.route('/api/admin/reports/chart', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_chart_data():
    """Chart data endpoint for time-series graphs"""
    try:
        user = request.current_user
        user_id = str(user['_id'])

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        metric = request.args.get('metric', 'clicks')
        granularity = request.args.get('granularity', 'day')

        if not start_date_str or not end_date_str:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
        else:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                if len(start_date_str) == 10:
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                if len(end_date_str) == 10:
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format'}), 400

        filters = {}
        if request.args.get('offer_id'):
            filters['offer_id'] = request.args.get('offer_id')

        date_range = {'start': start_date, 'end': end_date}
        # Secure sensitive platform margin data in admin views
        if user.get('role') == 'subadmin' and metric in ('profit', 'roi'):
            return jsonify({'success': True, 'chart_data': []}), 200

        result = user_reports_model.get_chart_data(
            user_id=user_id,
            date_range=date_range,
            metric=metric,
            granularity=granularity,
            filters=filters
        )

        if 'error' in result:
            return jsonify({'error': result['error']}), 500

        return jsonify({'success': True, 'chart_data': result.get('chart_data', [])}), 200

    except Exception as e:
        logger.error(f"Error in admin_chart_data: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_reports_bp.route('/api/admin/reports/filters', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_report_filters():
    """Get available filter options (publishers, offers, countries)"""
    try:
        users_collection = db_instance.get_collection('users')
        offers_collection = db_instance.get_collection('offers')
        clicks_collection = db_instance.get_collection('clicks')

        # Get publishers (all registered users)
        publishers = []
        if users_collection is not None:
            pub_query = {}
            search = request.args.get('search', '').strip()
            if search:
                pub_query['$or'] = [
                    {'username': {'$regex': search, '$options': 'i'}},
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}}
                ]
            pub_cursor = users_collection.find(
                pub_query,
                {'_id': 1, 'username': 1, 'name': 1, 'email': 1, 'role': 1}
            ).sort('name', 1).limit(1000)
            publishers = [{'id': str(p['_id']), 'name': p.get('name', p.get('username', 'Unknown')), 'username': p.get('username', ''), 'email': p.get('email', ''), 'role': p.get('role', '')} for p in pub_cursor]

        # Get offers
        offers = []
        if offers_collection is not None:
            offer_cursor = offers_collection.find(
                {'status': {'$in': ['active', 'hidden']}},
                {'offer_id': 1, 'name': 1}
            ).sort('name', 1).limit(500)
            offers = [{'id': o.get('offer_id', ''), 'name': o.get('name', 'Unknown')} for o in offer_cursor]

        # Get distinct countries from clicks
        countries = []
        regions = []
        cities = []
        if clicks_collection is not None:
            try:
                countries = clicks_collection.distinct('country')
                countries = sorted([c for c in countries if c and c != 'Unknown'])
            except Exception:
                pass
            try:
                regions = clicks_collection.distinct('region')
                regions = sorted([r for r in regions if r and r != 'Unknown' and r != ''])
            except Exception:
                pass
            try:
                cities = clicks_collection.distinct('city')
                cities = sorted([c for c in cities if c and c != 'Unknown' and c != ''])
            except Exception:
                pass

        # Also pull from offerwall_clicks_detailed for offerwall geo data
        offerwall_clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        if offerwall_clicks_col is not None:
            try:
                ow_countries = offerwall_clicks_col.distinct('geo.country')
                for c in ow_countries:
                    if c and c != 'Unknown' and c not in countries:
                        countries.append(c)
                countries = sorted(set(countries))
            except Exception:
                pass

        # Also pull from dashboard_clicks for richer geo data
        dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
        if dashboard_clicks_col is not None:
            try:
                dc_countries = dashboard_clicks_col.distinct('geo.country')
                for c in dc_countries:
                    if c and c != 'Unknown' and c not in countries:
                        countries.append(c)
                countries.sort()
            except Exception:
                pass
            try:
                dc_regions = dashboard_clicks_col.distinct('geo.region')
                for r in dc_regions:
                    if r and r != 'Unknown' and r != '' and r not in regions:
                        regions.append(r)
                regions.sort()
            except Exception:
                pass
            try:
                dc_cities = dashboard_clicks_col.distinct('geo.city')
                for c in dc_cities:
                    if c and c != 'Unknown' and c != '' and c not in cities:
                        cities.append(c)
                cities.sort()
            except Exception:
                pass

        # Get distinct categories and networks from offers
        categories = []
        networks = []
        if offers_collection is not None:
            try:
                categories = offers_collection.distinct('category')
                categories = sorted([c for c in categories if c and c != 'Unknown' and c != 'Uncategorized'])
            except Exception:
                pass
            try:
                networks = offers_collection.distinct('network')
                networks = sorted([n for n in networks if n and n != 'Unknown'])
            except Exception:
                pass

        return jsonify({
            'success': True,
            'publishers': publishers,
            'offers': offers,
            'countries': countries,
            'regions': regions,
            'cities': cities,
            'categories': categories,
            'networks': networks,
            'device_types': ['desktop', 'mobile', 'tablet'],
            'statuses': ['approved', 'pending', 'rejected']
        }), 200

    except Exception as e:
        logger.error(f"Error in admin_report_filters: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500



@admin_reports_bp.route('/api/admin/reports/export', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_export_report():
    """Export admin report as CSV"""
    try:
        user = request.current_user
        user_id = str(user['_id'])
        report_type = request.args.get('type', 'performance')

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Date range required for export'}), 400

        try:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400

        date_range = {'start': start_date, 'end': end_date}
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'performance':
            filters = {}
            if request.args.get('offer_id'):
                filters['offer_id'] = request.args.get('offer_id').split(',')
            group_by = request.args.get('group_by', 'date,offer_id').split(',')

            report = user_reports_model.get_performance_report(
                user_id=user_id,
                date_range=date_range,
                filters=filters,
                group_by=group_by,
                pagination={'page': 1, 'per_page': 5000}
            )
            if 'error' in report:
                return jsonify({'error': report['error']}), 500

            headers = ['Date', 'Publisher', 'Publisher Email', 'Role', 'Publisher ID',
                       'Offer ID', 'Offer Name', 'Network', 'Category', 'Promo Code',
                       'Click ID', 'Source/Referrer', 'Country', 'City', 'Region',
                       'Browser', 'Device', 'OS', 'IP Address',
                       'Clicks', 'Unique Clicks', 'Suspicious', 'Conversions',
                       'Approved', 'Payout', 'Revenue', 'Profit', 'CR%', 'EPC', 'Currency']
            writer.writerow(headers)
            is_subadmin = user.get('role') == 'subadmin'
            for row in report['data']:
                revenue = row.get('total_payout', 0) if is_subadmin else row.get('total_revenue', 0)
                profit = 0.0 if is_subadmin else row.get('profit', 0)
                writer.writerow([
                    row.get('date', ''), row.get('publisher_name', ''), row.get('publisher_email', ''),
                    row.get('publisher_role', ''), row.get('publisher_id', row.get('user_id', '')),
                    row.get('offer_id', ''), row.get('offer_name', ''),
                    row.get('network', ''), row.get('category', ''), row.get('promo_code', ''),
                    row.get('click_id', ''), row.get('referer', ''),
                    row.get('country', ''), row.get('city', ''), row.get('region', ''),
                    row.get('browser', ''), row.get('device_type', ''), row.get('os', ''),
                    row.get('ip_address', ''),
                    row.get('clicks', 0), row.get('unique_clicks', 0),
                    row.get('suspicious_clicks', 0), row.get('conversions', 0),
                    row.get('approved_conversions', 0), row.get('total_payout', 0),
                    revenue, profit,
                    row.get('cr', 0), row.get('epc', 0), row.get('currency', 'USD')
                ])
        else:
            report = user_reports_model.get_conversion_report(
                user_id=user_id,
                date_range=date_range,
                pagination={'page': 1, 'per_page': 5000}
            )
            if 'error' in report:
                return jsonify({'error': report['error']}), 500

            headers = ['Time', 'Click Time', 'Publisher', 'Publisher Email', 'Role',
                       'Username', 'Offer', 'Offer ID', 'Click ID', 'Conversion ID',
                       'Source', 'Payout', 'Revenue', 'Profit', 'Currency',
                       'Status', 'Country', 'City', 'Region', 'Postal Code',
                       'Device', 'Browser', 'OS', 'IP Address',
                       'ASN', 'ISP', 'Organization',
                       'Fraud Status', 'Fraud Score', 'VPN', 'Proxy', 'Tor',
                       'Placement', 'Referrer', 'Forward Status',
                       'Sub ID 1', 'Sub ID 2', 'Sub ID 3']
            writer.writerow(headers)
            is_subadmin = user.get('role') == 'subadmin'
            for conv in report['conversions']:
                revenue = conv.get('points', 0) if is_subadmin else conv.get('revenue', 0)
                profit = 0.0 if is_subadmin else conv.get('profit', 0)
                writer.writerow([
                    conv.get('time', ''), conv.get('click_time', ''),
                    conv.get('publisher_name', ''), conv.get('user_email', ''),
                    conv.get('user_role', ''), conv.get('username', ''),
                    conv.get('offer_name', ''), conv.get('offer_id', ''),
                    conv.get('click_id', ''), conv.get('_id', ''),
                    conv.get('click_source', ''),
                    conv.get('points', 0), revenue, profit,
                    conv.get('currency', 'USD'), conv.get('status', ''),
                    conv.get('country', ''), conv.get('city', ''), conv.get('region', ''),
                    conv.get('postal_code', ''),
                    conv.get('device_type', ''), conv.get('browser', ''), conv.get('os', ''),
                    conv.get('ip_address', ''),
                    conv.get('asn', ''), conv.get('isp', ''), conv.get('organization', ''),
                    conv.get('fraud_status', ''), conv.get('fraud_score', ''),
                    conv.get('vpn_detected', ''), conv.get('proxy_detected', ''),
                    conv.get('tor_detected', ''),
                    conv.get('placement_title', ''), conv.get('referer', ''),
                    conv.get('forward_status', ''),
                    conv.get('sub_id1', ''), conv.get('sub_id2', ''), conv.get('sub_id3', '')
                ])

        output.seek(0)
        return output.getvalue(), 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename=admin_{report_type}_report_{start_date.strftime("%Y%m%d")}.csv'
        }

    except Exception as e:
        logger.error(f"Error in admin_export_report: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_reports_bp.route('/api/admin/users/bulk-stats', methods=['POST'])
@token_required
def get_bulk_user_stats():
    """Fetch stats for multiple users in one call - MUCH faster than individual calls"""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        user_ids = data.get('user_ids', [])
        
        if not user_ids:
            return jsonify({'error': 'No user_ids provided'}), 400
        
        logger.info(f"[BULK_STATS] Fetching stats for {len(user_ids)} users")
        
        users_col = db_instance.get_collection('users')
        offer_requests = db_instance.get_collection('affiliate_requests')
        clicks_col = db_instance.get_collection('clicks')
        dashboard_col = db_instance.get_collection('dashboard_clicks')
        offerwall_col = db_instance.get_collection('offerwall_clicks')
        offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        offers_col = db_instance.get_collection('offers')
        
        # Convert user_ids to ObjectIds
        valid_oids = []
        for uid in user_ids:
            if ObjectId.is_valid(uid):
                valid_oids.append(ObjectId(uid))
        
        # Batch fetch all users
        users_map = {}
        for u in users_col.find({'_id': {'$in': valid_oids}}, {'_id': 1, 'username': 1, 'email': 1}):
            users_map[str(u['_id'])] = {'username': u.get('username'), 'email': u.get('email')}
        
        # Batch fetch all offer requests - need to check user_id field (can be ObjectId or string)
        requests_by_user = {}
        approved_by_user = {}  # Track approved offers separately
        # Query by user_id (ObjectId)
        logger.info(f"[BULK_STATS] Querying affiliate_requests for {len(valid_oids)} users")
        request_count = 0
        approved_count = 0
        # Try both ObjectId and string user_id
        for req in offer_requests.find({'$or': [{'user_id': {'$in': valid_oids}}, {'user_id': {'$in': user_ids}}]}, {'user_id': 1, 'status': 1}):
            uid = str(req.get('user_id'))
            requests_by_user[uid] = requests_by_user.get(uid, 0) + 1
            request_count += 1
            
            # Count approved separately
            if req.get('status') == 'approved':
                approved_by_user[uid] = approved_by_user.get(uid, 0) + 1
                approved_count += 1
        
        logger.info(f"[BULK_STATS] Found {request_count} total requests ({approved_count} approved) for {len(requests_by_user)} users")
        logger.info(f"[BULK_STATS] Sample requests_by_user: {dict(list(requests_by_user.items())[:5])}")
        logger.info(f"[BULK_STATS] Sample approved_by_user: {dict(list(approved_by_user.items())[:5])}")
        
        # Fetch conversions from forwarded_postbacks
        conversions_col = db_instance.get_collection('forwarded_postbacks')
        conversions_by_user = {}
        if conversions_col is not None:
            logger.info(f"[BULK_STATS] Querying conversions for {len(user_ids)} users")
            for conv in conversions_col.find({'publisher_id': {'$in': user_ids}}, {'publisher_id': 1}):
                uid = conv.get('publisher_id')
                if uid:
                    conversions_by_user[uid] = conversions_by_user.get(uid, 0) + 1
            logger.info(f"[BULK_STATS] Found conversions for {len(conversions_by_user)} users")
        
        # Batch fetch all clicks from all collections
        clicks_by_user = {}
        geo_by_user = {}
        vertical_by_user = {}  # Track offer categories/verticals per user
        time_by_user = {}
        offer_ids_by_user = {}  # Track which offers each user clicked
        
        # Helper to process clicks
        def process_click(user_id, country_code, offer_id, time_spent):
            if user_id not in clicks_by_user:
                clicks_by_user[user_id] = 0
                geo_by_user[user_id] = {}
                vertical_by_user[user_id] = {}
                time_by_user[user_id] = 0
                offer_ids_by_user[user_id] = set()
            
            clicks_by_user[user_id] += 1
            
            if country_code:
                geo_by_user[user_id][country_code] = geo_by_user[user_id].get(country_code, 0) + 1
            
            if offer_id:
                offer_ids_by_user[user_id].add(offer_id)
            
            if time_spent and time_spent > 0:
                time_by_user[user_id] += float(time_spent)
        
        # Query all click collections - CHECK ALL POSSIBLE TIME FIELD NAMES
        for c in clicks_col.find({'$or': [{'user_id': {'$in': user_ids}}, {'affiliate_id': {'$in': user_ids}}]}, 
                                  {'user_id': 1, 'affiliate_id': 1, 'country_code': 1, 'country': 1, 'offer_id': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
            uid = c.get('user_id') or c.get('affiliate_id')
            cc = c.get('country_code') or c.get('country') or 'Unknown'
            # Check multiple possible time field names
            time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
            process_click(uid, cc, c.get('offer_id'), time_spent)
        
        for c in dashboard_col.find({'user_id': {'$in': user_ids}}, 
                                     {'user_id': 1, 'geo': 1, 'offer_id': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
            uid = c.get('user_id')
            geo = c.get('geo', {})
            cc = geo.get('country_code') or geo.get('country') or 'Unknown'
            # Check multiple possible time field names
            time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
            process_click(uid, cc, c.get('offer_id'), time_spent)
        
        for c in offerwall_col.find({'publisher_id': {'$in': user_ids}}, 
                                     {'publisher_id': 1, 'country_code': 1, 'country': 1, 'offer_id': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
            uid = c.get('publisher_id')
            cc = c.get('country_code') or c.get('country') or 'Unknown'
            # Check multiple possible time field names
            time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
            process_click(uid, cc, c.get('offer_id'), time_spent)
        
        for c in offerwall_detailed_col.find({'user_id': {'$in': user_ids}}, 
                                              {'user_id': 1, 'geo': 1, 'offer_id': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
            uid = c.get('user_id')
            geo = c.get('geo', {})
            cc = geo.get('country_code') or geo.get('country') or 'Unknown'
            # Check multiple possible time field names
            time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
            process_click(uid, cc, c.get('offer_id'), time_spent)
        
        # Build response
        results = {}
        
        # Batch load offer data for all clicked offers to get categories
        all_offer_ids = set()
        for user_id in user_ids:
            if user_id in offer_ids_by_user:
                all_offer_ids.update(offer_ids_by_user[user_id])
        
        # Fetch all offers in one query
        offers_cache = {}
        if all_offer_ids and offers_col is not None:
            for offer in offers_col.find({'offer_id': {'$in': list(all_offer_ids)}}, {'offer_id': 1, 'category': 1, 'vertical': 1}):
                offers_cache[offer['offer_id']] = offer
        
        for user_id in user_ids:
            total_clicks = clicks_by_user.get(user_id, 0)
            total_time = time_by_user.get(user_id, 0)
            
            # Calculate top vertical from clicked offers
            top_vertical = 'N/A'
            if user_id in offer_ids_by_user:
                category_counts = {}
                for offer_id in offer_ids_by_user[user_id]:
                    offer = offers_cache.get(offer_id)
                    if offer:
                        category = offer.get('category') or offer.get('vertical', 'Uncategorized')
                        if category and category not in ('N/A', 'Uncategorized', ''):
                            category_counts[category] = category_counts.get(category, 0) + 1
                
                if category_counts:
                    # Get the most common category
                    top_vertical = max(category_counts.items(), key=lambda x: x[1])[0]
            
            # Format time
            time_formatted = 'No data'
            if total_time > 0:
                hours = int(total_time) // 3600
                mins = (int(total_time) % 3600) // 60
                secs = int(total_time) % 60
                if hours > 0:
                    time_formatted = f"{hours}h {mins}m {secs}s"
                elif mins > 0:
                    time_formatted = f"{mins}m {secs}s"
                else:
                    time_formatted = f"{secs}s"
            
            # Top geo
            top_geos = []
            if user_id in geo_by_user:
                sorted_geos = sorted(geo_by_user[user_id].items(), key=lambda x: x[1], reverse=True)[:1]
                for country, count in sorted_geos:
                    if country != 'Unknown' and country != '':
                        top_geos.append({'country': country, 'count': count})
            
            results[user_id] = {
                'total_clicks': total_clicks,
                'offers_requested': requests_by_user.get(user_id, 0),
                'approved_count': approved_by_user.get(user_id, 0),  # Now includes approved count!
                'conversions': conversions_by_user.get(user_id, 0),  # Now includes actual conversions!
                'top_geos': top_geos,
                'avg_time_spent': time_formatted,
                'total_time_spent_seconds': total_time,
                'top_vertical': top_vertical,  # Now calculated from actual clicked offers!
                'offers_viewed': 0,
                'logins_7d': 0,
                'suspicious': False
            }
        
        logger.info(f"[BULK_STATS] Completed stats for {len(results)} users")
        return jsonify({'success': True, 'stats': results}), 200
        
    except Exception as e:
        logger.error(f"Error in bulk stats: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_reports_bp.route('/api/admin/users/<publisher_id>/profile-stats', methods=['GET'])
@token_required
def get_user_profile_stats(publisher_id):
    """Fetch real specific analytics and geo data for the publisher accordion"""
    user = request.current_user
    if user.get('role') not in ('admin', 'subadmin'):
         return jsonify({'error': 'Admin access required'}), 403
         
    try:
        users_col = db_instance.get_collection('users')
        if not ObjectId.is_valid(publisher_id):
            pub_user = users_col.find_one({'username': publisher_id})
            if pub_user: publisher_id = str(pub_user['_id'])
            
        pub_user = users_col.find_one({'_id': ObjectId(publisher_id)})
        if not pub_user:
             return jsonify({'error': 'User not found'}), 404
             
        username = pub_user.get('username', '')
        email = pub_user.get('email', '')
        
        logger.info(f"[PROFILE_STATS] Fetching stats for user_id={publisher_id}, username={username}, email={email}")
        
        # 1. Logins (last 7 days)
        login_logs = db_instance.get_collection('login_logs')
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        login_ids = set()
        for field, val in [('user_id', publisher_id), ('email', email), ('username', username)]:
            if val:
                for doc in login_logs.find({field: val, 'status': 'success', 'login_time': {'$gte': seven_days_ago}}, {'_id': 1}):
                    login_ids.add(str(doc['_id']))
        logins = len(login_ids)
        
        # 2. Offers Requested/Approved
        offer_requests = db_instance.get_collection('affiliate_requests')
        req_ids = set()
        for field, val in [('publisher_id', publisher_id), ('username', username)]:
            if val:
                for doc in offer_requests.find({field: val}, {'_id': 1}):
                    req_ids.add(str(doc['_id']))
        offers_req = len(req_ids)
        
        # 3. Total Clicks & GEOs
        clicks_col = db_instance.get_collection('clicks')
        dashboard_col = db_instance.get_collection('dashboard_clicks')
        offerwall_col = db_instance.get_collection('offerwall_clicks')
        offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        
        total_clicks = 0
        unique_offers = set()
        offer_view_counts = {}  # Track view count per offer
        geo_counts = {}
        referrer_counts = {}
        seen_click_ids = set()
        total_time_spent = 0  # Track total time spent in seconds
        clicks_with_time = 0  # Count clicks that have time data
        
        # Query clicks collection
        if clicks_col is not None:
            query = {'$or': [{'user_id': publisher_id}, {'affiliate_id': publisher_id}]}
            if username: query['$or'].append({'username': username})
            for c in clicks_col.find(query, {'offer_id': 1, 'country': 1, 'country_code': 1, 'referer': 1, 'referrer': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
                c_id = str(c['_id'])
                if c_id in seen_click_ids: continue
                seen_click_ids.add(c_id)
                
                total_clicks += 1
                offer_id = c.get('offer_id')
                if offer_id:
                    unique_offers.add(offer_id)
                    offer_view_counts[offer_id] = offer_view_counts.get(offer_id, 0) + 1
                
                # Track time spent - check ALL possible field names
                time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
                if time_spent and time_spent > 0:
                    total_time_spent += float(time_spent)
                    clicks_with_time += 1
                
                # Count geos
                cc = c.get('country_code') or c.get('country') or 'Unknown'
                if isinstance(cc, str) and len(cc) == 2: cc = cc.upper()
                geo_counts[cc] = geo_counts.get(cc, 0) + 1
                
                # Count referrers
                ref = c.get('referer') or c.get('referrer') or ''
                if ref and 'http' in ref:
                    try:
                        from urllib.parse import urlparse
                        domain = urlparse(ref).netloc.replace('www.', '')
                        if domain:
                            referrer_counts[domain] = referrer_counts.get(domain, 0) + 1
                    except: pass
        
        # Query dashboard_clicks
        if dashboard_col is not None:
            query = {'$or': [{'user_id': publisher_id}]}
            if email: query['$or'].append({'user_email': email})
            if username: query['$or'].append({'username': username})
            for c in dashboard_col.find(query, {'offer_id': 1, 'geo': 1, 'referrer': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
                c_id = str(c['_id'])
                if c_id in seen_click_ids: continue
                seen_click_ids.add(c_id)
                
                total_clicks += 1
                offer_id = c.get('offer_id')
                if offer_id:
                    unique_offers.add(offer_id)
                    offer_view_counts[offer_id] = offer_view_counts.get(offer_id, 0) + 1
                
                # Track time spent - check ALL possible field names
                time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
                if time_spent and time_spent > 0:
                    total_time_spent += float(time_spent)
                    clicks_with_time += 1
                
                geo_obj = c.get('geo', {})
                cc = geo_obj.get('country_code') or geo_obj.get('country') or 'Unknown'
                if isinstance(cc, str) and len(cc) == 2: cc = cc.upper()
                geo_counts[cc] = geo_counts.get(cc, 0) + 1
                
                ref = c.get('referrer') or ''
                if ref and 'http' in ref:
                    try:
                        from urllib.parse import urlparse
                        domain = urlparse(ref).netloc.replace('www.', '')
                        if domain:
                            referrer_counts[domain] = referrer_counts.get(domain, 0) + 1
                    except: pass
        
        # Query offerwall_clicks
        if offerwall_col is not None:
            query = {'$or': [{'publisher_id': publisher_id}]}
            if username: query['$or'].append({'username': username})
            for c in offerwall_col.find(query, {'offer_id': 1, 'country': 1, 'country_code': 1, 'referrer': 1, 'data': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
                c_id = str(c['_id'])
                if c_id in seen_click_ids: continue
                seen_click_ids.add(c_id)
                
                total_clicks += 1
                offer_id = c.get('offer_id')
                if offer_id:
                    unique_offers.add(offer_id)
                    offer_view_counts[offer_id] = offer_view_counts.get(offer_id, 0) + 1
                
                # Track time spent - check ALL possible field names
                time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
                if time_spent and time_spent > 0:
                    total_time_spent += float(time_spent)
                    clicks_with_time += 1
                
                cc = c.get('country_code') or c.get('country') or 'Unknown'
                if isinstance(cc, str) and len(cc) == 2: cc = cc.upper()
                geo_counts[cc] = geo_counts.get(cc, 0) + 1
                
                ref = c.get('referrer') or ''
                if not ref and 'data' in c: ref = c['data'].get('referrer') or ''
                if ref and 'http' in ref:
                    try:
                        from urllib.parse import urlparse
                        domain = urlparse(ref).netloc.replace('www.', '')
                        if domain:
                            referrer_counts[domain] = referrer_counts.get(domain, 0) + 1
                    except: pass
        
        # Query offerwall_clicks_detailed
        if offerwall_detailed_col is not None:
            query = {'$or': [{'user_id': publisher_id}]}
            if username: query['$or'].append({'publisher_name': username})
            for c in offerwall_detailed_col.find(query, {'offer_id': 1, 'geo': 1, 'time_spent_seconds': 1, 'time_spent': 1, 'duration': 1, 'time_on_page': 1}):
                c_id = str(c['_id'])
                if c_id in seen_click_ids: continue
                seen_click_ids.add(c_id)
                
                total_clicks += 1
                offer_id = c.get('offer_id')
                if offer_id:
                    unique_offers.add(offer_id)
                    offer_view_counts[offer_id] = offer_view_counts.get(offer_id, 0) + 1
                
                # Track time spent - check ALL possible field names
                time_spent = c.get('time_spent_seconds') or c.get('time_spent') or c.get('duration') or c.get('time_on_page') or 0
                if time_spent and time_spent > 0:
                    total_time_spent += float(time_spent)
                    clicks_with_time += 1
                
                geo_obj = c.get('geo', {})
                cc = geo_obj.get('country_code') or geo_obj.get('country') or 'Unknown'
                if isinstance(cc, str) and len(cc) == 2: cc = cc.upper()
                geo_counts[cc] = geo_counts.get(cc, 0) + 1
            
        # Format GEOs for frontend progress bars
        top_geos = []
        sorted_geos = sorted(geo_counts.items(), key=lambda x: x[1], reverse=True)[:4]
        for country, count in sorted_geos:
             pct = int((count / total_clicks) * 100) if total_clicks > 0 else 0
             if country != 'Unknown' and country != '':
                 top_geos.append({'country': country, 'percentage': pct, 'count': count})
                 
                 
        offers_viewed = len(unique_offers)
        
        # Calculate total time spent (not average)
        total_time_formatted = 'No data'
        if total_time_spent > 0:
            # Format total time as hours, minutes, and seconds
            hours = int(total_time_spent) // 3600
            mins = (int(total_time_spent) % 3600) // 60
            secs = int(total_time_spent) % 60
            
            if hours > 0:
                total_time_formatted = f"{hours}h {mins}m {secs}s"
            elif mins > 0:
                total_time_formatted = f"{mins}m {secs}s"
            else:
                total_time_formatted = f"{secs}s"
        
        # Get top 10 viewed offers and calculate top vertical
        top_viewed_offers = []
        top_vertical = 'N/A'
        category_counts = {}
        offers_col = db_instance.get_collection('offers')
        if offers_col is not None:
            sorted_offer_views = sorted(offer_view_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            for offer_id, view_count in sorted_offer_views:
                offer = offers_col.find_one({'offer_id': offer_id})
                if offer:
                    top_viewed_offers.append({
                        'id': offer_id,
                        'name': offer.get('name', 'Unknown'),
                        'category': offer.get('category', 'N/A'),
                        'views': view_count
                    })
                    # Count categories for top vertical
                    category = offer.get('category') or offer.get('vertical', 'Uncategorized')
                    if category and category != 'N/A':
                        category_counts[category] = category_counts.get(category, 0) + view_count
            
            # Determine top vertical from all clicked offers (not just top 10)
            if not category_counts and offer_view_counts:
                # If no categories from top 10, check all offers
                for offer_id in offer_view_counts.keys():
                    offer = offers_col.find_one({'offer_id': offer_id})
                    if offer:
                        category = offer.get('category') or offer.get('vertical', 'Uncategorized')
                        if category and category != 'N/A':
                            category_counts[category] = category_counts.get(category, 0) + offer_view_counts[offer_id]
            
            # Get the most common category
            if category_counts:
                top_vertical = max(category_counts.items(), key=lambda x: x[1])[0]
        
        # Log all calculated values
        logger.info(f"[PROFILE_STATS] Total clicks: {total_clicks}, Clicks with time: {clicks_with_time}, Total time: {total_time_spent}s, Formatted: {total_time_formatted}")
        logger.info(f"[PROFILE_STATS] Geo counts: {geo_counts}")
        logger.info(f"[PROFILE_STATS] Category counts: {category_counts}")
        logger.info(f"[PROFILE_STATS] Top geos: {top_geos}")
        logger.info(f"[PROFILE_STATS] Top vertical: {top_vertical}")
        logger.info(f"[PROFILE_STATS] Top viewed offers: {len(top_viewed_offers)} offers")
            
        # Format Traffic Sources
        traffic_sources = []
        if referrer_counts:
            sorted_refs = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            traffic_sources = [{'name': ref, 'count': count} for ref, count in sorted_refs]
            
        # Format Recommended Offers
        recommended_offers = []
        offers_col = db_instance.get_collection('offers')
        if offers_col is not None:
             match_query = {'status': 'active'}
             top_cc = top_geos[0]['country'] if len(top_geos) > 0 else None
             if top_cc and top_cc != 'Unknown':
                 # Prefer offers that accept this Geo or are WW
                 match_query['$or'] = [
                     {'countries': top_cc},
                     {'countries': {'$in': [top_cc, 'WW', 'GLOBAL', 'ALL']}},
                     {'geo_targeting': {'$in': [top_cc, 'WW', 'GLOBAL']}}
                 ]
                 
             # Get top 2 offers by payout
             top_offers_cursor = offers_col.find(match_query, {
                 'name': 1, 'payout': 1, 'category': 1, 'geo_targeting': 1, 'countries': 1
             }).sort('payout', -1).limit(2)
             
             for idx, o in enumerate(top_offers_cursor):
                  countries_list = o.get('countries') or o.get('geo_targeting') or []
                  if isinstance(countries_list, list): geo_str = ', '.join(countries_list[:2])
                  else: geo_str = str(countries_list)
                  
                  raw_payout = o.get('payout', 0)
                  try:
                      if isinstance(raw_payout, str):
                          clean_pay = raw_payout.replace('$', '').replace(',', '').strip()
                          pay_val = float(clean_pay) if clean_pay else 0.0
                      else:
                          pay_val = float(raw_payout)
                  except (ValueError, TypeError):
                      pay_val = 0.0
                      
                  recommended_offers.append({
                      'n': o.get('name', 'Premium Offer'),
                      'pay': f"${pay_val:.2f}",
                      'm': 98 if idx == 0 else 85,
                      't': idx == 0, # true for the first one (trending)
                      'category': o.get('category', 'Sweepstakes'),
                      'geo': geo_str or 'WW'
                  })
                  
        if not recommended_offers:
             # Fallback if no matching offers found
             recommended_offers = [
                 {'n': 'Global Sweepstakes', 'pay': '$12.50', 'm': 90, 't': True, 'category': 'Sweepstakes', 'geo': 'WW'},
                 {'n': 'Finance Lead Gen', 'pay': '$35.00', 'm': 82, 't': False, 'category': 'Finance', 'geo': 'US/UK'}
             ]

        # Fetch placement / offerwall URL for this publisher
        placements_col = db_instance.get_collection('placements')
        offerwall_url = None
        placement_info = None
        if placements_col is not None:
            placement = placements_col.find_one(
                {'publisherId': ObjectId(publisher_id), 'status': {'$in': ['LIVE', 'APPROVED']}},
                {'placementIdentifier': 1, 'apiKey': 1, 'offerwallTitle': 1, 'status': 1}
            )
            if placement:
                pid = placement.get('placementIdentifier', '')
                api_key = placement.get('apiKey', '')
                offerwall_url = f"https://offerwall.moustacheleads.com/offerwall?placement_id={pid}&api_key={api_key}&user_id={{USER_ID}}"
                placement_info = {
                    'placement_identifier': pid,
                    'api_key': api_key,
                    'offerwall_title': placement.get('offerwallTitle', ''),
                    'status': placement.get('status', ''),
                    'offerwall_url': offerwall_url
                }

        # Fetch payout method for this publisher
        payout_methods_col = db_instance.get_collection('payout_methods')
        payout_info = None
        if payout_methods_col is not None:
            payout_doc = payout_methods_col.find_one({'user_id': ObjectId(publisher_id)})
            if payout_doc:
                active_method = payout_doc.get('active_method', '')
                updated_at = payout_doc.get('updated_at', payout_doc.get('created_at', ''))
                if hasattr(updated_at, 'isoformat'):
                    updated_at = updated_at.isoformat() + 'Z'
                payout_info = {
                    'active_method': active_method,
                    'updated_at': updated_at,
                }
                if active_method == 'bank':
                    bd = payout_doc.get('bank_details', {})
                    payout_info['details'] = {
                        'bank_name': bd.get('bank_name', ''),
                        'account_name': bd.get('account_name', ''),
                        'account_number': bd.get('account_number', ''),
                        'ifsc_swift': bd.get('ifsc_swift', ''),
                        'country': bd.get('country', ''),
                        'currency': bd.get('currency', ''),
                        'upi': bd.get('upi', ''),
                    }
                elif active_method == 'paypal':
                    pd = payout_doc.get('paypal_details', {})
                    payout_info['details'] = {
                        'email': pd.get('email', ''),
                        'country': pd.get('country', ''),
                        'minimum_threshold': pd.get('minimum_threshold', 100),
                    }
                elif active_method == 'crypto':
                    cd = payout_doc.get('crypto_details', {})
                    payout_info['details'] = {
                        'currency': cd.get('currency', ''),
                        'network': cd.get('network', ''),
                        'wallet_address': cd.get('wallet_address', ''),
                        'label': cd.get('label', ''),
                    }

        return jsonify({
            'success': True,
            'stats': {
                'logins_7d': logins,
                'offers_viewed': offers_viewed,
                'offers_requested': offers_req,
                'total_clicks': total_clicks,
                'top_geos': top_geos,
                'traffic_sources': traffic_sources,
                'recommended_offers': recommended_offers,
                'top_viewed_offers': top_viewed_offers,
                'top_vertical': top_vertical,
                'avg_time_spent': total_time_formatted,  # Now shows total time, not average
                'total_time_spent_seconds': total_time_spent,
                'offerwall_url': offerwall_url,
                'placement_info': placement_info,
                'payout_info': payout_info
            }
        })
    except Exception as e:
        logger.error(f"Error getting user stats for profile: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_reports_bp.route('/api/admin/advertiser/reports', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def admin_advertiser_reports():
    """Get advertiser campaign performance reports for admin oversight"""
    try:
        db = db_instance.get_db()
        
        # Get query parameters
        date_range_str = request.args.get('range', 'last_7_days')
        breakdown = request.args.get('breakdown', 'date')
        advertiser_id = request.args.get('advertiser_id', 'all')
        
        # Parse date range
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        
        if date_range_str == 'today':
            start_date = datetime(now.year, now.month, now.day)
            end_date = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
        elif date_range_str == 'yesterday':
            yesterday = now - timedelta(days=1)
            start_date = datetime(yesterday.year, yesterday.month, yesterday.day)
            end_date = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59, 999999)
        elif date_range_str == 'last_7_days':
            start_date = now - timedelta(days=7)
            end_date = now
        elif date_range_str == 'last_30_days':
            start_date = now - timedelta(days=30)
            end_date = now
        elif date_range_str == 'this_month':
            start_date = datetime(now.year, now.month, 1)
            end_date = now
        else: # all time
            start_date = datetime(2020, 1, 1)
            end_date = now
            
        # Get advertiser offers/campaigns
        offer_filter = {'offer_source': 'advertiser'}
        if advertiser_id and advertiser_id != 'all':
            offer_filter['advertiser_id'] = advertiser_id
            
        offers = list(db.offers.find(offer_filter, {'offer_id': 1, 'name': 1, 'advertiser_id': 1, 'payout': 1}))
        offer_ids = [o.get('offer_id') for o in offers if o.get('offer_id')]
        offer_names = {o.get('offer_id'): o.get('name', 'Unknown Offer') for o in offers}
        
        # Get list of advertisers for dropdown selection
        advertisers_cursor = db.advertisers.find({}, {'_id': 1, 'company_name': 1, 'email': 1, 'first_name': 1, 'last_name': 1})
        advertisers_list = []
        for a in advertisers_cursor:
            name = a.get('company_name') or f"{a.get('first_name', '')} {a.get('last_name', '')}".strip() or a.get('email', 'Unknown')
            advertisers_list.append({
                'advertiser_id': str(a['_id']),
                'name': name
            })
            
        if not offer_ids:
            return jsonify({
                'kpis': {
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'conversions': 0,
                    'cr': 0,
                    'spend': 0,
                    'avg_cpa': 0
                },
                'breakdown': [],
                'conversions': [],
                'advertisers': advertisers_list
            }), 200

        # Query Clicks
        click_query = {
            'offer_id': {'$in': offer_ids},
            'click_time': {'$gte': start_date, '$lte': end_date}
        }
        clicks = list(db.clicks.find(click_query, {
            'click_time': 1, 'offer_id': 1, 'country': 1, 'country_code': 1, 'device_type': 1
        }))

        # Query Conversions
        conv_query = {
            'offer_id': {'$in': offer_ids},
            'conversion_time': {'$gte': start_date, '$lte': end_date}
        }
        conversions = list(db.conversions.find(conv_query, {
            'conversion_time': 1, 'offer_id': 1, 'country': 1, 'country_code': 1, 'device_type': 1,
            'payout': 1, 'conversion_id': 1, 'status': 1
        }))
        
        # Query Impressions/Views
        view_query = {
            'offer_id': {'$in': offer_ids},
            'timestamp': {'$gte': start_date, '$lte': end_date}
        }
        views = list(db.offer_views.find(view_query, {
            'timestamp': 1, 'offer_id': 1
        }))

        # Calculate KPIs
        total_impressions = len(views)
        total_clicks = len(clicks)
        total_conversions = len(conversions)
        
        # Build offer payout map for fallback when conversion payout is 0
        offer_payouts = {o.get('offer_id'): float(o.get('payout') or 0) for o in offers}
        
        total_spend = 0.0
        for c in conversions:
            try:
                conv_payout = float(c.get('payout') or 0.0)
                if conv_payout == 0:
                    conv_payout = offer_payouts.get(c.get('offer_id'), 0.0)
                total_spend += conv_payout
            except (ValueError, TypeError):
                pass
                
        ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
        cr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0.0
        avg_cpa = (total_spend / total_conversions) if total_conversions > 0 else 0.0

        kpis = {
            'impressions': total_impressions,
            'clicks': total_clicks,
            'ctr': round(ctr, 2),
            'conversions': total_conversions,
            'cr': round(cr, 2),
            'spend': round(total_spend, 2),
            'avg_cpa': round(avg_cpa, 2)
        }

        # Process breakdown
        breakdown_data = {}
        
        # Helper to get grouping key
        def get_group_key(item, date_field):
            if breakdown == 'date':
                dt = item.get(date_field)
                return dt.strftime('%Y-%m-%d') if dt else 'Unknown'
            elif breakdown == 'country':
                return item.get('country') or item.get('country_code') or 'Unknown'
            elif breakdown == 'device':
                return item.get('device_type') or 'Unknown'
            elif breakdown == 'campaign':
                return item.get('offer_id') or 'Unknown'
            return 'Unknown'

        # Count views
        for v in views:
            key = get_group_key(v, 'timestamp')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['impressions'] += 1

        # Count clicks
        for c in clicks:
            key = get_group_key(c, 'click_time')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['clicks'] += 1

        # Count conversions and spend
        for c in conversions:
            key = get_group_key(c, 'conversion_time')
            if key not in breakdown_data:
                breakdown_data[key] = {'impressions': 0, 'clicks': 0, 'conversions': 0, 'spend': 0.0}
            breakdown_data[key]['conversions'] += 1
            try:
                conv_payout = float(c.get('payout') or 0.0)
                if conv_payout == 0:
                    conv_payout = offer_payouts.get(c.get('offer_id'), 0.0)
                breakdown_data[key]['spend'] += conv_payout
            except (ValueError, TypeError):
                pass

        # Format breakdown results
        breakdown_list = []
        for key, stats in breakdown_data.items():
            b_ctr = (stats['clicks'] / stats['impressions'] * 100) if stats['impressions'] > 0 else 0.0
            b_cr = (stats['conversions'] / stats['clicks'] * 100) if stats['clicks'] > 0 else 0.0
            b_cpa = (stats['spend'] / stats['conversions']) if stats['conversions'] > 0 else 0.0
            
            row = {
                'key': key,
                'impressions': stats['impressions'],
                'clicks': stats['clicks'],
                'ctr': round(b_ctr, 2),
                'conversions': stats['conversions'],
                'cr': round(b_cr, 2),
                'spend': round(stats['spend'], 2),
                'cpa': round(b_cpa, 2)
            }
            if breakdown == 'campaign':
                row['campaign_name'] = offer_names.get(key, 'Unknown Offer')
            breakdown_list.append(row)

        # Sort breakdown
        if breakdown == 'date':
            breakdown_list.sort(key=lambda x: x['key'], reverse=True)
        else:
            breakdown_list.sort(key=lambda x: x['conversions'], reverse=True)

        # Format conversions list (Conversion log)
        conversions_list = []
        for c in conversions[:100]: # limit to 100 recent
            conversions_list.append({
                'time': c.get('conversion_time').isoformat() if c.get('conversion_time') else '',
                'conversion_id': c.get('conversion_id', ''),
                'offer_name': offer_names.get(c.get('offer_id'), 'Unknown Offer'),
                'geo': c.get('country') or c.get('country_code') or 'Unknown',
                'device': c.get('device_type') or 'unknown',
                'goal': 'Conversion',
                'payout': float(c.get('payout') or 0),
                'status': c.get('status', 'approved')
            })

        # Format click log with full details (publisher, IP, device, etc.)
        click_log_query = {
            'offer_id': {'$in': offer_ids},
            'click_time': {'$gte': start_date, '$lte': end_date}
        }
        click_log_raw = list(db.clicks.find(click_log_query).sort('click_time', -1).limit(200))
        
        # Resolve publisher names
        pub_ids = list(set(c.get('user_id') for c in click_log_raw if c.get('user_id')))
        pub_map = {}
        if pub_ids:
            users_col = db.users if db is not None else None
            if users_col is not None:
                from bson import ObjectId as _PubObjId
                for pid in pub_ids:
                    try:
                        user = users_col.find_one({'_id': _PubObjId(pid)}, {'username': 1, 'email': 1}) if _PubObjId.is_valid(pid) else None
                        if user:
                            pub_map[pid] = user.get('username') or user.get('email') or pid
                        else:
                            pub_map[pid] = pid
                    except Exception:
                        pub_map[pid] = pid
        
        clicks_list = []
        for c in click_log_raw:
            clicks_list.append({
                'click_id': c.get('click_id', ''),
                'time': c.get('click_time').isoformat() if c.get('click_time') else '',
                'offer_id': c.get('offer_id', ''),
                'offer_name': offer_names.get(c.get('offer_id'), c.get('offer_name', 'Unknown')),
                'publisher_id': c.get('user_id', ''),
                'publisher_name': pub_map.get(c.get('user_id', ''), c.get('user_id', 'Unknown')),
                'country': c.get('country') or c.get('country_code') or 'Unknown',
                'city': c.get('city', ''),
                'device': c.get('device_type') or 'unknown',
                'browser': c.get('browser', ''),
                'os': c.get('os', ''),
                'ip_address': c.get('ip_address', ''),
                'referer': c.get('referer', ''),
                'sub_id1': c.get('sub_id1', ''),
                'sub_id2': c.get('sub_id2', ''),
                'converted': c.get('converted', False),
                'fraud_score': c.get('fraud_score', 0),
            })

        return jsonify({
            'kpis': kpis,
            'breakdown': breakdown_list,
            'conversions': conversions_list,
            'clicks': clicks_list,
            'advertisers': advertisers_list
        }), 200

    except Exception as e:
        logger.error(f"Error in admin advertiser reports endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

