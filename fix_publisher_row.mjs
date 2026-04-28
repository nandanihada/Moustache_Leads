import { readFileSync, writeFileSync } from 'fs';
const S = n => ' '.repeat(n);
const filepath = 'src/pages/offer-requests/PublisherRow.tsx';
let c = readFileSync(filepath, 'utf-8');
const hadCRLF = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

// Pattern to find: Request Proof button + closing divs
const old = 'Request Proof</Button>\n' + S(24) + '</div>\n' + S(22) + '</div>\n' + S(20) + '))}\n' + S(18) + '</div>';

if (!c.includes(old)) { console.log('ERROR: pattern not found'); process.exit(1); }
if (c.includes('Related Offers')) { console.log('Already has Related Offers'); process.exit(0); }

// Build replacement
const lines = [];
lines.push('Request Proof</Button>');
// Related Offers toggle button
lines.push(S(30) + "<Button size='sm' variant={expandedOfferId === req.offer_id ? 'default' : 'outline'} className={`h-7 px-2 text-[10px] gap-1 ${expandedOfferId === req.offer_id ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-300'}`} onClick={() => toggleExpandOffer(req.offer_id, req.offer_name)}><ChevronDown className={`w-3 h-3 transition-transform ${expandedOfferId === req.offer_id ? 'rotate-180' : ''}`} />{expandedOfferId === req.offer_id ? 'Hide Related' : 'Related Offers'}</Button>");
lines.push(S(24) + '</div>');
lines.push('');
lines.push(S(24) + '{/* Expanded: Related offers */}');
lines.push(S(24) + '<AnimatePresence>');
lines.push(S(26) + '{expandedOfferId === req.offer_id && !selectMode && (');
lines.push(S(28) + '<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">');
lines.push(S(30) + '<div className="border-t mx-3 pt-2 pb-3 space-y-2">');
lines.push(S(32) + '{loadingInv ? (');
lines.push(S(34) + '<div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Loading related offers...</div>');
lines.push(S(32) + ') : inventory.filter(inv => inv.offer_id !== req.offer_id).length > 0 ? (');
lines.push(S(34) + '<div className="space-y-1.5">');
// Header with Select All
lines.push(S(36) + '<div className="flex items-center justify-between flex-wrap gap-1">');
lines.push(S(38) + '<div className="flex items-center gap-2">');
lines.push(S(40) + '<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Related Offers</p>');
lines.push(S(40) + '<Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => {');
lines.push(S(42) + 'const ids = inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => inv.offer_id);');
lines.push(S(42) + 'setSelectedRelated(prev => prev.size === ids.length ? new Set() : new Set(ids));');
lines.push(S(40) + '}}>{selectedRelated.size === inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).length ? "Deselect All" : "Select All"}</Button>');
lines.push(S(38) + '</div>');
// Bulk action bar
lines.push(S(38) + '{selectedRelated.size > 0 && (');
lines.push(S(40) + '<div className="flex items-center gap-1 flex-wrap">');
lines.push(S(42) + '<Badge variant="secondary" className="text-[9px] px-1.5 py-0">{selectedRelated.size} selected</Badge>');
// Bulk approve button
lines.push(S(42) + '<Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {');
lines.push(S(44) + 'const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean);');
lines.push(S(44) + 'if (!ids.length) { toast.info("No matching requests"); return; }');
lines.push(S(44) + 'try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-approve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids }) }); toast.success("Approved " + ids.length); onRefreshList(); } catch { toast.error("Failed"); }');
lines.push(S(42) + '}}><CheckCircle className="w-2.5 h-2.5" />Approve</Button>');
// Bulk reject button
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-red-600 border-red-200" onClick={async () => {');
lines.push(S(44) + 'const ids = inventory.filter(inv => selectedRelated.has(inv.offer_id)).map(inv => { const r2 = pub.requests.find(r => r.offer_id === inv.offer_id); return r2?.request_id; }).filter(Boolean);');
lines.push(S(44) + 'if (!ids.length) { toast.info("No matching requests"); return; }');
lines.push(S(44) + 'try { await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/bulk-reject`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_ids: ids, reason: "Bulk rejected" }) }); toast.success("Rejected " + ids.length); onRefreshList(); } catch { toast.error("Failed"); }');
lines.push(S(42) + '}}><XCircle className="w-2.5 h-2.5" />Reject</Button>');
// Mail + Schedule bulk
lines.push(S(42) + '<Button size="sm" className="h-6 px-2 text-[9px] gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Send className="w-2.5 h-2.5" />Mail {selectedRelated.size}</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-2 text-[9px] gap-1 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, inventory.filter(inv => selectedRelated.has(inv.offer_id)))}><Package className="w-2.5 h-2.5" />Schedule</Button>');
lines.push(S(40) + '</div>');
lines.push(S(38) + ')}');
lines.push(S(36) + '</div>');
// Individual related offer items
lines.push(S(36) + '{inventory.filter(inv => inv.offer_id !== req.offer_id).slice(0, 8).map(inv => {');
lines.push(S(38) + 'const invReq = pub.requests.find(r => r.offer_id === inv.offer_id);');
lines.push(S(38) + 'return (');
lines.push(S(38) + '<div key={inv.offer_id} className={`rounded-lg border px-3 py-2 text-xs space-y-1.5 ${selectedRelated.has(inv.offer_id) ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-gray-50 dark:bg-gray-900/30"}`}>');
lines.push(S(40) + '<div className="flex items-center gap-2">');
lines.push(S(42) + '<input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer shrink-0" checked={selectedRelated.has(inv.offer_id)} onChange={() => setSelectedRelated(prev => { const n = new Set(prev); n.has(inv.offer_id) ? n.delete(inv.offer_id) : n.add(inv.offer_id); return n; })} />');
lines.push(S(42) + '<div className="flex-1 min-w-0">');
lines.push(S(44) + '<div className="flex items-center gap-1.5 flex-wrap">');
lines.push(S(46) + '<p className="font-medium text-foreground/80 truncate">{inv.name}</p>');
lines.push(S(46) + '{inv.already_sent && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">Sent</Badge>}');
lines.push(S(46) + '{inv.visibility === "active" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 shrink-0">Active</Badge>}');
lines.push(S(46) + '{inv.visibility === "inactive" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-gray-50 text-gray-600 border-gray-200 shrink-0">Inactive</Badge>}');
lines.push(S(46) + '{inv.health?.status === "unhealthy" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200 shrink-0"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{inv.health.failures.length} issues</Badge>}');
lines.push(S(46) + '{inv.health?.status === "healthy" && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}');
lines.push(S(44) + '</div>');
lines.push(S(44) + '<p className="text-[10px] text-muted-foreground">${inv.payout.toFixed(2)} - {inv.network || inv.match_strength}</p>');
lines.push(S(42) + '</div>');
lines.push(S(42) + '{inv.request_status && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{inv.request_status}</Badge>}');
lines.push(S(42) + '<span className="text-sm font-bold shrink-0">${inv.payout.toFixed(2)}</span>');
lines.push(S(40) + '</div>');
// Action buttons for each related offer
lines.push(S(40) + '<div className="flex items-center gap-1 flex-wrap">');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5" onClick={() => navigator.clipboard.writeText(inv.name).then(() => toast.success("Copied"))}>Copy name</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600 border-blue-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: "direct_partner" }) }); toast.success("Added to DP"); } catch { toast.error("Failed"); } }}>DP</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-violet-600 border-violet-200" onClick={async () => { try { await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offer_id: inv.offer_id, collection_type: "affiliate" }) }); toast.success("Added to AF"); } catch { toast.error("Failed"); } }}>AF</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => handleEditOffer(inv.offer_id)} disabled={loadingEdit === inv.offer_id}>{loadingEdit === inv.offer_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Edit className="w-2.5 h-2.5" />}Edit</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-amber-600 border-amber-300" onClick={() => { if (invReq) markForReview(invReq.request_id); else toast.info("No pending request"); }}><AlertTriangle className="w-2.5 h-2.5" />Review</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-destructive border-red-200" onClick={() => { if (invReq) rejectReq(invReq.request_id); else toast.info("No pending request"); }} disabled={!invReq || rejecting === invReq?.request_id}>{rejecting === invReq?.request_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <XCircle className="w-2.5 h-2.5" />}Reject</Button>');
lines.push(S(42) + '<Button size="sm" className="h-6 px-1.5 text-[9px] gap-0.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { if (invReq) approveReq(invReq.request_id); else toast.info("No pending request"); }} disabled={!invReq || approving === invReq?.request_id}>{approving === invReq?.request_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle className="w-2.5 h-2.5" />}Approve</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-blue-600" onClick={() => onSendOffers(pub, [inv])}><Send className="w-2.5 h-2.5" />Suggest</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-indigo-600 border-indigo-200" onClick={() => onSendOffers(pub, [inv])}><Calendar className="w-2.5 h-2.5" />Schedule</Button>');
lines.push(S(42) + '<Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px] gap-0.5 text-purple-600 border-purple-200" onClick={() => openProofRequest(inv.offer_id, inv.name)}><Camera className="w-2.5 h-2.5" />Request Proof</Button>');
lines.push(S(40) + '</div>');
// Close related offer item
lines.push(S(38) + '</div>');
lines.push(S(38) + ');');
lines.push(S(36) + '})}');
lines.push(S(34) + '</div>');
lines.push(S(32) + ') : (');
lines.push(S(34) + '<p className="text-xs text-muted-foreground py-2">No related offers found</p>');
lines.push(S(32) + ')}');
lines.push(S(30) + '</div>');
lines.push(S(28) + '</motion.div>');
lines.push(S(26) + ')}');
lines.push(S(24) + '</AnimatePresence>');
// Close the card wrapper and map
lines.push(S(22) + '</div>');
lines.push(S(20) + ');');
lines.push(S(18) + '})}');
lines.push(S(18) + '</div>');

const replacement = lines.join('\n');
c = c.replace(old, replacement);

// Restore CRLF if needed
if (hadCRLF) c = c.replace(/\n/g, '\r\n');

writeFileSync(filepath, c, 'utf-8');

// Verify
const v = readFileSync(filepath, 'utf-8');
console.log('Has Related Offers:', v.includes('Related Offers'));
console.log('Has toggleExpandOffer:', v.includes('toggleExpandOffer'));
console.log('Lines:', v.split(/\r?\n/).length);
