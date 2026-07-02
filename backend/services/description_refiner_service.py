"""
Offer Description Refiner Service
Uses Groq AI to refine raw offer descriptions into structured, user-friendly content.
Extracts: clean summary, step-by-step events, payout levels, restrictions.
"""
import json
import logging
import os
import time
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = 'llama-3.1-8b-instant'  # Fast and cheap


def refine_offer_description(name: str, description: str, payout: float = 0, payout_type: str = 'cpa') -> Dict:
    """
    Use Groq AI to refine a raw offer description into structured data.
    
    Returns:
        {
            "summary": "Clean 1-2 sentence summary for the user",
            "steps": ["Step 1: ...", "Step 2: ...", ...],
            "payout_levels": [{"event": "Registration", "payout": "$2.00"}, ...] or [],
            "restrictions": ["No VPN", "New users only", ...],
            "difficulty": "Easy" | "Medium" | "Hard",
            "estimated_time": "5 min" | "10 min" etc
        }
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set, returning raw description")
        return _fallback_parse(name, description, payout)
    
    if not description or len(description.strip()) < 10:
        return _fallback_parse(name, description, payout)
    
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        
        prompt = f"""You are an offer description refiner for an affiliate marketing platform. 
Given a raw offer description (often messy with campaign data), produce a clean structured JSON output.

RULES:
- Write the summary for END USERS who will complete the offer (not advertisers)
- Keep it simple, friendly, professional
- Extract step-by-step conversion events the user must complete
- If the description mentions multiple events/levels (e.g. "Registration", "Deposit", "FTD"), extract them into payout_levels array with ONLY the event name
- NEVER include any monetary amounts, dollar values, payout numbers, or currency symbols in ANY field (summary, steps, payout_levels, or restrictions). The amounts shown in the raw description are advertiser-internal payouts and must NOT be shown to end users.
- In payout_levels, set the "payout" field to empty string "" for every level
- In the summary, do NOT mention any dollar amounts, deposit amounts, or payout values
- In steps, do NOT mention specific dollar amounts (e.g. write "Make a deposit" instead of "Deposit $20")
- Extract any restrictions (geo, device, VPN, new users only, etc.)
- Estimate difficulty and time based on the steps
- Extract device/platform requirements from the name and description. Look for keywords like "Android", "iOS", "iPhone", "iPad", "Mobile", "Desktop", "Web", "APK", "App Store", "Google Play". Return the detected device as one of: "android", "ios", "mobile", "desktop", "all". If both Android and iOS are mentioned, use "mobile". If no device info found, use "all".

