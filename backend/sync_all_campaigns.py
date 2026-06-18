import sys
import os

# Add the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from models.campaign import get_campaign_model

def main():
    print("Connecting to database...")
    # Trigger db connection
    db = db_instance.get_db()
    if db is None:
        print("Failed to connect to database.")
        return
        
    campaign_model = get_campaign_model()
    campaigns = list(db.campaigns.find({}))
    print(f"Found {len(campaigns)} campaigns in the database.")
    
    synced_count = 0
    for campaign in campaigns:
        campaign_id = str(campaign['_id'])
        print(f"Syncing campaign: {campaign.get('name')} ({campaign_id}) - Status: {campaign.get('status')}...")
        success = campaign_model.sync_to_offer(campaign_id)
        if success:
            synced_count += 1
            
    print(f"Completed! Synced {synced_count} out of {len(campaigns)} campaigns.")

if __name__ == '__main__':
    main()
