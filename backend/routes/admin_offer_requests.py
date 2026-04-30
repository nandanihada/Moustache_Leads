from flask import Blueprint, request, jsonify
from services.access_control_service import AccessControlService
from services.email_service import get_email_service
from models.offer import Offer
from models.user import User
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from database import db_instance
import logging
from datetime import datetime, timedelta, timezone

admin_offer_requests_bp = Blueprint('admin_offer_requests', __name__)
access_service = AccessControlService()
offer_model = Offer()

# IST = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def _parse_ist_to_utc(scheduled_at):
    """Parse a datetime string from frontend (IST) and convert to UTC for storage."""
    if not scheduled_at:
        return datetime.utcnow()
    try:
        if isinstance(scheduled_at, str):
            # Frontend sends "2026-04-02T16:30" (no timezone = IST)
            dt = datetime.fromisoformat(scheduled_at.replace('Z', ''))
            if dt.tzinfo is None:
                # Treat as IST, convert to UTC
                dt_ist = dt.replace(tzinfo=IST)
                dt_utc = dt_ist.astimezone(timezone.utc).replace(tzinfo=None)
                return dt_utc
            else:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return scheduled_at
    except Exception as e:
        logging.warning(f"Failed to parse scheduled_at '{scheduled_at}': {e}")
        return datetime.utcnow()


def _build_email_html(body_text, frontend_url=None, offers=None, payout_type='publisher', template_style='table', visible_fields=None, default_image='', see_more_fields=None, mask_preview_links=False, recipient_email='', batch_id='', payment_terms='', per_offer_payment_terms=None, custom_preview_url='', custom_preview_urls=None, preview_in_email='both', custom_preview_in_email='both'):
    """Build a branded HTML email with logo and unsubscribe link."""
    import os
    if not frontend_url:
        frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')

    # If offers provided, use the shared template builder
    if offers and len(offers) > 0:
        from utils.email_template_builder import build_offer_email_html
        # Build custom_preview_urls dict
        # custom_preview_urls (dict per offer) takes priority over custom_preview_url (single for all)
        final_custom_urls = {}
        if custom_preview_urls and isinstance(custom_preview_urls, dict):
            final_custom_urls = custom_preview_urls
        elif custom_preview_url:
            for o in offers:
                final_custom_urls[o.get('offer_id', '')] = custom_preview_url
        return build_offer_email_html(
            offers=offers,
            recipient_name='',
            custom_message=body_text if isinstance(body_text, str) else '',
            template_style=template_style,
            visible_fields=visible_fields,
            see_more_fields=see_more_fields,
            payout_type=payout_type,
            default_image=default_image,
            mask_preview_links=mask_preview_links,
            recipient_email=recipient_email,
            batch_id=batch_id,
            payment_terms=payment_terms,
            per_offer_payment_terms=per_offer_payment_terms,
            custom_preview_urls=final_custom_urls,
            preview_in_email=preview_in_email,
            custom_preview_in_email=custom_preview_in_email,
        )

    # Fallback: no offers, just body text
    body_html = body_text.replace(chr(10), '<br>') if isinstance(body_text, str) else body_text

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="text-align:center;margin-bottom:24px;">
<img src="{frontend_url}/logo.png" alt="Moustache Leads" style="height:40px;" onerror="this.style.display='none'" />
<h1 style="margin:8px 0 0;font-size:20px;color:#111;">Moustache Leads</h1>
</div>
<div style="font-size:15px;color:#333;line-height:1.6;">{body_html}</div>
<div style="text-align:center;margin-top:24px;">
<a href="{frontend_url}/publisher/signin" style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Login to View All Details</a>
</div>
<p style="font-size:11px;color:#999;margin-top:32px;text-align:center;">
<a href="{frontend_url}/dashboard/settings" style="color:#999;">Unsubscribe</a> from these notifications
</p>
</div>
</body></html>"""


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
        per_page = min(int(request.args.get('per_page', 20)), 200)
        
        requests_collection = db_instance.get_collection('affiliate_requests')
        users_collection = db_instance.get_collection('users')
        offers_collection = db_instance.get_collection('offers')
        
        # Build request query
        req_query = {}
        if status != 'all':
            if status == 'pending':
                req_query['status'] = {'$in': ['pending', 'review']}
            else:
                req_query['status'] = status
        
        # Get all matching requests
        all_requests = list(requests_collection.find(req_query).sort('requested_at', -1))
        
        # Deduplicate: for same user_id + offer_id, keep only the latest request
        seen_user_offer = {}
        deduped_requests = []
        for req in all_requests:
            uid = str(req.get('user_id', ''))
            oid = req.get('offer_id', '')
            key = f"{uid}:{oid}"
            if key not in seen_user_offer:
                seen_user_offer[key] = True
                deduped_requests.append(req)
        all_requests = deduped_requests
        
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
        
        # Compute offer-level stats across ALL requests (not just this page)
        offer_stats = {}
        for oid in offer_ids_needed:
            reqs_for_offer = [r for r in all_requests if r.get('offer_id') == oid]
            offer_stats[oid] = {
                'total_requests': len(reqs_for_offer),
                'approved_count': len([r for r in reqs_for_offer if r.get('status') == 'approved']),
                'rejected_count': len([r for r in reqs_for_offer if r.get('status') == 'rejected']),
                'pending_count': len([r for r in reqs_for_offer if r.get('status') == 'pending']),
            }
        
        # Get click counts per offer from clicks collection
        clicks_collection = db_instance.get_collection('clicks')
        if clicks_collection is not None and offer_ids_needed:
            try:
                click_pipeline = [
                    {'$match': {'offer_id': {'$in': list(offer_ids_needed)}}},
                    {'$group': {'_id': '$offer_id', 'total_clicks': {'$sum': 1}}}
                ]
                for doc in clicks_collection.aggregate(click_pipeline):
                    oid = doc['_id']
                    if oid in offer_stats:
                        offer_stats[oid]['total_clicks'] = doc['total_clicks']
            except Exception as e:
                logging.warning(f"Failed to get click counts: {e}")
        
        # Compute offer health
        from services.health_check_service import HealthCheckService
        health_service = HealthCheckService()
        offer_health = {}
        offers_for_health = [offer_cache[oid] for oid in offer_ids_needed if oid in offer_cache]
        if offers_for_health:
            offer_health = health_service.evaluate_offers_batch(offers_for_health)
        
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
                
                # Count how many times this user requested this specific offer
                same_offer_requests = [r for r in all_requests if str(r.get('user_id')) == uid and r.get('offer_id') == req.get('offer_id')]
                request_count = len(same_offer_requests)
                
                enriched_requests.append({
                    '_id': str(req['_id']),
                    'request_id': req.get('request_id', str(req['_id'])),
                    'offer_id': req.get('offer_id'),
                    'offer_name': offer.get('name') if offer else 'Unknown',
                    'offer_payout': offer.get('payout', 0) if offer else 0,
                    'offer_network': offer.get('network', '') if offer else '',
                    'offer_category': (offer.get('category') or offer.get('vertical', '')) if offer else '',
                    'offer_status': offer.get('status', '') if offer else '',
                    'offer_countries': offer.get('countries', []) if offer else [],
                    'offer_target_url': offer.get('target_url', '') if offer else '',
                    'status': req.get('status'),
                    'requested_at': req.get('requested_at'),
                    'message': req.get('message', ''),
                    'request_count': request_count,
                    'offer_stats': offer_stats.get(req.get('offer_id'), {}),
                    'offer_health': offer_health.get(req.get('offer_id'), {'status': 'unknown', 'failures': []}),
                    'clicks': 0, 'conversions': 0, 'conv_rate': 0, 'last_conversion': None,
                    'approved_at': req.get('approved_at'),
                    'rejected_at': req.get('rejected_at'),
                    'marked_for_review_at': req.get('marked_for_review_at'),
                    'approved_by_username': req.get('approved_by_username', ''),
                    'rejected_by_username': req.get('rejected_by_username', ''),
                    'marked_for_review_by': req.get('marked_for_review_by', ''),
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
        
        publisher_profiles.sort(key=lambda x: (x.get('requests', [{}])[0].get('requested_at') or datetime.min), reverse=True)
        
        # Enrich with mail_sent_today for each publisher
        try:
            email_logs_col = db_instance.get_collection('email_activity_logs')
            proofs_col_check = db_instance.get_collection('placement_proofs')
            if email_logs_col is not None:
                today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                for profile in publisher_profiles:
                    uid = profile.get('user_id', '')
                    if not uid:
                        profile['mail_sent_today'] = 0
                        profile['mail_total_sent'] = 0
                        profile['mail_last_sent'] = None
                        continue
                    try:
                        today_count = email_logs_col.count_documents({
                            'created_at': {'$gte': today_start},
                            '$or': [{'user_id': uid}, {'recipient_user_ids': uid}]
                        })
                        total_count = email_logs_col.count_documents({
                            '$or': [{'user_id': uid}, {'recipient_user_ids': uid}]
                        })
                        last_doc = email_logs_col.find_one(
                            {'$or': [{'user_id': uid}, {'recipient_user_ids': uid}]},
                            sort=[('created_at', -1)]
                        )
                        profile['mail_sent_today'] = today_count
                        profile['mail_total_sent'] = total_count
                        profile['mail_last_sent'] = last_doc['created_at'].isoformat() + 'Z' if last_doc and last_doc.get('created_at') else None
                    except Exception:
                        profile['mail_sent_today'] = 0
                        profile['mail_total_sent'] = 0
                        profile['mail_last_sent'] = None
        except Exception as mail_err:
            logging.warning(f"Failed to enrich mail stats for offer requests: {mail_err}")

        # Enrich with placement proof status
        try:
            if proofs_col_check is not None:
                all_uids = [p['user_id'] for p in publisher_profiles if p.get('user_id')]
                if all_uids:
                    users_with_proofs = set()
                    for doc in proofs_col_check.find(
                        {'user_id': {'$in': all_uids}},
                        {'user_id': 1}
                    ):
                        users_with_proofs.add(doc.get('user_id', ''))
                    for profile in publisher_profiles:
                        profile['has_proofs'] = profile['user_id'] in users_with_proofs
        except Exception:
            pass
        
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
        limit = min(int(request.args.get('limit', 12)), 50)
        
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
            },
            {
                'offer_id': 1,
                'name': 1,
                'payout': 1,
                'network': 1,
                'category': 1,
                'vertical': 1,
                'device_targeting': 1,
                'approval_status': 1,
                'status': 1,
                'image_url': 1,
                'thumbnail_url': 1,
                'countries': 1,
                'allowed_countries': 1,
                'rotation_running': 1,
            }
        ).limit(limit * 3))  # Fetch extra to account for filtering
        
        # Get offers already sent to this user (via grants)
        already_sent_offer_ids = set()
        if user_id:
            try:
                from models.offer_grant import OfferGrant
                grant_model = OfferGrant()
                if grant_model.collection is not None:
                    sent_grants = grant_model.collection.find(
                        {'user_id': str(user_id)},
                        {'offer_id': 1}
                    )
                    already_sent_offer_ids = {g['offer_id'] for g in sent_grants}
            except Exception:
                pass

        # Separate: new offers (not sent) and already-sent offers
        new_offers = []
        sent_offers = []
        for o in similar_offers:
            oid = o.get('offer_id', '')
            if oid in already_sent_offer_ids:
                sent_offers.append(o)
            else:
                new_offers.append(o)
        
        # Prioritize new offers, then append sent ones at the bottom (with badge)
        similar_offers = new_offers[:limit] + sent_offers[:max(0, limit - len(new_offers))]
        
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
        # Also run health checks on matched offers
        from services.health_check_service import HealthCheckService
        health_service = HealthCheckService()
        health_results = health_service.evaluate_offers_batch(similar_offers)

        # Get grant counts for these offers
        grant_counts = {}
        try:
            from models.offer_grant import OfferGrant
            grant_model = OfferGrant()
            if grant_model.collection is not None:
                grant_pipeline = [
                    {'$match': {'offer_id': {'$in': [o.get('offer_id', '') for o in similar_offers]}, 'is_active': True}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}}
                ]
                for g in grant_model.collection.aggregate(grant_pipeline):
                    grant_counts[g['_id']] = g['count']
        except Exception:
            pass

        # Get rotation state
        rotation_running_ids = set()
        rotation_batch_ids = set()
        try:
            from services.offer_rotation_service import get_rotation_service
            rot_svc = get_rotation_service()
            rot_state = rot_svc._get_state()
            rotation_running_ids = set(rot_state.get('running_offer_ids', []))
            rotation_batch_ids = set(rot_state.get('current_batch_ids', []))
        except Exception:
            pass

        results = []
        for offer in similar_offers:
            offer_name_lower = offer.get('name', '').lower()
            match_count = sum(1 for kw in keywords if kw in offer_name_lower)
            match_strength = 'Strong' if match_count >= 2 else 'Good'
            oid = offer.get('offer_id', '')
            health = health_results.get(oid, {'status': 'unknown', 'failures': []})
            
            # Determine visibility status
            offer_status = offer.get('status', 'inactive')
            is_rotation_running = oid in rotation_running_ids
            is_in_rotation_batch = oid in rotation_batch_ids
            
            visibility = 'inactive'
            if offer_status == 'active':
                visibility = 'active'
            elif is_rotation_running:
                visibility = 'running'
            elif is_in_rotation_batch:
                visibility = 'rotating'
            
            results.append({
                '_id': str(offer['_id']),
                'offer_id': oid,
                'name': offer.get('name'),
                'payout': offer.get('payout', 0),
                'network': offer.get('network', ''),
                'category': offer.get('category', ''),
                'image_url': offer.get('image_url', ''),
                'thumbnail_url': offer.get('thumbnail_url', ''),
                'countries': offer.get('countries', offer.get('allowed_countries', [])),
                'keywords': ', '.join(keywords[:3]),
                'match_strength': match_strength,
                'request_status': user_requests.get(oid),
                'health': health,
                'status': offer_status,
                'visibility': visibility,
                'is_rotation_running': is_rotation_running,
                'is_in_rotation': is_in_rotation_batch,
                'grant_count': grant_counts.get(oid, 0),
                'already_sent': oid in already_sent_offer_ids,
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
                    'marked_for_review_by': user.get('username', str(user['_id'])),
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
        template_style = data.get('template_style', 'table')  # 'table' or 'card'
        visible_fields = data.get('visible_fields')  # list of field names or None for defaults
        see_more_fields = data.get('see_more_fields')  # list of fields for "See More" section
        default_image = data.get('default_image', '')  # URL for offers without images
        payout_type = data.get('payout_type', 'publisher')  # 'publisher' or 'admin'
        mask_preview_links = data.get('mask_preview_links', False)
        payment_terms = data.get('payment_terms', '')
        custom_preview_url = data.get('custom_preview_url', '')
        custom_preview_urls = data.get('custom_preview_urls', {})
        preview_in_email = data.get('preview_in_email', 'both')
        custom_preview_in_email = data.get('custom_preview_in_email', 'both')
        per_offer_payment_terms = data.get('per_offer_payment_terms', {})

        if (not user_ids and not custom_emails) or (not offer_ids and not message_body):
            return jsonify({'error': 'At least one recipient and either offer_ids or message_body are required'}), 400

        users_collection = db_instance.get_collection('users')
        offers_collection = db_instance.get_collection('offers')

        # Get offers
        offers = list(offers_collection.find({'offer_id': {'$in': offer_ids}}))

        # If default_image is provided, permanently save it to offers without images
        if default_image:
            for o in offers:
                if not o.get('image_url') and not o.get('thumbnail_url'):
                    try:
                        offers_collection.update_one(
                            {'_id': o['_id']},
                            {'$set': {'image_url': default_image}}
                        )
                        o['image_url'] = default_image
                        logging.info(f"📸 Set default image for offer {o.get('offer_id')}")
                    except Exception as img_err:
                        logging.warning(f"Failed to set default image for offer {o.get('offer_id')}: {img_err}")

        offer_list = [{'name': o.get('name'), 'payout': round(float(o.get('payout', 0) or 0) * 0.8, 2), 'offer_id': o.get('offer_id')} for o in offers]

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

        # Build email subject
        email_subject = subject or ('Recommended Offers for You - Moustache Leads' if template_type == 'recommend' else 'Your Offer Access Update - Moustache Leads')

        def build_body(username):
            if message_body:
                return message_body
            return f"""Hi {username},

