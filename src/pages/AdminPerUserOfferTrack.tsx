import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  Users,
  Gift,
  Eye,
  MousePointerClick,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { getApiBaseUrl } from "@/services/apiConfig";
import { getAuthToken } from "@/utils/cookies";

const API_BASE = getApiBaseUrl();

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };
}

interface UserSummary {
  user_id: string;
  username: string;
  offer_count: number;
  clicked_count: number;
  sources: string[];
  latest_grant: string;
}

interface OfferVisibility {
  offer_id: string;
  name: string;
  category: string;
  vertical: string;
  payout: number;
  status: string;
  network: string;
  user_count: number;
  sources: string[];
  latest_grant: string;
  users: { user_id: string; username: string; source: string; granted_at: string; clicked: boolean }[];
}

interface UserGrant {
  _id: string;
  offer_id: string;
  source: string;
  granted_by: string;
  granted_at: string;
  expires_at: string;
  is_active: boolean;
  clicked: boolean;
  click_date: string | null;
}

interface UserActivation {
  _id: string;
  keywords: string[];
  offer_ids: string[];
  offers: { offer_id: string; name: string; category: string; payout: number }[];
  trigger: string;
  trigger_reason: string;
  status: string;
  activated_at: string;
  expires_at: string;
  clicks: number;
  last_click_at: string | null;
}

