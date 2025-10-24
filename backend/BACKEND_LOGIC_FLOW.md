# Backend Logic Flow: Schedule + Smart Rules

## 🎯 **Overview**

This document describes the backend logic execution for offer scheduling and smart rules resolution in the Ascend affiliate marketing platform.

---

## 🕒 **COMPONENT 1: OFFER ACTIVATION CRON JOB**

### **Purpose**
Automatically activate/deactivate offers based on their schedule configuration.

### **Execution Frequency**
- **Primary Check**: Every 1 minute
- **Secondary Check**: Every 15 minutes (backup)
- **Daily Cleanup**: Every 24 hours at 00:00 UTC

### **Cron Job Pseudocode**

```python
# File: services/schedule_activation_service.py

class ScheduleActivationService:
    
    def __init__(self):
        self.offer_model = OfferExtended()
        self.logger = logging.getLogger(__name__)
    
    def run_activation_check(self):
        """Main cron job function - runs every minute"""
        try:
            current_time = datetime.utcnow()
            
            # STEP 1: Get all offers with schedules
            offers_with_schedules = self.get_scheduled_offers()
            
            # STEP 2: Process each offer
            for offer in offers_with_schedules:
                self.process_offer_activation(offer, current_time)
                
            # STEP 3: Log summary
            self.log_activation_summary()
            
        except Exception as e:
            self.logger.error(f"Activation check failed: {str(e)}")
    
    def process_offer_activation(self, offer, current_time):
        """Process individual offer activation logic"""
        
        offer_id = offer['offer_id']
        schedule = offer.get('schedule', {})
        
        # Skip if no schedule configured
        if not schedule:
            return
        
        # STEP 1: Check basic schedule status
        if schedule.get('status') != 'Active':
            self.deactivate_offer(offer_id, "Schedule is paused")
            return
        
        # STEP 2: Check date range
        start_at = schedule.get('startAt')
        end_at = schedule.get('endAt')
        
        # Before start time
        if start_at and current_time < start_at:
            self.deactivate_offer(offer_id, "Offer has not started yet")
            return
        
        # After end time
        if end_at and current_time > end_at:
            self.deactivate_offer(offer_id, "Offer has expired")
            return
        
        # STEP 3: Check recurring schedule
        if schedule.get('isRecurring') and schedule.get('recurringDays'):
            current_day = current_time.strftime('%A')  # Monday, Tuesday, etc.
            
            if current_day not in schedule.get('recurringDays', []):
                self.deactivate_offer(offer_id, f"Not active on {current_day}")
                return
        
        # STEP 4: Check smart rules availability
        smart_rules = offer.get('smartRules', [])
        active_rules = [rule for rule in smart_rules if rule.get('active', True)]
        
        if len(active_rules) == 0:
            self.deactivate_offer(offer_id, "No active smart rules configured")
            return
        
        # STEP 5: All checks passed - activate offer
        self.activate_offer(offer_id, "Schedule and rules active")
    
    def activate_offer(self, offer_id, reason):
        """Activate an offer"""
        result = self.offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$set': {
                    'status': 'Active',
                    'last_activation_check': datetime.utcnow(),
                    'activation_reason': reason
                }
            }
        )
        
        if result.modified_count > 0:
            self.logger.info(f"✅ Activated offer {offer_id}: {reason}")
    
    def deactivate_offer(self, offer_id, reason):
        """Deactivate an offer"""
        result = self.offer_model.collection.update_one(
            {'offer_id': offer_id},
            {
                '$set': {
                    'status': 'Inactive',
                    'last_activation_check': datetime.utcnow(),
                    'deactivation_reason': reason
                }
            }
        )
        
        if result.modified_count > 0:
            self.logger.info(f"❌ Deactivated offer {offer_id}: {reason}")

# Cron job setup
def setup_activation_cron():
    """Setup cron job for offer activation"""
    import schedule
    
    # Every minute check
    schedule.every(1).minutes.do(ScheduleActivationService().run_activation_check)
    
    # Backup check every 15 minutes
    schedule.every(15).minutes.do(ScheduleActivationService().run_activation_check)
    
    # Daily cleanup at midnight UTC
    schedule.every().day.at("00:00").do(ScheduleActivationService().daily_cleanup)
```

