"""
Test script to verify admin notes API
"""

from database import db_instance
from models.admin_note import AdminNote

print("=" * 50)
print("Testing Admin Notes API")
print("=" * 50)

# Check database connection
print(f"\n1. Database connected: {db_instance.is_connected()}")

# Get collection
collection = db_instance.get_collection('admin_notes')
print(f"2. Collection exists: {collection is not None}")

if collection is not None:
    # Count documents
    count = collection.count_documents({})
    print(f"3. Total notes in DB: {count}")
    
    # Get all notes
    notes = list(collection.find({}))
    print(f"4. Notes retrieved: {len(notes)}")
    
    if notes:
        print("\n5. Sample note:")
        note = notes[0]
        print(f"   - ID: {note.get('_id')}")
        print(f"   - Title: {note.get('title')}")
        print(f"   - Type: {note.get('type')}")
        print(f"   - Status: {note.get('status')}")
        print(f"   - Priority: {note.get('priority')}")
        print(f"   - Page: {note.get('page')}")
        print(f"   - Created: {note.get('created_at')}")

# Test AdminNote model
print("\n6. Testing AdminNote model:")
admin_note = AdminNote(db_instance.get_db())
print(f"   - Collection accessible: {admin_note._ensure_collection()}")

all_notes = admin_note.get_all_notes()
print(f"   - get_all_notes() returned: {len(all_notes)} notes")

if all_notes:
    print(f"   - First note ID: {all_notes[0].get('_id')}")
    print(f"   - First note title: {all_notes[0].get('title')}")

counts = admin_note.get_counts()
print(f"\n7. Counts:")
print(f"   - Total: {counts.get('total')}")
print(f"   - By type: {counts.get('by_type')}")
print(f"   - By status: {counts.get('by_status')}")
print(f"   - By priority: {counts.get('by_priority')}")

print("\n" + "=" * 50)
print("Test completed!")
print("=" * 50)
