from flask import Blueprint, request, jsonify, redirect
from models.link_masking import LinkMasking
from models.offer import Offer
from utils.auth import token_required
import logging
from datetime import datetime

link_masking_bp = Blueprint('link_masking', __name__)
link_masking_model = LinkMasking()
offer_model = Offer()

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

# Masked Link Routes

@link_masking_bp.route('/masked-links', methods=['POST'])
@token_required
@admin_required
def create_masked_link():
    """Create a new masked link (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['offer_id', 'target_url', 'masking_settings']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f"Field '{field}' is required"}), 400
        
        # Verify offer exists
        offer = offer_model.get_offer_by_id(data['offer_id'])
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        user = request.current_user
        masked_link, error = link_masking_model.create_masked_link(
            data['offer_id'],
            data['target_url'],
            data['masking_settings'],
            str(user['_id'])
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        # Convert ObjectId to string for JSON serialization
        masked_link['_id'] = str(masked_link['_id'])
        masked_link['domain_id'] = str(masked_link['domain_id'])
        
        return jsonify({
            'message': 'Masked link created successfully',
            'masked_link': masked_link
        }), 201
        
    except Exception as e:
        logging.error(f"Create masked link error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create masked link: {str(e)}'}), 500

@link_masking_bp.route('/masked-links', methods=['GET'])
@token_required
@admin_required
def get_masked_links():
    """Get all masked links with filtering and pagination (Admin only)"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        offer_id = request.args.get('offer_id')
        domain_id = request.args.get('domain_id')
        status = request.args.get('status')
        search = request.args.get('search')
        
        # Build filters
        filters = {}
        if offer_id:
            filters['offer_id'] = offer_id
        if domain_id:
            filters['domain_id'] = domain_id
        if status and status != 'all':
            filters['status'] = status
        if search:
            filters['search'] = search
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get masked links
        links, total = link_masking_model.get_masked_links(filters, skip, per_page)
        
        # Convert ObjectIds to strings
        for link in links:
            link['_id'] = str(link['_id'])
            link['domain_id'] = str(link['domain_id'])
        
        return jsonify({
            'masked_links': links,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get masked links error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get masked links: {str(e)}'}), 500

@link_masking_bp.route('/masked-links/<link_id>', methods=['PUT'])
@token_required
@admin_required
def update_masked_link(link_id):
    """Update a masked link (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user = request.current_user
        success, error = link_masking_model.update_masked_link(link_id, data, str(user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update masked link'}), 400
        
        return jsonify({'message': 'Masked link updated successfully'}), 200
        
    except Exception as e:
        logging.error(f"Update masked link error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update masked link: {str(e)}'}), 500

@link_masking_bp.route('/masked-links/<link_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_masked_link(link_id):
    """Delete a masked link (Admin only)"""
    try:
        success = link_masking_model.delete_masked_link(link_id)
        
        if not success:
            return jsonify({'error': 'Masked link not found or already deleted'}), 404
        
        return jsonify({'message': 'Masked link deleted successfully'}), 200
        
    except Exception as e:
        logging.error(f"Delete masked link error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete masked link: {str(e)}'}), 500

# Domain Management Routes

@link_masking_bp.route('/domains', methods=['POST'])
@token_required
@admin_required
def create_masking_domain():
    """Create a new masking domain (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if not data.get('domain'):
            return jsonify({'error': 'Domain is required'}), 400
        
        user = request.current_user
        domain, error = link_masking_model.create_masking_domain(data, str(user['_id']))
        
        if error:
            return jsonify({'error': error}), 400
        
        # Convert ObjectId to string for JSON serialization
        domain['_id'] = str(domain['_id'])
        
        return jsonify({
            'message': 'Masking domain created successfully',
            'domain': domain
        }), 201
        
    except Exception as e:
        logging.error(f"Create masking domain error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create masking domain: {str(e)}'}), 500

@link_masking_bp.route('/domains', methods=['GET'])
@token_required
@admin_required
def get_masking_domains():
    """Get all masking domains (Admin only)"""
    try:
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        domains = link_masking_model.get_masking_domains(active_only)
        
        # Convert ObjectIds to strings
        for domain in domains:
            domain['_id'] = str(domain['_id'])
        
        return jsonify({'domains': domains}), 200
        
    except Exception as e:
        logging.error(f"Get masking domains error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get masking domains: {str(e)}'}), 500

@link_masking_bp.route('/domains/<domain_id>', methods=['PUT'])
@token_required
@admin_required
def update_masking_domain(domain_id):
    """Update a masking domain (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user = request.current_user
        success, error = link_masking_model.update_masking_domain(domain_id, data, str(user['_id']))
        
        if not success:
            return jsonify({'error': error or 'Failed to update masking domain'}), 400
        
        return jsonify({'message': 'Masking domain updated successfully'}), 200
        
    except Exception as e:
        logging.error(f"Update masking domain error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update masking domain: {str(e)}'}), 500

@link_masking_bp.route('/domains/<domain_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_masking_domain(domain_id):
    """Delete a masking domain (Admin only)"""
    try:
        success = link_masking_model.delete_masking_domain(domain_id)
        
        if not success:
            return jsonify({'error': 'Masking domain not found or already deleted'}), 404
        
        return jsonify({'message': 'Masking domain deleted successfully'}), 200
        
    except Exception as e:
        logging.error(f"Delete masking domain error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete masking domain: {str(e)}'}), 500

# Public Redirect Route (No authentication required)

@link_masking_bp.route('/<domain_name>/<short_code>')
def redirect_masked_link(domain_name, short_code):
    """Public redirect endpoint for masked links"""
    try:
        # Get masked link
        masked_link = link_masking_model.get_masked_link_by_code(short_code, domain_name)
        
        if not masked_link:
            return jsonify({'error': 'Link not found'}), 404
        
        # Check if in preview mode
        if masked_link.get('preview_mode'):
            return jsonify({
                'preview': True,
                'offer_id': masked_link['offer_id'],
                'target_url': masked_link['target_url'],
                'short_code': short_code,
                'domain': domain_name,
                'click_count': masked_link['click_count'],
                'created_at': masked_link['created_at']
            }), 200
        
        # Handle auto-rotation
        target_url = masked_link['target_url']
        if masked_link.get('auto_rotation') and masked_link.get('rotation_urls'):
            import random
            all_urls = [target_url] + masked_link['rotation_urls']
            target_url = random.choice(all_urls)
        
        # Append SubID if enabled
        if masked_link.get('subid_append'):
            subid = request.args.get('subid') or request.args.get('s1') or request.args.get('clickid')
            if subid:
                separator = '&' if '?' in target_url else '?'
                target_url = f"{target_url}{separator}subid={subid}"
        
        # Track click with analytics
        try:
            from models.analytics import Analytics
            analytics_model = Analytics()
            
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
            user_agent = request.headers.get('User-Agent', '')
            referrer = request.headers.get('Referer', '')
            
            # Track click in analytics system
            click_data = {
                'offer_id': masked_link['offer_id'],
                'masked_link_id': str(masked_link['_id']),
                'ip_address': client_ip,
                'user_agent': user_agent,
                'referrer': referrer,
                'subid': subid if masked_link.get('subid_append') else None
            }
            
            analytics_model.track_click(click_data)
            
            # Also increment the simple counter
            link_masking_model.increment_click_count(masked_link['_id'], True)
            
        except Exception as e:
            logging.warning(f"Failed to track click: {str(e)}")
        
        # Perform redirect
        redirect_type = int(masked_link.get('redirect_type', 302))
        return redirect(target_url, code=redirect_type)
        
    except Exception as e:
        logging.error(f"Redirect error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Redirect failed'}), 500

# Utility Routes

@link_masking_bp.route('/generate-preview/<offer_id>')
@token_required
@admin_required
def generate_preview_link(offer_id):
    """Generate a preview link for an offer (Admin only)"""
    try:
        # Get offer
        offer = offer_model.get_offer_by_id(offer_id)
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Get default domain
        domains = link_masking_model.get_masking_domains()
        if not domains:
            return jsonify({'error': 'No masking domains available'}), 400
        
        default_domain = domains[0]
        
        # Create preview settings
        masking_settings = {
            'domain_id': str(default_domain['_id']),
            'preview_mode': True,
            'redirect_type': '302',
            'subid_append': True,
            'code_length': 8
        }
        
        user = request.current_user
        masked_link, error = link_masking_model.create_masked_link(
            offer_id,
            offer['target_url'],
            masking_settings,
            str(user['_id'])
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'preview_url': masked_link['masked_url'],
            'short_code': masked_link['short_code'],
            'domain': masked_link['domain_name']
        }), 200
        
    except Exception as e:
        logging.error(f"Generate preview link error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate preview link: {str(e)}'}), 500
