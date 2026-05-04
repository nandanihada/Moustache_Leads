
from app import create_app
import os
os.environ['MONGODB_URI'] = 'mongodb+srv://shivam_db_user:N2GXWCIahXjPfHps@mlapril.ivsdtl2.mongodb.net/'
os.environ['DATABASE_NAME'] = 'ascend_db'
app = create_app()
with app.app_context():
    from backend.database import db_instance
    db = db_instance.get_db()
    
    user_id = '68e4e41a4ad662563fdb568a'
    
    # 1. Check scheduled_emails
    query = {}
    from backend.models.user import User
    user = User().get_by_id(user_id)
    if user:
        query['recipients'] = user.get('email')
        email_query = {'to': {'': f'^{user.get('email')}$', '': 'i'}}
    else:
        email_query = {}
        
    activities = []
    docs = list(db.scheduled_emails.find(query).sort('scheduled_at', -1).limit(20))
    print('Scheduled emails:', len(docs))
    
    if email_query:
        sent_docs = list(db.login_logs_mail_history.find(email_query).sort('sent_at', -1).limit(20))
        print('Mail history:', len(sent_docs))
        
    if user_id:
        offer_docs = list(db.offer_send_history.find({'': [{'user_id': user_id}, {'recipient_user_ids': user_id}]}).sort('created_at', -1).limit(20))
        print('Offer send history:', len(offer_docs))
