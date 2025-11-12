"""
Create a temporary test endpoint without authentication
"""

from flask import Flask, jsonify, request
from models.user_reports import UserReports
from datetime import datetime
import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)

@app.route('/test-performance', methods=['GET'])
def test_performance_report():
    """
    Test performance report without authentication
    """
    try:
        # Get parameters
        start_date = request.args.get('start_date', '2025-11-01')
        end_date = request.args.get('end_date', '2025-11-15')
        group_by = request.args.get('group_by', 'date,offer_id').split(',')
        
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"📊 Group by: {group_by}")
        
        # Convert dates
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        
        # Create reports instance
        user_reports = UserReports()
        
        # Generate report (using test user)
        date_range = {'start': start_dt, 'end': end_dt}
        report = user_reports.get_performance_report(
            user_id='test-user',
            date_range=date_range,
            group_by=group_by
        )
        
        print(f"✅ Report generated: {len(report.get('data', []))} rows")
        
        # Return the same format as the real API
        return jsonify({
            'success': True,
            'report': report
        })
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/test-data-check', methods=['GET'])
def test_data_check():
    """
    Check what data exists in database
    """
    try:
        from database.db_connection import DatabaseConnection
        db_instance = DatabaseConnection()
        
        clicks_count = db_instance.get_collection('clicks').count_documents({})
        offers_count = db_instance.get_collection('offers').count_documents({})
        conversions_count = db_instance.get_collection('conversions').count_documents({})
        
        # Get sample data
        sample_click = db_instance.get_collection('clicks').find_one()
        sample_offer = db_instance.get_collection('offers').find_one()
        
        return jsonify({
            'counts': {
                'clicks': clicks_count,
                'offers': offers_count,
                'conversions': conversions_count
            },
            'sample_click': {
                'date': str(sample_click.get('click_time')) if sample_click else None,
                'country': sample_click.get('country') if sample_click else None,
                'browser': sample_click.get('browser') if sample_click else None,
                'creative': sample_click.get('creative') if sample_click else None,
            },
            'sample_offer': {
                'name': sample_offer.get('name') if sample_offer else None,
                'ad_group': sample_offer.get('ad_group') if sample_offer else None,
                'goal': sample_offer.get('goal') if sample_offer else None,
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting test server on http://localhost:5001")
    print("📊 Test endpoints:")
    print("   GET /test-performance?start_date=2025-11-01&end_date=2025-11-15&group_by=date,offer_id")
    print("   GET /test-data-check")
    app.run(host='0.0.0.0', port=5001, debug=True)
