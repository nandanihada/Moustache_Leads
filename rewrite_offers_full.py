import sys
import re
import shutil

# Reset AdminOffersV2.tsx to be identical to AdminOffers.tsx
source_path = r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffers.tsx'
target_path = r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx'

shutil.copyfile(source_path, target_path)

with open(target_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

css_imports = """import '@/styles/admin-offers-v2.css';
import { RunningOffersGeoChart } from '@/components/RunningOffersGeoChart';
import {
  Dialog as GenericDialog,
  DialogContent as GenericDialogContent,
  DialogHeader as GenericDialogHeader,
  DialogTitle as GenericDialogTitle,
  DialogFooter as GenericDialogFooter,
} from '@/components/ui/dialog';
"""

# Insert imports at top
lines.insert(0, css_imports)

# Find return ( at top level
return_idx = -1
for i, line in enumerate(lines):
    if line.startswith('  return ('):
        return_idx = i
        break

hooks_injection = """
  // --- CUSTOM INJECTED LOGIC FOR NEW UI ---
  const [pinnedOffers, setPinnedOffers] = useState<Set<string>>(new Set());
  const [offerListSection, setOfferListSection] = useState<'all'|'active'|'running'>('all');
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false);
  const [bulkPriceAction, setBulkPriceAction] = useState<'increase'|'decrease'>('increase');
  const [bulkPricePercent, setBulkPricePercent] = useState<number>(10);

  const togglePinOffer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(pinnedOffers);
    if(next.has(id)) next.delete(id);
    else next.add(id);
    setPinnedOffers(next);
  };

  const handleExecuteBulkPriceChange = async () => {
    if (selectedOffers.size === 0) return;
    try {
      // Basic sequential update for mockup realism since there is no bulk pricing endpoint.
      for (const id of selectedOffers) {
         const offer = offers.find(o => o.offer_id === id);
         if (!offer) continue;
         const current = offer.payout || 0;
         const updated = bulkPriceAction === 'increase' 
           ? current * (1 + bulkPricePercent / 100) 
           : current * (1 - bulkPricePercent / 100);
         await adminOfferApi.updateOffer(id, { payout: updated });
      }
      toast({ title: 'Success', description: `Price ${bulkPriceAction}d for ${selectedOffers.size} offers.` });
      setBulkPriceModalOpen(false);
      fetchOffers();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to bulk update pricing', variant: 'destructive' });
    }
  };

  const customDisplayOffers = useMemo(() => {
    let filtered = [...offers];
    if (offerListSection === 'active') {
       filtered = filtered.filter(o => o.status === 'active');
    } else if (offerListSection === 'running') {
       filtered = filtered.filter(o => o.status === 'active' && (o.hits || 0) > 0);
    }
    // Float pinned offers
    const pinned = filtered.filter(o => pinnedOffers.has(o.offer_id));
    const unpinned = filtered.filter(o => !pinnedOffers.has(o.offer_id));
    return [...pinned, ...unpinned];
  }, [offers, offerListSection, pinnedOffers]);
  // --- END OF CUSTOM LOGIC ---
"""

# Insert hooks directly before return (
lines.insert(return_idx, hooks_injection)

# Now we need to find the <TabsContent value="offers"> block to replace its inner content.
# Since we inserted lines, we must rebuild the string array or search newly.
new_content = "".join(lines)

start_tag = '<TabsContent value="offers"'
end_tag = '</TabsContent>'

start_content_idx = new_content.find(start_tag)
if start_content_idx != -1:
    # find the next </TabsContent>
    end_content_idx = new_content.find(end_tag, start_content_idx) + len(end_tag)

    custom_ui_jsx = """
          <TabsContent value="offers" className="space-y-4 m-0 p-0">
            {/* INJECTED NEW DESIGNS WITH ORIGINAL BEHAVIOR */}
            <GenericDialog open={bulkPriceModalOpen} onOpenChange={setBulkPriceModalOpen}>
              <GenericDialogContent>
                <GenericDialogHeader><GenericDialogTitle>Bulk Price Change</GenericDialogTitle></GenericDialogHeader>
                <div className="py-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <Select value={bulkPriceAction} onValueChange={(v:any) => setBulkPriceAction(v)}>
                       <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="increase">Increase By</SelectItem>
                         <SelectItem value="decrease">Decrease By</SelectItem>
                       </SelectContent>
                    </Select>
                    <Input type="number" value={bulkPricePercent} onChange={(e) => setBulkPricePercent(Number(e.target.value))} className="w-[100px]" />
                    <span>%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">This will apply to {selectedOffers.size} selected offers.</p>
                </div>
                <GenericDialogFooter>
                  <Button variant="outline" onClick={() => setBulkPriceModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleExecuteBulkPriceChange}>Apply Changes</Button>
                </GenericDialogFooter>
              </GenericDialogContent>
            </GenericDialog>

            <div className="shell">
              <div className="topbar">
                <h1 className="text-white text-2xl m-0 tracking-tight font-semibold">Offers Center</h1>
                <div className="search-bar relative">
                  <Input 
                    type="text" 
                    placeholder="Search by name, ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-[#1b1f27] border-0 text-white rounded-full pl-10 pr-4 h-10 min-w-[300px]"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <div className="actions flex gap-3 items-center">
                  <div className="flex items-center gap-2 bg-[#1b1f27] px-3 py-1.5 rounded-full">
                    <Switch
                      checked={rotationStatus?.enabled}
                      onCheckedChange={async (v) => {
                        try {
                          if (v) await adminOfferApi.enableRotation();
                          else await adminOfferApi.disableRotation();
                          fetchRotationStatus();
                        } catch (e) {}
                      }}
                    />
                    <Label className="text-sm text-gray-300">Rotation</Label>
                  </div>

                  {selectedOffers.size > 0 && (
                    <div className="flex items-center gap-2 border-r border-[#2d323e] pr-4 mr-1">
                        <span className="text-sm text-gray-400">{selectedOffers.size} selected</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9 bg-blue-600/10 text-blue-400 border-0 hover:bg-blue-600/20">
                              Bulk Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel>Pricing & Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setBulkPriceModalOpen(true)}>Change Payout (%)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusUpdate('active')}>Set Active</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusUpdate('inactive')}>Set Inactive</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500" onClick={handleBulkDelete}>Delete Selected</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="bg-[#1b1f27] border-0 text-white hover:bg-[#2d323e] h-10 w-10 p-0 rounded-full flex items-center justify-center">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Management</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setAddOfferModalOpen(true)}><Plus className="mr-2 h-4 w-4"/> Create Offer</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBulkUploadModalOpen(true)}><Upload className="mr-2 h-4 w-4"/> Bulk Upload</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setApiImportModalOpen(true)}><Download className="mr-2 h-4 w-4"/> API Import</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setExportModalOpen(true)}><Download className="mr-2 h-4 w-4"/> Export CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleClearAllOffers} className="text-red-500"><Trash2 className="mr-2 h-4 w-4"/> Clear All Offers</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {offerListSection === 'running' && (
                 <RunningOffersGeoChart offers={customDisplayOffers} />
              )}

              <div className="stats-strip mt-6 mb-6">
                <div className={`stat cursor-pointer transition-all ${offerListSection === 'all' ? 'border border-blue-500' : ''}`} onClick={() => setOfferListSection('all')}>
                  <div className="val">{adminStats?.total_offers || 0}</div>
                  <div className="lbl">All Offers</div>
                </div>
                <div className={`stat cursor-pointer transition-all ${offerListSection === 'active' ? 'border border-green-500' : ''}`} onClick={() => setOfferListSection('active')}>
                  <div className="val text-green-400">{adminStats?.active_offers || 0}</div>
                  <div className="lbl">Active Offers</div>
                </div>
                <div className={`stat cursor-pointer transition-all ${offerListSection === 'running' ? 'border border-blue-500' : ''}`} onClick={() => setOfferListSection('running')}>
                  <div className="val text-blue-400">{rotationStatus?.running_count || 0}</div>
                  <div className="lbl">Running Offers</div>
                </div>
              </div>

              <div className="filter-strip flex flex-wrap gap-2 mb-6 p-4 rounded-xl bg-[#13161c] border border-[#1b1f27]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-[#1b1f27] border-0 text-gray-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                  <SelectTrigger className="w-[140px] bg-[#1b1f27] border-0 text-gray-200">
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    {networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px] bg-[#1b1f27] border-0 text-gray-200">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="newest">Newest First</SelectItem>
                     <SelectItem value="oldest">Oldest First</SelectItem>
                     <SelectItem value="payout_high">Highest Payout</SelectItem>
                     <SelectItem value="payout_low">Lowest Payout</SelectItem>
                     <SelectItem value="title_az">Name (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="py-20 text-center text-gray-400 flex flex-col items-center"><Loader2 className="h-8 w-8 animate-spin mb-4" /> Loading offers...</div>
              ) : (
                <div className="grid">
                  {customDisplayOffers.map(offer => (
                    <div className={`card relative ${pinnedOffers.has(offer.offer_id) ? 'ring-1 ring-blue-500 bg-[#1b1f27]/50' : ''}`} key={offer.offer_id} onClick={() => setOfferDetailsModalOpen(true) || setSelectedOffer(offer)}>
                      {pinnedOffers.has(offer.offer_id) && (
                         <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1"><Pin className="h-3 w-3" /></div>
                      )}
                      <div className="card-head">
                        <div className="card-title">
                          <input 
                            type="checkbox" 
                            className="mr-2"
                            onClick={(e) => e.stopPropagation()}
                            checked={selectedOffers.has(offer.offer_id)}
                            onChange={(e) => {
                              const next = new Set(selectedOffers);
                              if (e.target.checked) next.add(offer.offer_id);
                              else next.delete(offer.offer_id);
                              setSelectedOffers(next);
                            }}
                          />
                          {offer.name}
                        </div>
                        <div className="payout-badge">${(offer.payout || 0).toFixed(2)}</div>
                      </div>
                      
                      <div className="card-metrics">
                        <div className="metric">
                          <span className="lbl">ID:</span>
                          <span className="val font-mono">{offer.offer_id}</span>
                        </div>
                        <div className="metric">
                          <span className="lbl">Network:</span>
                          <span className="val">{offer.network || 'Unknown'}</span>
                        </div>
                      </div>

                      <div className="tags">
                         <span className="tag status-tag">
                            <span className={`status-dot ${offer.status === 'active' ? 'active' : 'inactive'}`}></span>
                            {offer.status}
                         </span>
                         {(offer.countries || []).slice(0, 3).map(c => (
                            <span key={c} className="tag border-[0.5px] border-[#2d323e]">{c}</span>
                         ))}
                      </div>

                      <div className="card-actions flex gap-2 mt-4 pt-4 border-t border-[#1b1f27]" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="flex-1 bg-[#1b1f27] text-gray-300 hover:text-white" onClick={() => { setSelectedOffer(offer); setEditOfferModalOpen(true); }}>
                           <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="bg-[#1b1f27] text-gray-300 hover:text-white px-3">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedOffer(offer); setOfferDetailsModalOpen(true); }}><Eye className="h-4 w-4 mr-2"/> Full Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => togglePinOffer(offer.offer_id, e as any)}><Globe className="h-4 w-4 mr-2"/> {pinnedOffers.has(offer.offer_id) ? 'Unpin' : 'Pin to Top'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCloneOffer(offer.offer_id)}><Copy className="h-4 w-4 mr-2"/> Clone</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteOffer(offer.offer_id, offer.name)} className="text-red-500"><Trash2 className="h-4 w-4 mr-2"/> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && offers.length > 0 && (
                <div className="flex items-center justify-between py-6 text-gray-400 text-sm">
                  <div>Showing {customDisplayOffers.length} of {pagination.total} offers</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-[#1b1f27] border-0" disabled={pagination.page <= 1} onClick={() => fetchOffers(pagination.page - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" className="bg-[#1b1f27] border-0" disabled={pagination.page >= pagination.pages} onClick={() => fetchOffers(pagination.page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
"""
    final_source = new_content[:start_content_idx] + custom_ui_jsx + new_content[end_content_idx:]
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(final_source)
    print("Super injection complete!")
else:
    print("Could not find start tag")
