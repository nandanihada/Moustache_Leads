from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from models.publisher import Publisher
from models.placement import Placement
import logging

logger = logging.getLogger(__name__)

placements_bp = Blueprint('placements', __name__)


def get_current_publisher(current_user):
    """Get or create publisher for current user"""
    publisher_model = Publisher()
    publisher, error = publisher_model.get_or_create_for_user(current_user)
    
    if error:
        return None, error
    
    return publisher, None


@placements_bp.route('/', methods=['POST'])
@token_required
def create_placement():
    """Create a new placement"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Create placement directly with user ID (no separate publisher model needed)
        placement_model = Placement()
        placement, error = placement_model.create_placement(
            publisher_id=str(current_user['_id']),  # Use user ID directly
            placement_data=data
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        # Format response
        response_data = {
            'id': str(placement['_id']),
            'publisherId': str(placement['publisherId']),
            'placementIdentifier': placement['placementIdentifier'],
            'apiKey': placement.get('apiKey', ''),  # Handle missing apiKey gracefully
            'platformType': placement['platformType'],
            'offerwallTitle': placement['offerwallTitle'],
            'currencyName': placement['currencyName'],
            'exchangeRate': placement['exchangeRate'],
            'postbackUrl': placement['postbackUrl'],
            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Error creating placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/', methods=['GET'])
@token_required
def get_placements():
    """Get placements for current user with pagination and filters"""
    try:
        current_user = request.current_user
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        size = min(int(request.args.get('size', 10)), 100)  # Max 100 per page
        status_filter = request.args.get('status_filter')
        platform_filter = request.args.get('platform_filter')
        
        # Get placements directly by user ID (since placements are linked to users)
        placement_model = Placement()
        placements, total, error = placement_model.get_placements_by_publisher(
            publisher_id=str(current_user['_id']),  # Use user ID directly
            page=page,
            size=size,
            status_filter=status_filter,
            platform_filter=platform_filter
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        # Format response
        placement_list = []
        for placement in placements:
            placement_list.append({
                'id': str(placement['_id']),
                'publisherId': str(placement['publisherId']),
                'placementIdentifier': placement['placementIdentifier'],
                'apiKey': placement.get('apiKey', ''),  # Handle missing apiKey gracefully
                'platformType': placement['platformType'],
                'offerwallTitle': placement['offerwallTitle'],
                'currencyName': placement['currencyName'],
                'exchangeRate': placement['exchangeRate'],
                'postbackUrl': placement['postbackUrl'],
                'status': placement['status'],
                'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
                'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
                'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
                'rejectionReason': placement.get('rejectionReason'),
                'reviewMessage': placement.get('reviewMessage'),
                'createdAt': placement['createdAt'].isoformat()
            })
        
        response_data = {
            'placements': placement_list,
            'total': total,
            'page': page,
            'size': size
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching placements: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/<placement_id>', methods=['GET'])
@token_required
def get_placement(placement_id):
    """Get a specific placement"""
    try:
        current_user = request.current_user
        
        # Get placement
        placement_model = Placement()
        placement, error = placement_model.get_placement_by_id(
            placement_id=placement_id,
            publisher_id=str(current_user['_id'])
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        if not placement:
            return jsonify({'error': 'Placement not found'}), 404
        
        # Format response
        response_data = {
            'id': str(placement['_id']),
            'publisherId': str(placement['publisherId']),
            'placementIdentifier': placement['placementIdentifier'],
            'apiKey': placement.get('apiKey', ''),  # Handle missing apiKey gracefully
            'platformType': placement['platformType'],
            'offerwallTitle': placement['offerwallTitle'],
            'currencyName': placement['currencyName'],
            'exchangeRate': placement['exchangeRate'],
            'postbackUrl': placement['postbackUrl'],
            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/<placement_id>', methods=['PUT'])
@token_required
def update_placement(placement_id):
    """Update a placement"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update placement directly with user ID
        placement_model = Placement()
        placement, error = placement_model.update_placement(
            placement_id=placement_id,
            publisher_id=str(current_user['_id']),
            update_data=data
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        if not placement:
            return jsonify({'error': 'Placement not found'}), 404
        
        # Format response
        response_data = {
            'id': str(placement['_id']),
            'publisherId': str(placement['publisherId']),
            'placementIdentifier': placement['placementIdentifier'],
            'apiKey': placement.get('apiKey', ''),  # Handle missing apiKey gracefully
            'platformType': placement['platformType'],
            'offerwallTitle': placement['offerwallTitle'],
            'currencyName': placement['currencyName'],
            'exchangeRate': placement['exchangeRate'],
            'postbackUrl': placement['postbackUrl'],
            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error updating placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/<placement_id>', methods=['DELETE'])
@token_required
def delete_placement(placement_id):
    """Delete a placement (soft delete)"""
    try:
        current_user = request.current_user
        
        # Delete placement directly with user ID
        placement_model = Placement()
        success, error = placement_model.delete_placement(
            placement_id=placement_id,
            publisher_id=str(current_user['_id'])
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        if not success:
            return jsonify({'error': 'Placement not found'}), 404
        
        return '', 204
        
    except Exception as e:
        logger.error(f"Error deleting placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/publisher/me', methods=['GET'])
@token_required
def get_current_publisher_info():
    """Get current publisher information"""
    try:
        current_user = request.current_user
        
        # Get or create publisher for current user
        publisher, error = get_current_publisher(current_user)
        if error:
            return jsonify({'error': error}), 500
        
        response_data = {
            'id': str(publisher['_id']),
            'name': publisher['name'],
            'contactEmail': publisher['contactEmail'],
            'status': publisher['status'],
            'createdAt': publisher['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching publisher info: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/test-postback', methods=['POST'])
@token_required
def test_postback():
    """Test postback functionality by simulating a conversion"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['placementIdentifier', 'postbackUri', 'userId', 'rewardValue']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get or create publisher for current user
        publisher, error = get_current_publisher(current_user)
        if error:
            return jsonify({'error': error}), 500
        
        # Verify placement exists and belongs to publisher
        placement_model = Placement()
        placement, error = placement_model.get_placement_by_id(
            placement_id=data.get('placementId'),
            publisher_id=str(publisher['_id'])
        )
        
        # If no placement ID provided, find by identifier
        if not placement and data.get('placementIdentifier'):
            placements, total, error = placement_model.get_placements_by_publisher(
                publisher_id=str(publisher['_id']),
                page=1,
                size=100
            )
            if not error:
                placement = next(
                    (p for p in placements if p.get('placementIdentifier') == data['placementIdentifier']), 
                    None
                )
        
        if not placement:
            return jsonify({'error': 'Placement not found or access denied'}), 404
        
        # Simulate postback test (in a real implementation, you would make HTTP request to postbackUri)
        import requests
        import time
        
        # Prepare postback data
        postback_data = {
            'user_id': data['userId'],
            'reward_value': data['rewardValue'],
            'offer_name': data.get('offerName', 'Test Offer'),
            'offer_id': data.get('offerId', 'TEST_OFFER_001'),
            'status': data.get('testStatus', 'completed'),
            'user_ip': data.get('userIp', '127.0.0.1'),
            'placement_id': data['placementIdentifier'],
            'timestamp': int(time.time()),
            'test_mode': True
        }
        
        try:
            # Make HTTP request to postback URL
            response = requests.post(
                data['postbackUri'],
                json=postback_data,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            success = response.status_code == 200
            message = f"Postback sent. Server responded with status {response.status_code}"
            
            if success:
                message += f". Response: {response.text[:100]}"
            
            return jsonify({
                'success': success,
                'message': message,
                'postback_data': postback_data,
                'response_status': response.status_code,
                'response_body': response.text[:200] if response.text else None
            }), 200
            
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'message': 'Postback request timed out after 10 seconds',
                'postback_data': postback_data
            }), 200
            
        except requests.exceptions.RequestException as e:
            return jsonify({
                'success': False,
                'message': f'Failed to send postback: {str(e)}',
                'postback_data': postback_data
            }), 200
        
    except Exception as e:
        logger.error(f"Error testing postback: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/migrate/add-api-keys', methods=['POST'])
@token_required
def migrate_add_api_keys():
    """Migration endpoint to add API keys to existing placements"""
    try:
        placement_model = Placement()
        success, message = placement_model.migrate_add_api_keys()
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({'error': message}), 500
            
    except Exception as e:
        logger.error(f"Error running migration: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Admin-only endpoints for placement approval
@placements_bp.route('/admin/all', methods=['GET'])
@token_required
@subadmin_or_admin_required('placement-approval')
def get_all_placements_admin():
    """Get all placements for admin review"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        size = min(int(request.args.get('size', 10)), 100)  # Max 100 per page
        status_filter = request.args.get('status_filter')
        platform_filter = request.args.get('platform_filter')
        
        # Get placements
        placement_model = Placement()
        placements, total, error = placement_model.get_all_placements_for_admin(
            page=page,
            size=size,
            status_filter=status_filter,
            platform_filter=platform_filter
        )
        
        if error:
            return jsonify({'error': error}), 500
        
        # Format response
        placement_list = []
        for placement in placements:
            publisher = placement.get('publisher', {})
            placement_list.append({
                'id': str(placement['_id']),
                'publisherId': str(placement['publisherId']),
                'publisherName': publisher.get('username', 'Unknown'),
                'publisherEmail': publisher.get('email', 'Unknown'),
                'placementIdentifier': placement['placementIdentifier'],
                'platformType': placement['platformType'],
                'offerwallTitle': placement['offerwallTitle'],
                'currencyName': placement['currencyName'],
                'exchangeRate': placement['exchangeRate'],
                'postbackUrl': placement['postbackUrl'],
                'status': placement['status'],
                'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
                'approvedBy': str(placement['approvedBy']) if placement.get('approvedBy') else None,
                'approvedAt': placement['approvedAt'].isoformat() if placement.get('approvedAt') else None,
                'rejectionReason': placement.get('rejectionReason'),
                'reviewMessage': placement.get('reviewMessage'),
                'createdAt': placement['createdAt'].isoformat()
            })
        
        response_data = {
            'placements': placement_list,
            'total': total,
            'page': page,
            'size': size
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching admin placements: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/admin/<placement_id>/approve', methods=['POST'])
@token_required
@subadmin_or_admin_required('placement-approval')
def approve_placement_admin(placement_id):
    """Approve a placement"""
    try:
        from models.user import User
        from services.email_service import get_email_service
        
        current_user = request.current_user
        data = request.get_json() or {}
        message = data.get('message')
        
        # Approve placement
        placement_model = Placement()
        placement, error = placement_model.approve_placement(
            placement_id=placement_id,
            admin_user_id=str(current_user['_id']),
            message=message
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        if not placement:
            return jsonify({'error': 'Placement not found'}), 404
        
        # Send approval email notification
        try:
            logger.info(f"📧 Preparing to send placement approval email for placement {placement_id}")
            
            # Get publisher email - use publisherId (camelCase)
            user_model = User()
            publisher_id = placement.get('publisherId')
            logger.info(f"📧 Publisher ID from placement: {publisher_id}")
            
            publisher = user_model.find_by_id(str(publisher_id)) if publisher_id else None
            
            logger.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get placement name
                placement_name = placement.get('name', f"Placement {placement_id}")
                
                logger.info(f"📧 Placement name: {placement_name}")
                logger.info(f"📧 Sending approval email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=placement_name,
                    status='approved',
                    reason='',
                    offer_id=str(placement.get('_id', ''))
                )
                logger.info(f"✅ Placement approval email sent to {publisher['email']} for placement {placement_name}")
            else:
                logger.warning(f"⚠️ Publisher not found or no email: {placement.get('publisherId')}")
        except Exception as e:
            logger.error(f"❌ Failed to send placement approval email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Placement approved successfully',
            'placement': {
                'id': str(placement['_id']),
                'approvalStatus': placement['approvalStatus'],
                'status': placement['status'],
                'reviewMessage': placement['reviewMessage']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/admin/<placement_id>/reject', methods=['POST'])
@token_required
@subadmin_or_admin_required('placement-approval')
def reject_placement_admin(placement_id):
    """Reject a placement"""
    try:
        from models.user import User
        from services.email_service import get_email_service
        
        current_user = request.current_user
        data = request.get_json()
        
        if not data or not data.get('reason'):
            return jsonify({'error': 'Rejection reason is required'}), 400
        
        reason = data['reason']
        message = data.get('message')
        
        # Reject placement
        placement_model = Placement()
        placement, error = placement_model.reject_placement(
            placement_id=placement_id,
            admin_user_id=str(current_user['_id']),
            reason=reason,
            message=message
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        if not placement:
            return jsonify({'error': 'Placement not found'}), 404
        
        # Send rejection email notification
        try:
            logger.info(f"📧 Preparing to send placement rejection email for placement {placement_id}")
            
            # Get publisher email - use publisherId (camelCase)
            user_model = User()
            publisher_id = placement.get('publisherId')
            logger.info(f"📧 Publisher ID from placement: {publisher_id}")
            
            publisher = user_model.find_by_id(str(publisher_id)) if publisher_id else None
            
            logger.info(f"📧 Publisher found: {publisher.get('username') if publisher else 'NOT FOUND'}")
            
            if publisher and publisher.get('email'):
                # Get placement name
                placement_name = placement.get('name', f"Placement {placement_id}")
                
                logger.info(f"📧 Placement name: {placement_name}")
                logger.info(f"📧 Sending rejection email to {publisher['email']}")
                
                # Send email
                email_service = get_email_service()
                email_service.send_approval_notification_async(
                    recipient_email=publisher['email'],
                    offer_name=placement_name,
                    status='rejected',
                    reason=reason,
                    offer_id=str(placement.get('_id', ''))
                )
                logger.info(f"✅ Placement rejection email sent to {publisher['email']} for placement {placement_name}")
            else:
                logger.warning(f"⚠️ Publisher not found or no email: {placement.get('publisherId')}")
        except Exception as e:
            logger.error(f"❌ Failed to send placement rejection email: {str(e)}", exc_info=True)
        
        return jsonify({
            'message': 'Placement rejected successfully',
            'placement': {
                'id': str(placement['_id']),
                'approvalStatus': placement['approvalStatus'],
                'status': placement['status'],
                'rejectionReason': placement['rejectionReason'],
                'reviewMessage': placement['reviewMessage']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting placement: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@placements_bp.route('/admin/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('placement-approval')
def get_placement_stats_admin():
    """Get placement statistics for admin dashboard"""
    try:
        placement_model = Placement()
        
        # Get counts by status
        pending_count = placement_model.get_pending_placements_count()
        
        # Get total counts (you can extend this with more stats)
        stats = {
            'pending_approval': pending_count,
            'total_placements': 0,  # You can implement this
            'approved_today': 0,    # You can implement this
            'rejected_today': 0     # You can implement this
        }
        
        return jsonify({'stats': stats}), 200
        
    except Exception as e:
        logger.error(f"Error fetching placement stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500
