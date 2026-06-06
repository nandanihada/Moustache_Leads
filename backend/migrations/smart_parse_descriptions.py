"""
Smart local parser — NO API needed. Instantly processes all offerwall offers.
Extracts structure from raw descriptions using pattern matching:
- Summary (first meaningful sentence)
- Steps/Events (conversion points)
- Payout levels (if multiple mentioned)
- Traffic sources (allowed/restricted)
- Restrictions (geo, device, age, etc.)
- Keeps FULL description as summary — nothing cut.
"""
import sys, os, re, datetime, requests
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance
from pymongo import UpdateOne

col = db_instance.get_collection('offers')


def smart_parse(description: str, name: str = '', payout: float = 0) -> dict:
    """Parse description into structured sections using regex. Nothing is cut."""
    if not description:
        return {"summary": f"Complete the {name} offer to earn rewards.", "steps": [], "payout_levels": [], "traffic_sources": {}, "restrictions": [], "difficulty": "Medium", "estimated_time": "5 min"}
    
    text = description.strip()
    summary = text  # Keep FULL text as summary — frontend can format it
    steps = []
    payout_levels = []
    traffic_allowed = []
    traffic_restricted = []
    restrictions = []
    
    # ===== EXTRACT CONVERSION/STEPS =====
    # Pattern: "Converts on X" / "Conversion Point: X" / "Convert on: X"
    conv_patterns = [
        r'(?:Converts?\s+on|Conversion\s+(?:Point|Event|Flow|Type))\s*[:=]?\s*(.+?)(?:\.|$)',
        r'(?:User\s+must|Users?\s+need\s+to|Complete|Action\s+required)\s*[:=]?\s*(.+?)(?:\.|$)',
    ]
    for pat in conv_patterns:
        matches = re.findall(pat, text, re.IGNORECASE)
        for m in matches:
            step = m.strip()
            if len(step) > 5 and step not in steps:
                steps.append(step)
    
    # Pattern: numbered steps "1. Do X 2. Do Y" or "Step 1: X"
    numbered = re.findall(r'(?:(?:Step\s*)?(\d+)[\.\):\-]\s*)(.+?)(?=(?:Step\s*)?\d+[\.\):\-]|$)', text, re.IGNORECASE)
    if len(numbered) >= 2:
        steps = [s[1].strip().rstrip('.') for s in numbered if len(s[1].strip()) > 3]
    
    # Pattern: "Activities : 1) X 2) Y"
    activities = re.findall(r'(?:Activities?\s*:?\s*)(.+)', text, re.IGNORECASE)
    if activities:
        parts = re.split(r'\d+\)', activities[0])
        activity_steps = [p.strip().rstrip(',').strip() for p in parts if len(p.strip()) > 3]
        if len(activity_steps) >= 2:
            steps = activity_steps
    
    # ===== EXTRACT PAYOUT LEVELS =====
    # Only match when it clearly looks like payout events with dollar amounts
    # Pattern: "Event Name - $X.XX" or "Event: $X.XX" but event must be a known conversion keyword
    payout_keywords = ['sign up', 'signup', 'registration', 'register', 'install', 'deposit', 'ftd', 'first deposit', 
                       'purchase', 'subscribe', 'subscription', 'trial', 'free trial', 'completion', 'survey',
                       'download', 'withdrawal', 'first withdrawal', 'wager', 'bet', 'level', 'opt-in', 'optin',
                       'lead', 'sale', 'conversion', 'click', 'cpa', 'cpi', 'cpl']
    
    level_patterns = [
        r'([\w\s]+?)\s*[-–]\s*\$\s*([\d.]+)',
        r'([\w\s]+?)\s*:\s*\$\s*([\d.]+)',
        r'([\w\s]+?)\s*\(\$\s*([\d.]+)\)',
    ]
    for pat in level_patterns:
        matches = re.findall(pat, text)
        if len(matches) >= 2:
            valid_levels = []
            for event, amount in matches:
                ev = event.strip()
                # Only accept if event name contains a known payout keyword
                if any(kw in ev.lower() for kw in payout_keywords) and 3 < len(ev) < 40:
                    try:
                        amt = float(amount)
                        if 0.01 <= amt <= 10000:  # reasonable payout range
                            valid_levels.append({"event": ev, "payout": f"${amount}"})
                    except ValueError:
                        pass
            if len(valid_levels) >= 2:
                payout_levels = valid_levels
                break
    
    # ===== EXTRACT TRAFFIC SOURCES =====
    # Allowed traffic
    allowed_match = re.search(r'(?:Accepted\s+)?Traffic\s+(?:Types?|Sources?|Allowed)\s*[:=]?\s*(.+?)(?:\.|Traffic\s+(?:Sources?\s+)?(?:NOT|Restricted)|Geo|Restriction|$)', text, re.IGNORECASE)
    if allowed_match:
        raw = allowed_match.group(1).strip()
        parts = re.split(r'[,;/]', raw)
        traffic_allowed = [p.strip() for p in parts if len(p.strip()) > 2 and len(p.strip()) < 40]
    
    # "Incent Allowed" / "Incent OK" / "Non Incent"
    if re.search(r'incent\s*(?:allowed|ok|yes)', text, re.IGNORECASE):
        if 'Incentivized' not in traffic_allowed:
            traffic_allowed.append('Incentivized')
    elif re.search(r'non[\s-]*incent', text, re.IGNORECASE):
        traffic_restricted.append('Incentivized')
    
    # Restricted traffic
    restricted_match = re.search(r'Traffic\s+(?:Sources?\s+)?(?:NOT\s+)?(?:Allowed|Restricted|Prohibited)\s*[:=]?\s*(.+?)(?:\.|Geo|$)', text, re.IGNORECASE)
    if restricted_match:
        raw = restricted_match.group(1).strip()
        if 'not' in restricted_match.group(0).lower() or 'restrict' in restricted_match.group(0).lower() or 'prohibit' in restricted_match.group(0).lower():
            parts = re.split(r'[,;]', raw)
            traffic_restricted.extend([p.strip() for p in parts if len(p.strip()) > 2 and 'None' not in p and len(p.strip()) < 50])
    
    # Specific restrictions: "No X Traffic"
    no_traffic = re.findall(r'No\s+([\w\s/]+?)\s+Traffic', text, re.IGNORECASE)
    for nt in no_traffic:
        t = nt.strip()
        if t and t not in traffic_restricted and len(t) < 40:
            traffic_restricted.append(t)
    
    # ===== EXTRACT RESTRICTIONS =====
    # Geo
    geo_match = re.search(r'Geo\s*[:=]?\s*(.+?)(?:\.|Traffic|Restriction|Email|Approval|$)', text, re.IGNORECASE)
    if geo_match:
        geo_val = geo_match.group(1).strip()
        if geo_val and len(geo_val) < 100:
            restrictions.append(f"Geo: {geo_val}")
    
    # Targeting/Age
    target_match = re.search(r'(?:Targeting|Target\s+Audience|Age)\s*[:=]?\s*(.+?)(?:\.|$)', text, re.IGNORECASE)
    if target_match:
        t_val = target_match.group(1).strip()
        if t_val and len(t_val) < 100:
            restrictions.append(f"Targeting: {t_val}")
    
    # Approval period
    approval_match = re.search(r'(?:Approval\s+Period|Approval)\s*[:=]?\s*(.+?)(?:\.|$)', text, re.IGNORECASE)
    if approval_match:
        a_val = approval_match.group(1).strip()
        if a_val and len(a_val) < 60:
            restrictions.append(f"Approval: {a_val}")
    
    # Email restrictions
    email_match = re.search(r'Email\s+Restrictions?\s*[:=]?\s*(.+?)(?:\.|$)', text, re.IGNORECASE)
    if email_match:
        e_val = email_match.group(1).strip()
        if e_val and len(e_val) < 80:
            restrictions.append(f"Email: {e_val}")
    
    # Device
    device_match = re.search(r'(?:Device|Platform)\s*[:=]?\s*((?:Android|iOS|Desktop|Mobile|Web)[\w\s,/&+]+)', text, re.IGNORECASE)
    if device_match:
        restrictions.append(f"Device: {device_match.group(1).strip()}")
    
    # ===== DIFFICULTY =====
    difficulty = "Medium"
    lower = text.lower()
    if any(w in lower for w in ['install', 'sign up', 'register', 'download', 'free trial']):
        difficulty = "Easy"
    if any(w in lower for w in ['deposit', 'purchase', 'ftd', 'funded', 'subscription', 'payment']):
        difficulty = "Medium"
    if any(w in lower for w in ['wager', 'bet', 'multiple', 'level up', 'reach level']):
        difficulty = "Hard"
    
    # ===== ESTIMATED TIME =====
    time_match = re.search(r'(\d+)\s*(?:min|minute)', text, re.IGNORECASE)
    estimated_time = f"{time_match.group(1)} min" if time_match else ("2 min" if difficulty == "Easy" else "5 min" if difficulty == "Medium" else "15 min")
    
    # Build traffic_sources dict
    traffic_sources = {}
    if traffic_allowed:
        traffic_sources["allowed"] = traffic_allowed[:6]
    if traffic_restricted:
        traffic_sources["restricted"] = traffic_restricted[:6]
    
    return {
        "summary": summary,
        "steps": steps[:6],
        "payout_levels": payout_levels[:5],
        "traffic_sources": traffic_sources,
        "restrictions": restrictions[:6],
        "difficulty": difficulty,
        "estimated_time": estimated_time
    }


