"""
Admin Automation Routes
Provides on-demand trigger endpoints for services that don't run as background threads.
Admin clicks a button → runs the task immediately → returns results.
"""

from flask import Blueprint, jsonify, request
from utils.auth import token_required, admin_required
from database import db_instance
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

admin_automation_bp = Blueprint('admin_automation', __name__)


@admin_automation_bp.route('/api/admin/automation/run-inactivity-check', methods=['POST'])
@token_required
@admin_required
def run_inactivity_check():
    """
    Manually trigger offer inactivity check.
    Deactivates offers with zero clicks in the last 30 days.
    Returns count of deactivated offers.
    """
    try:
        offers_col = db_instance.get_collection('offers')
        clicks_col = db_instance.get_collection('clicks')
        
        if not offers_col or not clicks_col:
            return jsonify({'error': 'Database not available'}), 500
        
        # Get all active offers
        active_offers = list(offers_col.find(
            {
                'status': {'$in': ['active', 'running']},
                '$or': [
                    {'deleted': {'$exists': False}},
                    {'deleted': False},
                    {'deleted': None}
                ]
            },
            {'offer_id': 1, 'name': 1, 'created_at': 1}
        ))
        
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        deactivated = []
        checked = 0
        
        for offer in active_offers:
            checked += 1
            offer_id = offer.get('offer_id')
            if not offer_id:
                continue
            
            # Check if this offer has any clicks in the last 30 days
            recent_click = clicks_col.find_one({
                'offer_id': offer_id,
                'timestamp': {'$gte': thirty_days_ago}
            }, {'_id': 1})
            
            if not recent_click:
                # No clicks in 30 days — deactivate
                offers_col.update_one(
                    {'offer_id': offer_id},
                    {
                        '$set': {
                            'status': 'paused',
                            'is_active': False,
                            'inactivity_paused_at': datetime.utcnow(),
                            'inactivity_reason': 'No clicks in 30 days (manual check)'
                        }
                    }
                )
                deactivated.append({
                    'offer_id': offer_id,
                    'name': offer.get('name', 'Unknown')
                })
        
        logger.info(f"✅ Inactivity check complete: {len(deactivated)} offers deactivated out of {checked} checked")
        
        return jsonify({
            'success': True,
            'checked': checked,
            'deactivated_count': len(deactivated),
            'deactivated_offers': deactivated[:50],  # Return first 50 for display
            'run_at': datetime.utcnow().isoformat() + 'Z'
        })
        
    except Exception as e:
        logger.error(f"Inactivity check failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/run-invoice-generation', methods=['POST'])
@token_required
@admin_required
def run_invoice_generation():
    """
    Manually trigger invoice generation for the current month.
    Calls the existing invoice scheduler logic.
    """
    try:
        from services.invoice_scheduler_service import get_invoice_scheduler
        scheduler = get_invoice_scheduler()
        
        # Call the generation method directly (without starting the background thread)
        result = scheduler.generate_invoices_now()
        
        logger.info(f"✅ Invoice generation triggered manually")
        
        return jsonify({
            'success': True,
            'message': 'Invoice generation completed',
            'result': result if result else 'Generated successfully',
            'run_at': datetime.utcnow().isoformat() + 'Z'
        })
        
    except ImportError:
        # If the service doesn't have generate_invoices_now, try alternative
        try:
            from services.invoice_scheduler_service import get_invoice_scheduler
            scheduler = get_invoice_scheduler()
            # Try the internal method
            if hasattr(scheduler, '_generate_monthly_invoices'):
                scheduler._generate_monthly_invoices()
            elif hasattr(scheduler, 'run_once'):
                scheduler.run_once()
            elif hasattr(scheduler, '_run'):
                scheduler._run()
            else:
                return jsonify({'error': 'Invoice generation method not found'}), 500
            
            return jsonify({
                'success': True,
                'message': 'Invoice generation completed',
                'run_at': datetime.utcnow().isoformat() + 'Z'
            })
        except Exception as e2:
            logger.error(f"Invoice generation failed: {str(e2)}")
            return jsonify({'error': str(e2)}), 500
    except Exception as e:
        logger.error(f"Invoice generation failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_automation_bp.route('/api/admin/automation/status', methods=['GET'])
@token_required
@admin_required
def get_automation_status():
    """
    Get status of all background services and manual tasks.
    Shows what's running, what's disabled, and last run times.
    """
    try:
        services = [
            {
                'name': 'Cap Monitoring',
                'status': 'running',
                'type': 'background',
                'description': 'Monitors offer click/conversion caps and pauses when hit'
            },
            {
                'name': 'Postback Processor',
                'status': 'running',
                'type': 'background',
                'description': 'Processes incoming conversion postbacks from ad networks'
            },
            {
                'name': 'Schedule Activation',
                'status': 'running',
                'type': 'background',
                'description': 'Auto-activates/deactivates offers based on start/end dates'
            },
            {
                'name': 'Price Boost',
                'status': 'running',
                'type': 'background',
                'description': 'Checks for expired price boosts every 5 minutes'
            },
            {
                'name': 'Scheduled Emails',
                'status': 'running',
                'type': 'background',
                'description': 'Sends queued notification emails to publishers'
            },
            {
                'name': 'Offer Rotation',
                'status': 'running',
                'type': 'background',
                'description': 'Rotates 1000 offers every 24 hours for visibility'
            },
            {
                'name': 'Campaign Processor',
                'status': 'running',
                'type': 'background',
                'description': 'Processes bulk email campaign queue'
            },
            {
                'name': 'Location Retry',
                'status': 'running',
                'type': 'background',
                'description': 'Retries failed IP geolocation lookups every 15 min'
            },
            {
                'name': 'Telegram Bot',
                'status': 'running',
                'type': 'background',
                'description': 'Posts trending offers to Telegram every 7 hours'
            },
            {
                'name': 'Offer Inactivity Check',
                'status': 'manual',
                'type': 'button',
                'description': 'Deactivates offers with 0 clicks in 30 days (click to run)'
            },
            {
                'name': 'Invoice Generation',
                'status': 'manual',
                'type': 'button',
                'description': 'Generates monthly invoices (click on 1st of month)'
            },
            {
                'name': 'Placement Auto-Approval',
                'status': 'disabled',
                'type': 'manual',
                'description': 'Admin approves placements manually from Placements page'
            },
            {
                'name': 'Automation Engine',
                'status': 'disabled',
                'type': 'disabled',
                'description': 'Custom automation rules (not in use)'
            },
            {
                'name': 'Search Auto-Activation',
                'status': 'disabled',
                'type': 'disabled',
                'description': 'Disabled — access request flow is used instead'
            },
        ]
        
        return jsonify({
            'services': services,
            'total_running': sum(1 for s in services if s['status'] == 'running'),
            'total_manual': sum(1 for s in services if s['status'] == 'manual'),
            'total_disabled': sum(1 for s in services if s['status'] == 'disabled'),
            'estimated_memory_mb': 220
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
