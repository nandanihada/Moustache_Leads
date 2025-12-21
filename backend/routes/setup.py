"""
One-time setup endpoint for SurveyTitans
Call this once after deployment: GET /api/setup/surveytitans
"""
from flask import Blueprint, jsonify
from database import db_instance
from datetime import datetime

setup_bp = Blueprint('setup', __name__)

@setup_bp.route('/api/setup/surveytitans', methods=['GET'])
def setup_surveytitans():
    """One-time setup for SurveyTitans placement and user"""
    try:
        if not db_instance.is_connected():
            db_instance.connect()
        
        results = []
        
        # 1. Create/update SurveyTitans user
        users = db_instance.get_collection('users')
        if users is not None:
            surveytitans_user = users.find_one({'username': 'surveytitans'})
            
            if not surveytitans_user:
                surveytitans_user = {
                    'username': 'surveytitans',
                    'email': 'admin@surveytitans.com',
                    'role': 'publisher',
                    'postback_url': 'https://surveytitans.com/postback/0591bfd36b464d6cce7b41f4de71e2a8?username={username}&status={status}&payout={points}&transaction_id={transaction_id}',
                    'created_at': datetime.utcnow(),
                    'status': 'active'
                }
                result = users.insert_one(surveytitans_user)
                surveytitans_user['_id'] = result.inserted_id
                results.append(f"✅ Created SurveyTitans user: {result.inserted_id}")
            else:
                # Update postback URL
                users.update_one(
                    {'_id': surveytitans_user['_id']},
                    {'$set': {
                        'postback_url': 'https://surveytitans.com/postback/0591bfd36b464d6cce7b41f4de71e2a8?username={username}&status={status}&payout={points}&transaction_id={transaction_id}'
                    }}
                )
                results.append(f"✅ Updated SurveyTitans user: {surveytitans_user['_id']}")
            
            # 2. Create placement
            placements = db_instance.get_collection('placements')
            if placements is not None:
                placement = {
                    '_id': 'zalUDOuAS0gaBh33',
                    'placementId': 'zalUDOuAS0gaBh33',
                    'placement_id': 'zalUDOuAS0gaBh33',
                    'offerwallTitle': 'SurveyTitans Offerwall',
                    'created_by': str(surveytitans_user['_id']),
                    'user_id': str(surveytitans_user['_id']),
                    'publisherId': str(surveytitans_user['_id']),
                    'status': 'active',
                    'created_at': datetime.utcnow()
                }
                
                try:
                    placements.insert_one(placement)
                    results.append(f"✅ Created placement: zalUDOuAS0gaBh33")
                except Exception as e:
                    if 'duplicate key' in str(e):
                        results.append(f"✅ Placement already exists")
                    else:
                        results.append(f"❌ Error creating placement: {e}")
            
            # 3. Add external offer mapping
            offers = db_instance.get_collection('offers')
            if offers is not None:
                result = offers.update_one(
                    {'offer_id': 'ML-00057'},
                    {'$set': {'external_offer_id': 'VBFS6'}},
                    upsert=False
                )
                if result.modified_count > 0:
                    results.append(f"✅ Added external_offer_id mapping: VBFS6 → ML-00057")
                else:
                    results.append(f"✅ External mapping already exists or offer not found")
        
        return jsonify({
            'success': True,
            'message': 'SurveyTitans setup complete',
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@setup_bp.route('/api/setup/check-mapping', methods=['GET'])
def check_mapping():
    """Check if offer mapping exists"""
    try:
        if not db_instance.is_connected():
            db_instance.connect()
        
        results = []
        
        # Check offer
        offers = db_instance.get_collection('offers')
        if offers is not None:
            offer = offers.find_one({'offer_id': 'ML-00057'})
            if offer:
                results.append({
                    'offer_id': offer.get('offer_id'),
                    'name': offer.get('offer_name'),
                    'external_offer_id': offer.get('external_offer_id'),
                    'payout': offer.get('payout')
                })
                
                # If no external_offer_id, add it
                if not offer.get('external_offer_id'):
                    offers.update_one(
                        {'offer_id': 'ML-00057'},
                        {'$set': {'external_offer_id': 'VBFS6'}}
                    )
                    results.append({'message': '✅ Added external_offer_id: VBFS6'})
            else:
                results.append({'error': '❌ Offer ML-00057 not found in database'})
        
        return jsonify({
            'success': True,
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@setup_bp.route('/api/setup/fix-offer-mapping', methods=['GET'])
def fix_offer_mapping():
    """Find and fix the correct offer mapping for VBFS6"""
    try:
        if not db_instance.is_connected():
            db_instance.connect()
        
        results = []
        
        # Find "My first offer"
        offers = db_instance.get_collection('offers')
        if offers is not None:
            my_first_offer = offers.find_one({'$or': [
                {'offer_name': {'$regex': 'first', '$options': 'i'}},
                {'name': {'$regex': 'first', '$options': 'i'}}
            ]})
            
            if my_first_offer:
                offer_id = my_first_offer.get('offer_id')
                results.append({
                    'offer_id': offer_id,
                    'name': my_first_offer.get('offer_name', my_first_offer.get('name'))
                })
                
                # Update mapping
                result = offers.update_one(
                    {'offer_id': offer_id},
                    {'$set': {'external_offer_id': 'VBFS6'}}
                )
                
                if result.modified_count > 0:
                    results.append({'message': f'✅ Updated: VBFS6 → {offer_id}'})
                else:
                    results.append({'message': f'✅ Already mapped: VBFS6 → {offer_id}'})
                
                # Remove old mapping
                offers.update_one(
                    {'offer_id': 'ML-00057'},
                    {'$unset': {'external_offer_id': ''}}
                )
                results.append({'message': '✅ Removed old ML-00057 mapping'})
            else:
                results.append({'error': 'My first offer not found'})
        
        return jsonify({
            'success': True,
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