---

## ⚡ **COMPONENT 2: SMART RULES RESOLVER**

### **Purpose**
When a user clicks an offer link, determine which destination URL to serve based on smart rules logic.

### **Execution Trigger**
- User clicks offer link: `/click/{offer_id}?subid={subid}&geo={country}`
- Real-time resolution (< 100ms response time)

### **Smart Rules Resolver Pseudocode**

```python
# File: services/smart_rules_resolver.py

class SmartRulesResolver:
    
    def __init__(self):
        self.offer_model = OfferExtended()
        self.tracking_service = TrackingService()
        self.logger = logging.getLogger(__name__)
    
    def resolve_destination_url(self, offer_id, user_context):
        """
        Main resolver function - determines destination URL
        
        Args:
            offer_id: Offer identifier (ML-00123)
            user_context: {
                'geo': 'US',
                'subid': 'affiliate_123',
                'ip': '192.168.1.1',
                'user_agent': 'Mozilla/5.0...',
                'timestamp': datetime.utcnow()
            }
        
        Returns:
            {
                'destination_url': 'https://example.com/landing',
                'rule_applied': 'GEO_US_Priority_1',
                'tracking_data': {...}
            }
        """
        
        try:
            # STEP 1: Get offer and validate
            offer = self.get_active_offer(offer_id)
            if not offer:
                return self.get_error_response("Offer not found or inactive")
            
            # STEP 2: Get applicable smart rules
            applicable_rules = self.get_applicable_rules(offer, user_context)
            if not applicable_rules:
                return self.get_error_response("No applicable rules found")
            
            # STEP 3: Apply rule resolution logic
            selected_rule = self.apply_resolution_logic(applicable_rules, user_context)
            if not selected_rule:
                return self.get_error_response("Rule resolution failed")
            
            # STEP 4: Check caps and limits
            if not self.check_rule_caps(selected_rule, offer_id):
                # Try backup rules
                backup_rule = self.get_backup_rule(applicable_rules)
                if backup_rule:
                    selected_rule = backup_rule
                else:
                    return self.get_error_response("All rules at capacity")
            
            # STEP 5: Track click and return URL
            self.track_click(offer_id, selected_rule, user_context)
            
            return {
                'destination_url': selected_rule['url'],
                'rule_applied': f"{selected_rule['type']}_{selected_rule['priority']}",
                'rule_id': str(selected_rule['_id']),
                'tracking_data': {
                    'offer_id': offer_id,
                    'rule_id': str(selected_rule['_id']),
                    'geo': user_context['geo'],
                    'timestamp': user_context['timestamp'].isoformat()
                }
            }
            
        except Exception as e:
            self.logger.error(f"Resolution failed for {offer_id}: {str(e)}")
            return self.get_error_response("Internal resolution error")
    
    def get_applicable_rules(self, offer, user_context):
        """Filter rules based on user context"""
        
        smart_rules = offer.get('smartRules', [])
        applicable_rules = []
        
        for rule in smart_rules:
            # Skip inactive rules
            if not rule.get('active', True):
                continue
            
            # Check GEO targeting
            if rule.get('geo') and user_context['geo'] not in rule['geo']:
                continue
            
            # Check time-based rules (if type is 'Time')
            if rule.get('type') == 'Time':
                if not self.check_time_constraints(rule, user_context['timestamp']):
                    continue
            
            applicable_rules.append(rule)
        
        return applicable_rules
    
    def apply_resolution_logic(self, rules, user_context):
        """Apply smart rules resolution logic"""
        
        # STEP 1: Sort by priority (1 = highest priority)
        rules.sort(key=lambda x: x.get('priority', 999))
        
        # STEP 2: Apply rule type logic
        for rule in rules:
            rule_type = rule.get('type')
            
            if rule_type == 'GEO':
                # Direct GEO match - highest priority
                if user_context['geo'] in rule.get('geo', []):
                    return rule
            
            elif rule_type == 'Rotation':
                # Percentage-based rotation
                if self.check_rotation_percentage(rule, user_context):
                    return rule
            
            elif rule_type == 'Time':
                # Time-based routing
                if self.check_time_constraints(rule, user_context['timestamp']):
                    return rule
            
            elif rule_type == 'Backup':
                # Backup rules - lowest priority, always applicable
                continue  # Process backup rules last
        
        # STEP 3: If no specific rule matched, try backup rules
        backup_rules = [r for r in rules if r.get('type') == 'Backup']
        if backup_rules:
            return backup_rules[0]  # First backup rule by priority
        
        return None
    
    def check_rotation_percentage(self, rule, user_context):
        """Check if user falls within rotation percentage"""
        
        percentage = rule.get('percentage', 0)
        if percentage <= 0:
            return False
        
        # Use subid hash for consistent rotation
        import hashlib
        hash_input = f"{rule['_id']}_{user_context['subid']}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest()[:8], 16)
        
        # Convert to percentage (0-100)
        user_percentage = (hash_value % 100) + 1
        
        return user_percentage <= percentage
    
    def check_time_constraints(self, rule, timestamp):
        """Check time-based rule constraints"""
        
        # Get current hour (0-23)
        current_hour = timestamp.hour
        
        # Example: Rule has time constraints in metadata
        time_constraints = rule.get('timeConstraints', {})
        start_hour = time_constraints.get('startHour', 0)
        end_hour = time_constraints.get('endHour', 23)
        
        return start_hour <= current_hour <= end_hour
    
    def check_rule_caps(self, rule, offer_id):
        """Check if rule has reached its cap limit"""
        
        cap = rule.get('cap', 0)
        if cap <= 0:  # No cap limit
            return True
        
        # Get current click count for this rule today
        today = datetime.utcnow().date()
        clicks_today = self.tracking_service.get_rule_clicks_count(
            offer_id, 
            str(rule['_id']), 
            today
        )
        
        return clicks_today < cap
    
    def get_backup_rule(self, rules):
        """Get backup rule when primary rules fail"""
        
        backup_rules = [r for r in rules if r.get('type') == 'Backup' and r.get('active', True)]
        
        if backup_rules:
            # Sort by priority and return first available
            backup_rules.sort(key=lambda x: x.get('priority', 999))
            
            for backup in backup_rules:
                if self.check_rule_caps(backup, None):  # Skip cap check for backup
                    return backup
        
        return None
    
    def track_click(self, offer_id, rule, user_context):
        """Track the click for analytics"""
        
        click_data = {
            'offer_id': offer_id,
            'rule_id': str(rule['_id']),
            'rule_type': rule['type'],
            'destination_url': rule['url'],
            'geo': user_context['geo'],
            'subid': user_context['subid'],
            'ip': user_context['ip'],
            'user_agent': user_context['user_agent'],
            'timestamp': user_context['timestamp']
        }
        
        self.tracking_service.track_click(click_data)
    
    def get_error_response(self, message):
        """Return error response"""
        return {
            'destination_url': None,
            'error': message,
            'rule_applied': None,
            'tracking_data': None
        }

# Usage in click endpoint
@app.route('/click/<offer_id>')
def handle_offer_click(offer_id):
    """Handle offer click and redirect"""
    
    # Extract user context
    user_context = {
        'geo': request.args.get('geo', 'US'),
        'subid': request.args.get('subid', 'direct'),
        'ip': request.remote_addr,
        'user_agent': request.headers.get('User-Agent', ''),
        'timestamp': datetime.utcnow()
    }
    
    # Resolve destination URL
    resolver = SmartRulesResolver()
    result = resolver.resolve_destination_url(offer_id, user_context)
    
    if result['destination_url']:
        # Redirect to resolved URL
        return redirect(result['destination_url'], code=302)
    else:
        # Return error page
        return jsonify({'error': result['error']}), 404
```

