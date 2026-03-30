"""
Placement Approval Data API
Aggregates real publisher data for the placement approval expanded panel
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
from utils.auth import token_required, subadmin_or_admin_required
from database import db_instance
import logging

logger = logging.getLogger(__name__)
placement_approval_data_bp = Blueprint('placement_approval_data', __name__)


def safe_iso(val):
    """Safely convert datetime to ISO string"""
    if val and hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val) if val else ''


@placement_approval_data_bp.route('/placement-approval/publisher-data/<publisher_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('placement-approval')
def get_publisher_approval_data(publisher_id):
    """Get comprehensive publisher data for placement approval decision"""
    try:
        db = db_instance.get_db()
        if db is None:
            return jsonify({'error': 'Database not connected'}), 500

        # 1. Get publisher user profile
        try:
            publisher = db['users'].find_one({'_id': ObjectId(publisher_id)})
        except Exception:
            publisher = None
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404

        pub_email = publisher.get('email', '')
        pub_username = publisher.get('username', '')

        # 2. Login history — query by BOTH email and ObjectId user_id
        login_history = []
        try:
            query = {'$or': [
                {'email': pub_email},
                {'user_id': publisher_id},
                {'user_id': ObjectId(publisher_id)},
                {'username': pub_username},
            ]}
            logs = list(db['login_logs'].find(query).sort('login_time', -1).limit(20))
            for log in logs:
                # device field can be dict or None
                device = log.get('device') or log.get('device_info') or {}
                if isinstance(device, str):
                    device = {'raw': device}
                location = log.get('location') or {}
                vpn = log.get('vpn_detection') or log.get('vpn') or {}

                login_history.append({
                    'email': log.get('email', pub_email),
                    'ip': log.get('ip_address', ''),
                    'status': log.get('status', ''),
                    'date': safe_iso(log.get('login_time')),
                    'device': device,
                    'location': location,
                    'method': log.get('login_method', ''),
                    'userAgent': log.get('user_agent', ''),
                    'vpn': vpn if isinstance(vpn, dict) else {},
                    'fingerprint': log.get('device_fingerprint', log.get('fingerprint', '')),
                    'deviceChanged': log.get('device_change_detected', False),
                    'fraudScore': log.get('fraud_score', 0),
                    'sessionId': log.get('session_id', ''),
                    'isSignup': log.get('is_signup_attempt', False),
                })
        except Exception as e:
            logger.warning(f"Error fetching login logs: {e}")

        # 3. Click stats — check multiple collections with multiple ID formats
        click_stats = {'total': 0, 'last30d': 0, 'conversions': 0}
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        col_names = db.list_collection_names()

        # clicks collection — try affiliate_id and publisher_id
        if 'clicks' in col_names:
            try:
                cc = db['clicks']
                for field in ['publisher_id', 'affiliate_id', 'user_id']:
                    for val in [publisher_id, pub_email, pub_username]:
                        n = cc.count_documents({field: val})
                        if n > 0:
                            click_stats['total'] += n
                            click_stats['last30d'] += cc.count_documents({field: val, 'click_time': {'$gte': thirty_days_ago}})
                            break
                    if click_stats['total'] > 0:
                        break
            except Exception as e:
                logger.warning(f"clicks error: {e}")

        # offerwall_clicks_detailed
        if 'offerwall_clicks_detailed' in col_names:
            try:
                oc = db['offerwall_clicks_detailed']
                n = oc.count_documents({'publisher_id': publisher_id})
                click_stats['total'] += n
            except Exception:
                pass

        # dashboard_clicks
        if 'dashboard_clicks' in col_names:
            try:
                dc = db['dashboard_clicks']
                for field in ['user_id', 'user_email']:
                    for val in [publisher_id, pub_email]:
                        n = dc.count_documents({field: val})
                        if n > 0:
                            click_stats['total'] += n
                            break
                    if n > 0:
                        break
            except Exception:
                pass

        # Conversions
        for conv_col in ['conversions', 'offerwall_conversions_detailed']:
            if conv_col in col_names:
                try:
                    for field in ['publisher_id', 'affiliate_id', 'user_id']:
                        for val in [publisher_id, pub_email]:
                            n = db[conv_col].count_documents({field: val})
                            if n > 0:
                                click_stats['conversions'] += n
                                break
                        if click_stats['conversions'] > 0:
                            break
                except Exception:
                    pass

        # 4. VPN detection — check cache and also check login log vpn fields
        vpn_data = {}
        try:
            if 'vpn_detection_cache' in col_names:
                # Try latest IP from login history
                for log in login_history:
                    ip = log.get('ip', '')
                    if ip and ip != '127.0.0.1':
                        result = db['vpn_detection_cache'].find_one({'ip_address': ip})
                        if result:
                            vpn_data = {
                                'isVpn': result.get('is_vpn', False),
                                'isProxy': result.get('is_proxy', False),
                                'isTor': result.get('is_tor', False),
                                'isDatacenter': result.get('is_datacenter', False),
                                'provider': result.get('provider', ''),
                                'countryCode': result.get('country_code', ''),
                            }
                            break
            # Also check login log vpn fields
            if not vpn_data:
                for log in login_history:
                    v = log.get('vpn', {})
                    if v and (v.get('is_vpn') or v.get('is_proxy')):
                        vpn_data = {
                            'isVpn': v.get('is_vpn', False),
                            'isProxy': v.get('is_proxy', False),
                            'isTor': v.get('is_tor', False),
                            'isDatacenter': v.get('is_datacenter', False),
                            'provider': v.get('provider', ''),
                        }
                        break
        except Exception as e:
            logger.warning(f"VPN check error: {e}")

        # 5. Active sessions
        active_sessions = []
        try:
            for field in ['user_id', 'email']:
                for val in [publisher_id, pub_email]:
                    sessions = list(db['active_sessions'].find({field: val, 'is_active': True}).sort('last_activity', -1).limit(5))
                    if sessions:
                        for s in sessions:
                            active_sessions.append({
                                'sessionId': s.get('session_id', ''),
                                'loginTime': safe_iso(s.get('login_time')),
                                'lastActivity': safe_iso(s.get('last_activity')),
                                'ip': s.get('ip_address', ''),
                                'currentPage': s.get('current_page', ''),
                                'activityLevel': s.get('activity_level', ''),
                            })
                        break
                if active_sessions:
                    break
        except Exception as e:
            logger.warning(f"Sessions error: {e}")

        # 6. Fraud signals
        fraud_signals = []
        try:
            if 'offerwall_fraud_signals' in col_names:
                for field in ['publisher_id', 'user_id']:
                    signals = list(db['offerwall_fraud_signals'].find({field: publisher_id}).sort('timestamp', -1).limit(10))
                    if signals:
                        for sig in signals:
                            fraud_signals.append({
                                'type': sig.get('signal_type', sig.get('type', '')),
                                'severity': sig.get('severity', ''),
                                'details': str(sig.get('details', '')),
                                'date': safe_iso(sig.get('timestamp')),
                            })
                        break
            if 'fraud_signals' in col_names and not fraud_signals:
                for field in ['publisher_id', 'user_id', 'email']:
                    for val in [publisher_id, pub_email]:
                        signals = list(db['fraud_signals'].find({field: val}).sort('timestamp', -1).limit(10))
                        if signals:
                            for sig in signals:
                                fraud_signals.append({
                                    'type': sig.get('signal_type', sig.get('type', '')),
                                    'severity': sig.get('severity', ''),
                                    'details': str(sig.get('details', '')),
                                    'date': safe_iso(sig.get('timestamp', sig.get('created_at'))),
                                })
                            break
                    if fraud_signals:
                        break
        except Exception as e:
            logger.warning(f"Fraud signals error: {e}")

        # 7. Geo locations from login history
        geo_locations = []
        seen = set()
        for log in login_history:
            loc = log.get('location', {})
            city = loc.get('city', '')
            country = loc.get('country', '') or loc.get('country_code', '')
            if city == 'Unknown':
                city = ''
            if country == 'Unknown' or country == 'XX':
                country = ''
            key = f"{city}-{country}-{log.get('ip', '')}"
            if key not in seen and (city or country or log.get('ip')):
                seen.add(key)
                geo_locations.append({
                    'city': city, 'country': country, 'ip': log.get('ip', ''),
                    'lat': loc.get('latitude', loc.get('lat', 0)),
                    'lng': loc.get('longitude', loc.get('lon', loc.get('lng', 0))),
                    'date': log.get('date', ''),
                })

        # 8. Compute risk score
        risk_score = 0
        risk_flags = []
        risk_breakdown = []

        if vpn_data.get('isVpn') or vpn_data.get('isProxy'):
            risk_score += 25; risk_flags.append('VPN/PROXY DETECTED'); risk_breakdown.append({'label': 'VPN/Proxy IP', 'points': 25})
        if vpn_data.get('isTor'):
            risk_score += 35; risk_flags.append('TOR DETECTED'); risk_breakdown.append({'label': 'Tor network', 'points': 35})
        if vpn_data.get('isDatacenter'):
            risk_score += 20; risk_flags.append('DATACENTER IP'); risk_breakdown.append({'label': 'Datacenter IP', 'points': 20})

        device_changes = sum(1 for l in login_history if l.get('deviceChanged'))
        if device_changes > 0:
            pts = min(device_changes * 10, 25); risk_score += pts; risk_flags.append('DEVICE CHANGE'); risk_breakdown.append({'label': f'Device changes ({device_changes}x)', 'points': pts})

        created_at = publisher.get('created_at')
        age_days = (datetime.utcnow() - created_at).days if created_at else 999
        if age_days < 7:
            risk_score += 5; risk_flags.append('NEW USER'); risk_breakdown.append({'label': f'New user ({age_days} days)', 'points': 5})

        if not publisher.get('email_verified', False):
            risk_score += 10; risk_flags.append('EMAIL NOT VERIFIED'); risk_breakdown.append({'label': 'Email not verified', 'points': 10})

        failed_logins = sum(1 for l in login_history if l.get('status') == 'failed')
        if failed_logins >= 3:
            pts = min(failed_logins * 5, 20); risk_score += pts; risk_flags.append('FAILED LOGINS'); risk_breakdown.append({'label': f'Failed logins ({failed_logins}x)', 'points': pts})

        countries = set()
        for log in login_history:
            loc = log.get('location', {})
            c = loc.get('country_code', '') or loc.get('country', '')
            if c and c != 'Unknown' and c != 'XX':
                countries.add(c)
        if len(countries) > 2:
            risk_score += 15; risk_flags.append('GEO SWITCH'); risk_breakdown.append({'label': f'Multiple countries ({len(countries)})', 'points': 15})

        for sig in fraud_signals:
            if sig.get('severity') in ('high', 'critical'):
                risk_score += 15; risk_flags.append(sig.get('type', 'FRAUD').upper()); risk_breakdown.append({'label': sig.get('type', 'Fraud'), 'points': 15})

        risk_score = min(risk_score, 100)
        trust_score = max(0, 100 - risk_score)
        confidence = min(100, 50 + len(login_history) * 5 + (20 if vpn_data else 0))

        # 9. Build identity from latest login
        latest = login_history[0] if login_history else {}
        latest_dev = latest.get('device') or {}
        latest_loc = latest.get('location') or {}
        ua = latest.get('userAgent', '')

        # Parse user agent for device/browser if device dict is empty
        device_str = ''
        browser_str = ''
        if latest_dev:
            device_str = f"{latest_dev.get('os', '')} / {latest_dev.get('browser', '')}".strip(' /')
            browser_str = latest_dev.get('browser', '')
        if not device_str and ua:
            # Simple UA parsing
            if 'Windows' in ua: device_str = 'Windows'
            elif 'Mac' in ua: device_str = 'macOS'
            elif 'Linux' in ua: device_str = 'Linux'
            elif 'Android' in ua: device_str = 'Android'
            elif 'iPhone' in ua: device_str = 'iOS'
            if 'Chrome' in ua: browser_str = 'Chrome'; device_str += ' / Chrome'
            elif 'Firefox' in ua: browser_str = 'Firefox'; device_str += ' / Firefox'
            elif 'Safari' in ua: browser_str = 'Safari'; device_str += ' / Safari'

        ip_country = latest_loc.get('country_code', latest_loc.get('country', ''))
        if ip_country in ('Unknown', 'XX', ''):
            ip_country = 'N/A'

        return jsonify({
            'publisher': {
                'publisherId': publisher_id,
                'username': publisher.get('username', ''),
                'email': pub_email,
                'firstName': publisher.get('first_name', publisher.get('firstName', '')),
                'lastName': publisher.get('last_name', publisher.get('lastName', '')),
                'companyName': publisher.get('company_name', publisher.get('companyName', '')),
                'website': publisher.get('website', ''),
                'emailVerified': publisher.get('email_verified', False),
                'accountStatus': publisher.get('account_status', publisher.get('status', '')),
                'createdAt': safe_iso(publisher.get('created_at')),
                'lastLogin': safe_iso(publisher.get('lastLogin')),
                'postbackUrl': publisher.get('postback_url', publisher.get('postbackUrl', '')),
                'postbackTested': publisher.get('postback_tested', False),
            },
            'risk': {
                'score': risk_score, 'trustScore': trust_score, 'confidence': confidence,
                'level': 'HIGH' if risk_score >= 70 else 'WARNING' if risk_score >= 40 else 'LOW',
                'flags': risk_flags, 'breakdown': risk_breakdown,
            },
            'identity': {
                'ip': latest.get('ip', 'N/A'),
                'ipType': 'VPN/Datacenter' if vpn_data.get('isVpn') or vpn_data.get('isDatacenter') else 'Residential',
                'isp': latest_loc.get('isp', vpn_data.get('provider', 'N/A')),
                'device': device_str or 'N/A',
                'browser': browser_str or 'N/A',
                'screenRes': latest_dev.get('screen_resolution', 'N/A'),
                'declaredCountry': publisher.get('country', ip_country),
                'ipCountry': ip_country,
                'browserTz': latest_dev.get('timezone', 'N/A'),
                'fingerprint': latest.get('fingerprint', 'N/A'),
                'userAgent': ua,
            },
            'vpn': vpn_data,
            'loginHistory': login_history[:10],
            'geoLocations': geo_locations,
            'clickStats': click_stats,
            'activeSessions': active_sessions,
            'fraudSignals': fraud_signals,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching publisher approval data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
