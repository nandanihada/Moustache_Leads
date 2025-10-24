"""
Frontend to Database Field Mapping Utilities
Handles conversion between frontend form data and database schema
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
import re

class FrontendDatabaseMapper:
    """Utility class to map frontend fields to database schema and vice versa"""
    
    @staticmethod
    def map_frontend_to_database(frontend_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert frontend form data to database schema format
        
        Args:
            frontend_data: Data from frontend form submission
            
        Returns:
            Dict formatted for database insertion
        """
        mapped_data = frontend_data.copy()
        
        # Map schedule data
        if 'schedule' in frontend_data:
            mapped_data['schedule'] = FrontendDatabaseMapper._map_schedule_frontend_to_db(
                frontend_data['schedule']
            )
        
        # Map smart rules data
        if 'smartRules' in frontend_data:
            mapped_data['smartRules'] = FrontendDatabaseMapper._map_smart_rules_frontend_to_db(
                frontend_data['smartRules']
            )
        
        return mapped_data
    
    @staticmethod
    def map_database_to_frontend(database_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert database document to frontend format
        
        Args:
            database_data: Document from database
            
        Returns:
            Dict formatted for frontend consumption
        """
        mapped_data = database_data.copy()
        
        # Map schedule data
        if 'schedule' in database_data:
            mapped_data['schedule'] = FrontendDatabaseMapper._map_schedule_db_to_frontend(
                database_data['schedule']
            )
        
        # Map smart rules data
        if 'smartRules' in database_data:
            mapped_data['smartRules'] = FrontendDatabaseMapper._map_smart_rules_db_to_frontend(
                database_data['smartRules']
            )
        
        return mapped_data
    
    @staticmethod
    def _map_schedule_frontend_to_db(frontend_schedule: Dict[str, Any]) -> Dict[str, Any]:
        """Map frontend schedule format to database format"""
        db_schedule = {}
        
        # Combine startDate + startTime → startAt
        start_date = frontend_schedule.get('startDate')
        start_time = frontend_schedule.get('startTime', '')
        
        if start_date:
            if isinstance(start_date, str):
                # Parse ISO date string
                try:
                    start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                except ValueError:
                    start_dt = datetime.fromisoformat(start_date)
            else:
                start_dt = start_date
            
            # Add time component if provided
            if start_time:
                try:
                    time_parts = start_time.split(':')
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                    start_dt = start_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
                except (ValueError, IndexError):
                    pass  # Keep original datetime if time parsing fails
            
            db_schedule['startAt'] = start_dt
        
        # Combine endDate + endTime → endAt
        end_date = frontend_schedule.get('endDate')
        end_time = frontend_schedule.get('endTime', '')
        
        if end_date:
            if isinstance(end_date, str):
                try:
                    end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                except ValueError:
                    end_dt = datetime.fromisoformat(end_date)
            else:
                end_dt = end_date
            
            # Add time component if provided
            if end_time:
                try:
                    time_parts = end_time.split(':')
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                    end_dt = end_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
                except (ValueError, IndexError):
                    pass
            
            db_schedule['endAt'] = end_dt
        
        # Map weekdays → recurringDays
        if 'weekdays' in frontend_schedule:
            db_schedule['recurringDays'] = frontend_schedule['weekdays']
        
        # Direct mappings
        for field in ['status', 'timezone', 'isRecurring']:
            if field in frontend_schedule:
                db_schedule[field] = frontend_schedule[field]
        
        return db_schedule
    
    @staticmethod
    def _map_schedule_db_to_frontend(db_schedule: Dict[str, Any]) -> Dict[str, Any]:
        """Map database schedule format to frontend format"""
        frontend_schedule = {}
        
        # Split startAt → startDate + startTime
        start_at = db_schedule.get('startAt')
        if start_at:
            if isinstance(start_at, datetime):
                frontend_schedule['startDate'] = start_at.date().isoformat()
                frontend_schedule['startTime'] = start_at.time().strftime('%H:%M')
            elif isinstance(start_at, str):
                try:
                    dt = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
                    frontend_schedule['startDate'] = dt.date().isoformat()
                    frontend_schedule['startTime'] = dt.time().strftime('%H:%M')
                except ValueError:
                    frontend_schedule['startDate'] = start_at
                    frontend_schedule['startTime'] = ''
        
        # Split endAt → endDate + endTime
        end_at = db_schedule.get('endAt')
        if end_at:
            if isinstance(end_at, datetime):
                frontend_schedule['endDate'] = end_at.date().isoformat()
                frontend_schedule['endTime'] = end_at.time().strftime('%H:%M')
            elif isinstance(end_at, str):
                try:
                    dt = datetime.fromisoformat(end_at.replace('Z', '+00:00'))
                    frontend_schedule['endDate'] = dt.date().isoformat()
                    frontend_schedule['endTime'] = dt.time().strftime('%H:%M')
                except ValueError:
                    frontend_schedule['endDate'] = end_at
                    frontend_schedule['endTime'] = ''
        
        # Map recurringDays → weekdays
        if 'recurringDays' in db_schedule:
            frontend_schedule['weekdays'] = db_schedule['recurringDays']
        
        # Direct mappings
        for field in ['status', 'timezone', 'isRecurring']:
            if field in db_schedule:
                frontend_schedule[field] = db_schedule[field]
        
        return frontend_schedule
    
    @staticmethod
    def _map_smart_rules_frontend_to_db(frontend_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map frontend smart rules format to database format"""
        db_rules = []
        
        for rule in frontend_rules:
            db_rule = {}
            
            # Map destinationUrl → url
            if 'destinationUrl' in rule:
                db_rule['url'] = rule['destinationUrl']
            
            # Map splitPercentage → percentage
            if 'splitPercentage' in rule:
                db_rule['percentage'] = rule['splitPercentage']
            
            # Direct mappings
            for field in ['type', 'geo', 'cap', 'priority', 'active']:
                if field in rule:
                    db_rule[field] = rule[field]
            
            # Add creation timestamp if not present
            if 'createdAt' not in db_rule:
                db_rule['createdAt'] = datetime.utcnow()
            
            db_rules.append(db_rule)
        
        return db_rules
    
    @staticmethod
    def _map_smart_rules_db_to_frontend(db_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map database smart rules format to frontend format"""
        frontend_rules = []
        
        for rule in db_rules:
            frontend_rule = {}
            
            # Map _id → id
            if '_id' in rule:
                frontend_rule['id'] = str(rule['_id'])
            
            # Map url → destinationUrl
            if 'url' in rule:
                frontend_rule['destinationUrl'] = rule['url']
            
            # Map percentage → splitPercentage
            if 'percentage' in rule:
                frontend_rule['splitPercentage'] = rule['percentage']
            
            # Direct mappings
            for field in ['type', 'geo', 'cap', 'priority', 'active']:
                if field in rule:
                    frontend_rule[field] = rule[field]
            
            frontend_rules.append(frontend_rule)
        
        return frontend_rules
    
    @staticmethod
    def validate_frontend_data(frontend_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Validate frontend data before mapping to database
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Validate schedule data
        if 'schedule' in frontend_data:
            schedule_errors = FrontendDatabaseMapper._validate_schedule(frontend_data['schedule'])
            errors.extend(schedule_errors)
        
        # Validate smart rules data
        if 'smartRules' in frontend_data:
            rules_errors = FrontendDatabaseMapper._validate_smart_rules(frontend_data['smartRules'])
            errors.extend(rules_errors)
        
        return len(errors) == 0, errors
    
    @staticmethod
    def _validate_schedule(schedule_data: Dict[str, Any]) -> List[str]:
        """Validate schedule data"""
        errors = []
        
        start_date = schedule_data.get('startDate')
        end_date = schedule_data.get('endDate')
        
        # Validate date range
        if start_date and end_date:
            try:
                start_dt = datetime.fromisoformat(start_date) if isinstance(start_date, str) else start_date
                end_dt = datetime.fromisoformat(end_date) if isinstance(end_date, str) else end_date
                
                if end_dt <= start_dt:
                    errors.append("End date must be after start date")
            except (ValueError, TypeError):
                errors.append("Invalid date format in schedule")
        
        # Validate status
        status = schedule_data.get('status')
        if status and status not in ['Active', 'Paused']:
            errors.append(f"Invalid schedule status: {status}")
        
        # Validate weekdays
        weekdays = schedule_data.get('weekdays', [])
        valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        for day in weekdays:
            if day not in valid_days:
                errors.append(f"Invalid weekday: {day}")
        
        return errors
    
    @staticmethod
    def _validate_smart_rules(rules_data: List[Dict[str, Any]]) -> List[str]:
        """Validate smart rules data"""
        errors = []
        priorities = []
        
        for i, rule in enumerate(rules_data):
            rule_prefix = f"Rule {i+1}: "
            
            # Validate rule type
            rule_type = rule.get('type')
            if rule_type not in ['Backup', 'Rotation', 'GEO', 'Time']:
                errors.append(f"{rule_prefix}Invalid rule type: {rule_type}")
            
            # Validate URL
            url = rule.get('destinationUrl') or rule.get('url')
            if not url or not re.match(r'^https?://.+', url):
                errors.append(f"{rule_prefix}Invalid or missing URL")
            
            # Validate percentage
            percentage = rule.get('splitPercentage') or rule.get('percentage', 0)
            if not isinstance(percentage, (int, float)) or percentage < 0 or percentage > 100:
                errors.append(f"{rule_prefix}Percentage must be between 0-100")
            
            # Validate cap
            cap = rule.get('cap', 0)
            if not isinstance(cap, (int, float)) or cap < 0:
                errors.append(f"{rule_prefix}Cap must be >= 0")
            
            # Validate priority
            priority = rule.get('priority', 1)
            if not isinstance(priority, int) or priority < 1:
                errors.append(f"{rule_prefix}Priority must be >= 1")
            elif priority in priorities:
                errors.append(f"{rule_prefix}Duplicate priority: {priority}")
            else:
                priorities.append(priority)
            
            # Validate geo codes
            geo = rule.get('geo', [])
            for country_code in geo:
                if not isinstance(country_code, str) or len(country_code) != 2:
                    errors.append(f"{rule_prefix}Invalid country code: {country_code}")
        
        return errors

# Convenience functions for direct use
def frontend_to_database(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert frontend data to database format"""
    return FrontendDatabaseMapper.map_frontend_to_database(data)

def database_to_frontend(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert database data to frontend format"""
    return FrontendDatabaseMapper.map_database_to_frontend(data)

def validate_frontend_data(data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """Validate frontend data"""
    return FrontendDatabaseMapper.validate_frontend_data(data)
