import sys

filename = r"c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\components\AdminOffersDrilldownView.tsx"

with open(filename, "r", encoding="utf-8") as f:
    text = f.read()

replaces = [
    (
        '<div className="group-tags">{n.verticals.slice(0,4).map(v => <span key={v} className="tag vertical">{v}</span>)}</div>',
        '<div className="group-tags">{n.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => { e.stopPropagation(); drillInContext(\'vertical\', v, e); }}>{v}</span>)}</div>'
    ),
    (
        '<div className="group-tags" style={{marginTop: \'4px\'}}>{n.geos.slice(0,5).map(g => <span key={g} className="tag geo">{g}</span>)}</div>',
        '<div className="group-tags" style={{marginTop: \'4px\'}}>{n.geos.slice(0,5).map(g => <span key={g} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext(\'country\', g, e); }}>{g}</span>)}</div>'
    ),
    (
        '<div className="group-tags">{v.networks.slice(0,6).map(n => <span key={n} className="tag geo">{n}</span>)}</div>',
        '<div className="group-tags">{v.networks.slice(0,6).map(n => <span key={n} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext(\'network\', n, e); }}>{n}</span>)}</div>'
    ),
    (
        '<div className="group-tags" style={{marginTop: \'4px\'}}>{v.geos.slice(0,6).map(g => <span key={g} className="tag geo">{g}</span>)}</div>',
        '<div className="group-tags" style={{marginTop: \'4px\'}}>{v.geos.slice(0,6).map(g => <span key={g} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext(\'country\', g, e); }}>{g}</span>)}</div>'
    ),
    (
        '<div className="group-tags">{c.verticals.slice(0,4).map(v => <span key={v} className="tag vertical">{v}</span>)}</div>',
        '<div className="group-tags">{c.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => { e.stopPropagation(); drillInContext(\'vertical\', v, e); }}>{v}</span>)}</div>'
    ),
    (
        '<div className="group-tags">{networks.slice(0,5).map(n => <span key={n} className="tag geo">{n}</span>)}</div>',
        '<div className="group-tags">{networks.slice(0,5).map(n => <span key={n} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext(\'network\', n, e); }}>{n}</span>)}</div>'
    ),
    (
        '<span className="tag vertical">{parseVertical(o)}</span>',
        '<span className="tag vertical" onClick={(e) => { e.stopPropagation(); drillInContext(\'vertical\', parseVertical(o), e); }}>{parseVertical(o)}</span>'
    )
]

for old_str, new_str in replaces:
    if old_str in text:
        text = text.replace(old_str, new_str)
        print("Replaced:", old_str)
    else:
        print("NOT FOUND:", old_str)

with open(filename, "w", encoding="utf-8") as f:
    f.write(text)

print("Done tags fix.")
