"""
Test routes for Schedule + Smart Rules functionality
These routes don't require authentication for testing purposes
"""

from flask import Blueprint, request, jsonify
from models.offer_extended import OfferExtended
from utils.frontend_mapping import FrontendDatabaseMapper
from utils.json_serializer import safe_json_response
import logging
from datetime import datetime

test_schedule_rules_bp = Blueprint('test_schedule_rules', __name__)
extended_model = OfferExtended()

@test_schedule_rules_bp.route('/test/schedule-rules/field-mapping', methods=['POST'])
def test_field_mapping():
    """Test frontend to database field mapping"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        logging.info("🧪 TEST - Original data: %s", data)
        
        # Apply field mapping
        mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
        
        logging.info("🧪 TEST - Mapped data: %s", mapped_data)
        
        return safe_json_response({
            'message': 'Field mapping test successful',
            'original_data': data,
            'mapped_data': mapped_data
        })
        
    except Exception as e:
        logging.error(f"Field mapping test error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Field mapping test failed: {str(e)}'}), 500

@test_schedule_rules_bp.route('/test/schedule-rules/validation', methods=['POST'])
def test_validation():
    """Test schedule and smart rules validation"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        results = {}
        
        # Test schedule validation if present
        if 'schedule' in data:
            schedule_valid, schedule_error = extended_model._validate_schedule(data['schedule'])
            results['schedule_validation'] = {
                'valid': schedule_valid,
                'error': schedule_error
            }
        
        # Test smart rules validation if present
        if 'smartRules' in data:
            rules_valid, rules_error = extended_model._validate_smart_rules(data['smartRules'])
            results['smart_rules_validation'] = {
                'valid': rules_valid,
                'error': rules_error
            }
        
        return safe_json_response({
            'message': 'Validation test completed',
            'results': results
        })
        
    except Exception as e:
        logging.error(f"Validation test error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Validation test failed: {str(e)}'}), 500

@test_schedule_rules_bp.route('/test/schedule-rules/processing', methods=['POST'])
def test_data_processing():
    """Test data processing functions"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        results = {}
        
        # Test schedule processing if present
        if 'schedule' in data:
            processed_schedule = extended_model._process_schedule_data(data['schedule'])
            results['processed_schedule'] = processed_schedule
        
        # Test smart rules processing if present
        if 'smartRules' in data:
            processed_rules = extended_model._process_smart_rules_data(data['smartRules'])
            results['processed_smart_rules'] = processed_rules
        
        return safe_json_response({
            'message': 'Data processing test completed',
            'results': results
        })
        
    except Exception as e:
        logging.error(f"Data processing test error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Data processing test failed: {str(e)}'}), 500

@test_schedule_rules_bp.route('/test/schedule-rules/full-flow', methods=['POST'])
def test_full_flow():
    """Test complete data flow from frontend format to database format"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        logging.info("🧪 FULL FLOW TEST - Original data: %s", data)
        
        # Step 1: Field mapping
        mapped_data = FrontendDatabaseMapper.map_frontend_to_database(data)
        logging.info("🧪 FULL FLOW TEST - After mapping: %s", mapped_data)
        
        # Step 2: Validation
        validation_results = {}
        
        if 'schedule' in mapped_data:
            schedule_valid, schedule_error = extended_model._validate_schedule(mapped_data['schedule'])
            validation_results['schedule'] = {
                'valid': schedule_valid,
                'error': schedule_error
            }
        
        if 'smartRules' in mapped_data:
            rules_valid, rules_error = extended_model._validate_smart_rules(mapped_data['smartRules'])
            validation_results['smart_rules'] = {
                'valid': rules_valid,
                'error': rules_error
            }
        
        # Step 3: Processing
        processing_results = {}
        
        if 'schedule' in mapped_data:
            processed_schedule = extended_model._process_schedule_data(mapped_data['schedule'])
            processing_results['schedule'] = processed_schedule
        
        if 'smartRules' in mapped_data:
            processed_rules = extended_model._process_smart_rules_data(mapped_data['smartRules'])
            processing_results['smart_rules'] = processed_rules
        
        return safe_json_response({
            'message': 'Full flow test completed successfully',
            'steps': {
                'original_data': data,
                'mapped_data': mapped_data,
                'validation_results': validation_results,
                'processing_results': processing_results
            }
        })
        
    except Exception as e:
        logging.error(f"Full flow test error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Full flow test failed: {str(e)}'}), 500

@test_schedule_rules_bp.route('/test/schedule-rules/database-connection', methods=['GET'])
def test_database_connection():
    """Test database connection"""
    try:
        connection_status = extended_model._check_db_connection()
        
        return safe_json_response({
            'message': 'Database connection test completed',
            'connected': connection_status
        })
        
    except Exception as e:
        logging.error(f"Database connection test error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Database connection test failed: {str(e)}'}), 500

@test_schedule_rules_bp.route('/test/schedule-rules/sample-data', methods=['GET'])
def get_sample_data():
    """Get sample data for testing"""
    sample_data = {
        "name": "Test Offer - Schedule + Rules",
        "description": "Sample offer for testing schedule and smart rules",
        "status": "pending",
        "countries": ["US", "CA"],
        "payout": 25.50,
        "network": "TestNetwork",
        "target_url": "https://example.com/landing",
        "schedule": {
            "startDate": "2024-11-01",
            "endDate": "2024-12-31",
            "startTime": "09:00",
            "endTime": "17:00",
            "isRecurring": True,
            "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "status": "Active"
        },
        "smartRules": [
            {
                "type": "GEO",
                "destinationUrl": "https://example.com/us-landing",
                "geo": ["US"],
                "splitPercentage": 70,
                "cap": 300,
                "priority": 1,
                "active": True
            },
            {
                "type": "Backup",
                "destinationUrl": "https://example.com/backup-landing",
                "geo": ["US", "CA"],
                "splitPercentage": 100,
                "cap": 0,
                "priority": 99,
                "active": True
            }
        ]
    }
    
    return safe_json_response({
        'message': 'Sample data for testing',
        'sample_data': sample_data
    })
