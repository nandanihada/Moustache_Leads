"""
Utility to detect and remove duplicate offers based on offer_id
"""
import logging
from database import db_instance
from typing import List, Dict, Tuple

class DuplicateOfferRemover:
    """Service to detect and remove duplicate offers"""
    
    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
    
    def find_duplicates(self) -> Dict[str, List[Dict]]:
        """
        Find all duplicate offers grouped by offer_id
        Returns a dictionary where keys are offer_ids and values are lists of duplicate documents
        """
        try:
            # Aggregate to find offer_ids that appear more than once
            pipeline = [
                {
                    '$group': {
                        '_id': '$offer_id',
                        'count': {'$sum': 1},
                        'docs': {'$push': '$$ROOT'}
                    }
                },
                {
                    '$match': {
                        'count': {'$gt': 1}
                    }
                }
            ]
            
            duplicates = {}
            results = self.offers_collection.aggregate(pipeline)
            
            for result in results:
                offer_id = result['_id']
                docs = result['docs']
                duplicates[offer_id] = docs
            
            logging.info(f"Found {len(duplicates)} offer_ids with duplicates")
            return duplicates
            
        except Exception as e:
            logging.error(f"Error finding duplicates: {str(e)}", exc_info=True)
            return {}
    
    def remove_duplicates(self, keep_strategy: str = 'newest') -> Tuple[int, int, List[str]]:
        """
        Remove duplicate offers, keeping only one per offer_id
        
        Args:
            keep_strategy: 'newest' (keep most recent) or 'oldest' (keep first created)
        
        Returns:
            Tuple of (total_duplicates_found, total_removed, list_of_errors)
        """
        try:
            duplicates = self.find_duplicates()
            
            if not duplicates:
                logging.info("No duplicates found")
                return 0, 0, []
            
            total_duplicates = sum(len(docs) for docs in duplicates.values())
            removed_count = 0
            errors = []
            
            for offer_id, docs in duplicates.items():
                try:
                    # Sort documents based on strategy
                    if keep_strategy == 'newest':
                        # Keep the one with the most recent created_at or updated_at
                        docs_sorted = sorted(
                            docs,
                            key=lambda x: x.get('updated_at') or x.get('created_at') or '',
                            reverse=True
                        )
                    else:  # oldest
                        docs_sorted = sorted(
                            docs,
                            key=lambda x: x.get('created_at') or '',
                            reverse=False
                        )
                    
                    # Keep the first one (based on strategy), delete the rest
                    keep_doc = docs_sorted[0]
                    delete_docs = docs_sorted[1:]
                    
                    logging.info(f"Offer ID {offer_id}: Keeping document {keep_doc['_id']}, removing {len(delete_docs)} duplicates")
                    
                    # Delete duplicate documents
                    for doc in delete_docs:
                        result = self.offers_collection.delete_one({'_id': doc['_id']})
                        if result.deleted_count > 0:
                            removed_count += 1
                            logging.info(f"  ✅ Removed duplicate: {doc['_id']}")
                        else:
                            error_msg = f"Failed to remove duplicate {doc['_id']} for offer_id {offer_id}"
                            errors.append(error_msg)
                            logging.warning(f"  ⚠️ {error_msg}")
                
                except Exception as e:
                    error_msg = f"Error processing duplicates for offer_id {offer_id}: {str(e)}"
                    errors.append(error_msg)
                    logging.error(error_msg, exc_info=True)
            
            logging.info(f"Duplicate removal complete: {removed_count} removed out of {total_duplicates} duplicates found")
            return total_duplicates, removed_count, errors
            
        except Exception as e:
            logging.error(f"Error removing duplicates: {str(e)}", exc_info=True)
            return 0, 0, [str(e)]
    
    def get_duplicate_summary(self) -> Dict:
        """
        Get a summary of duplicate offers without removing them
        """
        try:
            duplicates = self.find_duplicates()
            
            summary = {
                'total_duplicate_groups': len(duplicates),
                'total_duplicate_documents': sum(len(docs) for docs in duplicates.values()),
                'total_documents_to_remove': sum(len(docs) - 1 for docs in duplicates.values()),
                'duplicate_groups': []
            }
            
            for offer_id, docs in duplicates.items():
                group_info = {
                    'offer_id': offer_id,
                    'count': len(docs),
                    'documents': [
                        {
                            '_id': str(doc['_id']),
                            'name': doc.get('name', 'N/A'),
                            'created_at': doc.get('created_at'),
                            'updated_at': doc.get('updated_at'),
                            'status': doc.get('status', 'N/A')
                        }
                        for doc in docs
                    ]
                }
                summary['duplicate_groups'].append(group_info)
            
            return summary
            
        except Exception as e:
            logging.error(f"Error getting duplicate summary: {str(e)}", exc_info=True)
            return {
                'error': str(e),
                'total_duplicate_groups': 0,
                'total_duplicate_documents': 0,
                'total_documents_to_remove': 0,
                'duplicate_groups': []
            }
