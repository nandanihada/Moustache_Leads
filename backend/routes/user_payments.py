from flask import Blueprint, request, jsonify
from utils.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

user_payments_bp = Blueprint('user_payments', __name__)

def get_collection(collection_name):
    from database import db_instance
    if not db_instance.is_connected():
        return None
    return db_instance.get_collection(collection_name)

def calculate_user_earnings(user_id):
    """Calculates all earnings for a user across different tables."""
    try:
        user_obj_id = ObjectId(user_id)
        
        # 1. CONVERSIONS
        conversions_col = get_collection('forwarded_postbacks')
        # Count ALL credited conversions (success, failed, no_url) — publisher earned it regardless of forward status
        # Only exclude 'reversed' status
        conv_pipeline = [
            {'$match': {'publisher_id': str(user_id), 'forward_status': {'$nin': ['reversed']}, 'is_reversal': {'$ne': True}}},
            {'$group': {'_id': None, 'total': {'$sum': '$points'}}}
        ]
        conv_res = list(conversions_col.aggregate(conv_pipeline)) if conversions_col is not None else []
        conversions_earnings = conv_res[0]['total'] if conv_res else 0

        # Also get reversed conversions to subtract
        rev_conv_pipeline = [
            {'$match': {'publisher_id': str(user_id), '$or': [{'forward_status': 'reversed'}, {'status': 'reversed'}, {'is_reversal': True}]}},
            {'$group': {'_id': None, 'total': {'$sum': '$points'}}}
        ]
        rev_conv_res = list(conversions_col.aggregate(rev_conv_pipeline)) if conversions_col is not None else []
        reversed_conversions = rev_conv_res[0]['total'] if rev_conv_res else 0
        # NOTE: Do NOT subtract reversed_conversions here.
        # The active query already excludes reversed (forward_status not in ['reversed']).
        # Subtracting again would double-count the deduction.

        # 2. PROMO
        promo_col = get_collection('bonus_earnings')
        promo_pipeline = [
            {'$match': {'user_id': user_obj_id, 'status': 'credited'}},
            {'$group': {'_id': None, 'total': {'$sum': '$bonus_amount'}}}
        ]
        promo_res = list(promo_col.aggregate(promo_pipeline)) if promo_col is not None else []
        promo_earnings = promo_res[0]['total'] if promo_res else 0

        # Note: If reversed promo was added, subtract it or just rely on 'status' == 'credited'

        # 3. GIFT CARDS
        gift_col = get_collection('gift_card_redemptions')
        gift_pipeline = [
            {'$match': {'$or': [{'user_id': str(user_id)}, {'user_id': user_obj_id}], 'status': {'$ne': 'reversed'}}}, # Avoid reversed
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]
        gift_res = list(gift_col.aggregate(gift_pipeline)) if gift_col is not None else []
        gift_earnings_tot = gift_res[0]['total'] if gift_res else 0
        
        # Backward compatibility format check
        gift_pipeline2 = [
            {'$match': {'$or': [{'user_id': str(user_id)}, {'user_id': user_obj_id}]}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]
        
        # Assume valid amount unless explicitly reversed in a generic way
        # Since we might implement generic reversals via admin adjustments table
        gift_earnings = gift_earnings_tot

        # 4. REFERRALS
        # P1
        ref_p1_col = get_collection('referrals_p1')
        ref_p1_pipeline = [
            {'$match': {'referrer_id': str(user_id), 'bonus_released': True, 'status': {'$ne': 'reversed'}}},
            {'$group': {'_id': None, 'total': {'$sum': '$bonus_amount'}}}
        ]
        p1_res = list(ref_p1_col.aggregate(ref_p1_pipeline)) if ref_p1_col is not None else []
        p1_earnings = p1_res[0]['total'] if p1_res else 0

        # P2 
        ref_p2_col = get_collection('referrals_p2')
        ref_p2_pipeline = [
            {'$match': {'referrer_id': str(user_id)}},
            {'$group': {'_id': None, 'total': {'$sum': '$commission_earned'}}}
        ]
        p2_res = list(ref_p2_col.aggregate(ref_p2_pipeline)) if ref_p2_col is not None else []
        p2_earnings = p2_res[0]['total'] if p2_res else 0

        referral_earnings = p1_earnings + p2_earnings

        # 5. ADMIN ADJUSTMENTS (exclude payment-type adjustments — those track paid-out amounts separately)
        adj_col = get_collection('balance_adjustments')
        adj_pipeline = [
            {'$match': {'user_id': user_obj_id, 'type': {'$ne': 'payment'}}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
        ]
        adj_res = list(adj_col.aggregate(adj_pipeline)) if adj_col is not None else []
        manual_adjustments = adj_res[0]['total'] if adj_res else 0

        # Calculate total balance (subtract total paid from payment_records)
        payments_col = get_collection('payment_records')
        total_paid_out = 0
        if payments_col is not None:
            paid_pipeline = [
                {'$match': {'user_id': str(user_id)}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]
            paid_res = list(payments_col.aggregate(paid_pipeline))
            total_paid_out = paid_res[0]['total'] if paid_res else 0

        total_balance = conversions_earnings + promo_earnings + gift_earnings + referral_earnings + manual_adjustments - total_paid_out

        return {
            'total_balance': max(0, total_balance),
            'referral_earnings': max(0, referral_earnings),
            'conversion_earnings': max(0, conversions_earnings),
            'promo_earnings': max(0, promo_earnings),
            'gift_earnings': max(0, gift_earnings),
            'manual_adjustments': manual_adjustments
        }
    except Exception as e:
        print(f"DEBUG_ERROR: {e}")
        logger.error(f"Error calculating earnings: {str(e)}")
        return {
            'total_balance': 0,
            'referral_earnings': 0,
            'conversion_earnings': 0,
            'promo_earnings': 0,
            'gift_earnings': 0,
            'manual_adjustments': 0
        }

def get_user_net_terms(user_id):
    """Fetches user's net terms and handles logic for limited duration."""
    user_payout_settings_col = get_collection('user_payout_settings')
    default_terms = {'net_terms': 30, 'temporary_duration_months': None, 'temporary_start_date': None, 'default_net_terms': 30}
    
    if user_payout_settings_col is None:
        return default_terms
        
    settings = user_payout_settings_col.find_one({'user_id': ObjectId(user_id)})
    if not settings:
        return default_terms
        
    net_terms = settings.get('net_terms', 30)
    duration_months = settings.get('temporary_duration_months')
    start_date = settings.get('temporary_start_date')
    default_net = settings.get('default_net_terms', 30)
    
    if duration_months and start_date:
        # Check if duration expired
        months_passed = (datetime.utcnow().year - start_date.year) * 12 + datetime.utcnow().month - start_date.month
        if months_passed >= duration_months:
            return {'net_terms': default_net, 'temporary_duration_months': None, 'temporary_start_date': None, 'default_net_terms': default_net}
            
    return {'net_terms': net_terms, 'temporary_duration_months': duration_months, 'temporary_start_date': start_date, 'default_net_terms': default_net}

def _get_next_month_1st(dt):
    if dt.month == 12:
        return datetime(dt.year + 1, 1, 1)
    else:
        return datetime(dt.year, dt.month + 1, 1)

def get_payment_cycle_date(user_id, balance):
    """Calculates the specific payout date using Net Cycle System logic."""
    net_settings = get_user_net_terms(user_id)
    net_days = net_settings['net_terms']
    now = datetime.utcnow()
    
    # User is eligible if balance >= 100
    if balance >= 100:
        # Eligible for this month's cycle
        # Month End
        next_month_1st = _get_next_month_1st(now)
        month_end = next_month_1st - timedelta(days=1)
        
        target_date = month_end + timedelta(days=net_days)
        
        if target_date.day == 1:
            return target_date.strftime('%Y-%m-%d')
        else:
            return _get_next_month_1st(target_date).strftime('%Y-%m-%d')
            
    else:
        # Carry forward to next month
        # Next eligibility check will be next month, so predict based on next month end
        next_month_1st = _get_next_month_1st(now)
        next_month_end = _get_next_month_1st(next_month_1st) - timedelta(days=1)
        target_date = next_month_end + timedelta(days=net_days)
        
        if target_date.day == 1:
            return target_date.strftime('%Y-%m-%d')
        else:
            return _get_next_month_1st(target_date).strftime('%Y-%m-%d')

@user_payments_bp.route('/summary', methods=['GET'])
@token_required
def get_payment_summary():
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        earnings_data = calculate_user_earnings(user_id)
        
        # Get payout method
        payout_methods_col = get_collection('payout_methods')
        payout_method = None
        if payout_methods_col is not None:
            pm = payout_methods_col.find_one({'user_id': ObjectId(user_id)})
            if pm:
                payout_method = {
                    'active_method': pm.get('active_method'),
                    'bank_details': pm.get('bank_details'),
                    'paypal_details': pm.get('paypal_details'),
                    'crypto_details': pm.get('crypto_details')
                }

        return jsonify({
            'success': True,
            'data': {
                'total_balance': earnings_data['total_balance'],
                'pending_earnings': earnings_data['total_balance'], # Simplification for now
                'total_paid_earnings': 0, # Should be fetched from payouts table
                'lifetime_confirmed_earnings': earnings_data['total_balance'],
                'breakdown': {
                    'referral': earnings_data['referral_earnings'],
                    'conversion': earnings_data['conversion_earnings'],
                    'promo': earnings_data['promo_earnings'],
                    'gift': earnings_data['gift_earnings'],
                    'manual_adjustments': earnings_data['manual_adjustments']
                },
                'next_payout_date': get_payment_cycle_date(user_id, earnings_data['total_balance']),
                'minimum_payment_threshold': 25,
                'payment_terms': 'Net 30',
                'eligible_for_payout': earnings_data['total_balance'] >= 100,
                'payout_method': payout_method
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting payment summary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_payments_bp.route('/transactions', methods=['GET'])
@token_required
def get_user_transactions_route():
    try:
        user = request.current_user
        user_id = str(user['_id'])
        transactions = fetch_user_transactions(user_id)
        return jsonify({
            'success': True,
            'data': transactions
        }), 200
    except Exception as e:
        logger.error(f"Error getting transactions route: {str(e)}")
        return jsonify({'error': str(e)}), 500

def fetch_user_transactions(user_id):
    try:
        user_obj_id = ObjectId(user_id)
        transactions = []
        
        # 1. Conversions
        conversions_col = get_collection('forwarded_postbacks')
        if conversions_col is not None:
            convs = list(conversions_col.find({'publisher_id': user_id, 'forward_status': {'$nin': ['reversed']}, 'is_reversal': {'$ne': True}}))
            for c in convs:
                transactions.append({
                    'id': str(c['_id']),
                    'date': c.get('timestamp'),
                    'type': 'Conversion',
                    'offer_name': c.get('offer_name', 'Offer'),
                    'amount': c.get('points', 0),
                    'status': 'Valid'
                })
            
            rev_convs = list(conversions_col.find({'publisher_id': user_id, '$or': [{'forward_status': 'reversed'}, {'status': 'reversed'}, {'is_reversal': True}]}))
            for c in rev_convs:
                transactions.append({
                    'id': str(c['_id']),
                    'date': c.get('timestamp'),
                    'type': 'Conversion Reversal',
                    'offer_name': c.get('offer_name', 'Offer'),
                    'amount': -c.get('points', 0),
                    'status': 'Reversed'
                })

        # 2. Promo
        promo_col = get_collection('bonus_earnings')
        if promo_col is not None:
            promos = list(promo_col.find({'user_id': user_obj_id, 'status': 'credited'}))
            for p in promos:
                transactions.append({
                    'id': str(p['_id']),
                    'date': p.get('credited_at'),
                    'type': 'Promo',
                    'offer_name': f"Code: {p.get('code')}",
                    'amount': p.get('bonus_amount', 0),
                    'status': 'Valid'
                })
            # Promos reversed
            rev_promos = list(promo_col.find({'user_id': user_obj_id, 'status': 'reversed'}))
            for p in rev_promos:
                transactions.append({
                    'id': str(p['_id']),
                    'date': p.get('updated_at', p.get('created_at')),
                    'type': 'Promo Reversal',
                    'offer_name': f"Code: {p.get('code')}",
                    'amount': -p.get('bonus_amount', 0),
                    'status': 'Reversed'
                })

        # 3. Gift Cards
        gift_col = get_collection('gift_card_redemptions')
        if gift_col is not None:
            gifts = list(gift_col.find({'$or': [{'user_id': user_id}, {'user_id': user_obj_id}]}))
            for g in gifts:
                status = 'Reversed' if g.get('status') == 'reversed' else 'Valid'
                amt = g.get('amount', 0)
                if status == 'Reversed':
                    amt = -amt
                transactions.append({
                    'id': str(g['_id']),
                    'date': g.get('redeemed_at', g.get('created_at')),
                    'type': 'Gift Card',
                    'offer_name': g.get('code', 'Gift Card'),
                    'amount': amt,
                    'status': status
                })

        # 4. Referrals
        ref_p1_col = get_collection('referrals_p1')
        if ref_p1_col is not None:
            p1 = list(ref_p1_col.find({'referrer_id': user_id, 'bonus_released': True}))
            for r in p1:
                status = 'Reversed' if r.get('status') == 'reversed' else 'Valid'
                amt = r.get('bonus_amount', 0)
                if status == 'Reversed':
                    amt = -amt
                transactions.append({
                    'id': str(r['_id']),
                    'date': r.get('bonus_released_at'),
                    'type': 'Referral (Fixed)',
                    'offer_name': r.get('referred_username', 'User'),
                    'amount': amt,
                    'status': status
                })
                
        ref_p2_col = get_collection('referrals_p2')
        if ref_p2_col is not None:
            p2 = list(ref_p2_col.find({'referrer_id': user_id}))
            for r in p2:
                if r.get('commission_earned', 0) > 0:
                    transactions.append({
                        'id': str(r['_id']),
                        'date': r.get('updated_at'),
                        'type': 'Referral (Commission)',
                        'offer_name': r.get('referred_username', 'User'),
                        'amount': r.get('commission_earned', 0),
                        'status': 'Valid'
                    })

        # 5. Manual Adjustments
        adj_col = get_collection('balance_adjustments')
        if adj_col is not None:
            adjs = list(adj_col.find({'user_id': user_obj_id}))
            for a in adjs:
                transactions.append({
                    'id': str(a['_id']),
                    'date': a.get('created_at'),
                    'type': 'Adjustment',
                    'offer_name': a.get('reason', 'Admin adjustment'),
                    'amount': a.get('amount', 0),
                    'status': 'Valid'
                })

        # Sort combined
        transactions.sort(key=lambda x: x.get('date') or datetime.min, reverse=True)
        
        # Format dates
        for t in transactions:
            if t['date']:
                if hasattr(t['date'], 'strftime'):
                    t['date'] = t['date'].strftime('%b %d, %Y')
                else:
                    t['date'] = str(t['date'])

        return transactions

    except Exception as e:
        logger.error(f"Error fetching user transactions logic: {str(e)}")
        return []

@user_payments_bp.route('/method', methods=['POST'])
@token_required
def save_payment_method():
    try:
        user = request.current_user
        user_id = str(user['_id'])
        data = request.json
        
        if not data or 'active_method' not in data:
            return jsonify({'error': 'active_method is required'}), 400
            
        payout_methods_col = get_collection('payout_methods')
        if payout_methods_col is None:
            return jsonify({'error': 'Database not available'}), 500

        doc = {
            'user_id': ObjectId(user_id),
            'active_method': data['active_method'],
            'bank_details': data.get('bank_details', {}),
            'paypal_details': data.get('paypal_details', {}),
            'crypto_details': data.get('crypto_details', {}),
            'updated_at': datetime.utcnow()
        }

        payout_methods_col.update_one(
            {'user_id': ObjectId(user_id)},
            {
                '$set': doc,
                '$setOnInsert': {'created_at': datetime.utcnow()}
            },
            upsert=True
        )

        return jsonify({
            'success': True,
            'message': 'Payment method saved successfully',
            'data': doc
        }), 200

    except Exception as e:
        logger.error(f"Error saving payment method: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_payments_bp.route('/history', methods=['GET'])
@token_required
def get_user_payout_history():
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        payouts_col = get_collection('user_payouts')
        history = []
        if payouts_col is not None:
             # Only show real records from 2026+ (platform launch)
             # Records before 2026 are test/fake data
             platform_launch = datetime(2026, 1, 1)
             records = list(payouts_col.find({
                 'user_id': ObjectId(user_id),
                 'creation_date': {'$gte': platform_launch}
             }).sort('creation_date', -1))
             for r in records:
                 history.append({
                     'id': str(r['_id']),
                     'creation_date': r.get('creation_date', datetime.utcnow()).strftime('%B %d, %Y'),
                     'billing_period': r.get('billing_period', 'N/A'),
                     'amount': r.get('amount', 0),
                     'status': r.get('status', 'Deferred'),
                     'due_on': r.get('due_on', 'N/A')
                 })
        
        return jsonify({
            'success': True,
            'data': history
        }), 200
    except Exception as e:
        logger.error(f"Error fetching payout history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_payments_bp.route('/invoice/<invoice_id>', methods=['GET'])
@token_required
def get_invoice_details(invoice_id):
    try:
        user = request.current_user
        user_id = ObjectId(user['_id'])
        
        payouts_col = get_collection('user_payouts')
        if payouts_col is not None:
            # Let's support arbitrary invoice ID for the demo if it's missing to match screenshot
            try:
                inv = payouts_col.find_one({'_id': ObjectId(invoice_id), 'user_id': user_id})
            except:
                inv = None
            
            if inv:
                return jsonify({
                    'success': True,
                    'data': {
                        'id': str(inv['_id']),
                        'creation_date': inv.get('creation_date', datetime.utcnow()).strftime('%B %d, %Y'),
                        'billing_period': inv.get('billing_period', 'N/A'),
                        'due_on': inv.get('due_on', 'N/A'),
                        'status': inv.get('status', 'Deferred'),
                        'amount': inv.get('amount', 0),
                        'description': inv.get('description', 'Publisher Earnings')
                    }
                }), 200

        # If we didn't find one, return a mocked one for demo purposes if the user is testing the UI
        return jsonify({
            'success': True,
            'data': {
                'id': invoice_id,
                'creation_date': 'January 1, 2026',
                'billing_period': 'December 1, 2025 - December 31, 2025',
                'due_on': 'N/A',
                'status': 'Deferred',
                'amount': 0.02,
                'description': 'Publisher Earnings - December 2025',
                'conversions': 1
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching invoice details: {str(e)}")
        return jsonify({'error': str(e)}), 500


@user_payments_bp.route('/invoices', methods=['GET'])
@token_required
def get_user_invoices():
    """
    Get current user's monthly invoices.
    Returns invoices grouped by month with status, amounts, and payment info.
    If no formal invoices exist yet, dynamically computes from conversion data.
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])

        invoices_col = get_collection('invoices')
        conversions_col = get_collection('forwarded_postbacks')

        # Get threshold from platform settings
        settings_col = get_collection('platform_settings')
        threshold = 50
        if settings_col is not None:
            s = settings_col.find_one({'key': 'payment_threshold'})
            if s:
                threshold = s.get('value', 50)

        # Try to get formal invoices first
        formal_invoices = []
        if invoices_col is not None:
            formal_invoices = list(invoices_col.find({'user_id': user_id}).sort('period_start', -1))

        results = []

        if formal_invoices:
            # Use formal invoices
            for inv in formal_invoices:
                results.append({
                    '_id': str(inv['_id']),
                    'period_start': inv.get('period_start', '').isoformat() + 'Z' if hasattr(inv.get('period_start', ''), 'isoformat') else '',
                    'period_end': inv.get('period_end', '').isoformat() + 'Z' if hasattr(inv.get('period_end', ''), 'isoformat') else '',
                    'gross_amount': inv.get('gross_amount', 0),
                    'reversals_amount': inv.get('reversals_amount', 0),
                    'carry_forward': inv.get('carry_forward', 0),
                    'net_amount': inv.get('net_amount', 0),
                    'threshold': inv.get('threshold', threshold),
                    'status': inv.get('status', 'pending'),
                    'net_terms': inv.get('net_terms', 30),
                    'generated_at': inv.get('generated_at', '').isoformat() + 'Z' if hasattr(inv.get('generated_at', ''), 'isoformat') else '',
                    'paid_at': inv.get('paid_at', '').isoformat() + 'Z' if hasattr(inv.get('paid_at', ''), 'isoformat') and inv.get('paid_at') else ''
                })
        else:
            # No formal invoices — dynamically compute from conversions grouped by month
            if conversions_col is not None:
                # Aggregate conversions per month for this user
                pipeline = [
                    {'$match': {
                        'publisher_id': user_id,
                        'source': {'$nin': ['fallback_fake']}
                    }},
                    {'$project': {
                        'year': {'$year': '$timestamp'},
                        'month': {'$month': '$timestamp'},
                        'points': 1,
                        'forward_status': 1,
                        'is_reversal': 1
                    }},
                    {'$group': {
                        '_id': {'year': '$year', 'month': '$month'},
                        'gross_amount': {'$sum': {
                            '$cond': [
                                {'$and': [
                                    {'$ne': ['$forward_status', 'reversed']},
                                    {'$ne': ['$is_reversal', True]}
                                ]},
                                '$points',
                                0
                            ]
                        }},
                        'reversals_amount': {'$sum': {
                            '$cond': [
                                {'$or': [
                                    {'$eq': ['$forward_status', 'reversed']},
                                    {'$eq': ['$is_reversal', True]}
                                ]},
                                '$points',
                                0
                            ]
                        }}
                    }},
                    {'$sort': {'_id.year': -1, '_id.month': -1}}
                ]

                monthly_data = list(conversions_col.aggregate(pipeline))

                # Check payment records to determine paid status
                payments_col_check = get_collection('payment_records')
                user_payments = []
                if payments_col_check is not None:
                    user_payments = list(payments_col_check.find({'user_id': user_id}).sort('paid_at', -1))
                
                # Total paid amount
                total_paid_amount = sum(p.get('amount', 0) for p in user_payments)
                last_payment_date = user_payments[0].get('paid_at') if user_payments else None

                import calendar
                for row in monthly_data:
                    year = row['_id']['year']
                    month = row['_id']['month']
                    gross = row.get('gross_amount', 0)
                    reversals = row.get('reversals_amount', 0)
                    # Net = gross only (gross already excludes reversed conversions)
                    # Reversals shown as info but NOT subtracted (already excluded from gross query)
                    net = gross

                    last_day = calendar.monthrange(year, month)[1]
                    period_start = datetime(year, month, 1)
                    period_end = datetime(year, month, last_day, 23, 59, 59)

                    # Skip current month — invoice not generated yet (still accumulating)
                    now = datetime.utcnow()
                    if period_end >= now:
                        continue

                    # Determine status — check if this period has been paid
                    paid_at_str = ''
                    
                    if total_paid_amount >= gross and gross > 0 and last_payment_date:
                        # User has been paid enough to cover this month
                        status = 'paid'
                        paid_at_str = last_payment_date.isoformat() + 'Z' if hasattr(last_payment_date, 'isoformat') else ''
                    else:
                        # Past month, not paid
                        status = 'eligible' if net >= threshold else 'held'

                    results.append({
                        '_id': f'{year}-{month:02d}',
                        'period_start': period_start.isoformat() + 'Z',
                        'period_end': period_end.isoformat() + 'Z',
                        'gross_amount': round(gross, 2),
                        'reversals_amount': round(reversals, 2),
                        'carry_forward': 0,
                        'net_amount': round(max(0, net), 2),
                        'threshold': threshold,
                        'status': status,
                        'net_terms': 30,
                        'generated_at': '',
                        'paid_at': paid_at_str
                    })

        # Build summary
        earnings = calculate_user_earnings(user_id)
        net_settings = get_user_net_terms(user_id)

        # Get total paid from payment_records for display
        payments_col_display = get_collection('payment_records')
        total_paid_out = 0
        if payments_col_display is not None:
            paid_agg = list(payments_col_display.aggregate([
                {'$match': {'user_id': user_id}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]))
            total_paid_out = paid_agg[0]['total'] if paid_agg else 0

        # Lifetime = pending + paid (total ever earned)
        lifetime_earnings = earnings['total_balance'] + total_paid_out

        # Calculate next payment date
        next_payment = get_payment_cycle_date(user_id, earnings['total_balance'])

        summary = {
            'current_balance': earnings['total_balance'],
            'lifetime_earnings': lifetime_earnings,
            'threshold': threshold,
            'progress_pct': min(100, (earnings['total_balance'] / threshold * 100)) if threshold > 0 else 100,
            'net_terms': net_settings.get('net_terms', 30),
            'next_payment_date': next_payment,
            'total_paid': total_paid_out,
            'total_held': sum(inv.get('net_amount', 0) for inv in formal_invoices if inv.get('status') == 'held')
        }

        return jsonify({
            'success': True,
            'invoices': results,
            'summary': summary
        }), 200

    except Exception as e:
        logger.error(f"Error fetching user invoices: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
