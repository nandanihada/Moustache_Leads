import sys
import re

filename = r"c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\components\AdminOffersDrilldownView.tsx"

with open(filename, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Network group tags
old_net_tags = """<div className="group-tags">{n.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => { e.stopPropagation(); drillInContext('vertical', v, e); }}>{v}</span>)}</div>
                      <div className="group-tags" style={{marginTop: '4px'}}>{n.geos.slice(0,5).map(g => <span key={g} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext('country', g, e); }}>{g}</span>)}</div>"""
new_net_tags = """<div className="group-tags">{n.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => drillFromCard('network', n.id, 'vertical', v, e)}>{v}</span>)}</div>
                      <div className="group-tags" style={{marginTop: '4px'}}>{n.geos.slice(0,5).map(g => <span key={g} className="tag geo" onClick={(e) => drillFromCard('network', n.id, 'country', g, e)}>{g}</span>)}</div>"""
text = text.replace(old_net_tags, new_net_tags)

# 2. Network status dots
old_net_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                        {n.active > 0 && <span className="status-dot"><span className="dot active"></span>{n.active} active</span>}
                        {n.inactive > 0 && <span className="status-dot"><span className="dot inactive"></span>{n.inactive} inactive</span>}
                        {n.paused > 0 && <span className="status-dot"><span className="dot paused"></span>{n.paused} paused</span>}
                        {n.hidden > 0 && <span className="status-dot"><span className="dot hidden"></span>{n.hidden} hidden</span>}
                      </div>"""
new_net_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                        {n.active > 0 && <span className="status-dot" onClick={(e) => drillFromCard('network', n.id, 'status', 'active', e)}><span className="dot active"></span>{n.active} active</span>}
                        {n.inactive > 0 && <span className="status-dot" onClick={(e) => drillFromCard('network', n.id, 'status', 'inactive', e)}><span className="dot inactive"></span>{n.inactive} inactive</span>}
                        {n.paused > 0 && <span className="status-dot" onClick={(e) => drillFromCard('network', n.id, 'status', 'paused', e)}><span className="dot paused"></span>{n.paused} paused</span>}
                        {n.hidden > 0 && <span className="status-dot" onClick={(e) => drillFromCard('network', n.id, 'status', 'hidden', e)}><span className="dot hidden"></span>{n.hidden} hidden</span>}
                      </div>"""
text = text.replace(old_net_status, new_net_status)

# 3. Vertical tags
old_vert_tags = """<div className="group-tags">{v.networks.slice(0,6).map(n => <span key={n} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext('network', n, e); }}>{n}</span>)}</div>
                          <div className="group-tags" style={{marginTop: '4px'}}>{v.geos.slice(0,6).map(g => <span key={g} className="tag geo" onClick={(e) => { e.stopPropagation(); drillInContext('country', g, e); }}>{g}</span>)}</div>"""
new_vert_tags = """<div className="group-tags">{v.networks.slice(0,6).map(n => <span key={n} className="tag geo" onClick={(e) => drillFromCard('vertical', v.id, 'network', n, e)}>{n}</span>)}</div>
                          <div className="group-tags" style={{marginTop: '4px'}}>{v.geos.slice(0,6).map(g => <span key={g} className="tag geo" onClick={(e) => drillFromCard('vertical', v.id, 'country', g, e)}>{g}</span>)}</div>"""
text = text.replace(old_vert_tags, new_vert_tags)

# 4. Vertical status dots
old_vert_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                            {v.active > 0 && <span className="status-dot"><span className="dot active"></span>{v.active} active</span>}
                            {v.inactive > 0 && <span className="status-dot"><span className="dot inactive"></span>{v.inactive} inactive</span>}
                            {v.paused > 0 && <span className="status-dot"><span className="dot paused"></span>{v.paused} paused</span>}
                            {v.hidden > 0 && <span className="status-dot"><span className="dot hidden"></span>{v.hidden} hidden</span>}
                          </div>"""
new_vert_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                            {v.active > 0 && <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'active', e)}><span className="dot active"></span>{v.active} active</span>}
                            {v.inactive > 0 && <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'inactive', e)}><span className="dot inactive"></span>{v.inactive} inactive</span>}
                            {v.paused > 0 && <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'paused', e)}><span className="dot paused"></span>{v.paused} paused</span>}
                            {v.hidden > 0 && <span className="status-dot" onClick={(e) => drillFromCard('vertical', v.id, 'status', 'hidden', e)}><span className="dot hidden"></span>{v.hidden} hidden</span>}
                          </div>"""
text = text.replace(old_vert_status, new_vert_status)

# 5. Country tags
old_c_tags = """<div className="group-tags">{c.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => { e.stopPropagation(); drillInContext('vertical', v, e); }}>{v}</span>)}</div>"""
new_c_tags = """<div className="group-tags">{c.verticals.slice(0,4).map(v => <span key={v} className="tag vertical" onClick={(e) => drillFromCard('country', c.id, 'vertical', v, e)}>{v}</span>)}</div>"""
text = text.replace(old_c_tags, new_c_tags)

# 6. Country status dots
old_c_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                        {c.active > 0 && <span className="status-dot"><span className="dot active"></span>{c.active}</span>}
                        {c.inactive > 0 && <span className="status-dot"><span className="dot inactive"></span>{c.inactive}</span>}
                        {c.paused > 0 && <span className="status-dot"><span className="dot paused"></span>{c.paused}</span>}
                        {c.hidden > 0 && <span className="status-dot"><span className="dot hidden"></span>{c.hidden}</span>}
                     </div>"""
new_c_status = """<div className="group-status-row" style={{marginTop: '10px'}}>
                        {c.active > 0 && <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'active', e)}><span className="dot active"></span>{c.active}</span>}
                        {c.inactive > 0 && <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'inactive', e)}><span className="dot inactive"></span>{c.inactive}</span>}
                        {c.paused > 0 && <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'paused', e)}><span className="dot paused"></span>{c.paused}</span>}
                        {c.hidden > 0 && <span className="status-dot" onClick={(e) => drillFromCard('country', c.id, 'status', 'hidden', e)}><span className="dot hidden"></span>{c.hidden}</span>}
                     </div>"""
text = text.replace(old_c_status, new_c_status)

with open(filename, "w", encoding="utf-8") as f:
    f.write(text)

print("Drill cards updated")
