from flask import Blueprint, request, jsonify
from services.access_control_service import AccessControlService
from services.email_service import get_email_service
from models.offer import Offer
from models.user import User
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from database import db_instance
import logging
from datetime import datetime, timedelta

admin_offer_requests_bp = Blueprint('admin_offer_requests', __name__)
access_service = AccessControlService()
offer_model = Offer()


@admin_offer_requests_bp.route('/offer-access-requests/publisher-profiles', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_publisher_profiles_with_requests():
    """Get publisher profiles grouped with their offer access requests and stats"""
    try:
        from bson import ObjectId
        
        status = request.args.get('status', 'pending')
        risk_filter = request.args.get('risk', 'all')
        search = request.args.get('search', '')
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        requests_collection = db_instance.get_collection('affiliate_requests')
        users_collection = db_instance.get_collection('users')
        offers_collection = db_instance.get_collection('offers')
        
        # Build request query
        req_query = {}
        if status != 'all':
            req_query['status'] = status
        
        # Get all matching requests
        all_requests = list(requests_collection.find(req_query).sort('requested_at', -1))
        
        # Group by user_id (convert ObjectId to string for consistent keys)
        user_requests_map = {}
        for req in all_requests:
            uid_raw = req.get('user_id')
            uid = str(uid_raw) if uid_raw else None
            if not uid:
                continue
            if uid not in user_requests_map:
                user_requests_map[uid] = []
            user_requests_map[uid].append(req)
        
        user_ids = list(user_requests_map.keys())
        
        # Batch fetch all users
        users_data = {}
        if user_ids:
            obj_ids = []
            for uid in user_ids:
                try:
                    obj_ids.append(ObjectId(uid))
                except:
                    pass
            if obj_ids:
                for u in users_collection.find({'_id': {'$in': obj_ids}}):
                    users_data[str(u['_id'])] = u
        
        # For users not found in DB, build from request data
        for uid in user_ids:
            if uid not in users_data:
                # Use embedded data from the first request
                first_req = user_requests_map[uid][0]
                users_data[uid] = {
                    '_id': uid,
                    'username': first_req.get('username', 'Unknown'),
                    'email': first_req.get('email', ''),
                    'first_name': '',
                    'last_name': '',
                    'company_name': '',
                    'website': '',
                    'created_at': first_req.get('created_at', datetime.utcnow()),
                    'account_status': 'pending_approval',
                    'postback_url': '',
                    'postback_tested': False,
                }
        
        # Apply search filter
        if search:
            sl = search.lower()
            user_ids = [uid for uid in user_ids if uid in users_data and (sl in users_data[uid].get('username', '').lower() or sl in users_data[uid].get('email', '').lower())]
        
        # Cache offers
        offer_ids_needed = set()
        for uid in user_ids:
            for req in user_requests_map.get(uid, []):
                offer_ids_needed.add(req.get('offer_id'))
        
        offer_cache = {}
        if offer_ids_needed:
            for o in offers_collection.find({'offer_id': {'$in': list(offer_ids_needed)}}):
                offer_cache[o['offer_id']] = o
        
        # Build profiles (NO per-request click/conversion queries - those load on expand)
        publisher_profiles = []
        for uid in user_ids:
            user = users_data.get(uid)
            if not user:
                continue
            user_reqs = user_requests_map.get(uid, [])
            if not user_reqs:
                continue
            
            postback_url = user.get('postback_url', '')
            postback_tested = user.get('postback_tested', False)
            account_age_days = (datetime.utcnow() - user.get('created_at', datetime.utcnow())).days
            risk_level = 'new' if account_age_days < 7 else 'none'
            
            if risk_filter != 'all' and risk_level != risk_filter:
                continue
            
            latest_request = user_reqs[0]
            latest_offer = offer_cache.get(latest_request.get('offer_id'))
            
            enriched_requests = []
            for req in user_reqs:
                offer = offer_cache.get(req.get('offer_id'))
                enriched_requests.append({
                    '_id': str(req['_id']),
                    'request_id': req.get('request_id', str(req['_id'])),
                    'offer_id': req.get('offer_id'),
                    'offer_name': offer.get('name') if offer else 'Unknown',
                    'offer_payout': offer.get('payout', 0) if offer else 0,
                    'offer_network': offer.get('network', '') if offer else '',
                    'status': req.get('status'),
                    'requested_at': req.get('requested_at'),
                    'message': req.get('message', ''),
                    'clicks': 0, 'conversions': 0, 'conv_rate': 0, 'last_conversion': None
                })
            
            profile = {
                'user_id': uid,
                'username': user.get('username', 'Unknown'),
                'email': user.get('email', ''),
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', ''),
                'company_name': user.get('company_name', ''),
                'website': user.get('website', ''),
                'created_at': user.get('created_at'),
                'account_status': user.get('account_status', 'pending_approval'),
                'risk_level': risk_level,
                'fraud_score': 0,
                'total_clicks': 0, 'total_conversions': 0, 'conversion_rate': 0,
                'postback_url': postback_url,
                'postback_tested': postback_tested,
                'postback_status': 'tested' if postback_tested else ('configured' if postback_url else 'none'),
                'has_proofs': False,
                'requests': enriched_requests,
                'pending_count': len([r for r in enriched_requests if r['status'] == 'pending']),
                'latest_offer_name': latest_offer.get('name') if latest_offer else 'Unknown',
                'latest_offer_id': latest_request.get('offer_id')
            }
            publisher_profiles.append(profile)
        
        publisher_profiles.sort(key=lambda x: -x['pending_count'])
        
        total = len(publisher_profiles)
        start_idx = (page - 1) * per_page
        paginated_profiles = publisher_profiles[start_idx:start_idx + per_page]
        
        return safe_json_response({
            'profiles': paginated_profiles,
            'pagination': { 'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page) },
            'summary': {
                'total_publishers': total,
                'high_risk': len([p for p in publisher_profiles if p['risk_level'] == 'high_risk']),
                'warn': len([p for p in publisher_profiles if p['risk_level'] == 'warn']),
                'new': len([p for p in publisher_profiles if p['risk_level'] == 'new']),
                'none': len([p for p in publisher_profiles if p['risk_level'] == 'none'])
            }
        })
        
    except Exception as e:
        logging.error(f"Get publisher profiles error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get publisher profiles: {str(e)}'}), 500


@admin_offer_requests_bp.route('/offer-access-requests/inventory-matches', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_inventory_matches():
    """Get similar offers based on keywords from requested offer names"""
    try:
        offer_name = request.args.get('offer_name', '')
        user_id = request.args.get('user_id', '')
        limit = min(int(request.args.get('limit', 15)), 50)
        
        if not offer_name:
            return jsonify({'error': 'offer_name is required'}), 400
        
        offers_collection = db_instance.get_collection('offers')
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Extract keywords from offer name (remove common words)
        import re
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', '&', '-', '+', 'all', 'geos', 'global', 'incent', 'allowed'}
        keywords = [w.lower() for w in offer_name.split() if w.lower() not in stop_words and len(w) > 2]
        
        # Build regex pattern for matching - escape special regex chars
        if not keywords:
            keywords = [offer_name.lower()]
        
        # Escape regex special characters in each keyword
        safe_keywords = [re.escape(kw) for kw in keywords]
        
        # Find similar offers using regex on name
        regex_patterns = [{'name': {'$regex': kw, '$options': 'i'}} for kw in safe_keywords]
        
        similar_offers = list(offers_collection.find(
            {
                '$or': regex_patterns,
                'status': {'$in': ['active', 'Active', None]},  # Only active offers
            },
            {
                'offer_id': 1,
                'name': 1,
                'payout': 1,
                'network': 1,
                'category': 1,
                'device_targeting': 1,
                'approval_status': 1,
            }
        ).limit(limit))
        
        # Get user's existing requests to mark which ones are already requested
        user_requests = {}
        if user_id:
            from bson import ObjectId as OId
            uid_query = {'$or': [{'user_id': user_id}]}
            try:
                uid_query['$or'].append({'user_id': OId(user_id)})
            except:
                pass
            user_reqs = list(requests_collection.find(uid_query))
            for req in user_reqs:
                user_requests[req.get('offer_id')] = req.get('status')
        
        # Calculate match strength based on keyword matches
        results = []
        for offer in similar_offers:
            offer_name_lower = offer.get('name', '').lower()
            match_count = sum(1 for kw in keywords if kw in offer_name_lower)
            match_strength = 'Strong' if match_count >= 2 else 'Good'
            
            results.append({
                '_id': str(offer['_id']),
                'offer_id': offer.get('offer_id'),
                'name': offer.get('name'),
                'payout': offer.get('payout', 0),
                'network': offer.get('network', ''),
                'category': offer.get('category', ''),
                'keywords': ', '.join(keywords[:3]),
                'match_strength': match_strength,
                'request_status': user_requests.get(offer.get('offer_id')),  # None, 'pending', 'approved', 'rejected'
            })
        
        # Sort by match strength (Strong first) then by payout
        results.sort(key=lambda x: (0 if x['match_strength'] == 'Strong' else 1, -x['payout']))
        
        return safe_json_response({
            'matches': results,
            'keywords': keywords,
            'total': len(results)
        })
        
    except Exception as e:
        logging.error(f"Get inventory matches error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get inventory matches: {str(e)}'}), 500


@admin_offer_requests_bp.route('/offer-access-requests/mark-review', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def mark_requests_for_review():
    """Mark one or more access requests for review"""
    try:
        data = request.get_json() or {}
        request_ids = data.get('request_ids', [])
        user = request.current_user

        if not request_ids:
            return jsonify({'error': 'No request IDs provided'}), 400

        requests_collection = db_instance.get_collection('affiliate_requests')
        updated = 0
        for rid in request_ids:
            result = requests_collection.update_one(
                {'$or': [{'request_id': rid}, {'_id': rid}]},
                {'$set': {
                    'status': 'review',
                    'marked_for_review_by': str(user['_id']),
                    'marked_for_review_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }}
            )
            if result.modified_count > 0:
                updated += 1

        return jsonify({'message': f'{updated} request(s) marked for review', 'updated': updated})

    except Exception as e:
        logging.error(f"Mark for review error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/send-offers', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def send_offers_to_publisher():
    """Send selected offers to one or multiple publishers via email, support, or notification"""
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        # Support both single user_id and multiple user_ids
        user_ids = data.get('user_ids', [])
        if not user_ids and data.get('user_id'):
            user_ids = [data.get('user_id')]
        custom_emails = data.get('custom_emails', [])  # Additional custom email addresses
        offer_ids = data.get('offer_ids', [])
        send_via = data.get('send_via', 'email')
        custom_message = data.get('custom_message', '')
        message_body = data.get('message_body', '')  # Full editable message body
        subject = data.get('subject', '')
        template_type = data.get('template_type', 'recommend')  # recommend or approval

        if (not user_ids and not custom_emails) or (not offer_ids and not message_body):
            return jsonify({'error': 'At least one recipient and either offer_ids or message_body are required'}), 400

        users_collection = db_instance.get_collection('users')
        offers_collection = db_instance.get_collection('offers')

        # Get offers
        offers = list(offers_collection.find({'offer_id': {'$in': offer_ids}}))
        offer_list = [{'name': o.get('name'), 'payout': o.get('payout', 0), 'network': o.get('network', ''), 'offer_id': o.get('offer_id')} for o in offers]

        if not offer_list and not message_body:
            return jsonify({'error': 'No valid offers found and no message body provided'}), 400

        # Resolve users
        users = []
        for uid in user_ids:
            try:
                u = users_collection.find_one({'_id': ObjectId(uid)})
                if u:
                    users.append(u)
            except:
                pass

        results = {'sent': 0, 'failed': 0, 'errors': []}
        offer_lines = [f"• {o['name']} — ${o['payout']}" for o in offer_list]

        # Build email subject
        email_subject = subject or ('Recommended Offers for You - Moustache Leads' if template_type == 'recommend' else 'Your Offer Access Update - Moustache Leads')

        def build_body(username):
            if message_body:
                return message_body
            return f"""Hi {username},

We've found the following offers that match what you're looking for:

{chr(10).join(offer_lines)}

{custom_message or 'To get started, log in to your publisher dashboard and apply for any of the above offers. Our team is happy to help you set up.'}

Best regards,
Publisher Support Team
Moustache Leads"""

        # Send to each user
        for user in users:
            username = user.get('username', 'Publisher')
            body = build_body(username)

            if send_via == 'email':
                try:
                    import threading
                    email_service = get_email_service()
                    body = build_body(username)
                    html_body = body.replace('\n', '<br>')
                    html_content = f"""<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
                    <div style="max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#10b981;">Moustache Leads</h2>
                    <div>{html_body}</div>
                    </div></body></html>"""
                    
                    recipient = user.get('email')
                    logging.info(f"📧 Sending offer recommendation email to {recipient}")
                    
                    def send_bg():
                        try:
                            ok = email_service._send_email(recipient, email_subject, html_content)
                            logging.info(f"📧 Email send result for {recipient}: {ok}")
                        except Exception as ex:
                            logging.error(f"❌ Background email error for {recipient}: {ex}")
                    
                    thread = threading.Thread(target=send_bg, daemon=False)
                    thread.start()
                    results['sent'] += 1
                except Exception as e:
                    logging.error(f"❌ Email setup error for {username}: {str(e)}")
                    results['failed'] += 1
                    results['errors'].append(f"{username}: {str(e)}")

            elif send_via == 'support':
                try:
                    from bson import ObjectId as ObjId
                    support_collection = db_instance.get_collection('support_messages')
                    # Match the existing support message schema
                    support_collection.insert_one({
                        'user_id': ObjId(str(user['_id'])),
                        'username': user.get('username', ''),
                        'email': user.get('email', ''),
                        'subject': 'Recommended Offers for You',
                        'body': 'You have new offer recommendations from the admin team.',
                        'image_url': None,
                        'status': 'replied',
                        'replies': [{
                            'reply': body,
                            'replied_by': 'admin',
                            'admin_id': str(request.current_user['_id']),
                            'admin_username': request.current_user.get('username', 'Admin'),
                            'created_at': datetime.utcnow(),
                        }],
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'read_by_admin': True,
                        'read_by_user': False,
                    })
                    results['sent'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"{username}: {str(e)}")

            elif send_via == 'notification':
                try:
                    from bson import ObjectId as ObjId
                    notifications_collection = db_instance.get_collection('notifications')
                    title = f'{len(offer_list)} Recommended Offers' if template_type == 'recommend' else 'Offer Access Update'
                    notifications_collection.insert_one({
                        'user_id': str(user['_id']),
                        'type': 'offer_recommendation',
                        'title': title,
                        'message': f"We found {len(offer_list)} offers matching your interests. Check your dashboard!",
                        'offer_ids': offer_ids,
                        'custom_message': custom_message,
                        'created_at': datetime.utcnow(),
                        'read': False
                    })
                    results['sent'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"{username}: {str(e)}")

        # Send to custom emails
        if custom_emails and send_via == 'email':
            import threading
            email_service = get_email_service()
            for email_addr in custom_emails:
                try:
                    body = build_body('Publisher')
                    html_body = body.replace('\n', '<br>')
                    html_content = f"""<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
                    <div style="max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#10b981;">Moustache Leads</h2>
                    <div>{html_body}</div>
                    </div></body></html>"""
                    addr = email_addr.strip()
                    logging.info(f"📧 Sending offer email to custom address: {addr}")
                    def send_bg_custom(a=addr, h=html_content):
                        try:
                            ok = email_service._send_email(a, email_subject, h)
                            logging.info(f"📧 Custom email result for {a}: {ok}")
                        except Exception as ex:
                            logging.error(f"❌ Custom email error for {a}: {ex}")
                    thread = threading.Thread(target=send_bg_custom, daemon=False)
                    thread.start()
                    results['sent'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"{email_addr}: {str(e)}")

        return jsonify({
            'success': results['sent'] > 0,
            'message': f"Sent to {results['sent']} recipient(s)" + (f", {results['failed']} failed" if results['failed'] else ''),
            'results': results
        })

    except Exception as e:
        logging.error(f"Send offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to send offers: {str(e)}'}), 500


@admin_offer_requests_bp.route('/offer-access-requests/publisher/<user_id>/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_publisher_detailed_stats(user_id):
    """Get detailed stats for a specific publisher including chart data"""
    try:
        from bson import ObjectId
        
        users_collection = db_instance.get_collection('users')
        clicks_collection = db_instance.get_collection('clicks')
        conversions_collection = db_instance.get_collection('conversions')
        placements_collection = db_instance.get_collection('placements')
        
        # Get user
        try:
            user = users_collection.find_one({'_id': ObjectId(user_id)})
        except:
            user = None
        
        # If user not found in DB, return empty stats (user may have been deleted)
        if not user:
            return safe_json_response({
                'user_id': user_id,
                'username': 'Unknown',
                'daily_stats': [],
                'traffic_sources': [],
                'totals': { 'clicks': 0, 'conversions': 0, 'conversion_rate': 0, 'earnings': 0, 'epc': 0 }
            })
        
        # Get date range (last 30 days)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        # Get daily stats for chart
        daily_stats = []
        current_date = start_date
        while current_date <= end_date:
            next_date = current_date + timedelta(days=1)
            
            day_clicks = clicks_collection.count_documents({
                'publisher_id': user_id,
                'created_at': {'$gte': current_date, '$lt': next_date}
            })
            day_conversions = conversions_collection.count_documents({
                'publisher_id': user_id,
                'created_at': {'$gte': current_date, '$lt': next_date}
            })
            
            daily_stats.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'clicks': day_clicks,
                'conversions': day_conversions
            })
            
            current_date = next_date
        
        # Get traffic sources breakdown
        traffic_sources = []
        placements = list(placements_collection.find({'user_id': user_id}))
        for placement in placements:
            placement_clicks = clicks_collection.count_documents({
                'publisher_id': user_id,
                'placement_id': str(placement['_id'])
            })
            placement_conversions = conversions_collection.count_documents({
                'publisher_id': user_id,
                'placement_id': str(placement['_id'])
            })
            
            if placement_clicks > 0 or placement_conversions > 0:
                traffic_sources.append({
                    'name': placement.get('name', 'Unknown'),
                    'type': placement.get('traffic_source', 'unknown'),
                    'clicks': placement_clicks,
                    'conversions': placement_conversions,
                    'conv_rate': round((placement_conversions / placement_clicks * 100), 2) if placement_clicks > 0 else 0
                })
        
        # Calculate totals
        total_clicks = clicks_collection.count_documents({'publisher_id': user_id})
        total_conversions = conversions_collection.count_documents({'publisher_id': user_id})
        
        # Calculate EPC (earnings per click) - simplified
        total_earnings = 0
        for conv in conversions_collection.find({'publisher_id': user_id}):
            total_earnings += conv.get('payout', 0)
        
        epc = round(total_earnings / total_clicks, 2) if total_clicks > 0 else 0
        
        return safe_json_response({
            'user_id': user_id,
            'username': user.get('username'),
            'daily_stats': daily_stats,
            'traffic_sources': traffic_sources,
            'totals': {
                'clicks': total_clicks,
                'conversions': total_conversions,
                'conversion_rate': round((total_conversions / total_clicks * 100), 2) if total_clicks > 0 else 0,
                'earnings': round(total_earnings, 2),
                'epc': epc
            }
        })
        
    except Exception as e:
        logging.error(f"Get publisher stats error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get publisher stats: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_all_access_requests():
    """Get all offer access requests with advanced filtering"""
    try:
        from datetime import datetime as dt
        from bson import ObjectId

        # Get query parameters
        status = request.args.get('status', 'all')
        offer_id = request.args.get('offer_id', '')
        offer_name_filter = request.args.get('offer_name', '')
        user_id = request.args.get('user_id', '')
        user_name_filter = request.args.get('user_name', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        category = request.args.get('category', '')
        device = request.args.get('device', '')
        search = request.args.get('search', '')
        has_proof = request.args.get('has_proof', '')
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 20)), 100)

        requests_collection = db_instance.get_collection('affiliate_requests')
        offers_collection = db_instance.get_collection('offers')
        users_collection = db_instance.get_collection('users')
        proofs_collection = db_instance.get_collection('placement_proofs')

        # --- Resolve offer_ids that match name/category/device filters up front ---
        offer_filter_active = bool(offer_name_filter or category or (device and device != 'all'))
        matching_offer_ids = None
        if offer_filter_active:
            offer_query = {}
            if offer_name_filter:
                offer_query['name'] = {'$regex': offer_name_filter, '$options': 'i'}
            if category:
                offer_query['category'] = category
            if device and device != 'all':
                offer_query['device_targeting'] = device
            matching_offer_ids = [
                o['offer_id'] for o in offers_collection.find(offer_query, {'offer_id': 1})
            ]

        # --- Resolve user_ids that match user_name filter up front ---
        user_filter_active = bool(user_name_filter)
        matching_user_ids = None
        if user_filter_active:
            matching_users = list(users_collection.find(
                {'username': {'$regex': user_name_filter, '$options': 'i'}},
                {'_id': 1}
            ))
            matching_user_ids = [str(u['_id']) for u in matching_users]

        # --- Build main MongoDB query ---
        query = {}

        if status != 'all':
            query['status'] = status

        if offer_id:
            query['offer_id'] = {'$regex': offer_id, '$options': 'i'}

        if user_id:
            query['user_id'] = user_id

        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query['$gte'] = dt.fromisoformat(date_from)
            if date_to:
                date_to_dt = dt.fromisoformat(date_to)
                date_query['$lte'] = date_to_dt.replace(hour=23, minute=59, second=59)
            query['requested_at'] = date_query

        if search:
            query['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}}
            ]

        if matching_offer_ids is not None:
            query['offer_id'] = {'$in': matching_offer_ids}

        if matching_user_ids is not None:
            query['user_id'] = {'$in': matching_user_ids}

        # --- Handle has_proof filter: resolve offer_ids with proofs per user ---
        # This is done after main query if needed (post-fetch), but we fetch ALL matching
        # first then paginate — only when has_proof filter is active do we need all records.
        # For normal cases, paginate at DB level.

        if has_proof:
            # Fetch all matching (no skip/limit) then filter by proof, then paginate in Python
            all_reqs = list(requests_collection.find(query).sort('requested_at', -1))

            # Enrich and filter by proof
            enriched = []
            for req in all_reqs:
                req['_id'] = str(req['_id'])
                proof = proofs_collection.find_one({'user_id': req['user_id'], 'offer_id': req['offer_id']})
                req['has_placement_proof'] = proof is not None
                if proof:
                    req['proof_status'] = proof.get('status', 'pending')
                if has_proof == 'yes' and not req['has_placement_proof']:
                    continue
                if has_proof == 'no' and req['has_placement_proof']:
                    continue
                enriched.append(req)

            total = len(enriched)
            skip = (page - 1) * per_page
            page_reqs = enriched[skip: skip + per_page]
        else:
            # Paginate at DB level — correct and fast
            total = requests_collection.count_documents(query)
            skip = (page - 1) * per_page
            page_reqs = list(requests_collection.find(query)
                             .sort('requested_at', -1)
                             .skip(skip)
                             .limit(per_page))
            for req in page_reqs:
                req['_id'] = str(req['_id'])
                proof = proofs_collection.find_one({'user_id': req['user_id'], 'offer_id': req['offer_id']})
                req['has_placement_proof'] = proof is not None
                if proof:
                    req['proof_status'] = proof.get('status', 'pending')

        # --- Enrich with offer and user details ---
        offer_cache = {}
        user_cache = {}

        for req in page_reqs:
            oid = req.get('offer_id')
            if oid not in offer_cache:
                offer_cache[oid] = offers_collection.find_one({'offer_id': oid})
            offer = offer_cache[oid]
            if offer:
                req['offer_details'] = {
                    'name': offer.get('name'),
                    'payout': offer.get('payout'),
                    'network': offer.get('network'),
                    'category': offer.get('category', ''),
                    'device_targeting': offer.get('device_targeting', 'all'),
                    'approval_settings': offer.get('approval_settings', {})
                }

            uid = req.get('user_id')
            if uid not in user_cache:
                try:
                    user_cache[uid] = users_collection.find_one({'_id': ObjectId(uid)})
                except Exception:
                    user_cache[uid] = users_collection.find_one({'_id': uid})
            user = user_cache[uid]
            if user:
                req['user_details'] = {
                    'username': user.get('username'),
                    'email': user.get('email'),
                    'account_type': user.get('account_type', 'basic')
                }

        pages = max(1, (total + per_page - 1) // per_page)

        return safe_json_response({
            'requests': page_reqs,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': pages
            }
        })

    except Exception as e:
        logging.error(f"Get access requests error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get access requests: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/approve', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def approve_access_request(request_id):
    """Approve an access request"""
    try:
        from bson import ObjectId
        
        data = request.get_json() or {}
        notes = data.get('notes', '')
        user = request.current_user
        
        # Get the request to find offer_id
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Try to find by request_id first, then by _id (ObjectId)
        access_request = requests_collection.find_one({'request_id': request_id})
        if not access_request:
            try:
                access_request = requests_collection.find_one({'_id': ObjectId(request_id)})
            except:
                pass
        
        if not access_request:
            return jsonify({'error': 'Access request not found'}), 404
        
        # Approve the request using the correct request_id from database
        actual_request_id = access_request.get('request_id') or str(access_request['_id'])
        result = access_service.approve_access_request_by_id(
            actual_request_id, 
            access_request['offer_id']
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Update with admin details using the correct request_id
        requests_collection.update_one(
            {'_id': access_request['_id']},
            {
                '$set': {
                    'approved_by': str(user['_id']),
                    'approved_by_username': user.get('username'),
                    'approval_notes': notes,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Send approval email notification
        try:
            logging.info(f"📧 Preparing to send approval email for request {request_id}")
            
            # Get publisher email - use user_id field (not publisher_id)
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'_id': access_request.get('user_id')})
            
            logging.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get offer name
                offers_collection = db_instance.get_collection('offers')
                offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                
                logging.info(f"📧 Offer found: {offer_name}")
                logging.info(f"📧 Sending approval email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=offer_name,
                    status='approved',
                    reason='',
                    offer_id=str(access_request.get('offer_id', ''))
                )
                logging.info(f"✅ Approval email sent to {publisher['email']} for offer {offer_name}")
            else:
                logging.warning(f"⚠️ Publisher not found or no email: {access_request.get('user_id')}")
        except Exception as e:
            logging.error(f"❌ Failed to send approval email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Access request approved successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Approve access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve request: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/<request_id>/reject', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def reject_access_request(request_id):
    """Reject an access request"""
    try:
        from bson import ObjectId
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        user = request.current_user
        
        # Get the request to find offer_id
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Try to find by request_id first, then by _id (ObjectId)
        access_request = requests_collection.find_one({'request_id': request_id})
        if not access_request:
            try:
                access_request = requests_collection.find_one({'_id': ObjectId(request_id)})
            except:
                pass
        
        if not access_request:
            return jsonify({'error': 'Access request not found'}), 404
        
        # Reject the request using the correct request_id from database
        actual_request_id = access_request.get('request_id') or str(access_request['_id'])
        result = access_service.reject_access_request_by_id(
            actual_request_id,
            access_request['offer_id'],
            reason
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Update with admin details using the correct _id
        requests_collection.update_one(
            {'_id': access_request['_id']},
            {
                '$set': {
                    'rejected_by': str(user['_id']),
                    'rejected_by_username': user.get('username'),
                    'rejection_reason': reason,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Send rejection email notification
        try:
            logging.info(f"📧 Preparing to send rejection email for request {request_id}")
            
            # Get publisher email - use user_id field (not publisher_id)
            users_collection = db_instance.get_collection('users')
            publisher = users_collection.find_one({'_id': access_request.get('user_id')})
            
            logging.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get offer name
                offers_collection = db_instance.get_collection('offers')
                offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                
                logging.info(f"📧 Offer found: {offer_name}")
                logging.info(f"📧 Sending rejection email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=offer_name,
                    status='rejected',
                    reason=reason,
                    offer_id=str(access_request.get('offer_id', ''))
                )
                logging.info(f"✅ Rejection email sent to {publisher['email']} for offer {offer_name}")
            else:
                logging.warning(f"⚠️ Publisher not found or no email: {access_request.get('user_id')}")
        except Exception as e:
            logging.error(f"❌ Failed to send rejection email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Access request rejected successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Reject access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject request: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offer-access-requests/bulk-approve', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def bulk_approve_access_requests():
    """Bulk approve multiple access requests"""
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        request_ids = data.get('request_ids', [])
        notes = data.get('notes', '')
        user = request.current_user

        if not request_ids:
            return jsonify({'error': 'No request IDs provided'}), 400

        requests_collection = db_instance.get_collection('affiliate_requests')
        results = {'approved': 0, 'failed': 0, 'errors': []}

        for rid in request_ids:
            try:
                access_request = requests_collection.find_one({'request_id': rid})
                if not access_request:
                    try:
                        access_request = requests_collection.find_one({'_id': ObjectId(rid)})
                    except:
                        pass

                if not access_request:
                    results['failed'] += 1
                    results['errors'].append(f'{rid}: Not found')
                    continue

                actual_request_id = access_request.get('request_id') or str(access_request['_id'])
                result = access_service.approve_access_request_by_id(
                    actual_request_id,
                    access_request['offer_id']
                )

                if 'error' in result:
                    results['failed'] += 1
                    results['errors'].append(f'{rid}: {result["error"]}')
                    continue

                requests_collection.update_one(
                    {'_id': access_request['_id']},
                    {'$set': {
                        'approved_by': str(user['_id']),
                        'approved_by_username': user.get('username'),
                        'approval_notes': notes,
                        'updated_at': datetime.utcnow()
                    }}
                )
                results['approved'] += 1

                # Send email notification
                try:
                    users_collection = db_instance.get_collection('users')
                    publisher = users_collection.find_one({'_id': access_request.get('user_id')})
                    if publisher and publisher.get('email'):
                        offers_collection = db_instance.get_collection('offers')
                        offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                        offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                        email_service = get_email_service()
                        email_service.send_approval_notification_async(
                            recipient_email=publisher['email'],
                            offer_name=offer_name,
                            status='approved',
                            reason='',
                            offer_id=str(access_request.get('offer_id', ''))
                        )
                except Exception:
                    pass

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f'{rid}: {str(e)}')

        return jsonify({
            'message': f'Bulk approval complete: {results["approved"]} approved, {results["failed"]} failed',
            'results': results
        })

    except Exception as e:
        logging.error(f"Bulk approve error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Bulk approve failed: {str(e)}'}), 500


@admin_offer_requests_bp.route('/offer-access-requests/bulk-reject', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def bulk_reject_access_requests():
    """Bulk reject multiple access requests"""
    try:
        from bson import ObjectId

        data = request.get_json() or {}
        request_ids = data.get('request_ids', [])
        reason = data.get('reason', 'Bulk rejection')
        user = request.current_user

        if not request_ids:
            return jsonify({'error': 'No request IDs provided'}), 400

        requests_collection = db_instance.get_collection('affiliate_requests')
        results = {'rejected': 0, 'failed': 0, 'errors': []}

        for rid in request_ids:
            try:
                access_request = requests_collection.find_one({'request_id': rid})
                if not access_request:
                    try:
                        access_request = requests_collection.find_one({'_id': ObjectId(rid)})
                    except:
                        pass

                if not access_request:
                    results['failed'] += 1
                    results['errors'].append(f'{rid}: Not found')
                    continue

                actual_request_id = access_request.get('request_id') or str(access_request['_id'])
                result = access_service.reject_access_request_by_id(
                    actual_request_id,
                    access_request['offer_id'],
                    reason
                )

                if 'error' in result:
                    results['failed'] += 1
                    results['errors'].append(f'{rid}: {result["error"]}')
                    continue

                requests_collection.update_one(
                    {'_id': access_request['_id']},
                    {'$set': {
                        'rejected_by': str(user['_id']),
                        'rejected_by_username': user.get('username'),
                        'rejection_reason': reason,
                        'updated_at': datetime.utcnow()
                    }}
                )
                results['rejected'] += 1

                # Send email notification
                try:
                    users_collection = db_instance.get_collection('users')
                    publisher = users_collection.find_one({'_id': access_request.get('user_id')})
                    if publisher and publisher.get('email'):
                        offers_collection = db_instance.get_collection('offers')
                        offer = offers_collection.find_one({'offer_id': access_request.get('offer_id')})
                        offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                        email_service = get_email_service()
                        email_service.send_approval_notification_async(
                            recipient_email=publisher['email'],
                            offer_name=offer_name,
                            status='rejected',
                            reason=reason,
                            offer_id=str(access_request.get('offer_id', ''))
                        )
                except Exception:
                    pass

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f'{rid}: {str(e)}')

        return jsonify({
            'message': f'Bulk rejection complete: {results["rejected"]} rejected, {results["failed"]} failed',
            'results': results
        })

    except Exception as e:
        logging.error(f"Bulk reject error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Bulk reject failed: {str(e)}'}), 500


@admin_offer_requests_bp.route('/offer-access-requests/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_access_requests_stats():
    """Get statistics for access requests"""
    try:
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Get basic stats
        total_requests = requests_collection.count_documents({})
        pending_requests = requests_collection.count_documents({'status': 'pending'})
        approved_requests = requests_collection.count_documents({'status': 'approved'})
        rejected_requests = requests_collection.count_documents({'status': 'rejected'})
        
        # Get requests by offer
        pipeline = [
            {
                '$group': {
                    '_id': '$offer_id',
                    'total_requests': {'$sum': 1},
                    'pending': {'$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}},
                    'approved': {'$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}},
                    'rejected': {'$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}}
                }
            },
            {'$sort': {'total_requests': -1}},
            {'$limit': 10}
        ]
        
        requests_by_offer = list(requests_collection.aggregate(pipeline))
        
        # Enrich with offer names
        offers_collection = db_instance.get_collection('offers')
        for item in requests_by_offer:
            offer = offers_collection.find_one({'offer_id': item['_id']})
            if offer:
                item['offer_name'] = offer.get('name', 'Unknown')
                item['offer_payout'] = offer.get('payout', 0)
        
        return jsonify({
            'stats': {
                'total_requests': total_requests,
                'pending_requests': pending_requests,
                'approved_requests': approved_requests,
                'rejected_requests': rejected_requests,
                'approval_rate': round((approved_requests / total_requests * 100) if total_requests > 0 else 0, 2),
                'requests_by_offer': requests_by_offer
            }
        })
        
    except Exception as e:
        logging.error(f"Get access requests stats error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offers/<offer_id>/approval-settings', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def update_offer_approval_settings(offer_id):
    """Update approval settings for an offer"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate approval settings
        approval_settings = data.get('approval_settings', {})
        approval_type = approval_settings.get('type', 'auto_approve')
        
        if approval_type not in ['auto_approve', 'time_based', 'manual']:
            return jsonify({'error': 'Invalid approval type'}), 400
        
        # Update offer with new approval settings
        update_data = {
            'approval_settings': approval_settings,
            'updated_at': datetime.utcnow()
        }
        
        # If changing approval status
        if 'approval_status' in data:
            update_data['approval_status'] = data['approval_status']
        
        success, error = offer_model.update_offer(offer_id, update_data, str(request.current_user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update approval settings'}), 400
        
        return jsonify({
            'message': 'Approval settings updated successfully',
            'offer_id': offer_id
        })
        
    except Exception as e:
        logging.error(f"Update approval settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update approval settings: {str(e)}'}), 500

@admin_offer_requests_bp.route('/offers/check-inactive', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def check_inactive_offers():
    """Manually trigger check for inactive offers that should be locked"""
    try:
        locked_offers = offer_model.check_and_lock_inactive_offers()
        
        return jsonify({
            'message': f'Checked inactive offers, locked {len(locked_offers)} offers',
            'locked_offers': locked_offers
        })
        
    except Exception as e:
        logging.error(f"Check inactive offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to check inactive offers: {str(e)}'}), 500
