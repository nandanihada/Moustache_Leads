"""Admin Advertiser Management Routes"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import threading
from database import db_instance
from utils.auth import token_required, admin_required
from services.email_verification_service import get_email_verification_service

admin_advertisers_bp = Blueprint('admin_advertisers', __name__)
logger = logging.getLogger(__name__)


def get_advertisers_collection():
    return db_instance.get_collection('advertisers')


@admin_advertisers_bp.route('/advertisers', methods=['GET'])
@token_required
@admin_required
def get_advertisers():
    """Get all advertisers with optional status filter"""
    try:
        logger.info("GET /advertisers called")
        collection = get_advertisers_collection()
        if collection is None:
            logger.error("Database collection is None")
            return jsonify({'error': 'Database not connected'}), 500
        
        status_filter = request.args.get('status')
        
        query = {}
        if status_filter and status_filter != 'all':
            query['account_status'] = status_filter
        
        advertisers = list(collection.find(query).sort('created_at', -1))
        
        for adv in advertisers:
            adv['_id'] = str(adv['_id'])
            if adv.get('created_at'):
                adv['created_at'] = adv['created_at'].isoformat()
            if adv.get('updated_at'):
                adv['updated_at'] = adv['updated_at'].isoformat()
            if adv.get('account_status_updated_at'):
                adv['account_status_updated_at'] = adv['account_status_updated_at'].isoformat()
            if adv.get('terms_agreed_at'):
                adv['terms_agreed_at'] = adv['terms_agreed_at'].isoformat()
            adv.pop('password', None)

        # Get counts
        pending_count = collection.count_documents({'account_status': 'pending_approval'})
        approved_count = collection.count_documents({'account_status': 'approved'})
        rejected_count = collection.count_documents({'account_status': 'rejected'})
        total_count = collection.count_documents({})
        
        logger.info(f"Returning {len(advertisers)} advertisers")
        
        return jsonify({
            'advertisers': advertisers,
            'total': len(advertisers),
            'counts': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'total': total_count
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting advertisers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get advertisers: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>', methods=['GET'])
@token_required
@admin_required
def get_advertiser_details(advertiser_id):
    """Get full details of a specific advertiser"""
    try:
        collection = get_advertisers_collection()
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        advertiser['_id'] = str(advertiser['_id'])
        if advertiser.get('created_at'):
            advertiser['created_at'] = advertiser['created_at'].isoformat()
        if advertiser.get('updated_at'):
            advertiser['updated_at'] = advertiser['updated_at'].isoformat()
        if advertiser.get('account_status_updated_at'):
            advertiser['account_status_updated_at'] = advertiser['account_status_updated_at'].isoformat()
        if advertiser.get('terms_agreed_at'):
            advertiser['terms_agreed_at'] = advertiser['terms_agreed_at'].isoformat()
        advertiser.pop('password', None)
        
        return jsonify({'advertiser': advertiser}), 200
        
    except Exception as e:
        logger.error(f"Error getting advertiser details: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_advertiser(advertiser_id):
    """Approve an advertiser account and send activation email"""
    try:
        admin_user = request.current_user
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        if advertiser.get('account_status') == 'approved':
            return jsonify({'error': 'Advertiser is already approved'}), 400
        
        result = collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {
                '$set': {
                    'account_status': 'approved',
                    'is_active': True,
                    'account_status_updated_at': datetime.utcnow(),
                    'approved_by': str(admin_user['_id']),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to approve advertiser'}), 500
        
        logger.info(f"Advertiser {advertiser_id} approved by admin {admin_user['_id']}")
        
        email_sent = False
        email_error = None
        try:
            verification_service = get_email_verification_service()
            email = advertiser.get('email')
            name = advertiser.get('first_name') or advertiser.get('company_name', 'Advertiser')
            company = advertiser.get('company_name', '')
            
            if verification_service.is_configured:
                email_sent = verification_service.send_advertiser_account_activated_email(email, name, company)
                if not email_sent:
                    email_error = "Email service returned false"
            else:
                email_error = "Email service not configured"
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            email_error = str(e)
        
        return jsonify({
            'message': 'Advertiser approved successfully',
            'advertiser_id': advertiser_id,
            'email_sent': email_sent,
            'email_error': email_error
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving advertiser: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/reject', methods=['POST'])
@token_required
@admin_required
def reject_advertiser(advertiser_id):
    """Reject an advertiser account"""
    try:
        admin_user = request.current_user
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
        
        result = collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {
                '$set': {
                    'account_status': 'rejected',
                    'is_active': False,
                    'rejection_reason': reason,
                    'account_status_updated_at': datetime.utcnow(),
                    'rejected_by': str(admin_user['_id']),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to reject advertiser'}), 500
        
        logger.info(f"Advertiser {advertiser_id} rejected - Reason: {reason}")
        
        return jsonify({
            'message': 'Advertiser rejected',
            'advertiser_id': advertiser_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting advertiser: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject advertiser: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/auto-approve-check', methods=['POST'])
@token_required
@admin_required
def run_advertiser_auto_approval():
    """Auto-approve advertisers pending > 3 days"""
    try:
        collection = get_advertisers_collection()
        
        if collection is None:
            return jsonify({'error': 'Database not connected'}), 500
        
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        
        advertisers_to_approve = list(collection.find({
            'account_status': 'pending_approval',
            'created_at': {'$lte': three_days_ago}
        }))
        
        approved_count = 0
        verification_service = get_email_verification_service()
        
        for advertiser in advertisers_to_approve:
            advertiser_id = advertiser['_id']
            
            result = collection.update_one(
                {'_id': advertiser_id},
                {
                    '$set': {
                        'account_status': 'approved',
                        'is_active': True,
                        'account_status_updated_at': datetime.utcnow(),
                        'auto_approved': True,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                approved_count += 1
                
                def send_email(email, name, company):
                    try:
                        verification_service.send_advertiser_account_activated_email(email, name, company)
                    except Exception as e:
                        logger.error(f"Failed to send auto-approval email: {e}")
                
                email = advertiser.get('email')
                name = advertiser.get('first_name') or advertiser.get('company_name', 'Advertiser')
                company = advertiser.get('company_name', '')
                threading.Thread(target=send_email, args=(email, name, company), daemon=True).start()
        
        return jsonify({
            'message': f'Auto-approval complete. {approved_count} advertisers approved.',
            'approved_count': approved_count,
            'checked_count': len(advertisers_to_approve)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in auto-approval: {str(e)}", exc_info=True)
        return jsonify({'error': f'Auto-approval failed: {str(e)}'}), 500


def get_campaigns_collection():
    return db_instance.get_collection('campaigns')


@admin_advertisers_bp.route('/advertiser-campaigns', methods=['GET'])
@token_required
@admin_required
def get_advertiser_campaigns():
    """Get all advertiser campaigns with advertiser company/name info"""
    try:
        campaigns_col = get_campaigns_collection()
        advertisers_col = get_advertisers_collection()
        
        if campaigns_col is None or advertisers_col is None:
            return jsonify({'error': 'Database not connected'}), 500
            
        status_filter = request.args.get('status')
        query = {}
        if status_filter and status_filter != 'all':
            query['status'] = status_filter
            
        campaigns = list(campaigns_col.find(query).sort('created_at', -1))
        
        # Build lookup dict for advertiser info
        advertiser_ids = []
        for c in campaigns:
            adv_id = c.get('advertiser_id')
            if adv_id:
                try:
                    advertiser_ids.append(ObjectId(adv_id))
                except Exception:
                    pass
                    
        advertisers = list(advertisers_col.find({'_id': {'$in': advertiser_ids}}))
        adv_map = {str(a['_id']): {
            'company_name': a.get('company_name', ''),
            'email': a.get('email', ''),
            'first_name': a.get('first_name', ''),
            'last_name': a.get('last_name', '')
        } for a in advertisers}
        
        for c in campaigns:
            c['_id'] = str(c['_id'])
            if c.get('created_at') and isinstance(c['created_at'], datetime):
                c['created_at'] = c['created_at'].isoformat() + 'Z'
            if c.get('updated_at') and isinstance(c['updated_at'], datetime):
                c['updated_at'] = c['updated_at'].isoformat() + 'Z'
            if c.get('approved_date') and isinstance(c['approved_date'], datetime):
                c['approved_date'] = c['approved_date'].isoformat() + 'Z'
            adv_id = c.get('advertiser_id')
            c['advertiser'] = adv_map.get(adv_id, {
                'company_name': 'Unknown',
                'email': 'Unknown',
                'first_name': 'Unknown',
                'last_name': 'Unknown'
            })
            
        return jsonify({
            'campaigns': campaigns,
            'total': len(campaigns)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting advertiser campaigns: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get advertiser campaigns: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertiser-campaigns/<campaign_id>/status', methods=['PUT'])
@token_required
@admin_required
def update_advertiser_campaign_status(campaign_id):
    """Approve, reject or mark a campaign for review"""
    try:
        campaigns_col = get_campaigns_collection()
        if campaigns_col is None:
            return jsonify({'error': 'Database not connected'}), 500
            
        data = request.get_json() or {}
        new_status = data.get('status')
        rejection_reason = data.get('rejection_reason', '')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
            
        update_doc = {
            'status': new_status,
            'updated_at': datetime.utcnow(),
            'approved_date': datetime.utcnow()
        }
        if rejection_reason and new_status == 'rejected':
            update_doc['rejection_reason'] = rejection_reason
            
        result = campaigns_col.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Campaign not found'}), 404
            
        logger.info(f"Campaign {campaign_id} status updated to {new_status} by admin")
        return jsonify({
            'success': True,
            'message': f'Campaign status updated to {new_status}',
            'status': new_status,
            'approved_date': update_doc['approved_date'].isoformat() + 'Z'
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating advertiser campaign status: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update campaign status: {str(e)}'}), 500


@admin_advertisers_bp.route('/advertisers/deposits', methods=['GET'])
@token_required
@admin_required
def get_advertiser_deposits():
    """Retrieve all wallet deposit transactions for all advertisers"""
    try:
        tx_col = db_instance.get_collection('wallet_transactions')
        adv_col = get_advertisers_collection()
        
        if tx_col is None or adv_col is None:
            return jsonify({'error': 'Database not connected'}), 500
            
        # Get all deposit transactions
        transactions = list(tx_col.find({'type': 'deposit'}).sort('created_at', -1))
        
        # Resolve advertisers
        adv_ids = list(set([t.get('advertiser_id') for t in transactions if t.get('advertiser_id')]))
        
        # Fetch advertisers details
        adv_map = {}
        if adv_ids:
            object_ids = []
            for a_id in adv_ids:
                try:
                    object_ids.append(ObjectId(a_id))
                except Exception:
                    pass
            
            advertisers = list(adv_col.find({
                '$or': [
                    {'_id': {'$in': object_ids}},
                    {'_id': {'$in': [str(oid) for oid in object_ids]}}
                ]
            }))
            
            for a in advertisers:
                adv_map[str(a['_id'])] = {
                    'company_name': a.get('company_name', 'Unknown'),
                    'email': a.get('email', ''),
                    'first_name': a.get('first_name', ''),
                    'last_name': a.get('last_name', '')
                }
                
        # Format transaction list
        formatted_txs = []
        for t in transactions:
            adv_id = str(t.get('advertiser_id'))
            advertiser_info = adv_map.get(adv_id, {
                'company_name': 'Unknown Advertiser',
                'email': 'Unknown',
                'first_name': '',
                'last_name': ''
            })
            
            created_at_val = t.get('created_at')
            if created_at_val and isinstance(created_at_val, datetime):
                created_at_val = created_at_val.isoformat() + 'Z'
                
            formatted_txs.append({
                '_id': str(t.get('_id')),
                'advertiser_id': adv_id,
                'advertiser': advertiser_info,
                'amount': float(t.get('amount', 0.0)),
                'method': t.get('method', 'paypal'),
                'status': t.get('status', 'confirmed'),
                'external_ref': t.get('external_ref', ''),
                'created_at': created_at_val
            })
            
        return jsonify({
            'success': True,
            'deposits': formatted_txs,
            'total': len(formatted_txs)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting advertiser deposits: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to get deposits: {str(e)}"}), 500


@admin_advertisers_bp.route('/deposits/<tx_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_manual_deposit(tx_id):
    """Approve a pending manual deposit (USDT/wire) and credit the advertiser's balance"""
    try:
        tx_col = db_instance.get_collection('wallet_transactions')
        adv_col = get_advertisers_collection()
        
        if tx_col is None or adv_col is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        tx = tx_col.find_one({'_id': ObjectId(tx_id)})
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404
            
        if tx.get('status') != 'pending':
            return jsonify({'error': f'Transaction is already {tx.get("status")}'}), 400
            
        advertiser_id = tx.get('advertiser_id')
        amount = float(tx.get('amount', 0.0))
        
        # Credit advertiser balance
        res = adv_col.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$inc': {'balance': amount}}
        )
        
        if res.matched_count == 0:
            return jsonify({'error': 'Advertiser not found'}), 404
            
        # Update transaction status
        tx_col.update_one(
            {'_id': ObjectId(tx_id)},
            {'$set': {
                'status': 'confirmed',
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"Manual deposit transaction {tx_id} approved. Credited advertiser {advertiser_id} with ${amount}")
        
        return jsonify({
            'success': True,
            'message': f'Deposit approved and credited successfully.'
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving manual deposit: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to approve deposit: {str(e)}"}), 500


@admin_advertisers_bp.route('/deposits/<tx_id>/reject', methods=['POST'])
@token_required
@admin_required
def reject_manual_deposit(tx_id):
    """Reject a pending manual deposit (USDT/wire)"""
    try:
        tx_col = db_instance.get_collection('wallet_transactions')
        if tx_col is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        tx = tx_col.find_one({'_id': ObjectId(tx_id)})
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404
            
        if tx.get('status') != 'pending':
            return jsonify({'error': f'Transaction is already {tx.get("status")}'}), 400
            
        # Update transaction status
        tx_col.update_one(
            {'_id': ObjectId(tx_id)},
            {'$set': {
                'status': 'failed',
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"Manual deposit transaction {tx_id} rejected.")
        
        return jsonify({
            'success': True,
            'message': 'Deposit transaction rejected.'
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting manual deposit: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to reject deposit: {str(e)}"}), 500


@admin_advertisers_bp.route('/deposits/<tx_id>/revert', methods=['POST'])
@token_required
@admin_required
def revert_manual_deposit(tx_id):
    """Revert an approved deposit (confirmed -> failed) and deduct from the advertiser's balance"""
    try:
        tx_col = db_instance.get_collection('wallet_transactions')
        adv_col = get_advertisers_collection()
        
        if tx_col is None or adv_col is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        tx = tx_col.find_one({'_id': ObjectId(tx_id)})
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404
            
        if tx.get('status') != 'confirmed':
            return jsonify({'error': f'Transaction status is {tx.get("status")}, only confirmed transactions can be reverted'}), 400
            
        advertiser_id = tx.get('advertiser_id')
        amount = float(tx.get('amount', 0.0))
        
        # Deduct advertiser balance
        res = adv_col.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$inc': {'balance': -amount}}
        )
        
        if res.matched_count == 0:
            return jsonify({'error': 'Advertiser not found'}), 404
            
        # Update transaction status to failed
        tx_col.update_one(
            {'_id': ObjectId(tx_id)},
            {'$set': {
                'status': 'failed',
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"Manual deposit transaction {tx_id} reverted (status set to failed). Deducted ${amount} from advertiser {advertiser_id}")
        
        return jsonify({
            'success': True,
            'message': 'Deposit successfully reverted and deducted from balance.'
        }), 200
        
    except Exception as e:
        logger.error(f"Error reverting manual deposit: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to revert deposit: {str(e)}"}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/postback', methods=['POST'])
@token_required
@admin_required
def save_advertiser_postback(advertiser_id):
    """Save or update advertiser postback settings and generate receiver URL"""
    try:
        data = request.get_json() or {}
        parameters = data.get('parameters', [])
        custom_params = data.get('custom_params', [])
        parameter_mappings = data.get('parameter_mappings', {})
        
        collection = get_advertisers_collection()
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        advertiser = collection.find_one({'_id': ObjectId(advertiser_id)})
        if not advertiser:
            return jsonify({'error': 'Advertiser not found'}), 404
            
        unique_key = advertiser.get('unique_postback_key')
        if not unique_key or data.get('regenerate'):
            import secrets
            unique_key = secrets.token_urlsafe(24)
            
        # Build base URL and full URL
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        all_params = parameters + custom_params
        
        if all_params:
            param_parts = []
            for param in all_params:
                if param.strip():
                    partner_macro = parameter_mappings.get(param.strip(), param.strip())
                    param_parts.append(f"{param.strip()}={{{partner_macro}}}")
            if param_parts:
                full_url = f"{base_url}?{'&'.join(param_parts)}"
            else:
                full_url = base_url
        else:
            full_url = base_url
            
        # Update advertiser document
        collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$set': {
                'unique_postback_key': unique_key,
                'postback_receiver_url': full_url,
                'postback_parameters': parameters,
                'postback_custom_params': custom_params,
                'postback_parameter_mappings': parameter_mappings,
                'updated_at': datetime.utcnow()
            }}
        )
        
        # Also sync to partners collection so name resolves correctly in received postback logs
        partners_collection = db_instance.get_collection('partners')
        if partners_collection is not None:
            partner_id = f"adv_{advertiser_id}"
            partner_name = advertiser.get('company_name') or f"{advertiser.get('first_name', '')} {advertiser.get('last_name', '')}".strip()
            if not partner_name:
                partner_name = f"Advertiser {advertiser_id}"
            partner_name = f"{partner_name} (Advertiser)"
            
            partner_doc = {
                'partner_id': partner_id,
                'partner_name': partner_name,
                'postback_url': '',
                'method': 'GET',
                'status': 'active',
                'description': f"Advertiser postback for {partner_name}",
                'unique_postback_key': unique_key,
                'postback_receiver_url': full_url,
                'parameter_mapping': parameter_mappings,
                'is_advertiser_postback': True,
                'advertiser_id': advertiser_id,
                'updated_at': datetime.utcnow()
            }
            
            partners_collection.update_one(
                {'partner_id': partner_id},
                {'$set': partner_doc, '$setOnInsert': {'created_at': datetime.utcnow()}},
                upsert=True
            )
            
        return jsonify({
            'success': True,
            'unique_key': unique_key,
            'base_url': base_url,
            'full_url': full_url,
            'parameters': parameters,
            'custom_params': custom_params,
            'parameter_mappings': parameter_mappings
        }), 200
        
    except Exception as e:
        logger.error(f"Error saving advertiser postback: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to save postback: {str(e)}"}), 500


@admin_advertisers_bp.route('/advertisers/<advertiser_id>/postback', methods=['DELETE'])
@token_required
@admin_required
def delete_advertiser_postback(advertiser_id):
    """Delete advertiser postback settings"""
    try:
        collection = get_advertisers_collection()
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        result = collection.update_one(
            {'_id': ObjectId(advertiser_id)},
            {'$unset': {
                'unique_postback_key': '',
                'postback_receiver_url': '',
                'postback_parameters': '',
                'postback_custom_params': '',
                'postback_parameter_mappings': ''
            }}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Advertiser not found'}), 404
            
        # Delete from partners collection
        partners_collection = db_instance.get_collection('partners')
        if partners_collection is not None:
            partners_collection.delete_one({'partner_id': f"adv_{advertiser_id}"})
            
        return jsonify({'success': True, 'message': 'Postback deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting advertiser postback: {str(e)}", exc_info=True)
        return jsonify({'error': f"Failed to delete postback: {str(e)}"}), 500




