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
            'status': campaign_data.get('status', self.STATUS_DRAFT),
            
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
        
        # Allow any other custom fields passed in campaign_data (e.g. form_data)
        for k, v in campaign_data.items():
            if k not in campaign:
                campaign[k] = v
                
        result = self.collection.insert_one(campaign)
        campaign['_id'] = str(result.inserted_id)
        self.sync_to_offer(campaign['_id'])
        return campaign
    
    def sync_to_offer(self, campaign_id: str) -> bool:
        """Sync advertiser campaign to offers collection for redirection and reporting.
        If the offer already exists (created by admin), only update status — don't overwrite admin edits.
        """
        try:
            campaign = self.collection.find_one({'_id': ObjectId(campaign_id)})
            if not campaign:
                logger.error(f"Campaign {campaign_id} not found for sync")
                return False
                
            db = db_instance.get_db()
            offers_col = db_instance.get_collection('offers')
            if offers_col is None:
                logger.error("Offers collection not available")
                return False
                
            existing_offer = offers_col.find_one({'campaign_id': str(campaign['_id'])})
            
            status_map = {
                'running': 'active',
                'paused': 'paused',
                'completed': 'paused',
                'rejected': 'inactive',
                'draft': 'inactive',
                'pending': 'pending',
                'approved': 'active'
            }
            offer_status = status_map.get(campaign.get('status'), 'inactive')
            
            if existing_offer:
                # Offer already exists (created by admin or previous sync)
                # Only update status and is_active — don't overwrite name, payout, countries, etc.
                update_fields = {
                    'status': offer_status,
                    'is_active': offer_status == 'active',
                    'updated_at': datetime.utcnow()
                }
                offers_col.update_one(
                    {'campaign_id': str(campaign['_id'])},
                    {'$set': update_fields}
                )
                logger.info(f"Updated status of existing offer for campaign {campaign_id} to {offer_status}")
                return True
            
            # No existing offer — create a new one from campaign data
            from models.offer import Offer
            offer_model = Offer()
            attempts = 0
            while attempts < 100:
                offer_id = offer_model._get_next_offer_id()
                if not offers_col.find_one({'offer_id': offer_id}):
                    break
                attempts += 1
                
            target_countries = campaign.get('target_countries', [])
            if isinstance(target_countries, str):
                allowed_countries = [c.strip().upper() for c in target_countries.split(',') if c.strip()]
            else:
                allowed_countries = [c.upper() for c in target_countries if c]
                
            target_devices = campaign.get('target_devices', [])
            device_targeting = 'all'
            if target_devices:
                if len(target_devices) == 1:
                    device_targeting = target_devices[0]
                    
            offer_doc = {
                'offer_id': offer_id,
                'campaign_id': str(campaign['_id']),
                'name': campaign.get('name', 'Untitled Campaign'),
                'description': campaign.get('description', ''),
                'vertical': 'OTHER',
                'category': 'OTHER',
                'categories': ['OTHER'],
                'offer_type': campaign.get('bid_type', 'cpa').upper(),
                'status': offer_status,
                'countries': allowed_countries,
                'allowed_countries': allowed_countries,
                'device_targeting': device_targeting,
                'os_targeting': campaign.get('target_os', []),
                'browser_targeting': campaign.get('target_browsers', []),
                'offer_source': 'advertiser',
                'advertiser_id': campaign.get('advertiser_id'),
                'payout': float(campaign.get('bid_amount', 0.01)),
                'currency': 'USD',
                'network': 'advertiser',
                'target_url': campaign.get('landing_url', ''),
                'preview_url': campaign.get('landing_url', ''),
                'postback_url': campaign.get('postback_url', ''),
                'created_by': 'advertiser',
                'created_at': campaign.get('created_at') or datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': offer_status == 'active',
                'is_public': True
            }
            
            offers_col.insert_one(offer_doc)
            logger.info(f"Created new offer {offer_id} for campaign {campaign_id}")
            return True
        except Exception as e:
            logger.error(f"Error syncing campaign {campaign_id} to offer: {str(e)}", exc_info=True)
            return False
    
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
        self.sync_to_offer(campaign_id)
        return result.modified_count > 0
    
    def delete_campaign(self, campaign_id: str) -> bool:
        """Delete a campaign"""
        result = self.collection.delete_one({'_id': ObjectId(campaign_id)})
        # Delete from offers too
        db = db_instance.get_db()
        offers_col = db_instance.get_collection('offers')
        if offers_col is not None:
            offers_col.delete_one({'campaign_id': campaign_id})
        return result.deleted_count > 0
    
    def update_campaign_status(self, campaign_id: str, status: str) -> bool:
        """Update campaign status"""
        if status not in self.STATUSES:
            return False
        
        result = self.collection.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': {'status': status, 'updated_at': datetime.utcnow()}}
        )
        self.sync_to_offer(campaign_id)
        return result.modified_count > 0
    
    def get_campaign_stats(self, advertiser_id: str) -> dict:
        """Get campaign statistics for an advertiser using real-time data from clicks/conversions"""
        total = self.collection.count_documents({'advertiser_id': advertiser_id})
        running = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_RUNNING})
        paused = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_PAUSED})
        draft = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_DRAFT})
        pending = self.collection.count_documents({'advertiser_id': advertiser_id, 'status': self.STATUS_PENDING})
        
        # Get real-time stats from clicks and conversions collections
        db = db_instance.get_db()
        total_clicks = 0
        total_conversions = 0
        total_spent = 0.0
        
        if db is not None:
            # Find all offers belonging to this advertiser (both advertiser-sourced and partner-mapped)
            adv_partner_id = f"adv_{advertiser_id}"
            offers = list(db.offers.find(
                {'$or': [
                    {'offer_source': 'advertiser', 'advertiser_id': advertiser_id},
                    {'partner_id': adv_partner_id}
                ]},
                {'offer_id': 1, 'advertiser_rate': 1}
            ))
            offer_ids = [o.get('offer_id') for o in offers if o.get('offer_id')]
            
            if offer_ids:
                # Count real clicks
                total_clicks = db.clicks.count_documents({'offer_id': {'$in': offer_ids}})
                # Count real conversions
                total_conversions = db.conversions.count_documents({'offer_id': {'$in': offer_ids}})
                # Calculate spend using advertiser_rate when available
                # Build a map of offer_id -> advertiser rate
                offer_rates = {}
                for o in offers:
                    adv_rate = o.get('advertiser_rate')
                    if adv_rate and float(adv_rate) > 0:
                        offer_rates[o.get('offer_id')] = float(adv_rate)
                
                if offer_rates:
                    # If any offer has advertiser_rate, calculate spend per-offer
                    for oid in offer_ids:
                        count = db.conversions.count_documents({'offer_id': oid})
                        rate = offer_rates.get(oid)
                        if rate:
                            total_spent += count * rate
                        else:
                            # Fallback: sum payout from conversions for this offer
                            pipeline = [
                                {'$match': {'offer_id': oid}},
                                {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': {'$ifNull': ['$payout', 0]}}}}}
                            ]
                            result = list(db.conversions.aggregate(pipeline))
                            total_spent += result[0]['total'] if result else 0.0
                else:
                    # No advertiser_rate set - sum payout from conversions directly
                    spend_pipeline = [
                        {'$match': {'offer_id': {'$in': offer_ids}}},
                        {'$group': {'_id': None, 'total': {'$sum': {'$toDouble': {'$ifNull': ['$payout', 0]}}}}}
                    ]
                    spend_result = list(db.conversions.aggregate(spend_pipeline))
                    total_spent = spend_result[0]['total'] if spend_result else 0.0
        
        return {
            'total_campaigns': total,
            'running_campaigns': running,
            'paused_campaigns': paused,
            'draft_campaigns': draft,
            'pending_campaigns': pending,
            'total_spent': round(total_spent, 2),
            'total_impressions': total_clicks,  # Use clicks as impressions proxy
            'total_clicks': total_clicks,
            'total_conversions': total_conversions
        }


# Singleton instance
_campaign_instance = None

def get_campaign_model():
    """Get singleton Campaign model instance"""
    global _campaign_instance
    if _campaign_instance is None:
        _campaign_instance = Campaign()
    return _campaign_instance
