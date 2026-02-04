"""
Traffic Sources API Routes

Provides endpoints for traffic source rule management.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, subadmin_or_admin_required
from services.traffic_source_rules_service import (
    TrafficSourceRulesService,
    get_all_categories,
    get_all_sources,
    CATEGORY_TRAFFIC_RULES
)
import logging

traffic_sources_bp = Blueprint('traffic_sources', __name__)


@traffic_sources_bp.route('/traffic-sources/categories', methods=['GET'])
@token_required
def get_categories():
    """Get all valid offer categories with their traffic source defaults."""
    try:
        categories = get_all_categories()
        
        # Build response with category details
        category_details = []
        for category in categories:
            rules = TrafficSourceRulesService.get_default_rules_for_category(category)
            category_details.append({
                'name': category,
                'allowed_count': len(rules['allowed']),
                'risky_count': len(rules['risky']),
                'disallowed_count': len(rules['disallowed'])
            })
        
        return jsonify({
            'categories': categories,
            'category_details': category_details
        })
        
    except Exception as e:
        logging.error(f"Get categories error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get categories: {str(e)}'}), 500


@traffic_sources_bp.route('/traffic-sources/all', methods=['GET'])
@token_required
def get_all_traffic_sources():
    """Get all available traffic sources."""
    try:
        sources = get_all_sources()
        
        return jsonify({
            'traffic_sources': sources,
            'total': len(sources)
        })
        
    except Exception as e:
        logging.error(f"Get traffic sources error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get traffic sources: {str(e)}'}), 500


@traffic_sources_bp.route('/traffic-sources/rules/<category>', methods=['GET'])
@token_required
def get_category_rules(category: str):
    """
    Get traffic source rules for a specific category.
    
    Query params:
        - country: Optional ISO country code for country-specific adjustments
    """
    try:
        country = request.args.get('country')
        
        rules = TrafficSourceRulesService.generate_traffic_sources(
            category=category,
            country=country
        )
        
        return jsonify({
            'category': category,
            'country': country,
            'rules': rules,
            'has_country_adjustments': country is not None
        })
        
    except Exception as e:
        logging.error(f"Get category rules error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get category rules: {str(e)}'}), 500


@traffic_sources_bp.route('/traffic-sources/generate', methods=['POST'])
@token_required
def generate_traffic_sources():
    """
    Generate traffic sources for an offer.
    
    Request body:
        - category: Required - offer category/vertical
        - country: Optional - ISO country code
        - overrides: Optional - manual override rules
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        category = data.get('category') or data.get('vertical')
        if not category:
            return jsonify({'error': 'Category is required'}), 400
        
        country = data.get('country')
        overrides = data.get('overrides')
        
        rules = TrafficSourceRulesService.generate_traffic_sources(
            category=category,
            country=country,
            overrides=overrides
        )
        
        return jsonify({
            'category': category,
            'country': country,
            'has_overrides': overrides is not None,
            'rules': rules
        })
        
    except Exception as e:
        logging.error(f"Generate traffic sources error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate traffic sources: {str(e)}'}), 500


@traffic_sources_bp.route('/traffic-sources/validate', methods=['POST'])
@token_required
@subadmin_or_admin_required('offers')
def validate_traffic_sources():
    """
    Validate traffic source configuration.
    
    Request body:
        - allowed: List of allowed sources
        - risky: List of risky sources
        - disallowed: List of disallowed sources
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        allowed = data.get('allowed', [])
        risky = data.get('risky', [])
        disallowed = data.get('disallowed', [])
        
        is_valid, error = TrafficSourceRulesService.validate_traffic_sources(
            allowed=allowed,
            risky=risky,
            disallowed=disallowed
        )
        
        return jsonify({
            'valid': is_valid,
            'error': error
        })
        
    except Exception as e:
        logging.error(f"Validate traffic sources error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to validate traffic sources: {str(e)}'}), 500


@traffic_sources_bp.route('/traffic-sources/all-rules', methods=['GET'])
@token_required
def get_all_category_rules():
    """Get traffic source rules for all categories."""
    try:
        all_rules = {}
        
        for category in get_all_categories():
            all_rules[category] = TrafficSourceRulesService.get_default_rules_for_category(category)
        
        return jsonify({
            'rules': all_rules,
            'categories': list(all_rules.keys())
        })
        
    except Exception as e:
        logging.error(f"Get all category rules error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get all category rules: {str(e)}'}), 500
