"""
Refine ONLY offerwall-visible offers using Google Gemini API.
Fetches the 491 visible offers from the offerwall API, then uses Gemini to properly
structure each description: extract steps, traffic info, payout levels, restrictions.

Usage: cd backend && python migrations/refine_with_gemini.py
"""
import sys, os, json, time, requests, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

col = db_instance.get_collection('offers')


def refine_with_gemini(name: str, description: str, payout: float, payout_type: str) -> dict:
    """Call Gemini to refine one offer description."""
    prompt = f"""You are an offer description refiner for an affiliate marketing offerwall.
Given a raw offer description (often messy with advertiser campaign data), produce clean structured JSON.

RULES:
- Write "summary" for END USERS who will complete the offer (friendly, professional, 1-2 sentences)
- Extract "steps" — the conversion events/actions the user must complete (e.g. "Sign up", "Make first deposit", "Complete survey")
- Extract "payout_levels" — if the description mentions multiple payout events with amounts (e.g. "Registration: $2, FTD: $10"), extract each as {{"event": "...", "payout": "$X.XX"}}. If only one payout, leave empty array.
- Extract "traffic_sources" — allowed/restricted traffic types mentioned (e.g. "Incent Allowed", "No Pop/Under", "Banner, Display, Social")
- Extract "restrictions" — geo limits, device requirements, age targeting, approval periods, anything the user needs to know
- "difficulty": Easy (just sign up/install), Medium (requires action like deposit/purchase), Hard (multiple steps/high commitment)
- "estimated_time": realistic time to complete

OFFER NAME: {name}
PAYOUT: ${payout} ({payout_type})
RAW DESCRIPTION:
{description}

Return ONLY valid JSON:
{{"summary":"...","steps":["Step 1","Step 2"],"payout_levels":[{{"event":"...","payout":"$X.XX"}}],"traffic_sources":{{"allowed":["..."],"restricted":["..."]}},"restrictions":["..."],"difficulty":"Easy|Medium|Hard","estimated_time":"X min"}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1000
        }
    }

    for attempt in range(3):
        try:
            r = requests.post(
                GEMINI_URL,
                json=payload,
                headers={"Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY},
                timeout=30
            )
            if r.status_code == 429:
                wait = (attempt + 1) * 10
                print(f"    ⏳ Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if r.status_code != 200:
                print(f"    ❌ HTTP {r.status_code}: {r.text[:100]}")
                return None
            
            data = r.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            
            # Clean the response - remove markdown code blocks if present
            text = text.strip()
            if text.startswith('```json'):
                text = text[7:]
            if text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            # Try to find JSON object in the text
            import re
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                text = json_match.group(0)
            
            result = json.loads(text)
            
            # Validate
            refined = {
                "summary": str(result.get("summary", ""))[:500],
                "steps": result.get("steps", []) if isinstance(result.get("steps"), list) else [],
                "payout_levels": [],
                "traffic_sources": result.get("traffic_sources", {}) if isinstance(result.get("traffic_sources"), dict) else {},
                "restrictions": result.get("restrictions", []) if isinstance(result.get("restrictions"), list) else [],
                "difficulty": result.get("difficulty", "Medium"),
                "estimated_time": str(result.get("estimated_time", "5 min"))
            }
            
            # Validate payout_levels
            for level in (result.get("payout_levels") or []):
                if isinstance(level, dict) and "event" in level and "payout" in level:
                    refined["payout_levels"].append({"event": str(level["event"]), "payout": str(level["payout"])})
            
            return refined
            
        except json.JSONDecodeError as e:
            print(f"    ⚠️ Invalid JSON from Gemini: {e}")
            return None
        except Exception as e:
            print(f"    ❌ Error: {e}")
            if attempt < 2:
                time.sleep(2)
            else:
                return None
    return None


def main():
    print("=" * 60)
    print("GEMINI AI — Offerwall Description Refiner")
    print("=" * 60)
    
    # Step 1: Get the 491 visible offerwall offer IDs from the API
    print("\n📡 Fetching visible offerwall offers from API...")
    try:
        r = requests.get('http://localhost:5000/api/offerwall/offers?placement_id=test123&user_id=user456&limit=10000', timeout=60)
        data = r.json()
        api_offers = data.get('offers', [])
        print(f"   Got {len(api_offers)} offers from offerwall API")
    except Exception as e:
        print(f"   ❌ Cannot reach API: {e}")
        print("   Make sure backend is running: python run.py")
        return
    
    # Step 2: Get their offer IDs
    offer_ids = [o['id'] for o in api_offers]
    print(f"   Target: {len(offer_ids)} offers to refine with Gemini")
    
    # Step 3: Process each one
    success = 0
    errors = 0
    skipped = 0
    
    est_time = len(offer_ids) * 1.5  # ~1.5s per offer with Gemini
    print(f"   Estimated time: ~{est_time/60:.1f} minutes")
    print("")
    
    for i, oid in enumerate(offer_ids):
        # Get full offer data from DB
        offer = col.find_one({'offer_id': oid}, {'name': 1, 'description': 1, 'payout': 1, 'payout_type': 1, 'refined_description': 1, '_id': 0})
        if not offer:
            skipped += 1
            continue
        
        # Skip if already properly refined by AI (has steps)
        existing_rd = offer.get('refined_description')
        if existing_rd and isinstance(existing_rd, dict) and len(existing_rd.get('steps', [])) > 0:
            skipped += 1
            continue
        
        name = offer.get('name', 'Unknown')
        desc = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)
        payout_type = offer.get('payout_type', 'cpa')
        
        # Skip if description is too short
        if not desc or len(desc.strip()) < 20:
            skipped += 1
            continue
        
        print(f"[{i+1}/{len(offer_ids)}] {name[:50]}...", end=" ")
        
        refined = refine_with_gemini(name, desc, payout, payout_type)
        
        if refined:
            col.update_one(
                {'offer_id': oid},
                {'$set': {'refined_description': refined, 'refined_at': datetime.datetime.now(datetime.timezone.utc)}}
            )
            steps_count = len(refined.get('steps', []))
            levels_count = len(refined.get('payout_levels', []))
            print(f"✅ ({steps_count} steps, {levels_count} levels)")
            success += 1
        else:
            print("❌")
            errors += 1
        
        # Small delay to avoid rate limits (Gemini is generous but be safe)
        time.sleep(5.0)
    
    print("")
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"✅ Refined: {success}")
    print(f"❌ Errors: {errors}")
    print(f"⏭️  Skipped (no description): {skipped}")
    print(f"📊 Total: {success + errors + skipped}/{len(offer_ids)}")


if __name__ == '__main__':
    main()
