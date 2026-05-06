from database import db_instance

def fix_db():
    db = db_instance.get_db()
    
    # Fix support40
    res = db.login_logs.update_many(
        {'username': 'support40'}, 
        {'$set': {
            'location.country': 'India', 
            'location.country_code': 'IN', 
            'location.city': 'Panipat', 
            'location.isp': 'Reliance Jio Infocomm Limited'
        }}
    )
    print(f"Updated support40: {res.modified_count}")

if __name__ == "__main__":
    fix_db()
