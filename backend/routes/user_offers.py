"""
User Offers API Route
Endpoint to fetch approved/rejected offers and other offer-related data for users
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from bson import ObjectId
import logging

user_offers_bp = Blueprint('user_offers', __name__)

@user_offers_bp.route('/users/<user_id>/offers', methods=['GET'])
@token_required
def get_user_offers(user_id):
    """Get approved/rejected offers and related data for a user"""
    logging.info(f"[USER_OFFERS] Endpoint called for user_id={user_id}")
    try:
        user = request.current_user
        if user.get('role') != 'admin':
            logging.warning(f"[USER_OFFERS] Non-admin access attempt by {user.get('username')}")
            return jsonify({'error': 'Admin access required'}), 403
        
        # Get collections
        offers_collection = db_instance.get_collection('offers')
        clicks_collection = db_instance.get_collection('clicks')
        dashboard_clicks = db_instance.get_collection('dashboard_clicks')
        offerwall_clicks = db_instance.get_collection('offerwall_clicks')
        offerwall_clicks_detailed = db_instance.get_collection('offerwall_clicks_detailed')
        
        # Get user data
        users_collection = db_instance.get_collection('users')
        target_user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
        
        username = target_user.get('username')
        email = target_user.get('email')
        
        logging.info(f"Fetching offers for user_id={user_id}, username={username}, email={email}")
        
        # Get approved offers from affiliate_requests
        affiliate_requests = db_instance.get_collection('affiliate_requests')
        approved_offers_formatted = []
        rejected_offers_data = []
        
        if affiliate_requests is not None:
            # Get approved requests - check both user_id and publisher_id fields
            approved_requests = list(affiliate_requests.find({
                '$or': [
                    {'user_id': user_id},
                    {'user_id': ObjectId(user_id)},
                    {'publisher_id': user_id},
                    {'publisher_id': ObjectId(user_id)},
                    {'username': username},
                    {'email': email}
                ],
                'status': 'approved'
            }).limit(100))
            
            logging.info(f"[USER_OFFERS] Found {len(approved_requests)} approved requests for user_id={user_id}, username={username}")
            
            for req in approved_requests:
                offer = offers_collection.find_one({'offer_id': req.get('offer_id')})
                if offer:
                    approved_offers_formatted.append({
                        'id': offer.get('offer_id'),
                        'name': offer.get('name'),
                        'network': offer.get('network', 'N/A'),
                        'payout': offer.get('payout', 0)
                    })
                else:
                    # If offer not found in offers collection, use data from request
                    approved_offers_formatted.append({
                        'id': req.get('offer_id'),
                        'name': req.get('offer_name', 'Unknown Offer'),
                        'network': 'N/A',
                        'payout': 0
                    })
            
            # Get rejected requests - check both user_id and publisher_id fields
            rejected_requests = list(affiliate_requests.find({
                '$or': [
                    {'user_id': user_id},
                    {'user_id': ObjectId(user_id)},
                    {'publisher_id': user_id},
                    {'publisher_id': ObjectId(user_id)},
                    {'username': username},
                    {'email': email}
                ],
                'status': 'rejected'
            }).limit(100))
            
            logging.info(f"[USER_OFFERS] Found {len(rejected_requests)} rejected requests for user_id={user_id}, username={username}")
            
            for req in rejected_requests:
                offer = offers_collection.find_one({'offer_id': req.get('offer_id')})
                if offer:
                    rejected_offers_data.append({
                        'id': offer.get('offer_id'),
                        'name': offer.get('name'),
                        'network': offer.get('network', 'N/A'),
                        'payout': offer.get('payout', 0),
                        'reason': req.get('rejection_reason', 'Not specified')
                    })
                else:
                    # If offer not found in offers collection, use data from request
                    rejected_offers_data.append({
                        'id': req.get('offer_id'),
                        'name': req.get('offer_name', 'Unknown Offer'),
                        'network': 'N/A',
                        'payout': 0,
                        'reason': req.get('rejection_reason', 'Not specified')
                    })
        
        # Get top 10 viewed offers from clicks collections
        offer_views = {}
        
        # Build comprehensive queries for all possible field combinations
        queries_to_try = [
            {'user_id': user_id},
            {'affiliate_id': user_id},
            {'publisher_id': user_id},
            {'username': username} if username else None,
            {'user_email': email} if email else None,
            {'publisher_name': username} if username else None,
        ]
        queries_to_try = [q for q in queries_to_try if q is not None]
        
        total_clicks_found = 0
        
        # Query clicks collection
        if clicks_collection is not None:
            for query in queries_to_try:
                try:
                    clicks = list(clicks_collection.find(query, {'offer_id': 1}))
                    total_clicks_found += len(clicks)
                    for click in clicks:
                        offer_id = click.get('offer_id')
                        if offer_id:
                            offer_views[offer_id] = offer_views.get(offer_id, 0) + 1
                except Exception as e:
                    logging.warning(f"Error querying clicks with {query}: {e}")
        
        # Query offerwall_clicks
        if offerwall_clicks is not None:
            for query in queries_to_try:
                try:
                    clicks = list(offerwall_clicks.find(query, {'offer_id': 1}))
                    total_clicks_found += len(clicks)
                    for click in clicks:
                        offer_id = click.get('offer_id')
                        if offer_id:
                            offer_views[offer_id] = offer_views.get(offer_id, 0) + 1
                except Exception as e:
                    logging.warning(f"Error querying offerwall_clicks with {query}: {e}")
        
        # Query offerwall_clicks_detailed
        if offerwall_clicks_detailed is not None:
            for query in queries_to_try:
                try:
                    clicks = list(offerwall_clicks_detailed.find(query, {'offer_id': 1}))
                    total_clicks_found += len(clicks)
                    for click in clicks:
                        offer_id = click.get('offer_id')
                        if offer_id:
                            offer_views[offer_id] = offer_views.get(offer_id, 0) + 1
                except Exception as e:
                    logging.warning(f"Error querying offerwall_clicks_detailed with {query}: {e}")
        
        # Query dashboard_clicks
        if dashboard_clicks is not None:
            for query in queries_to_try:
                try:
                    clicks = list(dashboard_clicks.find(query, {'offer_id': 1}))
                    total_clicks_found += len(clicks)
                    for click in clicks:
                        offer_id = click.get('offer_id')
                        if offer_id:
                            offer_views[offer_id] = offer_views.get(offer_id, 0) + 1
                except Exception as e:
                    logging.warning(f"Error querying dashboard_clicks with {query}: {e}")
        
        logging.info(f"Total clicks found: {total_clicks_found}, Unique offers viewed: {len(offer_views)}")
        
        # Sort and get top 10
        top_viewed_offers = []
        sorted_offers = sorted(offer_views.items(), key=lambda x: x[1], reverse=True)[:10]
        
        for offer_id, views in sorted_offers:
            offer = offers_collection.find_one({'offer_id': offer_id})
            if offer:
                top_viewed_offers.append({
                    'id': offer_id,
                    'name': offer.get('name', 'Unknown'),
                    'category': offer.get('category', 'N/A'),
                    'views': views
                })
        
        logging.info(f"Top viewed offers: {len(top_viewed_offers)}")
        
        # Get search keywords from search_logs or clicks with search terms
        search_keywords = []
        search_logs = db_instance.get_collection('search_logs')
        if search_logs is not None:
            try:
                search_queries = [
                    {'user_id': user_id},
                    {'username': username} if username else None,
                    {'email': email} if email else None,
                ]
                search_queries = [q for q in search_queries if q is not None]
                
                search_terms = {}
                for query in search_queries:
                    try:
                        for log in search_logs.find(query, {'search_term': 1, 'query': 1}):
                            term = log.get('search_term') or log.get('query')
                            if term:
                                search_terms[term] = search_terms.get(term, 0) + 1
                    except Exception as e:
                        logging.warning(f"Error querying search_logs with {query}: {e}")
                
                # Sort by count and get top 20
                sorted_terms = sorted(search_terms.items(), key=lambda x: x[1], reverse=True)[:20]
                search_keywords = [{'term': term, 'count': count} for term, count in sorted_terms]
                
                logging.info(f"Search keywords found: {len(search_keywords)}")
            except Exception as e:
                logging.warning(f"Error getting search keywords: {e}")
        
        # Get matched offers based on user's vertical, geo, and history
        user_vertical = target_user.get('verticals', [])
        user_geos = target_user.get('geos', [])
        
        # Build match query
        match_query = {'status': 'active'}
        if user_vertical:
            match_query['category'] = {'$in': user_vertical}
        if user_geos:
            match_query['$or'] = [
                {'countries': {'$in': user_geos}},
                {'countries': {'$size': 0}}  # Global offers
            ]
        
        matched_offers_data = list(offers_collection.find(match_query).limit(10))
        
        matched_offers = []
        for offer in matched_offers_data:
            match_score = 50  # Base score
            match_reasons = []
            
            if offer.get('category') in user_vertical:
                match_score += 25
                match_reasons.append('Vertical Match')
            
            if any(geo in offer.get('countries', []) for geo in user_geos):
                match_score += 25
                match_reasons.append('GEO Match')
            
            matched_offers.append({
                'id': offer.get('offer_id'),
                'name': offer.get('name'),
                'network': offer.get('network', 'N/A'),
                'category': offer.get('category', 'N/A'),
                'geo': ', '.join(offer.get('countries', [])[:3]) if offer.get('countries') else 'Global',
                'payout': offer.get('payout', 0),
                'payout_type': offer.get('payout_type', 'CPA'),
                'match_score': min(match_score, 100),
                'match_reasons': match_reasons
            })
        
        logging.info(f"[USER_OFFERS] Response - Approved: {len(approved_offers_formatted)}, Rejected: {len(rejected_offers_data)}, Top Viewed: {len(top_viewed_offers)}, Keywords: {len(search_keywords)}, Matched: {len(matched_offers)}")
        
        return jsonify({
            'success': True,
            'approved_offers': approved_offers_formatted,
            'rejected_offers': rejected_offers_data,
            'top_viewed_offers': top_viewed_offers,
            'search_keywords': search_keywords,
            'matched_offers': matched_offers
        }), 200
        
    except Exception as e:
        logging.error(f"[USER_OFFERS] Error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'approved_offers': [],
            'rejected_offers': [],
            'top_viewed_offers': [],
            'search_keywords': [],
            'matched_offers': []
        }), 500