def main():
    print("=" * 60)
    print("SMART LOCAL PARSER — No API, Instant")
    print("=" * 60)
    
    # Get visible offerwall offers from API
    print("\nFetching visible offerwall offers...")
    try:
        r = requests.get('http://localhost:5000/api/offerwall/offers?placement_id=test123&user_id=user456&limit=10000', timeout=60)
        data = r.json()
        offer_ids = [o['id'] for o in data.get('offers', [])]
        print(f"Got {len(offer_ids)} visible offers")
    except Exception as e:
        print(f"Cannot reach API: {e}")
        return
    
    # Fetch all their descriptions from DB in one query
    print("Loading offer data from DB...")
    offers = list(col.find(
        {'offer_id': {'$in': offer_ids}},
        {'offer_id': 1, 'name': 1, 'description': 1, 'payout': 1, '_id': 0}
    ))
    print(f"Loaded {len(offers)} offers from DB")
    
    # Parse and build bulk update
    print("Parsing descriptions...")
    bulk_ops = []
    for offer in offers:
        oid = offer.get('offer_id', '')
        desc = offer.get('description', '')
        name = offer.get('name', '')
        payout = float(offer.get('payout', 0) or 0)
        
        refined = smart_parse(desc, name, payout)
        bulk_ops.append(UpdateOne(
            {'offer_id': oid},
            {'$set': {'refined_description': refined, 'refined_at': datetime.datetime.now(datetime.timezone.utc)}}
        ))
    
    # Execute bulk update
    print(f"Writing {len(bulk_ops)} updates to DB...")
    if bulk_ops:
        result = col.bulk_write(bulk_ops)
        print(f"Modified: {result.modified_count}")
    
    print(f"\n✅ Done! {len(bulk_ops)} offers parsed and updated instantly.")
    print("Reload your offerwall to see structured descriptions.")


if __name__ == '__main__':
    main()
