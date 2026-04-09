import sys

filename = r"c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx"

with open(filename, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_ui = """
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

      {offersSubView === 'running' && (
         <div className="mb-6">
           <RunningOffersGeoChart offers={runningOffers as any} />
         </div>
      )}

      <AdminOffersDrilldownView 
        offers={offersSubView === 'running' ? runningOffers as any : rawOffers}
        selectedOfferIds={offersSubView === 'running' ? selectedRunningOffers : selectedOffers}
        onToggleSelect={(id, e) => {
          e.stopPropagation();
          if (offersSubView === 'running') {
            const next = new Set(selectedRunningOffers);
            if ((e.target as HTMLInputElement).checked) next.add(id);
            else next.delete(id);
            setSelectedRunningOffers(next);
          } else {
            const next = new Set(selectedOffers);
            if ((e.target as HTMLInputElement).checked) next.add(id);
            else next.delete(id);
            setSelectedOffers(next);
          }
        }}
        onOfferSelect={(offer) => {
          setSelectedOffer(offer as any);
          setOfferDetailsModalOpen(true);
        }}
        onOfferEdit={(offer) => {
          setSelectedOffer(offer as any);
          setEditOfferModalOpen(true);
        }}
      />
"""

start_idx = -1
for i, line in enumerate(lines):
    if '<TabsContent value="offers"' in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start idx")
    sys.exit(1)

end_idx = -1
for i in range(start_idx + 1, len(lines)):
    if '</TabsContent>' in lines[i]:
        end_idx = i
        break

if end_idx == -1:
    print("Could not find end idx")
    sys.exit(1)

new_lines = lines[:start_idx + 1] + [new_ui] + lines[end_idx:]

with open(filename, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
    
print("Successfully replaced tab content!")

with open(filename, "r", encoding="utf-8") as f:
    lines = f.readlines()
    
for i, line in enumerate(lines):
    if "import { RunningOffersGeoChart } from" in line:
        lines.insert(i + 1, "import { AdminOffersDrilldownView } from '@/components/AdminOffersDrilldownView';\n")
        break

with open(filename, "w", encoding="utf-8") as f:
    f.writelines(lines)
    
print("Successfully added import!")