OFFER NAME: {name}
RAW DESCRIPTION:
{description}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "summary": "1-2 sentence user-friendly description (NO dollar amounts)",
  "steps": ["Step 1: ...", "Step 2: ..."],
  "payout_levels": [{{"event": "Event Name", "payout": ""}}],
  "restrictions": ["restriction 1", "restriction 2"],
  "difficulty": "Easy|Medium|Hard",
  "estimated_time": "X min",
  "device": "android|ios|mobile|desktop|all"
}}"""

        # Retry logic for rate limiting
        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=600,
                    response_format={"type": "json_object"}
                )
                break
            except Exception as api_err:
                err_str = str(api_err)
                if '429' in err_str or 'rate_limit' in err_str:
                    # Parse wait time from error if available
                    import re
                    wait_match = re.search(r'try again in ([\d.]+)s', err_str)
                    wait_time = float(wait_match.group(1)) + 2.0 if wait_match else (attempt + 1) * 10
                    logger.info(f"  ⏳ Rate limited, waiting {wait_time:.1f}s (attempt {attempt+1}/{max_retries})")
                    time.sleep(wait_time)
                    if attempt == max_retries - 1:
                        raise
                else:
                    raise
        
        result_text = response.choices[0].message.content.strip()
        result = json.loads(result_text)
        
        # Validate and clean the result
        refined = {
            "summary": str(result.get("summary", "")).strip() or description[:200],
            "steps": result.get("steps", []) if isinstance(result.get("steps"), list) else [],
            "payout_levels": result.get("payout_levels", []) if isinstance(result.get("payout_levels"), list) else [],
            "restrictions": result.get("restrictions", []) if isinstance(result.get("restrictions"), list) else [],
            "difficulty": result.get("difficulty", "Medium") if result.get("difficulty") in ("Easy", "Medium", "Hard") else "Medium",
            "estimated_time": str(result.get("estimated_time", "5 min")).strip(),
            "device": str(result.get("device", "all")).strip().lower() if str(result.get("device", "all")).strip().lower() in ("android", "ios", "mobile", "desktop", "all") else "all"
        }
        
        # Strip any monetary amounts from all fields (safety net)
        import re
        money_pattern = r'\$[\d,]+\.?\d*'
        
        # Strip amounts from summary
        refined["summary"] = re.sub(money_pattern, '', refined["summary"]).strip()
        refined["summary"] = re.sub(r'\s{2,}', ' ', refined["summary"])
        
        # Strip amounts from steps
        refined["steps"] = [re.sub(money_pattern, '', s).strip() for s in refined["steps"]]
        refined["steps"] = [re.sub(r'\s{2,}', ' ', s) for s in refined["steps"]]
        
        # Validate payout_levels format — keep event name only, clear payout
        valid_levels = []
        for level in refined["payout_levels"]:
            if isinstance(level, dict) and "event" in level:
                event_name = re.sub(money_pattern, '', str(level["event"])).strip()
                if event_name:
                    valid_levels.append({"event": event_name, "payout": ""})
        refined["payout_levels"] = valid_levels
        
        # Fallback device detection from name if AI returned "all" but name clearly mentions a device
        if refined["device"] == "all":
            name_lower = name.lower()
            if 'android' in name_lower and 'ios' not in name_lower and 'iphone' not in name_lower:
                refined["device"] = "android"
            elif ('ios' in name_lower or 'iphone' in name_lower or 'ipad' in name_lower) and 'android' not in name_lower:
                refined["device"] = "ios"
            elif 'android' in name_lower and ('ios' in name_lower or 'iphone' in name_lower):
                refined["device"] = "mobile"
            elif 'desktop' in name_lower or 'web only' in name_lower:
                refined["device"] = "desktop"
        
        return refined
        
    except json.JSONDecodeError as e:
        logger.error(f"Groq returned invalid JSON for offer '{name}': {e}")
        return _fallback_parse(name, description, payout)
    except Exception as e:
        logger.error(f"Groq API error for offer '{name}': {e}")
        return _fallback_parse(name, description, payout)


def _fallback_parse(name: str, description: str, payout: float = 0) -> Dict:
    """Simple regex-based fallback when Groq is unavailable."""
    import re
    summary = description[:200] if description else f"Complete the {name} offer to earn rewards."
    
    # Strip any monetary amounts from the summary
    money_pattern = r'\$[\d,]+\.?\d*'
    summary = re.sub(money_pattern, '', summary).strip()
    summary = re.sub(r'\s{2,}', ' ', summary)
    
    # Extract event names only (no amounts) for payout_levels
    payout_levels = []
    if description:
        # Pattern: "Event: $X.XX" or "Event - $X" — extract only the event name
        patterns = [
            r'(\w[\w\s]+?):\s*\$?[\d.]+',
            r'(\w[\w\s]+?)\s*-\s*\$?[\d.]+',
        ]
        for pattern in patterns:
            matches = re.findall(pattern, description)
            if len(matches) >= 2:  # Only if there are multiple levels
                for event in matches:
                    event_clean = event.strip() if isinstance(event, str) else event
                    if len(event_clean) > 2 and len(event_clean) < 40:
                        payout_levels.append({"event": event_clean, "payout": ""})
                if payout_levels:
                    break
    
    return {
        "summary": summary,
        "steps": [],
        "payout_levels": payout_levels,
        "restrictions": [],
        "difficulty": "Medium",
        "estimated_time": "5 min"
    }


def batch_refine_offers(offers_list: list, delay: float = 0.5) -> Tuple[int, int]:
    """
    Batch-refine a list of offer documents. Updates each with refined_description field.
    
    Args:
        offers_list: List of offer dicts with at minimum: offer_id, name, description
        delay: Seconds to wait between API calls (rate limiting)
    
    Returns:
        (success_count, error_count)
    """
    from database import db_instance
    
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        logger.error("Cannot access offers collection")
        return 0, len(offers_list)
    
    success = 0
    errors = 0
    
    for i, offer in enumerate(offers_list):
        offer_id = offer.get('offer_id', str(offer.get('_id', '')))
        name = offer.get('name', 'Unknown Offer')
        description = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)
        payout_type = offer.get('payout_type', 'cpa')
        
        # Skip if already refined
        if offer.get('refined_description') and isinstance(offer.get('refined_description'), dict):
            logger.info(f"[{i+1}/{len(offers_list)}] Skipping {offer_id} — already refined")
            success += 1
            continue
        
        logger.info(f"[{i+1}/{len(offers_list)}] Refining: {name} ({offer_id})")
        
        try:
            refined = refine_offer_description(name, description, payout, payout_type)
            
            # Store in DB
            offers_col.update_one(
                {'offer_id': offer_id},
                {'$set': {
                    'refined_description': refined,
                    'refined_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
                }}
            )
            success += 1
            logger.info(f"  ✅ Refined successfully: {len(refined.get('steps', []))} steps, {len(refined.get('payout_levels', []))} levels")
            
        except Exception as e:
            errors += 1
            logger.error(f"  ❌ Error refining {offer_id}: {e}")
        
        # Rate limiting
        if delay > 0 and i < len(offers_list) - 1:
            time.sleep(delay)
    
    return success, errors
