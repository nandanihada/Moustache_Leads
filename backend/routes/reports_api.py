"""
Reports API Routes
Handles generation and retrieval of tracking reports for admin dashboard
"""

from flask import Blueprint, request, jsonify
from models.reports import Reports
from models.tracking_events import TrackingEvents
from utils.auth import token_required
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

reports_api_bp = Blueprint('reports_api', __name__)
reports_model = Reports()
tracking_events = TrackingEvents()

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

@reports_api_bp.route('/reports/generate', methods=['POST'])
@token_required
@admin_required
def generate_report():
    """
    Generate a new tracking report
    """
    try:
        data = request.get_json() or {}
        
        # Parse date range
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        report_type = data.get('type', 'custom')
        
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'start_date and end_date are required'}), 400
        
        try:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
        
        if start_date >= end_date:
            return jsonify({'error': 'start_date must be before end_date'}), 400
        
        # Generate report
        date_range = {'start': start_date, 'end': end_date}
        report = reports_model.generate_tracking_report(date_range, report_type)
        
        if 'error' in report:
            return jsonify({'error': report['error']}), 500
        
        return jsonify({
            'success': True,
            'message': 'Report generated successfully',
            'report': report
        }), 201
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports', methods=['GET'])
@token_required
@admin_required
def get_reports():
    """
    Get list of saved reports
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 100)
        
        reports = reports_model.get_saved_reports(limit=limit)
        
        return jsonify({
            'success': True,
            'reports': reports,
            'count': len(reports)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting reports: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/<report_id>', methods=['GET'])
@token_required
@admin_required
def get_report(report_id):
    """
    Get specific report by ID
    """
    try:
        report = reports_model.get_report_by_id(report_id)
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        return jsonify({
            'success': True,
            'report': report
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting report: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/<report_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_report(report_id):
    """
    Delete a report
    """
    try:
        success = reports_model.delete_report(report_id)
        
        if not success:
            return jsonify({'error': 'Report not found or could not be deleted'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Report deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting report: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/stats/realtime', methods=['GET'])
@token_required
@admin_required
def get_realtime_stats():
    """
    Get real-time tracking statistics for dashboard
    """
    try:
        stats = reports_model.get_real_time_stats()
        
        if 'error' in stats:
            return jsonify({'error': stats['error']}), 500
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting real-time stats: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/quick/<report_type>', methods=['GET'])
@token_required
@admin_required
def generate_quick_report(report_type):
    """
    Generate quick reports for common time periods
    """
    try:
        end_date = datetime.utcnow()
        
        # Define time periods
        if report_type == 'today':
            start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif report_type == 'yesterday':
            start_date = (end_date - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif report_type == 'last_7_days':
            start_date = end_date - timedelta(days=7)
        elif report_type == 'last_30_days':
            start_date = end_date - timedelta(days=30)
        elif report_type == 'this_month':
            start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif report_type == 'last_month':
            # First day of last month
            first_day_this_month = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = first_day_this_month
            if first_day_this_month.month == 1:
                start_date = first_day_this_month.replace(year=first_day_this_month.year-1, month=12)
            else:
                start_date = first_day_this_month.replace(month=first_day_this_month.month-1)
        else:
            return jsonify({'error': f'Invalid report type: {report_type}'}), 400
        
        # Generate report
        date_range = {'start': start_date, 'end': end_date}
        report = reports_model.generate_tracking_report(date_range, report_type)
        
        if 'error' in report:
            return jsonify({'error': report['error']}), 500
        
        return jsonify({
            'success': True,
            'message': f'Quick report generated for {report_type}',
            'report': report
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating quick report: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/dashboard/summary', methods=['GET'])
@token_required
@admin_required
def get_dashboard_summary():
    """
    Get summary data for admin dashboard
    """
    try:
        # Get real-time stats
        realtime_stats = reports_model.get_real_time_stats()
        
        # Get recent event stats
        event_stats = tracking_events.get_event_stats(hours=24)
        
        # Combine data
        summary = {
            'realtime_stats': realtime_stats,
            'event_stats': event_stats,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return jsonify({
            'success': True,
            'summary': summary
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@reports_api_bp.route('/reports/export/<report_id>', methods=['GET'])
@token_required
@admin_required
def export_report(report_id):
    """
    Export report data (CSV format)
    """
    try:
        report = reports_model.get_report_by_id(report_id)
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # For now, return JSON data that frontend can convert to CSV
        # In a full implementation, you might generate actual CSV here
        export_data = {
            'report_id': report_id,
            'generated_at': report.get('generated_at'),
            'date_range': report.get('date_range'),
            'summary_metrics': report.get('summary_metrics'),
            'top_offers': report.get('top_offers', []),
            'top_affiliates': report.get('top_affiliates', []),
            'daily_breakdown': report.get('daily_breakdown', []),
            'country_breakdown': report.get('country_breakdown', [])
        }
        
        return jsonify({
            'success': True,
            'export_data': export_data,
            'format': 'json'
        }), 200
        
    except Exception as e:
        logger.error(f"Error exporting report: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500
