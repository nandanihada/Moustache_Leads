from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from datetime import datetime
from bson import ObjectId
import logging
from routes.user_payments import calculate_user_earnings, fetch_user_transactions

logger = logging.getLogger(__name__)

admin_payments_bp = Blueprint('admin_payments', __name__)

def get_collection(collection_name):
    from database import db_instance
    if not db_instance.is_connected():
        return None
    return db_instance.get_collection(collection_name)

@admin_payments_bp.route('/users', methods=['GET'])
@token_required
@admin_required
def get_all_users_payments():
    try:
        users_col = get_collection('users')
        if users_col is None:
            return jsonify({'error': 'Database unavailable'}), 500
            
        users = list(users_col.find({'role': {'$nin': ['admin', 'subadmin']}}))
        
        # Batch Fetch logic
        user_ids_str = [str(u['_id']) for u in users]
        user_ids_obj = [u['_id'] for u in users]
        
        conversions_col = get_collection('forwarded_postbacks')
        promo_col = get_collection('bonus_earnings')
        gift_col = get_collection('gift_card_redemptions')
        ref_p1_col = get_collection('referrals_p1')
        ref_p2_col = get_collection('referrals_p2')
        adj_col = get_collection('balance_adjustments')
        pm_col = get_collection('payout_methods')
        
        conv_res = list(conversions_col.aggregate([{'$match': {'publisher_id': {'$in': user_ids_str}, 'forward_status': {'$nin': ['reversed']}, 'is_reversal': {'$ne': True}}}, {'$group': {'_id': '$publisher_id', 'total': {'$sum': '$points'}}}])) if conversions_col is not None else []
        conv_map = {r['_id']: r['total'] for r in conv_res}
        
        rev_conv_res = list(conversions_col.aggregate([{'$match': {'publisher_id': {'$in': user_ids_str}, '$or': [{'forward_status': 'reversed'}, {'status': 'reversed'}, {'is_reversal': True}]}}, {'$group': {'_id': '$publisher_id', 'total': {'$sum': '$points'}}}])) if conversions_col is not None else []
        rev_conv_map = {r['_id']: r['total'] for r in rev_conv_res}

        promo_res = list(promo_col.aggregate([{'$match': {'user_id': {'$in': user_ids_obj}, 'status': 'credited'}}, {'$group': {'_id': '$user_id', 'total': {'$sum': '$bonus_amount'}}}])) if promo_col is not None else []
        promo_map = {str(r['_id']): r['total'] for r in promo_res}
        
        # gift_card_redemptions can unexpectedly store string or objectId user_ids depending on route histories
        gift_res = list(gift_col.aggregate([{'$match': {'user_id': {'$in': user_ids_str + user_ids_obj}, 'status': {'$ne': 'reversed'}}}, {'$group': {'_id': '$user_id', 'total': {'$sum': '$amount'}}}])) if gift_col is not None else []
        gift_map = {str(r['_id']): r['total'] for r in gift_res}
        
        p1_res = list(ref_p1_col.aggregate([{'$match': {'referrer_id': {'$in': user_ids_str}, 'bonus_released': True, 'status': {'$ne': 'reversed'}}}, {'$group': {'_id': '$referrer_id', 'total': {'$sum': '$bonus_amount'}}}])) if ref_p1_col is not None else []
        p1_map = {r['_id']: r['total'] for r in p1_res}
        
        p2_res = list(ref_p2_col.aggregate([{'$match': {'referrer_id': {'$in': user_ids_str}}}, {'$group': {'_id': '$referrer_id', 'total': {'$sum': '$commission_earned'}}}])) if ref_p2_col is not None else []
        p2_map = {r['_id']: r['total'] for r in p2_res}
        
        adj_res = list(adj_col.aggregate([{'$match': {'user_id': {'$in': user_ids_obj}, 'type': {'$ne': 'payment'}}}, {'$group': {'_id': '$user_id', 'total': {'$sum': '$amount'}}}])) if adj_col is not None else []
        adj_map = {str(r['_id']): r['total'] for r in adj_res}
        
        ups_col = get_collection('user_payout_settings')
        ups_list = list(ups_col.find({'user_id': {'$in': user_ids_obj}})) if ups_col is not None else []
        ups_map = {str(r['user_id']): r for r in ups_list}
        
        pms = list(pm_col.find({'user_id': {'$in': user_ids_obj}})) if pm_col is not None else []
        pm_map = {str(pm['user_id']): pm for pm in pms}
        
        # Batch fetch total paid from payment_records
        payments_col = get_collection('payment_records')
        paid_res = list(payments_col.aggregate([{'$match': {'user_id': {'$in': user_ids_str}}}, {'$group': {'_id': '$user_id', 'total': {'$sum': '$amount'}}}])) if payments_col is not None else []
        paid_map = {r['_id']: r['total'] for r in paid_res}
        
        results = []

        for u in users:
            uid = str(u['_id'])
            
            conv = conv_map.get(uid, 0)
            promo = promo_map.get(uid, 0)
            gift = gift_map.get(uid, 0)
            ref = p1_map.get(uid, 0) + p2_map.get(uid, 0)
            adj = adj_map.get(uid, 0)
            total_paid = paid_map.get(uid, 0)
            total = conv + promo + gift + ref + adj - total_paid
            
            pm = pm_map.get(uid)
            payout_method = None
            if pm is not None:
                payout_method = {
                    'active_method': pm.get('active_method'),
                    'bank_details': pm.get('bank_details'),
                    'paypal_details': pm.get('paypal_details'),
                    'crypto_details': pm.get('crypto_details')
                }
            
            # Fallback: check if payout info is stored directly in the users document (legacy)
            if not payout_method or not payout_method.get('active_method'):
                user_payment_info = u.get('payment_method') or u.get('payout_method')
                if user_payment_info:
                    # Legacy format: stored directly in user doc
                    if isinstance(user_payment_info, dict):
                        payout_method = {
                            'active_method': user_payment_info.get('active_method') or user_payment_info.get('type', ''),
                            'bank_details': user_payment_info.get('bank_details') or user_payment_info.get('bank', {}),
                            'paypal_details': user_payment_info.get('paypal_details') or user_payment_info.get('paypal', {}),
                            'crypto_details': user_payment_info.get('crypto_details') or user_payment_info.get('crypto', {})
                        }
                    elif isinstance(user_payment_info, str):
                        # Very old format: just a string like "paypal" or "bank"
                        payout_method = {
                            'active_method': user_payment_info,
                            'bank_details': {'account_name': u.get('bank_account_name', ''), 'account_number': u.get('bank_account_number', ''), 'bank_name': u.get('bank_name', ''), 'swift_code': u.get('swift_code', u.get('ifsc_code', ''))},
                            'paypal_details': {'email': u.get('paypal_email', '')},
                            'crypto_details': {'network': u.get('crypto_network', ''), 'wallet_address': u.get('crypto_wallet', u.get('wallet_address', ''))}
                        }
            
            ups = ups_map.get(uid, {})
            net_terms_settings = {
                'net_terms': ups.get('net_terms', 30),
                'temporary_duration_months': ups.get('temporary_duration_months'),
                'temporary_start_date': ups.get('temporary_start_date'),
                'default_net_terms': ups.get('default_net_terms', 30)
            }
            
            results.append({
                'user_id': uid,
                'username': u.get('username'),
                'email': u.get('email'),
                'country': u.get('country', 'N/A'),
                'total_balance': max(0, total),
                'gross_earnings': conv + promo + gift + ref,
                'breakdown': {
                    'referral': max(0, ref),
                    'conversion': max(0, conv),
                    'promo': max(0, promo),
                    'gift': max(0, gift),
                    'manual_adjustments': adj
                },
                'payout_method': payout_method,
                'net_terms_settings': net_terms_settings
            })
            
        return jsonify({
            'success': True,
            'data': results
        }), 200

    except Exception as e:
        logger.error(f"Error getting admin payments: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_payments_bp.route('/users/<user_id>/adjust', methods=['POST'])
@token_required
@admin_required
def adjust_user_balance(user_id):
    try:
        data = request.json
        amount = data.get('amount')
        reason = data.get('reason', 'Admin adjustment')
        
        if amount is None:
            return jsonify({'error': 'amount is required'}), 400
            
        adj_col = get_collection('balance_adjustments')
        doc = {
            'user_id': ObjectId(user_id),
            'amount': float(amount),
            'reason': reason,
            'created_at': datetime.utcnow(),
            'admin_id': str(request.current_user['_id'])
        }
        
        adj_col.insert_one(doc)
        
        # Clear dashboard cache so numbers refresh instantly on their dashboard
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(user_id)
        except Exception as e:
            logger.error(f"Failed to clear dashboard cache for adjusted user: {e}")
        
        return jsonify({
            'success': True,
            'message': 'Balance adjusted successfully'
        }), 200

    except Exception as e:
        logger.error(f"Error adjusting user balance: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_payments_bp.route('/users/<user_id>/net-terms', methods=['POST'])
@token_required
@admin_required
def update_user_net_terms(user_id):
    try:
        data = request.json
        net_terms = data.get('net_terms')
        default_net_terms = data.get('default_net_terms', 30)
        temporary_duration_months = data.get('temporary_duration_months')
        
        if not net_terms:
            return jsonify({'error': 'net_terms is required'}), 400
            
        settings_col = get_collection('user_payout_settings')
        if settings_col is None:
            return jsonify({'error': 'Database unavailable'}), 500
            
        doc = {
            'user_id': ObjectId(user_id),
            'net_terms': int(net_terms),
            'default_net_terms': int(default_net_terms),
            'updated_at': datetime.utcnow()
        }
        
        if temporary_duration_months:
            doc['temporary_duration_months'] = int(temporary_duration_months)
            doc['temporary_start_date'] = datetime.utcnow()
        else:
            doc['temporary_duration_months'] = None
            doc['temporary_start_date'] = None
            
        settings_col.update_one(
            {'user_id': ObjectId(user_id)},
            {'$set': doc},
            upsert=True
        )
        
        return jsonify({
            'success': True,
            'message': 'Net terms updated successfully',
            'data': doc
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating net terms: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_payments_bp.route('/users/<user_id>/transactions', methods=['GET'])
@token_required
@admin_required
def get_user_transactions_admin(user_id):
    try:
        transactions = fetch_user_transactions(user_id)
        return jsonify({
            'success': True,
            'data': transactions
        }), 200
    except Exception as e:
        logger.error(f"Error getting admin user transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_payments_bp.route('/transactions/<tx_type>/<tx_id>/reverse', methods=['POST'])
@token_required
@admin_required
def reverse_transaction(tx_type, tx_id):
    try:
        # tx_type can be 'promo' or 'gift'
        user_id = None
        
        if tx_type == 'promo':
            promo_col = get_collection('bonus_earnings')
            tx = promo_col.find_one({'_id': ObjectId(tx_id)})
            if tx:
                user_id = tx.get('user_id')
            res = promo_col.update_one({'_id': ObjectId(tx_id)}, {'$set': {'status': 'reversed', 'updated_at': datetime.utcnow()}})
            if res.modified_count > 0:
                if user_id:
                    try:
                        from routes.user_dashboard import clear_dashboard_cache
                        clear_dashboard_cache(user_id)
                    except Exception as e:
                        logger.error(f"Failed to clear dashboard cache for reversed promo user: {e}")
                return jsonify({'success': True, 'message': 'Promo reversed'})
            return jsonify({'error': 'Promo not found or already reversed'}), 400
            
        elif tx_type == 'gift':
            gift_col = get_collection('gift_card_redemptions')
            tx = gift_col.find_one({'_id': ObjectId(tx_id)})
            if tx:
                user_id = tx.get('user_id')
            res = gift_col.update_one({'_id': ObjectId(tx_id)}, {'$set': {'status': 'reversed', 'updated_at': datetime.utcnow()}})
            if res.modified_count > 0:
                if user_id:
                    try:
                        from routes.user_dashboard import clear_dashboard_cache
                        clear_dashboard_cache(user_id)
                    except Exception as e:
                        logger.error(f"Failed to clear dashboard cache for reversed gift user: {e}")
                return jsonify({'success': True, 'message': 'Gift card reversed'})
            return jsonify({'error': 'Gift card not found or already reversed'}), 400
            
        return jsonify({'error': 'Invalid transaction type for reversal'}), 400

    except Exception as e:
        logger.error(f"Error reversing transaction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_payments_bp.route('/email/<user_id>', methods=['POST'])
@token_required
@admin_required
def send_email_to_user(user_id):
    try:
        data = request.json
        subject = data.get('subject')
        message = data.get('message')
        
        users_col = get_collection('users')
        user = users_col.find_one({'_id': ObjectId(user_id)})
        
        if not user or not user.get('email'):
            return jsonify({'error': 'User or email not found'}), 404
            
        from services.email_service import get_email_service
        email_service = get_email_service()
        
        # We can implement a raw email sending here
        # or use a template
        email_service._send_email(
            to_email=user['email'],
            subject=subject,
            html_content=f"<p>{message}</p>"
        )
        
        return jsonify({'success': True, 'message': 'Email sent successfully'})
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return jsonify({'error': str(e)}), 500



@admin_payments_bp.route('/log-action', methods=['POST'])
@token_required
@admin_required
def log_payment_action():
    """Log an admin payment action for audit trail."""
    try:
        data = request.json
        admin_user = request.current_user

        logs_col = get_collection('payment_action_logs')
        if logs_col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        doc = {
            'admin_id': str(admin_user['_id']),
            'admin_username': admin_user.get('username', 'admin'),
            'action': data.get('action', ''),
            'target_user_id': data.get('target_user_id', ''),
            'target_username': data.get('target_username', ''),
            'details': data.get('details', ''),
            'amount': data.get('amount'),
            'created_at': datetime.utcnow()
        }

        logs_col.insert_one(doc)

        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Error logging payment action: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_payments_bp.route('/action-logs', methods=['GET'])
@token_required
@admin_required
def get_payment_action_logs():
    """Get admin payment action logs."""
    try:
        logs_col = get_collection('payment_action_logs')
        if logs_col is None:
            return jsonify({'success': True, 'logs': []}), 200

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        skip = (page - 1) * per_page

        logs = list(logs_col.find({}).sort('created_at', -1).skip(skip).limit(per_page))

        results = []
        for log in logs:
            results.append({
                '_id': str(log['_id']),
                'admin_id': log.get('admin_id', ''),
                'admin_username': log.get('admin_username', ''),
                'action': log.get('action', ''),
                'target_user_id': log.get('target_user_id', ''),
                'target_username': log.get('target_username', ''),
                'details': log.get('details', ''),
                'amount': log.get('amount'),
                'created_at': log.get('created_at', '').isoformat() + 'Z' if hasattr(log.get('created_at', ''), 'isoformat') else ''
            })

        return jsonify({
            'success': True,
            'logs': results
        }), 200

    except Exception as e:
        logger.error(f"Error getting payment action logs: {str(e)}")
        return jsonify({'error': str(e)}), 500



@admin_payments_bp.route('/users/<user_id>/conversions', methods=['GET'])
@token_required
@admin_required
def get_user_conversions_for_payment(user_id):
    """Get a user's recent conversions for review before payment. Shows active + reversed."""
    try:
        col = get_collection('forwarded_postbacks')
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 30)), 100)
        status_filter = request.args.get('status', 'all')  # all, active, reversed

        query = {'publisher_id': user_id, 'source': {'$nin': ['fallback_fake']}}

        if status_filter == 'reversed':
            query['forward_status'] = 'reversed'
        elif status_filter == 'active':
            query['forward_status'] = {'$in': ['success', 'failed', 'no_url']}
        else:
            query['forward_status'] = {'$in': ['success', 'failed', 'no_url', 'reversed']}

        total = col.count_documents(query)
        skip = (page - 1) * per_page

        conversions = list(col.find(query).sort('timestamp', -1).skip(skip).limit(per_page))

        results = []
        for c in conversions:
            results.append({
                '_id': str(c['_id']),
                'offer_id': c.get('offer_id', ''),
                'offer_name': c.get('offer_name', ''),
                'points': c.get('points', 0),
                'timestamp': c.get('timestamp', '').isoformat() + 'Z' if hasattr(c.get('timestamp', ''), 'isoformat') else '',
                'forward_status': c.get('forward_status', ''),
                'status': 'reversed' if c.get('forward_status') == 'reversed' else 'active',
                'reversed_at': c.get('reversed_at', '').isoformat() + 'Z' if hasattr(c.get('reversed_at', ''), 'isoformat') and c.get('reversed_at') else '',
                'reversal_reason': c.get('reversal_reason', ''),
                'click_id': c.get('click_id', '')
            })

        # Summary
        active_sum = list(col.aggregate([
            {'$match': {'publisher_id': user_id, 'forward_status': {'$in': ['success', 'failed', 'no_url']}, 'source': {'$nin': ['fallback_fake']}}},
            {'$group': {'_id': None, 'total': {'$sum': '$points'}, 'count': {'$sum': 1}}}
        ]))
        reversed_sum = list(col.aggregate([
            {'$match': {'publisher_id': user_id, 'forward_status': 'reversed', 'source': {'$nin': ['fallback_fake']}}},
            {'$group': {'_id': None, 'total': {'$sum': '$points'}, 'count': {'$sum': 1}}}
        ]))

        summary = {
            'active_amount': active_sum[0]['total'] if active_sum else 0,
            'active_count': active_sum[0]['count'] if active_sum else 0,
            'reversed_amount': reversed_sum[0]['total'] if reversed_sum else 0,
            'reversed_count': reversed_sum[0]['count'] if reversed_sum else 0
        }

        return jsonify({
            'success': True,
            'conversions': results,
            'summary': summary,
            'pagination': {'page': page, 'per_page': per_page, 'total': total, 'pages': (total + per_page - 1) // per_page}
        }), 200

    except Exception as e:
        logger.error(f"Error getting user conversions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_payments_bp.route('/users/<user_id>/pay', methods=['POST'])
@token_required
@admin_required
def pay_user(user_id):
    """
    Mark user as paid. Creates a payment record, marks eligible invoices as paid,
    and resets their pending balance to 0.
    """
    try:
        data = request.json or {}
        amount = data.get('amount')
        reference_note = data.get('reference_note', '')
        payment_method_used = data.get('payment_method', 'manual')

        if not amount or float(amount) <= 0:
            return jsonify({'error': 'Valid amount is required'}), 400

        amount = float(amount)
        admin_id = str(request.current_user['_id'])
        admin_username = request.current_user.get('username', 'admin')
        now = datetime.utcnow()

        # 1. Create payment record
        payments_col = get_collection('payment_records')
        if payments_col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        payment_doc = {
            'user_id': user_id,
            'amount': amount,
            'payment_method': payment_method_used,
            'reference_note': reference_note,
            'admin_id': admin_id,
            'admin_username': admin_username,
            'paid_at': now
        }
        payments_col.insert_one(payment_doc)

        # 2. Mark eligible invoices as paid
        invoices_col = get_collection('invoices')
        if invoices_col is not None:
            invoices_col.update_many(
                {'user_id': user_id, 'status': 'eligible'},
                {'$set': {'status': 'paid', 'paid_at': now, 'paid_by': admin_id, 'updated_at': now}}
            )

        # 3. Balance is now: total_earnings - sum(payment_records)
        # No negative balance_adjustment needed — payment_records tracks what was paid

        # 4. Log the action
        logs_col = get_collection('payment_action_logs')
        if logs_col is not None:
            logs_col.insert_one({
                'admin_id': admin_id,
                'admin_username': admin_username,
                'action': 'marked_paid',
                'target_user_id': user_id,
                'target_username': data.get('username', ''),
                'details': f'Paid ${amount:.2f} via {payment_method_used}. Ref: {reference_note}',
                'amount': amount,
                'created_at': now
            })

        # 5. Clear dashboard cache
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(user_id)
        except Exception:
            pass

        return jsonify({
            'success': True,
            'message': f'Payment of ${amount:.2f} recorded successfully',
            'paid_at': now.isoformat() + 'Z'
        }), 200

    except Exception as e:
        logger.error(f"Error paying user: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_payments_bp.route('/users/<user_id>/payment-history', methods=['GET'])
@token_required
@admin_required
def get_user_payment_history(user_id):
    """Get all past payments made to a user."""
    try:
        payments_col = get_collection('payment_records')
        if payments_col is None:
            return jsonify({'success': True, 'payments': []}), 200

        payments = list(payments_col.find({'user_id': user_id}).sort('paid_at', -1))

        results = []
        for p in payments:
            results.append({
                '_id': str(p['_id']),
                'amount': p.get('amount', 0),
                'payment_method': p.get('payment_method', 'manual'),
                'reference_note': p.get('reference_note', ''),
                'admin_username': p.get('admin_username', ''),
                'paid_at': p.get('paid_at', '').isoformat() + 'Z' if hasattr(p.get('paid_at', ''), 'isoformat') else ''
            })

        total_paid = sum(p.get('amount', 0) for p in payments)

        return jsonify({
            'success': True,
            'payments': results,
            'total_paid': total_paid,
            'payment_count': len(results)
        }), 200

    except Exception as e:
        logger.error(f"Error getting payment history: {str(e)}")
        return jsonify({'error': str(e)}), 500
