"""
Missing Offers API Routes
Handles missing offers management and email scheduling for partner notifications.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from models.missing_offer import MissingOffer
from models.scheduled_email import ScheduledEmail
from utils.auth import token_required, admin_required
from services.email_service import get_email_service

missing_offers_bp = Blueprint('missing_offers', __name__)
logger = logging.getLogger(__name__)


# ==================== EMAIL SERVICE CONTROL ENDPOINTS ====================

@missing_offers_bp.route('/api/admin/email-service/status', methods=['GET'])
@token_required
@admin_required
def get_email_service_status():
    """Get the current status of the email service (paused/running)."""
    try:
        from services.scheduled_email_service import get_scheduled_email_service
        service = get_scheduled_email_service()
        status = service.get_status()
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"Error getting email service status: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/email-service/pause', methods=['POST'])
@token_required
@admin_required
def pause_email_service():
    """Pause all email sending."""
    try:
        from services.scheduled_email_service import get_scheduled_email_service
        service = get_scheduled_email_service()
        service.pause()
        logger.info(f"📧 Email service paused by {request.current_user.get('username')}")
        return jsonify({
            'message': 'Email service paused successfully',
            'paused': True
        }), 200
    except Exception as e:
        logger.error(f"Error pausing email service: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/email-service/resume', methods=['POST'])
@token_required
@admin_required
def resume_email_service():
    """Resume email sending."""
    try:
        from services.scheduled_email_service import get_scheduled_email_service
        service = get_scheduled_email_service()
        service.resume()
        logger.info(f"📧 Email service resumed by {request.current_user.get('username')}")
        return jsonify({
            'message': 'Email service resumed successfully',
            'paused': False
        }), 200
    except Exception as e:
        logger.error(f"Error resuming email service: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== MISSING OFFERS ENDPOINTS ====================

@missing_offers_bp.route('/api/admin/missing-offers', methods=['GET'])
@token_required
@admin_required
def get_missing_offers():
    """Get all missing offers (inventory gaps) with filtering and pagination."""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        status = request.args.get('status')  # pending, resolved, ignored
        network = request.args.get('network')
        platform = request.args.get('platform')  # iOS, Android, Web, All
        country = request.args.get('country')
        payout_model = request.args.get('payout_model')  # CPA, CPI, CPL, etc.
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = -1 if request.args.get('sort_order', 'desc') == 'desc' else 1
        
        result = MissingOffer.get_all(
            status=status,
            network=network,
            platform=platform,
            country=country,
            payout_model=payout_model,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting missing offers: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/stats', methods=['GET'])
@token_required
@admin_required
def get_missing_offers_stats():
    """Get statistics about missing offers."""
    try:
        stats = MissingOffer.get_stats()
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"Error getting missing offers stats: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/networks', methods=['GET'])
@token_required
@admin_required
def get_missing_offers_networks():
    """Get list of networks with missing offers."""
    try:
        networks = MissingOffer.get_networks()
        return jsonify({'networks': networks}), 200
    except Exception as e:
        logger.error(f"Error getting networks: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/platforms', methods=['GET'])
@token_required
@admin_required
def get_missing_offers_platforms():
    """Get list of platforms with missing offers."""
    try:
        platforms = MissingOffer.get_platforms()
        return jsonify({'platforms': platforms}), 200
    except Exception as e:
        logger.error(f"Error getting platforms: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/payout-models', methods=['GET'])
@token_required
@admin_required
def get_missing_offers_payout_models():
    """Get list of payout models with missing offers."""
    try:
        payout_models = MissingOffer.get_payout_models()
        return jsonify({'payout_models': payout_models}), 200
    except Exception as e:
        logger.error(f"Error getting payout models: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/countries', methods=['GET'])
@token_required
@admin_required
def get_missing_offers_countries():
    """Get list of countries with missing offers."""
    try:
        countries = MissingOffer.get_countries()
        return jsonify({'countries': countries}), 200
    except Exception as e:
        logger.error(f"Error getting countries: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/<offer_id>', methods=['GET'])
@token_required
@admin_required
def get_missing_offer(offer_id):
    """Get a single missing offer by ID."""
    try:
        offer = MissingOffer.get_by_id(offer_id)
        if not offer:
            return jsonify({'error': 'Missing offer not found'}), 404
        return jsonify(offer), 200
    except Exception as e:
        logger.error(f"Error getting missing offer: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/<offer_id>/status', methods=['PUT'])
@token_required
@admin_required
def update_missing_offer_status(offer_id):
    """Update the status of a missing offer."""
    try:
        data = request.get_json()
        status = data.get('status')
        notes = data.get('notes')
        
        if status not in ['pending', 'resolved', 'ignored']:
            return jsonify({'error': 'Invalid status'}), 400
        
        current_user = request.current_user
        user_id = str(current_user.get('_id', current_user.get('id', '')))
        success = MissingOffer.update_status(offer_id, status, resolved_by=user_id, notes=notes)
        
        if success:
            return jsonify({'message': 'Status updated successfully'}), 200
        return jsonify({'error': 'Failed to update status'}), 400
        
    except Exception as e:
        logger.error(f"Error updating missing offer status: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/bulk-status', methods=['PUT'])
@token_required
@admin_required
def bulk_update_missing_offer_status():
    """Bulk update status for multiple missing offers."""
    try:
        data = request.get_json()
        offer_ids = data.get('offer_ids', [])
        status = data.get('status')
        
        if not offer_ids:
            return jsonify({'error': 'No offer IDs provided'}), 400
        if status not in ['pending', 'resolved', 'ignored']:
            return jsonify({'error': 'Invalid status'}), 400
        
        current_user = request.current_user
        user_id = str(current_user.get('_id', current_user.get('id', '')))
        updated_count = MissingOffer.bulk_update_status(offer_ids, status, resolved_by=user_id)
        
        return jsonify({
            'message': f'Updated {updated_count} offers',
            'updated_count': updated_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error bulk updating missing offers: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/<offer_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_missing_offer(offer_id):
    """Delete a missing offer record."""
    try:
        success = MissingOffer.delete(offer_id)
        if success:
            return jsonify({'message': 'Deleted successfully'}), 200
        return jsonify({'error': 'Failed to delete'}), 400
    except Exception as e:
        logger.error(f"Error deleting missing offer: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/missing-offers/auto-resolve', methods=['POST'])
@token_required
@admin_required
def auto_resolve_missing_offers():
    """
    Auto-resolve missing offers that now exist in inventory.
    Checks all pending missing offers against the main offers collection
    and marks as resolved any that now have matching offers.
    """
    try:
        result = MissingOffer.auto_resolve_if_in_inventory()
        
        return jsonify({
            'message': f'Auto-resolved {result["resolved_count"]} offers',
            'resolved_count': result['resolved_count'],
            'resolved_offers': result['resolved_offers']
        }), 200
        
    except Exception as e:
        logger.error(f"Error auto-resolving missing offers: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== SCHEDULED EMAILS ENDPOINTS ====================

@missing_offers_bp.route('/api/admin/scheduled-emails', methods=['GET'])
@token_required
@admin_required
def get_scheduled_emails():
    """Get all scheduled emails with filtering and pagination."""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        status = request.args.get('status')
        network = request.args.get('network')
        include_past = request.args.get('include_past', 'true').lower() == 'true'
        
        result = ScheduledEmail.get_all(
            status=status,
            network=network,
            page=page,
            per_page=per_page,
            include_past=include_past
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting scheduled emails: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/stats', methods=['GET'])
@token_required
@admin_required
def get_scheduled_emails_stats():
    """Get statistics about scheduled emails."""
    try:
        stats = ScheduledEmail.get_stats()
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"Error getting scheduled emails stats: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails', methods=['POST'])
@token_required
@admin_required
def create_scheduled_email():
    """Create a new scheduled email."""
    try:
        data = request.get_json()
        current_user = request.current_user
        
        # Validate required fields
        required = ['subject', 'body', 'recipients', 'scheduled_at']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Parse scheduled_at
        scheduled_at = data.get('scheduled_at')
        if isinstance(scheduled_at, str):
            scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        
        # Handle "send in X days" format
        if data.get('send_in_days'):
            days = int(data.get('send_in_days'))
            scheduled_at = datetime.utcnow() + timedelta(days=days)
        
        user_id = str(current_user.get('_id', current_user.get('id', '')))
        
        email = ScheduledEmail.create(
            subject=data.get('subject'),
            body=data.get('body'),
            recipients=data.get('recipients'),
            scheduled_at=scheduled_at,
            created_by=user_id,
            related_offer_ids=data.get('related_offer_ids'),
            network=data.get('network'),
            email_type=data.get('email_type', 'missing_offers')
        )
        
        if email:
            email['_id'] = str(email['_id'])
            
            # Mark related offers as having email scheduled
            if data.get('related_offer_ids'):
                MissingOffer.mark_email_sent(data.get('related_offer_ids'), str(email['_id']))
            
            return jsonify({
                'message': 'Email scheduled successfully',
                'email': email
            }), 201
        
        return jsonify({'error': 'Failed to create scheduled email'}), 400
        
    except Exception as e:
        logger.error(f"Error creating scheduled email: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/<email_id>', methods=['GET'])
@token_required
@admin_required
def get_scheduled_email(email_id):
    """Get a single scheduled email by ID."""
    try:
        email = ScheduledEmail.get_by_id(email_id)
        if not email:
            return jsonify({'error': 'Scheduled email not found'}), 404
        return jsonify(email), 200
    except Exception as e:
        logger.error(f"Error getting scheduled email: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/<email_id>', methods=['PUT'])
@token_required
@admin_required
def update_scheduled_email(email_id):
    """Update a scheduled email."""
    try:
        data = request.get_json()
        
        # Only allow updating pending emails
        email = ScheduledEmail.get_by_id(email_id)
        if not email:
            return jsonify({'error': 'Scheduled email not found'}), 404
        if email.get('status') != 'pending':
            return jsonify({'error': 'Can only update pending emails'}), 400
        
        # Parse scheduled_at if provided
        if data.get('scheduled_at'):
            scheduled_at = data.get('scheduled_at')
            if isinstance(scheduled_at, str):
                data['scheduled_at'] = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        
        success = ScheduledEmail.update(email_id, data)
        if success:
            return jsonify({'message': 'Email updated successfully'}), 200
        return jsonify({'error': 'Failed to update email'}), 400
        
    except Exception as e:
        logger.error(f"Error updating scheduled email: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/<email_id>/cancel', methods=['POST'])
@token_required
@admin_required
def cancel_scheduled_email(email_id):
    """Cancel a scheduled email."""
    try:
        current_user = request.current_user
        user_id = str(current_user.get('_id', current_user.get('id', '')))
        success = ScheduledEmail.cancel(email_id, cancelled_by=user_id)
        
        if success:
            return jsonify({'message': 'Email cancelled successfully'}), 200
        return jsonify({'error': 'Failed to cancel email (may already be sent or cancelled)'}), 400
        
    except Exception as e:
        logger.error(f"Error cancelling scheduled email: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/<email_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_scheduled_email(email_id):
    """Delete a scheduled email."""
    try:
        success = ScheduledEmail.delete(email_id)
        if success:
            return jsonify({'message': 'Deleted successfully'}), 200
        return jsonify({'error': 'Failed to delete'}), 400
    except Exception as e:
        logger.error(f"Error deleting scheduled email: {e}")
        return jsonify({'error': str(e)}), 500


@missing_offers_bp.route('/api/admin/scheduled-emails/<email_id>/send-now', methods=['POST'])
@token_required
@admin_required
def send_email_now(email_id):
    """Send a scheduled email immediately."""
    try:
        # Check if email service is paused
        from services.scheduled_email_service import get_scheduled_email_service
        email_svc = get_scheduled_email_service()
        if email_svc.is_paused():
            return jsonify({
                'error': 'Email service is currently paused. Please resume it before sending emails.',
                'paused': True
            }), 400
        
        email = ScheduledEmail.get_by_id(email_id)
        if not email:
            return jsonify({'error': 'Scheduled email not found'}), 404
        if email.get('status') != 'pending':
            return jsonify({'error': 'Can only send pending emails'}), 400
        
        # Get email service
        email_service = get_email_service()
        if not email_service.is_configured:
            return jsonify({'error': 'Email service not configured'}), 500
        
        # Send the email
        try:
            success_count = 0
            fail_count = 0
            for recipient in email.get('recipients', []):
                try:
                    result = email_service._send_email(
                        to_email=recipient,
                        subject=email.get('subject'),
                        html_content=email.get('body')
                    )
                    if result:
                        success_count += 1
                    else:
                        fail_count += 1
                except Exception as e:
                    fail_count += 1
                    logger.error(f"Failed to send to {recipient}: {e}")
            
            if success_count > 0:
                ScheduledEmail.mark_sent(email_id)
                return jsonify({'message': f'Email sent successfully to {success_count} recipients'}), 200
            else:
                ScheduledEmail.mark_failed(email_id, f'Failed to send to all {fail_count} recipients')
                return jsonify({'error': 'Failed to send email to any recipient'}), 500
            
        except Exception as send_error:
            ScheduledEmail.mark_failed(email_id, str(send_error))
            return jsonify({'error': f'Failed to send email: {send_error}'}), 500
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== COMPOSE EMAIL FOR MISSING OFFERS ====================

@missing_offers_bp.route('/api/admin/missing-offers/compose-email', methods=['POST'])
@token_required
@admin_required
def compose_email_for_missing_offers():
    """
    Compose and schedule an email about missing offers.
    Can select specific offers or all offers for a network.
    """
    try:
        data = request.get_json()
        current_user = request.current_user
        
        offer_ids = data.get('offer_ids', [])
        network = data.get('network')
        subject = data.get('subject')
        body = data.get('body')
        recipients = data.get('recipients', [])
        scheduled_at = data.get('scheduled_at')
        send_in_days = data.get('send_in_days')
        
        # Validate
        if not subject or not body:
            return jsonify({'error': 'Subject and body are required'}), 400
        if not recipients:
            return jsonify({'error': 'At least one recipient is required'}), 400
        
        # Get offers if not specified but network is
        if not offer_ids and network:
            result = MissingOffer.get_all(network=network, status='pending', per_page=1000)
            offer_ids = [o['_id'] for o in result.get('offers', [])]
        
        # Calculate scheduled time
        if send_in_days is not None:
            # Support fractional days (e.g., 0.5 = 12 hours, 0.0417 = 1 hour)
            # Ensure minimum 2 minute delay to prevent duplicate sends from background service
            min_delay_days = 2 / (24 * 60)  # 2 minutes in days
            actual_delay = max(float(send_in_days), min_delay_days)
            scheduled_at = datetime.utcnow() + timedelta(days=actual_delay)
        elif scheduled_at:
            if isinstance(scheduled_at, str):
                scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        else:
            # Default to now (send immediately)
            scheduled_at = datetime.utcnow()
        
        user_id = str(current_user.get('_id', current_user.get('id', '')))
        
        # Create the scheduled email
        email = ScheduledEmail.create(
            subject=subject,
            body=body,
            recipients=recipients,
            scheduled_at=scheduled_at,
            created_by=user_id,
            related_offer_ids=offer_ids,
            network=network,
            email_type='missing_offers'
        )
        
        if email:
            email['_id'] = str(email['_id'])
            
            # Mark offers as having email scheduled
            if offer_ids:
                MissingOffer.mark_email_sent(offer_ids, str(email['_id']))
            
            return jsonify({
                'message': 'Email scheduled successfully',
                'email': email,
                'offers_count': len(offer_ids)
            }), 201
        
        return jsonify({'error': 'Failed to schedule email'}), 400
        
    except Exception as e:
        logger.error(f"Error composing email: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== INVENTORY CROSS-CHECK ENDPOINT ====================

@missing_offers_bp.route('/api/admin/missing-offers/check-inventory', methods=['POST'])
@token_required
@admin_required
def check_inventory():
    """
    Cross-check uploaded offers against existing inventory.
    This is a READ-ONLY operation - nothing gets created or stored.
    
    Upload a spreadsheet (Excel/CSV) and get back two lists:
    - in_inventory: Offers we already have
    - not_in_inventory: Offers we don't have (inventory gaps)
    
    Match Key = Name + Country + Platform + Payout Model
    """
    import os
    import tempfile
    from werkzeug.utils import secure_filename
    from utils.bulk_offer_upload import (
        parse_excel_file, 
        parse_csv_file, 
        fetch_google_sheet,
        map_spreadsheet_to_db,
        apply_default_values
    )
    from services.missing_offer_service import MissingOfferService
    
    try:
        rows = []
        
        # Check if it's a Google Sheets URL or file upload
        if request.content_type and 'application/json' in request.content_type:
            # Google Sheets URL
            data = request.get_json()
            sheet_url = data.get('url')
            
            if not sheet_url:
                return jsonify({'error': 'Google Sheets URL is required'}), 400
            
            logger.info(f"📊 Fetching Google Sheet for inventory check: {sheet_url}")
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
                logger.info(f"📊 Parsing uploaded file for inventory check: {filename}")
                
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
        
        if not rows:
            return jsonify({'error': 'No data found in file'}), 400
        
        logger.info(f"✅ Parsed {len(rows)} rows for inventory check")
        
        # Process each row and check against inventory
        in_inventory = []
        not_in_inventory = []
        
        # Generate a batch ID for this upload
        import uuid
        upload_batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        price_mismatches = []
        
        for row in rows:
            row_number = row.get('_row_number', 'Unknown')
            
            # Map spreadsheet columns to database fields
            mapped_data = map_spreadsheet_to_db(row)
            
            # Apply defaults to get proper field values
            processed_data = apply_default_values(mapped_data)
            
            # Generate match key
            match_key = MissingOfferService.generate_match_key(processed_data)
            
            # Use process_offer_for_inventory_gap to also detect price mismatches
            try:
                gap_result = MissingOfferService.process_offer_for_inventory_gap(
                    offer_data=processed_data,
                    source='sheet_upload',
                    network=processed_data.get('network', 'Unknown'),
                    upload_batch_id=upload_batch_id
                )
                
                exists = gap_result['in_inventory']
                existing_offer_id = gap_result.get('existing_offer_id')
            except Exception as gap_error:
                logger.error(f"Error processing offer for inventory gap: {gap_error}", exc_info=True)
                # Fallback to simple check
                exists, existing_offer = MissingOfferService.check_inventory_exists(match_key)
                existing_offer_id = str(existing_offer.get('_id', '')) if existing_offer else None
                gap_result = {'price_mismatch': None}
            
            # Build result item
            result_item = {
                'row': row_number,
                'name': processed_data.get('name', 'Unknown'),
                'country': MissingOfferService.normalize_country(processed_data.get('countries', [])),
                'platform': MissingOfferService.detect_platform(processed_data.get('name', '')),
                'payout_model': MissingOfferService.normalize_payout_model(processed_data.get('payout_model', '')),
                'payout': processed_data.get('payout', 0),
                'network': processed_data.get('network', 'Unknown'),
                'match_key': match_key,
                'raw_data': row
            }
            
            if exists:
                result_item['existing_offer_id'] = existing_offer_id
                # Check if there was a price mismatch
                if gap_result.get('price_mismatch'):
                    result_item['price_mismatch'] = gap_result['price_mismatch']
                    price_mismatches.append(result_item)
                in_inventory.append(result_item)
            else:
                not_in_inventory.append(result_item)
        
        # Build response
        response = {
            'message': f'Checked {len(rows)} offers against inventory',
            'in_inventory': in_inventory,
            'not_in_inventory': not_in_inventory,
            'price_mismatches': price_mismatches,
            'stats': {
                'total': len(rows),
                'have': len(in_inventory),
                'dont_have': len(not_in_inventory),
                'price_mismatches': len(price_mismatches),
                'have_percent': round(len(in_inventory) / len(rows) * 100, 1) if rows else 0,
                'dont_have_percent': round(len(not_in_inventory) / len(rows) * 100, 1) if rows else 0
            }
        }
        
        logger.info(f"✅ Inventory check complete: {len(in_inventory)} have, {len(not_in_inventory)} don't have, {len(price_mismatches)} price mismatches")
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error checking inventory: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
