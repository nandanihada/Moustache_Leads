#!/usr/bin/env python3
"""Insert Related Offers button + expanded section into PublisherRow.tsx"""
import sys
print("SCRIPT STARTED", flush=True)

filepath = 'src/pages/offer-requests/PublisherRow.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

NL = b'\r\n'

old = (b'Request Proof</Button>' + NL +
       b' '*24 + b'</div>' + NL +
       b' '*22 + b'</div>' + NL +
       b' '*20 + b'))}' + NL +
       b' '*18 + b'</div>')

if old not in content:
    print('ERROR: old pattern not found')
    exit(1)

# Read the related section template and fix line endings
with open('related_section.txt', 'rb') as f:
    related = f.read()
related = related.replace(b'\r\n', b'\n').replace(b'\n', NL)

# Build the button line (use single quotes in JSX to avoid escaping issues)
btn_line = (
    b"                              <Button size='sm' variant={expandedOfferId === req.offer_id ? 'default' : 'outline'} "
    b"className={`h-7 px-2 text-[10px] gap-1 ${expandedOfferId === req.offer_id ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-300'}`} "
    b"onClick={() => toggleExpandOffer(req.offer_id, req.offer_name)}>"
    b"<ChevronDown className={`w-3 h-3 transition-transform ${expandedOfferId === req.offer_id ? 'rotate-180' : ''}`} />"
    b"{expandedOfferId === req.offer_id ? 'Hide Related' : 'Related Offers'}</Button>"
)

new = (b'Request Proof</Button>' + NL +
       btn_line + NL +
       b' '*24 + b'</div>' + NL + NL +
       related)

content = content.replace(old, new, 1)

with open(filepath, 'wb') as f:
    f.write(content)

# Verify
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()
found = 'Related Offers' in text
print(f'Related Offers in file: {found}')
print(f'toggleExpandOffer calls: {text.count("toggleExpandOffer")}')
