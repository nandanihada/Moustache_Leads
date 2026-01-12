"""
Test script for duplicate offer removal functionality
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.duplicate_remover import DuplicateOfferRemover
from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)

def test_duplicate_detection():
    """Test duplicate detection without removal"""
    print("\n" + "="*80)
    print("TESTING DUPLICATE DETECTION")
    print("="*80)
    
    remover = DuplicateOfferRemover()
    summary = remover.get_duplicate_summary()
    
    print(f"\n📊 Duplicate Summary:")
    print(f"   Total duplicate groups: {summary['total_duplicate_groups']}")
    print(f"   Total duplicate documents: {summary['total_duplicate_documents']}")
    print(f"   Documents to be removed: {summary['total_documents_to_remove']}")
    
    if summary['total_duplicate_groups'] > 0:
        print(f"\n📋 Duplicate Groups:")
        for group in summary['duplicate_groups']:
            print(f"\n   Offer ID: {group['offer_id']}")
            print(f"   Count: {group['count']}")
            print(f"   Documents:")
            for doc in group['documents']:
                print(f"      - {doc['_id']}: {doc['name']} (Status: {doc['status']})")
                print(f"        Created: {doc.get('created_at', 'N/A')}")
                print(f"        Updated: {doc.get('updated_at', 'N/A')}")
    else:
        print("\n✅ No duplicates found!")
    
    return summary

def test_duplicate_removal(dry_run=True):
    """Test duplicate removal"""
    print("\n" + "="*80)
    print("TESTING DUPLICATE REMOVAL" + (" (DRY RUN)" if dry_run else ""))
    print("="*80)
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No actual removal will occur")
        summary = test_duplicate_detection()
        return summary
    
    remover = DuplicateOfferRemover()
    
    # Get confirmation
    summary = remover.get_duplicate_summary()
    if summary['total_duplicate_groups'] == 0:
        print("\n✅ No duplicates to remove!")
        return summary
    
    print(f"\n⚠️  About to remove {summary['total_documents_to_remove']} duplicate documents")
    confirm = input("Type 'yes' to proceed: ")
    
    if confirm.lower() != 'yes':
        print("\n❌ Removal cancelled")
        return summary
    
    # Remove duplicates
    total_duplicates, removed_count, errors = remover.remove_duplicates('newest')
    
    print(f"\n✅ Removal Complete:")
    print(f"   Total duplicates found: {total_duplicates}")
    print(f"   Successfully removed: {removed_count}")
    
    if errors:
        print(f"\n⚠️  Errors encountered:")
        for error in errors:
            print(f"      - {error}")
    
    return {
        'total_duplicates': total_duplicates,
        'removed': removed_count,
        'errors': errors
    }

def create_test_duplicates():
    """Create test duplicate offers for testing"""
    print("\n" + "="*80)
    print("CREATING TEST DUPLICATES")
    print("="*80)
    
    from datetime import datetime, timedelta
    
    offers_collection = db_instance.get_collection('offers')
    
    # Create 3 duplicate offers with same offer_id
    test_offer_id = "TEST-DUPLICATE-001"
    
    # Check if test duplicates already exist
    existing = offers_collection.count_documents({'offer_id': test_offer_id})
    if existing > 0:
        print(f"\n⚠️  Test duplicates already exist ({existing} documents)")
        confirm = input("Delete existing test duplicates? (yes/no): ")
        if confirm.lower() == 'yes':
            result = offers_collection.delete_many({'offer_id': test_offer_id})
            print(f"✅ Deleted {result.deleted_count} existing test duplicates")
        else:
            print("❌ Keeping existing test duplicates")
            return
    
    # Create 3 duplicate offers
    base_time = datetime.utcnow()
    
    for i in range(3):
        offer = {
            'offer_id': test_offer_id,
            'campaign_id': f'CAMP-TEST-{i+1}',
            'name': f'Test Duplicate Offer {i+1}',
            'description': f'This is test duplicate #{i+1}',
            'status': 'active',
            'network': 'TestNetwork',
            'payout': 5.0 + i,
            'currency': 'USD',
            'countries': ['US', 'UK'],
            'device_targeting': 'all',
            'affiliates': 'all',
            'target_url': f'https://example.com/offer/{i+1}',
            'hits': 0,
            'is_active': True,
            'created_at': base_time - timedelta(days=3-i),
            'updated_at': base_time - timedelta(days=3-i, hours=i),
            'created_by': 'test_script'
        }
        
        result = offers_collection.insert_one(offer)
        print(f"✅ Created duplicate {i+1}: {result.inserted_id}")
    
    print(f"\n✅ Created 3 test duplicates with offer_id: {test_offer_id}")
    print("   The newest one (Duplicate 3) should be kept when removing duplicates")

def cleanup_test_duplicates():
    """Remove test duplicate offers"""
    print("\n" + "="*80)
    print("CLEANING UP TEST DUPLICATES")
    print("="*80)
    
    offers_collection = db_instance.get_collection('offers')
    test_offer_id = "TEST-DUPLICATE-001"
    
    result = offers_collection.delete_many({'offer_id': test_offer_id})
    print(f"✅ Deleted {result.deleted_count} test duplicate(s)")

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test duplicate offer removal')
    parser.add_argument('--check', action='store_true', help='Check for duplicates')
    parser.add_argument('--remove', action='store_true', help='Remove duplicates (requires confirmation)')
    parser.add_argument('--create-test', action='store_true', help='Create test duplicates')
    parser.add_argument('--cleanup-test', action='store_true', help='Remove test duplicates')
    parser.add_argument('--full-test', action='store_true', help='Run full test (create, check, remove, cleanup)')
    
    args = parser.parse_args()
    
    if args.full_test:
        print("\n🧪 RUNNING FULL TEST SUITE")
        create_test_duplicates()
        test_duplicate_detection()
        test_duplicate_removal(dry_run=False)
        cleanup_test_duplicates()
    elif args.create_test:
        create_test_duplicates()
    elif args.cleanup_test:
        cleanup_test_duplicates()
    elif args.check:
        test_duplicate_detection()
    elif args.remove:
        test_duplicate_removal(dry_run=False)
    else:
        # Default: just check
        print("\n💡 Usage:")
        print("   python test_duplicate_removal.py --check          # Check for duplicates")
        print("   python test_duplicate_removal.py --remove         # Remove duplicates")
        print("   python test_duplicate_removal.py --create-test    # Create test duplicates")
        print("   python test_duplicate_removal.py --cleanup-test   # Remove test duplicates")
        print("   python test_duplicate_removal.py --full-test      # Run full test suite")
        print("\nRunning default check...")
        test_duplicate_detection()
