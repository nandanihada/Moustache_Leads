import logging
from datetime import datetime
from models.support_hub import SupportHub
from models.user import User
from database import db_instance
from bson import ObjectId

logger = logging.getLogger(__name__)

class SupportHubService:
    def __init__(self):
        self.model = SupportHub()
        self.user_model = User()
        self._seed_templates_if_empty()

    def _seed_templates_if_empty(self):
        """Create default templates if none exist"""
        templates = self.model.get_templates()
        if not templates:
            defaults = [
                {
                    'name': 'Geo-Targeted Hook',
                    'category': 'Geo-based',
                    'body': 'Hey {user}, users from {location} love our latest {vertical} offers! Check out these {offer} in your area.'
                },
                {
                    'name': 'Vertical Interest',
                    'category': 'Vertical-based',
                    'body': 'Hey {user}, need help with {vertical}? We found the best {offer} matching your profile!'
                },
                {
                    'name': 'Combined Strategy',
                    'category': 'Combined',
                    'body': 'Hey {user}, top {vertical} offers near {location}: {offer}'
                },
                {
                    'name': 'Support Follow-up',
                    'category': 'support',
                    'body': 'Hi {user}, following up on your recent activity in {vertical}. Let us know if you need help with {offer}.'
                }
            ]
            for d in defaults:
                self.model.create_template(d)
            logger.info("Seeded default support templates")

    def get_templates(self):
        return self.model.get_templates()
    def create_template(self, template_data):
        return self.model.create_template(template_data)

    def update_template(self, template_id, template_data):
        return self.model.update_template(template_id, template_data)

    def delete_template(self, template_id):
        return self.model.delete_template(template_id)

    def get_conversations(self):
        return self.model.get_conversations()

    def bulk_send(self, user_ids, template_id, channel, scheduled_at=None, message_prefix=None):
        """Send personalized messages to multiple users using templates"""
        if scheduled_at:
            logger.info(f"Bulk outreach scheduled for {scheduled_at} for {len(user_ids)} users")
            # In a real production environment, we would insert these into a 'scheduled_messages' 
            # collection and have a background worker (like Celery) pick them up.
            
        template = None
        templates = self.get_templates()
        for t in templates:
            if str(t['_id']) == str(template_id):
                template = t
                break
        
        if not template:
            raise Exception("Template not found")

        results = []
        for uid in user_ids:
            user = self.user_model.find_by_id(uid)
            if not user:
                continue
            
            # Personalize message
            template_body = template.get('body', '')
            if message_prefix:
                template_body = f"{message_prefix} {template_body}"
            body = self._personalize_message(template_body, user)
            
            # Route to channel
            # If scheduled, we might skip immediate send here, but for this implementation 
            # we'll proceed and log the intent.
            success = self._send_to_channel(user, channel, body)
            
            if success:
                # Log in support hub
                conv = self.model.create_conversation(uid, channel)
                self.model.add_message(conv['_id'], 'admin', body, channel)
                results.append({'user_id': uid, 'status': 'scheduled' if scheduled_at else 'sent'})
            else:
                results.append({'user_id': uid, 'status': 'failed'})
        
        return results

    def _personalize_message(self, body, user):
        """Replace placeholders with actual user data"""
        verts = user.get('verticals', [])
        v = verts[0] if verts and isinstance(verts, list) else (verts if verts else 'exclusive')
        
        placeholders = {
            '{user}': user.get('username', 'User'),
            '{location}': user.get('city') or user.get('country') or 'your area',
            '{vertical}': v,
            '{offer}': 'Top 5 payout plans',
            '{device}': user.get('device', 'mobile')
        }
        
        for key, val in placeholders.items():
            body = body.replace(key, str(val))
        return body

    def verify_connection(self, channel):
        """Verify if a channel is correctly configured and reachable"""
        settings = self.get_settings()
        configs = settings.get('channel_configs', {})
        config = configs.get(channel, {})
        
        if channel == 'Telegram':
            token = config.get('token', '').strip()
            if not token:
                return {'connected': False, 'status': 'Missing token'}
            
            # Verify with Telegram API
            import requests
            try:
                res = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=5)
                data = res.json()
                if data.get('ok'):
                    bot_info = data.get('result', {})
                    return {
                        'connected': True, 
                        'status': f"Connected as @{bot_info.get('username')}",
                        'bot_info': bot_info
                    }
                return {'connected': False, 'status': data.get('description', 'Invalid token')}
            except Exception as e:
                return {'connected': False, 'status': f"API Error: {str(e)}"}
        
        elif channel == 'Teams':
            webhook_url = config.get('webhook_url', '').strip()
            if not webhook_url:
                return {'connected': False, 'status': 'Missing webhook URL'}
            
            if not webhook_url.startswith('https://outlook.office.com/') and not webhook_url.startswith('https://m365x'):
                if webhook_url.startswith('https://'):
                    return {'connected': True, 'status': 'Custom webhook format validated'}
                return {'connected': False, 'status': 'Invalid webhook URL format'}
            
            return {'connected': True, 'status': 'Teams Webhook validated'}
            
        elif channel == 'Chat':
            return {'connected': config.get('enabled', True), 'status': 'Internal Chat Active'}
        elif channel == 'Email':
            return {'connected': True, 'status': 'Email Service Active'}
        return {'connected': False, 'status': 'Unknown Channel'}

    def _send_to_channel(self, user, channel, body):
        """Actual delivery logic for each channel with connection verification"""
        try:
            # Check connection first
            conn_status = self.verify_connection(channel)
            if isinstance(conn_status, dict) and not conn_status.get('connected'):
                logger.warning(f"Attempted to send to {channel} but it's not connected/verified: {conn_status.get('status')}")
                return False
            elif not conn_status: # Fallback for boolean returns if any
                return False

            settings = self.get_settings()
            config = settings.get('channel_configs', {}).get(channel, {})

            if channel == 'Email':
                # Existing email service logic placeholder
                return True
            elif channel == 'Telegram':
                token = config.get('token')
                # In a real app, you'd need the user's telegram_id
                # We'll assume it's stored in user meta or we're sending to a broadcast group
                telegram_id = user.get('telegram_id') or user.get('meta', {}).get('telegram_id')
                if not telegram_id:
                    logger.error(f"No telegram_id found for user {user.get('username')}")
                    return False
                
                import requests
                payload = {'chat_id': telegram_id, 'text': body, 'parse_mode': 'HTML'}
                resp = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload, timeout=5)
                return resp.status_code == 200
            elif channel == 'Teams':
                webhook_url = config.get('webhook_url')
                import requests
                payload = {'text': body}
                resp = requests.post(webhook_url, json=payload, timeout=5)
                return resp.status_code in [200, 201, 202, 204]
            elif channel == 'Chat':
                # Internal chat logic - handled by conversation persistence
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to send to channel {channel}: {e}")
            return False

    def send_outreach(self, user_id, subject, body, channel, scheduled_at=None):
        """Send a single personalized outreach message and track it"""
        user = self.user_model.find_by_id(user_id)
        if not user:
            raise Exception("User not found")
        
        if scheduled_at:
            logger.info(f"Outreach scheduled for {user_id} at {scheduled_at} via {channel}")
            # Placeholder for scheduling persistence
            
        success = self._send_to_channel(user, channel, body)
        if success:
            # Create/Get conversation
            conv = self.model.create_conversation(user_id, channel)
            # Log the message
            self.model.add_message(conv['_id'], 'admin', body, channel)
            return {'status': 'scheduled' if scheduled_at else 'sent', 'user_id': user_id}
        else:
            return {'status': 'failed', 'user_id': user_id}

    def get_messages(self, conversation_id):
        """Fetch all messages for a specific conversation"""
        messages = self.model.get_messages(conversation_id)
        for m in messages:
            m['_id'] = str(m['_id'])
        return messages

    def send_message(self, conversation_id, sender_type, body):
        """Send a single message in a conversation and route to channel"""
        conv = self.model.conversations_col.find_one({'_id': ObjectId(conversation_id)})
        if not conv:
            raise Exception("Conversation not found")
        
        user = self.user_model.find_by_id(conv['user_id'])
        if not user:
            raise Exception("User not found")
        
        # Route to channel if it's from admin
        if sender_type == 'admin':
            self._send_to_channel(user, conv['channel'], body)
            
        message = self.model.add_message(conversation_id, sender_type, body, conv['channel'])
        message['_id'] = str(message['_id'])
        return message

    def get_settings(self):
        return self.model.get_settings()

    def update_settings(self, settings_data):
        return self.model.update_settings(settings_data)

def get_support_hub_service():
    return SupportHubService()
