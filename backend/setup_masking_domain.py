"""
Setup script to create a default masking domain for automatic link masking
Run this once to setup the masking domain
"""
from database import db_instance
from models.link_masking import LinkMasking
from bson import ObjectId
import logging

logging.basicConfig(level=logging.INFO)

def setup_default_masking_domain():
    """Create default masking domain if it doesn't exist"""
    try:
        link_masking = LinkMasking()
        
        # Check if any domains exist
        existing_domains = link_masking.get_masking_domains(active_only=False)
        
        if existing_domains and len(existing_domains) > 0:
            logging.info(f"✅ Masking domain(s) already exist: {[d['domain'] for d in existing_domains]}")
            return True
        
        # Create default masking domain
        # Replace this with your actual domain
        domain_data = {
            'domain': 'track.yourdomain.com',  # ⚠️ CHANGE THIS TO YOUR ACTUAL DOMAIN
            'name': 'Default Tracking Domain',
            'description': 'Default domain for link masking and tracking',
            'ssl_enabled': True,
            'default_redirect_type': '302',
            'status': 'active',
            'priority': 1
        }
        
        # Get admin user ID (or use a default)
        users_collection = db_instance.get_collection('users')
        admin_user = users_collection.find_one({'role': 'admin'})
        admin_id = str(admin_user['_id']) if admin_user else 'system'
        
        domain, error = link_masking.create_masking_domain(domain_data, admin_id)
        
        if error:
            logging.error(f"❌ Failed to create default masking domain: {error}")
            return False
        
        logging.info(f"✅ Default masking domain created: {domain['domain']}")
        logging.info(f"   Domain ID: {domain['_id']}")
        logging.info(f"   SSL Enabled: {domain['ssl_enabled']}")
        logging.info(f"   Status: {domain['status']}")
        
        return True
        
    except Exception as e:
        logging.error(f"❌ Error setting up masking domain: {str(e)}")
        return False

if __name__ == '__main__':
    logging.info("🚀 Setting up default masking domain...")
    logging.info("⚠️  IMPORTANT: Edit this script to set your actual tracking domain!")
    logging.info("=" * 70)
    
    success = setup_default_masking_domain()
    
    if success:
        logging.info("=" * 70)
        logging.info("✅ Setup complete!")
        logging.info("💡 TIP: You can add more masking domains via the admin panel")
    else:
        logging.info("=" * 70)
        logging.error("❌ Setup failed. Please check the errors above.")
