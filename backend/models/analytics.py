from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import re
from collections import defaultdict

class Analytics:
    def __init__(self):
        self.clicks_collection = db_instance.get_collection('click_tracking')
        self.conversions_collection = db_instance.get_collection('conversions')
        self.fraud_logs_collection = db_instance.get_collection('fraud_logs')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.clicks_collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.clicks_collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def track_click(self, click_data):
        """Track a click event with fraud detection"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Extract click information
            offer_id = click_data.get('offer_id')
            user_id = click_data.get('user_id')
            ip_address = click_data.get('ip_address')
            user_agent = click_data.get('user_agent')
            referrer = click_data.get('referrer')
            subid = click_data.get('subid')
            masked_link_id = click_data.get('masked_link_id')
            
            # Fraud detection
            fraud_score, fraud_reasons = self._detect_fraud(click_data)
            
            # Create click record
            click_record = {
                'offer_id': offer_id,
                'user_id': user_id,
                'masked_link_id': masked_link_id,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'referrer': referrer,
                'subid': subid,
                'country': click_data.get('country'),
                'device_type': self._detect_device_type(user_agent),
                'browser': self._detect_browser(user_agent),
                'os': self._detect_os(user_agent),
                'fraud_score': fraud_score,
                'fraud_reasons': fraud_reasons,
                'is_fraud': fraud_score > 70,  # Threshold for fraud
                'is_unique': self._is_unique_click(offer_id, user_id, ip_address),
                'timestamp': datetime.utcnow(),
                'conversion_status': 'pending'
            }
            
            # Insert click record
            result = self.clicks_collection.insert_one(click_record)
            click_record['_id'] = result.inserted_id
            
            # Log fraud if detected
            if click_record['is_fraud']:
                self._log_fraud_attempt(click_record)
            
            return click_record, None
            
        except Exception as e:
            return None, f"Error tracking click: {str(e)}"
    
    def track_conversion(self, conversion_data):
        """Track a conversion event"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Find the original click
            click_id = conversion_data.get('click_id')
            subid = conversion_data.get('subid')
            
            # Try to find click by ID or SubID
            click_query = {}
            if click_id:
                click_query['_id'] = ObjectId(click_id)
            elif subid:
                click_query['subid'] = subid
            else:
                return None, "No click ID or SubID provided"
            
            click_record = self.clicks_collection.find_one(click_query)
            if not click_record:
                return None, "Original click not found"
            
            # Check for duplicate conversion
            existing_conversion = self.conversions_collection.find_one({
                'click_id': click_record['_id']
            })
            if existing_conversion:
                return None, "Conversion already recorded for this click"
            
            # Create conversion record
            conversion_record = {
                'click_id': click_record['_id'],
                'offer_id': click_record['offer_id'],
                'user_id': click_record['user_id'],
                'subid': click_record['subid'],
                'payout': conversion_data.get('payout', 0),
                'revenue': conversion_data.get('revenue', 0),
                'conversion_type': conversion_data.get('conversion_type', 'lead'),
                'conversion_value': conversion_data.get('conversion_value'),
                'ip_address': click_record['ip_address'],
                'time_to_convert': datetime.utcnow() - click_record['timestamp'],
                'timestamp': datetime.utcnow(),
                'status': 'approved'  # pending, approved, rejected
            }
            
            # Insert conversion record
            result = self.conversions_collection.insert_one(conversion_record)
            conversion_record['_id'] = result.inserted_id
            
            # Update click record
            self.clicks_collection.update_one(
                {'_id': click_record['_id']},
                {'$set': {'conversion_status': 'converted', 'converted_at': datetime.utcnow()}}
            )
            
            return conversion_record, None
            
        except Exception as e:
            return None, f"Error tracking conversion: {str(e)}"
    
    def _detect_fraud(self, click_data):
        """Detect potential fraud in click data"""
        fraud_score = 0
        fraud_reasons = []
        
        try:
            ip_address = click_data.get('ip_address')
            user_agent = click_data.get('user_agent')
            offer_id = click_data.get('offer_id')
            user_id = click_data.get('user_id')
            
            # Check for suspicious IP patterns
            if ip_address:
                # Check for too many clicks from same IP in short time
                recent_clicks = self.clicks_collection.count_documents({
                    'ip_address': ip_address,
                    'timestamp': {'$gte': datetime.utcnow() - timedelta(minutes=5)}
                })
                if recent_clicks > 10:
                    fraud_score += 30
                    fraud_reasons.append('Too many clicks from same IP')
                
                # Check for known bad IP ranges (simplified)
                if ip_address.startswith(('127.', '10.', '192.168.')):
                    fraud_score += 20
                    fraud_reasons.append('Private/Local IP address')
            
            # Check user agent
            if user_agent:
                # Check for bot signatures
                bot_signatures = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget']
                if any(sig in user_agent.lower() for sig in bot_signatures):
                    fraud_score += 50
                    fraud_reasons.append('Bot user agent detected')
                
                # Check for empty or suspicious user agents
                if len(user_agent) < 10:
                    fraud_score += 25
                    fraud_reasons.append('Suspicious user agent')
            
            # Check for rapid successive clicks from same user
            if user_id:
                recent_user_clicks = self.clicks_collection.count_documents({
                    'user_id': user_id,
                    'offer_id': offer_id,
                    'timestamp': {'$gte': datetime.utcnow() - timedelta(minutes=1)}
                })
                if recent_user_clicks > 3:
                    fraud_score += 40
                    fraud_reasons.append('Too many clicks from same user')
            
            # Check referrer patterns
            referrer = click_data.get('referrer')
            if referrer:
                # Check for suspicious referrers
                suspicious_domains = ['click-farm', 'bot-traffic', 'fake-traffic']
                if any(domain in referrer.lower() for domain in suspicious_domains):
                    fraud_score += 35
                    fraud_reasons.append('Suspicious referrer domain')
            
            return min(fraud_score, 100), fraud_reasons
            
        except Exception:
            return 0, []
    
    def _is_unique_click(self, offer_id, user_id, ip_address):
        """Check if this is a unique click"""
        if not self._check_db_connection():
            return True
        
        try:
            # Check for previous clicks from same user/IP for this offer
            existing_click = self.clicks_collection.find_one({
                'offer_id': offer_id,
                '$or': [
                    {'user_id': user_id},
                    {'ip_address': ip_address}
                ]
            })
            return existing_click is None
        except:
            return True
    
    def _detect_device_type(self, user_agent):
        """Detect device type from user agent"""
        if not user_agent:
            return 'unknown'
        
        user_agent_lower = user_agent.lower()
        if any(mobile in user_agent_lower for mobile in ['mobile', 'android', 'iphone', 'ipad']):
            return 'mobile'
        elif 'tablet' in user_agent_lower:
            return 'tablet'
        else:
            return 'desktop'
    
    def _detect_browser(self, user_agent):
        """Detect browser from user agent"""
        if not user_agent:
            return 'unknown'
        
        user_agent_lower = user_agent.lower()
        if 'chrome' in user_agent_lower:
            return 'chrome'
        elif 'firefox' in user_agent_lower:
            return 'firefox'
        elif 'safari' in user_agent_lower:
            return 'safari'
        elif 'edge' in user_agent_lower:
            return 'edge'
        else:
            return 'other'
    
    def _detect_os(self, user_agent):
        """Detect operating system from user agent"""
        if not user_agent:
            return 'unknown'
        
        user_agent_lower = user_agent.lower()
        if 'windows' in user_agent_lower:
            return 'windows'
        elif 'mac' in user_agent_lower or 'darwin' in user_agent_lower:
            return 'macos'
        elif 'linux' in user_agent_lower:
            return 'linux'
        elif 'android' in user_agent_lower:
            return 'android'
        elif 'ios' in user_agent_lower or 'iphone' in user_agent_lower:
            return 'ios'
        else:
            return 'other'
    
    def _log_fraud_attempt(self, click_record):
        """Log fraud attempt for analysis"""
        try:
            fraud_log = {
                'click_id': click_record['_id'],
                'offer_id': click_record['offer_id'],
                'ip_address': click_record['ip_address'],
                'user_agent': click_record['user_agent'],
                'fraud_score': click_record['fraud_score'],
                'fraud_reasons': click_record['fraud_reasons'],
                'timestamp': datetime.utcnow()
            }
            self.fraud_logs_collection.insert_one(fraud_log)
        except:
            pass  # Don't fail the main operation if logging fails
    
    def get_analytics_dashboard(self, filters=None):
        """Get comprehensive analytics data"""
        if not self._check_db_connection():
            return {}
        
        try:
            # Date range filter
            date_filter = {}
            if filters and filters.get('date_range'):
                if filters['date_range'] == '24h':
                    date_filter = {'timestamp': {'$gte': datetime.utcnow() - timedelta(hours=24)}}
                elif filters['date_range'] == '7d':
                    date_filter = {'timestamp': {'$gte': datetime.utcnow() - timedelta(days=7)}}
                elif filters['date_range'] == '30d':
                    date_filter = {'timestamp': {'$gte': datetime.utcnow() - timedelta(days=30)}}
            
            # Basic metrics
            total_clicks = self.clicks_collection.count_documents(date_filter)
            unique_clicks = self.clicks_collection.count_documents({**date_filter, 'is_unique': True})
            fraud_clicks = self.clicks_collection.count_documents({**date_filter, 'is_fraud': True})
            total_conversions = self.conversions_collection.count_documents(date_filter)
            
            # Conversion rate
            conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
            
            # Revenue metrics
            revenue_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': None,
                    'total_revenue': {'$sum': '$revenue'},
                    'total_payout': {'$sum': '$payout'}
                }}
            ]
            revenue_result = list(self.conversions_collection.aggregate(revenue_pipeline))
            total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
            total_payout = revenue_result[0]['total_payout'] if revenue_result else 0
            
            # Top offers
            top_offers_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': '$offer_id',
                    'clicks': {'$sum': 1},
                    'unique_clicks': {'$sum': {'$cond': ['$is_unique', 1, 0]}},
                    'fraud_clicks': {'$sum': {'$cond': ['$is_fraud', 1, 0]}}
                }},
                {'$sort': {'clicks': -1}},
                {'$limit': 10}
            ]
            top_offers = list(self.clicks_collection.aggregate(top_offers_pipeline))
            
            # Device breakdown
            device_pipeline = [
                {'$match': date_filter},
                {'$group': {
                    '_id': '$device_type',
                    'count': {'$sum': 1}
                }}
            ]
            device_breakdown = list(self.clicks_collection.aggregate(device_pipeline))
            
            # Hourly trends (last 24 hours)
            hourly_pipeline = [
                {'$match': {'timestamp': {'$gte': datetime.utcnow() - timedelta(hours=24)}}},
                {'$group': {
                    '_id': {
                        'hour': {'$hour': '$timestamp'},
                        'date': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}}
                    },
                    'clicks': {'$sum': 1},
                    'conversions': {'$sum': {'$cond': [{'$eq': ['$conversion_status', 'converted']}, 1, 0]}}
                }},
                {'$sort': {'_id.date': 1, '_id.hour': 1}}
            ]
            hourly_trends = list(self.clicks_collection.aggregate(hourly_pipeline))
            
            return {
                'summary': {
                    'total_clicks': total_clicks,
                    'unique_clicks': unique_clicks,
                    'fraud_clicks': fraud_clicks,
                    'total_conversions': total_conversions,
                    'conversion_rate': round(conversion_rate, 2),
                    'total_revenue': total_revenue,
                    'total_payout': total_payout,
                    'profit': total_revenue - total_payout,
                    'fraud_rate': round((fraud_clicks / total_clicks * 100) if total_clicks > 0 else 0, 2)
                },
                'top_offers': top_offers,
                'device_breakdown': device_breakdown,
                'hourly_trends': hourly_trends
            }
            
        except Exception as e:
            return {'error': f"Error getting analytics: {str(e)}"}
    
    def get_fraud_report(self, filters=None):
        """Get detailed fraud analysis report"""
        if not self._check_db_connection():
            return {}
        
        try:
            # Date range filter
            date_filter = {}
            if filters and filters.get('date_range'):
                if filters['date_range'] == '24h':
                    date_filter = {'timestamp': {'$gte': datetime.utcnow() - timedelta(hours=24)}}
                elif filters['date_range'] == '7d':
                    date_filter = {'timestamp': {'$gte': datetime.utcnow() - timedelta(days=7)}}
            
            # Fraud by reason
            fraud_reasons_pipeline = [
                {'$match': {**date_filter, 'is_fraud': True}},
                {'$unwind': '$fraud_reasons'},
                {'$group': {
                    '_id': '$fraud_reasons',
                    'count': {'$sum': 1}
                }},
                {'$sort': {'count': -1}}
            ]
            fraud_by_reason = list(self.clicks_collection.aggregate(fraud_reasons_pipeline))
            
            # Top fraud IPs
            fraud_ips_pipeline = [
                {'$match': {**date_filter, 'is_fraud': True}},
                {'$group': {
                    '_id': '$ip_address',
                    'count': {'$sum': 1},
                    'avg_fraud_score': {'$avg': '$fraud_score'}
                }},
                {'$sort': {'count': -1}},
                {'$limit': 20}
            ]
            top_fraud_ips = list(self.clicks_collection.aggregate(fraud_ips_pipeline))
            
            return {
                'fraud_by_reason': fraud_by_reason,
                'top_fraud_ips': top_fraud_ips
            }
            
        except Exception as e:
            return {'error': f"Error getting fraud report: {str(e)}"}
