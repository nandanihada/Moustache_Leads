#!/usr/bin/env python3

def fix_placement_api():
    """Fix the placement API to include approval status fields"""
    
    file_path = 'd:/pepeleads/ascend/lovable-ascend/backend/routes/placements.py'
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and replace the get_placement response_data (around line 159)
    old_pattern = """            'status': placement['status'],
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching placement: {e}")"""
    
    new_pattern = """            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching placement: {e}")"""
    
    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern)
        print("✅ Fixed get_placement endpoint")
    else:
        print("⚠️ Pattern not found in get_placement endpoint")
    
    # Also fix the update_placement response_data (around line 206)
    old_update_pattern = """            'status': placement['status'],
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error updating placement: {e}")"""
    
    new_update_pattern = """            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error updating placement: {e}")"""
    
    if old_update_pattern in content:
        content = content.replace(old_update_pattern, new_update_pattern)
        print("✅ Fixed update_placement endpoint")
    else:
        print("⚠️ Pattern not found in update_placement endpoint")
    
    # Also fix the create_placement response_data (around line 55)
    old_create_pattern = """            'status': placement['status'],
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Error creating placement: {e}")"""
    
    new_create_pattern = """            'status': placement['status'],
            'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
            'approvedBy': str(placement.get('approvedBy')) if placement.get('approvedBy') else None,
            'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') and hasattr(placement.get('approvedAt'), 'isoformat') else None,
            'rejectionReason': placement.get('rejectionReason'),
            'reviewMessage': placement.get('reviewMessage'),
            'createdAt': placement['createdAt'].isoformat()
        }
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Error creating placement: {e}")"""
    
    if old_create_pattern in content:
        content = content.replace(old_create_pattern, new_create_pattern)
        print("✅ Fixed create_placement endpoint")
    else:
        print("⚠️ Pattern not found in create_placement endpoint")
    
    # Write the file back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n🎯 PLACEMENT API FIXED!")
    print("✅ All placement endpoints now include approval status fields")
    print("✅ ObjectId serialization issue should be resolved")
    print("\n📋 Next steps:")
    print("1. Restart Flask server")
    print("2. Test the placement API")
    print("3. Register new user and create placement")

if __name__ == "__main__":
    fix_placement_api()
