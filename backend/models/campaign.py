"""Campaign Model for Advertiser Campaigns"""
from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class Campaign:
    """Campaign model for advertiser campaigns"""
    
    COLLECTION_NAME = 'campaigns'
    
    # Campaign types
    CAMPAIGN_TYPES = ['classic_push', 'in_page_push', 'native', 'banner']
    
    # Campaign statuses
    STATUS_DRAFT = 'draft'
    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_PAUSED = 'paused'
    STATUS_REJECTED = 'rejected'
    STATUS_COMPLETED = 'completed'
    
    STATUSES = [STATUS_DRAFT, STATUS_PENDING, STATUS_RUNNING, STATUS_PAUSED, STATUS_REJECTED, STATUS_COMPLETED]
    
    # Bid types
    BID_TYPE_CPC = 'cpc'  # Cost per click
    BID_TYPE_CPM = 'cpm'  # Cost per mille (1000 impressions)
    BID_TYPE_CPA = 'cpa'  # Cost per action
    
    BID_TYPES = [BID_TYPE_CPC, BID_TYPE_CPM, BID_TYPE_CPA]
    
    def __init__(self):
        self.collection = db_instance.get_collection(self.COLLECTION_NAME)
    
    def create_campaign(self, advertiser_id: str, campaign_data: dict) -> dict:
        """Create a new campaign"""
        now = datetime.utcnow()
        
        campaign = {
            'advertiser_id': advertiser_id,
            'name': campaign_data.get('name', 'Untitled Campaign'),
            'campaign_type': campaign_data.get('campaign_type', 'classic_push'),
            'status': self.STATUS_DRAFT,
            
            # Bidding
            'bid_type': campaign_data.get('bid_type', self.BID_TYPE_CPC),
            'bid_amount': float(campaign_data.get('bid_amount', 0.01)),
            'daily_limit': float(campaign_data.get('daily_limit', 10.0)),
            'total_budget': float(campaign_data.get('total_budget', 0)),
            
            # Targeting
            'target_countries': campaign_data.get('target_countries', []),
            'target_devices': campaign_data.get('target_devices', []),
            'target_os': campaign_data.get('target_os', []),
            'target_browsers': campaign_data.get('target_browsers', []),
            
            # Schedule
            'start_date': campaign_data.get('start_date'),
            'end_date': campaign_data.get('end_date'),
            'schedule_hours': campaign_data.get('schedule_hours', []),
            
            # Creative (for classic push)
            'title': campaign_data.get('title', ''),
            'description': campaign_data.get('description', ''),
            'icon_url': campaign_data.get('icon_url', ''),
            'image_url': campaign_data.get('image_url', ''),
            'landing_url': campaign_data.get('landing_url', ''),
            
            # Tracking
            'postback_url': campaign_data.get('postback_url', ''),
            'click_id_param': campaign_data.get('click_id_param', 'click_id'),
            
            # Statistics (will be updated by tracking)
            'impressions': 0,
            'clicks': 0,
            'conversions': 0,
            'spent': 0.0,
            'revenue': 0.0,
            
            # Tags
            'tags': campaign_data.get('tags', []),
            
            # Timestamps
            'created_at': now,
            'updated_at': now
        }
        
        result = self.collection.insert_one(campaign)
        campaign['_id'] = str(result.inserted_id)
        return campaign
    
    def get_campaign(self, campaign_id: str) -> dict:
        """Get a campaign by ID"""
        campaign = self.collection.find_one({'_id': ObjectId(campaign_id)})
        if campaign:
            campaign['_id'] = str(campaign['_id'])
        return campaign
    
    def get_advertiser_campaigns(self, advertiser_id: str, status: str = None) -> list:
        """Get all campaigns for an advertiser"""
        query = {'advertiser_id': advertiser_id}
        if status:
            query['status'] = status
        
        campaigns = list(self.collection.find(query).sort('created_at', -1))
        for c in campaigns:
            c['_id'] = str(c['_id'])
        return campaigns
    
    def update_campaign(self, campaign_id: str, campaign_data: dict) -> bool:
        """Update a campaign"""
        campaign_data['updated_at'] = datetime.utcnow()
        
        # Remove fields that shouldn't be updated directly
        campaign_data.pop('_id', None)
        campaign_data.pop('advertiser_id', None)
        campaign_data.pop('created_at', None)
        
        result = self.collection.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': campaign_data}
        )
        return result.modified_count > 0
    
    def delete_campaign(self, campaign_id: str) -> bool:
        """Delete a campaign"""
        result = self.collection.delete_one({'_id': ObjectId(campaign_id)})
        return result.deleted_count > 0
    
    def update_campaign_status(self, campaign_id: str, status: str) -> bool:
        """Update campaign status"""
        if status not in self.STATUSES:
            return False
        
        result = self.collection.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': {'status': status, 'updated_at': datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    def get_campaign_stats(self, advertiser_id: str) -> dict:
        """Get campaign statistics for an advertiser"""
        total = self.collection.count_documents({'advertiser_id': advertiser_id})
        running = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_RUNNING})
        paused = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_PAUSED})
        draft = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_DRAFT})
        pending = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_PENDING})
        
        # Aggregate total spent and revenue
        pipeline = [
            {'$match': {'advertiser_id': advertiser_id}},
            {'$group': {
                '_id': None,
                'total_spent': {'$sum': '$spent'},
                'total_impressions': {'$sum': '$impressions'},
                'total_clicks': {'$sum': '$clicks'},
                'total_conversions': {'$sum': '$conversions'}
            }}
        ]
        
        agg_result = list(self.collection.aggregate(pipeline))
        totals = agg_result[0] if agg_result else {
            'total_spent': 0,
            'total_impressions': 0,
            'total_clicks': 0,
            'total_conversions': 0
        }
        
        return {
            'total_campaigns': total,
            'running_campaigns': running,
            'paused_campaigns': paused,
            'draft_campaigns': draft,
            'pending_campaigns': pending,
            'total_spent': totals.get('total_spent', 0),
            'total_impressions': totals.get('total_impressions', 0),
            'total_clicks': totals.get('total_clicks', 0),
            'total_conversions': totals.get('total_conversions', 0)
        }


# Singleton instance
_campaign_instance = None

def get_campaign_model():
    """Get singleton Campaign model instance"""
    global _campaign_instance
    if _campaign_instance is None:
        _campaign_instance = Campaign()
    return _campaign_instance
