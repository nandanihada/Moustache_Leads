"""
Offerwall Analytics Dashboard API
Provides aggregated metrics for the Offerwall Manager Analytics tab.
Groups: Install & Login, Logins & Traffic, Offers & Empty Walls,
Money & Payouts, Conversion Funnel, Fraud & Quality, Offer Health,
Publishers & Ops, Qualification Survey.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
from utils.auth import token_required, subadmin_or_admin_required
import logging

logger = logging.getLogger(__name__)

offerwall_analytics_dashboard_bp = Blueprint('offerwall_analytics_dashboard', __name__)


def _parse_time_window(window: str):
    """Convert time window string to a datetime cutoff."""
    now = datetime.utcnow()
    mapping = {
        '2h': timedelta(hours=2),
        '10h': timedelta(hours=10),
        '24h': timedelta(hours=24),
        'week': timedelta(days=7),
        'month': timedelta(days=30),
        '3months': timedelta(days=90),
        '6months': timedelta(days=180),
    }
    delta = mapping.get(window, timedelta(days=30))
    return now - delta


@offerwall_analytics_dashboard_bp.route('/api/admin/offerwall-analytics/dashboard', methods=['GET'])
@token_required
@subadmin_or_admin_required('offerwall-manager')
def get_analytics_dashboard():
    """
    Return all analytics groups in one call.
    Query params: window (2h|10h|24h|week|month|3months|6months)
    """
    try:
        window = request.args.get('window', 'month')
        cutoff = _parse_time_window(window)

        # Collections — using REAL data sources
        placements_col = db_instance.get_collection('placements')
        sessions_col = db_instance.get_collection('offerwall_sessions')
        offerwall_clicks_col = db_instance.get_collection('offerwall_clicks')
        offerwall_impressions_col = db_instance.get_collection('offerwall_impressions')
        clicks_col = db_instance.get_collection('clicks')  # Main click tracking (234k+)
        conversions_col = db_instance.get_collection('conversions')  # Real conversions (432)
        received_postbacks_col = db_instance.get_collection('received_postbacks')
        placement_postback_logs_col = db_instance.get_collection('placement_postback_logs')
        offers_col = db_instance.get_collection('offers')
        users_col = db_instance.get_collection('users')
        surveys_col = db_instance.get_collection('survey_responses')

        # ─── INSTALL & LOGIN ───
        # Iframes installed = approved website placements that have ≥3 offerwall impressions
        # (impressions = page visits to the offerwall link, proving the iframe is actually embedded)
        iframes_installed = 0
        iframes_latest = None
        if placements_col is not None and offerwall_impressions_col is not None:
            # Step 1: Get all LIVE website placements (LIVE = approved in this system)
            approved_website_placements = list(placements_col.find(
                {'status': 'LIVE', 'platformType': 'website'},
                {'placementIdentifier': 1, 'createdAt': 1}
            ))
            approved_pids = [p.get('placementIdentifier') for p in approved_website_placements if p.get('placementIdentifier')]

            if approved_pids:
                # Step 2: Aggregate impressions per placement_id within the time window
                impression_pipeline = [
                    {'$match': {
                        'placement_id': {'$in': approved_pids},
                        'timestamp': {'$gte': cutoff}
                    }},
                    {'$group': {
                        '_id': '$placement_id',
                        'count': {'$sum': 1},
                        'latest': {'$max': '$timestamp'}
                    }},
                    {'$match': {'count': {'$gte': 3}}}  # Only placements with ≥3 visits
                ]
                impression_results = list(offerwall_impressions_col.aggregate(impression_pipeline))

                iframes_installed = len(impression_results)

                # Get the latest impression timestamp among qualifying placements
                if impression_results:
                    latest_ts = max(r['latest'] for r in impression_results if r.get('latest'))
                    iframes_latest = latest_ts

        # Installs converted = total conversions that happened via the offerwall
        # (counts actual conversion events, not number of placements)
        first_conversions = 0
        first_conv_latest = None
        offerwall_conv_col = db_instance.get_collection('offerwall_conversions')
        if offerwall_conv_col is not None:
            # Count conversions within the time window
            conv_query = {'timestamp': {'$gte': cutoff}}
            first_conversions = offerwall_conv_col.count_documents(conv_query)

            # Also add converted clicks from our website placements
            our_pids = []
            if placements_col is not None:
                our_pids = placements_col.distinct('placementIdentifier', {'status': 'LIVE', 'platformType': 'website'})
            if clicks_col is not None and our_pids:
                clicks_conversions = clicks_col.count_documents({
                    'placement_id': {'$in': our_pids},
                    'converted': True,
                    'click_time': {'$gte': cutoff}
                })
                first_conversions += clicks_conversions

            # Latest conversion timestamp
            latest_conv = offerwall_conv_col.find_one(conv_query, sort=[('timestamp', -1)])
            if latest_conv:
                first_conv_latest = latest_conv.get('timestamp')
            elif clicks_col is not None and our_pids:
                latest_click_conv = clicks_col.find_one(
                    {'placement_id': {'$in': our_pids}, 'converted': True, 'click_time': {'$gte': cutoff}},
                    sort=[('click_time', -1)]
                )
                if latest_click_conv:
                    first_conv_latest = latest_click_conv.get('click_time')

        # ─── LOGINS & TRAFFIC ─── (OFFERWALL-ONLY: from offerwall_impressions)
        logins = 0
        logins_latest = None
        new_users = 0
        new_users_latest = None
        top_country = 'N/A'
        top_country_latest = None
        top_device = 'N/A'
        top_device_latest = None

        # Get our placement IDs to filter offerwall-only traffic
        our_placement_ids = []
        if placements_col is not None:
            our_placement_ids = placements_col.distinct('placementIdentifier', {'status': 'LIVE', 'platformType': 'website'})

        # Use offerwall_impressions for login/traffic data (page visits to the offerwall)
        if offerwall_impressions_col is not None:
            # Logins = distinct users who visited the offerwall within time window
            distinct_users = offerwall_impressions_col.distinct('user_id', {'timestamp': {'$gte': cutoff}})
            logins = len([u for u in distinct_users if u])  # Exclude empty user_ids

            latest_impression = offerwall_impressions_col.find_one(
                {'timestamp': {'$gte': cutoff}},
                sort=[('timestamp', -1)]
            )
            if latest_impression:
                logins_latest = latest_impression.get('timestamp')

            # New users = all unique users who visited the offerwall within the time window
            # (same count as logins - shows distinct users who accessed the offerwall)
            new_users = logins  # Same as logins count
            new_users_latest = logins_latest

        # Top country & device from offerwall_impressions
        # Country: from the 'country' field we now store on impressions
        if offerwall_impressions_col is not None:
            # Get countries from impressions that have the country field
            countries = offerwall_impressions_col.distinct('country', {
                'timestamp': {'$gte': cutoff},
                'country': {'$exists': True, '$ne': None, '$ne': '', '$ne': 'Unknown', '$ne': '—'}
            })
            if countries:
                # Count occurrences manually (Atlas free tier compatible)
                country_counts = {}
                for c in countries:
                    count = offerwall_impressions_col.count_documents({
                        'timestamp': {'$gte': cutoff}, 'country': c
                    })
                    country_counts[c] = count
                if country_counts:
                    top_country = max(country_counts, key=country_counts.get)
                    latest_country_rec = offerwall_impressions_col.find_one(
                        {'timestamp': {'$gte': cutoff}, 'country': top_country},
                        sort=[('timestamp', -1)]
                    )
                    if latest_country_rec:
                        top_country_latest = latest_country_rec.get('timestamp')

        # Device: parse from user_agent in impression data
        if offerwall_impressions_col is not None and top_device == 'N/A':
            # Get a sample of recent impressions and count device types
            recent_impressions = list(offerwall_impressions_col.find(
                {'timestamp': {'$gte': cutoff}},
                {'data.user_agent': 1}
            ).limit(500))
            device_counts = {'desktop': 0, 'mobile': 0}
            for imp in recent_impressions:
                ua = (imp.get('data') or {}).get('user_agent', '')
                if ua and any(m in ua.lower() for m in ['mobile', 'android', 'iphone', 'ipad']):
                    device_counts['mobile'] += 1
                else:
                    device_counts['desktop'] += 1
            if device_counts:
                top_device = max(device_counts, key=device_counts.get)

        # Fallback to sessions if impressions have no country data
        if top_country == 'N/A' and sessions_col is not None:
            country_data = sessions_col.distinct('country', {
                'created_at': {'$gte': cutoff},
                'country': {'$exists': True, '$ne': None, '$ne': ''}
            })
            if country_data:
                country_counts = {}
                for c in country_data:
                    country_counts[c] = sessions_col.count_documents({
                        'created_at': {'$gte': cutoff}, 'country': c
                    })
                if country_counts:
                    top_country = max(country_counts, key=country_counts.get)

        # Fallback to clicks collection
        if top_country == 'N/A' and clicks_col is not None and our_placement_ids:
            country_data = clicks_col.distinct('country', {
                'click_time': {'$gte': cutoff},
                'placement_id': {'$in': our_placement_ids},
                'country': {'$exists': True, '$ne': 'Unknown'}
            })
            if country_data:
                country_counts = {}
                for c in country_data[:20]:  # Limit to top 20 to avoid too many queries
                    country_counts[c] = clicks_col.count_documents({
                        'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'country': c
                    })
                if country_counts:
                    top_country = max(country_counts, key=country_counts.get)

        # ─── OFFERS & EMPTY WALLS ───
        custom_picked = 0
        custom_picked_latest = None
        no_offer_links = 0

        # Custom-picked = pinned offers from offerwall_settings
        settings_col = db_instance.get_collection('offerwall_settings')
        if settings_col is not None:
            settings_doc = settings_col.find_one({})
            if settings_doc:
                pinned = settings_doc.get('pinned_offers', [])
                custom_picked = len(pinned)
                custom_picked_latest = settings_doc.get('updated_at')

        # No-offer links: not currently tracked, keep as 0
        no_offer_links = 0

        # ─── MONEY & PAYOUTS ─── (OFFERWALL-ONLY: from offerwall_conversions + clicks with our placement_ids)
        revenue = 0.0
        revenue_latest = None
        payout_liability = 0.0
        payout_latest = None
        epc = 0.0
        epc_latest = None
        reversed_count = 0
        reversed_latest = None

        # Revenue from offerwall_conversions (confirmed iframe conversions)
        offerwall_conv_col = db_instance.get_collection('offerwall_conversions')
        if offerwall_conv_col is not None:
            rev_pipeline = [
                {'$match': {'timestamp': {'$gte': cutoff}}},
                {'$group': {'_id': None, 'total': {'$sum': '$payout_amount'}, 'count': {'$sum': 1}}}
            ]
            rev_result = list(offerwall_conv_col.aggregate(rev_pipeline))
            if rev_result:
                revenue = round(rev_result[0].get('total', 0) or 0, 2)

            latest_rev = offerwall_conv_col.find_one(
                {'timestamp': {'$gte': cutoff}},
                sort=[('timestamp', -1)]
            )
            if latest_rev:
                revenue_latest = latest_rev.get('timestamp')

            # Payout liability = pending offerwall conversions
            pending_pipeline = [
                {'$match': {'timestamp': {'$gte': cutoff}, 'status': 'pending'}},
                {'$group': {'_id': None, 'total': {'$sum': '$payout_amount'}}}
            ]
            pending_result = list(offerwall_conv_col.aggregate(pending_pipeline))
            if pending_result:
                payout_liability = round(pending_result[0].get('total', 0) or 0, 2)

            latest_pending = offerwall_conv_col.find_one(
                {'timestamp': {'$gte': cutoff}, 'status': 'pending'},
                sort=[('timestamp', -1)]
            )
            if latest_pending:
                payout_latest = latest_pending.get('timestamp')

        # Also add revenue from clicks collection (converted clicks from our placements)
        if clicks_col is not None and our_placement_ids:
            clicks_rev_pipeline = [
                {'$match': {'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'converted': True, 'postback_revenue': {'$gt': 0}}},
                {'$group': {'_id': None, 'total': {'$sum': '$postback_revenue'}, 'count': {'$sum': 1}}}
            ]
            clicks_rev_result = list(clicks_col.aggregate(clicks_rev_pipeline))
            if clicks_rev_result:
                revenue += round(clicks_rev_result[0].get('total', 0) or 0, 2)

        # Reversed = conversions that admin reversed (status='reversed' or is_reversal=True)
        if conversions_col is not None:
            reversed_count = conversions_col.count_documents({
                'created_at': {'$gte': cutoff},
                '$or': [
                    {'status': 'reversed'},
                    {'is_reversal': True}
                ]
            })
            latest_reversed = conversions_col.find_one(
                {'created_at': {'$gte': cutoff}, '$or': [{'status': 'reversed'}, {'is_reversal': True}]},
                sort=[('created_at', -1)]
            )
            if latest_reversed:
                reversed_latest = latest_reversed.get('created_at')

        # EPC = revenue / offerwall clicks in window
        total_clicks_for_epc = 0
        if offerwall_clicks_col is not None:
            total_clicks_for_epc = offerwall_clicks_col.count_documents({'timestamp': {'$gte': cutoff}})
        epc = round(revenue / total_clicks_for_epc, 3) if total_clicks_for_epc > 0 else 0
        epc_latest = revenue_latest

        # ─── CONVERSION FUNNEL ─── (from conversions + clicks)
        credited_count = 0
        credited_latest = None
        in_progress_count = 0
        in_progress_latest = None
        click_complete_pct = 0.0
        avg_time_to_credit = 0
        pending_rejected = 0
        pending_rejected_latest = None
        dead_offers = 0

        if conversions_col is not None:
            credited_count = conversions_col.count_documents({
                'created_at': {'$gte': cutoff}, 'status': 'approved'
            })
            latest_credited = conversions_col.find_one(
                {'created_at': {'$gte': cutoff}, 'status': 'approved'},
                sort=[('created_at', -1)]
            )
            if latest_credited:
                credited_latest = latest_credited.get('created_at')

            in_progress_count = conversions_col.count_documents({
                'created_at': {'$gte': cutoff}, 'status': 'pending'
            })
            latest_ip = conversions_col.find_one(
                {'created_at': {'$gte': cutoff}, 'status': 'pending'},
                sort=[('created_at', -1)]
            )
            if latest_ip:
                in_progress_latest = latest_ip.get('created_at')

            # Click → complete %
            if total_clicks_for_epc > 0:
                click_complete_pct = round((credited_count / total_clicks_for_epc) * 100, 2)

            # Pending / rejected
            pending_rejected = conversions_col.count_documents({
                'created_at': {'$gte': cutoff}, 'status': {'$in': ['pending', 'rejected']}
            })
            latest_pr = conversions_col.find_one(
                {'created_at': {'$gte': cutoff}, 'status': {'$in': ['pending', 'rejected']}},
                sort=[('created_at', -1)]
            )
            if latest_pr:
                pending_rejected_latest = latest_pr.get('created_at')

        # Dead offers (clicks but 0 conversions in the window)
        if clicks_col is not None and conversions_col is not None:
            clicked_offers = clicks_col.distinct('offer_id', {'click_time': {'$gte': cutoff}})
            if clicked_offers:
                converted_offers = conversions_col.distinct('offer_id', {'created_at': {'$gte': cutoff}})
                dead_offers = len(set(clicked_offers) - set(converted_offers))

        # ─── FRAUD & QUALITY ─── (OFFERWALL-ONLY: from clicks filtered to our placements)
        vpn_redirects = 0
        vpn_latest = None
        multi_account_ips = 0
        multi_ip_latest = None
        postback_no_click = 0
        postback_no_click_latest = None

        if clicks_col is not None and our_placement_ids:
            # VPN/proxy from clicks fraud_signals array — ONLY our offerwall placements
            vpn_redirects = clicks_col.count_documents({
                'click_time': {'$gte': cutoff},
                'placement_id': {'$in': our_placement_ids},
                'fraud_signals': {'$in': ['vpn_detected', 'proxy_detected']}
            })
            if vpn_redirects > 0:
                latest_vpn = clicks_col.find_one(
                    {'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'fraud_signals': {'$in': ['vpn_detected', 'proxy_detected']}},
                    sort=[('click_time', -1)]
                )
                if latest_vpn:
                    vpn_latest = latest_vpn.get('click_time')

            # Multi-account / suspicious clicks — ONLY our offerwall placements
            multi_account_ips = clicks_col.count_documents({
                'click_time': {'$gte': cutoff},
                'placement_id': {'$in': our_placement_ids},
                'fraud_classification': 'suspicious'
            })
            if multi_account_ips > 0:
                latest_multi = clicks_col.find_one(
                    {'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'fraud_classification': 'suspicious'},
                    sort=[('click_time', -1)]
                )
                if latest_multi:
                    multi_ip_latest = latest_multi.get('click_time')

        # Postback without click = received_postbacks with rejected_click_not_found
        if received_postbacks_col is not None:
            postback_no_click = received_postbacks_col.count_documents({
                'timestamp': {'$gte': cutoff},
                'status': 'rejected_click_not_found'
            })
            if postback_no_click > 0:
                latest_pnc = received_postbacks_col.find_one(
                    {'timestamp': {'$gte': cutoff}, 'status': 'rejected_click_not_found'},
                    sort=[('timestamp', -1)]
                )
                if latest_pnc:
                    postback_no_click_latest = latest_pnc.get('timestamp')

        # ─── OFFER HEALTH ───
        live_offers = 0
        paused_capped = 0
        paused_capped_latest = None
        avg_postback_ok = 0

        if offers_col is not None:
            # Live offers = active/running + show_in_offerwall
            live_offers = offers_col.count_documents({
                'status': {'$in': ['active', 'running']},
                '$or': [{'show_in_offerwall': True}, {'show_in_offerwall': {'$exists': False}}],
                '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
            })
            # Use $and to avoid $or key collision
            live_offers = offers_col.count_documents({
                '$and': [
                    {'status': {'$in': ['active', 'running']}},
                    {'$or': [{'show_in_offerwall': True}, {'show_in_offerwall': {'$exists': False}}]},
                    {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
                ]
            })

            paused_capped = offers_col.count_documents({
                'status': {'$in': ['paused', 'capped', 'inactive']},
                'show_in_offerwall': True
            })
            latest_paused = offers_col.find_one(
                {'status': {'$in': ['paused', 'capped', 'inactive']}},
                sort=[('updated_at', -1)]
            )
            if latest_paused:
                paused_capped_latest = latest_paused.get('updated_at')

        # Avg postback success rate from placement_postback_logs
        if placement_postback_logs_col is not None:
            total_pb = placement_postback_logs_col.count_documents({'timestamp': {'$gte': cutoff}})
            success_pb = placement_postback_logs_col.count_documents({
                'timestamp': {'$gte': cutoff}, 'status': 'success'
            })
            avg_postback_ok = round((success_pb / total_pb) * 100) if total_pb > 0 else 0

        # ─── PUBLISHERS & OPS ───
        publisher_scorecard_count = 0
        publisher_latest = None
        pending_requests = 0
        pending_requests_latest = None

        if users_col is not None:
            publisher_scorecard_count = users_col.count_documents({
                'role': 'publisher',
                'account_status': 'approved'
            })
            latest_pub = users_col.find_one(
                {'role': 'publisher', 'account_status': 'approved'},
                sort=[('created_at', -1)]
            )
            if latest_pub:
                publisher_latest = latest_pub.get('created_at')

            pending_requests = users_col.count_documents({
                'role': 'publisher',
                'account_status': {'$in': ['pending_approval', 'pending']}
            })
            latest_pending = users_col.find_one(
                {'role': 'publisher', 'account_status': {'$in': ['pending_approval', 'pending']}},
                sort=[('created_at', -1)]
            )
            if latest_pending:
                pending_requests_latest = latest_pending.get('created_at')

        # ─── QUALIFICATION SURVEY ───
        completions = 0
        completions_latest = None
        answer_questions = 0

        if surveys_col is not None:
            completions = surveys_col.count_documents({'completed_at': {'$gte': cutoff}})
            latest_survey = surveys_col.find_one(
                {'completed_at': {'$gte': cutoff}},
                sort=[('completed_at', -1)]
            )
            if latest_survey:
                completions_latest = latest_survey.get('completed_at')

            # Distinct questions answered
            q_pipeline = [
                {'$match': {'completed_at': {'$gte': cutoff}}},
                {'$unwind': '$answers'},
                {'$group': {'_id': '$answers.question_id'}},
                {'$count': 'total'}
            ]
            q_result = list(surveys_col.aggregate(q_pipeline))
            answer_questions = q_result[0]['total'] if q_result else 0

        # Serialize timestamps
        def ts(dt):
            if dt is None:
                return None
            if isinstance(dt, datetime):
                return dt.isoformat() + 'Z'
            return str(dt)

        return jsonify({
            'success': True,
            'data': {
                'install_login': {
                    'iframes_installed': {'value': iframes_installed, 'latest': ts(iframes_latest)},
                    'first_conversion': {'value': first_conversions, 'latest': ts(first_conv_latest)},
                },
                'logins_traffic': {
                    'logins': {'value': logins, 'latest': ts(logins_latest)},
                    'new_users': {'value': new_users, 'latest': ts(new_users_latest)},
                    'top_country': {'value': top_country, 'latest': ts(top_country_latest)},
                    'top_device': {'value': top_device, 'latest': ts(top_device_latest)},
                },
                'offers_empty_walls': {
                    'custom_picked': {'value': custom_picked, 'latest': ts(custom_picked_latest)},
                    'no_offer_links': {'value': no_offer_links, 'latest': None},
                },
                'money_payouts': {
                    'revenue': {'value': revenue, 'latest': ts(revenue_latest)},
                    'payout_liability': {'value': payout_liability, 'latest': ts(payout_latest)},
                    'epc': {'value': epc, 'latest': ts(epc_latest)},
                    'reversed_chargedback': {'value': reversed_count, 'latest': ts(reversed_latest)},
                },
                'conversion_funnel': {
                    'credited_approved': {'value': credited_count, 'latest': ts(credited_latest)},
                    'in_progress': {'value': in_progress_count, 'latest': ts(in_progress_latest)},
                    'click_complete_pct': {'value': click_complete_pct, 'latest': None},
                    'avg_time_to_credit': {'value': avg_time_to_credit, 'latest': None},
                    'pending_rejected': {'value': pending_rejected, 'latest': ts(pending_rejected_latest)},
                    'dead_offers': {'value': dead_offers, 'latest': None},
                },
                'fraud_quality': {
                    'vpn_redirects': {'value': vpn_redirects, 'latest': ts(vpn_latest)},
                    'multi_account_ips': {'value': multi_account_ips, 'latest': ts(multi_ip_latest)},
                    'postback_without_click': {'value': postback_no_click, 'latest': ts(postback_no_click_latest)},
                },
                'offer_health': {
                    'live_offers': {'value': live_offers, 'latest': None},
                    'paused_capped': {'value': paused_capped, 'latest': ts(paused_capped_latest)},
                    'avg_postback_ok': {'value': avg_postback_ok, 'latest': None},
                },
                'publishers_ops': {
                    'publisher_scorecard': {'value': publisher_scorecard_count, 'latest': ts(publisher_latest)},
                    'pending_requests': {'value': pending_requests, 'latest': ts(pending_requests_latest)},
                },
                'qualification_survey': {
                    'completions': {'value': completions, 'latest': ts(completions_latest)},
                    'answer_breakdown': {'value': answer_questions, 'latest': ts(completions_latest)},
                },
            }
        }), 200

    except Exception as e:
        logger.error(f"❌ Error getting offerwall analytics dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@offerwall_analytics_dashboard_bp.route('/api/admin/offerwall-analytics/tile-detail', methods=['GET'])
@token_required
@subadmin_or_admin_required('offerwall-manager')
def get_tile_detail():
    """
    Get detailed data for a specific tile popup.
    Query params: tile (tile key), window (time window)
    Returns: chart data + table rows for the popup.
    """
    try:
        tile = request.args.get('tile', '')
        window = request.args.get('window', 'month')
        cutoff = _parse_time_window(window)
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        skip = (page - 1) * per_page

        sessions_col = db_instance.get_collection('offerwall_sessions')
        offerwall_clicks_col = db_instance.get_collection('offerwall_clicks')
        offerwall_impressions_col = db_instance.get_collection('offerwall_impressions')
        clicks_col = db_instance.get_collection('clicks')
        conversions_col = db_instance.get_collection('conversions')
        received_postbacks_col = db_instance.get_collection('received_postbacks')
        offers_col = db_instance.get_collection('offers')
        users_col = db_instance.get_collection('users')
        placements_col = db_instance.get_collection('placements')
        surveys_col = db_instance.get_collection('survey_responses')

        # Get our placement IDs (LIVE website placements)
        our_placement_ids = []
        if placements_col is not None:
            our_placement_ids = placements_col.distinct('placementIdentifier', {'status': 'LIVE', 'platformType': 'website'})

        rows = []
        chart_data = []
        total = 0

        if tile == 'iframes_installed':
            # Approved website placements with ≥3 impressions in the time window
            base_query = {
                'status': 'LIVE',
                'platformType': 'website',
            }

            if search:
                base_query['$or'] = [
                    {'platformName': {'$regex': search, '$options': 'i'}},
                    {'apiKey': {'$regex': search, '$options': 'i'}},
                    {'offerwallTitle': {'$regex': search, '$options': 'i'}},
                    {'placementIdentifier': {'$regex': search, '$options': 'i'}}
                ]

            # Fetch all approved website placements
            all_items = list(placements_col.find(base_query).sort('createdAt', -1)) if placements_col is not None else []

            # Gather publisher names from users collection
            publisher_ids = list(set([item.get('publisherId') for item in all_items if item.get('publisherId')]))
            publisher_names = {}
            if users_col is not None and publisher_ids:
                publishers = list(users_col.find(
                    {'_id': {'$in': publisher_ids}},
                    {'_id': 1, 'username': 1, 'email': 1}
                ))
                for p in publishers:
                    publisher_names[str(p['_id'])] = p.get('username', p.get('email', 'Unknown'))

            # Get impression counts per placement from offerwall_impressions (within time window)
            placement_identifiers = [item.get('placementIdentifier') for item in all_items if item.get('placementIdentifier')]
            impression_counts = {}
            user_counts = {}

            if offerwall_impressions_col is not None and placement_identifiers:
                imp_pipeline = [
                    {'$match': {
                        'placement_id': {'$in': placement_identifiers},
                        'timestamp': {'$gte': cutoff}
                    }},
                    {'$group': {
                        '_id': '$placement_id',
                        'impressions': {'$sum': 1},
                        'unique_users': {'$addToSet': '$user_id'}
                    }}
                ]
                imp_results = list(offerwall_impressions_col.aggregate(imp_pipeline))
                for r in imp_results:
                    pid = r['_id']
                    impression_counts[pid] = r.get('impressions', 0)
                    user_counts[pid] = len(r.get('unique_users', []))

            # Build rows — only include placements with ≥3 impressions
            all_rows = []
            for item in all_items:
                pid = str(item.get('publisherId', ''))
                placement_id = item.get('placementIdentifier', '')
                imp_count = impression_counts.get(placement_id, 0)
                if imp_count < 3:
                    continue  # Skip placements that don't meet threshold
                all_rows.append({
                    'id': str(item.get('_id', '')),
                    'publisher_name': publisher_names.get(pid, 'Unknown'),
                    'publisher_id': pid,
                    'api_key': item.get('apiKey', ''),
                    'placement_id': placement_id,
                    'offerwall_title': item.get('offerwallTitle', ''),
                    'platform': item.get('platformType', 'N/A'),
                    'clicks': imp_count,
                    'end_users': user_counts.get(placement_id, 0),
                    'status': item.get('status', ''),
                    'date': item.get('createdAt').isoformat() + 'Z' if item.get('createdAt') else None,
                })

            # Sort by clicks (impressions) descending
            all_rows.sort(key=lambda x: x['clicks'], reverse=True)
            total = len(all_rows)

            # Paginate
            rows = all_rows[skip:skip + per_page]

        elif tile == 'first_conversion':
            # Placements that produced conversions — show placement + conversion details
            offerwall_conv_col = db_instance.get_collection('offerwall_conversions')
            if offerwall_conv_col is not None and placements_col is not None:
                # Get all offerwall conversions grouped by placement
                conv_pipeline = [
                    {"$group": {
                        "_id": "$placement_id",
                        "conversions": {"$sum": 1},
                        "total_payout": {"$sum": "$payout_amount"},
                        "unique_users": {"$addToSet": "$user_id"},
                        "latest": {"$max": "$timestamp"},
                        "offers": {"$addToSet": "$offer_id"}
                    }},
                    {"$sort": {"conversions": -1}}
                ]
                conv_results = list(offerwall_conv_col.aggregate(conv_pipeline))

                # Look up placement details and publisher names
                all_conv_rows = []
                for r in conv_results:
                    pid = r['_id']
                    placement = placements_col.find_one({"placementIdentifier": pid})
                    pub_name = "Unknown"
                    if placement and users_col is not None:
                        user = users_col.find_one({"_id": placement.get("publisherId")}, {"username": 1})
                        if user:
                            pub_name = user.get("username", "Unknown")
                    all_conv_rows.append({
                        'id': pid or 'unknown',
                        'placement_id': pid or '',
                        'publisher_name': pub_name,
                        'offerwall_title': placement.get('offerwallTitle', '') if placement else '',
                        'conversions': r.get('conversions', 0),
                        'total_payout': round(r.get('total_payout', 0), 2),
                        'end_users': len(r.get('unique_users', [])),
                        'offers_converted': len(r.get('offers', [])),
                        'latest_conversion': r['latest'].isoformat() + 'Z' if r.get('latest') else None,
                    })

                total = len(all_conv_rows)
                rows = all_conv_rows[skip:skip + per_page]

        elif tile == 'logins':
            # Show offerwall page visits from offerwall_impressions
            # Each impression = one end user visiting the offerwall page
            query = {'timestamp': {'$gte': cutoff}}
            if search:
                query['$or'] = [
                    {'user_id': {'$regex': search, '$options': 'i'}},
                    {'placement_id': {'$regex': search, '$options': 'i'}},
                    {'publisher_id': {'$regex': search, '$options': 'i'}}
                ]
            total = offerwall_impressions_col.count_documents(query) if offerwall_impressions_col is not None else 0
            items = list(offerwall_impressions_col.find(query).sort('timestamp', -1).skip(skip).limit(per_page)) if offerwall_impressions_col is not None else []

            # Gather publisher names for the placement_ids
            placement_ids_in_page = list(set([item.get('placement_id') for item in items if item.get('placement_id')]))
            publisher_map = {}  # placement_id -> publisher_name
            if placements_col is not None and placement_ids_in_page:
                placements_data = list(placements_col.find(
                    {'placementIdentifier': {'$in': placement_ids_in_page}},
                    {'placementIdentifier': 1, 'publisherId': 1}
                ))
                pub_ids = list(set([p.get('publisherId') for p in placements_data if p.get('publisherId')]))
                pub_names = {}
                if users_col is not None and pub_ids:
                    pubs = list(users_col.find({'_id': {'$in': pub_ids}}, {'_id': 1, 'username': 1, 'email': 1}))
                    for p in pubs:
                        pub_names[str(p['_id'])] = p.get('username', p.get('email', 'Unknown'))
                for pd in placements_data:
                    pid = pd.get('placementIdentifier')
                    pub_id = str(pd.get('publisherId', ''))
                    publisher_map[pid] = pub_names.get(pub_id, 'Unknown')

            # Parse user_agent for device info
            def parse_device(ua):
                if not ua:
                    return 'unknown', 'unknown'
                ua_lower = ua.lower()
                device = 'mobile' if any(m in ua_lower for m in ['mobile', 'android', 'iphone', 'ipad']) else 'desktop'
                if 'chrome' in ua_lower and 'edg' not in ua_lower:
                    browser = 'Chrome'
                elif 'firefox' in ua_lower:
                    browser = 'Firefox'
                elif 'safari' in ua_lower and 'chrome' not in ua_lower:
                    browser = 'Safari'
                elif 'edg' in ua_lower:
                    browser = 'Edge'
                else:
                    browser = 'Other'
                return device, browser

            for item in items:
                data_field = item.get('data', {}) or {}
                user_agent = data_field.get('user_agent', '')
                referrer = data_field.get('referrer', '')
                device_type, browser = parse_device(user_agent)
                country = item.get('country', '—')

                rows.append({
                    'id': str(item.get('_id', '')),
                    'user_id': item.get('user_id', ''),
                    'publisher_name': publisher_map.get(item.get('placement_id', ''), 'Unknown'),
                    'placement_id': item.get('placement_id', ''),
                    'device': device_type,
                    'browser': browser,
                    'country': country,
                    'referrer': referrer[:50] if referrer else '—',
                    'time_spent': '—',  # Will be available for new sessions going forward
                    'date': item.get('timestamp').isoformat() + 'Z' if item.get('timestamp') else None,
                })

        elif tile == 'new_users':
            # Show all unique users who visited the offerwall in the time window
            # Group by user_id and show their first visit, total visits, last visit
            if offerwall_impressions_col is not None:
                # Get distinct users in window
                query = {'timestamp': {'$gte': cutoff}}
                if search:
                    query['user_id'] = {'$regex': search, '$options': 'i'}

                all_user_ids = offerwall_impressions_col.distinct('user_id', query)
                all_user_ids = [u for u in all_user_ids if u]  # Remove empty
                total = len(all_user_ids)

                # Paginate user_ids
                paginated_users = sorted(all_user_ids)[skip:skip + per_page]

                # Get publisher map for placements
                for uid in paginated_users:
                    user_impressions = list(offerwall_impressions_col.find(
                        {'user_id': uid, 'timestamp': {'$gte': cutoff}}
                    ).sort('timestamp', -1).limit(1))

                    first_impression = offerwall_impressions_col.find_one(
                        {'user_id': uid, 'timestamp': {'$gte': cutoff}},
                        sort=[('timestamp', 1)]
                    )

                    visit_count = offerwall_impressions_col.count_documents(
                        {'user_id': uid, 'timestamp': {'$gte': cutoff}}
                    )

                    latest = user_impressions[0] if user_impressions else None
                    placement_id = latest.get('placement_id', '') if latest else ''

                    rows.append({
                        'id': uid,
                        'user_id': uid,
                        'total_visits': visit_count,
                        'first_visit': first_impression.get('timestamp').isoformat() + 'Z' if first_impression and first_impression.get('timestamp') else None,
                        'last_visit': latest.get('timestamp').isoformat() + 'Z' if latest and latest.get('timestamp') else None,
                        'placement_id': placement_id,
                    })

        elif tile == 'vpn_redirects':
            query = {'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'fraud_signals': {'$in': ['vpn_detected', 'proxy_detected']}}
            if search:
                query['user_id'] = {'$regex': search, '$options': 'i'}
            total = clicks_col.count_documents(query) if clicks_col is not None and our_placement_ids else 0
            items = list(clicks_col.find(query).sort('click_time', -1).skip(skip).limit(per_page)) if clicks_col is not None and our_placement_ids else []
            for item in items:
                rows.append({
                    'id': str(item.get('_id', '')),
                    'user_id': item.get('user_id', ''),
                    'offer': item.get('offer_name', ''),
                    'placement_id': item.get('placement_id', ''),
                    'ip': item.get('ip_address', ''),
                    'country': item.get('country', 'N/A'),
                    'fraud_score': item.get('fraud_score', 0),
                    'date': item.get('click_time').isoformat() + 'Z' if item.get('click_time') else None,
                })

        elif tile == 'multi_account_ips':
            query = {'click_time': {'$gte': cutoff}, 'placement_id': {'$in': our_placement_ids}, 'fraud_classification': 'suspicious'}
            if search:
                query['$or'] = [
                    {'user_id': {'$regex': search, '$options': 'i'}},
                    {'ip_address': {'$regex': search, '$options': 'i'}}
                ]
            total = clicks_col.count_documents(query) if clicks_col is not None and our_placement_ids else 0
            items = list(clicks_col.find(query).sort('click_time', -1).skip(skip).limit(per_page)) if clicks_col is not None and our_placement_ids else []
            for item in items:
                rows.append({
                    'id': str(item.get('_id', '')),
                    'user_id': item.get('user_id', ''),
                    'offer': item.get('offer_name', ''),
                    'placement_id': item.get('placement_id', ''),
                    'ip': item.get('ip_address', ''),
                    'country': item.get('country', 'N/A'),
                    'fraud_score': item.get('fraud_score', 0),
                    'signals': ', '.join(item.get('fraud_signals', [])) if item.get('fraud_signals') else '',
                    'date': item.get('click_time').isoformat() + 'Z' if item.get('click_time') else None,
                })

        elif tile == 'postback_without_click':
            # Show postbacks that came in without a matching click
            if received_postbacks_col is not None:
                query = {'timestamp': {'$gte': cutoff}, 'status': 'rejected_click_not_found'}
                if search:
                    query['$or'] = [
                        {'offer_id': {'$regex': search, '$options': 'i'}},
                        {'click_id': {'$regex': search, '$options': 'i'}}
                    ]
                total = received_postbacks_col.count_documents(query)
                items = list(received_postbacks_col.find(query).sort('timestamp', -1).skip(skip).limit(per_page))
                for item in items:
                    rows.append({
                        'id': str(item.get('_id', '')),
                        'offer_id': item.get('offer_id', ''),
                        'click_id': item.get('click_id', ''),
                        'payout': item.get('payout', item.get('revenue', 0)),
                        'status': 'No matching click',
                        'network': item.get('network', ''),
                        'date': item.get('timestamp').isoformat() + 'Z' if item.get('timestamp') else None,
                    })

        elif tile == 'revenue':
            # Show each conversion that generated revenue via the offerwall
            offerwall_conv_col = db_instance.get_collection('offerwall_conversions')
            all_revenue_items = []

            # Source 1: offerwall_conversions
            if offerwall_conv_col is not None:
                query = {'timestamp': {'$gte': cutoff}}
                if search:
                    query['$or'] = [
                        {'user_id': {'$regex': search, '$options': 'i'}},
                        {'offer_id': {'$regex': search, '$options': 'i'}},
                        {'placement_id': {'$regex': search, '$options': 'i'}}
                    ]
                items = list(offerwall_conv_col.find(query).sort('timestamp', -1))
                for item in items:
                    all_revenue_items.append({
                        'id': str(item.get('_id', '')),
                        'user_id': item.get('user_id', ''),
                        'offer_id': item.get('offer_id', ''),
                        'placement_id': item.get('placement_id', ''),
                        'payout': item.get('payout_amount', 0),
                        'status': item.get('status', 'approved'),
                        'source': 'offerwall',
                        'date': item.get('timestamp').isoformat() + 'Z' if item.get('timestamp') else None,
                        '_ts': item.get('timestamp'),
                    })

            # Source 2: clicks collection (converted clicks from our placements)
            if clicks_col is not None and our_placement_ids:
                click_query = {
                    'click_time': {'$gte': cutoff},
                    'placement_id': {'$in': our_placement_ids},
                    'converted': True,
                    'postback_revenue': {'$gt': 0}
                }
                if search:
                    click_query['$or'] = [
                        {'user_id': {'$regex': search, '$options': 'i'}},
                        {'offer_name': {'$regex': search, '$options': 'i'}}
                    ]
                click_items = list(clicks_col.find(click_query).sort('click_time', -1))
                for item in click_items:
                    all_revenue_items.append({
                        'id': str(item.get('_id', '')),
                        'user_id': item.get('user_id', item.get('affiliate_id', '')),
                        'offer_id': item.get('offer_id', ''),
                        'offer_name': item.get('offer_name', ''),
                        'placement_id': item.get('placement_id', ''),
                        'payout': item.get('postback_revenue', 0),
                        'country': item.get('country', '—'),
                        'status': 'converted',
                        'source': 'clicks',
                        'date': item.get('click_time').isoformat() + 'Z' if item.get('click_time') else None,
                        '_ts': item.get('click_time'),
                    })

            # Sort all by timestamp descending
            all_revenue_items.sort(key=lambda x: x.get('_ts') or '', reverse=True)

            # Enrich with publisher names and offer names
            placement_ids_list = list(set(r.get('placement_id') for r in all_revenue_items if r.get('placement_id')))
            pub_map = {}
            if placements_col is not None and placement_ids_list:
                p_data = list(placements_col.find({'placementIdentifier': {'$in': placement_ids_list}}, {'placementIdentifier': 1, 'publisherId': 1}))
                pub_ids = list(set(p.get('publisherId') for p in p_data if p.get('publisherId')))
                pnames = {}
                if users_col is not None and pub_ids:
                    pubs = list(users_col.find({'_id': {'$in': pub_ids}}, {'_id': 1, 'username': 1}))
                    for p in pubs:
                        pnames[str(p['_id'])] = p.get('username', 'Unknown')
                for pd in p_data:
                    pub_map[pd.get('placementIdentifier')] = pnames.get(str(pd.get('publisherId', '')), 'Unknown')

            # Get offer names
            offer_ids_list = list(set(r.get('offer_id') for r in all_revenue_items if r.get('offer_id')))
            offer_names_map = {}
            if offers_col is not None and offer_ids_list:
                offers_data = list(offers_col.find({'offer_id': {'$in': offer_ids_list}}, {'offer_id': 1, 'name': 1}))
                for o in offers_data:
                    offer_names_map[o.get('offer_id')] = o.get('name', '')

            # Build final rows
            total = len(all_revenue_items)
            paginated = all_revenue_items[skip:skip + per_page]
            for item in paginated:
                item.pop('_ts', None)
                item['publisher_name'] = pub_map.get(item.get('placement_id', ''), 'Unknown')
                if not item.get('offer_name'):
                    item['offer_name'] = offer_names_map.get(item.get('offer_id', ''), item.get('offer_id', ''))
                item['country'] = item.get('country', '—')
            rows = paginated

        elif tile == 'payout_liability':
            # Show pending/unpaid conversions from offerwall
            offerwall_conv_col = db_instance.get_collection('offerwall_conversions')
            if offerwall_conv_col is not None:
                query = {'timestamp': {'$gte': cutoff}, 'status': 'pending'}
                if search:
                    query['$or'] = [
                        {'user_id': {'$regex': search, '$options': 'i'}},
                        {'offer_id': {'$regex': search, '$options': 'i'}}
                    ]
                total = offerwall_conv_col.count_documents(query)
                items = list(offerwall_conv_col.find(query).sort('timestamp', -1).skip(skip).limit(per_page))

                # Get publisher and offer names
                placement_ids_list = list(set(i.get('placement_id') for i in items if i.get('placement_id')))
                pub_map = {}
                if placements_col is not None and placement_ids_list:
                    p_data = list(placements_col.find({'placementIdentifier': {'$in': placement_ids_list}}, {'placementIdentifier': 1, 'publisherId': 1}))
                    pub_ids = list(set(p.get('publisherId') for p in p_data if p.get('publisherId')))
                    pnames = {}
                    if users_col is not None and pub_ids:
                        pubs = list(users_col.find({'_id': {'$in': pub_ids}}, {'_id': 1, 'username': 1}))
                        for p in pubs:
                            pnames[str(p['_id'])] = p.get('username', 'Unknown')
                    for pd in p_data:
                        pub_map[pd.get('placementIdentifier')] = pnames.get(str(pd.get('publisherId', '')), 'Unknown')

                offer_ids_list = list(set(i.get('offer_id') for i in items if i.get('offer_id')))
                offer_names_map = {}
                if offers_col is not None and offer_ids_list:
                    offers_data = list(offers_col.find({'offer_id': {'$in': offer_ids_list}}, {'offer_id': 1, 'name': 1}))
                    for o in offers_data:
                        offer_names_map[o.get('offer_id')] = o.get('name', '')

                for item in items:
                    rows.append({
                        'id': str(item.get('_id', '')),
                        'user_id': item.get('user_id', ''),
                        'offer_name': offer_names_map.get(item.get('offer_id', ''), item.get('offer_id', '')),
                        'publisher_name': pub_map.get(item.get('placement_id', ''), 'Unknown'),
                        'placement_id': item.get('placement_id', ''),
                        'payout': item.get('payout_amount', 0),
                        'status': 'pending',
                        'date': item.get('timestamp').isoformat() + 'Z' if item.get('timestamp') else None,
                    })

        elif tile == 'reversed_chargedback':
            # Show all admin-reversed conversions
            if conversions_col is not None:
                query = {
                    'created_at': {'$gte': cutoff},
                    '$or': [
                        {'status': 'reversed'},
                        {'is_reversal': True}
                    ]
                }
                if search:
                    # Add search to a nested $and to avoid $or conflict
                    query = {
                        '$and': [
                            {'created_at': {'$gte': cutoff}},
                            {'$or': [{'status': 'reversed'}, {'is_reversal': True}]},
                            {'$or': [
                                {'offer_id': {'$regex': search, '$options': 'i'}},
                                {'user_id': {'$regex': search, '$options': 'i'}},
                                {'click_id': {'$regex': search, '$options': 'i'}}
                            ]}
                        ]
                    }
                total = conversions_col.count_documents(query)
                items = list(conversions_col.find(query).sort('created_at', -1).skip(skip).limit(per_page))

                # Get offer names
                offer_ids_list = list(set(i.get('offer_id') for i in items if i.get('offer_id')))
                offer_names_map = {}
                if offers_col is not None and offer_ids_list:
                    offers_data = list(offers_col.find({'offer_id': {'$in': offer_ids_list}}, {'offer_id': 1, 'name': 1}))
                    for o in offers_data:
                        offer_names_map[o.get('offer_id')] = o.get('name', '')

                for item in items:
                    rows.append({
                        'id': str(item.get('_id', '')),
                        'offer_name': offer_names_map.get(item.get('offer_id', ''), item.get('offer_id', '')),
                        'offer_id': item.get('offer_id', ''),
                        'user_id': item.get('user_id', item.get('affiliate_id', '')),
                        'click_id': item.get('click_id', ''),
                        'payout': item.get('payout', item.get('revenue', 0)),
                        'status': 'reversed',
                        'reason': item.get('reversal_reason', item.get('rejection_reason', 'Admin reversed')),
                        'date': item.get('created_at').isoformat() + 'Z' if item.get('created_at') else None,
                    })

        elif tile == 'publisher_scorecard':
            query = {'role': 'publisher', 'account_status': 'approved'}
            if search:
                query['$or'] = [
                    {'username': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}}
                ]
            total = users_col.count_documents(query) if users_col is not None else 0
            items = list(users_col.find(query).sort('created_at', -1).skip(skip).limit(per_page)) if users_col is not None else []
            for item in items:
                rows.append({
                    'id': str(item.get('_id', '')),
                    'name': item.get('username', 'Unknown'),
                    'email': item.get('email', ''),
                    'status': item.get('account_status', ''),
                    'date': item.get('created_at').isoformat() + 'Z' if item.get('created_at') else None,
                })

        elif tile == 'pending_requests':
            query = {'role': 'publisher', 'account_status': {'$in': ['pending_approval', 'pending']}}
            if search:
                query['$or'] = [
                    {'username': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}}
                ]
            total = users_col.count_documents(query) if users_col is not None else 0
            items = list(users_col.find(query).sort('created_at', -1).skip(skip).limit(per_page)) if users_col is not None else []
            for item in items:
                rows.append({
                    'id': str(item.get('_id', '')),
                    'name': item.get('username', 'Unknown'),
                    'email': item.get('email', ''),
                    'date': item.get('created_at').isoformat() + 'Z' if item.get('created_at') else None,
                })

        elif tile == 'completions':
            query = {'completed_at': {'$gte': cutoff}}
            if search:
                query['user_id'] = {'$regex': search, '$options': 'i'}
            total = surveys_col.count_documents(query) if surveys_col is not None else 0
            items = list(surveys_col.find(query).sort('completed_at', -1).skip(skip).limit(per_page)) if surveys_col is not None else []

            # Look up publisher/placement info for these users from offerwall_impressions
            user_ids_list = list(set(item.get('user_id') for item in items if item.get('user_id')))
            user_placement_map = {}  # user_id -> {placement_id, publisher_name}
            if offerwall_impressions_col is not None and user_ids_list:
                for uid in user_ids_list:
                    imp = offerwall_impressions_col.find_one({'user_id': uid}, sort=[('timestamp', -1)])
                    if imp:
                        user_placement_map[uid] = imp.get('placement_id', '')

            # Get publisher names from placements
            placement_ids_found = list(set(v for v in user_placement_map.values() if v))
            pub_map = {}
            if placements_col is not None and placement_ids_found:
                p_data = list(placements_col.find({'placementIdentifier': {'$in': placement_ids_found}}, {'placementIdentifier': 1, 'publisherId': 1}))
                pub_ids = list(set(p.get('publisherId') for p in p_data if p.get('publisherId')))
                pnames = {}
                if users_col is not None and pub_ids:
                    pubs = list(users_col.find({'_id': {'$in': pub_ids}}, {'_id': 1, 'username': 1}))
                    for p in pubs:
                        pnames[str(p['_id'])] = p.get('username', 'Unknown')
                for pd in p_data:
                    pub_map[pd.get('placementIdentifier')] = pnames.get(str(pd.get('publisherId', '')), 'Unknown')

            for item in items:
                uid = item.get('user_id', '')
                placement_id = user_placement_map.get(uid, '')
                publisher_name = pub_map.get(placement_id, 'Unknown')

                # Build structured answers for expandable view
                answers = item.get('answers', [])
                structured_answers = []
                for a in answers:
                    q = a.get('question', a.get('question_text', a.get('question_id', '')))
                    ans = a.get('answer', a.get('selected', a.get('value', '')))
                    structured_answers.append({'question': q, 'answer': str(ans) if ans else '—'})

                rows.append({
                    'id': str(item.get('_id', '')),
                    'user_id': uid,
                    'publisher_name': publisher_name,
                    'placement_id': placement_id,
                    'questions_answered': len(answers),
                    'result': item.get('result', item.get('qualified', '')),
                    'time_spent': item.get('time_spent_seconds', 0),
                    'answers': structured_answers,  # For expandable row detail
                    'date': item.get('completed_at').isoformat() + 'Z' if item.get('completed_at') else
                            item.get('created_at').isoformat() + 'Z' if item.get('created_at') else None,
                })

        elif tile == 'answer_breakdown':
            # Per-question answer breakdown for PIE CHARTS
            # Returns chart_data: array of {question, data: [{answer, count, percentage}]}
            if surveys_col is not None:
                # Get all completed surveys in the window
                completed_surveys = list(surveys_col.find(
                    {'completed_at': {'$gte': cutoff}},
                    {'answers': 1}
                ))

                total_completions = len(completed_surveys)
                total = total_completions

                # Build per-question answer counts
                question_answers = {}  # {question: {answer: count}}
                for survey in completed_surveys:
                    answers = survey.get('answers', [])
                    for a in answers:
                        q = a.get('question', a.get('question_text', a.get('question_id', '')))
                        ans = a.get('answer', a.get('selected', a.get('value', '')))
                        if not q:
                            continue
                        # Handle list answers (multi-select)
                        if isinstance(ans, list):
                            for single_ans in ans:
                                question_answers.setdefault(q, {})
                                question_answers[q][str(single_ans)] = question_answers[q].get(str(single_ans), 0) + 1
                        else:
                            question_answers.setdefault(q, {})
                            question_answers[q][str(ans)] = question_answers[q].get(str(ans), 0) + 1

                # Build chart_data for each question (up to 10 questions)
                for q_name, answers_dict in list(question_answers.items())[:10]:
                    total_for_q = sum(answers_dict.values())
                    chart_entry = {
                        'question': q_name,
                        'total_responses': total_for_q,
                        'data': []
                    }
                    # Sort by count descending
                    for ans, count in sorted(answers_dict.items(), key=lambda x: x[1], reverse=True):
                        pct = round((count / total_for_q) * 100, 1) if total_for_q > 0 else 0
                        chart_entry['data'].append({
                            'name': ans or 'No answer',
                            'value': count,
                            'percentage': pct
                        })
                    chart_data.append(chart_entry)

                # No table rows needed for this tile — it's charts only
                rows = []

        else:
            # Generic fallback
            pass

        return jsonify({
            'success': True,
            'data': {
                'rows': rows,
                'total': total,
                'page': page,
                'per_page': per_page,
                'chart_data': chart_data,
            }
        }), 200

    except Exception as e:
        logger.error(f"❌ Error getting tile detail: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
