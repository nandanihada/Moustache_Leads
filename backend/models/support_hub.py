from datetime import datetime
from bson import ObjectId
from database import db_instance

class SupportHub:
    def __init__(self):
        self.templates_col = db_instance.get_collection('support_templates')
        self.conversations_col = db_instance.get_collection('support_conversations')
        self.messages_col = db_instance.get_collection('support_messages')

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
                '$set': {'last_message_at': datetime.utcnow()},
                '$inc': {'unread_count': 1 if sender_type == 'user' else 0}
            }
        )
        return msg