---

## 📊 **FLOW DIAGRAM DESCRIPTION**

### **Offer Activation Flow**
```
┌─────────────────┐
│   CRON JOB      │
│  (Every 1 min)  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Get All Offers  │
│ with Schedules  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ❌ Schedule    ┌─────────────────┐
│ Check Schedule  │────Inactive────▶│ Deactivate      │
│ Status & Dates  │                 │ Offer           │
└─────────┬───────┘                 └─────────────────┘
          │ ✅ Active
          ▼
┌─────────────────┐    ❌ Wrong Day   ┌─────────────────┐
│ Check Recurring │─────────────────▶│ Deactivate      │
│ Days (if set)   │                 │ Offer           │
└─────────┬───────┘                 └─────────────────┘
          │ ✅ Valid Day
          ▼
┌─────────────────┐    ❌ No Rules    ┌─────────────────┐
│ Check Smart     │─────────────────▶│ Deactivate      │
│ Rules Available │                 │ Offer           │
└─────────┬───────┘                 └─────────────────┘
          │ ✅ Rules Available
          ▼
┌─────────────────┐
│ Activate Offer  │
│ Set Status      │
└─────────────────┘
```

### **Smart Rules Resolution Flow**
```
┌─────────────────┐
│ User Clicks     │
│ Offer Link      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ❌ Not Found   ┌─────────────────┐
│ Validate Offer  │─────────────────▶│ Return 404      │
│ & Get Rules     │                 │ Error           │
└─────────┬───────┘                 └─────────────────┘
          │ ✅ Valid
          ▼
┌─────────────────┐
│ Filter Rules by │
│ GEO & Context   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ❌ No Match    ┌─────────────────┐
│ Apply Rule      │─────────────────▶│ Try Backup      │
│ Resolution      │                 │ Rules           │
│ Logic           │                 └─────────┬───────┘
└─────────┬───────┘                           │
          │ ✅ Rule Found                     │ ❌ No Backup
          ▼                                   ▼
┌─────────────────┐    ❌ At Cap     ┌─────────────────┐
│ Check Rule      │─────────────────▶│ Return Error    │
│ Caps & Limits   │                 │ Message         │
└─────────┬───────┘                 └─────────────────┘
          │ ✅ Under Cap
          ▼
┌─────────────────┐
│ Track Click &   │
│ Redirect User   │
└─────────────────┘
```

