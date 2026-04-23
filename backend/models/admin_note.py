"""
Admin Notes Model
Stores suggestion notes from admins across different pages
"""

from datetime import datetime
from bson import ObjectId

class AdminNote:
    def __init__(self, db):
        self.db = db
        self.collection = None
        if db is not None:
            self.collection = db.get_collection('admin_notes')
    
    def _ensure_collection(self):
        """Ensure collection exists and is accessible"""
        if self.collection is None:
            if self.db is not None:
                self.collection = self.db.get_collection('admin_notes')
        return self.collection is not None
        
    def create_note(self, note_data):
        """Create a new admin note"""
        if not self._ensure_collection():
            raise Exception('Database collection not available')
        
        note = {
            'title': note_data.get('title'),
            'type': note_data.get('type'),  # bug, issue, idea, task, general
            'priority': note_data.get('priority', 'medium'),  # high, medium, low
            'status': note_data.get('status', 'pending'),  # pending, in-progress, completed
            'page': note_data.get('page'),
            'assignee': note_data.get('assignee', ''),
            'body': note_data.get('body', ''),
            'created_by': note_data.get('created_by'),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'edited': False
        }
        result = self.collection.insert_one(note)
        note['_id'] = str(result.inserted_id)
        return note
    
    def get_all_notes(self, filters=None):
        """Get all notes with optional filters"""
        if not self._ensure_collection():
            return []
        
        query = {}
        if filters:
            if filters.get('page') and filters['page'] != 'all':
                query['page'] = filters['page']
            if filters.get('type') and filters['type'] != 'all':
                query['type'] = filters['type']
            if filters.get('status') and filters['status'] != 'all':
                query['status'] = filters['status']
            if filters.get('priority') and filters['priority'] != 'all':
                query['priority'] = filters['priority']
            if filters.get('search'):
                query['$or'] = [
                    {'title': {'$regex': filters['search'], '$options': 'i'}},
                    {'body': {'$regex': filters['search'], '$options': 'i'}}
                ]
        
        sort_field = 'created_at'
        sort_order = -1  # newest first
        
        if filters and filters.get('sort'):
            if filters['sort'] == 'oldest':
                sort_order = 1
            elif filters['sort'] == 'priority':
                sort_field = 'priority'
                sort_order = 1
            elif filters['sort'] == 'status':
                sort_field = 'status'
                sort_order = 1
        
        notes = list(self.collection.find(query).sort(sort_field, sort_order))
        for note in notes:
            note['_id'] = str(note['_id'])
        return notes
    
    def get_note_by_id(self, note_id):
        """Get a single note by ID"""
        if not self._ensure_collection():
            return None
        if not ObjectId.is_valid(note_id):
            return None
        note = self.collection.find_one({'_id': ObjectId(note_id)})
        if note:
            note['_id'] = str(note['_id'])
        return note
    
    def update_note(self, note_id, update_data):
        """Update a note"""
        if not self._ensure_collection():
            return None
        if not ObjectId.is_valid(note_id):
            return None
        
        update_data['updated_at'] = datetime.utcnow()
        update_data['edited'] = True
        
        result = self.collection.update_one(
            {'_id': ObjectId(note_id)},
            {'$set': update_data}
        )
        
        if result.modified_count > 0:
            return self.get_note_by_id(note_id)
        return None
    
    def delete_note(self, note_id):
        """Delete a note"""
        if not self._ensure_collection():
            return False
        if not ObjectId.is_valid(note_id):
            return False
        result = self.collection.delete_one({'_id': ObjectId(note_id)})
        return result.deleted_count > 0
    
    def get_counts(self):
        """Get counts for different note types and statuses"""
        if not self._ensure_collection():
            return {'total': 0, 'by_type': {}, 'by_status': {}, 'by_priority': {}}
        
        try:
            pipeline = [
                {
                    '$facet': {
                        'total': [{'$count': 'count'}],
                        'by_type': [{'$group': {'_id': '$type', 'count': {'$sum': 1}}}],
                        'by_status': [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}],
                        'by_priority': [{'$group': {'_id': '$priority', 'count': {'$sum': 1}}}]
                    }
                }
            ]
            
            result = list(self.collection.aggregate(pipeline))
            if not result:
                return {'total': 0, 'by_type': {}, 'by_status': {}, 'by_priority': {}}
            
            data = result[0]
            counts = {
                'total': data['total'][0]['count'] if data['total'] else 0,
                'by_type': {item['_id']: item['count'] for item in data['by_type']},
                'by_status': {item['_id']: item['count'] for item in data['by_status']},
                'by_priority': {item['_id']: item['count'] for item in data['by_priority']}
            }
            return counts
        except Exception as e:
            # Return empty counts on any error
            return {'total': 0, 'by_type': {}, 'by_status': {}, 'by_priority': {}}
