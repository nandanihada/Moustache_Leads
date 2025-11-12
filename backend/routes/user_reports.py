"""
User Reports API Routes
Publisher-facing endpoints for performance and conversion reports
"""

from flask import Blueprint, request, jsonify
from models.user_reports import UserReports
from utils.auth import token_required
from datetime import datetime, timedelta
import logging
import csv
import io

logger = logging.getLogger(__name__)

user_reports_bp = Blueprint('user_reports', __name__)
user_reports_model = UserReports()

@user_reports_bp.route('/reports/performance', methods=['GET'])
# @token_required  # Temporarily disabled for testing
def get_performance_report():
    """
    Get performance report for current user
    Supports grouping by date, offer, country, sub_ids
    """
    try:
        # user = request.current_user  # Temporarily disabled for testing
        user_id = 'test-user'  # Use test user for now
        
        # Parse date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 7 days
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
        else:
            try:
                # Parse dates and set to start/end of day
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to start of day
                if len(start_date_str) == 10:  # YYYY-MM-DD format
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to END of day
                if len(end_date_str) == 10:  # YYYY-MM-DD format
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format'}), 400
        
        # Limit date range to 90 days for performance
        if (end_date - start_date).days > 90:
            return jsonify({'error': 'Date range cannot exceed 90 days'}), 400
        
        # Parse filters
        filters = {}
        if request.args.get('offer_id'):
            offer_ids = request.args.get('offer_id').split(',')
            filters['offer_id'] = offer_ids
        
        if request.args.get('country'):
            countries = request.args.get('country').split(',')
            filters['country'] = countries
        
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        
        # Sub ID filters
        for i in range(1, 6):
            sub_key = f'sub_id{i}'
            if request.args.get(sub_key):
                filters[sub_key] = request.args.get(sub_key)
        
        # Parse group_by
        group_by_str = request.args.get('group_by', 'date')
        group_by = group_by_str.split(',') if group_by_str else ['date']
        
        # Parse pagination
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        pagination = {'page': page, 'per_page': per_page}
        
        # Parse sorting
        sort_field = request.args.get('sort_field', 'date')
        sort_order = request.args.get('sort_order', 'desc')
        sort = {'field': sort_field, 'order': sort_order}
        
        # Generate report
        date_range = {'start': start_date, 'end': end_date}
        report = user_reports_model.get_performance_report(
            user_id=user_id,
            date_range=date_range,
            filters=filters,
            group_by=group_by,
            pagination=pagination,
            sort=sort
        )
        
        if 'error' in report:
            return jsonify({'error': report['error']}), 500
        
        return jsonify({
            'success': True,
            'report': report
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_performance_report: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@user_reports_bp.route('/reports/conversions', methods=['GET'])
# @token_required  # Temporarily disabled for testing
def get_conversion_report():
    """
    Get conversion report for current user
    Shows individual conversion records
    """
    try:
        # user = request.current_user  # Temporarily disabled for testing
        user_id = 'test-user'  # Use test user for now
        
        # Parse date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to today
            end_date = datetime.utcnow()
            start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            try:
                # Parse dates and set to start/end of day
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to start of day
                if len(start_date_str) == 10:  # YYYY-MM-DD format
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to END of day
                if len(end_date_str) == 10:  # YYYY-MM-DD format
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format'}), 400
        
        # Limit date range to 31 days
        if (end_date - start_date).days > 31:
            return jsonify({'error': 'Date range cannot exceed 31 days'}), 400
        
        # Parse filters
        filters = {}
        if request.args.get('offer_id'):
            filters['offer_id'] = request.args.get('offer_id')
        
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        
        if request.args.get('country'):
            filters['country'] = request.args.get('country')
        
        if request.args.get('transaction_id'):
            filters['transaction_id'] = request.args.get('transaction_id')
        
        # Parse pagination
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        pagination = {'page': page, 'per_page': per_page}
        
        # Generate report
        date_range = {'start': start_date, 'end': end_date}
        report = user_reports_model.get_conversion_report(
            user_id=user_id,
            date_range=date_range,
            filters=filters,
            pagination=pagination
        )
        
        if 'error' in report:
            return jsonify({'error': report['error']}), 500
        
        return jsonify({
            'success': True,
            'report': report
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_conversion_report: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@user_reports_bp.route('/reports/chart-data', methods=['GET'])
@token_required
def get_chart_data():
    """
    Get time-series data for charts
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        # Parse date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 7 days
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
        else:
            try:
                # Parse dates and set to start/end of day
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to start of day
                if len(start_date_str) == 10:  # YYYY-MM-DD format
                    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                # If only date provided (no time), set to END of day
                if len(end_date_str) == 10:  # YYYY-MM-DD format
                    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                return jsonify({'error': 'Invalid date format'}), 400
        
        # Parse metric and granularity
        metric = request.args.get('metric', 'conversions')  # clicks, conversions, revenue
        granularity = request.args.get('granularity', 'day')  # hour, day, week, month
        
        # Parse filters
        filters = {}
        if request.args.get('offer_id'):
            filters['offer_id'] = request.args.get('offer_id')
        
        # Generate chart data
        date_range = {'start': start_date, 'end': end_date}
        chart_data = user_reports_model.get_chart_data(
            user_id=user_id,
            date_range=date_range,
            metric=metric,
            granularity=granularity,
            filters=filters
        )
        
        if 'error' in chart_data:
            return jsonify({'error': chart_data['error']}), 500
        
        return jsonify({
            'success': True,
            **chart_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_chart_data: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@user_reports_bp.route('/reports/summary', methods=['GET'])
@token_required
def get_summary():
    """
    Get quick summary stats for dashboard
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        # Get today's stats
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.utcnow()
        
        today_report = user_reports_model.get_performance_report(
            user_id=user_id,
            date_range={'start': today_start, 'end': today_end},
            group_by=['date'],
            pagination={'page': 1, 'per_page': 1}
        )
        
        # Get last 7 days stats
        week_start = today_end - timedelta(days=7)
        week_report = user_reports_model.get_performance_report(
            user_id=user_id,
            date_range={'start': week_start, 'end': today_end},
            group_by=['date'],
            pagination={'page': 1, 'per_page': 1}
        )
        
        # Get last 30 days stats
        month_start = today_end - timedelta(days=30)
        month_report = user_reports_model.get_performance_report(
            user_id=user_id,
            date_range={'start': month_start, 'end': today_end},
            group_by=['date'],
            pagination={'page': 1, 'per_page': 1}
        )
        
        return jsonify({
            'success': True,
            'summary': {
                'today': today_report.get('summary', {}),
                'last_7_days': week_report.get('summary', {}),
                'last_30_days': month_report.get('summary', {})
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_summary: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@user_reports_bp.route('/reports/export', methods=['GET'])
@token_required
def export_report():
    """
    Export report data as CSV
    """
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        report_type = request.args.get('type', 'performance')  # performance or conversions
        
        # Parse date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Date range required for export'}), 400
        
        try:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400
        
        # Get report data
        date_range = {'start': start_date, 'end': end_date}
        
        if report_type == 'performance':
            # Parse filters and group_by
            filters = {}
            if request.args.get('offer_id'):
                filters['offer_id'] = request.args.get('offer_id').split(',')
            
            group_by = request.args.get('group_by', 'date').split(',')
            
            report = user_reports_model.get_performance_report(
                user_id=user_id,
                date_range=date_range,
                filters=filters,
                group_by=group_by,
                pagination={'page': 1, 'per_page': 1000}  # Max 1000 for export
            )
            
            if 'error' in report:
                return jsonify({'error': report['error']}), 500
            
            # Create CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Headers
            headers = ['Date', 'Offer ID', 'Offer Name', 'Clicks', 'Unique Clicks', 
                      'Conversions', 'CR%', 'Payout', 'EPC', 'Revenue']
            writer.writerow(headers)
            
            # Data rows
            for row in report['data']:
                writer.writerow([
                    row.get('date', ''),
                    row.get('offer_id', ''),
                    row.get('offer_name', ''),
                    row.get('clicks', 0),
                    row.get('unique_clicks', 0),
                    row.get('conversions', 0),
                    row.get('cr', 0),
                    row.get('total_payout', 0),
                    row.get('epc', 0),
                    row.get('total_revenue', 0)
                ])
            
            output.seek(0)
            return output.getvalue(), 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=performance_report_{start_date.strftime("%Y%m%d")}.csv'
            }
            
        else:  # conversions
            filters = {}
            if request.args.get('offer_id'):
                filters['offer_id'] = request.args.get('offer_id')
            
            report = user_reports_model.get_conversion_report(
                user_id=user_id,
                date_range=date_range,
                filters=filters,
                pagination={'page': 1, 'per_page': 1000}
            )
            
            if 'error' in report:
                return jsonify({'error': report['error']}), 500
            
            # Create CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Headers
            headers = ['Time', 'Transaction ID', 'Offer', 'Status', 'Payout', 
                      'Currency', 'Country', 'Sub ID', 'Device', 'Browser']
            writer.writerow(headers)
            
            # Data rows
            for conv in report['conversions']:
                writer.writerow([
                    conv.get('time', ''),
                    conv.get('transaction_id', ''),
                    conv.get('offer_name', ''),
                    conv.get('status', ''),
                    conv.get('payout', 0),
                    conv.get('currency', 'USD'),
                    conv.get('country', ''),
                    conv.get('sub_ids', {}).get('sub1', ''),
                    conv.get('device_type', ''),
                    conv.get('browser', '')
                ])
            
            output.seek(0)
            return output.getvalue(), 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=conversion_report_{start_date.strftime("%Y%m%d")}.csv'
            }
        
    except Exception as e:
        logger.error(f"Error in export_report: {str(e)}", exc_info=True)
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500
