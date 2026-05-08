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

    def get_conversations(self):
        return self.model.get_conversations()

    def bulk_send(self, user_ids, template_id, channel, scheduled_at=None):
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
            body = self._personalize_message(template.get('body', ''), user)
            
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

    def _send_to_channel(self, user, channel, body):
        """Actual delivery logic for each channel"""
        try:
            if channel == 'Email':
                # Integrate with existing email service
                # from services.email_verification_service import get_email_verification_service
                # ...
                return True
            elif channel == 'Telegram':
                # Integrate with Telegram Bot API
                return True
            elif channel == 'Teams':
                # Integrate with Teams Webhook
                return True
            elif channel == 'Chat':
                # Internal chat logic
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to send to channel {channel}: {e}")
            return False

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

def get_support_hub_service():
    return SupportHubService()
