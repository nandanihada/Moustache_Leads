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
        self.clicks_collection = db_instance.get_collection('clicks')
        self.conversions_collection = db_instance.get_collection('conversions')
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
            
            # Build match query - Show all data to all users (publishers see all platform activity)
            match_query = {
                'click_time': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
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
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}
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
            
            # Get aggregated click data
            click_results = list(self.clicks_collection.aggregate(pipeline))
            
            logger.info(f"🔍 Performance Report Debug:")
            logger.info(f"   User ID: {user_id}")
            logger.info(f"   Match Query: {match_query}")
            logger.info(f"   Click Results: {len(click_results)} groups")
            if click_results:
                logger.info(f"   First result: {click_results[0]}")
            
            # Now get conversion data for the same groups (support both user_id and affiliate_id)
            # Temporarily remove user_id filter to match clicks behavior (show all data)
            conversion_match = {
                'conversion_time': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
            if filters.get('offer_id'):
                conversion_match['offer_id'] = match_query.get('offer_id')
            if filters.get('country'):
                conversion_match['country'] = match_query.get('country')
            
            # Filter by conversion status if specified
            if filters.get('status'):
                conversion_match['status'] = filters['status']
            
            # Conversion aggregation
            conv_group_id = {}
            for field in group_by:
                if field == 'date':
                    conv_group_id['date'] = {
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$conversion_time'}
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
                # Join with clicks to get click_time for time spent calculation
                # Handle both ObjectId and string click_id formats
                {
                    '$lookup': {
                        'from': 'clicks',
                        'let': {'conv_click_id': '$click_id'},
                        'pipeline': [
                            {
                                '$match': {
                                    '$expr': {
                                        '$or': [
                                            {'$eq': ['$_id', '$$conv_click_id']},
                                            {'$eq': ['$click_id', '$$conv_click_id']}
                                        ]
                                    }
                                }
                            }
                        ],
                        'as': 'click_data'
                    }
                },
                # Add time_spent field
                {
                    '$addFields': {
                        'time_spent_seconds': {
                            '$cond': {
                                'if': {'$gt': [{'$size': '$click_data'}, 0]},
                                'then': {
                                    '$divide': [
                                        {'$subtract': ['$conversion_time', {'$arrayElemAt': ['$click_data.click_time', 0]}]},
                                        1000  # Convert milliseconds to seconds
                                    ]
                                },
                                'else': 0
                            }
                        }
                    }
                },
                {
                    '$group': {
                        '_id': conv_group_id,
                        'conversions': {'$sum': 1},
                        'approved_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}
                        },
                        'pending_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}
                        },
                        'rejected_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}
                        },
                        'total_payout': {'$sum': '$payout'},
                        # Calculate average time spent (conversion_time - click_time)
                        'avg_time_spent_seconds': {'$avg': '$time_spent_seconds'}
                        # Note: revenue field doesn't exist in conversions, using payout as revenue
                    }
                }
            ]
            
            conversion_results = list(self.conversions_collection.aggregate(conv_pipeline))
            
            # Merge click and conversion data
            merged_data = {}
            
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
                        row['offer_name'] = offer.get('name', 'Unknown')
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
            
            # Build query - Show all conversions to all users
            query = {
                'conversion_time': {
                    '$gte': start_date,
                    '$lte': end_date
                }
            }
            
            # Apply filters
            if filters.get('offer_id'):
                query['offer_id'] = filters['offer_id']
            if filters.get('status'):
                query['status'] = filters['status']
            if filters.get('country'):
                query['country'] = filters['country']
            if filters.get('transaction_id'):
                query['transaction_id'] = filters['transaction_id']
            
            # Count total
            total = self.conversions_collection.count_documents(query)
            
            # Pagination
            page = pagination['page']
            per_page = pagination['per_page']
            skip = (page - 1) * per_page
            
            # Fetch conversions
            conversions_cursor = self.conversions_collection.find(query).sort('conversion_time', -1).skip(skip).limit(per_page)
            conversions = list(conversions_cursor)
            
            # Enrich with ALL fields from offers and clicks (same as Performance Report)
            for conv in conversions:
                # Get offer details - ALL FIELDS
                offer = self.offers_collection.find_one({'offer_id': conv['offer_id']})
                if offer:
                    conv['offer_name'] = offer.get('name', 'Unknown')
                    conv['network'] = offer.get('network', 'Unknown')
                    # Phase 2 fields
                    conv['offer_url'] = offer.get('url', '')
                    conv['category'] = offer.get('category', 'Uncategorized')
                    conv['currency'] = offer.get('currency', 'USD')
                    # Phase 3 fields
                    conv['ad_group'] = offer.get('ad_group', '')
                    conv['goal'] = offer.get('goal', '')
                    conv['promo_code'] = offer.get('promo_code', '')
                else:
                    conv['offer_name'] = 'Unknown Offer'
                    conv['offer_url'] = ''
                    conv['category'] = 'Unknown'
                    conv['currency'] = 'USD'
                    conv['ad_group'] = ''
                    conv['goal'] = ''
                    conv['promo_code'] = ''
                
                # Get click data - ALL FIELDS
                click = self.clicks_collection.find_one({'click_id': conv['click_id']})
                if click:
                    # Basic fields
                    conv['device_type'] = click.get('device_type', 'Unknown')
                    conv['browser'] = click.get('browser', 'Unknown')
                    conv['os'] = click.get('os', 'Unknown')
                    conv['source'] = click.get('referer', '')
                    # Phase 3 fields
                    conv['creative'] = click.get('creative', '')
                    conv['app_version'] = click.get('app_version', '')
                    conv['advertiser_sub_id1'] = click.get('advertiser_sub_id1', '')
                    conv['advertiser_sub_id2'] = click.get('advertiser_sub_id2', '')
                    conv['advertiser_sub_id3'] = click.get('advertiser_sub_id3', '')
                    conv['advertiser_sub_id4'] = click.get('advertiser_sub_id4', '')
                    conv['advertiser_sub_id5'] = click.get('advertiser_sub_id5', '')
                    # Sub IDs
                    conv['sub_id1'] = click.get('sub_id1', '')
                    conv['sub_id2'] = click.get('sub_id2', '')
                    conv['sub_id3'] = click.get('sub_id3', '')
                    conv['sub_id4'] = click.get('sub_id4', '')
                    conv['sub_id5'] = click.get('sub_id5', '')
                else:
                    # Default values when no click found
                    conv['device_type'] = 'Unknown'
                    conv['browser'] = 'Unknown'
                    conv['os'] = 'Unknown'
                    conv['source'] = ''
                    conv['creative'] = ''
                    conv['app_version'] = ''
                    conv['advertiser_sub_id1'] = ''
                    conv['advertiser_sub_id2'] = ''
                    conv['advertiser_sub_id3'] = ''
                    conv['advertiser_sub_id4'] = ''
                    conv['advertiser_sub_id5'] = ''
                    conv['sub_id1'] = ''
                    conv['sub_id2'] = ''
                    conv['sub_id3'] = ''
                    conv['sub_id4'] = ''
                    conv['sub_id5'] = ''
                
                # Format datetime
                conv['time'] = conv['conversion_time'].strftime('%Y-%m-%d %H:%M:%S')
                
                # Convert ObjectIds to strings
                conv['_id'] = str(conv['_id'])
            
            # Calculate summary
            summary_pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': None,
                        'approved_payout': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, '$payout', 0]}
                        },
                        'pending_payout': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'pending']}, '$payout', 0]}
                        },
                        'rejected_payout': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, '$payout', 0]}
                        },
                        'total_conversions': {'$sum': 1},
                        'approved_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}
                        },
                        'pending_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}
                        },
                        'rejected_conversions': {
                            '$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}
                        }
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
            
            # Determine collection and field based on metric (support both user_id and affiliate_id)
            if metric in ['clicks', 'unique_clicks']:
                collection = self.clicks_collection
                date_field = 'click_time'
                match_query = {
                    '$or': [
                        {'affiliate_id': user_id},
                        {'user_id': user_id}
                    ],
                    date_field: {'$gte': start_date, '$lte': end_date}
                }
            else:  # conversions or revenue
                collection = self.conversions_collection
                date_field = 'conversion_time'
                match_query = {
                    '$or': [
                        {'affiliate_id': user_id},
                        {'user_id': user_id}
                    ],
                    date_field: {'$gte': start_date, '$lte': end_date}
                }
            
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
            
            # Aggregation pipeline
            pipeline = [
                {'$match': match_query},
                {
                    '$group': {
                        '_id': {
                            '$dateToString': {'format': date_format, 'date': f'${date_field}'}
                        },
                        'value': {'$sum': 1 if metric != 'revenue' else '$payout'}
                    }
                },
                {'$sort': {'_id': 1}}
            ]
            
            results = list(collection.aggregate(pipeline))
            
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
