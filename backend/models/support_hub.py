from datetime import datetime
from bson import ObjectId
from database import db_instance

class SupportHub:
    def __init__(self):
        self.templates_col = db_instance.get_collection('support_templates')
        self.conversations_col = db_instance.get_collection('support_conversations')
        self.messages_col = db_instance.get_collection('support_messages')
        self.settings_col = db_instance.get_collection('support_settings')

    def get_settings(self):
        settings = self.settings_col.find_one({'type': 'global'})
        if not settings:
            # Default settings
            settings = {
                'type': 'global',
                'support_name': 'Publisher Support Team',
                'support_email': 'support@moustacheleads.com',
                'default_signature': 'Best regards,\nPublisher Support Team\nMoustache Leads',
                'email_settings': {
                    'templateStyle': 'table',
                    'visibleFields': ['name', 'payout', 'countries', 'category', 'image'],
                    'seeMoreFields': [],
                    'payoutType': 'publisher',
                    'paymentTerms': 'Net 30'
                },
                'channel_configs': {
                    'Telegram': {'token': '', 'bot_username': '', 'connected': False},
                    'Teams': {'webhook_url': '', 'connected': False},
                    'Chat': {'enabled': True, 'connected': True},
                    'Email': {'enabled': True, 'connected': True}
                },
                'strategy_hooks': {
                    'Geo-based': 'Hey {user}, users from {location} love our latest {vertical}!',
                    'Vertical-based': 'Hey {user}, need help with {vertical} deals?',
                    'Combined': 'Hey {user}, check out the top {vertical} offers near {location}:',
                    'Custom': ''
                },
                'updated_at': datetime.utcnow()
            }
            self.settings_col.insert_one(settings)
        if '_id' in settings:
            settings['_id'] = str(settings['_id'])
            
        # Ensure new fields exist for backward compatibility
        if 'channel_configs' not in settings:
            settings['channel_configs'] = {
                'Telegram': {'token': '', 'bot_username': '', 'connected': False, 'user_mappings': {}},
                'Teams': {'webhook_url': '', 'connected': False, 'user_mappings': {}},
                'Chat': {'enabled': True, 'connected': True, 'user_mappings': {}},
                'Email': {'enabled': True, 'connected': True}
            }
            self.settings_col.update_one({'type': 'global'}, {'$set': {'channel_configs': settings['channel_configs']}})
        elif 'user_mappings' not in settings['channel_configs'].get('Telegram', {}):
            # Update existing configs with mappings field if missing
            for ch in ['Telegram', 'Teams', 'Chat']:
                if ch in settings['channel_configs']:
                    settings['channel_configs'][ch]['user_mappings'] = {}
            self.settings_col.update_one({'type': 'global'}, {'$set': {'channel_configs': settings['channel_configs']}})
            
        return settings

    def update_settings(self, settings_data):
        settings_data['updated_at'] = datetime.utcnow()
        if '_id' in settings_data:
            del settings_data['_id']
        self.settings_col.update_one(
            {'type': 'global'},
            {'$set': settings_data},
            upsert=True
        )
        return True

    def get_templates(self):
        return list(self.templates_col.find())

    def get_conversations(self):
        return list(self.conversations_col.find().sort('last_message_at', -1))

    def get_messages(self, conversation_id):
        return list(self.messages_col.find({'conversation_id': str(conversation_id)}).sort('timestamp', 1))

    def create_template(self, template_data):
        template_data['created_at'] = datetime.utcnow()
        result = self.templates_col.insert_one(template_data)
        template_data['_id'] = str(result.inserted_id)
        return template_data

    def create_conversation(self, user_id, channel):
        conv = {
            'user_id': str(user_id),
            'channel': channel,
            'status': 'active',
            'unread_count': 0,
            'last_message_at': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }
        result = self.conversations_col.insert_one(conv)
        conv['_id'] = str(result.inserted_id)
        return conv

    def add_message(self, conversation_id, sender_type, body, channel):
        msg = {
            'conversation_id': str(conversation_id),
            'sender_type': sender_type, # 'admin' or 'user'
            'body': body,
            'channel': channel,
            'timestamp': datetime.utcnow()
        }
        self.messages_col.insert_one(msg)
        
        # Update conversation
        self.conversations_col.update_one(
            {'_id': ObjectId(conversation_id)},
            {
                '$set': {
                    'last_message_at': datetime.utcnow(),
                    'last_sender': sender_type,
                    'last_message_body': body
                },
                '$inc': {'unread_count': 1 if sender_type == 'user' else 0}
            }
        )
        return msg
    def update_template(self, template_id, template_data):
        template_data['updated_at'] = datetime.utcnow()
        self.templates_col.update_one(
            {'_id': ObjectId(template_id)},
            {'$set': template_data}
        )
        return True

    def delete_template(self, template_id):
        self.templates_col.delete_one({'_id': ObjectId(template_id)})
        return True
