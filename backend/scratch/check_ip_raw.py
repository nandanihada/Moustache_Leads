
from database import db_instance

def check_ip_raw(target_ip):
    db = db_instance.get_db()
    
    col = db_instance.get_collection('masked_link_clicks')
    print(f"masked_link_clicks for {target_ip}: {col.count_documents({'ip': target_ip})}")
    
    col = db_instance.get_collection('see_more_clicks')
    print(f"see_more_clicks for {target_ip}: {col.count_documents({'ip': target_ip})}")

if __name__ == "__main__":
    check_ip_raw('10.192.22.130')
