from flask import Blueprint, request, jsonify
from services.access_control_service import AccessControlService
from services.email_service import get_email_service
from models.offer import Offer
from models.user import User
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response
from database import db_instance
import logging
from datetime import datetime

admin_offer_requests_bp = Blueprint('admin_offer_requests', __name__)
access_service = AccessControlService()
offer_model = Offer()

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
