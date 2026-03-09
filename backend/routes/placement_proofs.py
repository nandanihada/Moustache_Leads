"""Routes for placement proof submission and management"""
from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from models.placement_proof import PlacementProof
from utils.json_serializer import safe_json_response
import logging
import base64
import os
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

placement_proofs_bp = Blueprint('placement_proofs', __name__)
proof_model = PlacementProof()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'proofs')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@placement_proofs_bp.route('/submit', methods=['POST'])
@token_required
def submit_proof():
    """Submit placement proof for an offer"""
    try:
        user = request.current_user
        user_id = str(user['_id'])

        # Handle multipart form data (file uploads)
        if request.content_type and 'multipart/form-data' in request.content_type:
            offer_id = request.form.get('offer_id')
            offer_name = request.form.get('offer_name', '')
            description = request.form.get('description', '')
            placement_url = request.form.get('placement_url', '')
            traffic_source = request.form.get('traffic_source', '')

            image_urls = []
            files = request.files.getlist('images')
            for f in files:
                if f and f.filename:
                    ext = os.path.splitext(f.filename)[1].lower()
                    if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        continue
                    filename = f"{uuid.uuid4().hex}{ext}"
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    f.save(filepath)
                    image_urls.append(f"/uploads/proofs/{filename}")
        else:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            offer_id = data.get('offer_id')
            offer_name = data.get('offer_name', '')
            description = data.get('description', '')
            placement_url = data.get('placement_url', '')
            traffic_source = data.get('traffic_source', '')
            image_urls = data.get('image_urls', [])

            # Handle base64 images
            base64_images = data.get('base64_images', [])
            for img_data in base64_images:
                try:
                    header, encoded = img_data.split(',', 1)
                    ext = '.png'
                    if 'jpeg' in header or 'jpg' in header:
                        ext = '.jpg'
                    elif 'gif' in header:
                        ext = '.gif'
                    elif 'webp' in header:
                        ext = '.webp'
                    filename = f"{uuid.uuid4().hex}{ext}"
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    with open(filepath, 'wb') as fh:
                        fh.write(base64.b64decode(encoded))
                    image_urls.append(f"/uploads/proofs/{filename}")
                except Exception as e:
                    logger.warning(f"Failed to save base64 image: {e}")

        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400

        proof, error = proof_model.submit_proof(user_id, offer_id, {
            'offer_name': offer_name,
            'image_urls': image_urls,
            'placement_url': placement_url,
            'description': description,
            'traffic_source': traffic_source,
        })

        if error:
            return jsonify({'error': error}), 400

        return safe_json_response(proof, 201)

    except Exception as e:
        logger.error(f"Submit proof error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@placement_proofs_bp.route('/my-proofs', methods=['GET'])
@token_required
def get_my_proofs():
    """Get current user's submitted proofs"""
    try:
        user = request.current_user
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))

        proofs, total = proof_model.get_proofs_by_user(str(user['_id']), page, per_page)
        score, approved = proof_model.get_user_score(str(user['_id']))

        return safe_json_response({
            'proofs': proofs,
            'total': total,
            'score': score,
            'approved_count': approved,
            'page': page,
            'per_page': per_page
        })
    except Exception as e:
        logger.error(f"Get my proofs error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@placement_proofs_bp.route('/check/<offer_id>', methods=['GET'])
@token_required
def check_proof_exists(offer_id):
    """Check if user already submitted proof for an offer"""
    try:
        user = request.current_user
        proofs = proof_model.get_proofs_for_offer(str(user['_id']), offer_id)
        return safe_json_response({
            'has_proof': len(proofs) > 0,
            'proofs': proofs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Admin routes ----

@placement_proofs_bp.route('/admin/all', methods=['GET'])
@token_required
@subadmin_or_admin_required('offers')
def get_all_proofs():
    """Get all placement proofs (admin)"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        status = request.args.get('status', 'all')
        user_id = request.args.get('user_id')

        proofs, total = proof_model.get_all_proofs(page, per_page, status, user_id)

        # Enrich with user info
        from database import db_instance
        users_collection = db_instance.get_collection('users')
        if users_collection is not None:
            user_ids = list(set(p['user_id'] for p in proofs))
            from bson import ObjectId
            users = {}
            for uid in user_ids:
                try:
                    u = users_collection.find_one({'_id': ObjectId(uid)}, {'username': 1, 'email': 1, 'first_name': 1})
                    if u:
                        users[uid] = {
                            'username': u.get('username', ''),
                            'email': u.get('email', ''),
                            'name': u.get('first_name', u.get('username', ''))
                        }
                except:
                    pass
            for p in proofs:
                p['user_info'] = users.get(p['user_id'], {})

        return safe_json_response({
            'proofs': proofs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        })
    except Exception as e:
        logger.error(f"Get all proofs error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@placement_proofs_bp.route('/admin/<proof_id>/review', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def review_proof(proof_id):
    """Review a placement proof (approve/reject)"""
    try:
        data = request.get_json()
        status = data.get('status')  # approved or rejected
        admin_notes = data.get('admin_notes', '')
        score = int(data.get('score', 0))

        if status not in ['approved', 'rejected']:
            return jsonify({'error': 'Status must be approved or rejected'}), 400

        proof, error = proof_model.update_proof_status(proof_id, status, admin_notes, score)
        if error:
            return jsonify({'error': error}), 400

        return safe_json_response(proof)
    except Exception as e:
        logger.error(f"Review proof error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@placement_proofs_bp.route('/admin/bulk-review', methods=['PUT'])
@token_required
@subadmin_or_admin_required('offers')
def bulk_review_proofs():
    """Bulk review multiple placement proofs (approve/reject)"""
    try:
        data = request.get_json()
        proof_ids = data.get('proof_ids', [])
        status = data.get('status')
        admin_notes = data.get('admin_notes', '')
        score = int(data.get('score', 0))

        if status not in ['approved', 'rejected']:
            return jsonify({'error': 'Status must be approved or rejected'}), 400

        if not proof_ids:
            return jsonify({'error': 'No proof IDs provided'}), 400

        results = {'processed': 0, 'failed': 0, 'errors': []}

        for pid in proof_ids:
            try:
                proof, error = proof_model.update_proof_status(pid, status, admin_notes, score)
                if error:
                    results['failed'] += 1
                    results['errors'].append(f'{pid}: {error}')
                else:
                    results['processed'] += 1
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f'{pid}: {str(e)}')

        return safe_json_response({
            'message': f'Bulk review complete: {results["processed"]} {status}, {results["failed"]} failed',
            'results': results
        })
    except Exception as e:
        logger.error(f"Bulk review proofs error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@placement_proofs_bp.route('/image/<filename>', methods=['GET'])
def serve_proof_image(filename):
    """Serve a proof image file"""
    from flask import send_from_directory
    return send_from_directory(UPLOAD_DIR, filename)
