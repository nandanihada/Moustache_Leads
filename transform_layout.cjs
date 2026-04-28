const fs = require('fs');
let c = fs.readFileSync('src/pages/offer-requests/PublisherRow.tsx', 'utf-8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';
const S = n => ' '.repeat(n);

// Find the section to replace: from the select mode toggle area through the bulk actions
// We need to find the "Single view dropdown mode" comment and replace everything from there
// through the end of the selected offer detail section

// Strategy: Find the <select> element and the entire selected offer card section,
// replace with expandable card layout

// Find markers
const dropdownStart = c.indexOf('/* \u2500\u2500 Single view dropdown mode');
if (dropdownStart === -1) {
  // Try alternate marker
  const altMarker = c.indexOf('Single view dropdown mode');
  if (altMarker === -1) {
    console.log('ERROR: Cannot find dropdown section marker');
    // Try finding the <select> tag
    const selectTag = c.indexOf('<select');
    if (selectTag === -1) { console.log('No <select> found either'); process.exit(1); }
    console.log('Found <select> at index', selectTag);
  }
}

// Better approach: find the exact boundaries
// The section starts after the "Select Multiple" button's closing )}
// and ends before "Bulk actions for all pending requests"

const bulkActionsComment = c.indexOf('{/* Bulk actions for all pending requests */}');
if (bulkActionsComment === -1) { console.log('ERROR: bulk actions comment not found'); process.exit(1); }

// Find the select element
const selectStart = c.indexOf('<select');
if (selectStart === -1) { console.log('ERROR: <select> not found'); process.exit(1); }

// Find the )} that closes the ternary before the select (the selectMode check)
// Go backwards from <select to find the ') : (' or similar
const beforeSelect = c.lastIndexOf(') : (', selectStart);

// Find the "Selected offer detail card" comment and everything after it until bulk actions
const selectedOfferComment = c.indexOf('{/* Selected offer detail card */}');

// We need to replace from the ') : (' through to just before the bulk actions comment
// But we need to keep the selectMode === true branch (the multi-select UI)

// Actually, let's take a different approach:
// Replace from the select dropdown through the end of the selected offer section
// The select dropdown starts at line ~377 and the selected offer section ends at line ~527

// Find the line with "Select an offer to view details"
const selectOptionLine = c.indexOf('Select an offer to view details');
// Go back to find the start of the <select> element
const selectElStart = c.lastIndexOf('<select', selectOptionLine);
// Find the closing </select> + the )} after it
const selectElEnd = c.indexOf('</select>', selectElStart);
const afterSelect = c.indexOf(')}', selectElEnd);

// Now find the end of the entire selected offer section
// It ends with </div> ))} </div> ))} before the bulk actions
// Let's find the line just before bulk actions comment
const beforeBulk = c.lastIndexOf(NL, bulkActionsComment);

// The replacement section: from the ternary ') : (' to just before bulk actions
// But we need to be more precise. Let me find the exact boundaries.

// Find ") : (" before the <select>
const ternaryElse = c.lastIndexOf(') : (', selectElStart);

// Find the matching closing for the ternary - it's the ")" + NL before bulk actions
// Actually the structure is:
// {selectMode ? ( ...multi-select UI... ) : ( <select>...</select> )}
// {/* Selected offer detail card */}
// {selectedReqOffer && (() => { ... })()}
// </div>  <-- closes the pending requests section
// {/* Bulk actions */}

// Let me just replace from ternaryElse to just before bulk actions
// keeping the structure intact

const replaceStart = ternaryElse;
const replaceEnd = bulkActionsComment;

console.log('Replace from index', replaceStart, 'to', replaceEnd);
console.log('Section length:', replaceEnd - replaceStart);

// Build the new expandable cards section
const lines = [];
lines.push(') : (');
lines.push(S(20) + '/* Offer cards - always visible, click arrow to expand */');
lines.push(S(20) + '<div className="space-y-2">');
lines.push(S(22) + '{pendingReqs.map(req => {');
lines.push(S(24) + 'const isCardExpanded = expandedOfferId === req.offer_id;');
lines.push(S(24) + 'return (');
lines.push(S(24) + '<div key={req.request_id} className={`rounded-lg border transition-all ${isCardExpanded ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm" : "border-gray-200 dark:border-gray-700 hover:border-blue-200"}`}>');

// Card header - clickable to expand
lines.push(S(26) + '<div className={`p-3 ${!selectMode ? "cursor-pointer" : ""}`} onClick={() => { if (!selectMode) toggleExpandOffer(req.offer_id, req.offer_name); }}>');
lines.push(S(28) + '<div className="flex items-start gap-2">');
lines.push(S(30) + '<div className="flex-1 min-w-0">');
lines.push(S(32) + '<div className="flex items-center gap-2 flex-wrap">');
lines.push(S(34) + '<p className="font-semibold text-sm truncate">{req.offer_name}</p>');
lines.push(S(34) + '{req.offer_status === "active" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">Active</Badge>}');
lines.push(S(34) + '{req.offer_status === "inactive" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200">Inactive</Badge>}');
lines.push(S(34) + '{req.offer_health?.status === "unhealthy" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{req.offer_health.failures.length} issues</Badge>}');
lines.push(S(34) + '{req.offer_health?.status === "healthy" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}');
lines.push(S(32) + '</div>');
lines.push(S(32) + '<div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">');
lines.push(S(34) + '<span>{req.offer_network}</span><span>\u00b7</span>');
lines.push(S(34) + '<span className="font-semibold text-foreground">${req.offer_payout.toFixed(2)}</span>');
lines.push(S(34) + '{req.offer_countries && req.offer_countries.length > 0 && (<><span>\u00b7</span><span>{req.offer_countries.slice(0, 5).join(", ")}</span></>)}');
lines.push(S(34) + '{req.requested_at && (<><span>\u00b7</span><span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(req.requested_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })} IST</span></>)}');
lines.push(S(32) + '</div>');
// Stats row
lines.push(S(32) + '{req.offer_stats && (');
lines.push(S(34) + '<div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">');
lines.push(S(36) + '<span className="flex items-center gap-0.5"><MousePointerClick className="w-3 h-3 text-blue-500" />{(req.offer_stats.total_clicks || 0).toLocaleString()} clicks</span>');
lines.push(S(36) + '<span className="flex items-center gap-0.5 text-emerald-600"><CheckCircle className="w-3 h-3" />{req.offer_stats.approved_count || 0} approved</span>');
lines.push(S(36) + '<span className="flex items-center gap-0.5 text-red-500"><XCircle className="w-3 h-3" />{req.offer_stats.rejected_count || 0} rejected</span>');
lines.push(S(36) + '<span className="flex items-center gap-0.5 text-amber-500"><AlertTriangle className="w-3 h-3" />{req.offer_stats.pending_count || 0} pending</span>');
lines.push(S(34) + '</div>');
lines.push(S(32) + ')}');
// Health failure badges
lines.push(S(32) + '{req.offer_health?.failures && req.offer_health.failures.length > 0 && (');
lines.push(S(34) + '<div className="flex flex-wrap gap-1 mt-1">');
lines.push(S(36) + '{req.offer_health.failures.map(f => (');
lines.push(S(38) + '<span key={f.criterion} className="inline-flex items-center gap-0.5 text-[9px] text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">');
lines.push(S(40) + '<span className="w-1.5 h-1.5 rounded-full bg-red-400" />{f.criterion.replace(/_/g, " ")}');
lines.push(S(38) + '</span>');
lines.push(S(36) + '))}');
lines.push(S(34) + '</div>');
lines.push(S(32) + ')}');
lines.push(S(30) + '</div>');
// Right side: payout + arrow
lines.push(S(30) + '<div className="flex items-center gap-1 shrink-0">');
lines.push(S(32) + '<p className="text-lg font-bold">${req.offer_payout.toFixed(2)}</p>');
lines.push(S(32) + '{!selectMode && <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCardExpanded ? "rotate-180" : ""}`} />}');
lines.push(S(30) + '</div>');
lines.push(S(28) + '</div>');
lines.push(S(26) + '</div>');

// Action buttons row - always visible
lines.push(S(26) + '<div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => navigator.clipboard.writeText(req.offer_name).then(() => toast.success("Copied"))}>Copy name</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600 border-blue-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: req.offer_id, request_id: req.request_id, collection_type: "direct_partner" }) }); toast.success("Added to DP"); } catch { toast.error("Failed"); } }}>DP</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-violet-600 border-violet-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: req.offer_id, request_id: req.request_id, collection_type: "affiliate" }) }); toast.success("Added to AF"); } catch { toast.error("Failed"); } }}>AF</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600" onClick={() => handleEditOffer(req.offer_id)} disabled={loadingEdit === req.offer_id}>{loadingEdit === req.offer_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit className="w-3 h-3" />}Edit</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-amber-600 border-amber-300" onClick={() => markForReview(req.request_id)}><AlertTriangle className="w-3 h-3" />Review</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-destructive border-red-200" onClick={() => rejectReq(req.request_id)} disabled={rejecting === req.request_id}>{rejecting === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}Reject</Button>');
lines.push(S(28) + '<Button size="sm" className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveReq(req.request_id)} disabled={approving === req.request_id}>{approving === req.request_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Approve</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-blue-600" onClick={() => onSendOffers(pub, [{_id: "", offer_id: req.offer_id, name: req.offer_name, network: req.offer_network, payout: req.offer_payout, match_strength: ""}])}><Send className="w-3 h-3" />Suggest</Button>');
lines.push(S(28) + '<Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-purple-600 border-purple-200" onClick={() => openProofRequest(req.offer_id, req.offer_name)}><Camera className="w-3 h-3" />Request Proof</Button>');
lines.push(S(26) + '</div>');
// Expanded section: Related offers (shown when arrow clicked)
lines.push(S(26) + '<AnimatePresence>');
lines.push(S(28) + '{isCardExpanded && !selectMode && (');
lines.push(S(30) + '<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">');
lines.push(S(32) + '<div className="border-t mx-3 pt-2 pb-3 space-y-2">');
lines.push(S(34) + '{loadingInv ? (');
lines.push(S(36) + '<div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Loading related offers...</div>');
lines.push(S(34) + ') : inventory.filter(inv => inv.offer_id !== req.offer_id).length > 0 ? (');
lines.push(S(36) + '<div className="space-y-1.5">');
// Header with Select All
lines.push(S(38) + '<div className="flex items-center justify-between flex-wrap gap-1">');
lines.push(S(40) + '<div className="flex items-center gap-2">');
lines.push(S(42) + '<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Related Offers</p>');
lines.push(S(42) + '<Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => { const ids = inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => inv.offer_id); setSelectedRelated(prev => prev.size === ids.length ? new Set() : new Set(ids)); }}>{selectedRelated.size === inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).length ? "Deselect All" : "Select All"}</Button>');
lines.push(S(40) + '</div>');
// Bulk bar when items selected
lines.push(S(40) + '{selectedRelated.size > 0 && (');
lines.push(S(42) + '<div className="flex items-center gap-1 flex-wrap">');
lines.push(S(44) + '<Badge variant="secondary" className="text-[9px] px-1.5 py-0">{selectedRelated.size} selected</Badge>');
lines.push(S(44) + '<Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean); if (!ids.length) { toast.info("No matching requests"); return; } try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-approve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids }) }); toast.success("Approved " + ids.length); onRefreshList(); } catch { toast.error("Failed"); } }}><CheckCircle className="w-2.5 h-2.5" />Approve</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-red-600 border-red-200" onClick={async () => { const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean); if (!ids.length) { toast.info("No matching requests"); return; } try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-reject`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids, reason: "Bulk rejected" }) }); toast.success("Rejected " + ids.length); onRefreshList(); } catch { toast.error("Failed"); } }}><XCircle className="w-2.5 h-2.5" />Reject</Button>');
lines.push(S(44) + '<Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Send className="w-2.5 h-2.5" />Mail {selectedRelated.size}</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Package className="w-2.5 h-2.5" />Schedule</Button>');
lines.push(S(42) + '</div>');
lines.push(S(40) + ')}');
lines.push(S(38) + '</div>');
// Individual related offer items with full buttons
lines.push(S(38) + '{inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => (');
lines.push(S(40) + '<div key={inv.offer_id} className={`rounded-lg border px-3 py-2 text-xs space-y-1.5 ${selectedRelated.has(inv.offer_id) ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-gray-50 dark:bg-gray-900/30"}`}>');
lines.push(S(42) + '<div className="flex items-center gap-2">');
lines.push(S(44) + '<input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer shrink-0" checked={selectedRelated.has(inv.offer_id)} onChange={() => setSelectedRelated(prev => { const n = new Set(prev); n.has(inv.offer_id) ? n.delete(inv.offer_id) : n.add(inv.offer_id); return n; })} />');
lines.push(S(44) + '<div className="flex-1 min-w-0">');
lines.push(S(46) + '<div className="flex items-center gap-1.5 flex-wrap">');
lines.push(S(48) + '<p className="font-medium text-foreground/80 truncate">{inv.name}</p>');
lines.push(S(48) + '{inv.already_sent && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">Sent</Badge>}');
lines.push(S(48) + '{inv.visibility === "active" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 shrink-0">Active</Badge>}');
lines.push(S(48) + '{inv.visibility === "inactive" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-gray-50 text-gray-600 border-gray-200 shrink-0">Inactive</Badge>}');
lines.push(S(48) + '{inv.health?.status === "unhealthy" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200 shrink-0"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{inv.health.failures.length} issues</Badge>}');
lines.push(S(48) + '{inv.health?.status === "healthy" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}');
lines.push(S(46) + '</div>');
lines.push(S(46) + '<p className="text-[10px] text-muted-foreground">${inv.payout.toFixed(2)} \u00b7 {inv.network || inv.match_strength}</p>');
lines.push(S(44) + '</div>');
lines.push(S(44) + '{inv.request_status && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{inv.request_status}</Badge>}');
lines.push(S(44) + '<span className="text-sm font-bold shrink-0">${inv.payout.toFixed(2)}</span>');
lines.push(S(42) + '</div>');
// Full action buttons for each related offer
lines.push(S(42) + '<div className="flex items-center gap-1 flex-wrap">');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5" onClick={() => navigator.clipboard.writeText(inv.name).then(() => toast.success("Copied"))}>Copy name</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5" onClick={() => { if (inv.target_url) window.open(inv.target_url, "_blank"); else toast.info("No target URL"); }}>Open</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600 border-blue-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: "direct_partner" }) }); toast.success("Added to DP"); } catch { toast.error("Failed"); } }}>DP</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-violet-600 border-violet-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: "affiliate" }) }); toast.success("Added to AF"); } catch { toast.error("Failed"); } }}>AF</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => handleEditOffer(inv.offer_id)} disabled={loadingEdit === inv.offer_id}>{loadingEdit === inv.offer_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Edit className="w-2.5 h-2.5" />}Edit</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => onSendOffers(pub, [inv])}><Send className="w-2.5 h-2.5" />Suggest</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-amber-600 border-amber-300" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) markForReview(rq.request_id); else toast.info("No pending request"); }}><AlertTriangle className="w-2.5 h-2.5" />Review</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-destructive border-red-200" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) rejectReq(rq.request_id); else toast.info("No pending request"); }}><XCircle className="w-2.5 h-2.5" />Reject</Button>');
lines.push(S(44) + '<Button size="sm" className="h-6 px-1.5 text-[9px] gap-0.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { const rq = pub.requests.find(r => r.offer_id === inv.offer_id); if (rq) approveReq(rq.request_id); else toast.info("No pending request"); }}><CheckCircle className="w-2.5 h-2.5" />Approve</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, [inv])}><Calendar className="w-2.5 h-2.5" />Schedule</Button>');
lines.push(S(44) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-purple-600 border-purple-200" onClick={() => openProofRequest(inv.offer_id, inv.name)}><Camera className="w-2.5 h-2.5" />Request Proof</Button>');
lines.push(S(42) + '</div>');
// Health failures for related offer
lines.push(S(42) + '{inv.health?.failures && inv.health.failures.length > 0 && (');
lines.push(S(44) + '<div className="flex flex-wrap gap-1">');
lines.push(S(46) + '{inv.health.failures.map(f => (');
lines.push(S(48) + '<span key={f.criterion} className="inline-flex items-center gap-0.5 text-[9px] text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">');
lines.push(S(50) + '<span className="w-1 h-1 rounded-full bg-red-400" />{f.criterion.replace(/_/g, " ")}{f.detail ? `: ${f.detail}` : ""}');
lines.push(S(48) + '</span>');
lines.push(S(46) + '))}');
lines.push(S(44) + '</div>');
lines.push(S(42) + ')}');
lines.push(S(40) + '</div>');
lines.push(S(38) + '))}');
lines.push(S(36) + '</div>');
lines.push(S(34) + ') : (');
lines.push(S(36) + '<p className="text-xs text-muted-foreground py-2">No related offers found</p>');
lines.push(S(34) + ')}');
lines.push(S(32) + '</div>');
lines.push(S(30) + '</motion.div>');
lines.push(S(28) + ')}');
lines.push(S(26) + '</AnimatePresence>');
// Close card
lines.push(S(24) + '</div>');
lines.push(S(24) + ')');
lines.push(S(22) + '})}');
lines.push(S(20) + '</div>');
lines.push(S(18) + ')}');
lines.push(S(18) + '</div>');
lines.push(S(18));

const newSection = lines.join(NL);

// Now do the replacement
// We need to also add toggleExpandOffer function if not present
if (!c.includes('toggleExpandOffer')) {
  const openProofMarker = '  const openProofRequest = (offerId: string, offerName: string) => {';
  const toggleFn = `  const toggleExpandOffer = (offerId: string, offerName: string) => {${NL}    if (expandedOfferId === offerId) {${NL}      setExpandedOfferId(null);${NL}      setSelectedRelated(new Set());${NL}    } else {${NL}      setExpandedOfferId(offerId);${NL}      setSelectedRelated(new Set());${NL}      setLoadingInv(true);${NL}      fetch(\`\${API_BASE_URL}/api/admin/offer-access-requests/inventory-matches?offer_name=\${encodeURIComponent(offerName)}&user_id=\${pub.user_id}&limit=12\`, {${NL}        headers: { Authorization: \`Bearer \${token}\` },${NL}      }).then(r => { if (!r.ok) throw new Error(); return r.json(); })${NL}        .then(d => setInventory(d.matches || []))${NL}        .catch(() => {})${NL}        .finally(() => setLoadingInv(false));${NL}    }${NL}  };${NL}${NL}`;
  c = c.replace(openProofMarker, toggleFn + openProofMarker);
  console.log('Added toggleExpandOffer function');
}

// Also need expandedOfferId state if not present
if (!c.includes('expandedOfferId')) {
  const afterSelectedRelated = 'const [selectedRelated, setSelectedRelated] = useState<Set<string>>(new Set());';
  c = c.replace(afterSelectedRelated, afterSelectedRelated + NL + '  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);');
  console.log('Added expandedOfferId state');
}

// Also need pendingReqs variable
if (!c.includes('const pendingReqs')) {
  const riskLine = '  const risk = rsk(pub.risk_level);';
  c = c.replace(riskLine, riskLine + NL + '  const pendingReqs = pub.requests.filter(r => r.status === "pending" || r.status === "review");');
  console.log('Added pendingReqs variable');
}

// Do the main replacement
c = c.substring(0, replaceStart) + newSection + c.substring(replaceEnd);

fs.writeFileSync('src/pages/offer-requests/PublisherRow.tsx', c, 'utf-8');

// Verify
const v = fs.readFileSync('src/pages/offer-requests/PublisherRow.tsx', 'utf-8');
console.log('Has toggleExpandOffer:', v.includes('toggleExpandOffer'));
console.log('Has expandedOfferId:', v.includes('expandedOfferId'));
console.log('Has Related Offers:', v.includes('Related Offers'));
console.log('Has Schedule:', v.includes('Schedule</Button>'));
console.log('Has Request Proof:', (v.match(/Request Proof<\/Button>/g) || []).length, 'occurrences');
console.log('Has NO dropdown:', !v.includes('<select'));
console.log('Lines:', v.split(/\r?\n/).length);
console.log('DONE!');
