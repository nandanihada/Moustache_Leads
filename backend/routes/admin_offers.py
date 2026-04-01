from flask import Blueprint, request, jsonify
from models.offer import Offer
from models.offer_extended import OfferExtended
from models.link_masking import LinkMasking
from utils.auth import token_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response, serialize_for_json
from utils.frontend_mapping import FrontendDatabaseMapper
from services.email_service import get_email_service
from services.health_check_service import HealthCheckService
from services.admin_activity_log_service import log_admin_activity
from database import db_instance
import logging
import threading
import uuid
from datetime import datetime

admin_offers_bp = Blueprint('admin_offers', __name__)
offer_model = Offer()
extended_offer_model = OfferExtended()  # For schedule + smart rules operations
admin_offer_model = offer_model  # Use the same model instance


def _cascade_cleanup_offer(offer_ids):
    """Remove all related data when offers are deleted.
    Cleans up: affiliate_requests, search_logs picks, notifications, etc.
    Runs in background to not block the delete response.
    """
    if not offer_ids:
        return
    if isinstance(offer_ids, str):
        offer_ids = [offer_ids]

    def _cleanup():
        try:
            # 1. Remove affiliate access requests for these offers
            req_col = db_instance.get_collection('affiliate_requests')
            if req_col is not None:
                result = req_col.delete_many({'offer_id': {'$in': offer_ids}})
                logging.info(f"Cascade cleanup: removed {result.deleted_count} affiliate_requests for {len(offer_ids)} offer(s)")

            # 2. Clean up search_logs picked_offer references
            search_col = db_instance.get_collection('search_logs')
            if search_col is not None:
                search_col.update_many(
                    {'picked_offer_id': {'$in': offer_ids}},
                    {'$unset': {'picked_offer_id': '', 'picked_offer_name': ''}}
                )

            # 3. Remove offer-related notifications
            notif_col = db_instance.get_collection('notifications')
            if notif_col is not None:
                notif_col.delete_many({'offer_ids': {'$in': offer_ids}})

        except Exception as e:
            logging.error(f"Cascade cleanup error: {e}", exc_info=True)

    thread = threading.Thread(target=_cleanup, daemon=True)
    thread.start()
