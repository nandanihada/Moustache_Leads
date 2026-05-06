from database import db_instance

def fix_db():
    db = db_instance.get_db()
    
    # Fix gamesbrothersoft37
    res1 = db.login_logs.update_many(
        {'username': 'gamesbrothersoft37'}, 
        {'$set': {
            'location.country': 'Hong Kong', 
            'location.country_code': 'HK', 
            'location.city': 'Aberdeen', 
            'location.isp': 'Hong Kong Broadband Network'
        }}
    )
    print(f"Updated gamesbrothersoft37: {res1.modified_count}")

    # Fix aryan
    res2 = db.login_logs.update_many(
        {'username': 'aryan', 'ip_address': '42.104.246.86'}, 
        {'$set': {
            'location.country': 'India', 
            'location.country_code': 'IN', 
            'location.city': 'Patna', 
            'location.isp': 'Vodafone Idea Ltd'
        }}
    )
    print(f"Updated aryan: {res2.modified_count}")

if __name__ == "__main__":
    fix_db()
