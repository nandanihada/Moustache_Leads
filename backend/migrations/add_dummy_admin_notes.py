"""
Migration script to add dummy admin notes
Run this to populate the admin_notes collection with sample data
"""

from database import db_instance
from datetime import datetime, timedelta
import sys

def add_dummy_notes():
    """Add dummy admin notes to the database"""
    
    if not db_instance.is_connected():
        print("❌ Database connection failed")
        sys.exit(1)
    
    collection = db_instance.get_collection('admin_notes')
    
    # Clear existing notes (optional)
    # collection.delete_many({})
    
    dummy_notes = [
        {
            'title': 'Zero-result searches not triggering email alerts',
            'type': 'bug',
            'priority': 'high',
            'status': 'pending',
            'page': 'Search Logs',
            'assignee': 'Ravi (Dev)',
            'body': "When a publisher search returns 0 results and the No Result flag shows ❌, the admin email alert is NOT being sent. Verified with users: rihan's 3 consecutive zero-result searches (cust, Cust, Custard) at 10:30–10:34 am IST today produced no alerts.",
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(hours=2),
            'updated_at': datetime.utcnow() - timedelta(hours=2),
            'edited': False
        },
        {
            'title': 'In Inventory (Not Active) badge color too similar to Available',
            'type': 'issue',
            'priority': 'medium',
            'status': 'in-progress',
            'page': 'Search Logs',
            'assignee': 'Priya (Design)',
            'body': "The yellow badge for 'In Inventory (Not Active)' and the green badge for 'Available' are hard to distinguish quickly when scanning rows. Consider using a distinct orange or grey for the inactive state. Affects admin UX on Search Logs page.",
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(hours=15),
            'updated_at': datetime.utcnow() - timedelta(hours=15),
            'edited': False
        },
        {
            'title': 'Add click-through rate column to Reports page',
            'type': 'idea',
            'priority': 'low',
            'status': 'pending',
            'page': 'Reports',
            'assignee': 'Shivam',
            'body': 'The Reports page currently shows impressions and conversions but no CTR column. Adding a computed CTR% column between these two would save time for the analytics team. Could also allow sorting by CTR to spot underperforming campaigns quickly.',
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=1, hours=8),
            'updated_at': datetime.utcnow() - timedelta(days=1, hours=8),
            'edited': False
        },
        {
            'title': 'Support ticket #3421 — duplicate entries showing in queue',
            'type': 'bug',
            'priority': 'high',
            'status': 'completed',
            'page': 'Support',
            'assignee': 'Ravi (Dev)',
            'body': 'Some support tickets are appearing twice in the 378 open-ticket queue. Seems triggered when a user refreshes mid-submission. The duplicate entries have identical content but different ticket IDs. Fixed in staging, needs prod deploy.',
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=2, hours=12),
            'updated_at': datetime.utcnow() - timedelta(days=2, hours=12),
            'edited': False
        },
        {
            'title': 'Payment export CSV missing currency column',
            'type': 'task',
            'priority': 'medium',
            'status': 'completed',
            'page': 'Payments',
            'assignee': 'Kavita (Dev)',
            'body': "Exported CSV from Payments page does not include a 'Currency' column. All amounts show without currency code. For publishers in different regions this is causing reconciliation errors. Add a currency column adjacent to the Amount column.",
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=3, hours=10),
            'updated_at': datetime.utcnow() - timedelta(days=3, hours=10),
            'edited': False
        },
        {
            'title': 'Click Tracking: single suspicious IP clicking 200+ times/hr',
            'type': 'general',
            'priority': 'high',
            'status': 'pending',
            'page': 'Click Tracking',
            'assignee': '',
            'body': 'Noticed IP 45.139.x.x generating an unusually high click volume (200+ in last hour) from the Click Tracking view. This IP is not yet flagged by Fraud & Security. Needs investigation — might be a bot or test account slipping through filters.',
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=3, hours=15),
            'updated_at': datetime.utcnow() - timedelta(days=3, hours=15),
            'edited': False
        },
        {
            'title': 'Offerwall Analytics page loading slowly with large datasets',
            'type': 'issue',
            'priority': 'medium',
            'status': 'pending',
            'page': 'Offerwall Analytics',
            'assignee': 'Backend Team',
            'body': 'When filtering by date ranges over 30 days, the Offerwall Analytics page takes 8-10 seconds to load. Consider adding pagination or implementing lazy loading for better performance.',
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=4, hours=5),
            'updated_at': datetime.utcnow() - timedelta(days=4, hours=5),
            'edited': False
        },
        {
            'title': 'Add bulk action buttons for user management',
            'type': 'idea',
            'priority': 'low',
            'status': 'pending',
            'page': 'Users',
            'assignee': '',
            'body': 'Would be helpful to have bulk actions like "Approve Selected", "Reject Selected", "Export Selected" on the Users page. Currently have to process users one by one which is time-consuming.',
            'created_by': 'admin',
            'created_at': datetime.utcnow() - timedelta(days=5, hours=3),
            'updated_at': datetime.utcnow() - timedelta(days=5, hours=3),
            'edited': False
        }
    ]
    
    # Insert dummy notes
    result = collection.insert_many(dummy_notes)
    print(f"✅ Successfully added {len(result.inserted_ids)} dummy admin notes")
    
    # Print summary
    print("\n📊 Summary:")
    print(f"   Total notes: {collection.count_documents({})}")
    print(f"   Bugs: {collection.count_documents({'type': 'bug'})}")
    print(f"   Issues: {collection.count_documents({'type': 'issue'})}")
    print(f"   Ideas: {collection.count_documents({'type': 'idea'})}")
    print(f"   Tasks: {collection.count_documents({'type': 'task'})}")
    print(f"   General: {collection.count_documents({'type': 'general'})}")
    print(f"   Pending: {collection.count_documents({'status': 'pending'})}")
    print(f"   In Progress: {collection.count_documents({'status': 'in-progress'})}")
    print(f"   Completed: {collection.count_documents({'status': 'completed'})}")

if __name__ == '__main__':
    print("🚀 Adding dummy admin notes...")
    add_dummy_notes()
    print("\n✅ Migration completed!")
