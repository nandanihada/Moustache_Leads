import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance

def run():
    print("Wiping all simulated dummy API tracking data from database...")
    
    stats_col = db_instance.get_collection('api_stats')
    conv_col = db_instance.get_collection('api_conversions')
    
    stats_deleted = stats_col.delete_many({}).deleted_count
    conv_deleted = conv_col.delete_many({}).deleted_count
    
    print(f"✅ Deleted {stats_deleted} dummy statistics records.")
    print(f"✅ Deleted {conv_deleted} dummy conversion records.")
    print("\nDatabase is now completely clean and ready for real, original data only!")

if __name__ == '__main__':
    run()