export default function AdminPerUserOfferTrack() {
  const [activeTab, setActiveTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [offerPage, setOfferPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "global" | "exclusive" | "approved">("all");

  // Fetch users summary
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["per-user-offers-users", userSearch, userPage],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "25", page: String(userPage) });
      if (userSearch) params.set("search", userSearch);
      const res = await fetch(`${API_BASE}/api/admin/per-user-offers/users-summary?${params}`, { headers: getHeaders() });
      return res.json();
    },
  });

  // Fetch offer visibility
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ["per-user-offers-visibility", offerSearch, offerPage],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "25", page: String(offerPage) });
      if (offerSearch) params.set("search", offerSearch);
      const res = await fetch(`${API_BASE}/api/admin/per-user-offers/offer-visibility?${params}`, { headers: getHeaders() });
      return res.json();
    },
  });

  // Fetch selected user's details (grants + activations)
  const { data: userDetailData, isLoading: userDetailLoading } = useQuery({
    queryKey: ["per-user-offers-detail", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return null;
      const res = await fetch(`${API_BASE}/api/admin/per-user-offers/user/${selectedUser.user_id}`, { headers: getHeaders() });
      return res.json();
    },
    enabled: !!selectedUser,
  });

  // Fetch full access picture (3 categories)
  const { data: fullAccessData, isLoading: fullAccessLoading } = useQuery({
    queryKey: ["per-user-offers-full-access", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return null;
      const res = await fetch(`${API_BASE}/api/admin/per-user-offers/user/${selectedUser.user_id}/full-access`, { headers: getHeaders() });
      return res.json();
    },
    enabled: !!selectedUser,
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "search_auto_activation": return "🔍 Search Auto";
      case "admin_manual": return "👤 Admin";
      case "admin": return "👤 Admin";
      case "user_request": return "📋 Request";
      default: return source;
    }
  };

  // User detail view
  if (selectedUser) {
    const activations: UserActivation[] = userDetailData?.activations || [];
    const globalActive = fullAccessData?.global_active || { count: 0, offers: [] };
    const exclusive = fullAccessData?.exclusive || { count: 0, offers: [] };
    const approvedAccess = fullAccessData?.approved_access || { count: 0, offers: [] };
    const isLoading = userDetailLoading || fullAccessLoading;

    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
              {selectedUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">@{selectedUser.username}</h2>
              <p className="text-xs text-muted-foreground">
                Full offer access breakdown
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-5">
            {/* Summary Stats — clickable cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card
                className={`cursor-pointer transition-all ${activeSection === "global" ? "border-green-500 ring-2 ring-green-200" : "border-green-200 bg-green-50/30 hover:border-green-400"}`}
                onClick={() => setActiveSection(activeSection === "global" ? "all" : "global")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{globalActive.count}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1">🌐 Global Active</div>
                  <div className="text-[9px] text-muted-foreground">Visible to everyone</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all ${activeSection === "exclusive" ? "border-purple-500 ring-2 ring-purple-200" : "border-purple-200 bg-purple-50/30 hover:border-purple-400"}`}
                onClick={() => setActiveSection(activeSection === "exclusive" ? "all" : "exclusive")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{exclusive.count}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1">🔒 Exclusive</div>
                  <div className="text-[9px] text-muted-foreground">Only this user can see</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all ${activeSection === "approved" ? "border-blue-500 ring-2 ring-blue-200" : "border-blue-200 bg-blue-50/30 hover:border-blue-400"}`}
                onClick={() => setActiveSection(activeSection === "approved" ? "all" : "approved")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{approvedAccess.count}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1">✅ Approved Access</div>
                  <div className="text-[9px] text-muted-foreground">Requested & approved</div>
                </CardContent>
              </Card>
            </div>

            {/* Show sections based on active card */}
            {(activeSection === "all" || activeSection === "exclusive") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-500" />
                  🔒 Exclusive Offers — Only @{selectedUser.username} Can See ({exclusive.count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {exclusive.offers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No exclusive offers for this user</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-50 border-b">
                        <tr>
                          <th className="text-left p-2 font-semibold">Offer</th>
                          <th className="text-left p-2 font-semibold">Category</th>
                          <th className="text-right p-2 font-semibold">Payout</th>
                          <th className="text-left p-2 font-semibold">Source</th>
                          <th className="text-left p-2 font-semibold">Granted</th>
                          <th className="text-left p-2 font-semibold">Expires</th>
                          <th className="text-center p-2 font-semibold">Clicked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {exclusive.offers.map((o: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2">
                              <div className="font-medium">{o.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{o.offer_id}</div>
                            </td>
                            <td className="p-2 text-muted-foreground">{o.category || "—"}</td>
                            <td className="p-2 text-right text-green-600 font-semibold">${o.payout}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[9px]">{getSourceLabel(o.source)}</Badge>
                            </td>
                            <td className="p-2 text-muted-foreground">{formatDate(o.granted_at)}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(o.expires_at)}</td>
                            <td className="p-2 text-center">
                              {o.clicked ? <span className="text-green-600 font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            )}

            {(activeSection === "all" || activeSection === "approved") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-blue-500" />
                  ✅ Approved Access — Requested & Approved ({approvedAccess.count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvedAccess.offers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No approved access requests</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-50 border-b">
                        <tr>
                          <th className="text-left p-2 font-semibold">Offer</th>
                          <th className="text-left p-2 font-semibold">Category</th>
                          <th className="text-right p-2 font-semibold">Payout</th>
                          <th className="text-left p-2 font-semibold">Network</th>
                          <th className="text-left p-2 font-semibold">Requested</th>
                          <th className="text-left p-2 font-semibold">Approved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {approvedAccess.offers.map((o: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2">
                              <div className="font-medium">{o.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{o.offer_id}</div>
                            </td>
                            <td className="p-2 text-muted-foreground">{o.category || "—"}</td>
                            <td className="p-2 text-right text-green-600 font-semibold">${o.payout}</td>
                            <td className="p-2 text-muted-foreground">{o.network || "—"}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(o.requested_at)}</td>
                            <td className="p-2 text-muted-foreground">{formatDate(o.approved_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {(activeSection === "all" || activeSection === "global") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Search className="w-4 h-4 text-green-500" />
                  🌐 Global Active — Visible to All Publishers ({globalActive.count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {globalActive.count === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No global active offers</p>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">
                      These {globalActive.count} offers are active and visible to all publishers (showing first 50).
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                      {globalActive.offers.map((o: any, i: number) => (
                        <div key={i} className="text-[10px] p-2 rounded border bg-green-50/30">
                          <div className="font-medium truncate">{o.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                            <span>{o.category || "—"}</span>
                            <span className="text-green-600 font-semibold">${o.payout}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Activation History */}
            {activations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Gift className="w-4 h-4 text-orange-500" />
                    Auto-Activation History (Why Offers Were Sent)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activations.map((act) => (
                    <div key={act._id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${act.trigger === 'search_auto_activation' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {getSourceLabel(act.trigger)}
                          </Badge>
                          <Badge className={`text-[10px] ${act.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {act.status}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDate(act.activated_at)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <strong>Reason:</strong> {act.trigger_reason}
                      </div>
                      {act.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {act.keywords.map((kw, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{kw}</span>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
                        {act.offers.map((o, i) => (
                          <div key={i} className="text-[10px] p-1.5 rounded bg-muted/50 border">
                            <div className="font-medium truncate">{o.name}</div>
                            <span className="text-green-600">${o.payout}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  // Main view — two sub-tabs
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Per-User Offer Track</h1>
        <p className="text-sm text-muted-foreground mt-1">
          See which offers are exclusively visible to which users, and which offers are shared across multiple users.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> By User
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-1.5">
            <Gift className="w-3.5 h-3.5" /> By Offer
          </TabsTrigger>
        </TabsList>

        {/* BY USER TAB */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search username..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">{usersData?.total || 0} users total</span>
          </div>

          {usersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !usersData?.users?.length ? (
            <div className="text-center py-8 text-muted-foreground">No users found.</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="text-left p-3 font-semibold">User</th>
                        <th className="text-center p-3 font-semibold">Exclusive</th>
                        <th className="text-center p-3 font-semibold">Approved</th>
                        <th className="text-center p-3 font-semibold">Clicked</th>
                        <th className="text-left p-3 font-semibold">Sources</th>
                        <th className="text-center p-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usersData.users.map((user: any) => (
                        <tr key={user.user_id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedUser(user)}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                {user.username?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-sm">@{user.username}</div>
                                <div className="text-[10px] text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${user.offer_count > 0 ? "text-purple-600" : "text-muted-foreground"}`}>{user.offer_count}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${user.approved_count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>{user.approved_count || 0}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${user.clicked_count > 0 ? "text-green-600" : "text-muted-foreground"}`}>{user.clicked_count}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(user.sources || []).map((s: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[9px]">{getSourceLabel(s)}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {usersData.total > 25 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Page {userPage} of {Math.ceil(usersData.total / 25)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={userPage <= 1} onClick={() => setUserPage(userPage - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={userPage * 25 >= usersData.total} onClick={() => setUserPage(userPage + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* BY OFFER TAB */}
        <TabsContent value="offers" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offer name or ID..."
                value={offerSearch}
                onChange={(e) => { setOfferSearch(e.target.value); setOfferPage(1); }}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">{offersData?.total || 0} offers with exclusive access</span>
          </div>

          {offersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !offersData?.offers?.length ? (
            <div className="text-center py-8 text-muted-foreground">No offers with exclusive visibility found.</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="text-left p-3 font-semibold">Offer</th>
                        <th className="text-left p-3 font-semibold">Category</th>
                        <th className="text-right p-3 font-semibold">Payout</th>
                        <th className="text-center p-3 font-semibold">Users</th>
                        <th className="text-left p-3 font-semibold">Status</th>
                        <th className="text-center p-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {offersData.offers.map((offer: OfferVisibility) => (
                        <React.Fragment key={offer.offer_id}>
                          <tr className="hover:bg-muted/20 cursor-pointer" onClick={() => setExpandedOffer(expandedOffer === offer.offer_id ? null : offer.offer_id)}>
                            <td className="p-3">
                              <div className="font-medium text-sm">{offer.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{offer.offer_id}</div>
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">{offer.category || offer.vertical || "—"}</td>
                            <td className="p-3 text-right text-green-600 font-semibold">${offer.payout}</td>
                            <td className="p-3 text-center">
                              <span className="font-bold text-purple-600">{offer.user_count}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[9px]">{offer.status}</Badge>
                            </td>
                            <td className="p-3 text-center">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground inline transition-transform ${expandedOffer === offer.offer_id ? "rotate-90" : ""}`} />
                            </td>
                          </tr>
                          {expandedOffer === offer.offer_id && (
                            <tr className="bg-muted/10">
                              <td colSpan={6} className="p-3">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Users who can see this offer:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {offer.users.map((u, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded border bg-background">
                                      <div>
                                        <span className="text-xs font-medium">@{u.username}</span>
                                        <div className="text-[10px] text-muted-foreground">{formatDate(u.granted_at)}</div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[9px]">{getSourceLabel(u.source)}</Badge>
                                        {u.clicked && <MousePointerClick className="w-3 h-3 text-green-500" />}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {offersData.total > 25 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Page {offerPage} of {Math.ceil(offersData.total / 25)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={offerPage <= 1} onClick={() => setOfferPage(offerPage - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={offerPage * 25 >= offersData.total} onClick={() => setOfferPage(offerPage + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
