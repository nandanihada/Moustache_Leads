"""
Admin Campaigns Routes (Phase 3.8)

Campaign layer for grouping offers. Each campaign can contain multiple offers.
Provides CRUD operations and per-campaign analytics.

Collection: admin_campaigns
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, subadmin_or_admin_required
from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import secrets

logger = logging.getLogger(__name__)

admin_campaigns_bp = Blueprint('admin_campaigns', __name__)


def _col():
    return db_instance.get_collection('admin_campaigns')


def _generate_campaign_id():
    return f"CAMP-{secrets.token_hex(4).upper()}"


# ============================================================================
# CRUD
# ============================================================================

@admin_campaigns_bp.route('/api/admin/campaigns', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def list_campaigns():
    """List all campaigns with basic stats"""
    try:
        col = _col()
        if col is None:
            return jsonify({'error': 'Database not available'}), 503

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        search = request.args.get('search', '').strip()
        status = request.args.get('status')

        query = {}
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}
        if status:
            query['status'] = status

        total = col.count_documents(query)
        skip = (page - 1) * per_page
        campaigns = list(col.find(query).sort('created_at', -1).skip(skip).limit(per_page))

        # Enrich with live click/conversion counts
        clicks_col = db_instance.get_collection('clicks')
        funnel_col = db_instance.get_collection('tracking_events_funnel')

        for c in campaigns:
            c['_id'] = str(c['_id'])
            cid = c.get('campaign_id', '')
            # Click count
            if clicks_col:
                c['total_clicks'] = clicks_col.count_documents({'campaign_id': cid})
            else:
                c['total_clicks'] = 0
            # Conversion count from funnel events
            if funnel_col:
                c['total_conversions'] = funnel_col.count_documents({'campaign_id': cid})
            else:
                c['total_conversions'] = 0

        return jsonify({
            'success': True,
            'campaigns': campaigns,
            'pagination': {
                'page': page, 'per_page': per_page,
                'total': total, 'pages': (total + per_page - 1) // per_page
            }
        }), 200

    except Exception as e:
        logger.error(f"❌ Error listing campaigns: {e}")
        return jsonify({'error': str(e)}), 500


@admin_campaigns_bp.route('/api/admin/campaigns', methods=['POST'])
@token_required
@subadmin_or_admin_required('tracking')
def create_campaign():
    """Create a new campaign"""
    try:
        col = _col()
        if col is None:
            return jsonify({'error': 'Database not available'}), 503

        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'Campaign name is required'}), 400

        campaign_id = _generate_campaign_id()

        doc = {
            'campaign_id': campaign_id,
            'name': data['name'].strip(),
            'description': data.get('description', ''),
            'offer_ids': data.get('offer_ids', []),
            'status': data.get('status', 'active'),
            'budget': float(data.get('budget', 0)),
            'start_date': data.get('start_date'),
            'end_date': data.get('end_date'),
            'created_by': str(request.current_user.get('_id', '')),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        col.insert_one(doc)

        # Link offers to this campaign
        if doc['offer_ids']:
            offers_col = db_instance.get_collection('offers')
            if offers_col:
                offers_col.update_many(
                    {'offer_id': {'$in': doc['offer_ids']}},
                    {'$set': {'campaign_id': campaign_id}}
                )

        doc['_id'] = str(doc['_id']) if '_id' in doc else ''
        logger.info(f"✅ Campaign created: {campaign_id} — {doc['name']}")
        return jsonify({'success': True, 'campaign': doc}), 201

    except Exception as e:
        logger.error(f"❌ Error creating campaign: {e}")
        return jsonify({'error': str(e)}), 500


@admin_campaigns_bp.route('/api/admin/campaigns/<campaign_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_campaign(campaign_id):
    """Get a single campaign with full analytics"""
    try:
        col = _col()
        if col is None:
            return jsonify({'error': 'Database not available'}), 503

        campaign = col.find_one({'campaign_id': campaign_id})
        if not campaign:
            return jsonify({'error': 'Campaign not found'}), 404

        campaign['_id'] = str(campaign['_id'])

        # Get linked offers
        offers_col = db_instance.get_collection('offers')
        linked_offers = []
        if offers_col and campaign.get('offer_ids'):
            linked_offers = list(offers_col.find(
                {'offer_id': {'$in': campaign['offer_ids']}},
                {'offer_id': 1, 'name': 1, 'status': 1, 'payout': 1, 'network': 1, 'category': 1}
            ))
            for o in linked_offers:
                o['_id'] = str(o['_id'])

        # Get analytics
        clicks_col = db_instance.get_collection('clicks')
        funnel_col = db_instance.get_collection('tracking_events_funnel')

        analytics = {
            'total_clicks': 0, 'total_conversions': 0,
            'total_revenue': 0, 'cr': 0,
        }

        if clicks_col:
            analytics['total_clicks'] = clicks_col.count_documents({'campaign_id': campaign_id})

        if funnel_col:
            pipeline = [
                {'$match': {'campaign_id': campaign_id}},
                {'$group': {
                    '_id': '$event_type',
                    'count': {'$sum': 1},
                    'revenue': {'$sum': '$revenue'},
                }}
            ]
            for r in funnel_col.aggregate(pipeline):
                analytics['total_conversions'] += r['count']
                analytics['total_revenue'] += r.get('revenue', 0)

        if analytics['total_clicks'] > 0:
            analytics['cr'] = round((analytics['total_conversions'] / analytics['total_clicks']) * 100, 2)
        analytics['total_revenue'] = round(analytics['total_revenue'], 2)

        campaign['linked_offers'] = linked_offers
        campaign['analytics'] = analytics

        return jsonify({'success': True, 'campaign': campaign}), 200

    except Exception as e:
        logger.error(f"❌ Error getting campaign: {e}")
        return jsonify({'error': str(e)}), 500


@admin_campaigns_bp.route('/api/admin/campaigns/<campaign_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('tracking')
def update_campaign(campaign_id):
    """Update a campaign"""
    try:
        col = _col()
        if col is None:
            return jsonify({'error': 'Database not available'}), 503

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        update = {'updated_at': datetime.utcnow()}
        for field in ('name', 'description', 'status', 'budget', 'start_date', 'end_date', 'offer_ids'):
            if field in data:
                update[field] = data[field]

        result = col.update_one({'campaign_id': campaign_id}, {'$set': update})
        if result.matched_count == 0:
            return jsonify({'error': 'Campaign not found'}), 404

        # Re-link offers if offer_ids changed
        if 'offer_ids' in data:
            offers_col = db_instance.get_collection('offers')
            if offers_col:
                # Remove old links
                offers_col.update_many(
                    {'campaign_id': campaign_id},
                    {'$set': {'campaign_id': ''}}
                )
                # Set new links
                if data['offer_ids']:
                    offers_col.update_many(
                        {'offer_id': {'$in': data['offer_ids']}},
                        {'$set': {'campaign_id': campaign_id}}
                    )

        return jsonify({'success': True, 'message': 'Campaign updated'}), 200

    except Exception as e:
        logger.error(f"❌ Error updating campaign: {e}")
        return jsonify({'error': str(e)}), 500


@admin_campaigns_bp.route('/api/admin/campaigns/<campaign_id>', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('tracking')
def delete_campaign(campaign_id):
    """Delete a campaign (unlinks offers, doesn't delete them)"""
    try:
        col = _col()
        if col is None:
            return jsonify({'error': 'Database not available'}), 503

        # Unlink offers first
        offers_col = db_instance.get_collection('offers')
        if offers_col:
            offers_col.update_many(
                {'campaign_id': campaign_id},
                {'$set': {'campaign_id': ''}}
            )

        result = col.delete_one({'campaign_id': campaign_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Campaign not found'}), 404

        return jsonify({'success': True, 'message': 'Campaign deleted'}), 200

    except Exception as e:
        logger.error(f"❌ Error deleting campaign: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# CAMPAIGN ANALYTICS
# ============================================================================

@admin_campaigns_bp.route('/api/admin/campaigns/<campaign_id>/analytics', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def campaign_analytics(campaign_id):
    """Get detailed analytics for a campaign including funnel and per-offer breakdown"""
    try:
        clicks_col = db_instance.get_collection('clicks')
        funnel_col = db_instance.get_collection('tracking_events_funnel')

        if not clicks_col:
            return jsonify({'error': 'Database not available'}), 503

        # Date range
        start_str = request.args.get('start_date')
        end_str = request.args.get('end_date')
        date_filter = {}
        if start_str:
            try:
                date_filter['$gte'] = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            except ValueError:
                pass
        if end_str:
            try:
                date_filter['$lte'] = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except ValueError:
                pass

        click_query = {'campaign_id': campaign_id}
        if date_filter:
            click_query['timestamp'] = date_filter

        # Total clicks
        total_clicks = clicks_col.count_documents(click_query)

        # Clicks by offer
        clicks_by_offer = list(clicks_col.aggregate([
            {'$match': click_query},
            {'$group': {
                '_id': '$offer_id',
                'offer_name': {'$first': '$offer_name'},
                'clicks': {'$sum': 1},
            }},
            {'$sort': {'clicks': -1}},
        ]))

        # Clicks by country
        clicks_by_country = list(clicks_col.aggregate([
            {'$match': click_query},
            {'$group': {'_id': '$country', 'clicks': {'$sum': 1}}},
            {'$sort': {'clicks': -1}},
            {'$limit': 20},
        ]))

        # Funnel events
        funnel_query = {'campaign_id': campaign_id}
        if date_filter:
            funnel_query['timestamp'] = date_filter

        funnel_summary = {'install': 0, 'signup': 0, 'ftd': 0, 'purchase': 0, 'total_revenue': 0}
        if funnel_col:
            for r in funnel_col.aggregate([
                {'$match': funnel_query},
                {'$group': {'_id': '$event_type', 'count': {'$sum': 1}, 'revenue': {'$sum': '$revenue'}}},
            ]):
                etype = r['_id']
                if etype in funnel_summary:
                    funnel_summary[etype] = r['count']
                funnel_summary['total_revenue'] += r.get('revenue', 0)

        funnel_summary['total_revenue'] = round(funnel_summary['total_revenue'], 2)
        total_conversions = sum(funnel_summary[k] for k in ('install', 'signup', 'ftd', 'purchase'))
        cr = round((total_conversions / total_clicks * 100), 2) if total_clicks > 0 else 0

        return jsonify({
            'success': True,
            'data': {
                'campaign_id': campaign_id,
                'total_clicks': total_clicks,
                'total_conversions': total_conversions,
                'cr': cr,
                'funnel': funnel_summary,
                'clicks_by_offer': clicks_by_offer,
                'clicks_by_country': clicks_by_country,
            }
        }), 200

    except Exception as e:
        logger.error(f"❌ Error getting campaign analytics: {e}")
        return jsonify({'error': str(e)}), 500
