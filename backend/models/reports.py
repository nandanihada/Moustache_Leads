"""
Reports Model for Tracking Analytics and Reporting
Handles generation and storage of tracking reports for admin dashboard
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging
import uuid
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class Reports:
    def __init__(self):
        self.reports_collection = db_instance.get_collection('reports')
        self.clicks_collection = db_instance.get_collection('clicks')
        self.conversions_collection = db_instance.get_collection('conversions')
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
        self.tracking_events_collection = db_instance.get_collection('tracking_events')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.reports_collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.reports_collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def generate_tracking_report(self, date_range: Dict[str, datetime], report_type: str = "custom") -> Dict[str, Any]:
        """
        Generate comprehensive tracking report
        
        Args:
            date_range: {'start': datetime, 'end': datetime}
            report_type: 'daily', 'weekly', 'monthly', 'custom'
        
        Returns:
            Dict containing report data
        """
        if not self._check_db_connection():
            return {'error': 'Database connection not available'}
        
        try:
            start_date = date_range['start']
            end_date = date_range['end']
            
            # Date filter for queries
            date_filter = {
                'created_at': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
            # 1. Basic Metrics
            total_clicks = self.clicks_collection.count_documents(date_filter)
            total_completions = self.conversions_collection.count_documents(date_filter)
            conversion_rate = (total_completions / total_clicks * 100) if total_clicks > 0 else 0
            
            # 2. Revenue Metrics
            revenue_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': None,
                    'total_payout': {'$sum': '$payout'},
                    'avg_payout': {'$avg': '$payout'},
                    'total_revenue': {'$sum': '$revenue'}
                }}
            ]
            revenue_result = list(self.conversions_collection.aggregate(revenue_pipeline))
            revenue_data = revenue_result[0] if revenue_result else {
                'total_payout': 0, 'avg_payout': 0, 'total_revenue': 0
            }
            
            # 3. Top Offers
            top_offers_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': '$offer_id',
                    'clicks': {'$sum': 1},
                    'conversions': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, 1, 0]}},
                    'total_payout': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, '$payout', 0]}}
                }},
                {'$sort': {'conversions': -1}},
                {'$limit': 10}
            ]
            top_offers_data = list(self.clicks_collection.aggregate(top_offers_pipeline))
            
            # Enrich with offer names
            for offer_data in top_offers_data:
                offer = self.offers_collection.find_one({'offer_id': offer_data['_id']})
                offer_data['offer_name'] = offer.get('name', 'Unknown') if offer else 'Unknown'
                offer_data['conversion_rate'] = (offer_data['conversions'] / offer_data['clicks'] * 100) if offer_data['clicks'] > 0 else 0
            
            # 4. Top Affiliates
            top_affiliates_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': '$affiliate_id',
                    'clicks': {'$sum': 1},
                    'conversions': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, 1, 0]}},
                    'total_earnings': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, '$payout', 0]}}
                }},
                {'$sort': {'conversions': -1}},
                {'$limit': 10}
            ]
            top_affiliates_data = list(self.clicks_collection.aggregate(top_affiliates_pipeline))
            
            # Enrich with user names
            for affiliate_data in top_affiliates_data:
                user = self.users_collection.find_one({'_id': ObjectId(affiliate_data['_id'])})
                affiliate_data['username'] = user.get('username', 'Unknown') if user else 'Unknown'
                affiliate_data['conversion_rate'] = (affiliate_data['conversions'] / affiliate_data['clicks'] * 100) if affiliate_data['clicks'] > 0 else 0
            
            # 5. Daily Breakdown
            daily_breakdown_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': {
                        'year': {'$year': '$created_at'},
                        'month': {'$month': '$created_at'},
                        'day': {'$dayOfMonth': '$created_at'}
                    },
                    'clicks': {'$sum': 1},
                    'conversions': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, 1, 0]}},
                    'revenue': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, '$payout', 0]}}
                }},
                {'$sort': {'_id': 1}}
            ]
            daily_data = list(self.clicks_collection.aggregate(daily_breakdown_pipeline))
            
            # Format daily data
            formatted_daily_data = []
            for day in daily_data:
                date_str = f"{day['_id']['year']}-{day['_id']['month']:02d}-{day['_id']['day']:02d}"
                formatted_daily_data.append({
                    'date': date_str,
                    'clicks': day['clicks'],
                    'conversions': day['conversions'],
                    'conversion_rate': (day['conversions'] / day['clicks'] * 100) if day['clicks'] > 0 else 0,
                    'revenue': day['revenue']
                })
            
            # 6. Country Breakdown
            country_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': '$country',
                    'clicks': {'$sum': 1},
                    'conversions': {'$sum': {'$cond': [{'$eq': ['$status', 'converted']}, 1, 0]}}
                }},
                {'$sort': {'clicks': -1}},
                {'$limit': 10}
            ]
            country_data = list(self.clicks_collection.aggregate(country_pipeline))
            
            # Create report document
            report_data = {
                'report_id': str(uuid.uuid4()),
                'type': report_type,
                'date_range': {
                    'start': start_date,
                    'end': end_date
                },
                'summary_metrics': {
                    'total_clicks': total_clicks,
                    'total_completions': total_completions,
                    'conversion_rate': round(conversion_rate, 2),
                    'total_payout': revenue_data['total_payout'],
                    'avg_payout': round(revenue_data['avg_payout'], 2) if revenue_data['avg_payout'] else 0,
                    'total_revenue': revenue_data['total_revenue']
                },
                'top_offers': top_offers_data,
                'top_affiliates': top_affiliates_data,
                'daily_breakdown': formatted_daily_data,
                'country_breakdown': country_data,
                'generated_at': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }
            
            # Save report to database
            result = self.reports_collection.insert_one(report_data)
            report_data['_id'] = str(result.inserted_id)
            
            logger.info(f"Generated tracking report: {report_data['report_id']}")
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating tracking report: {str(e)}")
            return {'error': str(e)}
    
    def get_real_time_stats(self) -> Dict[str, Any]:
        """Get real-time tracking statistics for dashboard"""
        if not self._check_db_connection():
            return {'error': 'Database connection not available'}
        
        try:
            # Last 24 hours
            last_24h = datetime.utcnow() - timedelta(hours=24)
            
            # Quick stats
            stats = {
                'last_24h': {
                    'clicks': self.clicks_collection.count_documents({'created_at': {'$gte': last_24h}}),
                    'conversions': self.conversions_collection.count_documents({'created_at': {'$gte': last_24h}}),
                },
                'total': {
                    'clicks': self.clicks_collection.count_documents({}),
                    'conversions': self.conversions_collection.count_documents({}),
                    'active_offers': self.offers_collection.count_documents({'status': 'active', 'is_active': True})
                }
            }
            
            # Calculate conversion rates
            stats['last_24h']['conversion_rate'] = (
                stats['last_24h']['conversions'] / stats['last_24h']['clicks'] * 100
            ) if stats['last_24h']['clicks'] > 0 else 0
            
            stats['total']['conversion_rate'] = (
                stats['total']['conversions'] / stats['total']['clicks'] * 100
            ) if stats['total']['clicks'] > 0 else 0
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting real-time stats: {str(e)}")
            return {'error': str(e)}
    
    def get_saved_reports(self, limit: int = 50) -> List[Dict]:
        """Get list of saved reports"""
        if not self._check_db_connection():
            return []
        
        try:
            reports = list(self.reports_collection.find(
                {},
                {'report_id': 1, 'type': 1, 'date_range': 1, 'summary_metrics': 1, 'generated_at': 1}
            ).sort('generated_at', -1).limit(limit))
            
            # Convert ObjectId to string
            for report in reports:
                report['_id'] = str(report['_id'])
            
            return reports
            
        except Exception as e:
            logger.error(f"Error getting saved reports: {str(e)}")
            return []
    
    def get_report_by_id(self, report_id: str) -> Optional[Dict]:
        """Get specific report by ID"""
        if not self._check_db_connection():
            return None
        
        try:
            report = self.reports_collection.find_one({'report_id': report_id})
            if report:
                report['_id'] = str(report['_id'])
            return report
            
        except Exception as e:
            logger.error(f"Error getting report by ID: {str(e)}")
            return None
    
    def delete_report(self, report_id: str) -> bool:
        """Delete a report"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.reports_collection.delete_one({'report_id': report_id})
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error deleting report: {str(e)}")
            return False
