from datetime import datetime
from bson import ObjectId
from database import db_instance

class SupportTemplate:
    COLLECTION_NAME = 'support_templates'

    @classmethod
    def get_collection(cls):
        return db_instance.get_collection(cls.COLLECTION_NAME)

    @classmethod
    def create(cls, name, category, body):
        col = cls.get_collection()
        doc = {
            'name': name,
            'category': category,
            'body': body,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = col.insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        return doc

    @classmethod
    def get_all(cls):
        col = cls.get_collection()
        templates = list(col.find().sort('category', 1))
        for t in templates:
            t['_id'] = str(t['_id'])
        return templates

class SupportConversationV2:
    COLLECTION_NAME = 'support_conversations_v2'

    @classmethod
    def get_collection(cls):
        return db_instance.get_collection(cls.COLLECTION_NAME)

    @classmethod
    def create_or_get(cls, user_id, channel):
        col = cls.get_collection()
        conv = col.find_one({'user_id': str(user_id), 'channel': channel})
        if not conv:
            doc = {
                'user_id': str(user_id),
                'channel': channel,
                'status': 'open',
                'last_message_at': datetime.utcnow(),
                'unread_count': 0,
                'created_at': datetime.utcnow()
            }
            result = col.insert_one(doc)
            doc['_id'] = str(result.inserted_id)
            return doc
        conv['_id'] = str(conv['_id'])
        return conv

    @classmethod
    def add_message(cls, conversation_id, text, sender_type):
        col = db_instance.get_collection('support_messages_v2')
        doc = {
            'conversation_id': str(conversation_id),
            'text': text,
            'sender_type': sender_type, # 'admin' or 'user'
            'timestamp': datetime.utcnow()
        }
        col.insert_one(doc)
        
        # Update conversation
        cls.get_collection().update_one(
            {'_id': ObjectId(conversation_id)},
            {
                '$set': {'last_message_at': datetime.utcnow()},
                '$inc': {'unread_count': 1 if sender_type == 'user' else 0}
            }
        )
        return doc
