
from database import db_instance
import json

def track_ip(target_ip):
    db = db_instance.get_db()
    results = {}
    
    # 1. Check login_logs
    col = db_instance.get_collection('login_logs')
    if col is not None:
        log = col.find_one({'ip_address': target_ip}, sort=[('login_time', -1)])
        if log:
            results['login_log'] = {'email': log.get('email'), 'username': log.get('username')}

    # 2. Check masked_link_clicks
    col = db_instance.get_collection('masked_link_clicks')
    if col is not None:
        click = col.find_one({'ip': target_ip, 'recipient_email': {'$ne': None}}, sort=[('clicked_at', -1)])
        if click:
            results['masked_click'] = {'email': click.get('recipient_email')}
        else:
            # Check link mapping
            click_any = col.find_one({'ip': target_ip, 'link_id': {'$exists': True}}, sort=[('clicked_at', -1)])
            if click_any:
                link_col = db_instance.get_collection('email_preview_links')
                if link_col:
                    mapping = link_col.find_one({'tracking_id': click_any['link_id']})
                    if mapping:
                        results['link_mapping'] = {'email': mapping.get('recipient_email')}

    # 3. Check see_more_clicks
    col = db_instance.get_collection('see_more_clicks')
    if col is not None:
        view = col.find_one({'ip': target_ip, 'recipient_email': {'$ne': None}}, sort=[('clicked_at', -1)])
        if view:
            results['see_more_view'] = {'email': view.get('recipient_email')}

    # Resolve Name
    final_email = None
    for k in ['login_log', 'masked_click', 'link_mapping', 'see_more_view']:
        if k in results and results[k].get('email'):
            final_email = results[k]['email']
            break
    
    if final_email:
        user = db.users.find_one({'email': final_email})
        if user:
            results['resolved_user'] = {
                'name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('username'),
                'email': final_email
            }
        else:
            results['resolved_user'] = {'name': 'No user profile found', 'email': final_email}
    
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    track_ip('10.192.22.130')
