import { useState, useEffect, useCallback } from "react";
import {
  fetchLinkHealthStats,
  fetchLinkHealthOffers,
  checkSingleOffer,
  checkBulkOffers,
  fetchNetworksWithIssues,
} from "@/services/linkHealthApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Link2,
  ExternalLink,
  Search,
} from "lucide-react";

interface LinkHealth {
  status: string;
  last_checked: string | null;
  final_url: string | null;
  final_status: number | null;
  failure_reason: string | null;
  redirect_count: number;
  matched_keywords: string[];
  checked_by: string | null;
}

interface OfferWithHealth {
  offer_id: string;
  name: string;
  target_url: string;
  network: string;
  status: string;
  payout: number;
  currency: string;
  link_health: LinkHealth;
}

interface Stats {
  healthy?: number;
  broken?: number;
  soft_broken?: number;
  error?: number;
  no_url?: number;
  never_checked?: number;
  total_active?: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "healthy":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Healthy
        </Badge>
      );
    case "broken":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3 mr-1" /> Broken
        </Badge>
      );
    case "soft_broken":
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
          <AlertTriangle className="w-3 h-3 mr-1" /> Wrong Page
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <AlertTriangle className="w-3 h-3 mr-1" /> Error
        </Badge>
      );
    case "no_url":
      return (
        <Badge variant="secondary">
          <Link2 className="w-3 h-3 mr-1" /> No URL
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" /> Not Checked
        </Badge>
      );
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function AdminLinkHealth() {
  const [stats, setStats] = useState<Stats>({});
  const [offers, setOffers] = useState<OfferWithHealth[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [networks, setNetworks] = useState<{ network: string; count?: number; broken_count?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchLinkHealthStats();
      if (res.success) setStats(res.stats);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, []);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLinkHealthOffers({
        status: statusFilter,
        page,
        limit: 50,
        search,
        network: networkFilter,
      });
      if (res.success) {
        setOffers(res.offers);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      }
    } catch (err) {
      console.error("Failed to load offers:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search, networkFilter]);

  const loadNetworks = useCallback(async () => {
    try {
      const res = await fetchNetworksWithIssues();
      if (res.success) setNetworks(res.networks);
    } catch (err) {
      console.error("Failed to load networks:", err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadNetworks();
  }, [loadStats, loadNetworks]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const handleCheckSingle = async (offerId: string) => {
    setChecking(offerId);
    try {
      const res = await checkSingleOffer(offerId);
      if (res.success) {
        toast.success(`Checked ${offerId}: ${res.result.status}`);
        loadOffers();
        loadStats();
      } else {
        toast.error(res.error || "Check failed");
      }
    } catch (err) {
      toast.error("Failed to check offer");
    } finally {
      setChecking(null);
    }
  };

  const handleBulkCheck = async () => {
    if (selectedOffers.size === 0) {
      toast.error("Select offers to check");
      return;
    }
    if (selectedOffers.size > 20) {
      toast.error("Max 20 offers per bulk check");
      return;
    }
    setChecking("bulk");
    try {
      const res = await checkBulkOffers(Array.from(selectedOffers));
      if (res.success) {
        toast.success(`Checked ${res.checked} offers, ${res.broken} broken`);
        setSelectedOffers(new Set());
        loadOffers();
        loadStats();
      } else {
        toast.error(res.error || "Bulk check failed");
      }
    } catch (err) {
      toast.error("Failed to bulk check");
    } finally {
      setChecking(null);
    }
  };

  const toggleSelectOffer = (offerId: string) => {
    setSelectedOffers((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedOffers.size === offers.length) {
      setSelectedOffers(new Set());
    } else {
      setSelectedOffers(new Set(offers.map((o) => o.offer_id)));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Link Health Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitors offer tracking links for broken URLs and wrong landing pages via Geekflare API
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => { loadStats(); loadOffers(); }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => { setStatusFilter(""); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_active || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-green-500/50 transition-all" onClick={() => { setStatusFilter("healthy"); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.healthy || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all border-red-200 dark:border-red-900" onClick={() => { setStatusFilter("broken"); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Broken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.broken || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-orange-500/50 transition-all border-orange-200 dark:border-orange-900" onClick={() => { setStatusFilter("soft_broken"); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-600">Wrong Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.soft_broken || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all" onClick={() => { setStatusFilter("error"); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.error || 0}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => { setStatusFilter("never_checked"); setPage(1); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Not Checked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.never_checked || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="broken">Broken</SelectItem>
            <SelectItem value="soft_broken">Wrong Page</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="never_checked">Not Checked</SelectItem>
          </SelectContent>
        </Select>

        <Select value={networkFilter} onValueChange={(v) => { setNetworkFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Networks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            {networks.map((n) => (
              <SelectItem key={n.network} value={n.network}>
                {n.network} ({n.count || n.broken_count || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedOffers.size > 0 && (
          <Button
            onClick={handleBulkCheck}
            disabled={checking === "bulk"}
            size="sm"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${checking === "bulk" ? "animate-spin" : ""}`} />
            Check Selected ({selectedOffers.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedOffers.size === offers.length && offers.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Offer URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Final URL</TableHead>
                <TableHead>Redirects</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : offers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No offers found
                  </TableCell>
                </TableRow>
              ) : (
                offers.map((offer) => (
                  <TableRow key={offer.offer_id} className={
                    offer.link_health.status === "broken" ? "bg-red-50/50 dark:bg-red-950/10" :
                    offer.link_health.status === "soft_broken" ? "bg-orange-50/50 dark:bg-orange-950/10" : ""
                  }>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOffers.has(offer.offer_id)}
                        onChange={() => toggleSelectOffer(offer.offer_id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="font-medium text-sm truncate">{offer.name}</div>
                        <div className="text-xs text-muted-foreground">{offer.offer_id}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{offer.network || "—"}</TableCell>
                    <TableCell>
                      {offer.target_url ? (
                        <div className="flex items-center gap-1 max-w-[300px]">
                          <span
                            className="text-xs text-blue-600 break-all cursor-pointer hover:underline select-all"
                            title="Click to select full URL"
                            onClick={() => { navigator.clipboard.writeText(offer.target_url); toast.success("URL copied!"); }}
                          >
                            {offer.target_url}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(offer.link_health.status)}</TableCell>
                    <TableCell>
                      {offer.link_health.final_url ? (
                        <a
                          href={offer.link_health.final_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 max-w-[180px] truncate"
                        >
                          {new URL(offer.link_health.final_url).hostname}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{offer.link_health.redirect_count || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(offer.link_health.last_checked)}
                    </TableCell>
                    <TableCell>
                      {offer.link_health.failure_reason ? (
                        <span className="text-xs text-red-600 dark:text-red-400 max-w-[200px] block truncate" title={offer.link_health.failure_reason}>
                          {offer.link_health.failure_reason}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckSingle(offer.offer_id)}
                        disabled={checking === offer.offer_id}
                      >
                        <RefreshCw className={`w-3 h-3 ${checking === offer.offer_id ? "animate-spin" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offers.length} of {total} offers
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm self-center">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
