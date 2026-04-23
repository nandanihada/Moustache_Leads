import ast
with open('backend/routes/postback_receiver.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the block that skips calculation if no postback_url
old_block = """                                    if not owner_postback_url:
                                        logger.warning(f"⚠️ Owner {owner_username} has no postback_url configured")
                                    else:
                                        # Calculate payout using revenue share if configured"""

new_block = """                                    if not owner_postback_url:
                                        logger.warning(f"⚠️ Owner {owner_username} has no postback_url configured, but continuing calculation for points tracking.")
                                        
                                    # Calculate payout using revenue share if configured
                                    if True:"""
                                    
text = text.replace(old_block, new_block)

# Replace the block that skips updating points and logging to forwarded_postbacks if network request fails or skips
old_req_block = """                                        # Send the postback
                                        import requests
                                        try:
                                                    response = requests.get(final_url, timeout=10)
                                                    logger.info(f"✅ Sent to {owner_username}! Status: {response.status_code}")
                                                    
                                                    # Log to forwarded_postbacks collection
                                                    forwarded_postbacks = get_collection('forwarded_postbacks')
                                                    if forwarded_postbacks is not None:
                                                        forwarded_log = {
                                                            'timestamp': datetime.utcnow(),
                                                            'original_postback_id': result.inserted_id,
                                                            'publisher_id': str(owner_user.get('_id')),
                                                            'publisher_name': owner_username,
                                                            'username': actual_username,
                                                            'points': points_calc['total_points'],
                                                            'revenue': upward_payout,
                                                            'forward_url': final_url,
                                                            'forward_status': 'success' if response.status_code == 200 else 'failed',
                                                            'response_code': response.status_code,
                                                            'response_body': response.text[:500],
                                                            'original_params': params,
                                                            'enriched_params': macros,
                                                            'placement_id': placement_id,
                                                            'placement_title': placement_title,
                                                            'offer_id': offer_id or 'unknown',
                                                            'click_id': click_id or 'unknown'
                                                        }
                                                        forwarded_postbacks.insert_one(forwarded_log)
                                                        logger.info(f"📝 Logged to forwarded_postbacks collection")
                                                    
                                                    # Update user points if successful
                                                    if response.status_code == 200 and user_id_from_click and points_calc['total_points'] > 0:"""

new_req_block = """                                        # Send the postback
                                        import requests
                                        res_status = 0
                                        res_text = ''
                                        forward_status = 'failed'
                                        
                                        if owner_postback_url:
                                            try:
                                                response = requests.get(final_url, timeout=10)
                                                res_status = response.status_code
                                                res_text = response.text[:500] if hasattr(response, 'text') else str(response)
                                                forward_status = 'success' if res_status == 200 else 'failed'
                                                logger.info(f"✅ Sent to {owner_username}! Status: {res_status}")
                                            except Exception as send_error:
                                                logger.error(f"❌ Error sending postback: {send_error}")
                                                res_text = str(send_error)[:500]
                                        else:
                                            forward_status = 'no_url'
                                            res_text = 'No postback URL configured'
                                            
                                        # Log to forwarded_postbacks collection REGARDLESS of ping success!
                                        forwarded_postbacks = get_collection('forwarded_postbacks')
                                        if forwarded_postbacks is not None:
                                            forwarded_log = {
                                                'timestamp': datetime.utcnow(),
                                                'original_postback_id': result.inserted_id,
                                                'publisher_id': str(owner_user.get('_id')),
                                                'publisher_name': owner_username,
                                                'username': actual_username,
                                                'points': points_calc['total_points'],
                                                'revenue': float(upward_payout) if str(upward_payout).replace('.','',1).isdigit() else points_calc['total_points'],
                                                'forward_url': final_url if owner_postback_url else '',
                                                'forward_status': forward_status,
                                                'response_code': res_status,
                                                'response_body': res_text,
                                                'original_params': params,
                                                'enriched_params': macros,
                                                'placement_id': placement_id,
                                                'placement_title': placement_title,
                                                'offer_id': offer_id or 'unknown',
                                                'click_id': click_id or 'unknown'
                                            }
                                            forwarded_postbacks.insert_one(forwarded_log)
                                            logger.info(f"📝 Logged to forwarded_postbacks collection as {forward_status}")
                                        
                                        # Update user points ALWAYS (since ML received the conversion)
                                        if user_id_from_click and points_calc['total_points'] > 0:
                                            try:
                                                # mock block to keep indentation exact"""

text = text.replace(old_req_block, new_req_block)


# also replace remaining update logic indentation mismatch
old_cleanup = """                                                    if response.status_code == 200 and user_id_from_click and points_calc['total_points'] > 0:"""
text = text.replace(old_cleanup, """                                                    pass""")

with open('backend/routes/postback_receiver.py', 'w', encoding='utf-8') as f:
    f.write(text)
