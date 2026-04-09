import sys

filename = r"c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\components\AdminOffersDrilldownView.tsx"

with open(filename, "r", encoding="utf-8") as f:
    text = f.read()

# Replace country card
country_card_old = """<div className="group-avatar" style={{ background: 'var(--surface2)', fontSize:'20px', border: '1px solid var(--border)' }}>
                          <span style={{position:'absolute', fontSize:'10px', top:'3px', left:'3px', fontWeight:700, color:'var(--text2)', background:'var(--surface3)', padding:'1px 4px', borderRadius:'4px'}}>{c.id}</span>
                          <span style={{marginTop: '8px'}}>{c.flag}</span>
                       </div>
                       <div><div className="group-name">{c.name}</div><div className="group-meta">{c.count} offers · {c.networks.length} networks</div></div>"""

country_card_new = """<div className="group-avatar" style={{ background: 'var(--surface2)', fontSize:'14px', border: '1px solid var(--border)', color: 'var(--text)' }}>
                          {c.id}
                       </div>
                       <div><div className="group-name">{c.name} {c.flag}</div><div className="group-meta" style={{color: 'var(--text3)'}}>{c.count} offers · {c.networks.length} networks</div></div>"""

text = text.replace(country_card_old, country_card_new)

# Replace vertical card
vertical_card_old = """<div className="group-avatar" style={{ background: 'var(--surface3)', fontSize:'18px' }}>{v.icon}</div>
                             <div><div className="group-name">{v.name}</div><div className="group-meta">{v.count} offers · {v.geos.length} GEOs</div></div>"""

vertical_card_new = """<div className="group-avatar" style={{ background: 'rgba(176,127,255,0.1)', color: 'var(--purple)', fontSize:'18px', border: '1px solid rgba(176,127,255,0.2)' }}>{v.icon}</div>
                             <div><div className="group-name">{v.name}</div><div className="group-meta" style={{color: 'var(--text3)'}}>{v.count} offers · {v.geos.length} GEOs</div></div>"""

text = text.replace(vertical_card_old, vertical_card_new)

# Write back
with open(filename, "w", encoding="utf-8") as f:
    f.write(text)

print("UI patches applied")