link_masking_model = LinkMasking()  # For automatic link masking

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@admin_offers_bp.route('/offers', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def create_offer():
    """Create a new offer (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Log received data at debug level
        logging.debug("CREATE OFFER - Schedule received: %s", data.get("schedule"))
        logging.debug("CREATE OFFER - SmartRules received: %s", data.get("smartRules"))
        
        logging.debug(f"payout_type from frontend: '{data.get('payout_type')}'")
        logging.debug(f"revenue_share_percent from frontend: {data.get('revenue_share_percent')}")
        
        # 🔥 CRITICAL FIX: Apply field mapping for schedule + smart rules
        if 'schedule' in data or 'smartRules' in data:
            mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
            logging.info("📥 CREATE OFFER - After mapping - Schedule: %s", mapped_data.get("schedule"))
            logging.info("📥 CREATE OFFER - After mapping - SmartRules: %s", mapped_data.get("smartRules"))
            data = mapped_data
        
        user = request.current_user
        
        # If promo code is being assigned, fetch its details and add to data
        promo_code_id = data.get('promo_code_id')
        if promo_code_id:
            try:
                from bson import ObjectId
                promo_codes_collection = db_instance.get_collection('promo_codes')
                promo_code = promo_codes_collection.find_one({'_id': ObjectId(promo_code_id)})
                
                if promo_code:
                    # Add promo code details to data
                    data['promo_code'] = promo_code.get('code')
                    data['bonus_amount'] = promo_code.get('bonus_amount')
                    data['bonus_type'] = promo_code.get('bonus_type')
                    data['promo_code_assigned_at'] = datetime.utcnow()
                    data['promo_code_assigned_by'] = str(user['_id'])
                    logging.info(f"✅ Promo code {promo_code.get('code')} will be assigned to new offer")
            except Exception as e:
                logging.error(f"Error fetching promo code details: {str(e)}")
        else:
            # Ensure promo code fields are null if not assigned
            data['promo_code'] = None
            data['bonus_amount'] = None
            data['bonus_type'] = None
            data['promo_code_assigned_at'] = None
            data['promo_code_assigned_by'] = None
        
        # Use extended model if schedule/smart rules data is present
        if 'schedule' in data or 'smartRules' in data:
            offer_data, error = extended_offer_model.create_offer(data, str(user['_id']))
        else:
            offer_data, error = offer_model.create_offer(data, str(user['_id']))
        
        if error:
            return jsonify({'error': error}), 400
        
        # 🔥 AUTO-INJECT network offer URL params if a matching Upward Partner exists
        try:
            from services.tracking_link_generator import apply_network_offer_params
            original_url = offer_data.get('target_url', '')
            offer_data = apply_network_offer_params(offer_data)
            if offer_data.get('target_url') != original_url:
                offer_collection = db_instance.get_collection('offers')
                offer_collection.update_one(
                    {'offer_id': offer_data['offer_id']},
                    {'$set': {'target_url': offer_data['target_url']}}
                )
                logging.info(f"✅ Network params injected into offer URL: {offer_data['target_url']}")
        except Exception as e:
            logging.error(f"❌ Network param injection error (non-critical): {str(e)}")
        
        logging.info("✅ Offer created successfully, now creating masked link...")
        
        # 🔥 AUTO-GENERATE MASKED LINK
        try:
            # Get or create default masking domain
            domains = link_masking_model.get_masking_domains(active_only=True)
            
            if domains and len(domains) > 0:
                default_domain = domains[0]
                
                # Create masked link with default settings
                masking_settings = {
                    'domain_id': str(default_domain['_id']),
                    'redirect_type': '302',
                    'subid_append': True,
                    'preview_mode': False,
                    'auto_rotation': False,
                    'code_length': 8
                }
                
                masked_link, mask_error = link_masking_model.create_masked_link(
                    offer_data['offer_id'],
                    offer_data['target_url'],
                    masking_settings,
                    str(user['_id'])
                )
                
                if masked_link and not mask_error:
                    # Update offer with masked URL
                    from bson import ObjectId
                    offer_collection = db_instance.get_collection('offers')
                    if offer_collection is not None:
                        offer_collection.update_one(
                            {'offer_id': offer_data['offer_id']},
                            {'$set': {
                                'masked_url': masked_link['masked_url'],
                                'masked_link_id': str(masked_link['_id'])
                            }}
                        )
                        offer_data['masked_url'] = masked_link['masked_url']
                        offer_data['masked_link_id'] = str(masked_link['_id'])
                        logging.info(f"✅ Masked link created: {masked_link['masked_url']}")
                else:
                    logging.warning(f"⚠️ Failed to create masked link: {mask_error}")
            else:
                logging.warning("⚠️ No masking domains available, skipping auto-masking")
        except Exception as mask_error:
            # Don't fail offer creation if masking fails
            logging.error(f"❌ Masked link creation error (non-critical): {str(mask_error)}")
        
        # Send email if promo code was assigned during offer creation
        if promo_code_id:
            try:
                from bson import ObjectId
                promo_codes_collection = db_instance.get_collection('promo_codes')
                users_collection = db_instance.get_collection('users')
                
                # Get promo code details
                try:
                    promo_code = promo_codes_collection.find_one({'_id': ObjectId(promo_code_id)})
                except:
                    promo_code = None
                
                if promo_code:
                    # Send BCC email to all publishers (single email, not individual)
                    publishers = list(users_collection.find(
                        {'role': 'publisher', 'email': {'$exists': True, '$ne': ''}},
                        {'email': 1}
                    ))
                    publisher_emails = [p['email'] for p in publishers if p.get('email')]
                    
                    if publisher_emails:
                        email_service = get_email_service()
                        import threading
                        def send_promo_bcc():
                            email_service.send_promo_code_assigned_to_offer_bcc(
                                recipients=publisher_emails,
                                offer_name=offer_data.get('name', 'Unknown Offer'),
                                code=promo_code['code'],
                                bonus_amount=promo_code['bonus_amount'],
                                bonus_type=promo_code['bonus_type'],
                                offer_id=str(offer_data['offer_id'])
                            )
                        threading.Thread(target=send_promo_bcc, daemon=True).start()
                    
                    logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {offer_data.get('name')}")
                    logging.info(f"📧 BCC email queued for {len(publisher_emails)} publishers")
            except Exception as e:
                logging.error(f"Failed to send promo code assignment emails: {str(e)}")
        
        logging.info("✅ Now triggering email notifications...")
        
        # Check if admin wants to send email notifications (default: True for backward compat)
        send_email = data.get('send_email', True)
        
        if not send_email:
            logging.info("📧 Email notifications skipped (send_email=false)")
        else:
            # Send email notifications to all users and publishers (non-blocking)
            try:
                logging.info("📧 Preparing to send email notifications to all users and publishers...")
                logging.info(f"📧 Offer data for email: {offer_data.get('name', 'Unknown')}")
                
                # Get all users and publishers from database
                users_collection = db_instance.get_collection('users')
                if users_collection is not None:
                    # Get users who have new_offers email preference enabled (or not set = default True)
                    all_users = list(users_collection.find(
                        {
                            'email': {'$exists': True, '$ne': ''},
                            '$or': [
                                {'email_preferences.new_offers': True},
                                {'email_preferences.new_offers': {'$exists': False}},
                                {'email_preferences': {'$exists': False}}
                            ]
                        },
                        {'email': 1, 'username': 1, 'role': 1}
                    ))
                    
                    logging.info(f"📧 Total eligible users: {len(all_users)}")
                    
                    # Extract email addresses
                    all_emails = [
                        user.get('email') for user in all_users 
                        if user.get('email')
                    ]
                    
                    if all_emails:
                        logging.info(f"📧 Sending single BCC email to {len(all_emails)} recipients")
                        
                        # Send single BCC email asynchronously (non-blocking)
                        email_service = get_email_service()
                        email_service.send_new_offer_notification_async(
                            offer_data=offer_data,
                            recipients=all_emails
                        )
                        
                        logging.info("✅ Email notification process started in background")
                        
                        # Log email activity for single offer creation
                        try:
                            email_logs_col = db_instance.get_collection('email_activity_logs')
                            if email_logs_col is not None:
                                email_logs_col.insert_one({
                                    'action': 'sent',
                                    'source': 'single_offer',
                                    'offer_ids': [offer_data.get('offer_id', '')],
                                    'offer_names': [offer_data.get('name', 'Unknown')],
                                    'offer_count': 1,
                                    'recipient_type': 'all_publishers',
                                    'recipient_count': len(all_emails),
                                    'batch_count': 1,
                                    'offers_per_email': 1,
                                    'scheduled_time': None,
                                    'admin_id': str(user['_id']),
                                    'admin_username': user.get('username', 'admin'),
                                    'created_at': datetime.utcnow()
                                })
                        except Exception as log_err:
                            logging.error(f"❌ Email activity log error: {log_err}")
                    else:
                        logging.warning("⚠️ No user emails found - NO EMAILS WILL BE SENT")
                else:
                    logging.warning("⚠️ Could not access users collection for email notifications")
                    
            except Exception as email_error:
                # Don't fail offer creation if email fails
                logging.error(f"❌ Email notification error (non-critical): {str(email_error)}", exc_info=True)
        
        # Log activity
        log_admin_activity(
            action='offer_created',
            category='offer',
            admin_user=user,
            details={
                'offer_id': offer_data.get('offer_id', ''),
                'offer_name': offer_data.get('name', ''),
                'network': offer_data.get('network', ''),
                'status': offer_data.get('status', ''),
                'category': offer_data.get('category', ''),
                'payout': offer_data.get('payout', ''),
            },
            request_obj=request
        )

        return safe_json_response({
            'message': 'Offer created successfully',
            'offer': offer_data
        }, 201)
        
    except Exception as e:
        logging.error(f"Create offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/export', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def export_offers():
    """Export offers with flexible pagination for CSV export (Admin only)"""
    try:
        # Get query parameters
        # export_type: 'all', 'range'
        export_type = request.args.get('export_type', 'all')
        start = int(request.args.get('start', 0))  # Starting index (0-based)
        end = int(request.args.get('end', 0))  # Ending index (0 = no limit)
        status = request.args.get('status')
        network = request.args.get('network')
        search = request.args.get('search')
        
        # Build filters
        filters = {}
        if status and status != 'all':
            filters['status'] = status
        if network:
            filters['network'] = network
        if search:
            filters['search'] = search
        
        # Get total count first
        _, total = offer_model.get_offers(filters, 0, 1)
        
        if export_type == 'all':
            # Fetch all offers (no limit)
            offers, _ = offer_model.get_offers(filters, 0, total if total > 0 else 10000)
        else:
            # Fetch range
            limit = end - start if end > start else 100
            offers, _ = offer_model.get_offers(filters, start, limit)
        
        return safe_json_response({
            'offers': offers,
            'total': total,
            'exported_count': len(offers),
            'range': {
                'start': start,
                'end': start + len(offers)
            }
        })
        
    except Exception as e:
        logging.error(f"Export offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to export offers: {str(e)}'}), 500



@admin_offers_bp.route('/offers/running', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_running_offers():
    """Get running offers with subcategory filters: searched, picked, requested, approved, rejected, has_clicks.
    Running offers are those that have been interacted with in the last 30 days.
    """
    try:
        from datetime import timedelta
        import re as re_mod

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 200)
        search = request.args.get('search', '').strip()
        subcategory = request.args.get('subcategory', 'all')  # all, searched, picked, requested, approved, rejected, has_clicks
        status_filter = request.args.get('status', '')
        category_filter = request.args.get('category', '')
        country_filter = request.args.get('country', '')
        network_filter = request.args.get('network', '')
        sort_by = request.args.get('sort', 'newest')
        days = int(request.args.get('days', 30))

        cutoff = datetime.utcnow() - timedelta(days=days)
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        from utils.json_serializer import serialize_for_json

        # ---- Gather offer IDs per subcategory ----
        subcategory_ids = {}  # subcategory -> set of offer_ids
        click_counts = {}     # offer_id -> total clicks
        last_clicked = {}     # offer_id -> last click timestamp
        first_active = {}     # offer_id -> when first became active (earliest interaction)

        # 1. Has Clicks - offers with clicks in the window
        # Note: 'clicks' collection has both 'offer_id' (simple_tracking) and 'offerId' (old Tracking model)
        for col_name in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed', 'dashboard_clicks'):
            col = db_instance.get_collection(col_name)
            if col is None:
                continue
            try:
                # For 'clicks' collection, query both field names
                offer_id_fields = ['offer_id']
                if col_name == 'clicks':
                    offer_id_fields.append('offerId')

                for oid_field in offer_id_fields:
                    pipeline = [
                        {'$match': {'timestamp': {'$gte': cutoff}, oid_field: {'$exists': True, '$ne': None}}},
                        {'$group': {
                            '_id': f'${oid_field}',
                            'count': {'$sum': 1},
                            'last_click': {'$max': '$timestamp'},
                            'first_click': {'$min': '$timestamp'},
                        }},
                    ]
                    for doc in col.aggregate(pipeline):
                        oid = str(doc['_id']) if doc['_id'] else None
                        if not oid:
                            continue
                        click_counts[oid] = click_counts.get(oid, 0) + doc['count']
                        existing_last = last_clicked.get(oid)
                        if not existing_last or doc['last_click'] > existing_last:
                            last_clicked[oid] = doc['last_click']
                        existing_first = first_active.get(oid)
                        if not existing_first or doc['first_click'] < existing_first:
                            first_active[oid] = doc['first_click']
            except Exception as e:
                logging.warning(f"Running offers - failed to query {col_name}: {e}")

        subcategory_ids['has_clicks'] = set(click_counts.keys())

        # 2. Searched - REMOVED: searched offers are not running offers
        # Search logs are informational only, not an indicator of offer activity
        search_logs_col = db_instance.get_collection('search_logs')

        # 3. Picked - offers that were picked/selected after a search
        picked_ids = set()
        if search_logs_col is not None:
            try:
                picked_logs = search_logs_col.find(
                    {'searched_at': {'$gte': cutoff}, 'picked_offer_id': {'$ne': None, '$exists': True}},
                    {'picked_offer_id': 1, 'searched_at': 1}
                )
                for log in picked_logs:
                    pid = log.get('picked_offer_id')
                    if pid:
                        pid = str(pid)
                        picked_ids.add(pid)
                        ts = log.get('searched_at')
                        if ts:
                            existing = first_active.get(pid)
                            if not existing or ts < existing:
                                first_active[pid] = ts
            except Exception as e:
                logging.warning(f"Running offers - picked query failed: {e}")
        subcategory_ids['picked'] = picked_ids

        # 4. Requested - offers with access requests (also tracks approved/rejected)
        requests_col = db_instance.get_collection('affiliate_requests')
        requested_ids = set()
        approved_ids = set()
        rejected_ids = set()
        if requests_col is not None:
            try:
                req_docs = requests_col.find(
                    {'requested_at': {'$gte': cutoff}},
                    {'offer_id': 1, 'requested_at': 1, 'status': 1}
                )
                for rd in req_docs:
                    oid = rd.get('offer_id')
                    if not oid:
                        continue
                    oid = str(oid)
                    requested_ids.add(oid)
                    ts = rd.get('requested_at')
                    if ts:
                        existing = first_active.get(oid)
                        if not existing or ts < existing:
                            first_active[oid] = ts
                    status = rd.get('status', 'pending')
                    if status == 'approved':
                        approved_ids.add(oid)
                    elif status == 'rejected':
                        rejected_ids.add(oid)
            except Exception as e:
                logging.warning(f"Running offers - requested query failed: {e}")
        subcategory_ids['requested'] = requested_ids

        # 5. Approved
        subcategory_ids['approved'] = approved_ids

        # 6. Rejected
        subcategory_ids['rejected'] = rejected_ids

        # Compute "all" as union of all subcategories EXCEPT searched
        all_running = set()
        for key, ids in subcategory_ids.items():
            if key != 'searched':
                all_running.update(ids)
        subcategory_ids['all'] = all_running

        # Compute counts per subcategory for the tabs
        subcategory_counts = {k: len(v) for k, v in subcategory_ids.items()}

        # Determine which offer IDs to query based on selected subcategory
        target_ids = subcategory_ids.get(subcategory, all_running)
        if not target_ids:
            return jsonify({
                'offers': [],
                'subcategory_counts': subcategory_counts,
                'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0}
            })

        # Build query
        query = {
            'offer_id': {'$in': list(target_ids)},
        }
        # Exclude deleted
        query['$or'] = [{'deleted': {'$exists': False}}, {'deleted': False}]

        # Apply filters
        and_conditions = []
        if search:
            escaped_search = re_mod.escape(search)
            and_conditions.append({'$or': [
                {'name': {'$regex': escaped_search, '$options': 'i'}},
                {'offer_id': {'$regex': escaped_search, '$options': 'i'}},
                {'network': {'$regex': escaped_search, '$options': 'i'}},
            ]})
        if status_filter and status_filter != 'all':
            and_conditions.append({'status': status_filter})
        if category_filter and category_filter != 'all':
            and_conditions.append({'$or': [
                {'category': {'$regex': f'^{re_mod.escape(category_filter)}$', '$options': 'i'}},
                {'vertical': {'$regex': f'^{re_mod.escape(category_filter)}$', '$options': 'i'}},
            ]})
        if country_filter and country_filter != 'all':
            and_conditions.append({'countries': country_filter})
        if network_filter and network_filter != 'all':
            and_conditions.append({'network': {'$regex': f'^{re_mod.escape(network_filter)}$', '$options': 'i'}})

        if and_conditions:
            query['$and'] = and_conditions

        # Sorting
        sort_field = 'created_at'
        sort_dir = -1
        if sort_by == 'oldest':
            sort_dir = 1
        elif sort_by == 'payout_high':
            sort_field = 'payout'
            sort_dir = -1
        elif sort_by == 'payout_low':
            sort_field = 'payout'
            sort_dir = 1
        elif sort_by == 'title_az':
            sort_field = 'name'
            sort_dir = 1
        elif sort_by == 'title_za':
            sort_field = 'name'
            sort_dir = -1
        elif sort_by == 'clicks':
            sort_field = None  # will sort in Python

        total = offers_col.count_documents(query)
        skip = (page - 1) * per_page

        if sort_field:
            docs = list(offers_col.find(query).sort(sort_field, sort_dir).skip(skip).limit(per_page))
        else:
            docs = list(offers_col.find(query).skip(0).limit(total or 1000))

        # Track which offers have DIRECT interactions (not just keyword matches)
        directly_interacted = set()
        directly_interacted.update(click_counts.keys())  # has clicks
        directly_interacted.update(picked_ids)            # was picked
        directly_interacted.update(requested_ids)         # was requested

        offers = []
        for doc in docs:
            doc['_id'] = str(doc['_id'])
            oid = doc.get('offer_id', '')
            doc['total_clicks'] = click_counts.get(oid, 0)
            doc['last_clicked'] = last_clicked.get(oid)

            # Only show when_active/when_expired for offers with direct interactions
            # Searched-only offers (keyword match) don't get dates since the interaction
            # was with the search, not the offer itself
            offer_status = (doc.get('status') or '').lower()
            fa = first_active.get(oid) if oid in directly_interacted else None
            doc['when_active'] = fa

            # Calculate expiry based on LAST CLICK date (rolling 30-day window)
            # If offer has clicks, expiry = last_click + 30 days
            # If no clicks but has other interactions, expiry = first_active + 30 days
            lc = last_clicked.get(oid)
            # Also check last_click_date field on the offer document itself
            offer_lcd = doc.get('last_click_date')
            if offer_lcd and (not lc or offer_lcd > lc):
                lc = offer_lcd

            expiry_anchor = lc or fa  # Prefer last click, fall back to first interaction
            if expiry_anchor:
                elapsed = (datetime.utcnow() - expiry_anchor).days
                doc['days_remaining'] = max(0, days - elapsed)
                doc['when_expired'] = expiry_anchor + timedelta(days=days)
            else:
                doc['days_remaining'] = None
                doc['when_expired'] = None

            # Determine sub-status
            sub_statuses = []
            if oid in subcategory_ids.get('searched', set()):
                sub_statuses.append('searched')
            if oid in subcategory_ids.get('picked', set()):
                sub_statuses.append('picked')
            if oid in subcategory_ids.get('requested', set()):
                sub_statuses.append('requested')
            if oid in subcategory_ids.get('approved', set()):
                sub_statuses.append('approved')
            if oid in subcategory_ids.get('rejected', set()):
                sub_statuses.append('rejected')
            if oid in subcategory_ids.get('has_clicks', set()):
                sub_statuses.append('has_clicks')
            doc['sub_statuses'] = sub_statuses

            offers.append(serialize_for_json(doc))

        # Sort by clicks if requested
        if sort_by == 'clicks':
            offers.sort(key=lambda o: o.get('total_clicks', 0), reverse=True)
            offers = offers[skip:skip + per_page]

        return jsonify({
            'offers': offers,
            'subcategory_counts': subcategory_counts,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': max(1, (total + per_page - 1) // per_page)
            }
        })

    except Exception as e:
        logging.error(f"Running offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get running offers: {str(e)}'}), 500




@admin_offers_bp.route('/offers/check-running', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def check_offers_running():
    """Check if specific offer_ids are running (appear in any running subcategory) and return detailed info."""
    try:
        from datetime import timedelta
        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])
        if not offer_ids:
            return jsonify({'running_ids': [], 'running_details': []})

        cutoff_30d = datetime.utcnow() - timedelta(days=30)
        click_counts = {}
        first_active = {}
        all_running = set()
        sub_status_map = {oid: [] for oid in offer_ids}

        # 1. Check clicks across all click collections
        for col_name in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed', 'dashboard_clicks'):
            col = db_instance.get_collection(col_name)
            if col is None:
                continue
            try:
                offer_id_fields = ['offer_id']
                if col_name == 'clicks':
                    offer_id_fields.append('offerId')
                for oid_field in offer_id_fields:
                    pipeline = [
                        {'$match': {oid_field: {'$in': offer_ids}, 'timestamp': {'$gte': cutoff_30d}}},
                        {'$group': {'_id': f'${oid_field}', 'count': {'$sum': 1}, 'first_click': {'$min': '$timestamp'}}},
                    ]
                    for doc in col.aggregate(pipeline):
                        oid = str(doc['_id']) if doc['_id'] else None
                        if not oid:
                            continue
                        click_counts[oid] = click_counts.get(oid, 0) + doc['count']
                        existing = first_active.get(oid)
                        if not existing or doc['first_click'] < existing:
                            first_active[oid] = doc['first_click']
                        all_running.add(oid)
                        if 'has_clicks' not in sub_status_map.get(oid, []):
                            sub_status_map.setdefault(oid, []).append('has_clicks')
            except Exception:
                pass

        # 2. Check searched - keyword match against offer names (same logic as get_running_offers)
        search_logs_col = db_instance.get_collection('search_logs')
        offers_col = db_instance.get_collection('offers')
        if search_logs_col is not None and offers_col is not None:
            try:
                import re as re_mod
                logs = search_logs_col.find({'searched_at': {'$gte': cutoff_30d}}, {'keyword': 1, 'searched_at': 1})
                keywords = set()
                earliest_search = {}
                for log in logs:
                    kw = (log.get('keyword') or '').strip()
                    if kw:
                        keywords.add(kw)
                        ts = log.get('searched_at')
                        if ts and (kw not in earliest_search or ts < earliest_search[kw]):
                            earliest_search[kw] = ts

                if keywords:
                    # Get names of the offers we're checking
                    offer_docs = {d['offer_id']: d.get('name', '') for d in offers_col.find({'offer_id': {'$in': offer_ids}}, {'offer_id': 1, 'name': 1})}
                    for oid in offer_ids:
                        offer_name = (offer_docs.get(oid) or '').lower()
                        oid_lower = (oid or '').lower()
                        for kw in keywords:
                            kw_lower = kw.lower()
                            if kw_lower in offer_name or kw_lower in oid_lower:
                                all_running.add(oid)
                                if 'searched' not in sub_status_map.get(oid, []):
                                    sub_status_map.setdefault(oid, []).append('searched')
                                ts = earliest_search.get(kw)
                                if ts:
                                    existing = first_active.get(oid)
                                    if not existing or ts < existing:
                                        first_active[oid] = ts
                                break
            except Exception:
                pass

        # 3. Check picked
        if search_logs_col is not None:
            try:
                for log in search_logs_col.find({'searched_at': {'$gte': cutoff_30d}, 'picked_offer_id': {'$in': offer_ids}}):
                    pid = log.get('picked_offer_id')
                    if pid:
                        pid = str(pid)
                        all_running.add(pid)
                        if 'picked' not in sub_status_map.get(pid, []):
                            sub_status_map.setdefault(pid, []).append('picked')
                        ts = log.get('searched_at')
                        if ts:
                            existing = first_active.get(pid)
                            if not existing or ts < existing:
                                first_active[pid] = ts
            except Exception:
                pass

        # 4. Check affiliate requests (requested/approved/rejected)
        requests_col = db_instance.get_collection('affiliate_requests')
        if requests_col is not None:
            try:
                for req in requests_col.find({'requested_at': {'$gte': cutoff_30d}, 'offer_id': {'$in': offer_ids}}):
                    oid = req.get('offer_id')
                    if not oid:
                        continue
                    oid = str(oid)
                    all_running.add(oid)
                    if 'requested' not in sub_status_map.get(oid, []):
                        sub_status_map.setdefault(oid, []).append('requested')
                    status = req.get('status', 'pending')
                    if status == 'approved' and 'approved' not in sub_status_map.get(oid, []):
                        sub_status_map.setdefault(oid, []).append('approved')
                    elif status == 'rejected' and 'rejected' not in sub_status_map.get(oid, []):
                        sub_status_map.setdefault(oid, []).append('rejected')
                    ts = req.get('requested_at')
                    if ts:
                        existing = first_active.get(oid)
                        if not existing or ts < existing:
                            first_active[oid] = ts
            except Exception:
                pass

        running_ids = list(all_running)

        # Build detailed info
        running_details = []
        if running_ids and offers_col is not None:
            for doc in offers_col.find({'offer_id': {'$in': running_ids}}, {'offer_id': 1, 'name': 1}):
                oid = doc.get('offer_id', '')
                fa = first_active.get(oid)
                days_remaining = 30
                if fa:
                    elapsed = (datetime.utcnow() - fa).days
                    days_remaining = max(0, 30 - elapsed)
                running_details.append({
                    'offer_id': oid,
                    'name': doc.get('name', ''),
                    'total_clicks': click_counts.get(oid, 0),
                    'days_remaining': days_remaining,
                    'sub_statuses': sub_status_map.get(oid, []),
                })

        return jsonify({'running_ids': running_ids, 'running_details': running_details})
    except Exception as e:
        logging.error(f"Check running error: {e}")
        return jsonify({'running_ids': [], 'running_details': []})



@admin_offers_bp.route('/offers', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_offers():
    """Get all offers with filtering and pagination (Admin only)"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)  # Max 100 per page
        status = request.args.get('status')
        network = request.args.get('network')
        search = request.args.get('search')
        
        # Build filters
        filters = {}
        if status and status != 'all':
            filters['status'] = status
        if network:
            filters['network'] = network
        if search:
            filters['search'] = search
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get offers
        offers, total = offer_model.get_offers(filters, skip, per_page)
        
        # Attach health status to each offer
        try:
            health_service = HealthCheckService()
            health_results = health_service.evaluate_offers_batch(offers)
            for offer in offers:
                offer['health'] = health_results.get(offer.get('offer_id'), {"status": "unknown", "failures": []})
        except Exception as e:
            logging.warning(f"Health check failed for admin offers: {e}")
        
        return safe_json_response({
            'offers': offers,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logging.error(f"Get offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offers: {str(e)}'}), 500

@admin_offers_bp.route('/offers/networks', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_networks():
    """Return distinct network values from the offers collection."""
    try:
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        raw_networks = offers_collection.distinct('network')
        networks = sorted([
            n for n in raw_networks
            if n and isinstance(n, str) and n.strip()
        ])
        return jsonify({'networks': networks})
    except Exception as e:
        logging.error(f"Get networks error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get networks: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_offer(offer_id):
    """Get a specific offer by ID (Admin only)"""
    try:
        # Query DB directly to avoid model's is_active filter issues
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database not available'}), 503
        
        offer = offers_collection.find_one({'offer_id': offer_id})
        if not offer:
            return jsonify({'error': f'Offer {offer_id} not found'}), 404
        
        offer['_id'] = str(offer['_id'])
        return safe_json_response({'offer': offer})
        
    except Exception as e:
        logging.error(f"Get offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def update_offer(offer_id):
    """Update an offer (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # QA VERIFICATION: Log received data
        logging.info("📥 UPDATE OFFER - Schedule received: %s", data.get("schedule"))
        logging.info("📥 UPDATE OFFER - SmartRules received: %s", data.get("smartRules"))
        logging.info("📥 UPDATE OFFER - Allowed Countries received: %s", data.get("allowed_countries"))
        logging.info("📥 UPDATE OFFER - Non-Access URL received: %s", data.get("non_access_url"))
        logging.info("📥 UPDATE OFFER - Fallback Redirect: enabled=%s, url=%s, timer=%s", 
                     data.get("fallback_redirect_enabled"), 
                     data.get("fallback_redirect_url"), 
                     data.get("fallback_redirect_timer"))
        logging.info("📥 UPDATE OFFER - Full payload keys: %s", list(data.keys()))
        
        # 🔥 CRITICAL FIX: Apply field mapping for schedule + smart rules
        if 'schedule' in data or 'smartRules' in data:
            mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
            logging.info("📥 UPDATE OFFER - After mapping - Schedule: %s", mapped_data.get("schedule"))
            logging.info("📥 UPDATE OFFER - After mapping - SmartRules: %s", mapped_data.get("smartRules"))
            data = mapped_data
        
        user = request.current_user
        
        # 🔥 APPROVAL WORKFLOW FIX: Auto-set affiliates to 'request' if approval is required
        if 'approval_type' in data or 'require_approval' in data:
            approval_type = data.get('approval_type', 'auto_approve')
            require_approval = data.get('require_approval', False)
            
            # Always update approval_settings when approval_type is provided
            if 'approval_settings' not in data:
                data['approval_settings'] = {}
            
            data['approval_settings']['type'] = approval_type
            data['approval_settings']['require_approval'] = require_approval
            
            if 'auto_approve_delay' in data:
                data['approval_settings']['auto_approve_delay'] = data['auto_approve_delay']
            if 'approval_message' in data:
                data['approval_settings']['approval_message'] = data['approval_message']
            if 'max_inactive_days' in data:
                data['approval_settings']['max_inactive_days'] = data['max_inactive_days']
            
            # If approval is required, set affiliates to 'request'
            if require_approval or approval_type in ['time_based', 'manual']:
                data['affiliates'] = 'request'
                logging.info(f"🔒 Approval workflow enabled - Setting affiliates to 'request' for offer {offer_id}")
            elif approval_type == 'auto_approve':
                # For auto_approve, set affiliates to 'all' (no manual gating needed)
                data['affiliates'] = 'all'
                logging.info(f"🔓 Auto-approve workflow - Setting affiliates to 'all' for offer {offer_id}")
        
        # Check if promo code is being assigned/updated
        promo_code_id = data.get('promo_code_id')
        old_offer = offer_model.get_offer_by_id(offer_id)
        old_promo_code_id = old_offer.get('promo_code_id') if old_offer else None
        
        # If promo code is being assigned, fetch its details and add to update data
        if promo_code_id:
            try:
                from bson import ObjectId
                promo_codes_collection = db_instance.get_collection('promo_codes')
                promo_code = promo_codes_collection.find_one({'_id': ObjectId(promo_code_id)})
                
                if promo_code:
                    # Add promo code details to update data
                    data['promo_code'] = promo_code.get('code')
                    data['bonus_amount'] = promo_code.get('bonus_amount')
                    data['bonus_type'] = promo_code.get('bonus_type')
                    data['promo_code_assigned_at'] = datetime.utcnow()
                    data['promo_code_assigned_by'] = str(user['_id'])
                    logging.info(f"✅ Promo code {promo_code.get('code')} will be assigned to offer {offer_id}")
            except Exception as e:
                logging.error(f"Error fetching promo code details: {str(e)}")
        else:
            # If promo_code_id is empty/null, clear all promo code fields
            if 'promo_code_id' in data:
                data['promo_code'] = None
                data['bonus_amount'] = None
                data['bonus_type'] = None
                data['promo_code_assigned_at'] = None
                data['promo_code_assigned_by'] = None
                logging.info(f"🗑️ Promo code removed from offer {offer_id}")
        
        # Use extended model if schedule/smart rules data is present
        if 'schedule' in data or 'smartRules' in data:
            success, error = extended_offer_model.update_offer(offer_id, data, str(user['_id']))
        else:
            success, error = offer_model.update_offer(offer_id, data, str(user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update offer'}), 400
        
        # Get updated offer - use extended model if schedule/smart rules were updated
        if 'schedule' in data or 'smartRules' in data:
            updated_offer = extended_offer_model.get_offer_by_id(offer_id)
        else:
            updated_offer = offer_model.get_offer_by_id(offer_id)
        
        # 🔥 AUTO-INJECT network offer URL params if a matching Upward Partner exists
        try:
            from services.tracking_link_generator import apply_network_offer_params
            original_url = updated_offer.get('target_url', '')
            updated_offer = apply_network_offer_params(updated_offer)
            if updated_offer.get('target_url') != original_url:
                offer_collection = db_instance.get_collection('offers')
                offer_collection.update_one(
                    {'offer_id': offer_id},
                    {'$set': {'target_url': updated_offer['target_url']}}
                )
                logging.info(f"✅ Network params injected into updated offer URL: {updated_offer['target_url']}")
        except Exception as e:
            logging.error(f"❌ Network param injection error on update (non-critical): {str(e)}")
        
        # Send email if promo code was assigned or changed
        if promo_code_id and promo_code_id != old_promo_code_id:
            try:
                from bson import ObjectId
                from services.email_service import get_email_service
                
                promo_codes_collection = db_instance.get_collection('promo_codes')
                users_collection = db_instance.get_collection('users')
                
                # Get promo code details
                try:
                    promo_code = promo_codes_collection.find_one({'_id': ObjectId(promo_code_id)})
                except:
                    promo_code = None
                
                if promo_code:
                    # Send BCC email to all publishers (single email, not individual)
                    publishers = list(users_collection.find(
                        {'role': 'publisher', 'email': {'$exists': True, '$ne': ''}},
                        {'email': 1}
                    ))
                    publisher_emails = [p['email'] for p in publishers if p.get('email')]
                    
                    if publisher_emails:
                        email_service = get_email_service()
                        import threading
                        def send_promo_bcc_update():
                            email_service.send_promo_code_assigned_to_offer_bcc(
                                recipients=publisher_emails,
                                offer_name=updated_offer.get('name', 'Unknown Offer'),
                                code=promo_code['code'],
                                bonus_amount=promo_code['bonus_amount'],
                                bonus_type=promo_code['bonus_type'],
                                offer_id=str(offer_id)
                            )
                        threading.Thread(target=send_promo_bcc_update, daemon=True).start()
                    
                    logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {updated_offer.get('name')}")
                    logging.info(f"📧 BCC email queued for {len(publisher_emails)} publishers")
            except Exception as e:
                logging.error(f"Failed to send promo code assignment emails: {str(e)}")
        
        # Log activity
        log_admin_activity(
            action='offer_updated',
            category='offer',
            admin_user=request.current_user,
            details={
                'offer_id': offer_id,
                'offer_name': updated_offer.get('name', ''),
                'network': updated_offer.get('network', ''),
                'fields_updated': list(data.keys()),
            },
            request_obj=request
        )

        return safe_json_response({
            'message': 'Offer updated successfully',
            'offer': updated_offer
        })
        
    except Exception as e:
        logging.error(f"Update offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_access_requests():
    """Get access requests for an offer"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        requests = access_service.get_access_requests(offer_id)
        
        return jsonify({
            'requests': requests,
            'total': len(requests)
        })
        
    except Exception as e:
        logging.error(f"Get access requests error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get access requests: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests/<request_id>/approve', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def approve_access_request():
    """Approve an access request"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        request_id = request.view_args.get('request_id')
        
        result = access_service.approve_access_request_by_id(request_id, offer_id)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Access request approved successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Approve access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve access request: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/access-requests/<request_id>/reject', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def reject_access_request():
    """Reject an access request"""
    try:
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        offer_id = request.view_args.get('offer_id')
        request_id = request.view_args.get('request_id')
        data = request.get_json() or {}
        reason = data.get('reason', '')
        
        result = access_service.reject_access_request_by_id(request_id, offer_id, reason)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Access request rejected successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        logging.error(f"Reject access request error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject access request: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('offers')
def delete_offer(offer_id):
    """Delete an offer (Admin only)"""
    try:
        # Fetch offer details before deleting for logging
        offers_col = db_instance.get_collection('offers')
        offer_doc = offers_col.find_one({'offer_id': offer_id}) if offers_col else None

        success = offer_model.delete_offer(offer_id)
        
        if not success:
            return jsonify({'error': 'Offer not found or already deleted'}), 404

        # Cascade cleanup: remove from user requests, notifications, etc.
        _cascade_cleanup_offer(offer_id)

        # Log activity
        log_admin_activity(
            action='offer_deleted',
            category='offer',
            admin_user=request.current_user,
            details={
                'offer_id': offer_id,
                'offer_name': offer_doc.get('name', 'Unknown') if offer_doc else 'Unknown',
                'network': offer_doc.get('network', '') if offer_doc else '',
            },
            affected_items=[{'offer_id': offer_id, 'name': offer_doc.get('name', '') if offer_doc else ''}],
            request_obj=request
        )
        
        return jsonify({'message': 'Offer deleted successfully'}), 200
        
    except Exception as e:
        logging.error(f"Delete offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-delete', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_delete_offers():
    """Delete multiple offers at once (Admin only) - uses single bulk update"""
    try:
        data = request.get_json()
        
        if not data or 'offer_ids' not in data:
            return jsonify({'error': 'offer_ids array is required'}), 400
        
        offer_ids = data.get('offer_ids', [])
        
        if not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids must be a non-empty array'}), 400
        
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Fetch offer details before deleting for logging
        offer_docs = list(offers_collection.find(
            {'offer_id': {'$in': offer_ids}},
            {'offer_id': 1, 'name': 1, 'network': 1, 'status': 1, 'category': 1}
        ))
        
        # Single bulk update instead of per-offer loop
        from datetime import datetime
        result = offers_collection.update_many(
            {'offer_id': {'$in': offer_ids}},
            {
                '$set': {
                    'is_active': False,
                    'deleted': True,
                    'deleted_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        deleted_count = result.modified_count
        failed_count = len(offer_ids) - deleted_count

        # Cascade cleanup: remove from user requests, notifications, etc.
        _cascade_cleanup_offer(offer_ids)

        # Log activity
        log_admin_activity(
            action='bulk_delete',
            category='offer',
            admin_user=request.current_user,
            details={
                'total_requested': len(offer_ids),
                'deleted_count': deleted_count,
                'failed_count': failed_count,
            },
            affected_items=[{'offer_id': d.get('offer_id', ''), 'name': d.get('name', ''), 'network': d.get('network', '')} for d in offer_docs],
            affected_count=deleted_count,
            request_obj=request
        )
        
        return jsonify({
            'message': f'Bulk delete completed',
            'deleted': deleted_count,
            'failed': failed_count,
            'errors': [{'error': f'{failed_count} offer(s) not found or already deleted'}] if failed_count > 0 else None
        }), 200
        
    except Exception as e:
        logging.error(f"Bulk delete offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to bulk delete offers: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-status', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_update_status():
    """Update status of multiple offers at once — requires explicit offer IDs"""
    try:
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'status is required'}), 400

        new_status = data['status'].strip().lower()
        valid_statuses = ['active', 'pending', 'inactive', 'paused', 'hidden']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

        offer_ids = data.get('offer_ids', [])

        # SAFETY: Always require explicit offer IDs — never update all offers
        if not offer_ids or not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids is required. You must select specific offers to update.'}), 400

        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        from datetime import datetime

        # Update specific offers only
        query = {'offer_id': {'$in': offer_ids}, '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}

        result = offers_collection.update_many(
            query,
            {'$set': {'status': new_status, 'updated_at': datetime.utcnow()}}
        )

        # Log activity
        log_admin_activity(
            action='bulk_status_update',
            category='offer',
            admin_user=request.current_user,
            details={
                'new_status': new_status,
                'updated_count': result.modified_count,
                'requested_count': len(offer_ids),
                'scope': 'selected',
            },
            affected_count=result.modified_count,
            request_obj=request
        )

        return jsonify({
            'message': f'Updated {result.modified_count} offer(s) to {new_status}',
            'updated_count': result.modified_count
        }), 200

    except Exception as e:
        logging.error(f"Bulk update status error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update status: {str(e)}'}), 500


# ============================================
# RECYCLE BIN ENDPOINTS
# ============================================

@admin_offers_bp.route('/offers/recycle-bin', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_recycle_bin():
    """Get all soft-deleted offers (recycle bin)"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        search = request.args.get('search', '')
        
        offers, total = offer_model.get_deleted_offers(
            page=page,
            per_page=per_page,
            search=search if search else None
        )
        
        return jsonify({
            'offers': offers,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page if total > 0 else 0
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get recycle bin error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get recycle bin: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/restore', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def restore_offer(offer_id):
    """Restore a soft-deleted offer from recycle bin"""
    try:
        success = offer_model.restore_offer(offer_id)
        
        if not success:
            return jsonify({'error': 'Offer not found in recycle bin'}), 404
        
        return jsonify({'message': 'Offer restored successfully'}), 200
        
    except Exception as e:
        logging.error(f"Restore offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to restore offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/permanent-delete', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('offers')
def permanent_delete_offer(offer_id):
    """Permanently delete an offer (cannot be recovered)"""
    try:
        success = offer_model.permanent_delete_offer(offer_id)
        
        if not success:
            return jsonify({'error': 'Offer not found'}), 404

        # Cascade cleanup: remove from user requests, notifications, etc.
        _cascade_cleanup_offer(offer_id)
        
        return jsonify({'message': 'Offer permanently deleted'}), 200
        
    except Exception as e:
        logging.error(f"Permanent delete offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to permanently delete offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/recycle-bin/empty', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('offers')
def empty_recycle_bin():
    """Permanently delete all offers in recycle bin"""
    try:
        # Get offer_ids before deleting for cascade cleanup
        offers_col = db_instance.get_collection('offers')
        deleted_ids = []
        if offers_col:
            deleted_docs = offers_col.find({'deleted': True}, {'offer_id': 1})
            deleted_ids = [d['offer_id'] for d in deleted_docs if d.get('offer_id')]

        deleted_count = offer_model.empty_recycle_bin()

        # Cascade cleanup
        if deleted_ids:
            _cascade_cleanup_offer(deleted_ids)

        # Log activity
        log_admin_activity(
            action='recycle_bin_emptied',
            category='recycle_bin',
            admin_user=request.current_user,
            details={'deleted_count': deleted_count},
            affected_count=deleted_count,
            request_obj=request
        )
        
        return jsonify({
            'message': f'Recycle bin emptied successfully',
            'deleted_count': deleted_count
        }), 200
        
    except Exception as e:
        logging.error(f"Empty recycle bin error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to empty recycle bin: {str(e)}'}), 500

@admin_offers_bp.route('/offers/clear-all', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def clear_all_offers():
    """Move ALL active offers to recycle bin (soft delete)"""
    try:
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        from datetime import datetime

        # Get offer_ids before soft-deleting for cascade cleanup
        active_query = {
            '$and': [
                {'$or': [{'is_active': True}, {'is_active': {'$exists': False}}]},
                {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
            ]
        }
        all_ids = [d['offer_id'] for d in offers_collection.find(active_query, {'offer_id': 1}) if d.get('offer_id')]

        result = offers_collection.update_many(
            active_query,
            {
                '$set': {
                    'is_active': False,
                    'deleted': True,
                    'deleted_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )

        # Cascade cleanup: remove from user requests, notifications, etc.
        if all_ids:
            _cascade_cleanup_offer(all_ids)

        # Log activity
        log_admin_activity(
            action='clear_all_offers',
            category='recycle_bin',
            admin_user=request.current_user,
            details={'moved_count': result.modified_count},
            affected_count=result.modified_count,
            request_obj=request
        )

        return jsonify({
            'message': f'All offers moved to recycle bin',
            'moved_count': result.modified_count
        }), 200

    except Exception as e:
        logging.error(f"Clear all offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to clear all offers: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-restore', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_restore_offers():
    """Restore multiple offers from recycle bin - uses single bulk update"""
    try:
        data = request.get_json()
        
        if not data or 'offer_ids' not in data:
            return jsonify({'error': 'offer_ids array is required'}), 400
        
        offer_ids = data.get('offer_ids', [])
        
        if not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids must be a non-empty array'}), 400
        
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        from datetime import datetime
        result = offers_collection.update_many(
            {'offer_id': {'$in': offer_ids}, 'deleted': True},
            {
                '$set': {
                    'is_active': True,
                    'deleted': False,
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'deleted_at': ''
                }
            }
        )
        
        restored_count = result.modified_count
        failed_count = len(offer_ids) - restored_count
        
        return jsonify({
            'message': f'Bulk restore completed',
            'restored': restored_count,
            'failed': failed_count,
            'errors': [{'error': f'{failed_count} offer(s) not found in recycle bin'}] if failed_count > 0 else None
        }), 200
        
    except Exception as e:
        logging.error(f"Bulk restore offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to bulk restore offers: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/clone', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def clone_offer(offer_id):
    """Clone an existing offer (Admin only)"""
    try:
        # Get original offer
        original_offer = offer_model.get_offer_by_id(offer_id)
        
        if not original_offer:
            return jsonify({'error': 'Original offer not found'}), 404
        
        # Prepare cloned data
        clone_data = original_offer.copy()
        
        # Remove fields that shouldn't be cloned
        fields_to_remove = ['_id', 'offer_id', 'hits', 'created_at', 'updated_at', 'created_by']
        for field in fields_to_remove:
            clone_data.pop(field, None)
        
        # Modify name to indicate it's a clone
        clone_data['name'] = f"{clone_data['name']} (Copy)"
        clone_data['status'] = 'pending'  # Reset status to pending
        
        # Create cloned offer
        user = request.current_user
        cloned_offer, error = offer_model.create_offer(clone_data, str(user['_id']))
        
        if error:
            return jsonify({'error': error}), 400
        
        return safe_json_response({
            'message': 'Offer cloned successfully',
            'offer': cloned_offer
        }, 201)
        
    except Exception as e:
        logging.error(f"Clone offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to clone offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/settings', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_offer_settings(offer_id):
    """Get advanced settings for an offer"""
    try:
        settings = admin_offer_model.get_offer_settings(offer_id)
        
        if settings is None:
            # Return default settings if none exist
            default_settings = {
                'enableClickTracking': True,
                'enableImpressionTracking': True,
                'enableConversionTracking': True,
                'fraudDetectionLevel': 'medium',
                'enableLinkMasking': False,
                'customDomain': '',
                'shortCodeLength': 8,
                'useCustomCode': False,
                'customCode': '',
                'enableGeoTargeting': False,
                'enableDeviceTargeting': False,
                'enableTimeBasedTargeting': False,
                'enableCapLimits': False,
                'dailyCapLimit': 1000,
                'enablePostbacks': True,
                'postbackUrl': '',
                'postbackParameters': 'subid={subid}&payout={payout}&status={status}',
                'enableIPWhitelist': False,
                'ipWhitelist': '',
                'enableReferrerCheck': False,
                'allowedReferrers': '',
                'cacheEnabled': True,
                'cacheTTL': 300,
                'enableCompression': True,
                'emailNotifications': True,
                'slackWebhook': '',
                'discordWebhook': ''
            }
            return jsonify({'settings': default_settings}), 200
        
        return jsonify({'settings': settings}), 200
        
    except Exception as e:
        logging.error(f"Get offer settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get offer settings: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/settings', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def update_offer_settings(offer_id):
    """Update advanced settings for an offer"""
    try:
        data = request.get_json()
        
        if not data or 'settings' not in data:
            return jsonify({'error': 'Settings data required'}), 400
        
        settings = data['settings']
        
        # Validate settings
        if not isinstance(settings, dict):
            return jsonify({'error': 'Settings must be an object'}), 400
        
        # Update settings
        success, error = admin_offer_model.update_offer_settings(offer_id, settings)
        
        if not success:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Settings updated successfully'}), 200
        
    except Exception as e:
        logging.error(f"Update offer settings error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update offer settings: {str(e)}'}), 500

@admin_offers_bp.route('/offers/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_offers_stats():
    """Get offer statistics (Admin only)"""
    try:
        if not offer_model._check_db_connection():
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Get basic stats — use deleted filter instead of is_active for consistency
        not_deleted = {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
        total_offers = offer_model.collection.count_documents(not_deleted)
        active_offers = offer_model.collection.count_documents({**not_deleted, 'status': 'active'})
        pending_offers = offer_model.collection.count_documents({**not_deleted, 'status': 'pending'})
        inactive_offers = offer_model.collection.count_documents({**not_deleted, 'status': 'inactive'})
        
        # Get top networks
        pipeline = [
            {'$match': not_deleted},
            {'$group': {'_id': '$network', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        top_networks = list(offer_model.collection.aggregate(pipeline))
        
        # Get total hits
        pipeline = [
            {'$match': not_deleted},
            {'$group': {'_id': None, 'total_hits': {'$sum': '$hits'}}}
        ]
        hits_result = list(offer_model.collection.aggregate(pipeline))
        total_hits = hits_result[0]['total_hits'] if hits_result else 0
        
        return jsonify({
            'stats': {
                'total_offers': total_offers,
                'active_offers': active_offers,
                'pending_offers': pending_offers,
                'inactive_offers': inactive_offers,
                'total_hits': total_hits,
                'top_networks': top_networks
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get offers stats error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500

@admin_offers_bp.route('/offers/<offer_id>/assign-promo-code', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def assign_promo_code_to_offer(offer_id):
    """Assign promo code to offer and notify all publishers"""
    try:
        from bson import ObjectId
        from datetime import datetime
        
        data = request.get_json()
        
        if not data or not data.get('promo_code_id'):
            return jsonify({'error': 'Promo code ID is required'}), 400
        
        # Get collections
        offers_collection = db_instance.get_collection('offers')
        promo_codes_collection = db_instance.get_collection('promo_codes')
        users_collection = db_instance.get_collection('users')
        
        # Get offer
        offer = offers_collection.find_one({'_id': ObjectId(offer_id)})
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Get promo code
        try:
            promo_code_id = ObjectId(data.get('promo_code_id'))
        except:
            return jsonify({'error': 'Invalid promo code ID'}), 400
        
        promo_code = promo_codes_collection.find_one({'_id': promo_code_id})
        if not promo_code:
            return jsonify({'error': 'Promo code not found'}), 404
        
        # Update offer with promo code
        offers_collection.update_one(
            {'_id': ObjectId(offer_id)},
            {
                '$set': {
                    'promo_code_id': promo_code_id,
                    'promo_code': promo_code['code'],
                    'promo_code_assigned_at': datetime.utcnow(),
                    'promo_code_assigned_by': str(request.current_user['_id']),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Send BCC email to all publishers (single email, not individual)
        publishers = list(users_collection.find(
            {'role': 'publisher', 'email': {'$exists': True, '$ne': ''}},
            {'email': 1}
        ))
        publisher_emails = [p['email'] for p in publishers if p.get('email')]
        
        if publisher_emails:
            email_service = get_email_service()
            import threading
            def send_promo_bcc_assign():
                email_service.send_promo_code_assigned_to_offer_bcc(
                    recipients=publisher_emails,
                    offer_name=offer['name'],
                    code=promo_code['code'],
                    bonus_amount=promo_code['bonus_amount'],
                    bonus_type=promo_code['bonus_type'],
                    offer_id=str(offer_id)
                )
            threading.Thread(target=send_promo_bcc_assign, daemon=True).start()
        
        logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {offer['name']}")
        logging.info(f"📧 BCC email queued for {len(publisher_emails)} publishers")
        
        return jsonify({
            'message': f'Promo code assigned and email sent to {len(publisher_emails)} publishers',
            'offer_id': str(offer_id),
            'promo_code': promo_code['code'],
            'emails_sent': len(publisher_emails)
        }), 200
        
    except Exception as e:
        logging.error(f"Assign promo code error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to assign promo code: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-upload-async', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_upload_offers_async():
    """Async bulk upload offers with background processing and real-time progress tracking"""
    import os
    import tempfile
    from werkzeug.utils import secure_filename
    from utils.bulk_offer_upload import (
        parse_excel_file,
        parse_csv_file,
        fetch_google_sheet,
    )

    try:
        user = request.current_user
        options = {}
        rows = []

        # STEP 1: Parse file/URL only (fast) — no validation yet
        if request.content_type and 'application/json' in request.content_type:
            data = request.get_json()
            sheet_url = data.get('url')
            options = data.get('options', {})
            if not sheet_url:
                return jsonify({'error': 'Google Sheets URL is required'}), 400
            logging.info(f"📊 [ASYNC] Fetching Google Sheet: {sheet_url}")
            rows, error = fetch_google_sheet(sheet_url)
            if error:
                return jsonify({'error': error}), 400
        else:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            options_str = request.form.get('options', '{}')
            try:
                import json
                options = json.loads(options_str)
            except Exception:
                options = {}
            filename = secure_filename(file.filename)
            file_ext = os.path.splitext(filename)[1].lower()
            if file_ext not in ['.xlsx', '.xls', '.csv']:
                return jsonify({'error': 'Only Excel (.xlsx, .xls) and CSV files are supported'}), 400
            temp_dir = tempfile.gettempdir()
            temp_path = os.path.join(temp_dir, filename)
            file.save(temp_path)
            try:
                logging.info(f"📊 [ASYNC] Parsing file: {filename}")
                if file_ext in ['.xlsx', '.xls']:
                    rows, error = parse_excel_file(temp_path)
                else:
                    rows, error = parse_csv_file(temp_path)
                if error:
                    return jsonify({'error': error}), 400
            finally:
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

        if not rows:
            return jsonify({'error': 'No rows found in file'}), 400

        # STEP 2: Create job immediately — return fast
        job_id = str(uuid.uuid4())[:8]
        jobs_col = db_instance.get_collection('bulk_upload_jobs')
        job_doc = {
            'job_id': job_id,
            'status': 'validating',
            'total': len(rows),
            'processed': 0,
            'succeeded': 0,
            'failed': 0,
            'current_offer': 'Validating spreadsheet...',
            'errors': [],
            'created_ids': [],
            'skipped_duplicates': [],
            'started_at': datetime.utcnow(),
            'completed_at': None,
            'created_by': str(user['_id']),
        }
        jobs_col.insert_one(job_doc)

        # STEP 3: ALL heavy work in background thread
        def process_in_background(raw_rows, user_id, jid, opts):
            try:
                from database import db_instance as _db
                from utils.bulk_offer_upload import validate_spreadsheet_data
                from utils.bulk_operations import get_bulk_offer_processor

                _jobs_col = _db.get_collection('bulk_upload_jobs')

                # --- Validation phase ---
                _jobs_col.update_one({'job_id': jid}, {'$set': {'current_offer': 'Validating & mapping fields...'}})
                logging.info(f"🔍 [ASYNC-BG] Validating {len(raw_rows)} rows...")

                valid_rows, error_rows, missing_rows = validate_spreadsheet_data(raw_rows, store_missing=True)
                logging.info(f"✅ [ASYNC-BG] Validated: {len(valid_rows)} valid, {len(error_rows)} errors")

                skip_invalid = opts.get('skip_invalid_rows', False)
                if not valid_rows:
                    _jobs_col.update_one({'job_id': jid}, {'$set': {
                        'status': 'failed', 'current_offer': '',
                        'errors': [{'error': f'No valid rows. {len(error_rows)} errors, {len(missing_rows)} missing data.'}]
                    }})
                    return

                # Always proceed with valid rows, skip invalid ones
                if error_rows or missing_rows:
                    logging.info(f"⚠️ [ASYNC-BG] Skipping {len(error_rows)} errors + {len(missing_rows)} missing, proceeding with {len(valid_rows)} valid rows")

                # --- Apply options ---
                approval_type = opts.get('approval_type', 'auto_approve')
                if approval_type in ['direct', 'instant', 'immediate', 'auto']: approval_type = 'auto_approve'
                elif approval_type in ['time', 'timed', 'delay', 'delayed']: approval_type = 'time_based'
                elif approval_type in ['admin', 'approval']: approval_type = 'manual'

                require_approval = opts.get('require_approval', False)
                if approval_type in ['time_based', 'manual']: require_approval = True

                approval_settings = {
                    'type': approval_type, 'require_approval': require_approval,
                    'auto_approve_delay': int(opts.get('auto_approve_delay', 0) or 0),
                    'approval_message': '', 'max_inactive_days': 0
                }

                default_status = opts.get('default_status', 'active')
                show_in_offerwall = opts.get('show_in_offerwall', True)
                dup_strategy = opts.get('duplicate_strategy', 'skip')

                for row in valid_rows:
                    row['show_in_offerwall'] = show_in_offerwall
                    row['status'] = default_status
                    if opts.get('approval_type'):
                        row['approval_settings'] = approval_settings
                        row['approval_type'] = approval_type
                        row['auto_approve_delay'] = approval_settings['auto_approve_delay']
                        row['require_approval'] = require_approval
                        if require_approval: row['affiliates'] = 'request'

                # --- Processing phase ---
                _jobs_col.update_one({'job_id': jid}, {'$set': {
                    'status': 'processing', 'total': len(valid_rows),
                    'current_offer': 'Starting offer creation...'
                }})

                processor = get_bulk_offer_processor(_db)
                duplicates_map = processor.bulk_check_duplicates(valid_rows)

                for i, offer_data in enumerate(valid_rows):
                    try:
                        row_number = offer_data.pop('_row_number', i + 1)
                        name = offer_data.get('name', f'Row {row_number}')
                        _jobs_col.update_one({'job_id': jid}, {'$set': {'current_offer': name}})

                        is_dup, existing_id, _ = processor.is_duplicate(offer_data, duplicates_map)
                        if is_dup and dup_strategy == 'skip':
                            _jobs_col.update_one({'job_id': jid}, {
                                '$inc': {'processed': 1, 'failed': 1},
                                '$push': {'skipped_duplicates': {'row': row_number, 'name': name, 'reason': 'duplicate', 'existing_offer_id': existing_id}}
                            })
                            continue

                        prepared = processor._prepare_offer_for_insert(offer_data, user_id, row_number)
                        if prepared:
                            processor.offers_collection.insert_one(prepared)
                            _jobs_col.update_one({'job_id': jid}, {
                                '$inc': {'processed': 1, 'succeeded': 1},
                                '$push': {'created_ids': prepared.get('offer_id')}
                            })
                        else:
                            _jobs_col.update_one({'job_id': jid}, {
                                '$inc': {'processed': 1, 'failed': 1},
                                '$push': {'errors': {'row': row_number, 'name': name, 'error': 'Failed to prepare'}}
                            })
                    except Exception as e:
                        _jobs_col.update_one({'job_id': jid}, {
                            '$inc': {'processed': 1, 'failed': 1},
                            '$push': {'errors': {'row': row_number, 'name': name, 'error': str(e)}}
                        })

                _jobs_col.update_one({'job_id': jid}, {'$set': {'status': 'completed', 'completed_at': datetime.utcnow(), 'current_offer': ''}})
                logging.info(f"✅ [ASYNC-BG] Job {jid} completed")

            except Exception as e:
                logging.error(f"❌ [ASYNC-BG] Job {jid} failed: {str(e)}", exc_info=True)
                try:
                    _jobs_col.update_one({'job_id': jid}, {'$set': {'status': 'failed', 'current_offer': ''}, '$push': {'errors': {'error': str(e)}}})
                except Exception:
                    pass

        thread = threading.Thread(target=process_in_background, args=(rows, str(user['_id']), job_id, options))
        thread.daemon = False
        thread.start()

        logging.info(f"🚀 [ASYNC] Job {job_id} started for {len(rows)} raw rows")
        return jsonify({'job_id': job_id, 'total': len(rows), 'status': 'validating'}), 202

    except Exception as e:
        logging.error(f"Async bulk upload error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to process bulk upload: {str(e)}'}), 500


@admin_offers_bp.route('/offers/bulk-upload-status/<job_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_upload_status(job_id):
    """Get the status of an async bulk upload job"""
    jobs_col = db_instance.get_collection('bulk_upload_jobs')
    job = jobs_col.find_one({'job_id': job_id})
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    elapsed = (datetime.utcnow() - job['started_at']).total_seconds()

    return jsonify({
        'job_id': job['job_id'],
        'status': job['status'],
        'total': job['total'],
        'processed': job['processed'],
        'succeeded': job['succeeded'],
        'failed': job['failed'],
        'current_offer': job.get('current_offer', ''),
        'errors': job.get('errors', [])[-10:],
        'created_ids': job.get('created_ids', []),
        'skipped_duplicates': job.get('skipped_duplicates', []),
        'elapsed_seconds': round(elapsed, 2),
    })


@admin_offers_bp.route('/offers/bulk-upload', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_upload_offers():
    """Bulk upload offers from Excel/CSV file or Google Sheets URL"""
    import os
    import tempfile
    from werkzeug.utils import secure_filename
    from utils.bulk_offer_upload import (
        parse_excel_file, 
        parse_csv_file, 
        fetch_google_sheet,
        validate_spreadsheet_data,
        bulk_create_offers
    )
    
    try:
        user = request.current_user
        options = {}
        
        # Check if it's a Google Sheets URL or file upload
        if request.content_type and 'application/json' in request.content_type:
            # Google Sheets URL
            data = request.get_json()
            sheet_url = data.get('url')
            options = data.get('options', {})
            
            if not sheet_url:
                return jsonify({'error': 'Google Sheets URL is required'}), 400
            
            logging.info(f"📊 Fetching Google Sheet: {sheet_url}")
            rows, error = fetch_google_sheet(sheet_url)
            
            if error:
                return jsonify({'error': error}), 400
            
        else:
            # File upload
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400
            
            file = request.files['file']
            
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Get options from form data if present
            options_str = request.form.get('options', '{}')
            try:
                import json
                options = json.loads(options_str)
            except:
                options = {}
            
            # Get file extension
            filename = secure_filename(file.filename)
            file_ext = os.path.splitext(filename)[1].lower()
            
            if file_ext not in ['.xlsx', '.xls', '.csv']:
                return jsonify({'error': 'Only Excel (.xlsx, .xls) and CSV files are supported'}), 400
            
            # Save file temporarily
            temp_dir = tempfile.gettempdir()
            temp_path = os.path.join(temp_dir, filename)
            file.save(temp_path)
            
            try:
                logging.info(f"📊 Parsing uploaded file: {filename}")
                
                # Parse based on file type
                if file_ext in ['.xlsx', '.xls']:
                    rows, error = parse_excel_file(temp_path)
                else:  # .csv
                    rows, error = parse_csv_file(temp_path)
                
                if error:
                    return jsonify({'error': error}), 400
                    
            finally:
                # Clean up temp file
                try:
                    os.remove(temp_path)
                except:
                    pass
        
        # Extract approval settings from options
        approval_type = options.get('approval_type', 'auto_approve')
        auto_approve_delay = options.get('auto_approve_delay', 0)
        require_approval = options.get('require_approval', False)
        show_in_offerwall = options.get('show_in_offerwall', True)  # Default: show in offerwall
        duplicate_strategy = options.get('duplicate_strategy', 'skip')  # skip, update, or create_new
        
        # Normalize approval_type
        if approval_type in ['direct', 'instant', 'immediate', 'auto']:
            approval_type = 'auto_approve'
        elif approval_type in ['time', 'timed', 'delay', 'delayed']:
            approval_type = 'time_based'
        elif approval_type in ['admin', 'approval']:
            approval_type = 'manual'
        
        # Auto-set require_approval based on approval_type
        if approval_type in ['time_based', 'manual']:
            require_approval = True
        
        # Build approval_settings object
        approval_settings = {
            'type': approval_type,
            'require_approval': require_approval,
            'auto_approve_delay': int(auto_approve_delay) if auto_approve_delay else 0,
            'approval_message': '',
            'max_inactive_days': 0
        }
        
        logging.info(f"🔐 Approval settings from options: {approval_settings}")
        
        # Validate spreadsheet data - returns (valid, errors, missing_offers)
        logging.info(f"✅ Parsed {len(rows)} rows from spreadsheet")
        valid_rows, error_rows, missing_offers_rows = validate_spreadsheet_data(rows, store_missing=True)
        
        logging.info(f"✅ Validated: {len(valid_rows)} valid, {len(error_rows)} errors, {len(missing_offers_rows)} missing data")
        
        # Debug: Log target_url for first few valid rows to verify param injection
        for i, row in enumerate(valid_rows[:3]):
            logging.info(f"🔍 Valid row {i+1} target_url: {row.get('target_url', 'N/A')}")
            logging.info(f"🔍 Valid row {i+1} _upward_partner_name: {row.get('_upward_partner_name', 'none')}")
        
        # Apply approval settings to all valid rows (override spreadsheet values if options provided)
        if options.get('approval_type'):
            for row in valid_rows:
                row['approval_settings'] = approval_settings
                row['approval_type'] = approval_type
                row['auto_approve_delay'] = approval_settings['auto_approve_delay']
                row['require_approval'] = require_approval
                
                # Set affiliates to 'request' if approval is required
                if require_approval or approval_type in ['time_based', 'manual']:
                    row['affiliates'] = 'request'
        
        # Apply show_in_offerwall and default_status settings to all rows
        default_status = options.get('default_status', 'active')
        for row in valid_rows:
            row['show_in_offerwall'] = show_in_offerwall
            row['status'] = default_status
        
        # If there are validation issues OR no valid rows, generate detailed feedback
        if error_rows or missing_offers_rows or not valid_rows:
            from utils.bulk_offer_upload import generate_validation_feedback
            
            validation_feedback = generate_validation_feedback(error_rows, missing_offers_rows)
            
            # If there are SOME valid rows, allow skipping invalid ones
            can_skip_invalid = len(valid_rows) > 0
            
            response_data = {
                'error': 'Validation errors found in spreadsheet',
                'message': validation_feedback['summary'],
                'validation_feedback': validation_feedback,
                'validation_errors': error_rows,
                'missing_offers': missing_offers_rows,
                'valid_count': len(valid_rows),
                'error_count': len(error_rows),
                'missing_count': len(missing_offers_rows),
                'can_skip_invalid': can_skip_invalid,
            }
            
            # If user explicitly requested to skip invalid rows, proceed with valid ones
            skip_invalid = options.get('skip_invalid_rows', False)
            
            if skip_invalid and can_skip_invalid:
                logging.info(f"⚠️ Skipping {len(error_rows) + len(missing_offers_rows)} invalid rows, proceeding with {len(valid_rows)} valid rows")
                # Continue to create offers with valid rows
            else:
                return jsonify(response_data), 400
        
        # Use OPTIMIZED bulk processor for large datasets (avoids Render timeout)
        logging.info(f"🔨 Creating {len(valid_rows)} offers with OPTIMIZED bulk processor...")
        
        from database import db_instance
        from utils.bulk_operations import get_bulk_offer_processor
        
        bulk_processor = get_bulk_offer_processor(db_instance)
        result = bulk_processor.bulk_create_offers_optimized(
            valid_rows, 
            str(user['_id']),
            duplicate_strategy
        )
        
        created_offer_ids = result['created_ids']
        creation_errors = result['errors']
        skipped_duplicates = result['skipped_duplicates']
        stats = result['stats']
        
        logging.info(f"✅ Bulk create complete: {stats['created']} created, {stats['skipped']} skipped, {stats['errors']} errors in {stats['elapsed_seconds']}s")
        
        # Prepare response
        response_data = {
            'message': f'Successfully created {len(created_offer_ids)} offers',
            'created_count': len(created_offer_ids),
            'created_offer_ids': created_offer_ids,
            'total_rows': len(rows),
            'success': True,
            'processing_time': stats['elapsed_seconds']
        }
        
        if skipped_duplicates:
            response_data['skipped_duplicates'] = skipped_duplicates
            response_data['duplicate_count'] = len(skipped_duplicates)
            response_data['message'] = f'Created {len(created_offer_ids)} offers, skipped {len(skipped_duplicates)} duplicates'
        
        if creation_errors:
            response_data['creation_errors'] = creation_errors
            response_data['error_count'] = len(creation_errors)
            if skipped_duplicates:
                response_data['message'] = f'Created {len(created_offer_ids)} offers, skipped {len(skipped_duplicates)} duplicates, {len(creation_errors)} failed'
            else:
                response_data['message'] = f'Created {len(created_offer_ids)} offers, {len(creation_errors)} failed'
        
        # Send batch email notification if enabled and offers were created
        send_email = options.get('send_email', False)
        if send_email and created_offer_ids:
            try:
                from services.email_service import get_email_service
                users_collection = db_instance.get_collection('users')
                if users_collection is not None:
                    # Build recipient filter based on email_recipients option
                    email_recipients_type = options.get('email_recipients', 'all_publishers')
                    selected_user_ids = options.get('selected_user_ids', [])
                    
                    if email_recipients_type == 'specific_users' and selected_user_ids:
                        # Fetch specific users by ID
                        from bson import ObjectId as ObjId
                        obj_ids = []
                        for uid in selected_user_ids:
                            try:
                                obj_ids.append(ObjId(uid))
                            except:
                                pass
                        all_users = list(users_collection.find(
                            {'_id': {'$in': obj_ids}, 'email': {'$exists': True, '$ne': ''}},
                            {'email': 1}
                        ))
                    else:
                        user_filter = {
                            'email': {'$exists': True, '$ne': ''},
                            '$or': [
                                {'email_preferences.new_offers': True},
                                {'email_preferences.new_offers': {'$exists': False}},
                                {'email_preferences': {'$exists': False}}
                            ]
                        }
                        if email_recipients_type == 'active_publishers':
                            user_filter['role'] = 'publisher'
                            user_filter['status'] = {'$in': ['active', 'approved']}
                        all_users = list(users_collection.find(user_filter, {'email': 1}))
                    
                    all_emails = [u.get('email') for u in all_users if u.get('email')]
                    
                    if all_emails:
                        # Fetch the created offers from DB for email content
                        offers_col = db_instance.get_collection('offers')
                        created_offers = list(offers_col.find(
                            {'offer_id': {'$in': created_offer_ids}},
                            {'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'currency': 1}
                        ))
                        
                        email_service = get_email_service()
                        
                        # Check if scheduling is requested
                        email_schedule = options.get('email_schedule', 'now')
                        email_schedule_time = options.get('email_schedule_time', '')
                        offers_per_email = int(options.get('offers_per_email', 0))
                        
                        # Split offers into batches if offers_per_email > 0
                        if offers_per_email > 0 and len(created_offers) > offers_per_email:
                            offer_batches = [created_offers[i:i+offers_per_email] for i in range(0, len(created_offers), offers_per_email)]
                        else:
                            offer_batches = [created_offers]
                        
                        email_action = 'sent'
                        if email_schedule == 'scheduled' and email_schedule_time:
                            email_action = 'scheduled'
                            # Schedule emails for later
                            from datetime import datetime as dt
                            try:
                                scheduled_time = dt.fromisoformat(email_schedule_time)
                                scheduled_emails_col = db_instance.get_collection('scheduled_emails')
                                for batch_idx, batch in enumerate(offer_batches):
                                    offer_names = [o.get('name', 'New Offer') for o in batch]
                                    scheduled_emails_col.insert_one({
                                        'type': 'batch_new_offers',
                                        'offers': batch,
                                        'recipients': all_emails,
                                        'scheduled_at': scheduled_time,
                                        'status': 'pending',
                                        'batch_index': batch_idx + 1,
                                        'total_batches': len(offer_batches),
                                        'created_at': datetime.utcnow(),
                                        'created_by': str(user['_id'])
                                    })
                                logging.info(f"📧 Scheduled {len(offer_batches)} email batch(es) for {email_schedule_time}")
                            except Exception as sched_err:
                                logging.error(f"❌ Failed to schedule email: {sched_err}")
                                email_action = 'sent'
                                # Fallback to sending now
                                for batch in offer_batches:
                                    email_service.send_batch_new_offers_notification_async(batch, all_emails)
                        else:
                            # Send immediately
                            for batch in offer_batches:
                                email_service.send_batch_new_offers_notification_async(batch, all_emails)
                        
                        # Log email activity
                        try:
                            email_logs_col = db_instance.get_collection('email_activity_logs')
                            if email_logs_col is not None:
                                offer_names = [o.get('name', 'Unknown') for o in created_offers]
                                email_logs_col.insert_one({
                                    'action': email_action,
                                    'source': 'bulk_upload',
                                    'offer_ids': created_offer_ids,
                                    'offer_names': offer_names,
                                    'offer_count': len(created_offers),
                                    'recipient_type': email_recipients_type,
                                    'recipient_count': len(all_emails),
                                    'batch_count': len(offer_batches),
                                    'offers_per_email': offers_per_email,
                                    'scheduled_time': email_schedule_time if email_action == 'scheduled' else None,
                                    'admin_id': str(user['_id']),
                                    'admin_username': user.get('username', 'admin'),
                                    'created_at': datetime.utcnow()
                                })
                        except Exception as log_err:
                            logging.error(f"❌ Email activity log error: {log_err}")
                        
                        logging.info(f"📧 Email triggered: {len(offer_batches)} batch(es), {len(created_offers)} offers, {len(all_emails)} recipients")
            except Exception as email_error:
                logging.error(f"❌ Batch email error (non-critical): {str(email_error)}")
        elif not send_email:
            logging.info("📧 Email notifications skipped (send_email=false)")
        
        return jsonify(response_data), 201 if created_offer_ids else 200
        
    except Exception as e:
        logging.error(f"Bulk upload error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to process bulk upload: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-upload/template', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def download_bulk_upload_template():
    """Download template spreadsheet for bulk offer upload"""
    from flask import send_file
    import io
    import csv
    
    try:
        # Create CSV template in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        headers = [
            'campaign_id',
            'title',
            'url',
            'country',
            'payout',
            'payout_model',
            'preview_url',
            'image_url',
            'description',
            'platform',
            'expiry',
            'category',
            'device',
            'traffic_sources'
        ]
        writer.writerow(headers)
        
        # Write example row
        example_row = [
            'CAMP-12345',
            'Example Offer - Complete Survey',
            'https://example.com/offer',
            'US',
            '$2.50',
            'CPA',
            'https://example.com/preview',
            '',  # Empty = random image will be assigned
            'Complete a short survey about your shopping habits and earn $5 instantly',
            'SurveyNetwork',
            '2025-01-30',
            'surveys',
            'all',
            'Social and content traffic allowed'
        ]
        writer.writerow(example_row)
        
        # Convert to bytes
        output.seek(0)
        bytes_output = io.BytesIO(output.getvalue().encode('utf-8-sig'))
        bytes_output.seek(0)
        
        return send_file(
            bytes_output,
            mimetype='text/csv',
            as_attachment=True,
            download_name='bulk_offer_template.csv'
        )
        
    except Exception as e:
        logging.error(f"Template download error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate template: {str(e)}'}), 500


# ==================== API IMPORT ENDPOINTS ====================

@admin_offers_bp.route('/offers/api-import/test', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def test_api_connection():
    """Test connection to affiliate network API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        network_id = data.get('network_id')
        api_key = data.get('api_key')
        network_type = data.get('network_type', 'hasoffers')
        
        if not network_id or not api_key:
            return jsonify({'error': 'network_id and api_key are required'}), 400
        
        # Import service
        from services.network_api_service import network_api_service
        
        # Test connection
        success, offer_count, error = network_api_service.test_connection(
            network_id, api_key, network_type
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'offer_count': offer_count,
                'network_name': network_id
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': error or 'Connection failed'
            }), 400
            
    except Exception as e:
        logging.error(f"API connection test failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to test connection: {str(e)}'}), 500


@admin_offers_bp.route('/offers/api-import/preview', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def preview_api_offers():
    """Preview offers from affiliate network API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        network_id = data.get('network_id')
        api_key = data.get('api_key')
        network_type = data.get('network_type', 'hasoffers')
        filters = data.get('filters', {})
        limit = data.get('limit', 5)  # Preview only 5 offers
        
        if not network_id or not api_key:
            return jsonify({'error': 'network_id and api_key are required'}), 400
        
        # Import services
        from services.network_api_service import network_api_service
        from services.network_field_mapper import network_field_mapper
        
        # First, get the actual total count from test_connection
        success, total_count, test_error = network_api_service.test_connection(
            network_id, api_key, network_type
        )
        
        if not success:
            return jsonify({
                'success': False,
                'error': test_error or 'Failed to get offer count'
            }), 400
        
        # Fetch preview offers (limited)
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, network_type, filters, limit
        )
        
        # Debug with print (always shows)
        logging.info(f"Preview: {network_id} ({network_type}) - {total_count} total, {len(offers)} fetched")
        
        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Map offers to preview format
        preview_offers = []
        for offer_data in offers[:limit]:
            try:
                mapped = network_field_mapper.map_to_db_format(offer_data, network_type, network_id)
                if mapped:
                    preview_offers.append({
                        'name': mapped.get('name', 'Unknown'),
                        'payout': mapped.get('payout', 0),
                        'currency': mapped.get('currency', 'USD'),
                        'countries': mapped.get('countries', []),
                        'status': mapped.get('status', 'active')
                    })
            except Exception as e:
                logging.warning(f"Error mapping preview offer: {str(e)}")
                continue
        
        logging.info(f"✅ Returning {len(preview_offers)} preview offers (total available: {total_count})")
        
        return jsonify({
            'success': True,
            'offers': preview_offers,
            'total_available': total_count or len(offers)  # Use actual total count
        }), 200
        
    except Exception as e:
        logging.error(f"API preview failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to preview offers: {str(e)}'}), 500


@admin_offers_bp.route('/offers/api-import', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def import_api_offers():
    """Import offers from affiliate network API - OPTIMIZED for large batches"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        network_id = data.get('network_id')
        api_key = data.get('api_key')
        network_type = data.get('network_type', 'hasoffers')
        filters = data.get('filters', {})
        options = data.get('options', {})
        
        if not network_id or not api_key:
            return jsonify({'error': 'network_id and api_key are required'}), 400
        
        # Import services
        from services.network_api_service import network_api_service
        from services.network_field_mapper import network_field_mapper
        from utils.bulk_operations import get_bulk_offer_processor
        
        # Get current user
        current_user = request.current_user
        created_by = str(current_user.get('_id', current_user.get('username', 'admin')))
        
        # Fetch offers from API
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, network_type, filters
        )
        
        logging.info(f"🔍 API Import: Fetched {len(offers)} offers from {network_id}")
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        if not offers:
            return jsonify({'success': True, 'summary': {'total_fetched': 0, 'imported': 0}}), 200
        
        # Get options
        skip_duplicates = options.get('skip_duplicates', True)
        update_existing = options.get('update_existing', False)
        default_status = options.get('default_status', 'active')
        
        # Get approval workflow settings
        approval_type = options.get('approval_type', 'auto_approve')
        auto_approve_delay = options.get('auto_approve_delay', 0)
        require_approval = options.get('require_approval', False)
        
        # Normalize approval_type
        if approval_type in ['direct', 'instant', 'immediate', 'auto']:
            approval_type = 'auto_approve'
        elif approval_type in ['time', 'timed', 'delay', 'delayed']:
            approval_type = 'time_based'
        elif approval_type in ['admin', 'approval']:
            approval_type = 'manual'
        
        if approval_type in ['time_based', 'manual']:
            require_approval = True
        
        approval_settings = {
            'type': approval_type,
            'require_approval': require_approval,
            'auto_approve_delay': int(auto_approve_delay) if auto_approve_delay else 0,
            'approval_message': options.get('approval_message', ''),
            'max_inactive_days': options.get('max_inactive_days', 0)
        }
        
        duplicate_strategy = 'skip' if skip_duplicates else ('update' if update_existing else 'create_new')
        
        # Step 1: Map all offers to DB format (fast, no DB calls)
        mapped_offers = []
        mapping_errors = []
        
        for idx, offer_data in enumerate(offers):
            try:
                mapped_offer = network_field_mapper.map_to_db_format(offer_data, network_type, network_id)
                
                if not mapped_offer:
                    mapping_errors.append({'row': idx + 1, 'error': 'Failed to map offer data'})
                    continue
                
                # Validate
                is_valid, validation_errors = network_field_mapper.validate_mapped_offer(mapped_offer)
                if not is_valid:
                    mapping_errors.append({
                        'row': idx + 1,
                        'name': mapped_offer.get('name', 'Unknown'),
                        'error': ', '.join(validation_errors)
                    })
                    continue
                
                # Apply default status from options
                mapped_offer['status'] = default_status
                
                mapped_offer['approval_settings'] = approval_settings
                mapped_offer['approval_type'] = approval_type
                mapped_offer['auto_approve_delay'] = approval_settings['auto_approve_delay']
                mapped_offer['require_approval'] = require_approval
                mapped_offer['_row_number'] = idx + 1
                
                if require_approval or approval_type in ['time_based', 'manual']:
                    mapped_offer['affiliates'] = 'request'
                
                mapped_offers.append(mapped_offer)
                
            except Exception as e:
                mapping_errors.append({
                    'row': idx + 1,
                    'error': str(e)
                })
        
        logging.info(f"✅ Mapped {len(mapped_offers)} offers, {len(mapping_errors)} mapping errors")
        
        # Step 1.5: Apply Upward Partner network params to all mapped offers
        from services.tracking_link_generator import apply_network_offer_params
        params_injected = 0
        for offer in mapped_offers:
            original_url = offer.get('target_url', '')
            offer.update(apply_network_offer_params(offer))
            if offer.get('target_url', '') != original_url:
                params_injected += 1
        if params_injected > 0:
            logging.info(f"🔗 Injected partner params into {params_injected} offer URLs")
        
        # Step 2: Use optimized bulk processor
        bulk_processor = get_bulk_offer_processor(db_instance)
        result = bulk_processor.bulk_create_offers_optimized(
            mapped_offers,
            created_by,
            duplicate_strategy
        )
        
        # Build response
        response_data = {
            'success': True,
            'summary': {
                'total_fetched': len(offers),
                'imported': result['stats']['created'],
                'skipped': result['stats']['skipped'],
                'errors': result['stats']['errors'] + len(mapping_errors),
                'processing_time': result['stats']['elapsed_seconds']
            },
            'imported_offers': result['created_ids'],
            'skipped_offers': result['skipped_duplicates'][:10],
            'errors': (mapping_errors + result['errors'])[:10]
        }
        
        logging.info(f"✅ API Import complete: {result['stats']['created']} imported in {result['stats']['elapsed_seconds']}s")
        
        # Send batch email notification if enabled and offers were created
        send_email = options.get('send_email', False)
        if send_email and result['created_ids']:
            try:
                from services.email_service import get_email_service
                users_collection = db_instance.get_collection('users')
                if users_collection is not None:
                    email_recipients_type = options.get('email_recipients', 'all_publishers')
                    selected_user_ids = options.get('selected_user_ids', [])
                    
                    if email_recipients_type == 'specific_users' and selected_user_ids:
                        from bson import ObjectId as ObjId
                        obj_ids = []
                        for uid in selected_user_ids:
                            try:
                                obj_ids.append(ObjId(uid))
                            except:
                                pass
                        all_users = list(users_collection.find(
                            {'_id': {'$in': obj_ids}, 'email': {'$exists': True, '$ne': ''}},
                            {'email': 1}
                        ))
                    else:
                        user_filter = {
                            'email': {'$exists': True, '$ne': ''},
                            '$or': [
                                {'email_preferences.new_offers': True},
                                {'email_preferences.new_offers': {'$exists': False}},
                                {'email_preferences': {'$exists': False}}
                            ]
                        }
                        if email_recipients_type == 'active_publishers':
                            user_filter['role'] = 'publisher'
                            user_filter['status'] = {'$in': ['active', 'approved']}
                        all_users = list(users_collection.find(user_filter, {'email': 1}))
                    
                    all_emails = [u.get('email') for u in all_users if u.get('email')]
                    
                    if all_emails:
                        offers_col = db_instance.get_collection('offers')
                        created_offers = list(offers_col.find(
                            {'offer_id': {'$in': result['created_ids']}},
                            {'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'currency': 1}
                        ))
                        
                        email_service = get_email_service()
                        
                        email_schedule = options.get('email_schedule', 'now')
                        email_schedule_time = options.get('email_schedule_time', '')
                        offers_per_email = int(options.get('offers_per_email', 0))
                        
                        if offers_per_email > 0 and len(created_offers) > offers_per_email:
                            offer_batches = [created_offers[i:i+offers_per_email] for i in range(0, len(created_offers), offers_per_email)]
                        else:
                            offer_batches = [created_offers]
                        
                        email_action = 'sent'
                        if email_schedule == 'scheduled' and email_schedule_time:
                            email_action = 'scheduled'
                            from datetime import datetime as dt
                            try:
                                scheduled_time = dt.fromisoformat(email_schedule_time)
                                scheduled_emails_col = db_instance.get_collection('scheduled_emails')
                                for batch_idx, batch in enumerate(offer_batches):
                                    scheduled_emails_col.insert_one({
                                        'type': 'batch_new_offers',
                                        'offers': batch,
                                        'recipients': all_emails,
                                        'scheduled_at': scheduled_time,
                                        'status': 'pending',
                                        'batch_index': batch_idx + 1,
                                        'total_batches': len(offer_batches),
                                        'created_at': datetime.utcnow(),
                                        'created_by': str(request.current_user.get('_id', 'admin'))
                                    })
                                logging.info(f"📧 Scheduled {len(offer_batches)} email batch(es) for {email_schedule_time}")
                            except Exception as sched_err:
                                logging.error(f"❌ Failed to schedule email: {sched_err}")
                                email_action = 'sent'
                                for batch in offer_batches:
                                    email_service.send_batch_new_offers_notification_async(batch, all_emails)
                        else:
                            for batch in offer_batches:
                                email_service.send_batch_new_offers_notification_async(batch, all_emails)
                        
                        # Log email activity
                        try:
                            email_logs_col = db_instance.get_collection('email_activity_logs')
                            if email_logs_col is not None:
                                offer_names = [o.get('name', 'Unknown') for o in created_offers]
                                email_logs_col.insert_one({
                                    'action': email_action,
                                    'source': 'api_import',
                                    'offer_ids': result['created_ids'],
                                    'offer_names': offer_names,
                                    'offer_count': len(created_offers),
                                    'recipient_type': email_recipients_type,
                                    'recipient_count': len(all_emails),
                                    'batch_count': len(offer_batches),
                                    'offers_per_email': offers_per_email,
                                    'scheduled_time': email_schedule_time if email_action == 'scheduled' else None,
                                    'admin_id': str(request.current_user.get('_id', 'admin')),
                                    'admin_username': request.current_user.get('username', 'admin'),
                                    'created_at': datetime.utcnow()
                                })
                        except Exception as log_err:
                            logging.error(f"❌ Email activity log error: {log_err}")
                        
                        logging.info(f"📧 Email triggered: {len(offer_batches)} batch(es), {len(created_offers)} API-imported offers")
            except Exception as email_error:
                logging.error(f"❌ Batch email error (non-critical): {str(email_error)}")
        elif not send_email:
            logging.info("📧 Email notifications skipped (send_email=false)")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"API import failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to import offers: {str(e)}'}), 500


# ==================== DEBUG ENDPOINT ====================

@admin_offers_bp.route('/offers/api-import/debug', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def debug_api_response():
    """Debug endpoint to see raw API response"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        network_id = data.get('network_id')
        api_key = data.get('api_key')
        network_type = data.get('network_type', 'hasoffers')
        
        if not network_id or not api_key:
            return jsonify({'error': 'network_id and api_key are required'}), 400
        
        # Make direct API call
        import requests
        
        url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"
        params = {
            'NetworkId': network_id,
            'Target': 'Affiliate_Offer',
            'Method': 'findMyOffers',
            'api_key': api_key,
            'limit': 5
        }
        
        response = requests.get(url, params=params, timeout=30)
        raw_data = response.json()
        
        # Log the response
        logging.info("="*80)
        logging.info("🔍 RAW API RESPONSE:")
        logging.info(f"Status Code: {response.status_code}")
        logging.info(f"Response Keys: {list(raw_data.keys())}")
        
        if 'response' in raw_data:
            logging.info(f"Response Status: {raw_data['response'].get('status')}")
            logging.info(f"Response Data Type: {type(raw_data['response'].get('data'))}")
            
            data_obj = raw_data['response'].get('data', {})
            if isinstance(data_obj, dict):
                logging.info(f"Data Keys (first 5): {list(data_obj.keys())[:5]}")
                
                # Check first offer structure
                first_key = list(data_obj.keys())[0] if data_obj else None
                if first_key:
                    first_offer = data_obj[first_key]
                    logging.info(f"First Offer Keys: {list(first_offer.keys()) if isinstance(first_offer, dict) else 'Not a dict'}")
        
        logging.info("="*80)
        
        return jsonify({
            'success': True,
            'raw_response': raw_data,
            'summary': {
                'status_code': response.status_code,
                'response_status': raw_data.get('response', {}).get('status'),
                'data_type': str(type(raw_data.get('response', {}).get('data'))),
                'data_count': len(raw_data.get('response', {}).get('data', {})) if isinstance(raw_data.get('response', {}).get('data'), dict) else 0
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Debug endpoint failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500


# ==================== DUPLICATE REMOVAL ENDPOINTS ====================

@admin_offers_bp.route('/offers/duplicates/check', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def check_duplicates():
    """Check for duplicate offers without removing them"""
    try:
        from utils.duplicate_remover import DuplicateOfferRemover
        
        remover = DuplicateOfferRemover()
        summary = remover.get_duplicate_summary()
        
        return jsonify({
            'success': True,
            'summary': summary
        }), 200
        
    except Exception as e:
        logging.error(f"Check duplicates error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to check duplicates: {str(e)}'}), 500


@admin_offers_bp.route('/offers/duplicates/remove', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def remove_duplicates():
    """Remove duplicate offers, keeping only one per offer_id"""
    try:
        from utils.duplicate_remover import DuplicateOfferRemover
        
        data = request.get_json() or {}
        keep_strategy = data.get('keep_strategy', 'newest')  # 'newest' or 'oldest'
        
        if keep_strategy not in ['newest', 'oldest']:
            return jsonify({'error': 'keep_strategy must be "newest" or "oldest"'}), 400
        
        remover = DuplicateOfferRemover()
        total_duplicates, removed_count, errors = remover.remove_duplicates(keep_strategy)
        
        if errors:
            return jsonify({
                'success': True,
                'message': f'Removed {removed_count} duplicate offers with some errors',
                'total_duplicates_found': total_duplicates,
                'removed': removed_count,
                'errors': errors
            }), 200
        
        return jsonify({
            'success': True,
            'message': f'Successfully removed {removed_count} duplicate offers',
            'total_duplicates_found': total_duplicates,
            'removed': removed_count
        }), 200
        
    except Exception as e:
        logging.error(f"Remove duplicates error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to remove duplicates: {str(e)}'}), 500


# ==================== RANDOM IMAGE ASSIGNMENT ====================

# List of placeholder images by category/vertical
PLACEHOLDER_IMAGES = {
    'Finance': [
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop',
    ],
    'Gaming': [
        'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop',
    ],
    'Dating': [
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1522098543979-ffc7f79a56c4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=300&fit=crop',
    ],
    'Health': [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
    ],
    'E-commerce': [
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop',
    ],
    'Entertainment': [
        'https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=300&fit=crop',
    ],
    'Education': [
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop',
    ],
    'Travel': [
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=400&h=300&fit=crop',
    ],
    'Utilities': [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=300&fit=crop',
    ],
    'Lifestyle': [
        'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=300&fit=crop',
    ],
    'default': [
        'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=300&fit=crop',
    ]
}

@admin_offers_bp.route('/offers/assign-random-images', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def assign_random_images():
    """Assign random placeholder images to offers without images"""
    import random
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Find offers without images
        query = {
            '$and': [
                {'$or': [
                    {'deleted': {'$exists': False}},
                    {'deleted': False}
                ]},
                {'$or': [
                    {'image_url': {'$exists': False}},
                    {'image_url': None},
                    {'image_url': ''},
                    {'thumbnail_url': {'$exists': False}},
                    {'thumbnail_url': None},
                    {'thumbnail_url': ''}
                ]}
            ]
        }
        
        offers_without_images = list(offers_collection.find(query))
        total_found = len(offers_without_images)
        
        logging.info(f"Found {total_found} offers without images")
        
        updated_count = 0
        
        for offer in offers_without_images:
            # Get vertical/category for the offer
            vertical = offer.get('vertical') or offer.get('category') or 'default'
            
            # Get images for this vertical (fallback to default)
            images = PLACEHOLDER_IMAGES.get(vertical, PLACEHOLDER_IMAGES['default'])
            
            # Pick a random image
            random_image = random.choice(images)
            
            # Update the offer
            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {
                    'image_url': random_image,
                    'thumbnail_url': random_image,
                    'updated_at': datetime.utcnow()
                }}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logging.info(f"Assigned image to offer {offer.get('offer_id')}: {random_image}")
        
        return jsonify({
            'success': True,
            'message': f'Assigned random images to {updated_count} offers',
            'total_found': total_found,
            'updated_count': updated_count
        }), 200
        
    except Exception as e:
        logging.error(f"Assign random images error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to assign images: {str(e)}'}), 500


@admin_offers_bp.route('/offers/count-without-images', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def count_offers_without_images():
    """Count offers that don't have images"""
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Count offers without images
        query = {
            '$and': [
                {'$or': [
                    {'deleted': {'$exists': False}},
                    {'deleted': False}
                ]},
                {'$or': [
                    {'image_url': {'$exists': False}},
                    {'image_url': None},
                    {'image_url': ''},
                ]}
            ]
        }
        
        count = offers_collection.count_documents(query)
        
        return jsonify({
            'success': True,
            'count': count
        }), 200
        
    except Exception as e:
        logging.error(f"Count offers without images error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to count offers: {str(e)}'}), 500


# ==================== EMAIL ACTIVITY LOGS ====================

@admin_offers_bp.route('/offers/email-activity-logs', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_email_activity_logs():
    """Get email activity logs for offer-related emails"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        source_filter = request.args.get('source', '')  # bulk_upload, api_import, single_offer

        email_logs_col = db_instance.get_collection('email_activity_logs')
        if email_logs_col is None:
            return jsonify({'logs': [], 'total': 0, 'page': page, 'per_page': per_page}), 200

        query = {}
        if source_filter:
            query['source'] = source_filter

        total = email_logs_col.count_documents(query)
        logs = list(
            email_logs_col.find(query)
            .sort('created_at', -1)
            .skip((page - 1) * per_page)
            .limit(per_page)
        )

        for log in logs:
            log['_id'] = str(log['_id'])
            if log.get('created_at'):
                log['created_at'] = log['created_at'].isoformat()

        return jsonify({
            'logs': logs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        }), 200

    except Exception as e:
        logging.error(f"Get email activity logs error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get email activity logs: {str(e)}'}), 500

@admin_offers_bp.route('/offers/fix-tracking-links', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def fix_network_tracking_links():
    """
    Inject partner offer_url_params into existing offer tracking URLs.
    Does NOT regenerate the base URL — only appends missing partner params.
    """
    try:
        from services.tracking_link_generator import (
            normalize_network_name,
            get_partner_by_name,
            get_partner_by_domain,
            inject_offer_url_params
        )

        offers_collection = db_instance.get_collection('offers')

        data = request.get_json() or {}
        requested_networks = data.get('networks', ['leadads', 'cpamerchant', 'chameleonads'])

        network_variations = []
        for n in requested_networks:
            normalized = n.lower().strip().replace(' ', '').replace('_', '')
            network_variations.extend([normalized, n.lower(), n])

        # Pre-load partner configs by network name
        partner_cache = {}
        for network in requested_networks:
            normalized = normalize_network_name(network)
            partner = get_partner_by_name(normalized)
            if partner:
                partner_cache[normalized] = partner
                logging.info(f"Loaded partner config for {normalized}: {partner.get('partner_name')}")

        # Find offers from these networks
        query = {
            '$or': [
                {'network': {'$regex': nv, '$options': 'i'}}
                for nv in set(network_variations)
            ]
        }

        offers = list(offers_collection.find(query))
        updated = 0
        skipped = 0
        errors = 0
        details = []

        for offer in offers:
            try:
                network = offer.get('network', '')
                normalized = normalize_network_name(network)
                old_url = offer.get('target_url', '')

                if not old_url:
                    skipped += 1
                    continue

                # Find partner — try by network name first, then by domain
                partner = partner_cache.get(normalized)
                if not partner:
                    partner = get_partner_by_domain(old_url)

                if not partner:
                    skipped += 1
                    continue

                # Get offer_url_params from partner config
                params = partner.get('offer_url_params', [])
                if not params:
                    mapping = partner.get('parameter_mapping', {})
                    if mapping:
                        params = [
                            {'our_field': v, 'their_param': k}
                            for k, v in mapping.items()
                            if k and v
                        ]

                if not params:
                    skipped += 1
                    continue

                # Inject params into existing URL (only adds missing ones)
                new_url = inject_offer_url_params(old_url, params)

                if old_url == new_url:
                    skipped += 1
                    continue

                result = offers_collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {'target_url': new_url, 'updated_at': datetime.utcnow()}}
                )

                if result.modified_count > 0:
                    updated += 1
                    details.append({
                        'offer_id': offer.get('offer_id', ''),
                        'campaign_id': offer.get('campaign_id', ''),
                        'name': offer.get('name', '')[:50],
                        'network': network,
                        'old_url': old_url[:100],
                        'new_url': new_url
                    })
                else:
                    errors += 1

            except Exception as e:
                logging.error(f"Error updating offer {offer.get('_id')}: {e}")
                errors += 1

        return jsonify({
            'success': True,
            'message': f'Updated {updated} offers, skipped {skipped}, errors {errors}',
            'total_found': len(offers),
            'updated': updated,
            'skipped': skipped,
            'errors': errors,
            'details': details[:50]
        }), 200

    except Exception as e:
        logging.error(f"Fix tracking links error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to fix tracking links: {str(e)}'}), 500


# ============================================================
# OFFER ROTATION ENDPOINTS
# ============================================================

@admin_offers_bp.route('/offers/rotation/status', methods=['GET'])
@token_required
@admin_required
def get_rotation_status():
    """Get current rotation status and config."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.get_status()
        from utils.json_serializer import serialize_for_json
        return jsonify(serialize_for_json(status)), 200
    except Exception as e:
        logging.error(f"Rotation status error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/current-batch-details', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_rotation_batch_details():
    """Get full offer details for the current rotation batch."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.get_status()

        batch_ids = status.get('current_batch_ids', [])
        running_ids = set(status.get('running_offer_ids', []))

        if not batch_ids:
            return jsonify({
                'offers': [],
                'total': 0,
                'rotation_info': {
                    'enabled': status.get('enabled', False),
                    'batch_index': status.get('batch_index', 0),
                    'batch_activated_at': status.get('batch_activated_at'),
                    'window_minutes': status.get('window_minutes', 0),
                    'time_remaining_seconds': status.get('time_remaining_seconds'),
                    'next_rotation_at': status.get('next_rotation_at'),
                    'inactive_pool_count': status.get('inactive_pool_count', 0),
                }
            }), 200

        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Fetch full offer details
        offer_docs = list(offers_col.find(
            {'offer_id': {'$in': batch_ids}},
            {
                'offer_id': 1, 'name': 1, 'network': 1, 'payout': 1, 'status': 1,
                'category': 1, 'countries': 1, 'allowed_countries': 1,
                'clicks': 1, 'conversions': 1, 'image_url': 1, 'thumbnail_url': 1,
                'rotation_activated_at': 1, 'rotation_running': 1,
                'rotation_batch_index': 1, 'created_at': 1, 'updated_at': 1,
                'payout_type': 1, 'target_url': 1,
            }
        ))

        # Also get click counts from clicks collection for these offers
        clicks_col = db_instance.get_collection('clicks')
        click_counts = {}
        if clicks_col is not None:
            try:
                pipeline = [
                    {'$match': {'offer_id': {'$in': batch_ids}}},
                    {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}, 'last_click': {'$max': '$timestamp'}}},
                ]
                for doc in clicks_col.aggregate(pipeline):
                    click_counts[doc['_id']] = {'clicks': doc['count'], 'last_click': doc.get('last_click')}
            except Exception:
                pass

        offers = []
        for doc in offer_docs:
            oid = doc.get('offer_id', '')
            click_data = click_counts.get(oid, {})
            countries = doc.get('allowed_countries') or doc.get('countries') or []
            offers.append({
                'offer_id': oid,
                'name': doc.get('name', ''),
                'network': doc.get('network', ''),
                'payout': doc.get('payout', 0),
                'payout_type': doc.get('payout_type', ''),
                'status': doc.get('status', ''),
                'category': doc.get('category', ''),
                'countries': countries[:5] if isinstance(countries, list) else [],
                'clicks': click_data.get('clicks', doc.get('clicks', 0)),
                'conversions': doc.get('conversions', 0),
                'last_click': click_data.get('last_click'),
                'is_running': oid in running_ids,
                'rotation_activated_at': doc.get('rotation_activated_at'),
                'rotation_batch_index': doc.get('rotation_batch_index'),
                'created_at': doc.get('created_at'),
                'updated_at': doc.get('updated_at'),
                'image_url': doc.get('image_url') or doc.get('thumbnail_url', ''),
            })

        # Sort: running offers first, then by clicks desc
        offers.sort(key=lambda o: (not o['is_running'], -(o.get('clicks') or 0)))

        from utils.json_serializer import serialize_for_json
        return jsonify(serialize_for_json({
            'offers': offers,
            'total': len(offers),
            'rotation_info': {
                'enabled': status.get('enabled', False),
                'batch_index': status.get('batch_index', 0),
                'batch_activated_at': status.get('batch_activated_at'),
                'window_minutes': status.get('window_minutes', 0),
                'time_remaining_seconds': status.get('time_remaining_seconds'),
                'next_rotation_at': status.get('next_rotation_at'),
                'inactive_pool_count': status.get('inactive_pool_count', 0),
                'running_count': len(running_ids),
            }
        })), 200

    except Exception as e:
        logging.error(f"Rotation batch details error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/enable', methods=['POST'])
@token_required
@admin_required
def enable_rotation():
    """Enable the rotation loop."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.enable()
        from utils.json_serializer import serialize_for_json
        return jsonify({'message': 'Rotation enabled', **serialize_for_json(status)}), 200
    except Exception as e:
        logging.error(f"Enable rotation error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/disable', methods=['POST'])
@token_required
@admin_required
def disable_rotation():
    """Disable the rotation loop (current batch stays active until window ends)."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.disable()
        from utils.json_serializer import serialize_for_json
        return jsonify({'message': 'Rotation disabled', **serialize_for_json(status)}), 200
    except Exception as e:
        logging.error(f"Disable rotation error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/config', methods=['PUT'])
@token_required
@admin_required
def update_rotation_config():
    """Update rotation batch_size and/or window_hours."""
    try:
        data = request.get_json() or {}
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.update_config(
            batch_size=data.get('batch_size'),
            window_minutes=data.get('window_minutes'),
        )
        from utils.json_serializer import serialize_for_json
        return jsonify({'message': 'Config updated', **serialize_for_json(status)}), 200
    except Exception as e:
        logging.error(f"Update rotation config error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/force', methods=['POST'])
@token_required
@admin_required
def force_rotation():
    """Force an immediate rotation."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        result = service.force_rotate()
        from utils.json_serializer import serialize_for_json
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'message': 'Rotation forced', **serialize_for_json(result)}), 200
    except Exception as e:
        logging.error(f"Force rotation error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_offers_bp.route('/offers/rotation/reset', methods=['POST'])
@token_required
@admin_required
def reset_rotation():
    """Reset all rotation state."""
    try:
        from services.offer_rotation_service import get_rotation_service
        service = get_rotation_service()
        status = service.reset()
        from utils.json_serializer import serialize_for_json
        return jsonify({'message': 'Rotation reset', **serialize_for_json(status)}), 200
    except Exception as e:
        logging.error(f"Reset rotation error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
