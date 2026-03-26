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

        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Date range cannot exceed 365 days'}), 400

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
        per_page = min(int(request.args.get('per_page', 20)), 100)
        pagination = {'page': page, 'per_page': per_page}

        sort_field = request.args.get('sort_field', 'date')
        sort_order = request.args.get('sort_order', 'desc')
        sort = {'field': sort_field, 'order': sort_order}

        # Additional filters: region, city, category, network
        region_filter = request.args.get('region')
        city_filter = request.args.get('city')
        category_filter = request.args.get('category')
        network_filter = request.args.get('network')

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

        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Date range cannot exceed 365 days'}), 400

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
            if offers_col:
                for o in offers_col.find({'offer_id': {'$in': list(conv_offer_ids)}},
                                         {'offer_id': 1, 'postback_url': 1, 'network': 1, 'category': 1}):
                    offers_cache[o['offer_id']] = o

        for conv in conversions:
            conv['publisher_name'] = conv.get('publisher_name', 'Unknown')
            conv['click_id'] = conv.get('click_id', '')
            conv['placement_title'] = conv.get('placement_title', '')
            conv['points'] = conv.get('points', 0)
            conv['conversion_id'] = conv.get('_id', '')
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
        country_filter = request.args.get('country')
        city_filter = request.args.get('city')
        region_filter = request.args.get('region')
        device_filter = request.args.get('device_type')
        category_filter = request.args.get('category')
        network_filter = request.args.get('network')

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 200)

        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is None:
            return jsonify({'error': 'Database not available'}), 503

        query = {'timestamp': {'$gte': start_date, '$lte': end_date}}
        if offer_id:
            query['offer_id'] = offer_id
        if publisher_id:
            query['user_id'] = publisher_id
        if country_filter:
            query['country'] = country_filter
        if city_filter:
            query['city'] = city_filter
        if region_filter:
            query['region'] = region_filter
        if device_filter:
            query['device_type'] = device_filter

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

        clicks = list(clicks_collection.find(query).sort('timestamp', -1).skip(skip).limit(per_page))

        # Batch-load offer data for enrichment
        offer_ids_in_page = list(set(c.get('offer_id') for c in clicks if c.get('offer_id')))
        offers_map = {}
        if offer_ids_in_page:
            offers_col = db_instance.get_collection('offers')
            if offers_col is not None:
                for o in offers_col.find({'offer_id': {'$in': offer_ids_in_page}}, {'offer_id': 1, 'name': 1, 'network': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'currency': 1, 'target_url': 1, 'postback_url': 1}):
                    offers_map[o['offer_id']] = o

        # Batch-load publisher data — try username, name, and _id lookups
        user_ids_in_page = list(set(c.get('user_id') for c in clicks if c.get('user_id')))
        users_map = {}
        if user_ids_in_page:
            users_col = db_instance.get_collection('users')
            if users_col is not None:
                # Try matching by username first
                for u in users_col.find({'username': {'$in': user_ids_in_page}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                    users_map[u['username']] = u
                # For any unmatched, try by name
                unmatched = [uid for uid in user_ids_in_page if uid not in users_map]
                if unmatched:
                    for u in users_col.find({'name': {'$in': unmatched}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                        users_map[u.get('name', '')] = u
                # For any still unmatched, try by _id (ObjectId)
                still_unmatched = [uid for uid in user_ids_in_page if uid not in users_map]
                if still_unmatched:
                    from bson import ObjectId as BsonObjectId
                    valid_oids = []
                    for uid in still_unmatched:
                        try:
                            valid_oids.append(BsonObjectId(uid))
                        except Exception:
                            pass
                    if valid_oids:
                        for u in users_col.find({'_id': {'$in': valid_oids}}, {'username': 1, 'name': 1, 'email': 1, 'role': 1, 'postback_url': 1}):
                            users_map[str(u['_id'])] = u

        for click in clicks:
            click['_id'] = str(click['_id'])
            ts = click.get('timestamp') or click.get('click_time')
            # Convert UTC to IST (UTC+5:30)
            if ts:
                ist_ts = ts + timedelta(hours=5, minutes=30)
                click['time'] = ist_ts.strftime('%Y-%m-%d %H:%M:%S')
            else:
                click['time'] = ''

            # Enrich with offer data
            offer_data = offers_map.get(click.get('offer_id'), {})
            if not click.get('offer_name'):
                click['offer_name'] = offer_data.get('name', '')
            click['network'] = offer_data.get('network', '')
            click['category'] = offer_data.get('category') or offer_data.get('vertical', '')
            click['payout'] = offer_data.get('payout', 0)
            click['currency'] = offer_data.get('currency', 'USD')
            click['postback_url'] = offer_data.get('postback_url', '')
            click['target_url'] = offer_data.get('target_url', '')

            # Enrich with publisher data
            pub_data = users_map.get(click.get('user_id'), {})
            click['publisher_name'] = pub_data.get('name') or pub_data.get('username') or click.get('user_id', '')
            click['publisher_email'] = pub_data.get('email', '')
            click['publisher_role'] = pub_data.get('role', '')
            # Use publisher's postback URL if available, otherwise use offer's
            pub_postback = pub_data.get('postback_url', '')
            if pub_postback:
                click['postback_url'] = pub_postback

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
                        # Also update the DB record so we don't re-lookup next time
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
            click['when_clicked'] = click['time']  # Same as timestamp
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

        return jsonify({
            'success': True,
            'clicks': clicks,
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
            for row in report['data']:
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
                    row.get('total_revenue', 0), row.get('profit', 0),
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
            for conv in report['conversions']:
                writer.writerow([
                    conv.get('time', ''), conv.get('click_time', ''),
                    conv.get('publisher_name', ''), conv.get('user_email', ''),
                    conv.get('user_role', ''), conv.get('username', ''),
                    conv.get('offer_name', ''), conv.get('offer_id', ''),
                    conv.get('click_id', ''), conv.get('_id', ''),
                    conv.get('click_source', ''),
                    conv.get('points', 0), conv.get('revenue', 0), conv.get('profit', 0),
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
