"""
Utility to detect and remove duplicate offers based on offer_id AND name
"""
import logging
from database import db_instance
from typing import List, Dict, Tuple

class DuplicateOfferRemover:
    """Service to detect and remove duplicate offers"""
    
    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
    
    def find_duplicates_by_offer_id(self) -> Dict[str, List[Dict]]:
        """
        Find all duplicate offers grouped by offer_id
        Returns a dictionary where keys are offer_ids and values are lists of duplicate documents
        """
        try:
            # Aggregate to find offer_ids that appear more than once
            pipeline = [
                {
                    '$match': {
                        '$or': [
                            {'deleted': {'$exists': False}},
                            {'deleted': False}
                        ]
                    }
                },
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
                if offer_id:  # Skip null offer_ids
                    docs = result['docs']
                    duplicates[f"id:{offer_id}"] = docs
            
            logging.info(f"Found {len(duplicates)} offer_ids with duplicates")
            return duplicates
            
        except Exception as e:
            logging.error(f"Error finding duplicates by offer_id: {str(e)}", exc_info=True)
            return {}
    
    def find_duplicates_by_name(self) -> Dict[str, List[Dict]]:
        """
        Find all duplicate offers grouped by name (case-insensitive)
        Returns a dictionary where keys are names and values are lists of duplicate documents
        """
        try:
            # Aggregate to find names that appear more than once
            pipeline = [
                {
                    '$match': {
                        '$or': [
                            {'deleted': {'$exists': False}},
                            {'deleted': False}
                        ],
                        'name': {'$exists': True, '$ne': None, '$ne': ''}
                    }
                },
                {
                    '$group': {
                        '_id': {'$toLower': '$name'},
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
                name = result['_id']
                if name:  # Skip null/empty names
                    docs = result['docs']
                    duplicates[f"name:{name}"] = docs
            
            logging.info(f"Found {len(duplicates)} names with duplicates")
            return duplicates
            
        except Exception as e:
            logging.error(f"Error finding duplicates by name: {str(e)}", exc_info=True)
            return {}
    
    def find_duplicates(self) -> Dict[str, List[Dict]]:
        """
        Find all duplicate offers grouped by offer_id AND name
        Returns a dictionary where keys are identifiers and values are lists of duplicate documents
        """
        try:
            # Get duplicates by offer_id
            id_duplicates = self.find_duplicates_by_offer_id()
            
            # Get duplicates by name
            name_duplicates = self.find_duplicates_by_name()
            
            # Merge both, avoiding double-counting
            # Track document IDs we've already included
            seen_doc_ids = set()
            all_duplicates = {}
            
            # Add offer_id duplicates first
            for key, docs in id_duplicates.items():
                all_duplicates[key] = docs
                for doc in docs:
                    seen_doc_ids.add(str(doc['_id']))
            
            # Add name duplicates, but only if they're not already covered by offer_id duplicates
            for key, docs in name_duplicates.items():
                # Check if this is a truly new duplicate group
                if len(docs) > 1:
                    already_covered = all(str(doc['_id']) in seen_doc_ids for doc in docs)
                    
                    if not already_covered:
                        all_duplicates[key] = docs
                        for doc in docs:
                            seen_doc_ids.add(str(doc['_id']))
            
            logging.info(f"Total duplicate groups found: {len(all_duplicates)} (by ID: {len(id_duplicates)}, by name: {len(name_duplicates)})")
            return all_duplicates
            
        except Exception as e:
            logging.error(f"Error finding duplicates: {str(e)}", exc_info=True)
            return {}

    def remove_duplicates(self, keep_strategy: str = 'newest') -> Tuple[int, int, List[str]]:
        """
        Remove duplicate offers, keeping only one per offer_id or name
        
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
            removed_doc_ids = set()  # Track removed docs to avoid double-removal
            
            for key, docs in duplicates.items():
                try:
                    # Filter out already removed docs
                    docs = [doc for doc in docs if str(doc['_id']) not in removed_doc_ids]
                    
                    if len(docs) <= 1:
                        continue
                    
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
                    
                    dup_type = "offer_id" if key.startswith("id:") else "name"
                    dup_value = key.split(":", 1)[1] if ":" in key else key
                    logging.info(f"Duplicate {dup_type} '{dup_value}': Keeping document {keep_doc['_id']}, removing {len(delete_docs)} duplicates")
                    
                    # Delete duplicate documents
                    for doc in delete_docs:
                        doc_id = str(doc['_id'])
                        if doc_id in removed_doc_ids:
                            continue  # Already removed
                        
                        result = self.offers_collection.delete_one({'_id': doc['_id']})
                        if result.deleted_count > 0:
                            removed_count += 1
                            removed_doc_ids.add(doc_id)
                            logging.info(f"  ✅ Removed duplicate: {doc['_id']}")
                        else:
                            error_msg = f"Failed to remove duplicate {doc['_id']} for {key}"
                            errors.append(error_msg)
                            logging.warning(f"  ⚠️ {error_msg}")
                
                except Exception as e:
                    error_msg = f"Error processing duplicates for {key}: {str(e)}"
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
            
            for key, docs in duplicates.items():
                # Parse the key to get type and value
                if key.startswith("id:"):
                    dup_type = "offer_id"
                    dup_value = key[3:]
                elif key.startswith("name:"):
                    dup_type = "name"
                    dup_value = key[5:]
                else:
                    dup_type = "unknown"
                    dup_value = key
                
                group_info = {
                    'duplicate_type': dup_type,
                    'duplicate_value': dup_value,
                    'offer_id': dup_value if dup_type == 'offer_id' else docs[0].get('offer_id', 'N/A'),
                    'count': len(docs),
                    'documents': [
                        {
                            '_id': str(doc['_id']),
                            'offer_id': doc.get('offer_id', 'N/A'),
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
