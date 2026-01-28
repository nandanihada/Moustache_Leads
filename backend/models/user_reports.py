"""
User Reports Model
Handles report generation for publishers/users (Performance & Conversion reports)
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
from utils.metrics_calculator import MetricsCalculator
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class UserReports:
    def __init__(self):
        # Use ALL click collections for user reports
        self.clicks_collection = db_instance.get_collection('offerwall_clicks_detailed')  # Comprehensive offerwall clicks
        self.offerwall_clicks_collection = db_instance.get_collection('offerwall_clicks')  # Regular offerwall clicks
        self.simple_clicks_collection = db_instance.get_collection('clicks')  # Simple tracking clicks
        self.dashboard_clicks_collection = db_instance.get_collection('dashboard_clicks')  # Dashboard/Offers page clicks
        self.conversions_collection = db_instance.get_collection('forwarded_postbacks')  # User's forwarded postbacks
        self.placements_collection = db_instance.get_collection('placements')  # To get user's placements
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
    
    def _check_db_connection(self):
        """Check if database is connected"""
        if self.clicks_collection is None or not db_instance.is_connected():
            return False
        try:
            self.clicks_collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def get_performance_report(
        self, 
        user_id: str,
        date_range: Dict[str, datetime],
        filters: Optional[Dict] = None,
        group_by: Optional[List[str]] = None,
        pagination: Optional[Dict] = None,
        sort: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate performance report grouped by specified dimensions
        
        Args:
            user_id: User/Affiliate ID
            date_range: {'start': datetime, 'end': datetime}
            filters: Optional filters (offer_id, country, status, sub_ids)
            group_by: List of fields to group by (date, offer_id, country, sub_id1-5)
            pagination: {'page': int, 'per_page': int}
            sort: {'field': str, 'order': str}
        
        Returns:
            Report data with pagination
        """
        if not self._check_db_connection():
            return {'error': 'Database connection not available'}
        
        try:
            start_date = date_range['start']
            end_date = date_range['end']
            filters = filters or {}
            group_by = group_by or ['date', 'offer_id']  # Default: group by date AND offer to show offer names
            pagination = pagination or {'page': 1, 'per_page': 20}
            sort_config = sort or {'field': 'date', 'order': 'desc'}
            
            # Get user info to check if admin
            user = self.users_collection.find_one({'_id': ObjectId(user_id)})
            is_admin = user and user.get('role') == 'admin'
            
            # Build match query - Filter by user's placements unless admin
            match_query = {
                'timestamp': {  # offerwall_clicks_detailed uses 'timestamp' not 'click_time'
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
            # If not admin, filter by user's placements
            if not is_admin:
                # Get user's placement IDs
                username = user.get('username') if user else None
                if username:
                    user_placements = list(self.placements_collection.find(
                        {'created_by': username},
                        {'_id': 1}
                    ))
                    placement_ids = [str(p['_id']) for p in user_placements]
                    
                    if placement_ids:
                        # Filter clicks by placement_id (support both string and ObjectId)
                        match_query['$or'] = [
                            {'placement_id': {'$in': placement_ids}},
                            {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                        ]
                    else:
                        # User has no placements - set empty match for offerwall clicks
                        # but dashboard clicks will still be queried by user_id
                        match_query['placement_id'] = {'$in': []}  # Will match nothing
                        logger.info(f"⚠️ User {username} has no placements, will only show dashboard clicks")
            
            # Apply filters
            if filters.get('offer_id'):
                match_query['offer_id'] = {'$in': filters['offer_id'] if isinstance(filters['offer_id'], list) else [filters['offer_id']]}
            
            if filters.get('country'):
                match_query['country'] = {'$in': filters['country'] if isinstance(filters['country'], list) else [filters['country']]}
            
            # Sub ID filters
            for i in range(1, 6):
                sub_key = f'sub_id{i}'
                if filters.get(sub_key):
                    match_query[sub_key] = filters[sub_key]
            
            # Build group stage
            group_id = {}
            for field in group_by:
                if field == 'date':
                    group_id['date'] = {
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}  # Use timestamp field
                    }
                elif field == 'offer_id':
                    group_id['offer_id'] = '$offer_id'
                elif field == 'country':
                    group_id['country'] = '$country'
                elif field == 'browser':
                    group_id['browser'] = '$browser'
                elif field == 'device_type':
                    group_id['device_type'] = '$device_type'
                elif field == 'source':
                    group_id['source'] = '$referer'
                elif field == 'creative':
                    group_id['creative'] = '$creative'
                elif field == 'app_version':
                    group_id['app_version'] = '$app_version'
                elif field.startswith('advertiser_sub_id'):
                    group_id[field] = f'${field}'
                elif field.startswith('sub_id'):
                    group_id[field] = f'${field}'
            
            # Aggregation pipeline
            pipeline = [
                {'$match': match_query},
                {
                    '$group': {
                        '_id': group_id,
                        'clicks': {'$sum': 1},
                        'gross_clicks': {'$sum': 1},  # All clicks including rejected
                        'unique_clicks': {
                            '$sum': {'$cond': [{'$eq': ['$is_unique', True]}, 1, 0]}
                        },
                        'suspicious_clicks': {
                            '$sum': {'$cond': [{'$eq': ['$is_suspicious', True]}, 1, 0]}
                        },
                        'rejected_clicks': {
                            '$sum': {'$cond': [{'$eq': ['$is_rejected', True]}, 1, 0]}
                        }
                    }
                }
            ]
            
            # Get aggregated click data from offerwall_clicks_detailed
            click_results = list(self.clicks_collection.aggregate(pipeline)) if self.clicks_collection is not None else []
            logger.info(f"📊 offerwall_clicks_detailed: {len(click_results)} groups")
            
            # Also get clicks from offerwall_clicks (regular collection)
            offerwall_click_results = []
            if self.offerwall_clicks_collection is not None:
                offerwall_click_results = list(self.offerwall_clicks_collection.aggregate(pipeline))
                logger.info(f"📊 offerwall_clicks: {len(offerwall_click_results)} groups")
            
            # Also get clicks from simple 'clicks' collection
            simple_click_results = []
            if self.simple_clicks_collection is not None:
                # Simple clicks use different field names, adjust query
                simple_match_query = {
                    'timestamp': {
                        '$gte': start_date,
                        '$lte': end_date
                    }
                }
                if not is_admin:
                    simple_match_query['user_id'] = user_id
                if filters.get('offer_id'):
                    simple_match_query['offer_id'] = match_query.get('offer_id')
                
                simple_pipeline = [
                    {'$match': simple_match_query},
                    {
                        '$group': {
                            '_id': group_id,
                            'clicks': {'$sum': 1},
                            'gross_clicks': {'$sum': 1},
                            'unique_clicks': {'$sum': 0},
                            'suspicious_clicks': {'$sum': 0},
                            'rejected_clicks': {'$sum': 0}
                        }
                    }
                ]
                simple_click_results = list(self.simple_clicks_collection.aggregate(simple_pipeline))
                logger.info(f"📊 clicks (simple): {len(simple_click_results)} groups")
            
            # Also get clicks from dashboard_clicks collection (Offers page clicks)
            dashboard_click_results = []
            if self.dashboard_clicks_collection is not None:
                dashboard_match_query = {
                    'timestamp': {
                        '$gte': start_date,
                        '$lte': end_date
                    }
                }
                
                # Filter by user_id for dashboard clicks
                if not is_admin:
                    dashboard_match_query['user_id'] = user_id
                
                if filters.get('offer_id'):
                    dashboard_match_query['offer_id'] = match_query.get('offer_id')
                
                dashboard_pipeline = [
                    {'$match': dashboard_match_query},
                    {
                        '$group': {
                            '_id': group_id,
                            'clicks': {'$sum': 1},
                            'gross_clicks': {'$sum': 1},
                            'unique_clicks': {'$sum': 0},
                            'suspicious_clicks': {'$sum': 0},
                            'rejected_clicks': {'$sum': 0}
                        }
                    }
                ]
                
                dashboard_click_results = list(self.dashboard_clicks_collection.aggregate(dashboard_pipeline))
            
            logger.info(f"🔍 Performance Report Debug:")
            logger.info(f"   User ID: {user_id}")
            logger.info(f"   Match Query: {match_query}")
            logger.info(f"   Offerwall Click Results: {len(click_results)} groups")
            logger.info(f"   Dashboard Click Results: {len(dashboard_click_results)} groups")
            if click_results:
                logger.info(f"   First offerwall result: {click_results[0]}")
            if dashboard_click_results:
                logger.info(f"   First dashboard result: {dashboard_click_results[0]}")
            
            # Now get conversion data from forwarded_postbacks for the same groups
            conversion_match = {
                'timestamp': {  # forwarded_postbacks uses 'timestamp' not 'conversion_time'
                    '$gte': start_date,
                    '$lte': end_date
                },
                'forward_status': 'success'  # Only successful forwards
            }
            
            # Filter by publisher_id if not admin
            if not is_admin:
                conversion_match['publisher_id'] = user_id
            
            if filters.get('offer_id'):
                conversion_match['offer_id'] = match_query.get('offer_id')
            if filters.get('country'):
                conversion_match['country'] = match_query.get('country')
            
            # Conversion aggregation
            conv_group_id = {}
            for field in group_by:
                if field == 'date':
                    conv_group_id['date'] = {
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}  # Use timestamp
                    }
                elif field == 'offer_id':
                    conv_group_id['offer_id'] = '$offer_id'
                elif field == 'country':
                    conv_group_id['country'] = '$country'
                elif field == 'browser':
                    conv_group_id['browser'] = '$browser'
                elif field == 'device_type':
                    conv_group_id['device_type'] = '$device_type'
                elif field == 'source':
                    conv_group_id['source'] = '$source'
                elif field == 'creative':
                    conv_group_id['creative'] = '$creative'
                elif field == 'app_version':
                    conv_group_id['app_version'] = '$app_version'
                elif field.startswith('advertiser_sub_id'):
                    conv_group_id[field] = f'${field}'
                elif field.startswith('sub_id'):
                    conv_group_id[field] = f'${field}'
            
            conv_pipeline = [
                {'$match': conversion_match},
                {
                    '$group': {
                        '_id': conv_group_id,
                        'conversions': {'$sum': 1},
                        'approved_conversions': {'$sum': 1},  # All forwarded postbacks are successful
                        'pending_conversions': {'$sum': 0},
                        'rejected_conversions': {'$sum': 0},
                        'total_payout': {'$sum': '$points'},  # forwarded_postbacks uses 'points' not 'payout'
                        'avg_time_spent_seconds': {'$avg': 0}  # Not available in forwarded_postbacks
                    }
                }
            ]
            
            conversion_results = list(self.conversions_collection.aggregate(conv_pipeline))
            
            # Merge click and conversion data
            merged_data = {}
            
            # First, add offerwall_clicks_detailed
            for click_row in click_results:
                key = str(click_row['_id'])
                merged_data[key] = {
                    **click_row['_id'],
                    'clicks': click_row['clicks'],
                    'gross_clicks': click_row.get('gross_clicks', click_row['clicks']),
                    'unique_clicks': click_row.get('unique_clicks', 0),
                    'suspicious_clicks': click_row.get('suspicious_clicks', 0),
                    'rejected_clicks': click_row.get('rejected_clicks', 0),
                    'conversions': 0,
                    'approved_conversions': 0,
                    'pending_conversions': 0,
                    'rejected_conversions': 0,
                    'total_payout': 0.0,
                    'total_revenue': 0.0
                }
            
            # Helper function to merge click data
            def merge_clicks(click_row, merged_data):
                key = str(click_row['_id'])
                if key in merged_data:
                    merged_data[key]['clicks'] += click_row['clicks']
                    merged_data[key]['gross_clicks'] += click_row.get('gross_clicks', click_row['clicks'])
                else:
                    merged_data[key] = {
                        **click_row['_id'],
                        'clicks': click_row['clicks'],
                        'gross_clicks': click_row.get('gross_clicks', click_row['clicks']),
                        'unique_clicks': 0,
                        'suspicious_clicks': 0,
                        'rejected_clicks': 0,
                        'conversions': 0,
                        'approved_conversions': 0,
                        'pending_conversions': 0,
                        'rejected_conversions': 0,
                        'total_payout': 0.0,
                        'total_revenue': 0.0
                    }
            
            # Merge offerwall_clicks (regular)
            for click_row in offerwall_click_results:
                merge_clicks(click_row, merged_data)
            
            # Merge simple clicks
            for click_row in simple_click_results:
                merge_clicks(click_row, merged_data)
            
            # Merge dashboard clicks
            for click_row in dashboard_click_results:
                merge_clicks(click_row, merged_data)
            
            for conv_row in conversion_results:
                key = str(conv_row['_id'])
                if key in merged_data:
                    merged_data[key].update({
                        'conversions': conv_row['conversions'],
                        'approved_conversions': conv_row['approved_conversions'],
                        'pending_conversions': conv_row['pending_conversions'],
                        'rejected_conversions': conv_row['rejected_conversions'],
                        'total_payout': conv_row['total_payout'],
                        'total_revenue': conv_row['total_payout'],  # Use payout as revenue
                        'avg_time_spent_seconds': conv_row.get('avg_time_spent_seconds', 0)
                    })
                else:
                    # Conversion without click (shouldn't happen, but handle it)
                    merged_data[key] = {
                        **conv_row['_id'],
                        'clicks': 0,
                        'gross_clicks': 0,
                        'unique_clicks': 0,
                        'suspicious_clicks': 0,
                        'rejected_clicks': 0,
                        'conversions': conv_row['conversions'],
                        'approved_conversions': conv_row['approved_conversions'],
                        'pending_conversions': conv_row['pending_conversions'],
                        'rejected_conversions': conv_row['rejected_conversions'],
                        'total_payout': conv_row['total_payout'],
                        'total_revenue': conv_row['total_payout'],  # Use payout as revenue
                        'avg_time_spent_seconds': conv_row.get('avg_time_spent_seconds', 0)
                    }
            
            # Convert to list and enrich with metrics
            report_data = []
            logger.info(f"DEBUG: Processing {len(merged_data)} merged rows")
            for i, row in enumerate(merged_data.values()):
                logger.info(f"DEBUG: Row {i}: clicks={row.get('clicks', 0)}, conversions={row.get('conversions', 0)}, payout={row.get('total_payout', 0)}")
                # ALWAYS enrich with offer name - even if not grouped by offer
                # Phase 2: Add offer URL, category, currency from offers collection
                # Phase 3: Add ad_group, goal, promo_code from offers collection
                if 'offer_id' in row:
                    offer = self.offers_collection.find_one({'offer_id': row['offer_id']})
                    if offer:
                        # Clean offer name to remove country codes
                        raw_name = offer.get('name', 'Unknown')
                        row['offer_name'] = self._clean_offer_name(raw_name)
                        row['network'] = offer.get('network', 'Unknown')
                        row['offer_url'] = offer.get('url', '')
                        row['category'] = offer.get('category', 'Uncategorized')
                        row['currency'] = offer.get('currency', 'USD')
                        row['ad_group'] = offer.get('ad_group', '')
                        row['goal'] = offer.get('goal', '')
                        row['promo_code'] = offer.get('promo_code', '')
                    else:
                        row['offer_name'] = 'Unknown Offer'
                        row['offer_url'] = ''
                        row['category'] = 'Unknown'
                        row['currency'] = 'USD'
                        row['ad_group'] = ''
                        row['goal'] = ''
                        row['promo_code'] = ''
                else:
                    # If no offer_id, set placeholder
                    row['offer_name'] = 'All Offers'
                    row['offer_url'] = ''
                    row['category'] = 'All'
                    row['currency'] = 'USD'
                    row['ad_group'] = ''
                    row['goal'] = ''
                    row['promo_code'] = ''
                
                # Calculate metrics
                enriched_row = MetricsCalculator.enrich_with_metrics(row)
                report_data.append(enriched_row)
            
            # Sort data
            sort_field = sort_config.get('field', 'date')
            sort_order = -1 if sort_config.get('order', 'desc') == 'desc' else 1
            report_data.sort(key=lambda x: x.get(sort_field, 0), reverse=(sort_order == -1))
            
            # Calculate summary
            summary = self._calculate_summary(report_data)
            
            logger.info(f"📊 Performance Report Summary: {len(report_data)} rows, {summary['total_clicks']} clicks, {summary['total_conversions']} conversions, ${summary['total_payout']} payout")
            
            # Paginate
            page = pagination['page']
            per_page = pagination['per_page']
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            
            paginated_data = report_data[start_idx:end_idx]
            
            return {
                'data': paginated_data,
                'summary': summary,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': len(report_data),
                    'pages': (len(report_data) + per_page - 1) // per_page
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating performance report: {str(e)}", exc_info=True)
            return {'error': str(e)}
    
    def get_conversion_report(
        self,
        user_id: str,
        date_range: Dict[str, datetime],
        filters: Optional[Dict] = None,
        pagination: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate conversion report (individual conversion records)
        
        Args:
            user_id: User/Affiliate ID
            date_range: {'start': datetime, 'end': datetime}
            filters: Optional filters
            pagination: {'page': int, 'per_page': int}
        
        Returns:
            List of conversions with pagination
        """
        if not self._check_db_connection():
            return {'error': 'Database connection not available'}
        
        try:
            start_date = date_range['start']
            end_date = date_range['end']
            filters = filters or {}
            pagination = pagination or {'page': 1, 'per_page': 20}
            
            # Get user info to check if admin
            user = self.users_collection.find_one({'_id': ObjectId(user_id)})
            is_admin = user and user.get('role') == 'admin'
            
            # Build query - Filter by publisher_id unless admin
            query = {
                'timestamp': {  # forwarded_postbacks uses 'timestamp'
                    '$gte': start_date,
                    '$lte': end_date
                },
                'forward_status': 'success'  # Only successful forwards
            }
            
            # Filter by publisher_id if not admin
            if not is_admin:
                query['publisher_id'] = user_id
            
            logger.info(f"📊 Conversion Report Query: {query}")
            
            # Apply filters
            if filters.get('offer_id'):
                query['offer_id'] = filters['offer_id']
            if filters.get('country'):
                query['country'] = filters['country']
            if filters.get('transaction_id'):
                query['username'] = filters['transaction_id']  # forwarded_postbacks uses 'username' field
            
            # Count total
            total = self.conversions_collection.count_documents(query) if self.conversions_collection is not None else 0
            logger.info(f"📊 Conversion Report: Found {total} conversions")
            
            # Pagination
            page = pagination['page']
            per_page = pagination['per_page']
            skip = (page - 1) * per_page
            
            # Fetch conversions (forwarded postbacks)
            conversions_cursor = self.conversions_collection.find(query).sort('timestamp', -1).skip(skip).limit(per_page)
            conversions = list(conversions_cursor)
            
            # Enrich with offer names from offers collection
            for conv in conversions:
                # Get offer details
                offer = self.offers_collection.find_one({'offer_id': conv.get('offer_id')})
                if offer:
                    # Clean offer name to remove country codes
                    raw_name = offer.get('name', 'Unknown')
                    conv['offer_name'] = self._clean_offer_name(raw_name)
                else:
                    conv['offer_name'] = 'Unknown Offer'
                
                # Format datetime (forwarded_postbacks uses 'timestamp')
                conv['time'] = conv['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if conv.get('timestamp') else ''
                
                # Set payout from points field
                conv['payout'] = conv.get('points', 0)
                
                # Set status as 'approved' since all forwarded postbacks are successful
                conv['status'] = 'approved'
                
                # Add transaction_id from username field
                conv['transaction_id'] = conv.get('username', '')

                
                # Convert ObjectIds to strings
                conv['_id'] = str(conv['_id'])
            
            # Calculate summary
            summary_pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': None,
                        'approved_payout': {'$sum': '$points'},  # All forwards are successful, use points
                        'pending_payout': {'$sum': 0},
                        'rejected_payout': {'$sum': 0},
                        'total_conversions': {'$sum': 1},
                        'approved_conversions': {'$sum': 1},
                        'pending_conversions': {'$sum': 0},
                        'rejected_conversions': {'$sum': 0}
                    }
                }
            ]
            
            summary_result = list(self.conversions_collection.aggregate(summary_pipeline))
            summary = summary_result[0] if summary_result else {
                'approved_payout': 0.0,
                'pending_payout': 0.0,
                'rejected_payout': 0.0,
                'total_conversions': 0,
                'approved_conversions': 0,
                'pending_conversions': 0,
                'rejected_conversions': 0
            }
            
            return {
                'conversions': conversions,
                'summary': summary,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': total,
                    'pages': (total + per_page - 1) // per_page
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating conversion report: {str(e)}", exc_info=True)
            return {'error': str(e)}
    
    def _clean_offer_name(self, name: str) -> str:
        """
        Remove country codes from offer names for cleaner display.
        Examples:
            "Survey Junkie - US" -> "Survey Junkie"
            "Swagbucks (US, CA, UK)" -> "Swagbucks"
            "InboxDollars [US]" -> "InboxDollars"
            "MyPoints - United States" -> "MyPoints"
        """
        import re
        if not name:
            return name
        
        # Common patterns to remove:
        # - " - US", " - CA", " - UK", etc.
        # - " (US)", " (US, CA)", " (US/CA/UK)", etc.
        # - " [US]", " [US, CA]", etc.
        # - " - United States", " - Canada", etc.
        
        # Pattern 1: " - XX" or " - XX, YY" at end (country codes)
        name = re.sub(r'\s*[-–]\s*([A-Z]{2}(?:\s*[,/]\s*[A-Z]{2})*)\s*$', '', name)
        
        # Pattern 2: " (XX)" or " (XX, YY, ZZ)" at end
        name = re.sub(r'\s*\(\s*[A-Z]{2}(?:\s*[,/]\s*[A-Z]{2})*\s*\)\s*$', '', name)
        
        # Pattern 3: " [XX]" or " [XX, YY]" at end
        name = re.sub(r'\s*\[\s*[A-Z]{2}(?:\s*[,/]\s*[A-Z]{2})*\s*\]\s*$', '', name)
        
        # Pattern 4: Full country names at end
        country_names = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Brazil', 'Mexico', 'India']
        for country in country_names:
            name = re.sub(rf'\s*[-–]\s*{country}\s*$', '', name, flags=re.IGNORECASE)
            name = re.sub(rf'\s*\(\s*{country}\s*\)\s*$', '', name, flags=re.IGNORECASE)
        
        return name.strip()
    
    def get_chart_data(
        self,
        user_id: str,
        date_range: Dict[str, datetime],
        metric: str = 'conversions',
        granularity: str = 'day',
        filters: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate time-series data for charts
        
        Args:
            user_id: User/Affiliate ID
            date_range: Date range
            metric: 'clicks', 'conversions', or 'revenue'
            granularity: 'hour', 'day', 'week', 'month'
            filters: Optional filters
        
        Returns:
            Chart data points
        """
        if not self._check_db_connection():
            return {'error': 'Database connection not available'}
        
        try:
            start_date = date_range['start']
            end_date = date_range['end']
            filters = filters or {}
            
            logger.info(f"📊 Chart Data Request: metric={metric}, user={user_id}, range={start_date} to {end_date}")
            
            # Get user info to check if admin
            user = self.users_collection.find_one({'_id': ObjectId(user_id)})
            is_admin = user and user.get('role') == 'admin'
            
            # Determine collection and field based on metric
            if metric in ['clicks', 'unique_clicks']:
                collection = self.clicks_collection  # offerwall_clicks_detailed
                date_field = 'timestamp'
                match_query = {
                    date_field: {'$gte': start_date, '$lte': end_date}
                }
                
                # Filter by user's placements if not admin
                if not is_admin:
                    username = user.get('username') if user else None
                    if username:
                        user_placements = list(self.placements_collection.find(
                            {'created_by': username},
                            {'_id': 1}
                        ))
                        placement_ids = [str(p['_id']) for p in user_placements]
                        
                        if placement_ids:
                            match_query['$or'] = [
                                {'placement_id': {'$in': placement_ids}},
                                {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                            ]
                
                # Also prepare dashboard clicks query
                dashboard_match_query = {
                    'timestamp': {'$gte': start_date, '$lte': end_date}
                }
                if not is_admin:
                    dashboard_match_query['user_id'] = user_id
                            
            else:  # conversions or revenue
                collection = self.conversions_collection  # forwarded_postbacks
                date_field = 'timestamp'
                match_query = {
                    date_field: {'$gte': start_date, '$lte': end_date},
                    'forward_status': 'success'
                }
                
                # Filter by publisher_id if not admin
                if not is_admin:
                    match_query['publisher_id'] = user_id
            
            # Apply filters
            if filters.get('offer_id'):
                match_query['offer_id'] = filters['offer_id']
            
            # Date format based on granularity
            date_formats = {
                'hour': '%Y-%m-%d %H:00',
                'day': '%Y-%m-%d',
                'week': '%Y-W%U',
                'month': '%Y-%m'
            }
            date_format = date_formats.get(granularity, '%Y-%m-%d')
            
            # Aggregation pipeline - use points for revenue from forwarded_postbacks
            sum_value = 1 if metric != 'revenue' else '$points'
            pipeline = [
                {'$match': match_query},
                {
                    '$group': {
                        '_id': {
                            '$dateToString': {'format': date_format, 'date': f'${date_field}'}
                        },
                        'value': {'$sum': sum_value}
                    }
                },
                {'$sort': {'_id': 1}}
            ]
            
            results = list(collection.aggregate(pipeline))
            
            # For clicks metric, also get clicks from ALL other collections and merge
            if metric in ['clicks', 'unique_clicks']:
                merged = {}
                
                # Start with offerwall_clicks_detailed results
                for row in results:
                    merged[row['_id']] = row['value']
                logger.info(f"📊 Chart: offerwall_clicks_detailed = {len(results)} data points")
                
                # Add offerwall_clicks (regular)
                if self.offerwall_clicks_collection is not None:
                    offerwall_match = {
                        'timestamp': {'$gte': start_date, '$lte': end_date}
                    }
                    if not is_admin:
                        username = user.get('username') if user else None
                        if username:
                            user_placements = list(self.placements_collection.find(
                                {'created_by': username},
                                {'_id': 1}
                            ))
                            placement_ids = [str(p['_id']) for p in user_placements]
                            if placement_ids:
                                offerwall_match['$or'] = [
                                    {'placement_id': {'$in': placement_ids}},
                                    {'placement_id': {'$in': [ObjectId(pid) for pid in placement_ids if ObjectId.is_valid(pid)]}}
                                ]
                    
                    offerwall_pipeline = [
                        {'$match': offerwall_match},
                        {
                            '$group': {
                                '_id': {'$dateToString': {'format': date_format, 'date': '$timestamp'}},
                                'value': {'$sum': 1}
                            }
                        },
                        {'$sort': {'_id': 1}}
                    ]
                    offerwall_results = list(self.offerwall_clicks_collection.aggregate(offerwall_pipeline))
                    logger.info(f"📊 Chart: offerwall_clicks = {len(offerwall_results)} data points")
                    for row in offerwall_results:
                        if row['_id'] in merged:
                            merged[row['_id']] += row['value']
                        else:
                            merged[row['_id']] = row['value']
                
                # Add simple clicks collection
                if self.simple_clicks_collection is not None:
                    simple_match = {
                        'timestamp': {'$gte': start_date, '$lte': end_date}
                    }
                    if not is_admin:
                        simple_match['user_id'] = user_id
                    
                    simple_pipeline = [
                        {'$match': simple_match},
                        {
                            '$group': {
                                '_id': {'$dateToString': {'format': date_format, 'date': '$timestamp'}},
                                'value': {'$sum': 1}
                            }
                        },
                        {'$sort': {'_id': 1}}
                    ]
                    simple_results = list(self.simple_clicks_collection.aggregate(simple_pipeline))
                    logger.info(f"📊 Chart: clicks (simple) = {len(simple_results)} data points")
                    for row in simple_results:
                        if row['_id'] in merged:
                            merged[row['_id']] += row['value']
                        else:
                            merged[row['_id']] = row['value']
                
                # Add dashboard clicks
                if self.dashboard_clicks_collection is not None:
                    dashboard_pipeline = [
                        {'$match': dashboard_match_query},
                        {
                            '$group': {
                                '_id': {'$dateToString': {'format': date_format, 'date': '$timestamp'}},
                                'value': {'$sum': 1}
                            }
                        },
                        {'$sort': {'_id': 1}}
                    ]
                    dashboard_results = list(self.dashboard_clicks_collection.aggregate(dashboard_pipeline))
                    logger.info(f"📊 Chart: dashboard_clicks = {len(dashboard_results)} data points")
                    for row in dashboard_results:
                        if row['_id'] in merged:
                            merged[row['_id']] += row['value']
                        else:
                            merged[row['_id']] = row['value']
                
                # Convert back to list and sort
                results = [{'_id': k, 'value': v} for k, v in sorted(merged.items())]
                logger.info(f"📊 Chart: TOTAL merged = {len(results)} data points, total clicks = {sum(r['value'] for r in results)}")
            
            # Format for chart
            chart_data = [
                {'date': row['_id'], 'value': row['value']}
                for row in results
            ]
            
            return {'chart_data': chart_data}
            
        except Exception as e:
            logger.error(f"Error generating chart data: {str(e)}", exc_info=True)
            return {'error': str(e)}
    
    def _calculate_summary(self, data: List[Dict]) -> Dict[str, Any]:
        """Calculate summary totals from report data"""
        if not data:
            return {
                'total_clicks': 0,
                'total_conversions': 0,
                'total_payout': 0.0,
                'avg_cr': 0.0,
                'avg_epc': 0.0
            }
        
        total_clicks = sum(row.get('clicks', 0) for row in data)
        total_conversions = sum(row.get('conversions', 0) for row in data)
        total_payout = sum(row.get('total_payout', 0.0) for row in data)
        
        return {
            'total_clicks': total_clicks,
            'total_conversions': total_conversions,
            'total_payout': round(total_payout, 2),
            'avg_cr': MetricsCalculator.calculate_cr(total_conversions, total_clicks),
            'avg_epc': MetricsCalculator.calculate_epc(total_payout, total_clicks)
        }
