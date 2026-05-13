import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subWallApi, SubWall } from "@/services/subWallApi";
import { surveyBuilderApi } from "@/services/surveyBuilderApi";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Layers, Plus, Trash2, Edit, ExternalLink, Search, Copy, X
} from "lucide-react";
import { getApiBaseUrl } from "@/services/apiConfig";
import { getAuthToken } from "@/utils/cookies";

export default function AdminSubWalls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingSubWall, setEditingSubWall] = useState<SubWall | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formOfferIds, setFormOfferIds] = useState<string[]>([]);
  const [formPreScreening, setFormPreScreening] = useState(false);
  const [formSurveyId, setFormSurveyId] = useState<string>("");
  const [formFilterByAnswers, setFormFilterByAnswers] = useState(false);
  const [formStatus, setFormStatus] = useState<string>("draft");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [formVisibility, setFormVisibility] = useState<string>("everyone");
  const [formVisibleCountries, setFormVisibleCountries] = useState("");

  // Customization fields
  const [formHeadingText, setFormHeadingText] = useState("");
  const [formThemeColor, setFormThemeColor] = useState("#6366f1");
  const [formBannerImage, setFormBannerImage] = useState("");
  const [formButtonText, setFormButtonText] = useState("Click to Earn");
  const [formSurveyFrequency, setFormSurveyFrequency] = useState("every_time");
  const [showPreview, setShowPreview] = useState(false);  // Offer search
  const [offerSearch, setOfferSearch] = useState("");
  const [offerResults, setOfferResults] = useState<any[]>([]);
  const [offerSearchLoading, setOfferSearchLoading] = useState(false);

  // User search (for specific_users visibility)
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Fetch sub-walls
  const { data: subWallsData, isLoading } = useQuery({
    queryKey: ['admin-sub-walls', search],
    queryFn: () => subWallApi.listSubWalls({ search }),
  });

  // Fetch surveys for dropdown
  const { data: surveysData } = useQuery({
    queryKey: ['admin-surveys-list'],
    queryFn: () => surveyBuilderApi.listSurveys({ per_page: 100 }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<SubWall>) => subWallApi.createSubWall(data),
    onSuccess: () => {
      toast({ title: "Sub-wall created successfully" });
      queryClient.invalidateQueries({ queryKey: ['admin-sub-walls'] });
      resetForm();
      setShowDialog(false);
    },
    onError: (err: any) => toast({ title: err.message || "Failed to create sub-wall", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubWall> }) => subWallApi.updateSubWall(id, data),
    onSuccess: () => {
      toast({ title: "Sub-wall updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['admin-sub-walls'] });
      resetForm();
      setShowDialog(false);
    },
    onError: () => toast({ title: "Failed to update sub-wall", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subWallApi.deleteSubWall(id),
    onSuccess: () => {
      toast({ title: "Sub-wall deleted" });
      queryClient.invalidateQueries({ queryKey: ['admin-sub-walls'] });
    },
    onError: () => toast({ title: "Failed to delete sub-wall", variant: "destructive" }),
  });

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormImageUrl("");
    setFormOfferIds([]);
    setFormPreScreening(false);
    setFormSurveyId("");
    setFormFilterByAnswers(false);
    setFormStatus("draft");
    setFormDisplayOrder(0);
    setFormVisibility("everyone");
    setFormVisibleCountries("");
    setFormHeadingText("");
    setFormThemeColor("#6366f1");
    setFormBannerImage("");
    setFormButtonText("Click to Earn");
    setFormSurveyFrequency("every_time");
    setEditingSubWall(null);
    setOfferSearch("");
    setOfferResults([]);
    setUserSearch("");
    setUserResults([]);
    setSelectedUserIds([]);
    setShowPreview(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (sw: SubWall) => {
    setEditingSubWall(sw);
    setFormName(sw.name);
    setFormSlug(sw.slug);
    setFormDescription(sw.description || "");
    setFormImageUrl(sw.image_url || "");
    setFormOfferIds(sw.offer_ids || []);
    setFormPreScreening(sw.pre_screening_enabled);
    setFormSurveyId(sw.pre_screening_survey_id || "");
    setFormFilterByAnswers(sw.filter_by_answers);
    setFormStatus(sw.status);
    setFormDisplayOrder(sw.display_order || 0);
    setFormVisibility(sw.visibility || "everyone");
    setFormVisibleCountries((sw.visible_countries || []).join(', '));
    setSelectedUserIds(sw.visible_to_publishers || []);
    setFormHeadingText(sw.heading_text || "");
    setFormThemeColor(sw.theme_color || "#6366f1");
    setFormBannerImage(sw.banner_image || "");
    setFormButtonText(sw.button_text || "Click to Earn");
    setFormSurveyFrequency((sw as any).survey_frequency || "every_time");
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    const payload: Partial<SubWall> = {
      name: formName.trim(),
      slug: formSlug.trim() || undefined,
      description: formDescription.trim(),
      image_url: formImageUrl.trim(),
      offer_ids: formOfferIds,
      pre_screening_enabled: formPreScreening,
      pre_screening_survey_id: formPreScreening ? formSurveyId || null : null,
      filter_by_answers: formFilterByAnswers,
      visibility: formVisibility as SubWall['visibility'],
      visible_to_publishers: formVisibility === 'specific_users' ? selectedUserIds : [],
      visible_countries: formVisibility === 'by_country' ? formVisibleCountries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [],
      status: formStatus as SubWall['status'],
      display_order: formDisplayOrder,
      heading_text: formHeadingText.trim(),
      theme_color: formThemeColor,
      banner_image: formBannerImage.trim(),
      button_text: formButtonText.trim() || 'Click to Earn',
      survey_frequency: formPreScreening ? formSurveyFrequency : undefined,
    };

    if (editingSubWall?._id) {
      updateMutation.mutate({ id: editingSubWall._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingSubWall) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setFormSlug(slug);
    }
  };

  // Offer search
  const searchOffers = async (query: string) => {
    if (!query.trim()) {
      setOfferResults([]);
      return;
    }
    setOfferSearchLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/admin/offers?search=${encodeURIComponent(query)}&per_page=10`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOfferResults(data.offers || []);
      }
    } catch (e) {
      console.error('Offer search failed:', e);
    } finally {
      setOfferSearchLoading(false);
    }
  };

  const addOffer = (offerId: string) => {
    if (!formOfferIds.includes(offerId)) {
      setFormOfferIds([...formOfferIds, offerId]);
    }
  };

  const removeOffer = (offerId: string) => {
    setFormOfferIds(formOfferIds.filter(id => id !== offerId));
  };

  // User search for specific_users visibility
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/api/admin/publishers?search=${encodeURIComponent(query)}&per_page=10`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserResults(data.publishers || data.users || []);
      }
    } catch (e) {
      console.error('User search failed:', e);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`https://walls.moustacheleads.com/wall/${slug}`);
    toast({ title: "URL copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'inactive': return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
      case 'draft': return <Badge className="bg-yellow-100 text-yellow-700">Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const subWalls = subWallsData?.sub_walls || [];
  const surveys = surveysData?.surveys || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Sub-Walls</h1>
          <Badge variant="outline">{subWalls.length} total</Badge>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" /> Create Sub-Wall
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sub-walls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sub-walls table */}
      <Card>
        <CardHeader>
          <CardTitle>All Sub-Walls</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : subWalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sub-walls yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Offers</TableHead>
                  <TableHead>Pre-Screening</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subWalls.map((sw) => (
                  <TableRow key={sw._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sw.image_url && (
                          <img src={sw.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <div>
                          <div className="font-medium">{sw.name}</div>
                          {sw.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {sw.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{sw.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sw.offer_ids?.length || 0} offers</Badge>
                    </TableCell>
                    <TableCell>
                      {sw.pre_screening_enabled ? (
                        <Badge className="bg-blue-100 text-blue-700">Enabled</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Off</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(sw.status)}</TableCell>
                    <TableCell>{sw.display_order || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(sw)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyUrl(sw.slug)} title="Copy URL">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://walls.moustacheleads.com/wall/${sw.slug}`, '_blank')}
                          title="Open public URL"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Delete this sub-wall?')) {
                              deleteMutation.mutate(sw._id!);
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubWall ? 'Edit Sub-Wall' : 'Create Sub-Wall'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Premium Surveys"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label>Slug (URL path)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">walls.moustacheleads.com/wall/</span>
                <Input
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="premium-surveys"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this sub-wall..."
                rows={2}
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="/uploads/wall-banner.png or https://..."
              />
              {formImageUrl && (
                <img src={formImageUrl} alt="Preview" className="w-32 h-20 object-cover rounded border" />
              )}
            </div>

            {/* Offer Selector */}
            <div className="space-y-2">
              <Label>Offers ({formOfferIds.length} selected)</Label>
              <div className="flex gap-2">
                <Input
                  value={offerSearch}
                  onChange={(e) => {
                    setOfferSearch(e.target.value);
                    searchOffers(e.target.value);
                  }}
                  placeholder="Search offers by name or ID..."
                  className="flex-1"
                />
              </div>
              {/* Search results */}
              {offerResults.length > 0 && (
                <div className="border rounded max-h-32 overflow-y-auto">
                  {offerResults.map((offer) => (
                    <div
                      key={offer.offer_id || offer._id}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => addOffer(offer.offer_id || offer._id)}
                    >
                      <span>{offer.offer_id} - {offer.name}</span>
                      {formOfferIds.includes(offer.offer_id || offer._id) ? (
                        <Badge variant="outline" className="text-xs">Added</Badge>
                      ) : (
                        <Plus className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {offerSearchLoading && <div className="text-xs text-muted-foreground">Searching...</div>}
              {/* Selected offers */}
              {formOfferIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formOfferIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {id}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeOffer(id)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Pre-screening toggle */}
            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <Label>Pre-Screening Survey</Label>
                <p className="text-xs text-muted-foreground">Show a survey before displaying offers</p>
              </div>
              <Switch checked={formPreScreening} onCheckedChange={setFormPreScreening} />
            </div>

            {/* Survey selector (if pre-screening enabled) */}
            {formPreScreening && (
              <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                <div className="space-y-2">
                  <Label>Select Survey</Label>
                  <Select value={formSurveyId} onValueChange={setFormSurveyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a survey..." />
                    </SelectTrigger>
                    <SelectContent>
                      {surveys.map((s) => (
                        <SelectItem key={s._id} value={s._id!}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Filter Offers by Answers</Label>
                    <p className="text-xs text-muted-foreground">Show different offers based on survey responses</p>
                  </div>
                  <Switch checked={formFilterByAnswers} onCheckedChange={setFormFilterByAnswers} />
                </div>

                {/* Survey Frequency */}
                <div className="space-y-2">
                  <Label>Show Survey</Label>
                  <Select value={formSurveyFrequency} onValueChange={setFormSurveyFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every_time">Every time user visits</SelectItem>
                      <SelectItem value="once">Only once (remember user)</SelectItem>
                      <SelectItem value="once_per_day">Once per day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility (Who can see this sub-wall)</Label>
              <Select value={formVisibility} onValueChange={setFormVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="specific_users">Specific Users Only</SelectItem>
                  <SelectItem value="by_country">By Country</SelectItem>
                  <SelectItem value="link_only">Link Only (not shown on offerwall)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formVisibility === 'specific_users' && (
              <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                <Label>Search & Select Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Search users by name or username..."
                    className="pl-9"
                  />
                </div>
                {userSearchLoading && <p className="text-xs text-muted-foreground">Searching...</p>}
                {userResults.length > 0 && (
                  <div className="border rounded max-h-32 overflow-y-auto">
                    {userResults.map((user: any) => {
                      const userId = user._id || user.user_id || user.username;
                      const displayName = user.username || user.name || user.email || userId;
                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => {
                            if (!selectedUserIds.includes(userId)) {
                              setSelectedUserIds([...selectedUserIds, userId]);
                            }
                            setUserSearch("");
                            setUserResults([]);
                          }}
                        >
                          <span>{displayName}</span>
                          {selectedUserIds.includes(userId) && (
                            <Badge variant="outline" className="text-xs">Added</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedUserIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {id}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedUserIds(selectedUserIds.filter(uid => uid !== id))} />
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Only these users will see this sub-wall on the offerwall</p>
              </div>
            )}

            {formVisibility === 'by_country' && (
              <div className="space-y-2 pl-4 border-l-2 border-orange-200">
                <Label>Allowed Countries (comma-separated codes)</Label>
                <Input
                  value={formVisibleCountries}
                  onChange={(e) => setFormVisibleCountries(e.target.value)}
                  placeholder="US, UK, CA, AU, DE"
                />
                <p className="text-xs text-muted-foreground">Only users from these countries will see this sub-wall on the offerwall</p>
              </div>
            )}

            {/* Display Order */}
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={formDisplayOrder}
                onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>

            {/* Public URL preview */}
            {formSlug && (
              <div className="bg-muted/50 rounded p-3">
                <Label className="text-xs text-muted-foreground">Public URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm">walls.moustacheleads.com/wall/{formSlug}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(formSlug)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Customization Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3">🎨 Wall Appearance</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heading Text</Label>
                  <Input
                    value={formHeadingText}
                    onChange={(e) => setFormHeadingText(e.target.value)}
                    placeholder="e.g. Exclusive Offers"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button Text</Label>
                  <Input
                    value={formButtonText}
                    onChange={(e) => setFormButtonText(e.target.value)}
                    placeholder="Click to Earn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label>Theme Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formThemeColor}
                      onChange={(e) => setFormThemeColor(e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={formThemeColor}
                      onChange={(e) => setFormThemeColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Banner Image URL</Label>
                  <Input
                    value={formBannerImage}
                    onChange={(e) => setFormBannerImage(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Preview Toggle */}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Hide Preview' : '👁️ Show Preview'}
              </Button>

              {/* Live Preview */}
              {showPreview && (
                <div className="mt-3 rounded-xl overflow-hidden border" style={{ background: '#0f172a' }}>
                  {/* Banner */}
                  {formBannerImage && (
                    <div className="h-32 overflow-hidden">
                      <img src={formBannerImage} alt="Banner" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {/* Header */}
                  <div className="p-4 text-center">
                    {formImageUrl && (
                      <img src={formImageUrl} alt="" className="w-16 h-16 rounded-xl mx-auto mb-2 object-cover" />
                    )}
                    <h3 className="text-white text-xl font-bold">{formHeadingText || formName || 'Sub-Wall'}</h3>
                    {formDescription && <p className="text-gray-400 text-sm mt-1">{formDescription}</p>}
                    <p className="text-gray-500 text-xs mt-1">{formOfferIds.length} offers</p>
                  </div>
                  {/* Sample offer cards */}
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <div className="h-16 bg-slate-700 rounded mb-2"></div>
                        <div className="h-3 bg-slate-600 rounded w-3/4 mb-1"></div>
                        <div className="h-2 bg-slate-700 rounded w-1/2 mb-2"></div>
                        <button
                          className="w-full py-1.5 rounded text-white text-xs font-medium"
                          style={{ background: formThemeColor }}
                        >
                          {formButtonText || 'Click to Earn'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pb-3 text-gray-600 text-xs">
                    walls.moustacheleads.com/wall/{formSlug || 'slug'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingSubWall ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
