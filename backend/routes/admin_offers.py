from flask import Blueprint, request, jsonify
from models.offer import Offer
from models.offer_extended import OfferExtended
from models.link_masking import LinkMasking
from utils.auth import token_required, subadmin_or_admin_required
from utils.json_serializer import safe_json_response, serialize_for_json
from utils.frontend_mapping import FrontendDatabaseMapper
from services.email_service import get_email_service
from database import db_instance
import logging
from datetime import datetime

admin_offers_bp = Blueprint('admin_offers', __name__)
offer_model = Offer()
extended_offer_model = OfferExtended()  # For schedule + smart rules operations
admin_offer_model = offer_model  # Use the same model instance
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
        
        # QA VERIFICATION: Log received data
        logging.info("📥 CREATE OFFER - Schedule received: %s", data.get("schedule"))
        logging.info("📥 CREATE OFFER - SmartRules received: %s", data.get("smartRules"))
        logging.info("📥 CREATE OFFER - Full payload keys: %s", list(data.keys()))
        
        # 🔍 DEBUG: Check payout_type
        print("="*80)
        print("🔍 ROUTE HANDLER DEBUG:")
        print(f"   payout_type from frontend: '{data.get('payout_type')}'")
        print(f"   revenue_share_percent from frontend: {data.get('revenue_share_percent')}")
        print("="*80)
        
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
                    # Send email to all publishers
                    publishers = users_collection.find({'role': 'publisher'})
                    email_service = get_email_service()
                    
                    email_count = 0
                    for publisher in publishers:
                        if publisher.get('email'):
                            try:
                                email_service.send_promo_code_assigned_to_offer(
                                    recipient_email=publisher['email'],
                                    offer_name=offer_data.get('name', 'Unknown Offer'),
                                    code=promo_code['code'],
                                    bonus_amount=promo_code['bonus_amount'],
                                    bonus_type=promo_code['bonus_type'],
                                    offer_id=str(offer_data['offer_id'])
                                )
                                email_count += 1
                            except Exception as e:
                                logging.error(f"Failed to send email to {publisher['email']}: {str(e)}")
                    
                    logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {offer_data.get('name')}")
                    logging.info(f"📧 Emails sent to {email_count} publishers")
            except Exception as e:
                logging.error(f"Failed to send promo code assignment emails: {str(e)}")
        
        logging.info("✅ Now triggering email notifications...")
        
        # Send email notifications to all users and publishers (non-blocking)
        try:
            logging.info("📧 Preparing to send email notifications to all users and publishers...")
            logging.info(f"📧 Offer data for email: {offer_data.get('name', 'Unknown')}")
            
            # Get all users and publishers from database
            users_collection = db_instance.get_collection('users')
            if users_collection is not None:
                # Get all users with email (includes both publishers and regular users)
                all_users = list(users_collection.find(
                    {'email': {'$exists': True, '$ne': ''}},
                    {'email': 1, 'username': 1, 'role': 1}
                ))
                
                logging.info(f"📧 Total users in database: {len(all_users)}")
                
                # Extract email addresses
                all_emails = [
                    user.get('email') for user in all_users 
                    if user.get('email')
                ]
                
                # Count by role for logging
                publishers = [u for u in all_users if u.get('role') == 'publisher']
                other_users = [u for u in all_users if u.get('role') != 'publisher']
                
                logging.info(f"📧 Publishers with valid emails: {len(publishers)}")
                logging.info(f"📧 Other users with valid emails: {len(other_users)}")
                logging.info(f"📧 Total recipients: {len(all_emails)}")
                
                for email in all_emails:
                    logging.info(f"   📧 Will send to: {email}")
                
                if all_emails:
                    logging.info(f"📧 Found {len(all_emails)} total emails - STARTING EMAIL SEND")
                    
                    # Send emails asynchronously (non-blocking)
                    email_service = get_email_service()
                    logging.info(f"📧 Email service configured: {email_service.is_configured}")
                    
                    email_service.send_new_offer_notification_async(
                        offer_data=offer_data,
                        recipients=all_emails
                    )
                    
                    logging.info("✅ Email notification process started in background")
                else:
                    logging.warning("⚠️ No user emails found - NO EMAILS WILL BE SENT")
            else:
                logging.warning("⚠️ Could not access users collection for email notifications")
                
        except Exception as email_error:
            # Don't fail offer creation if email fails
            logging.error(f"❌ Email notification error (non-critical): {str(email_error)}", exc_info=True)
        
        return safe_json_response({
            'message': 'Offer created successfully',
            'offer': offer_data
        }, 201)
        
    except Exception as e:
        logging.error(f"Create offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create offer: {str(e)}'}), 500

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

@admin_offers_bp.route('/offers/<offer_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_offer(offer_id):
    """Get a specific offer by ID (Admin only)"""
    try:
        offer = offer_model.get_offer_by_id(offer_id)
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
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
            
            # If approval is required, set affiliates to 'request'
            if require_approval or approval_type in ['time_based', 'manual']:
                data['affiliates'] = 'request'
                logging.info(f"🔒 Approval workflow enabled - Setting affiliates to 'request' for offer {offer_id}")
                
                # Also update approval_settings
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
                    # Send email to all publishers
                    publishers = users_collection.find({'role': 'publisher'})
                    email_service = get_email_service()
                    
                    email_count = 0
                    for publisher in publishers:
                        if publisher.get('email'):
                            try:
                                email_service.send_promo_code_assigned_to_offer(
                                    recipient_email=publisher['email'],
                                    offer_name=updated_offer.get('name', 'Unknown Offer'),
                                    code=promo_code['code'],
                                    bonus_amount=promo_code['bonus_amount'],
                                    bonus_type=promo_code['bonus_type'],
                                    offer_id=str(offer_id)
                                )
                                email_count += 1
                            except Exception as e:
                                logging.error(f"Failed to send email to {publisher['email']}: {str(e)}")
                    
                    logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {updated_offer.get('name')}")
                    logging.info(f"📧 Emails sent to {email_count} publishers")
            except Exception as e:
                logging.error(f"Failed to send promo code assignment emails: {str(e)}")
        
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
        success = offer_model.delete_offer(offer_id)
        
        if not success:
            return jsonify({'error': 'Offer not found or already deleted'}), 404
        
        return jsonify({'message': 'Offer deleted successfully'}), 200
        
    except Exception as e:
        logging.error(f"Delete offer error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete offer: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-delete', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_delete_offers():
    """Delete multiple offers at once (Admin only)"""
    try:
        data = request.get_json()
        
        if not data or 'offer_ids' not in data:
            return jsonify({'error': 'offer_ids array is required'}), 400
        
        offer_ids = data.get('offer_ids', [])
        
        if not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids must be a non-empty array'}), 400
        
        # Delete each offer
        deleted_count = 0
        failed_count = 0
        errors = []
        
        for offer_id in offer_ids:
            try:
                success = offer_model.delete_offer(offer_id)
                if success:
                    deleted_count += 1
                else:
                    failed_count += 1
                    errors.append({
                        'offer_id': offer_id,
                        'error': 'Offer not found or already deleted'
                    })
            except Exception as e:
                failed_count += 1
                errors.append({
                    'offer_id': offer_id,
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Bulk delete completed',
            'deleted': deleted_count,
            'failed': failed_count,
            'errors': errors if errors else None
        }), 200
        
    except Exception as e:
        logging.error(f"Bulk delete offers error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to bulk delete offers: {str(e)}'}), 500

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
        deleted_count = offer_model.empty_recycle_bin()
        
        return jsonify({
            'message': f'Recycle bin emptied successfully',
            'deleted_count': deleted_count
        }), 200
        
    except Exception as e:
        logging.error(f"Empty recycle bin error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to empty recycle bin: {str(e)}'}), 500

@admin_offers_bp.route('/offers/bulk-restore', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_restore_offers():
    """Restore multiple offers from recycle bin"""
    try:
        data = request.get_json()
        
        if not data or 'offer_ids' not in data:
            return jsonify({'error': 'offer_ids array is required'}), 400
        
        offer_ids = data.get('offer_ids', [])
        
        if not isinstance(offer_ids, list) or len(offer_ids) == 0:
            return jsonify({'error': 'offer_ids must be a non-empty array'}), 400
        
        restored_count = 0
        failed_count = 0
        errors = []
        
        for offer_id in offer_ids:
            try:
                success = offer_model.restore_offer(offer_id)
                if success:
                    restored_count += 1
                else:
                    failed_count += 1
                    errors.append({
                        'offer_id': offer_id,
                        'error': 'Offer not found in recycle bin'
                    })
            except Exception as e:
                failed_count += 1
                errors.append({
                    'offer_id': offer_id,
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Bulk restore completed',
            'restored': restored_count,
            'failed': failed_count,
            'errors': errors if errors else None
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
        
        # Get basic stats
        total_offers = offer_model.collection.count_documents({'is_active': True})
        active_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'active'})
        pending_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'pending'})
        inactive_offers = offer_model.collection.count_documents({'is_active': True, 'status': 'inactive'})
        
        # Get top networks
        pipeline = [
            {'$match': {'is_active': True}},
            {'$group': {'_id': '$network', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        top_networks = list(offer_model.collection.aggregate(pipeline))
        
        # Get total hits
        pipeline = [
            {'$match': {'is_active': True}},
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
        
        # Send email to all publishers
        publishers = users_collection.find({'role': 'publisher'})
        email_service = get_email_service()
        
        email_count = 0
        for publisher in publishers:
            if publisher.get('email'):
                try:
                    email_service.send_promo_code_assigned_to_offer(
                        recipient_email=publisher['email'],
                        offer_name=offer['name'],
                        code=promo_code['code'],
                        bonus_amount=promo_code['bonus_amount'],
                        bonus_type=promo_code['bonus_type'],
                        offer_id=str(offer_id)
                    )
                    email_count += 1
                except Exception as e:
                    logging.error(f"Failed to send email to {publisher['email']}: {str(e)}")
        
        logging.info(f"✅ Promo code {promo_code['code']} assigned to offer {offer['name']}")
        logging.info(f"📧 Emails sent to {email_count} publishers")
        
        return jsonify({
            'message': f'Promo code assigned and emails sent to {email_count} publishers',
            'offer_id': str(offer_id),
            'promo_code': promo_code['code'],
            'emails_sent': email_count
        }), 200
        
    except Exception as e:
        logging.error(f"Assign promo code error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to assign promo code: {str(e)}'}), 500

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
        
        # Apply show_in_offerwall setting to all rows
        for row in valid_rows:
            row['show_in_offerwall'] = show_in_offerwall
        
        # If there are critical validation errors (invalid format), return them
        if error_rows:
            return jsonify({
                'error': 'Validation errors found in spreadsheet',
                'validation_errors': error_rows,
                'valid_count': len(valid_rows),
                'error_count': len(error_rows),
                'missing_count': len(missing_offers_rows)
            }), 400
        
        if not valid_rows:
            return jsonify({'error': 'No valid data found in spreadsheet'}), 400
        
        # Create offers normally (no inventory gap detection - that's for Missing Offers page)
        logging.info(f"🔨 Creating {len(valid_rows)} offers...")
        created_offer_ids, creation_errors, _ = bulk_create_offers(
            valid_rows, 
            str(user['_id'])
        )
        
        logging.info(f"✅ Created {len(created_offer_ids)} offers")
        
        if creation_errors:
            logging.warning(f"⚠️ {len(creation_errors)} offers failed to create")
        
        # Prepare response
        response_data = {
            'message': f'Successfully created {len(created_offer_ids)} offers',
            'created_count': len(created_offer_ids),
            'created_offer_ids': created_offer_ids,
            'total_rows': len(rows),
            'success': True
        }
        
        if creation_errors:
            response_data['creation_errors'] = creation_errors
            response_data['error_count'] = len(creation_errors)
            response_data['message'] = f'Created {len(created_offer_ids)} offers, {len(creation_errors)} failed'
        
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
        print("="*80)
        print(f"🔍 PREVIEW DEBUG:")
        print(f"   Network: {network_id}")
        print(f"   Type: {network_type}")
        print(f"   Total available: {total_count}")
        print(f"   Preview offers fetched: {len(offers)}")
        print(f"   Error: {error}")
        print("="*80)
        
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
                    logging.info(f"   ✅ Mapped preview offer: {mapped.get('name')}")
            except Exception as e:
                logging.error(f"   ❌ Error mapping offer: {str(e)}")
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
    """Import offers from affiliate network API"""
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
        from utils.duplicate_detection import create_duplicate_detector
        
        # Get current user
        current_user = request.current_user
        created_by = current_user.get('username', 'admin')
        
        # Fetch offers
        offers, error = network_api_service.fetch_offers(
            network_id, api_key, network_type, filters
        )
        
        # Debug logging
        logging.info(f"🔍 API Import Debug:")
        logging.info(f"   Network: {network_id}")
        logging.info(f"   Type: {network_type}")
        logging.info(f"   Offers fetched: {len(offers)}")
        logging.info(f"   Error: {error}")
        
        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Initialize counters
        imported_count = 0
        skipped_count = 0
        error_count = 0
        missing_count = 0
        imported_offers = []
        skipped_offers = []
        errors = []
        missing_offers_list = []
        
        # Import missing offer service for detection
        try:
            from services.missing_offer_service import MissingOfferService
            from models.missing_offer import MissingOffer
            missing_offer_service = MissingOfferService
        except ImportError:
            missing_offer_service = None
            logging.warning("MissingOfferService not available, skipping missing offer detection")
        
        # Get duplicate strategy
        skip_duplicates = options.get('skip_duplicates', True)
        update_existing = options.get('update_existing', False)
        auto_activate = options.get('auto_activate', True)
        
        # Get approval workflow settings from options
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
        
        # Auto-set require_approval based on approval_type
        if approval_type in ['time_based', 'manual']:
            require_approval = True
        
        # Build approval_settings object
        approval_settings = {
            'type': approval_type,
            'require_approval': require_approval,
            'auto_approve_delay': int(auto_approve_delay) if auto_approve_delay else 0,
            'approval_message': options.get('approval_message', ''),
            'max_inactive_days': options.get('max_inactive_days', 0)
        }
        
        duplicate_strategy = 'skip' if skip_duplicates else ('update' if update_existing else 'create_new')
        
        # Create duplicate detector
        duplicate_detector = create_duplicate_detector(db_instance)
        
        # Process each offer
        for offer_data in offers:
            try:
                # Map to database format - pass network_id
                mapped_offer = network_field_mapper.map_to_db_format(offer_data, network_type, network_id)
                
                if not mapped_offer:
                    error_count += 1
                    errors.append({
                        'offer_name': 'Unknown',
                        'error': 'Failed to map offer data'
                    })
                    continue
                
                # Validate mapped offer
                is_valid, validation_errors = network_field_mapper.validate_mapped_offer(mapped_offer)
                if not is_valid:
                    error_count += 1
                    errors.append({
                        'offer_name': mapped_offer.get('name', 'Unknown'),
                        'error': ', '.join(validation_errors)
                    })
                    continue
                
                # Check for inventory gaps and store in missing offers collection
                if missing_offer_service:
                    result = missing_offer_service.process_offer_for_inventory_gap(
                        offer_data=mapped_offer,
                        source='api_fetch',
                        network=network_id
                    )
                    if not result.get('in_inventory') and result.get('missing_offer_id'):
                        missing_count += 1
                        missing_offers_list.append({
                            'name': mapped_offer.get('name', 'Unknown'),
                            'match_key': result.get('match_key'),
                            'missing_offer_id': result.get('missing_offer_id')
                        })
                        logging.info(f"Stored inventory gap from API: {result.get('match_key')}")
                
                # Check for duplicates
                is_duplicate, duplicate_id, existing_offer = duplicate_detector.check_duplicate(
                    mapped_offer, duplicate_strategy
                )
                
                if is_duplicate and duplicate_strategy == 'skip':
                    skipped_count += 1
                    skipped_offers.append({
                        'name': mapped_offer.get('name'),
                        'reason': f'Already exists (campaign_id: {mapped_offer.get("campaign_id")})'
                    })
                    continue
                
                # Set status based on auto_activate option
                if not auto_activate:
                    mapped_offer['status'] = 'inactive'
                
                # Apply approval workflow settings
                mapped_offer['approval_settings'] = approval_settings
                mapped_offer['approval_type'] = approval_type
                mapped_offer['auto_approve_delay'] = approval_settings['auto_approve_delay']
                mapped_offer['require_approval'] = require_approval
                
                # Set affiliates to 'request' if approval is required
                if require_approval or approval_type in ['time_based', 'manual']:
                    mapped_offer['affiliates'] = 'request'
                
                # Create or update offer
                if is_duplicate and duplicate_strategy == 'update':
                    # Update existing offer
                    action, offer_id = duplicate_detector.handle_duplicate(
                        mapped_offer, existing_offer, 'update'
                    )
                    imported_count += 1
                    imported_offers.append(offer_id)
                else:
                    # Create new offer
                    created_offer, create_error = offer_model.create_offer(mapped_offer, created_by)
                    
                    if create_error:
                        error_count += 1
                        errors.append({
                            'offer_name': mapped_offer.get('name'),
                            'error': create_error
                        })
                    else:
                        imported_count += 1
                        imported_offers.append(created_offer['offer_id'])
                
            except Exception as e:
                error_count += 1
                errors.append({
                    'offer_name': mapped_offer.get('name', 'Unknown') if 'mapped_offer' in locals() else 'Unknown',
                    'error': str(e)
                })
                logging.error(f"Error importing offer: {str(e)}", exc_info=True)
        
        # Return summary
        response_data = {
            'success': True,
            'summary': {
                'total_fetched': len(offers),
                'imported': imported_count,
                'skipped': skipped_count,
                'errors': error_count,
                'missing_data': missing_count
            },
            'imported_offers': imported_offers,
            'skipped_offers': skipped_offers[:10],  # Limit to first 10
            'errors': errors[:10]  # Limit to first 10
        }
        
        # Include missing offers info if any
        if missing_offers_list:
            response_data['missing_offers'] = missing_offers_list[:10]  # Limit to first 10
            response_data['summary']['message'] = f'{missing_count} offers have missing data (see Missing Offers tab)'
        
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
