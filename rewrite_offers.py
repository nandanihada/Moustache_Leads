import sys
import re

# We will inject a fully fleshed out React layout that replaces the old table.

new_layout_code = """
          <TabsContent value="offers" className="space-y-4 m-0 p-0">
            {/* INJECTED NEW DESIGNS WITH ORIGINAL BEHAVIOR */}
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
                  <div className="flex items-center gap-2 mr-4 bg-[#1b1f27] px-3 py-1.5 rounded-full">
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
                            <DropdownMenuLabel>Status & Modifiers</DropdownMenuLabel>
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
                      <DropdownMenuItem onClick={handleClearAll} className="text-red-500"><Trash2 className="mr-2 h-4 w-4"/> Clear All Offers</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* STATS STRIP */}
              <div className="stats-strip mt-6 mb-6">
                <div className="stat">
                  <div className="val">{adminStats?.total_offers || 0}</div>
                  <div className="lbl">All Offers</div>
                </div>
                <div className="stat">
                  <div className="val text-green-400">{adminStats?.active_offers || 0}</div>
                  <div className="lbl">Active Offers</div>
                </div>
                <div className="stat">
                  <div className="val text-blue-400">{rotationStatus?.running_count || 0}</div>
                  <div className="lbl">Running Offers</div>
                </div>
              </div>

              {/* FILTER BAR MINIMALIZED FOR DESIGN */}
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
                    {availableNetworks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* SCROLLABLE GRID OF CARDS */}
              {loading ? (
                <div className="py-20 text-center text-gray-400">Loading offers...</div>
              ) : (
                <div className="grid">
                  {offers.map(offer => (
                    <div className="card" key={offer.offer_id} onClick={() => setCarouselViewOpen(true)}>
                      <div className="card-head">
                        <div className="card-title">
                          <input 
                            type="checkbox" 
                            className="mr-2"
                            onClick={(e) => e.stopPropagation()}
                            checked={selectedOffers.has(offer.offer_id)}
                            onChange={(e) => handleSelectOffer(offer.offer_id, e.target.checked)}
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
                            <span key={c} className="tag">{c}</span>
                         ))}
                      </div>

                      <div className="card-actions flex gap-2 mt-4 pt-4 border-t border-[#1b1f27]" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="flex-1 bg-[#1b1f27] text-gray-300 hover:text-white" onClick={() => handleEditOffer(offer)}>
                           <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="bg-[#1b1f27] text-gray-300 hover:text-white px-3">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(offer)}><Eye className="h-4 w-4 mr-2"/> Full Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCloneOffer(offer.offer_id)}><Copy className="h-4 w-4 mr-2"/> Clone</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteOffer(offer.offer_id, offer.name)} className="text-red-500"><Trash2 className="h-4 w-4 mr-2"/> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PAGINATION */}
              {!loading && offers.length > 0 && (
                <div className="flex items-center justify-between py-6 text-gray-400 text-sm">
                  <div>Showing {offers.length} of {pagination.total} offers</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-[#1b1f27] border-0" disabled={pagination.page <= 1} onClick={() => fetchOffers(pagination.page - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" className="bg-[#1b1f27] border-0" disabled={pagination.page >= pagination.pages} onClick={() => fetchOffers(pagination.page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
"""

file_path = r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out_lines = lines[:1706] + [new_layout_code] + lines[2453:]

# we also need to inject the CSS import at the very top of the file
css_import = "import '@/styles/admin-offers-v2.css';\n"
if "admin-offers-v2.css" not in lines[0] and "admin-offers-v2.css" not in lines[1]:
    out_lines.insert(0, css_import)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(out_lines)

print("Injected new layout successfully!")
