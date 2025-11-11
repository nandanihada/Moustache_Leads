from database import db_instance
from models.link_masking import LinkMasking

lm = LinkMasking()
domains = lm.get_masking_domains(active_only=True)

print(f"\nActive masking domains: {len(domains)}")
if domains:
    for d in domains:
        print(f"  - {d['domain']} (Status: {d.get('status', 'unknown')})")
else:
    print("  ❌ NO DOMAINS FOUND - This is why masking is not working!")
    print("\n  Fix: Run 'python setup_masking_domain.py' to create a domain")