{custom_message or 'We have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.'}

Best regards,
Moustache Leads Team
Moustache Leads"""

        # Send to users via BCC (single email) or support/notification per user
        if send_via == 'email':
            # Collect all email addresses and send ONE BCC email
            all_emails = [u.get('email') for u in users if u.get('email')]
            all_emails.extend([e.strip() for e in custom_emails if e.strip()])
            
            if all_emails:
                try:
                    import threading
                    from email.mime.text import MIMEText
                    from email.mime.multipart import MIMEMultipart
                    
                    email_service = get_email_service()
                    body = build_body('')
                    html_body = body.replace('\n', '<br>')
                    html_content = _build_email_html(body, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, per_offer_payment_terms=per_offer_payment_terms, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)
                    
                    logging.info(f"📧 Sending BCC email to {len(all_emails)} recipients")
                    
                    def send_bcc():
                        try:
                            batch_size = 50
                            for i in range(0, len(all_emails), batch_size):
                                batch = all_emails[i:i + batch_size]
                                msg = MIMEMultipart('alternative')
                                msg['Subject'] = email_subject
                                msg['From'] = email_service.from_email
                                msg['To'] = email_service.from_email
                                msg['Bcc'] = ', '.join(batch)
                                msg.attach(MIMEText(html_content, 'html'))
                                
                                ok = email_service._send_email_smtp(msg)
                                logging.info(f"📧 BCC batch ({len(batch)} recipients): {'OK' if ok else 'FAILED'}")
                        except Exception as ex:
                            logging.error(f"❌ BCC email error: {ex}")
                    
                    thread = threading.Thread(target=send_bcc, daemon=False)
                    thread.start()
                    results['sent'] = len(all_emails)
                except Exception as e:
                    logging.error(f"❌ Email setup error: {str(e)}")
                    results['failed'] = len(all_emails)
                    results['errors'].append(str(e))
        
        elif send_via == 'support':
            for user in users:
                username = user.get('username', 'Publisher')
                body = build_body(username)
                try:
                    from bson import ObjectId as ObjId
                    support_collection = db_instance.get_collection('support_messages')
                    support_collection.insert_one({
                        'user_id': ObjId(str(user['_id'])),
                        'username': user.get('username', ''),
                        'email': user.get('email', ''),
                        'subject': 'Recommended Offers for You',
                        'body': 'You have new offer recommendations from the admin team.',
                        'image_url': None,
                        'status': 'replied',
                        'replies': [{'_id': ObjId(), 'text': body, 'from': 'admin', 'image_url': None, 'created_at': datetime.utcnow()}],
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
            for user in users:
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
                    results['errors'].append(f"{str(user.get('username', ''))}: {str(e)}")

        # Create offer grants for the recipients so they can see inactive offers
        try:
            from models.offer_grant import OfferGrant
            grant_model = OfferGrant()
            admin_username = request.current_user.get('username', 'admin')
            for u in users:
                uid = str(u.get('_id', ''))
                if uid and offer_ids:
                    grant_model.grant_offers_to_user(uid, offer_ids, source='offer_access_request', granted_by=admin_username)
        except Exception as grant_err:
            logging.warning(f"Failed to create offer grants: {grant_err}")

        # Log to offer_send_history so Publisher Intelligence can track it
        try:
            history_col = db_instance.get_collection('offer_send_history')
            if history_col is not None:
                offer_names_list = [o.get('name', '') for o in offers]
                history_col.insert_one({
                    'user_id': user_ids[0] if len(user_ids) == 1 else None,
                    'recipient_user_ids': user_ids,
                    'offer_ids': offer_ids,
                    'offer_names': offer_names_list,
                    'offer_count': len(offer_ids),
                    'source': 'offer_request',
                    'send_via': send_via,
                    'subject': email_subject,
                    'admin_username': request.current_user.get('username', 'admin'),
                    'created_at': datetime.utcnow(),
                })
        except Exception as log_err:
            logging.warning(f"Failed to log send history: {log_err}")

        # Update masked links for these offers with recipient info
        try:
            masked_col = db_instance.get_collection('masked_links')
            if masked_col is not None:
                recipient_emails = [u.get('email', '') for u in users if u.get('email')]
                recipient_usernames = [u.get('username', '') for u in users if u.get('username')]
                all_custom = list(custom_emails) if custom_emails else []
                all_recipients = recipient_emails + all_custom
                for oid in offer_ids:
                    masked_col.update_many(
                        {'offer_id': oid, 'is_active': True},
                        {'$addToSet': {
                            'sent_to_emails': {'$each': all_recipients},
                            'sent_to_usernames': {'$each': recipient_usernames},
                        }}
                    )
        except Exception as ml_err:
            logging.warning(f"Failed to update masked links with recipients: {ml_err}")

        # Also update email_offer_pages (See More pages) with recipient info
        try:
            pages_col = db_instance.get_collection('email_offer_pages')
            if pages_col is not None:
                recipient_emails_list = [u.get('email', '') for u in users if u.get('email')]
                recipient_usernames_list = [u.get('username', '') for u in users if u.get('username')]
                all_custom_list = list(custom_emails) if custom_emails else []
                all_recipients_list = recipient_emails_list + all_custom_list
                for oid in offer_ids:
                    pages_col.update_many(
                        {'offer_id': oid},
                        {'$addToSet': {
                            'sent_to_emails': {'$each': all_recipients_list},
                            'sent_to_usernames': {'$each': recipient_usernames_list},
                        }}
                    )
        except Exception as sp_err:
            logging.warning(f"Failed to update see-more pages with recipients: {sp_err}")

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
        
        # Get offer views for this publisher (top viewed offers in last 30 days)
        offer_views_list = []
        offer_views_col = db_instance.get_collection('offer_views')
        if offer_views_col is not None:
            try:
                username = user.get('username', '')
                views_pipeline = [
                    {'$match': {
                        '$or': [{'user_id': user_id}, {'username': username}],
                        'timestamp': {'$gte': start_date}
                    }},
                    {'$group': {
                        '_id': '$offer_id',
                        'offer_name': {'$first': '$offer_name'},
                        'view_count': {'$sum': 1},
                        'last_viewed': {'$max': '$timestamp'}
                    }},
                    {'$sort': {'view_count': -1}},
                    {'$limit': 10}
                ]
                for doc in offer_views_col.aggregate(views_pipeline):
                    offer_views_list.append({
                        'offer_id': doc['_id'],
                        'offer_name': doc.get('offer_name', 'Unknown'),
                        'view_count': doc['view_count'],
                        'last_viewed': doc.get('last_viewed')
                    })
                
                # Get global view counts for the same offers (all users)
                if offer_views_list:
                    offer_ids_viewed = [v['offer_id'] for v in offer_views_list]
                    global_pipeline = [
                        {'$match': {'offer_id': {'$in': offer_ids_viewed}}},
                        {'$group': {'_id': '$offer_id', 'total_views': {'$sum': 1}}}
                    ]
                    global_views = {}
                    for doc in offer_views_col.aggregate(global_pipeline):
                        global_views[doc['_id']] = doc['total_views']
                    
                    for v in offer_views_list:
                        v['global_view_count'] = global_views.get(v['offer_id'], v['view_count'])
            except Exception as e:
                logging.warning(f"Failed to get offer views: {e}")
        
        return safe_json_response({
            'user_id': user_id,
            'username': user.get('username'),
            'daily_stats': daily_stats,
            'traffic_sources': traffic_sources,
            'offer_views': offer_views_list,
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
                    offer_id=str(access_request.get('offer_id', '')),
                    extra_data={
                        'payout': round(float(offer.get('payout', 0) or 0) * 0.8, 2) if offer else '',
                        'category': offer.get('category', offer.get('vertical', '')) if offer else '',
                        'countries': ', '.join((offer.get('countries', []) or [])[:5]) if offer else '',
                    } if offer else None
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
        rejection_category = data.get('category', 'other')
        if rejection_category not in ('wrong_link', 'empty_link', 'not_approved', 'wrong_user', 'other'):
            rejection_category = 'other'

        requests_collection.update_one(
            {'_id': access_request['_id']},
            {
                '$set': {
                    'rejected_by': str(user['_id']),
                    'rejected_by_username': user.get('username'),
                    'rejection_reason': reason,
                    'rejection_category': rejection_category,
                    'hidden_from_publisher': True,
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
    """Get detailed statistics for access requests including 24h breakdowns"""
    try:
        requests_collection = db_instance.get_collection('affiliate_requests')
        cutoff_24h = datetime.utcnow() - timedelta(hours=24)
        
        # Total counts
        total_requests = requests_collection.count_documents({})
        pending_total = requests_collection.count_documents({'status': {'$in': ['pending', 'review']}})
        approved_total = requests_collection.count_documents({'status': 'approved'})
        rejected_total = requests_collection.count_documents({'status': 'rejected'})
        
        # 24h counts
        approved_24h = requests_collection.count_documents({'status': 'approved', 'approved_at': {'$gte': cutoff_24h}})
        if approved_24h == 0:
            approved_24h = requests_collection.count_documents({'status': 'approved', 'updated_at': {'$gte': cutoff_24h}})
        rejected_24h = requests_collection.count_documents({'status': 'rejected', 'updated_at': {'$gte': cutoff_24h}})
        requested_24h = requests_collection.count_documents({'requested_at': {'$gte': cutoff_24h}})
        
        # Mails and support messages sent (from send_offers tracking)
        mails_sent_total = 0
        mails_sent_24h = 0
        support_sent_total = 0
        support_sent_24h = 0
        try:
            activity_col = db_instance.get_collection('recent_activity')
            if activity_col is not None:
                mails_sent_total = activity_col.count_documents({'type': {'$in': ['offer_email_sent', 'bulk_email_sent', 'send_offers_email']}})
                mails_sent_24h = activity_col.count_documents({'type': {'$in': ['offer_email_sent', 'bulk_email_sent', 'send_offers_email']}, 'created_at': {'$gte': cutoff_24h}})
                support_sent_total = activity_col.count_documents({'type': {'$in': ['support_message_sent', 'bulk_support_sent', 'send_offers_support']}})
                support_sent_24h = activity_col.count_documents({'type': {'$in': ['support_message_sent', 'bulk_support_sent', 'send_offers_support']}, 'created_at': {'$gte': cutoff_24h}})
        except Exception:
            pass
        
        return jsonify({
            'pending_total': pending_total,
            'approved_total': approved_total,
            'approved_24h': approved_24h,
            'rejected_total': rejected_total,
            'rejected_24h': rejected_24h,
            'requested_total': total_requests,
            'requested_24h': requested_24h,
            'mails_sent_total': mails_sent_total,
            'mails_sent_24h': mails_sent_24h,
            'support_sent_total': support_sent_total,
            'support_sent_24h': support_sent_24h,
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


# ═══════════════════════════════════════════════════════════════════════════════
# NEW ENDPOINTS — Offer Access Request Redesign (Tab System)
# ═══════════════════════════════════════════════════════════════════════════════


@admin_offer_requests_bp.route('/offer-access-requests/tab-counts', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_tab_counts():
    """Get counts for all tabs with time-based breakdowns (today, this week, total)"""
    try:
        from datetime import datetime as dt, timedelta
        requests_col = db_instance.get_collection('affiliate_requests')
        collections_col = db_instance.get_collection('offer_collections')
        offers_col = db_instance.get_collection('offers')

        now = dt.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())  # Monday

        # Helper to get count with time breakdowns
        def count_with_breakdown(query_base, date_field='requested_at'):
            total = requests_col.count_documents(query_base)
            today = requests_col.count_documents({**query_base, date_field: {'$gte': today_start}})
            week = requests_col.count_documents({**query_base, date_field: {'$gte': week_start}})
            return {'total': total, 'today': today, 'week': week}

        all_requests = count_with_breakdown({'status': 'pending'})
        approved = count_with_breakdown({'status': 'approved'})
        rejected = count_with_breakdown({'status': 'rejected'})
        in_review = count_with_breakdown({'status': {'$in': ['pending', 'review']}})

        dp_count = 0
        dp_today = 0
        dp_week = 0
        af_count = 0
        af_today = 0
        af_week = 0
        pp_count = 0
        pp_today = 0
        pp_week = 0
        if collections_col is not None:
            dp_count = collections_col.count_documents({'collection_type': 'direct_partner'})
            dp_today = collections_col.count_documents({'collection_type': 'direct_partner', 'created_at': {'$gte': today_start}})
            dp_week = collections_col.count_documents({'collection_type': 'direct_partner', 'created_at': {'$gte': week_start}})
            af_count = collections_col.count_documents({'collection_type': 'affiliate'})
            af_today = collections_col.count_documents({'collection_type': 'affiliate', 'created_at': {'$gte': today_start}})
            af_week = collections_col.count_documents({'collection_type': 'affiliate', 'created_at': {'$gte': week_start}})

        proofs_col = db_instance.get_collection('placement_proofs')
        if proofs_col is not None:
            pp_count = proofs_col.count_documents({})
            pp_today = proofs_col.count_documents({'created_at': {'$gte': today_start}})
            pp_week = proofs_col.count_documents({'created_at': {'$gte': week_start}})

        # Most requested — count distinct offer_ids with time breakdowns
        most_requested_total = len(requests_col.distinct('offer_id'))
        most_requested_today = len(requests_col.distinct('offer_id', {'requested_at': {'$gte': today_start}}))
        most_requested_week = len(requests_col.distinct('offer_id', {'requested_at': {'$gte': week_start}}))

        # Recently added/edited/deleted offers (last 7 days)
        recent_cutoff = now - timedelta(days=7)
        recently_added = []
        recently_edited = []
        recently_deleted = []

        if offers_col is not None:
            # Recently added (created in last 7 days)
            added_docs = list(offers_col.find(
                {'created_at': {'$gte': recent_cutoff}, '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
                {'offer_id': 1, 'name': 1, 'created_at': 1, 'network': 1}
            ).sort('created_at', -1).limit(5))
            recently_added = [{'offer_id': d.get('offer_id'), 'name': d.get('name', ''), 'network': d.get('network', ''), 'at': d.get('created_at').isoformat() + 'Z' if d.get('created_at') else None} for d in added_docs]

            # Recently edited — use admin_activity_log for accurate edit tracking
            activity_col = db_instance.get_collection('admin_activity_logs')
            if activity_col is not None:
                edit_logs = list(activity_col.find(
                    {'action': {'$in': ['offer_updated', 'offer_edited', 'update_offer', 'inline_update_offer']}, 'created_at': {'$gte': recent_cutoff}},
                    {'details': 1, 'created_at': 1, 'affected_items': 1}
                ).sort('created_at', -1).limit(20))
                seen_edited = set()
                for log in edit_logs:
                    oid = None
                    name = ''
                    network = ''
                    # Try to get offer info from log
                    details = log.get('details', {})
                    if isinstance(details, dict):
                        oid = details.get('offer_id', '')
                        name = details.get('offer_name', details.get('name', ''))
                    items = log.get('affected_items', [])
                    if isinstance(items, list) and items:
                        item = items[0] if isinstance(items[0], dict) else {}
                        oid = oid or item.get('offer_id', '')
                        name = name or item.get('name', '')
                        network = item.get('network', '')
                    if oid and oid not in seen_edited:
                        seen_edited.add(oid)
                        recently_edited.append({'offer_id': oid, 'name': name, 'network': network, 'at': log.get('created_at').isoformat() + 'Z' if log.get('created_at') else None})
                    if len(recently_edited) >= 5:
                        break

            # Recently deleted
            deleted_docs = list(offers_col.find(
                {'deleted': True, 'updated_at': {'$gte': recent_cutoff}},
                {'offer_id': 1, 'name': 1, 'updated_at': 1, 'network': 1}
            ).sort('updated_at', -1).limit(5))
            recently_deleted = [{'offer_id': d.get('offer_id'), 'name': d.get('name', ''), 'network': d.get('network', ''), 'at': d.get('updated_at').isoformat() + 'Z' if d.get('updated_at') else None} for d in deleted_docs]

        # Count totals for recently sections
        added_today = offers_col.count_documents({'created_at': {'$gte': today_start}, '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}) if offers_col is not None else 0
        # Edited today — count from activity logs
        edited_today = 0
        if activity_col is not None:
            edited_today = activity_col.count_documents({'action': {'$in': ['offer_updated', 'offer_edited', 'update_offer', 'inline_update_offer']}, 'created_at': {'$gte': today_start}})
        deleted_today = offers_col.count_documents({'deleted': True, 'updated_at': {'$gte': today_start}}) if offers_col is not None else 0

        return jsonify({
            'all_requests': all_requests,
            'approved': approved,
            'rejected': rejected,
            'in_review': in_review,
            'direct_partner': {'total': dp_count, 'today': dp_today, 'week': dp_week},
            'affiliate': {'total': af_count, 'today': af_today, 'week': af_week},
            'most_requested': {'total': most_requested_total, 'today': most_requested_today, 'week': most_requested_week},
            'placement_proofs': {'total': pp_count, 'today': pp_today, 'week': pp_week},
            'recently_added': recently_added,
            'recently_edited': recently_edited,
            'recently_deleted': recently_deleted,
            'added_today': added_today,
            'edited_today': edited_today,
            'deleted_today': deleted_today,
        })
    except Exception as e:
        logging.error(f"Tab counts error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/tab-data', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_tab_data():
    """Unified tab data endpoint for all 6 tabs"""
    try:
        from bson import ObjectId
        from services.health_check_service import HealthCheckService

        tab = request.args.get('tab', 'in_review')
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 20)), 500)
        sort_dir = request.args.get('sort_dir', 'desc')
        user_id_filter = request.args.get('user_id', '')
        offer_name_filter = request.args.get('offer_name', '')
        network_filter = request.args.get('network', '')
        vertical_filter = request.args.get('vertical', '')
        country_filter = request.args.get('country', '')

        user = request.current_user

        # Rejected tab is admin-only
        if tab == 'rejected' and user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required for rejected tab'}), 403

        requests_col = db_instance.get_collection('affiliate_requests')
        offers_col = db_instance.get_collection('offers')
        users_col = db_instance.get_collection('users')
        collections_col = db_instance.get_collection('offer_collections')
        proofs_col = db_instance.get_collection('placement_proofs')

        sort_val = 1 if sort_dir == 'asc' else -1

        # ── Placement Proofs tab ──
        if tab == 'placement_proofs':
            proofs_col = db_instance.get_collection('placement_proofs')
            if proofs_col is None:
                return safe_json_response({'requests': [], 'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}})

            pq = {}
            if offer_name_filter:
                pq['offer_name'] = {'$regex': offer_name_filter, '$options': 'i'}
            if user_id_filter:
                pq['user_id'] = user_id_filter

            total = proofs_col.count_documents(pq)
            proofs = list(proofs_col.find(pq).sort('created_at', sort_val).skip((page - 1) * per_page).limit(per_page))

            # Enrich with user info
            proof_user_ids = list({p.get('user_id', '') for p in proofs if p.get('user_id')})
            user_map = {}
            if proof_user_ids:
                obj_uids = []
                for uid in proof_user_ids:
                    try:
                        obj_uids.append(ObjectId(uid))
                    except:
                        pass
                if obj_uids:
                    for u in users_col.find({'_id': {'$in': obj_uids}}, {'username': 1, 'email': 1}):
                        user_map[str(u['_id'])] = u

            results = []
            for p in proofs:
                uid = p.get('user_id', '')
                usr = user_map.get(uid, {})
                # Look up offer name from offers collection if not stored
                offer_name = p.get('offer_name', '')
                if not offer_name and p.get('offer_id'):
                    offer = offers_col.find_one({'offer_id': p['offer_id']}, {'name': 1})
                    offer_name = offer.get('name', '') if offer else ''
                results.append({
                    '_id': str(p['_id']),
                    'offer_id': p.get('offer_id', ''),
                    'offer_name': offer_name,
                    'status': p.get('status', 'pending'),
                    'requested_at': p.get('created_at'),
                    'publisher_id': uid,
                    'publisher_username': usr.get('username', ''),
                    'publisher_email': usr.get('email', ''),
                    'image_urls': p.get('image_urls', []),
                    'placement_url': p.get('placement_url', ''),
                    'description': p.get('description', ''),
                    'traffic_source': p.get('traffic_source', ''),
                    'admin_notes': p.get('admin_notes', ''),
                    'score': p.get('score', 0),
                })

            return safe_json_response({
                'requests': results,
                'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page)},
                'tab_stats': {'count': total},
            })

        # ── Direct Partner / Affiliate tabs ──
        if tab in ('direct_partner', 'affiliate'):
            if collections_col is None:
                return safe_json_response({'requests': [], 'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}})

            q = {'collection_type': tab}
            if offer_name_filter:
                q['offer_snapshot.name'] = {'$regex': offer_name_filter, '$options': 'i'}
            if network_filter:
                q['offer_snapshot.network'] = {'$regex': network_filter, '$options': 'i'}

            total = collections_col.count_documents(q)
            items = list(collections_col.find(q).sort('created_at', sort_val).skip((page - 1) * per_page).limit(per_page))

            results = []
            for item in items:
                results.append({
                    '_id': str(item['_id']),
                    'offer_id': item.get('offer_id'),
                    'collection_type': item.get('collection_type'),
                    'offer_name': item.get('offer_snapshot', {}).get('name', ''),
                    'offer_payout': item.get('offer_snapshot', {}).get('payout', 0),
                    'offer_network': item.get('offer_snapshot', {}).get('network', ''),
                    'offer_category': item.get('offer_snapshot', {}).get('category', ''),
                    'offer_countries': item.get('offer_snapshot', {}).get('countries', []),
                    'publisher_username': item.get('publisher_username', ''),
                    'added_by_username': item.get('added_by_username', ''),
                    'created_at': item.get('created_at'),
                    'status': tab,
                })

            return safe_json_response({
                'requests': results,
                'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page)},
                'tab_stats': {'count': total},
            })

        # ── Most Requested tab ──
        if tab == 'most_requested':
            match_stage = {}
            if user_id_filter:
                match_stage['user_id'] = user_id_filter
            if offer_name_filter:
                # We'll filter after enrichment
                pass

            pipeline = []
            if match_stage:
                pipeline.append({'$match': match_stage})

            pipeline.extend([
                {'$group': {
                    '_id': '$offer_id',
                    'total_requests': {'$sum': 1},
                    'unique_users': {'$addToSet': '$user_id'},
                    'approved_count': {'$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}},
                    'rejected_count': {'$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}},
                    'pending_count': {'$sum': {'$cond': [{'$in': ['$status', ['pending', 'review']]}, 1, 0]}},
                    'last_requested_at': {'$max': '$requested_at'},
                }},
                {'$addFields': {'unique_users_count': {'$size': '$unique_users'}}},
                {'$sort': {'total_requests': -1}},
            ])

            raw = list(requests_col.aggregate(pipeline))

            # Enrich with offer details
            offer_ids = [r['_id'] for r in raw]
            offer_map = {}
            if offer_ids:
                for o in offers_col.find({'offer_id': {'$in': offer_ids}}):
                    offer_map[o['offer_id']] = o

            enriched = []
            for r in raw:
                oid = r['_id']
                offer = offer_map.get(oid, {})
                name = offer.get('name', oid or 'Unknown')
                net = offer.get('network', '')
                cat = offer.get('category', offer.get('vertical', ''))
                countries = offer.get('countries', [])
                payout = offer.get('payout', 0)

                # Apply post-enrichment filters
                if offer_name_filter and offer_name_filter.lower() not in name.lower():
                    continue
                if network_filter and network_filter.lower() not in net.lower():
                    continue
                if vertical_filter and vertical_filter.lower() not in cat.lower():
                    continue
                if country_filter and country_filter.upper() not in [c.upper() for c in countries]:
                    continue

                enriched.append({
                    'offer_id': oid,
                    'offer_name': name,
                    'offer_network': net,
                    'offer_category': cat,
                    'offer_countries': countries,
                    'offer_payout': payout,
                    'total_requests': r['total_requests'],
                    'unique_users': r['unique_users_count'],
                    'approved_count': r['approved_count'],
                    'rejected_count': r['rejected_count'],
                    'pending_count': r['pending_count'],
                    'last_requested_at': r.get('last_requested_at'),
                    'status': 'most_requested',
                })

            total = len(enriched)
            start = (page - 1) * per_page
            paginated = enriched[start:start + per_page]

            return safe_json_response({
                'requests': paginated,
                'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page)},
                'tab_stats': {'count': total},
            })

        # ── Standard tabs: approved, rejected, in_review ──
        status_map = {
            'approved': 'approved',
            'rejected': 'rejected',
            'in_review': ['pending', 'review'],
        }
        mapped = status_map.get(tab, 'review')
        if isinstance(mapped, list):
            q = {'status': {'$in': mapped}}
        else:
            q = {'status': mapped}

        if user_id_filter:
            q['user_id'] = user_id_filter

        # For offer_name / network / vertical / country we need to resolve offer_ids first
        offer_id_constraint = None
        if offer_name_filter or network_filter or vertical_filter or country_filter:
            oq = {}
            if offer_name_filter:
                oq['name'] = {'$regex': offer_name_filter, '$options': 'i'}
            if network_filter:
                oq['network'] = {'$regex': network_filter, '$options': 'i'}
            if vertical_filter:
                oq['$or'] = [
                    {'category': {'$regex': vertical_filter, '$options': 'i'}},
                    {'vertical': {'$regex': vertical_filter, '$options': 'i'}},
                ]
            if country_filter:
                oq['countries'] = {'$regex': country_filter, '$options': 'i'}
            matching_ids = [o['offer_id'] for o in offers_col.find(oq, {'offer_id': 1})]
            q['offer_id'] = {'$in': matching_ids}

        total = requests_col.count_documents(q)
        reqs = list(requests_col.find(q).sort('requested_at', sort_val).skip((page - 1) * per_page).limit(per_page))

        # Enrich
        needed_offer_ids = list({r.get('offer_id') for r in reqs if r.get('offer_id')})
        needed_user_ids = list({str(r.get('user_id')) for r in reqs if r.get('user_id')})

        offer_cache = {}
        for o in offers_col.find({'offer_id': {'$in': needed_offer_ids}}):
            offer_cache[o['offer_id']] = o

        user_cache = {}
        obj_uids = []
        for uid in needed_user_ids:
            try:
                obj_uids.append(ObjectId(uid))
            except:
                pass
        if obj_uids:
            for u in users_col.find({'_id': {'$in': obj_uids}}):
                user_cache[str(u['_id'])] = u

        # Health check
        health_service = HealthCheckService()
        offers_for_health = [offer_cache[oid] for oid in needed_offer_ids if oid in offer_cache]
        offer_health = health_service.evaluate_offers_batch(offers_for_health) if offers_for_health else {}

        # Check collection membership
        collection_status = {}
        if collections_col is not None and needed_offer_ids:
            for doc in collections_col.find({'offer_id': {'$in': needed_offer_ids}}):
                oid = doc['offer_id']
                if oid not in collection_status:
                    collection_status[oid] = {'direct_partner': False, 'affiliate': False}
                collection_status[oid][doc['collection_type']] = True

        # Check placement proofs for these users+offers
        proof_set = set()  # set of "user_id:offer_id" that have proofs
        if proofs_col is not None and needed_user_ids:
            try:
                for doc in proofs_col.find({
                    'user_id': {'$in': needed_user_ids}
                }, {'user_id': 1, 'offer_id': 1}):
                    uid_p = doc.get('user_id', '')
                    oid_p = doc.get('offer_id', '')
                    if uid_p and oid_p:
                        proof_set.add(f"{uid_p}:{oid_p}")
                    elif uid_p:
                        proof_set.add(f"{uid_p}:*")
            except Exception:
                pass

        results = []
        for r in reqs:
            oid = r.get('offer_id')
            offer = offer_cache.get(oid, {})
            uid = str(r.get('user_id', ''))
            usr = user_cache.get(uid, {})

            item = {
                '_id': str(r['_id']),
                'request_id': r.get('request_id', str(r['_id'])),
                'offer_id': oid,
                'offer_name': offer.get('name', 'Unknown'),
                'offer_payout': offer.get('payout', 0),
                'offer_network': offer.get('network', ''),
                'offer_category': offer.get('category', offer.get('vertical', '')),
                'offer_countries': offer.get('countries', []),
                'offer_status': offer.get('status', ''),
                'status': r.get('status'),
                'requested_at': r.get('requested_at'),
                'message': r.get('message', ''),
                'request_count': 1,
                'offer_health': offer_health.get(oid, {'status': 'unknown', 'failures': []}),
                'publisher_id': uid,
                'publisher_username': usr.get('username', r.get('username', '')),
                'publisher_email': usr.get('email', r.get('email', '')),
                'is_in_collection': collection_status.get(oid, {'direct_partner': False, 'affiliate': False}),
                'has_placement_proof': f"{uid}:{oid}" in proof_set or f"{uid}:*" in proof_set,
            }

            if tab == 'rejected':
                item['rejection_reason'] = r.get('rejection_reason', '')
                item['rejection_category'] = r.get('rejection_category', '')

            # Add action timestamps for all tabs
            item['approved_at'] = r.get('approved_at')
            item['rejected_at'] = r.get('rejected_at')
            item['marked_for_review_at'] = r.get('marked_for_review_at')
            item['approved_by_username'] = r.get('approved_by_username', '')
            item['rejected_by_username'] = r.get('rejected_by_username', '')
            item['marked_for_review_by'] = r.get('marked_for_review_by', '')

            results.append(item)

        return safe_json_response({
            'requests': results,
            'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page)},
            'tab_stats': {'count': total},
        })

    except Exception as e:
        logging.error(f"Tab data error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-collections/add', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def add_to_collection():
    """Add offer to Direct Partner or Affiliate collection"""
    try:
        data = request.get_json() or {}
        offer_id = data.get('offer_id')
        request_id = data.get('request_id')
        collection_type = data.get('collection_type')
        user = request.current_user

        if not offer_id or collection_type not in ('direct_partner', 'affiliate'):
            return jsonify({'error': 'offer_id and valid collection_type required'}), 400

        collections_col = db_instance.get_collection('offer_collections')
        if collections_col is None:
            return jsonify({'error': 'Collection not available'}), 500

        # Check for duplicate
        existing = collections_col.find_one({'offer_id': offer_id, 'collection_type': collection_type})
        if existing:
            return jsonify({'success': True, 'already_exists': True})

        # Get offer snapshot
        offers_col = db_instance.get_collection('offers')
        offer = offers_col.find_one({'offer_id': offer_id})
        snapshot = {}
        if offer:
            snapshot = {
                'name': offer.get('name', ''),
                'network': offer.get('network', ''),
                'payout': offer.get('payout', 0),
                'category': offer.get('category', offer.get('vertical', '')),
                'countries': offer.get('countries', []),
            }

        # Get publisher info from request if available
        publisher_username = ''
        publisher_id = ''
        if request_id:
            req_col = db_instance.get_collection('affiliate_requests')
            ar = req_col.find_one({'$or': [{'request_id': request_id}, {'_id': request_id}]})
            if ar:
                publisher_id = str(ar.get('user_id', ''))
                publisher_username = ar.get('username', '')

        collections_col.insert_one({
            'offer_id': offer_id,
            'request_id': request_id,
            'collection_type': collection_type,
            'added_by': str(user['_id']),
            'added_by_username': user.get('username', ''),
            'offer_snapshot': snapshot,
            'publisher_id': publisher_id,
            'publisher_username': publisher_username,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        })

        return jsonify({'success': True, 'already_exists': False})

    except Exception as e:
        logging.error(f"Add to collection error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-collections/remove', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def remove_from_collection():
    """Remove offer from collection"""
    try:
        data = request.get_json() or {}
        offer_id = data.get('offer_id')
        collection_type = data.get('collection_type')

        if not offer_id or collection_type not in ('direct_partner', 'affiliate'):
            return jsonify({'error': 'offer_id and valid collection_type required'}), 400

        collections_col = db_instance.get_collection('offer_collections')
        if collections_col is not None:
            collections_col.delete_one({'offer_id': offer_id, 'collection_type': collection_type})

        return jsonify({'success': True})

    except Exception as e:
        logging.error(f"Remove from collection error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/push-mail', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def push_mail():
    """Push mail to all users for selected offers"""
    try:
        import threading

        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])
        send_type = data.get('send_type', 'send_now')
        scheduled_at = data.get('scheduled_at')
        message_template = data.get('message_template', {})
        recipient_ids = data.get('recipient_ids', [])  # Optional: filter to specific users
        template_style = data.get('template_style', 'table')
        visible_fields = data.get('visible_fields')
        see_more_fields = data.get('see_more_fields')
        default_image = data.get('default_image', '')
        payout_type = data.get('payout_type', 'publisher')
        mask_preview_links = data.get('mask_preview_links', False)
        payment_terms = data.get('payment_terms', '')
        custom_preview_url = data.get('custom_preview_url', '')
        custom_preview_urls = data.get('custom_preview_urls', {})
        preview_in_email = data.get('preview_in_email', 'both')
        custom_preview_in_email = data.get('custom_preview_in_email', 'both')
        admin_user = request.current_user

        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400

        offers_col = db_instance.get_collection('offers')
        users_col = db_instance.get_collection('users')

        offers = list(offers_col.find({'offer_id': {'$in': offer_ids}}))
        
        # If specific recipients provided, filter to those users only
        if recipient_ids:
            from bson import ObjectId as RId
            obj_ids = []
            for rid in recipient_ids:
                try:
                    obj_ids.append(RId(rid))
                except:
                    pass
            all_users = list(users_col.find({'_id': {'$in': obj_ids}}, {'email': 1, 'username': 1, '_id': 1}))
        else:
            all_users = list(users_col.find({}, {'email': 1, 'username': 1, '_id': 1}))
        
        recipients = [u['email'] for u in all_users if u.get('email')]
        logging.info(f"📧 Push mail: {len(all_users)} users, {len(recipients)} with email, send_type={send_type}")

        subject = message_template.get('subject', '🚀 Hot Offers You Should Check Out!')
        body_text = message_template.get('body', "We've found some great offers that match what you're looking for.\n\nTo get started, log in to your publisher dashboard and apply for any of the offers below. Our team is happy to help you set up.\n\nBest regards,\nMoustache Leads Team\nMoustache Leads")

        import os
        frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')
        html_body = _build_email_html(body_text, frontend_url, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)

        if send_type == 'schedule' and scheduled_at:
            sched_col = db_instance.get_collection('scheduled_emails')
            result = sched_col.insert_one({
                'subject': subject,
                'body': html_body,
                'recipients': recipients,
                'scheduled_at': _parse_ist_to_utc(scheduled_at),
                'status': 'pending',
                'source_tab': data.get('source_tab', ''),
                'is_push_mail': True,
                'offer_ids': offer_ids,
                'created_by': admin_user.get('username', ''),
                'created_at': datetime.utcnow(),
            })
            # Log to history
            try:
                history_col = db_instance.get_collection('offer_send_history')
                if history_col is not None:
                    history_col.insert_one({
                        'type': 'email', 'send_mode': 'scheduled', 'subject': subject,
                        'offer_ids': offer_ids, 'offer_names': [o.get('name', '') for o in offers],
                        'recipient_count': len(recipients), 'recipient_emails': recipients[:20],
                        'recipient_type': 'selected_users' if recipient_ids else 'all_users',
                        'sent_by': admin_user.get('username', ''),
                        'source_tab': data.get('source_tab', ''), 'created_at': datetime.utcnow(),
                        'scheduled_at': _parse_ist_to_utc(scheduled_at), 'status': 'scheduled',
                    })
            except Exception:
                pass
            return jsonify({'success': True, 'scheduled_id': str(result.inserted_id)})

        if send_type == 'support':
            from bson import ObjectId as OId
            support_col = db_instance.get_collection('support_messages')
            count = 0
            for u in all_users:
                try:
                    support_col.insert_one({
                        'user_id': OId(str(u['_id'])),
                        'username': u.get('username', ''),
                        'email': u.get('email', ''),
                        'subject': subject,
                        'body': 'You have new offer recommendations from the admin team.',
                        'image_url': None,
                        'status': 'replied',
                        'replies': [{'_id': OId(), 'text': body_text, 'from': 'admin', 'image_url': None, 'created_at': datetime.utcnow()}],
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'read_by_admin': True,
                        'read_by_user': False,
                    })
                    # Trigger email notification for this support message
                    if u.get('email'):
                        try:
                            from routes.support_messages import _send_support_notification_email
                            _send_support_notification_email(u['email'], u.get('username', 'User'), is_admin_reply=True)
                        except Exception as email_err:
                            logging.warning(f"Support email trigger failed for {u.get('username')}: {email_err}")
                    count += 1
                except Exception:
                    pass
            # Log support send history
            try:
                history_col = db_instance.get_collection('offer_send_history')
                if history_col is not None:
                    history_col.insert_one({
                        'type': 'support',
                        'send_mode': 'support',
                        'subject': subject,
                        'offer_ids': offer_ids,
                        'offer_names': [o.get('name', '') for o in offers],
                        'recipient_count': count,
                        'recipient_emails': [u.get('email', '') for u in all_users[:20]],
                        'recipient_type': 'selected_users' if recipient_ids else 'all_users',
                        'sent_by': admin_user.get('username', ''),
                        'source_tab': data.get('source_tab', ''),
                        'created_at': datetime.utcnow(),
                        'status': 'sent',
                    })
            except Exception:
                pass
            return jsonify({'success': True, 'sent_count': count})

        # send_now — BCC batches
        email_service = get_email_service()

        def send_bcc():
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            batch_size = 50
            logging.info(f"📧 Push mail: sending to {len(recipients)} recipients in batches of {batch_size}")
            sent = 0
            for i in range(0, len(recipients), batch_size):
                batch = recipients[i:i + batch_size]
                try:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = email_service.from_email
                    msg['To'] = email_service.from_email
                    msg['Bcc'] = ', '.join(batch)
                    msg.attach(MIMEText(html_body, 'html'))
                    ok = email_service._send_email_smtp(msg)
                    if ok:
                        sent += len(batch)
                        logging.info(f"📧 Push mail batch {i//batch_size + 1}: sent to {len(batch)} recipients")
                    else:
                        logging.error(f"❌ Push mail batch {i//batch_size + 1}: SMTP returned False")
                except Exception as ex:
                    logging.error(f"❌ Push mail batch error: {ex}")
            logging.info(f"📧 Push mail complete: {sent}/{len(recipients)} sent")

        threading.Thread(target=send_bcc, daemon=True).start()

        # Log activity + send history
        try:
            offer_names = [o.get('name', '') for o in offers]
            recipient_emails = recipients[:20]  # Store first 20 for display
            
            activity_col = db_instance.get_collection('email_activity_logs')
            if activity_col is not None:
                activity_col.insert_one({
                    'action': 'sent', 'source': 'push_mail',
                    'offer_ids': offer_ids, 'offer_count': len(offer_ids),
                    'recipient_type': 'selected_users' if recipient_ids else 'all_users',
                    'recipient_count': len(recipients),
                    'admin_username': admin_user.get('username', ''),
                    'created_at': datetime.utcnow(),
                })
            
            history_col = db_instance.get_collection('offer_send_history')
            if history_col is not None:
                history_col.insert_one({
                    'type': 'email',
                    'send_mode': 'send_now',
                    'subject': subject,
                    'offer_ids': offer_ids,
                    'offer_names': offer_names,
                    'recipient_count': len(recipients),
                    'recipient_emails': recipient_emails,
                    'recipient_type': 'selected_users' if recipient_ids else 'all_users',
                    'sent_by': admin_user.get('username', ''),
                    'source_tab': data.get('source_tab', ''),
                    'created_at': datetime.utcnow(),
                    'status': 'sent',
                })
        except Exception:
            pass

        return jsonify({'success': True, 'sent_count': len(recipients)})

    except Exception as e:
        logging.error(f"Push mail error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/schedule-send', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def schedule_send():
    """Schedule send for selected offers"""
    try:
        from bson import ObjectId as OId

        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])
        recipient_ids = data.get('recipient_ids', [])
        custom_emails = data.get('custom_emails', [])
        scheduled_at = data.get('scheduled_at')
        send_type = data.get('send_type', 'schedule')
        send_frequency = data.get('send_frequency', 'single')
        message_body = data.get('message_body', '')
        subject = data.get('subject', 'Offers from Moustache Leads')
        source_tab = data.get('source_tab', '')
        template_style = data.get('template_style', 'table')
        visible_fields = data.get('visible_fields')
        see_more_fields = data.get('see_more_fields')
        default_image = data.get('default_image', '')
        payout_type = data.get('payout_type', 'publisher')
        mask_preview_links = data.get('mask_preview_links', False)
        payment_terms = data.get('payment_terms', '')
        custom_preview_url = data.get('custom_preview_url', '')
        custom_preview_urls = data.get('custom_preview_urls', {})
        preview_in_email = data.get('preview_in_email', 'both')
        custom_preview_in_email = data.get('custom_preview_in_email', 'both')
        admin_user = request.current_user

        if not offer_ids and not message_body:
            return jsonify({'error': 'offer_ids or message_body required'}), 400
        if not recipient_ids and not custom_emails:
            return jsonify({'error': 'At least one recipient required'}), 400

        # Resolve recipient emails
        users_col = db_instance.get_collection('users')
        emails = list(custom_emails)
        if recipient_ids:
            for uid in recipient_ids:
                try:
                    u = users_col.find_one({'_id': OId(uid)})
                    if u and u.get('email'):
                        emails.append(u['email'])
                except Exception:
                    pass

        # Build HTML body
        offers_col = db_instance.get_collection('offers')
        offers = list(offers_col.find({'offer_id': {'$in': offer_ids}})) if offer_ids else []

        if not message_body:
            if send_frequency == 'single' and len(offers) == 1:
                message_body = f"Please check out this offer we've selected for you."
            else:
                message_body = f"We have {len(offers)} great offers for you. Check out the details below."

        import os
        frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')
        html_body = _build_email_html(message_body, frontend_url, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)

        if send_type == 'schedule' and scheduled_at:
            sched_col = db_instance.get_collection('scheduled_emails')
            result = sched_col.insert_one({
                'subject': subject,
                'body': html_body,
                'recipients': emails,
                'scheduled_at': _parse_ist_to_utc(scheduled_at),
                'status': 'pending',
                'source_tab': source_tab,
                'send_frequency': send_frequency,
                'offer_ids': offer_ids,
                'created_by': admin_user.get('username', ''),
                'created_at': datetime.utcnow(),
            })
            # Log scheduled email to history
            try:
                offers_col_s = db_instance.get_collection('offers')
                offer_names_s = [o.get('name', '') for o in offers_col_s.find({'offer_id': {'$in': offer_ids}}, {'name': 1})] if offer_ids else []
                history_col = db_instance.get_collection('offer_send_history')
                if history_col is not None:
                    history_col.insert_one({
                        'type': 'email', 'send_mode': 'scheduled', 'subject': subject,
                        'offer_ids': offer_ids, 'offer_names': offer_names_s,
                        'recipient_count': len(emails), 'recipient_emails': emails[:20],
                        'recipient_type': 'targeted', 'sent_by': admin_user.get('username', ''),
                        'source_tab': source_tab, 'created_at': datetime.utcnow(),
                        'scheduled_at': _parse_ist_to_utc(scheduled_at),
                        'status': 'scheduled',
                    })
            except Exception:
                pass
            return jsonify({'success': True, 'scheduled_id': str(result.inserted_id)})

        # send_now
        import threading
        email_service = get_email_service()

        def send_bcc():
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            for i in range(0, len(emails), 50):
                batch = emails[i:i + 50]
                try:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = email_service.from_email
                    msg['To'] = email_service.from_email
                    msg['Bcc'] = ', '.join(batch)
                    msg.attach(MIMEText(html_body, 'html'))
                    email_service._send_email_smtp(msg)
                except Exception as ex:
                    logging.error(f"Schedule send batch error: {ex}")

        threading.Thread(target=send_bcc, daemon=True).start()

        # Log send history
        try:
            offers_col_h = db_instance.get_collection('offers')
            offer_names_h = [o.get('name', '') for o in offers_col_h.find({'offer_id': {'$in': offer_ids}}, {'name': 1})] if offer_ids else []
            history_col = db_instance.get_collection('offer_send_history')
            if history_col is not None:
                history_col.insert_one({
                    'type': 'email', 'send_mode': send_type, 'subject': subject,
                    'offer_ids': offer_ids, 'offer_names': offer_names_h,
                    'recipient_count': len(emails), 'recipient_emails': emails[:20],
                    'recipient_type': 'targeted', 'sent_by': admin_user.get('username', ''),
                    'source_tab': source_tab, 'created_at': datetime.utcnow(), 'status': 'sent',
                })
        except Exception:
            pass

        return jsonify({'success': True, 'sent_count': len(emails)})

    except Exception as e:
        logging.error(f"Schedule send error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/send-history', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_send_history():
    """Get history of all emails/support messages sent from offer access requests"""
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        history_type = request.args.get('type', '')

        # If type=push_mail, query from push_mail_history collection
        if history_type == 'push_mail':
            col = db_instance.get_collection('push_mail_history')
            if col is None:
                return safe_json_response({'history': [], 'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0}})
            total = col.count_documents({})
            items = list(col.find({}).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page))
        else:
            col = db_instance.get_collection('offer_send_history')
            if col is None:
                return safe_json_response({'history': [], 'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0}})
            total = col.count_documents({})
            items = list(col.find({}).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page))

        for item in items:
            item['_id'] = str(item['_id'])

        return safe_json_response({
            'history': items,
            'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': max(1, (total + per_page - 1) // per_page)},
        })
    except Exception as e:
        logging.error(f"Send history error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-health/<offer_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def check_offer_health(offer_id):
    """Check health status of a specific offer"""
    try:
        from services.health_check_service import HealthCheckService
        offers_col = db_instance.get_collection('offers')
        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            return jsonify({'health': {'status': 'not_found', 'failures': [{'criterion': 'offer_missing', 'detail': f'Offer {offer_id} not found in database'}]}}), 200

        health_service = HealthCheckService()
        results = health_service.evaluate_offers_batch([offer])
        health = results.get(offer_id, {'status': 'unknown', 'failures': []})
        return jsonify({'health': health, 'offer_id': offer_id, 'offer_name': offer.get('name', '')})
    except Exception as e:
        logging.error(f"Offer health check error: {e}", exc_info=True)
        return jsonify({'health': {'status': 'error', 'failures': [{'criterion': 'check_failed', 'detail': str(e)}]}}), 200


@admin_offer_requests_bp.route('/offer-access-requests/push-mail-check-duplicates', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def push_mail_check_duplicates():
    """Check if push mail was already sent for these offers to these users"""
    try:
        from bson import ObjectId as OId
        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])
        recipient_ids = data.get('recipient_ids', [])

        if not offer_ids or not recipient_ids:
            return jsonify({'has_duplicates': False, 'duplicates': []})

        history_col = db_instance.get_collection('push_mail_history')
        if history_col is None:
            return jsonify({'has_duplicates': False, 'duplicates': []})

        # Find any push_mail_history entries matching these offer_ids AND recipient_ids
        duplicates = []
        for oid in offer_ids:
            existing = list(history_col.find({
                'offer_id': oid,
                'recipient_ids': {'$in': recipient_ids},
                'status': {'$in': ['sent', 'sending', 'scheduled']},
            }).sort('created_at', -1).limit(20))
            for entry in existing:
                for rid in recipient_ids:
                    if rid in (entry.get('recipient_ids') or []):
                        duplicates.append({
                            'offer_id': oid,
                            'offer_name': entry.get('offer_name', ''),
                            'user_id': rid,
                            'username': '',
                            'pushed_at': entry.get('created_at', ''),
                        })

        # Resolve usernames
        if duplicates:
            users_col = db_instance.get_collection('users')
            user_ids_set = list(set(d['user_id'] for d in duplicates))
            obj_ids = []
            for uid in user_ids_set:
                try:
                    obj_ids.append(OId(uid))
                except Exception:
                    pass
            users = {str(u['_id']): u.get('username', '') for u in users_col.find({'_id': {'$in': obj_ids}}, {'username': 1})}
            for d in duplicates:
                d['username'] = users.get(d['user_id'], '')
                if d.get('pushed_at') and hasattr(d['pushed_at'], 'isoformat'):
                    d['pushed_at'] = d['pushed_at'].isoformat() + 'Z'

        # Deduplicate
        seen = set()
        unique_dupes = []
        for d in duplicates:
            key = f"{d['offer_id']}_{d['user_id']}"
            if key not in seen:
                seen.add(key)
                unique_dupes.append(d)

        return jsonify({
            'has_duplicates': len(unique_dupes) > 0,
            'duplicates': unique_dupes,
        })
    except Exception as e:
        logging.error(f"Push mail duplicate check error: {e}", exc_info=True)
        return jsonify({'has_duplicates': False, 'duplicates': [], 'error': str(e)})


@admin_offer_requests_bp.route('/offer-access-requests/push-mail-v2', methods=['POST'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def push_mail_v2():
    """Push mail v2 — supports one_by_one and all_in_one send modes"""
    try:
        import threading
        import time as time_mod
        import os
        from bson import ObjectId as OId

        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])
        recipient_ids = data.get('recipient_ids', [])
        custom_emails = data.get('custom_emails', [])
        send_mode = data.get('send_mode', 'all_in_one')  # one_by_one | all_in_one
        interval_minutes = int(data.get('interval_minutes', 5))
        send_type = data.get('send_type', 'send_now')  # send_now | schedule | support
        scheduled_at = data.get('scheduled_at')
        subject = data.get('subject', '🚀 Push Mail — Check These Offers!')
        message_body = data.get('message_body', '')
        source_tab = data.get('source_tab', '')
        template_style = data.get('template_style', 'table')
        visible_fields = data.get('visible_fields')
        see_more_fields = data.get('see_more_fields')
        default_image = data.get('default_image', '')
        payout_type = data.get('payout_type', 'publisher')
        mask_preview_links = data.get('mask_preview_links', False)
        payment_terms = data.get('payment_terms', '')
        custom_preview_url = data.get('custom_preview_url', '')
        custom_preview_urls = data.get('custom_preview_urls', {})
        preview_in_email = data.get('preview_in_email', 'both')
        custom_preview_in_email = data.get('custom_preview_in_email', 'both')
        admin_user = request.current_user

        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400
        if not recipient_ids and not custom_emails:
            return jsonify({'error': 'At least one recipient required'}), 400

        # Resolve offers
        offers_col = db_instance.get_collection('offers')
        offers = list(offers_col.find({'offer_id': {'$in': offer_ids}}))
        offer_map = {o['offer_id']: o for o in offers}

        # If default_image is provided, permanently save it to offers without images
        if default_image:
            for o in offers:
                if not o.get('image_url') and not o.get('thumbnail_url'):
                    try:
                        offers_col.update_one(
                            {'_id': o['_id']},
                            {'$set': {'image_url': default_image}}
                        )
                        o['image_url'] = default_image
                    except Exception:
                        pass

        # Resolve recipient emails
        users_col = db_instance.get_collection('users')
        emails = list(custom_emails)
        resolved_users = []
        if recipient_ids:
            obj_ids = []
            for rid in recipient_ids:
                try:
                    obj_ids.append(OId(rid))
                except Exception:
                    pass
            resolved_users = list(users_col.find({'_id': {'$in': obj_ids}}, {'email': 1, 'username': 1, '_id': 1}))
            for u in resolved_users:
                if u.get('email'):
                    emails.append(u['email'])

        if not emails:
            return jsonify({'error': 'No valid recipient emails found'}), 400

        frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')
        email_service = get_email_service()
        admin_username = admin_user.get('username', 'admin')
        history_col = db_instance.get_collection('push_mail_history')

        # ── SUPPORT MODE ──
        if send_type == 'support':
            support_col = db_instance.get_collection('support_messages')
            count = 0

            # Build body from all offers
            if not message_body:
                import calendar as cal_mod
                day_name = cal_mod.day_name[datetime.utcnow().weekday()]
                message_body = f"Happy {day_name}!\n\nWe have some great offers for you to push traffic on. Check out the details below.\n\nThanks and have a great weekend!\n\nBest regards,\nMoustache Leads Team\nMoustache Leads"

            for u in resolved_users:
                try:
                    support_col.insert_one({
                        'user_id': OId(str(u['_id'])),
                        'username': u.get('username', ''),
                        'email': u.get('email', ''),
                        'subject': subject,
                        'body': 'You have new push mail from the admin team.',
                        'image_url': None,
                        'status': 'replied',
                        'replies': [{'_id': OId(), 'text': message_body, 'from': 'admin', 'image_url': None, 'created_at': datetime.utcnow()}],
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'read_by_admin': True,
                        'read_by_user': False,
                    })
                    if u.get('email'):
                        try:
                            from routes.support_messages import _send_support_notification_email
                            _send_support_notification_email(u['email'], u.get('username', 'User'), is_admin_reply=True)
                        except Exception:
                            pass
                    count += 1
                except Exception:
                    pass

            # If scheduled support, also schedule the email
            if scheduled_at:
                sched_col = db_instance.get_collection('scheduled_emails')
                html_body = _build_email_html(message_body, frontend_url, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)
                sched_col.insert_one({
                    'subject': subject, 'body': html_body, 'recipients': emails,
                    'scheduled_at': _parse_ist_to_utc(scheduled_at), 'status': 'pending',
                    'source_tab': source_tab, 'is_push_mail': True, 'offer_ids': offer_ids,
                    'created_by': admin_username, 'created_at': datetime.utcnow(),
                })

            # Log to push_mail_history (one batch entry)
            if history_col is not None:
                history_col.insert_one({
                    'offer_ids': offer_ids,
                    'offer_names': [o.get('name', '') for o in offers],
                    'offer_count': len(offers),
                    'recipient_ids': recipient_ids, 'recipient_emails': emails[:20],
                    'recipient_count': len(emails),
                    'send_mode': send_mode, 'interval_minutes': interval_minutes,
                    'source_tab': source_tab, 'sent_by': admin_username,
                    'created_at': datetime.utcnow(), 'status': 'sent', 'type': 'push_mail',
                    'subject': subject,
                })

            return jsonify({'success': True, 'sent_count': count})

        # ── SCHEDULE MODE ──
        if send_type == 'schedule' and scheduled_at:
            sched_col = db_instance.get_collection('scheduled_emails')

            if send_mode == 'one_by_one':
                # Schedule each offer as a separate email
                for idx, oid in enumerate(offer_ids):
                    o = offer_map.get(oid, {})
                    if not message_body:
                        import calendar as cal_mod
                        day_name = cal_mod.day_name[datetime.utcnow().weekday()]
                        pub_payout = round(float(o.get('payout', 0) or 0) * 0.8, 2)
                        body = f"Happy {day_name}!\n\nPlease push more traffic on this offer\n\nThanks and have a great weekend\n\n📋 {o.get('name', '')}\n💰 Amount: ${pub_payout}\n📂 Category: {o.get('category', o.get('vertical', 'N/A'))}\n🚦 Traffic Source: {', '.join(o.get('allowed_traffic_sources', [])) or 'All'}\n🔍 Preview: {o.get('preview_url', 'Not available')}\n\n{o.get('description', '')}"
                    else:
                        body = message_body
                    html_body = _build_email_html(body, frontend_url, offers=[o], payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)
                    base_dt = _parse_ist_to_utc(scheduled_at)
                    offset_dt = base_dt + timedelta(minutes=interval_minutes * idx)
                    sched_col.insert_one({
                        'subject': subject, 'body': html_body, 'recipients': emails,
                        'scheduled_at': offset_dt, 'status': 'pending',
                        'source_tab': source_tab, 'is_push_mail': True,
                        'offer_ids': [oid], 'created_by': admin_username,
                        'created_at': datetime.utcnow(),
                    })
                    if history_col is not None:
                        history_col.insert_one({
                            'offer_id': oid, 'offer_name': o.get('name', ''),
                            'recipient_ids': recipient_ids, 'recipient_emails': emails[:20],
                            'send_mode': 'one_by_one', 'interval_minutes': interval_minutes,
                            'source_tab': source_tab, 'sent_by': admin_username,
                            'created_at': datetime.utcnow(), 'status': 'scheduled', 'type': 'push_mail',
                            'scheduled_at': offset_dt, 'subject': subject,
                        })
            else:
                # all_in_one: single scheduled email
                if not message_body:
                    import calendar as cal_mod
                    day_name = cal_mod.day_name[datetime.utcnow().weekday()]
                    message_body = f"Happy {day_name}!\n\nWe have some great offers for you. Check out the details below.\n\nThanks and have a great weekend!\n\nBest regards,\nMoustache Leads Team\nMoustache Leads"
                html_body = _build_email_html(message_body, frontend_url, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)
                result = sched_col.insert_one({
                    'subject': subject, 'body': html_body, 'recipients': emails,
                    'scheduled_at': _parse_ist_to_utc(scheduled_at), 'status': 'pending',
                    'source_tab': source_tab, 'is_push_mail': True,
                    'offer_ids': offer_ids, 'created_by': admin_username,
                    'created_at': datetime.utcnow(),
                })
                if history_col is not None:
                    history_col.insert_one({
                        'offer_ids': offer_ids,
                        'offer_names': [o.get('name', '') for o in offers],
                        'offer_count': len(offers),
                        'recipient_ids': recipient_ids, 'recipient_emails': emails[:20],
                        'recipient_count': len(emails),
                        'send_mode': 'all_in_one', 'interval_minutes': 0,
                        'source_tab': source_tab, 'sent_by': admin_username,
                        'created_at': datetime.utcnow(), 'status': 'scheduled', 'type': 'push_mail',
                        'scheduled_at': _parse_ist_to_utc(scheduled_at), 'subject': subject,
                    })
            return jsonify({'success': True, 'scheduled': True, 'offer_count': len(offer_ids)})

        # ── SEND NOW MODE ──
        if send_mode == 'one_by_one':
            # Log one batch entry for the whole one-by-one send
            if history_col is not None:
                history_col.insert_one({
                    'offer_ids': offer_ids,
                    'offer_names': [o.get('name', '') for o in offers],
                    'offer_count': len(offers),
                    'recipient_ids': recipient_ids, 'recipient_emails': emails[:20],
                    'recipient_count': len(emails),
                    'send_mode': 'one_by_one', 'interval_minutes': interval_minutes,
                    'source_tab': source_tab, 'sent_by': admin_username,
                    'created_at': datetime.utcnow(), 'status': 'sending', 'type': 'push_mail',
                    'subject': subject,
                })

            def send_one_by_one():
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart
                for idx, oid in enumerate(offer_ids):
                    o = offer_map.get(oid, {})
                    if not message_body:
                        import calendar as cal_mod
                        day_name = cal_mod.day_name[datetime.utcnow().weekday()]
                        pub_payout = round(float(o.get('payout', 0) or 0) * 0.8, 2)
                        body = f"Happy {day_name}!\n\nPlease push more traffic on this offer\n\nThanks and have a great weekend\n\n📋 {o.get('name', '')}\n💰 Amount: ${pub_payout}\n📂 Category: {o.get('category', o.get('vertical', 'N/A'))}\n🚦 Traffic Source: {', '.join(o.get('allowed_traffic_sources', [])) or 'All'}\n🔍 Preview: {o.get('preview_url', 'Not available')}\n\n{o.get('description', '')}"
                    else:
                        body = message_body
                    html_body = _build_email_html(body, frontend_url, offers=[o], payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)
                    # Send in BCC batches
                    for i in range(0, len(emails), 50):
                        batch = emails[i:i + 50]
                        try:
                            msg = MIMEMultipart('alternative')
                            msg['Subject'] = subject
                            msg['From'] = email_service.from_email
                            msg['To'] = email_service.from_email
                            msg['Bcc'] = ', '.join(batch)
                            msg.attach(MIMEText(html_body, 'html'))
                            email_service._send_email_smtp(msg)
                        except Exception as ex:
                            logging.error(f"Push mail v2 one_by_one batch error: {ex}")
                    # Update batch history status after last offer
                    if idx == len(offer_ids) - 1:
                        try:
                            if history_col is not None:
                                history_col.update_one(
                                    {'sent_by': admin_username, 'status': 'sending', 'type': 'push_mail', 'send_mode': 'one_by_one'},
                                    {'$set': {'status': 'sent'}},
                                )
                        except Exception:
                            pass
                    # Wait interval before next offer (skip after last)
                    if idx < len(offer_ids) - 1 and interval_minutes > 0:
                        time_mod.sleep(interval_minutes * 60)

            threading.Thread(target=send_one_by_one, daemon=True).start()
            return jsonify({'success': True, 'sent_count': len(emails), 'mode': 'one_by_one', 'total_offers': len(offer_ids)})

        else:
            # all_in_one: send all offers in one email
            if not message_body:
                import calendar as cal_mod
                day_name = cal_mod.day_name[datetime.utcnow().weekday()]
                message_body = f"Happy {day_name}!\n\nWe have some great offers for you. Check out the details below.\n\nThanks and have a great weekend!\n\nBest regards,\nMoustache Leads Team\nMoustache Leads"
            html_body = _build_email_html(message_body, frontend_url, offers=offers, payout_type=payout_type, template_style=template_style, visible_fields=visible_fields, default_image=default_image, see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, payment_terms=payment_terms, custom_preview_url=custom_preview_url, custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, custom_preview_in_email=custom_preview_in_email)

            if history_col is not None:
                history_col.insert_one({
                    'offer_ids': offer_ids,
                    'offer_names': [o.get('name', '') for o in offers],
                    'offer_count': len(offers),
                    'recipient_ids': recipient_ids, 'recipient_emails': emails[:20],
                    'recipient_count': len(emails),
                    'send_mode': 'all_in_one', 'interval_minutes': 0,
                    'source_tab': source_tab, 'sent_by': admin_username,
                    'created_at': datetime.utcnow(), 'status': 'sent', 'type': 'push_mail',
                    'subject': subject,
                })

            def send_all_in_one():
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart
                for i in range(0, len(emails), 50):
                    batch = emails[i:i + 50]
                    try:
                        msg = MIMEMultipart('alternative')
                        msg['Subject'] = subject
                        msg['From'] = email_service.from_email
                        msg['To'] = email_service.from_email
                        msg['Bcc'] = ', '.join(batch)
                        msg.attach(MIMEText(html_body, 'html'))
                        email_service._send_email_smtp(msg)
                    except Exception as ex:
                        logging.error(f"Push mail v2 all_in_one batch error: {ex}")

            threading.Thread(target=send_all_in_one, daemon=True).start()
            return jsonify({'success': True, 'sent_count': len(emails), 'mode': 'all_in_one'})

    except Exception as e:
        logging.error(f"Push mail v2 error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offer_requests_bp.route('/offer-access-requests/charts-data', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_charts_data():
    """Return REAL data for all offer access request charts. No estimates."""
    try:
        from datetime import datetime as dt, timedelta
        from bson import ObjectId
        requests_col = db_instance.get_collection('affiliate_requests')
        offers_col = db_instance.get_collection('offers')
        history_col = db_instance.get_collection('offer_send_history')
        push_history_col = db_instance.get_collection('push_mail_history')
        clicks_col = db_instance.get_collection('clicks')

        now = dt.utcnow()
        days_30_ago = now - timedelta(days=30)

        # ── Chart 1: Email Campaign Funnel (REAL DATA ONLY) ──
        # We combine offer_send_history + push_mail_history for "sent"
        # For "clicked" we only count clicks from users who received the email, after send time
        funnel = {'sent': 0, 'clicked': 0, 'applied': 0, 'approved': 0}

        # Collect all campaign data: {offer_ids, recipient_user_ids, sent_at}
        campaigns = []

        # From offer_send_history (regular sends) — no user IDs available, so we can only count sent
        if history_col is not None:
            for doc in history_col.find({'created_at': {'$gte': days_30_ago}}):
                funnel['sent'] += doc.get('recipient_count', 0)
                # No recipient_ids stored, so we can't track clicks per user
                campaigns.append({
                    'offer_ids': doc.get('offer_ids', []),
                    'recipient_ids': [],  # Not available
                    'sent_at': doc.get('created_at', now),
                })

        # From push_mail_history (push mails) — HAS recipient_ids
        if push_history_col is not None:
            for doc in push_history_col.find({'created_at': {'$gte': days_30_ago}}):
                funnel['sent'] += doc.get('recipient_count', 0)
                campaigns.append({
                    'offer_ids': doc.get('offer_ids', []),
                    'recipient_ids': doc.get('recipient_ids', []),
                    'sent_at': doc.get('created_at', now),
                })

        # Count clicks ONLY from recipients who received the email, AFTER send time
        if clicks_col is not None:
            for camp in campaigns:
                if not camp['offer_ids']:
                    continue
                click_query = {
                    'offer_id': {'$in': camp['offer_ids']},
                    'timestamp': {'$gte': camp['sent_at']},
                }
                # If we have recipient_ids, filter clicks to only those users
                if camp['recipient_ids']:
                    click_query['user_id'] = {'$in': camp['recipient_ids']}
                    funnel['clicked'] += clicks_col.count_documents(click_query)
                # If no recipient_ids (regular send), we skip — can't verify

        # Applied & Approved: count requests for campaign offer_ids, from campaign recipients, after send
        all_campaign_offer_ids = set()
        all_campaign_user_ids = set()
        earliest_send = now
        for camp in campaigns:
            all_campaign_offer_ids.update(camp['offer_ids'])
            all_campaign_user_ids.update(camp['recipient_ids'])
            if camp['sent_at'] < earliest_send:
                earliest_send = camp['sent_at']

        if all_campaign_offer_ids:
            applied_query = {
                'offer_id': {'$in': list(all_campaign_offer_ids)},
                'requested_at': {'$gte': earliest_send},
            }
            # If we have user IDs, filter to only those users
            if all_campaign_user_ids:
                applied_query['user_id'] = {'$in': list(all_campaign_user_ids)}

            funnel['applied'] = requests_col.count_documents(applied_query)
            funnel['approved'] = requests_col.count_documents({**applied_query, 'status': 'approved'})

        # ── Chart 2: Request Trend (30 days) — VERIFIED: direct count from affiliate_requests ──
        trend = []
        pipeline = [
            {'$match': {'requested_at': {'$gte': days_30_ago}}},
            {'$group': {
                '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$requested_at'}},
                'count': {'$sum': 1},
            }},
            {'$sort': {'_id': 1}},
        ]
        trend_raw = {d['_id']: d['count'] for d in requests_col.aggregate(pipeline)}
        for i in range(30):
            day = (now - timedelta(days=29 - i)).strftime('%Y-%m-%d')
            trend.append({'date': day, 'requests': trend_raw.get(day, 0)})

        # ── Chart 5: Approval Rate by Network — VERIFIED: direct from affiliate_requests + offers ──
        network_stats = []
        pipeline = [
            {'$group': {
                '_id': '$offer_id',
                'total': {'$sum': 1},
                'approved': {'$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}},
                'rejected': {'$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}},
                'pending': {'$sum': {'$cond': [{'$in': ['$status', ['pending', 'review']]}, 1, 0]}},
            }},
        ]
        offer_stats = {d['_id']: d for d in requests_col.aggregate(pipeline)}

        if offer_stats and offers_col is not None:
            offer_ids_list = list(offer_stats.keys())
            offer_docs = {d['offer_id']: d.get('network', 'Unknown') for d in offers_col.find(
                {'offer_id': {'$in': offer_ids_list}}, {'offer_id': 1, 'network': 1}
            )}

            network_agg = {}
            for oid, stats in offer_stats.items():
                net = offer_docs.get(oid, 'Unknown') or 'Unknown'
                if net not in network_agg:
                    network_agg[net] = {'network': net, 'approved': 0, 'rejected': 0, 'pending': 0, 'total': 0}
                network_agg[net]['approved'] += stats['approved']
                network_agg[net]['rejected'] += stats['rejected']
                network_agg[net]['pending'] += stats['pending']
                network_agg[net]['total'] += stats['total']

            network_stats = sorted(network_agg.values(), key=lambda x: x['total'], reverse=True)[:10]

        from utils.json_serializer import serialize_for_json
        return jsonify(serialize_for_json({
            'funnel': funnel,
            'trend': trend,
            'network_stats': network_stats,
        }))
    except Exception as e:
        logging.error(f"Charts data error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ── Publisher Intelligence Panel Data ──────────────────────────────────────

@admin_offer_requests_bp.route('/offer-access-requests/publisher-intelligence/<user_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offer-access-requests')
def get_publisher_intelligence(user_id):
    """
    Aggregated publisher intelligence for the email sending modal.
    Returns: profile, stats, mail history, search keywords, offer categories,
    selection accuracy, and recent send history.
    """
    try:
        from bson import ObjectId
        from utils.json_serializer import serialize_for_json

        users_col = db_instance.get_collection('users')
        clicks_col = db_instance.get_collection('clicks')
        conversions_col = db_instance.get_collection('conversions')
        requests_col = db_instance.get_collection('affiliate_requests')
        search_logs_col = db_instance.get_collection('search_logs')
        email_activity_col = db_instance.get_collection('email_activity_logs')
        offer_send_col = db_instance.get_collection('offer_send_history')
        push_mail_col = db_instance.get_collection('push_mail_history')
        insight_email_col = db_instance.get_collection('insight_email_logs')
        offers_col = db_instance.get_collection('offers')

        # ── 1. User profile ──
        user = None
        try:
            user = users_col.find_one({'_id': ObjectId(user_id)})
        except:
            pass
        if not user:
            # Try by string user_id field
            user = users_col.find_one({'user_id': user_id}) if users_col is not None else None
        if not user:
            return jsonify({'error': 'User not found'}), 404

        uid_str = str(user['_id'])
        username = user.get('username', '')
        first_name = user.get('first_name', '')
        last_name = user.get('last_name', '')
        email = user.get('email', '')
        country = user.get('country', '') or user.get('geo', {}).get('country', '')
        created_at = user.get('created_at')
        avatar_initials = ''
        if first_name:
            avatar_initials = first_name[0].upper()
            if last_name:
                avatar_initials += last_name[0].upper()
        elif username:
            avatar_initials = username[:2].upper()

        profile = {
            'user_id': uid_str,
            'username': username,
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'country': country,
            'created_at': created_at,
            'avatar_initials': avatar_initials,
            'account_status': user.get('account_status', 'active'),
            'vertical': user.get('vertical', '') or user.get('traffic_vertical', ''),
        }

        # ── 2. Click & conversion stats ──
        total_clicks = 0
        real_clicks = 0
        total_conversions = 0
        if clicks_col is not None:
            total_clicks = clicks_col.count_documents({'user_id': uid_str})
            real_clicks = clicks_col.count_documents({'user_id': uid_str, 'fraud_score': {'$lt': 50}})
        if conversions_col is not None:
            total_conversions = conversions_col.count_documents({'user_id': uid_str})
        conv_rate = round((total_conversions / total_clicks * 100), 2) if total_clicks > 0 else 0

        stats = {
            'total_clicks': total_clicks,
            'real_clicks': real_clicks,
            'conversions': total_conversions,
            'conv_rate': conv_rate,
        }

        # ── 3. Mail history — aggregate from all email collections ──
        mail_history = []
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        total_sent = 0
        sent_today = 0
        last_sent = None
        user_email = email  # from profile section above

        # Broad query that matches all possible field patterns used across collections
        def _user_query(extra_fields=None):
            """Build $or query matching user by id or email across all field naming patterns"""
            conditions = [
                {'user_id': uid_str},
                {'recipient_user_ids': uid_str},
                {'recipient_ids': uid_str},
            ]
            if user_email:
                conditions.append({'recipient_emails': user_email})
            if extra_fields:
                conditions.extend(extra_fields)
            return {'$or': conditions}

        # From email_activity_logs
        if email_activity_col is not None:
            query = _user_query()
            total_from_activity = email_activity_col.count_documents(query)
            total_sent += total_from_activity
            sent_today += email_activity_col.count_documents({**query, 'created_at': {'$gte': today_start}})
            last_activity = email_activity_col.find_one(query, sort=[('created_at', -1)])
            if last_activity:
                last_sent = last_activity.get('created_at')
            # Get recent entries for history table
            for doc in email_activity_col.find(query).sort('created_at', -1).limit(10):
                mail_history.append({
                    'source': doc.get('source', doc.get('action', 'email')),
                    'subject': doc.get('subject', ''),
                    'offer_names': doc.get('offer_names', []),
                    'offer_count': doc.get('offer_count', len(doc.get('offer_ids', []))),
                    'sent_at': doc.get('created_at'),
                    'status': doc.get('status', 'sent'),
                })

        # From offer_send_history
        if offer_send_col is not None:
            query = _user_query()
            for doc in offer_send_col.find(query).sort('created_at', -1).limit(10):
                total_sent += 1
                dt = doc.get('created_at')
                if dt and dt >= today_start:
                    sent_today += 1
                if dt and (last_sent is None or dt > last_sent):
                    last_sent = dt
                mail_history.append({
                    'source': doc.get('source', 'offer_request'),
                    'subject': doc.get('subject', 'Offer Recommendation'),
                    'offer_names': doc.get('offer_names', []),
                    'offer_count': doc.get('offer_count', len(doc.get('offer_ids', []))),
                    'sent_at': dt,
                    'status': 'sent',
                })

        # From push_mail_history
        if push_mail_col is not None:
            query = _user_query()
            for doc in push_mail_col.find(query).sort('created_at', -1).limit(5):
                total_sent += 1
                dt = doc.get('created_at')
                if dt and dt >= today_start:
                    sent_today += 1
                if dt and (last_sent is None or dt > last_sent):
                    last_sent = dt
                mail_history.append({
                    'source': 'push_mail',
                    'subject': doc.get('subject', 'Push Mail'),
                    'offer_names': doc.get('offer_names', []),
                    'offer_count': len(doc.get('offer_ids', [])),
                    'sent_at': dt,
                    'status': 'sent',
                })

        # Sort mail_history by sent_at desc, limit to 15
        mail_history.sort(key=lambda x: x.get('sent_at') or datetime.min, reverse=True)
        mail_history = mail_history[:15]

        mail_stats = {
            'total_sent': total_sent,
            'sent_today': sent_today,
            'last_sent': last_sent,
        }

        # ── 4. Search keyword history ──
        keywords = []
        if search_logs_col is not None:
            pipeline = [
                {'$match': {'user_id': uid_str}},
                {'$group': {'_id': '$keyword', 'count': {'$sum': 1}, 'last_searched': {'$max': '$searched_at'}}},
                {'$sort': {'count': -1}},
                {'$limit': 20},
            ]
            keywords = [{'keyword': d['_id'], 'count': d['count'], 'last_searched': d.get('last_searched')} for d in search_logs_col.aggregate(pipeline)]

        # ── 5. Offer category breakdown (from requests) ──
        categories = []
        if requests_col is not None:
            pipeline = [
                {'$match': {'user_id': uid_str}},
                {'$group': {'_id': '$offer_category', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10},
            ]
            categories = [{'category': d['_id'] or 'Unknown', 'count': d['count']} for d in requests_col.aggregate(pipeline)]

        # ── 6. Selection accuracy ──
        accuracy = {'total_requests': 0, 'approved': 0, 'rejected': 0, 'pending': 0, 'on_vertical_pct': 0, 'off_vertical_pct': 0}
        if requests_col is not None:
            accuracy['total_requests'] = requests_col.count_documents({'user_id': uid_str})
            accuracy['approved'] = requests_col.count_documents({'user_id': uid_str, 'status': 'approved'})
            accuracy['rejected'] = requests_col.count_documents({'user_id': uid_str, 'status': 'rejected'})
            accuracy['pending'] = requests_col.count_documents({'user_id': uid_str, 'status': {'$in': ['pending', 'review']}})

            # On-vertical calculation
            user_vertical = (user.get('vertical', '') or user.get('traffic_vertical', '') or '').lower()
            if user_vertical and accuracy['total_requests'] > 0:
                on_vertical = requests_col.count_documents({
                    'user_id': uid_str,
                    'offer_category': {'$regex': user_vertical, '$options': 'i'}
                })
                accuracy['on_vertical_pct'] = round(on_vertical / accuracy['total_requests'] * 100, 1)
                accuracy['off_vertical_pct'] = round(100 - accuracy['on_vertical_pct'], 1)

        # ── 6b. Signup vertical vs actual clicking behaviour ──
        vertical_comparison = {
            'signup_vertical': (user.get('vertical', '') or user.get('traffic_vertical', '') or 'Not set'),
            'actual_clicking': [],
            'match': 'Unknown',
        }
        if clicks_col is not None:
            # Get top categories this user actually clicks on
            try:
                click_cat_pipeline = [
                    {'$match': {'user_id': uid_str}},
                    {'$lookup': {
                        'from': 'offers',
                        'localField': 'offer_id',
                        'foreignField': 'offer_id',
                        'as': 'offer_info'
                    }},
                    {'$unwind': {'path': '$offer_info', 'preserveNullAndEmptyArrays': True}},
                    {'$group': {'_id': '$offer_info.category', 'count': {'$sum': 1}}},
                    {'$sort': {'count': -1}},
                    {'$limit': 5},
                ]
                actual_cats = list(clicks_col.aggregate(click_cat_pipeline))
                vertical_comparison['actual_clicking'] = [
                    {'category': d['_id'] or 'Unknown', 'count': d['count']}
                    for d in actual_cats if d.get('_id')
                ]
            except Exception as vc_err:
                logging.warning(f"Vertical comparison error: {vc_err}")

            # Determine match level
            user_vert_lower = vertical_comparison['signup_vertical'].lower()
            if user_vert_lower and user_vert_lower != 'not set' and vertical_comparison['actual_clicking']:
                top_actual = [c['category'].lower() for c in vertical_comparison['actual_clicking'][:2]]
                if any(user_vert_lower in cat or cat in user_vert_lower for cat in top_actual):
                    vertical_comparison['match'] = 'Strong'
                elif any(user_vert_lower in cat or cat in user_vert_lower for cat in [c['category'].lower() for c in vertical_comparison['actual_clicking']]):
                    vertical_comparison['match'] = 'Partial'
                else:
                    vertical_comparison['match'] = 'Off-vertical'

        # ── 7. Offers previously sent to this user (deduplicated) ──
        sent_offers = []
        sent_offer_ids = set()
        if offer_send_col is not None:
            for doc in offer_send_col.find(_user_query()).sort('created_at', -1).limit(30):
                for oid in (doc.get('offer_ids', []) or []):
                    if oid not in sent_offer_ids:
                        sent_offer_ids.add(oid)
        if push_mail_col is not None:
            for doc in push_mail_col.find(_user_query()).sort('created_at', -1).limit(20):
                for oid in (doc.get('offer_ids', []) or []):
                    if oid not in sent_offer_ids:
                        sent_offer_ids.add(oid)

        # Resolve offer names
        if sent_offer_ids and offers_col is not None:
            for o in offers_col.find({'offer_id': {'$in': list(sent_offer_ids)}}, {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1}):
                sent_offers.append({
                    'offer_id': o.get('offer_id'),
                    'name': o.get('name', ''),
                    'payout': o.get('payout', 0),
                    'category': o.get('category', ''),
                })

        return jsonify(serialize_for_json({
            'success': True,
            'profile': profile,
            'stats': stats,
            'mail_stats': mail_stats,
            'mail_history': mail_history,
            'keywords': keywords,
            'categories': categories,
            'accuracy': accuracy,
            'vertical_comparison': vertical_comparison,
            'sent_offers': sent_offers[:30],
        }))

    except Exception as e:
        logging.error(f"Publisher intelligence error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
