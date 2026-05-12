import os
import sys

# Add current directory to path
sys.path.append('.')

from services.automation_service import get_automation_service
from database import db_instance

def test_sync():
    try:
        service = get_automation_service()
        print("Starting sync_active_users(force_reset=True)...")
        count = service.sync_active_users(force_reset=True)
        print(f"Sync complete. Count: {count}")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_sync()
