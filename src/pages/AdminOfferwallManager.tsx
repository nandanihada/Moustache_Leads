import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offerwallManagerApi, OfferwallSettings, OfferwallStats } from "@/services/offerwallManagerApi";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Star, Eye, EyeOff, Sparkles, Plus, Trash2, Save,
  BarChart3, Pin, Layout, Monitor, X, ChevronLeft, ChevronRight
} from "lucide-react";

const AdminOfferwallManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [offerwallPage, setOfferwallPage] = useState(1);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery<OfferwallSettings>({
    queryKey: ['offerwall-management-settings'],
    queryFn: () => offerwallManagerApi.getSettings(),
  });

  // Fetch stats
  const { data: stats } = useQuery<OfferwallStats>({
    queryKey: ['offerwall-management-stats'],
    queryFn: () => offerwallManagerApi.getStats(),
  });

  // Fetch offers (only those visible on the offerwall)
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['offerwall-management-offers', search, offerwallPage],
    queryFn: () => offerwallManagerApi.getOfferwallOffers({ search, page: offerwallPage, per_page: 30 }),
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<OfferwallSettings>) => offerwallManagerApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      toast({ title: "Settings saved", description: "Offerwall settings updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  });

  const pinMutation = useMutation({
    mutationFn: ({ offer_ids, action }: { offer_ids: string[]; action: 'pin' | 'unpin' }) =>
      offerwallManagerApi.pinOffers(offer_ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
      toast({ title: "Updated", description: "Pin status updated." });
    }
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ offer_ids, action }: { offer_ids: string[]; action: 'show' | 'hide' }) =>
      offerwallManagerApi.setVisibility(offer_ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-settings'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-stats'] });
      queryClient.invalidateQueries({ queryKey: ['offerwall-management-offers'] });
      setSelectedOffers(new Set());
      toast({ title: "Updated", description: "Visibility updated." });
    }
  });

  // Local settings state for editing
  const [localTheme, setLocalTheme] = useState<OfferwallSettings['theme'] | null>(null);
  const theme = localTheme || settings?.theme || {
    primary_color: "#6366f1",
    layout: "grid" as const,
    cards_per_row: 3,
    show_categories: true,
    show_search: true
  };

  const handleSaveTheme = () => {
    updateSettingsMutation.mutate({ theme });
  };

  const handleTogglePin = (offerId: string) => {
    const isPinned = settings?.pinned_offers?.includes(offerId);
    pinMutation.mutate({
      offer_ids: [offerId],
      action: isPinned ? 'unpin' : 'pin'
    });
  };

  const handleToggleVisibility = (offerId: string) => {
    const isHidden = settings?.hidden_offers?.includes(offerId);
    visibilityMutation.mutate({
      offer_ids: [offerId],
      action: isHidden ? 'show' : 'hide'
    });
  };

  const handleToggleFeatured = (offerId: string) => {
    const isFeatured = settings?.featured_offers?.includes(offerId);
    const newFeatured = isFeatured
      ? (settings?.featured_offers || []).filter(id => id !== offerId)
      : [...(settings?.featured_offers || []), offerId];
    updateSettingsMutation.mutate({ featured_offers: newFeatured });
  };

  const handleAddAnnouncement = () => {
    if (!announcementText.trim()) return;
    const newAnnouncement = {
      text: announcementText.trim(),
      active: true,
      id: `ann_${Date.now()}`
    };
    const current = settings?.announcements || [];
    updateSettingsMutation.mutate({ announcements: [...current, newAnnouncement] });
    setAnnouncementText("");
    setShowAnnouncementDialog(false);
  };

  const handleRemoveAnnouncement = (id: string) => {
    const current = settings?.announcements || [];
    updateSettingsMutation.mutate({ announcements: current.filter(a => a.id !== id) });
  };

  const handleToggleAnnouncement = (id: string) => {
    const current = settings?.announcements || [];
    const updated = current.map(a => a.id === id ? { ...a, active: !a.active } : a);
    updateSettingsMutation.mutate({ announcements: updated });
  };

  const offers = offersData?.offers || offersData?.data || [];
  const pagination = offersData?.pagination || { page: 1, per_page: 30, total: 0, pages: 1 };

  const handleSelectOffer = (offerId: string, checked: boolean) => {
    setSelectedOffers(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(offerId);
      } else {
        next.delete(offerId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = offers.map((o: any) => o.offer_id || o._id);
      setSelectedOffers(new Set(allIds));
    } else {
      setSelectedOffers(new Set());
    }
  };

  const handleBulkRemove = () => {
    if (selectedOffers.size === 0) return;
    visibilityMutation.mutate({
      offer_ids: Array.from(selectedOffers),
      action: 'hide'
    });
  };

  const allSelected = offers.length > 0 && offers.every((o: any) => selectedOffers.has(o.offer_id || o._id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offerwall Manager</h1>
          <p className="text-muted-foreground">Control how offers appear on the offerwall</p>
        </div>
      </div>

      {/* Stats Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Active</p>
                <p className="text-2xl font-bold">{stats?.total_active ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Visible</p>
                <p className="text-2xl font-bold">{stats?.total_visible ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Pin className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pinned</p>
                <p className="text-2xl font-bold">{stats?.pinned_count ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold">{stats?.featured_count ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="offers">Offer Controls</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Live Offerwall Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <iframe
                  src="https://offerwall.moustacheleads.com/offerwall?placement_id=LFKO1rpd2uoQ78r6&user_id=test_user&api_key=iK66hQRakcvRVj08CX7qfqNzE1Zqt0uF"
                  className="w-full h-full border-0"
                  title="Offerwall Preview"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offer Controls Tab */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Offer Controls</CardTitle>
              <p className="text-sm text-muted-foreground">
                Showing only offers currently visible on the offerwall ({pagination.total} total)
              </p>
              <div className="mt-2">
                <Input
                  placeholder="Search offers..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOfferwallPage(1); setSelectedOffers(new Set()); }}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Bulk Action Bar */}
              {selectedOffers.size > 0 && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-muted rounded-lg border">
                  <span className="text-sm font-medium">{selectedOffers.size} selected</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkRemove}
                    disabled={visibilityMutation.isPending}
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Remove from Offerwall
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOffers(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}

              {offersLoading ? (
                <p className="text-muted-foreground">Loading offers...</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            aria-label="Select all offers"
                          />
                        </TableHead>
                        <TableHead>Offer</TableHead>
                        <TableHead>Network</TableHead>
                        <TableHead>Payout</TableHead>
                        <TableHead className="text-center">Pin</TableHead>
                        <TableHead className="text-center">Visible</TableHead>
                        <TableHead className="text-center">Featured</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offers.map((offer: any) => {
                        const offerId = offer.offer_id || offer._id;
                        const isPinned = settings?.pinned_offers?.includes(offerId);
                        const isHidden = settings?.hidden_offers?.includes(offerId);
                        const isFeatured = settings?.featured_offers?.includes(offerId);
                        const isSelected = selectedOffers.has(offerId);

                        return (
                          <TableRow key={offerId} className={isSelected ? 'bg-muted/50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectOffer(offerId, !!checked)}
                                aria-label={`Select ${offer.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{offer.name}</p>
                                <p className="text-xs text-muted-foreground">{offerId}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{offer.network || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">${offer.payout || 0}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleTogglePin(offerId)}
                                className={isPinned ? 'text-orange-500' : 'text-muted-foreground'}
                              >
                                <Star className="h-4 w-4" fill={isPinned ? 'currentColor' : 'none'} />
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleVisibility(offerId)}
                                className={isHidden ? 'text-red-500' : 'text-green-500'}
                              >
                                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleFeatured(offerId)}
                                className={isFeatured ? 'text-purple-500' : 'text-muted-foreground'}
                              >
                                <Sparkles className="h-4 w-4" fill={isFeatured ? 'currentColor' : 'none'} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {offers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No offers found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.pages} ({pagination.total} offers)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setOfferwallPage(p => Math.max(1, p - 1)); setSelectedOffers(new Set()); }}
                          disabled={pagination.page <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setOfferwallPage(p => Math.min(pagination.pages, p + 1)); setSelectedOffers(new Set()); }}
                          disabled={pagination.page >= pagination.pages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Theme & Display Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label>Primary Color (Buttons & Accents)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.primary_color}
                    onChange={(e) => setLocalTheme({ ...theme, primary_color: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={theme.primary_color}
                    onChange={(e) => setLocalTheme({ ...theme, primary_color: e.target.value })}
                    className="max-w-[150px]"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={(theme as any).background_color || '#0f172a'}
                    onChange={(e) => setLocalTheme({ ...theme, background_color: e.target.value } as any)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={(theme as any).background_color || '#0f172a'}
                    onChange={(e) => setLocalTheme({ ...theme, background_color: e.target.value } as any)}
                    className="max-w-[150px]"
                  />
                  <span className="text-xs text-muted-foreground">Default: #0f172a (dark navy)</span>
                </div>
              </div>

              {/* Layout */}
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select
                  value={theme.layout}
                  onValueChange={(val: 'grid' | 'list' | 'table') => setLocalTheme({ ...theme, layout: val })}
                >
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid (Cards)</SelectItem>
                    <SelectItem value="list">List (Vertical)</SelectItem>
                    <SelectItem value="table">Table (Rows)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cards per row */}
              <div className="space-y-2">
                <Label>Cards Per Row (Grid)</Label>
                <Select
                  value={String(theme.cards_per_row)}
                  onValueChange={(val) => setLocalTheme({ ...theme, cards_per_row: Number(val) })}
                >
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show Categories */}
              <div className="flex items-center justify-between max-w-sm">
                <Label>Show Categories</Label>
                <Switch
                  checked={theme.show_categories}
                  onCheckedChange={(val) => setLocalTheme({ ...theme, show_categories: val })}
                />
              </div>

              {/* Show Search */}
              <div className="flex items-center justify-between max-w-sm">
                <Label>Show Search Bar</Label>
                <Switch
                  checked={theme.show_search}
                  onCheckedChange={(val) => setLocalTheme({ ...theme, show_search: val })}
                />
              </div>

              <Button onClick={handleSaveTheme} disabled={updateSettingsMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Announcements</CardTitle>
                <Button onClick={() => setShowAnnouncementDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Announcement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!settings?.announcements || settings.announcements.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {settings.announcements.map((ann) => (
                    <div key={ann.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={ann.active}
                          onCheckedChange={() => handleToggleAnnouncement(ann.id)}
                        />
                        <span className={ann.active ? '' : 'text-muted-foreground line-through'}>
                          {ann.text}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAnnouncement(ann.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Announcement Dialog */}
          <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Announcement Text</Label>
                  <Input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. New surveys available!"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAnnouncement} disabled={!announcementText.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOfferwallManager;