---

## 🔧 **IMPLEMENTATION PRIORITIES**

### **Phase 1: Core Logic (High Priority)**
1. ✅ Smart Rules Resolver Service
2. ✅ Basic Activation Cron Job
3. ✅ Click Tracking Integration
4. ✅ Error Handling & Fallbacks

### **Phase 2: Advanced Features (Medium Priority)**
1. 🔄 Rotation Percentage Logic
2. 🔄 Time-based Rule Constraints
3. 🔄 Cap Monitoring & Alerts
4. 🔄 Performance Optimization

### **Phase 3: Analytics & Monitoring (Low Priority)**
1. ⏳ Rule Performance Analytics
2. ⏳ A/B Testing Framework
3. ⏳ Real-time Monitoring Dashboard
4. ⏳ Automated Rule Optimization

---

## 📈 **PERFORMANCE CONSIDERATIONS**

### **Cron Job Optimization**
- **Batch Processing**: Process offers in batches of 100
- **Indexing**: Use compound indexes on `schedule.startAt`, `schedule.endAt`
- **Caching**: Cache activation results for 30 seconds
- **Monitoring**: Track execution time and failures

### **Resolver Optimization**
- **Response Time**: Target < 100ms resolution time
- **Caching**: Cache rule results for 60 seconds
- **Database**: Use read replicas for rule queries
- **CDN**: Cache static rule configurations

### **Scalability Targets**
- **Concurrent Clicks**: 1000+ clicks/second
- **Offers**: 10,000+ active offers
- **Rules per Offer**: 50+ smart rules
- **Activation Checks**: 100,000+ offers/minute

---

## 🛡️ **ERROR HANDLING & FALLBACKS**

### **Cron Job Failures**
- **Retry Logic**: 3 attempts with exponential backoff
- **Alerting**: Slack/email notifications on failures
- **Fallback**: Manual activation API endpoint
- **Monitoring**: Health check endpoints

### **Resolver Failures**
- **Backup Rules**: Always have backup rules configured
- **Default URL**: Fallback to offer's primary target_url
- **Error Tracking**: Log all resolution failures
- **Circuit Breaker**: Disable problematic rules automatically

This comprehensive backend logic ensures reliable, scalable, and intelligent offer routing based on schedules and smart rules configuration.
