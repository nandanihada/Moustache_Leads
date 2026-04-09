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
            
        users = list(users_col.find({}))
        
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
        
        conv_res = list(conversions_col.aggregate([{'$match': {'publisher_id': {'$in': user_ids_str}, 'forward_status': 'success'}}, {'$group': {'_id': '$publisher_id', 'total': {'$sum': '$points'}}}])) if conversions_col is not None else []
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
        
        adj_res = list(adj_col.aggregate([{'$match': {'user_id': {'$in': user_ids_obj}}}, {'$group': {'_id': '$user_id', 'total': {'$sum': '$amount'}}}])) if adj_col is not None else []
        adj_map = {str(r['_id']): r['total'] for r in adj_res}
        
        ups_col = get_collection('user_payout_settings')
        ups_list = list(ups_col.find({'user_id': {'$in': user_ids_obj}})) if ups_col is not None else []
        ups_map = {str(r['user_id']): r for r in ups_list}
        
        pms = list(pm_col.find({'user_id': {'$in': user_ids_obj}})) if pm_col is not None else []
        pm_map = {str(pm['user_id']): pm for pm in pms}
        
        results = []

        for u in users:
            uid = str(u['_id'])
            
            conv = conv_map.get(uid, 0) - rev_conv_map.get(uid, 0)
            promo = promo_map.get(uid, 0)
            gift = gift_map.get(uid, 0)
            ref = p1_map.get(uid, 0) + p2_map.get(uid, 0)
            adj = adj_map.get(uid, 0)
            total = conv + promo + gift + ref + adj
            
            pm = pm_map.get(uid)
            payout_method = None
            if pm is not None:
                payout_method = {
                    'active_method': pm.get('active_method'),
                    'bank_details': pm.get('bank_details'),
                    'paypal_details': pm.get('paypal_details'),
                    'crypto_details': pm.get('crypto_details')
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
        
        if tx_type == 'promo':
            promo_col = get_collection('bonus_earnings')
            res = promo_col.update_one({'_id': ObjectId(tx_id)}, {'$set': {'status': 'reversed', 'updated_at': datetime.utcnow()}})
            if res.modified_count > 0:
                return jsonify({'success': True, 'message': 'Promo reversed'})
            return jsonify({'error': 'Promo not found or already reversed'}), 400
            
        elif tx_type == 'gift':
            gift_col = get_collection('gift_card_redemptions')
            res = gift_col.update_one({'_id': ObjectId(tx_id)}, {'$set': {'status': 'reversed', 'updated_at': datetime.utcnow()}})
            if res.modified_count > 0:
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
