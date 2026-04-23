from database import db_instance
from services.smart_link_service import SmartLinkService

def check_offers():
    service = SmartLinkService()
    countries = ['', 'US', 'IN', 'GB', 'CA']
    
    print("Checking offer availability per country for Global Smart Link:")
    for country in countries:
        eligible = service._get_eligible_offers(country=country, smart_link={'slug': 'global'})
        print(f"Country: {country or 'UNKNOWN'} -> {len(eligible)} eligible offers")
        if eligible:
            ids = [o.get('offer_id') for o in eligible[:5]]
            print(f"  Sample IDs: {ids}")

if __name__ == "__main__":
    check_offers()
