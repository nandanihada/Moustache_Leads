import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchActivityLogs,
  deleteActivityLogs,
  fetchFilterOptions,
  fetchRotationBatchDetails,
  fetchEmailActivityLogs,
  type ActivityLog,
  type ActivityLogsFilters,
  type RotationOffer,
  type EmailLog,
} from "@/services/activityLogsApi";
import { toast } from "sonner";
import {
  RefreshCw,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Clock,
  User,
  Globe,
  Tag,
  Activity,
  Mail,
  Gift,
  Zap,
  RotateCcw,
  Package,
  Send,
  ChevronDown,
  ChevronUp,
  ImageIcon,
} from "lucide-react";

const CATEGORY_TABS = [
  { key: "", label: "All Activity", icon: Activity },
  { key: "offer", label: "Offer Actions", icon: Package },
  { key: "recycle_bin", label: "Recycle Bin", icon: Trash2 },
  { key: "rotation", label: "Rotation", icon: RotateCcw },
  { key: "email", label: "Email Logs", icon: Mail },
  { key: "promo_code", label: "Promo Codes", icon: Zap },
  { key: "gift_card", label: "Gift Cards", icon: Gift },
  { key: "image_update", label: "Image Updation", icon: ImageIcon },
];

const ACTION_LABELS: Record<string, string> = {
  offer_created: "Offer Created",
  offer_updated: "Offer Updated",
  offer_deleted: "Offer Deleted",
  bulk_delete: "Bulk Delete",
  bulk_status_update: "Bulk Status Update",
  clear_all_offers: "Clear All Offers",
  recycle_bin_emptied: "Recycle Bin Emptied",
  rotation_batch_activated: "Rotation Batch",
  promo_code_created: "Promo Code Created",
  gift_card_created: "Gift Card Created",
  image_update: "Image Updated",
  image_update_ai: "Image Updated (AI)",
  image_update_upload: "Image Updated (Upload)",
  image_update_stock: "Image Updated (Stock)",
  image_update_bulk: "Image Updated (Bulk)",
};

const ACTION_COLORS: Record<string, string> = {
  offer_created: "bg-green-100 text-green-800",
  offer_updated: "bg-blue-100 text-blue-800",
  offer_deleted: "bg-red-100 text-red-800",
  bulk_delete: "bg-red-100 text-red-800",
  bulk_status_update: "bg-yellow-100 text-yellow-800",
  clear_all_offers: "bg-red-100 text-red-800",
  recycle_bin_emptied: "bg-orange-100 text-orange-800",
  rotation_batch_activated: "bg-purple-100 text-purple-800",
  promo_code_created: "bg-indigo-100 text-indigo-800",
  gift_card_created: "bg-pink-100 text-pink-800",
  image_update: "bg-teal-100 text-teal-800",
  image_update_ai: "bg-violet-100 text-violet-800",
  image_update_upload: "bg-cyan-100 text-cyan-800",
  image_update_stock: "bg-emerald-100 text-emerald-800",
  image_update_bulk: "bg-amber-100 text-amber-800",
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function AdminActivityLogs() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ActivityLogsFilters>({
    page: 1,
    per_page: 25,
    category: "",
    action: "",
    admin: "",
    network: "",
    search: "",
    date_from: "",
    date_to: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showLevelFilters, setShowLevelFilters] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activity-logs", filters],
    queryFn: () => fetchActivityLogs(filters),
    refetchOnWindowFocus: false,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["activity-logs-filters"],
    queryFn: fetchFilterOptions,
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActivityLogs,
    onSuccess: (res) => {
      toast.success(`${res.deleted_count} log(s) deleted`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: () => toast.error("Failed to delete logs"),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? value : 1 }));
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l._id)));
    }
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} log(s)?`)) return;
    deleteMutation.mutate(Array.from(selectedIds));
  };

  const clearFilters = () => {
    setFilters({ page: 1, per_page: filters.per_page, category: filters.category });
    setSelectedIds(new Set());
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const hasActiveFilters = !!(filters.action || filters.admin || filters.network || filters.search || filters.date_from || filters.date_to);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all admin actions across the platform ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = filters.category === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => updateFilter("category", tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-orange-500 text-orange-700 bg-orange-50"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
            hasActiveFilters ? "border-orange-500 text-orange-700 bg-orange-50" : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters {hasActiveFilters && `(active)`}
        </button>
        <button
          onClick={() => setShowLevelFilters(!showLevelFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
            selectedLevel ? "border-blue-500 text-blue-700 bg-blue-50" : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <User className="h-4 w-4" />
          Level Filters {selectedLevel && `(${selectedLevel})`}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>Per page:</span>
          <select
            value={filters.per_page}
            onChange={(e) => updateFilter("per_page", Number(e.target.value))}
            className="border border-border rounded px-2 py-1 bg-background text-foreground text-sm"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg border border-border">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
            <select
              value={filters.action || ""}
              onChange={(e) => updateFilter("action", e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 bg-background text-sm"
            >
              <option value="">All Actions</option>
              {(filterOptions?.actions || []).map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin</label>
            <select
              value={filters.admin || ""}
              onChange={(e) => updateFilter("admin", e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 bg-background text-sm"
            >
              <option value="">All Admins</option>
              {(filterOptions?.admins || []).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Network</label>
            <input
              type="text"
              placeholder="Filter by network..."
              value={filters.network || ""}
              onChange={(e) => updateFilter("network", e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Range</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => updateFilter("date_from", e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="flex-1 border border-border rounded px-2 py-1.5 bg-background text-sm"
              />
              <input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => updateFilter("date_to", e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="flex-1 border border-border rounded px-2 py-1.5 bg-background text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Level Filters Panel */}
      {showLevelFilters && <LevelFiltersPanel selectedLevel={selectedLevel} onLevelSelect={setSelectedLevel} />}

      {/* Rotation Live Panel - shown when rotation tab is active */}
      {filters.category === "rotation" && <RotationLivePanel />}

      {/* Email Logs Panel - shown when email tab is active */}
      {filters.category === "email" && <EmailLogsPanel />}

      {/* Data Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedIds.size === logs.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                    aria-label="Select all logs"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Admin</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Details</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Affected</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading activity logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                    No activity logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(log._id) ? "bg-orange-50/50" : ""}`}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(log._id)}
                        onChange={() => toggleSelect(log._id)}
                        className="rounded border-border"
                        aria-label={`Select log ${log._id}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground capitalize">
                        <Tag className="h-3 w-3" />
                        {(log.category || "").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{log.admin_username}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-xs">
                      <LogDetails log={log} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {log.affected_count > 0 && (
                        <span className="font-medium">{log.affected_count} item(s)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-muted-foreground font-mono">{log.ip_address || "—"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateFilter("page", Math.max(1, (filters.page || 1) - 1))}
              disabled={(filters.page || 1) <= 1}
              className="p-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min((filters.page || 1) - 2, totalPages - 4));
              const pageNum = start + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => updateFilter("page", pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    pageNum === (filters.page || 1)
                      ? "bg-orange-500 text-white"
                      : "border border-border hover:bg-muted/50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => updateFilter("page", Math.min(totalPages, (filters.page || 1) + 1))}
              disabled={(filters.page || 1) >= totalPages}
              className="p-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Level Filters Panel - shows users grouped by level with their last 10 activities */
function LevelFiltersPanel({ selectedLevel, onLevelSelect }: { selectedLevel: string; onLevelSelect: (level: string) => void }) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const levels = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"];

  const levelLabels: Record<string, string> = {
    "L1": "Signed up, no engagement",
    "L2": "Browsed, no action",
    "L3": "Placed, never activated",
    "L4": "Requested, no approval",
    "L5": "Approved, no clicks",
    "L6": "Suspicious activity",
    "L7": "Genuine, no conversion",
  };

  const { data, isLoading } = useQuery({
    queryKey: ["level-users", selectedLevel],
    queryFn: async () => {
      if (!selectedLevel) return { users: [] };
      
      const token = document.cookie.split("token=")[1]?.split(";")[0] || "";
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/admin/activity-logs/users-by-level?level=${selectedLevel}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch users");
      }
      return res.json();
    },
    enabled: !!selectedLevel,
    retry: 1,
  });

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "view": return "bg-blue-100 text-blue-700";
      case "approval": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/20 overflow-hidden">
      {/* Header with Level Tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-100/40 border-b border-blue-200">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-900">User Level Filters</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => onLevelSelect(selectedLevel === level ? "" : level)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                selectedLevel === level
                  ? "bg-blue-600 text-white"
                  : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
              }`}
              title={levelLabels[level]}
            >
              {level}
            </button>
          ))}
          {selectedLevel && (
            <button
              onClick={() => onLevelSelect("")}
              className="ml-2 p-1 hover:bg-blue-200 rounded transition-colors"
              aria-label="Clear level filter"
            >
              <X className="h-3.5 w-3.5 text-blue-600" />
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      {!selectedLevel ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          Select a level (L1-L7) to view users and their activities
        </div>
      ) : isLoading ? (
        <div className="px-4 py-8 text-center text-blue-600">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading users for {selectedLevel}...
        </div>
      ) : !data?.users || data.users.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          No users found for level {selectedLevel}
        </div>
      ) : (
        <div className="divide-y divide-blue-100">
          {data.users.map((user) => (
            <div key={user.id} className="bg-white">
              {/* User Header */}
              <div
                onClick={() => toggleUser(user.id)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{user.username}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {user.level}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {user.activities?.length || 0} activities
                  </span>
                  {expandedUsers.has(user.id) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* User Activities (Expanded) */}
              {expandedUsers.has(user.id) && user.activities && user.activities.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Last {Math.min(10, user.activities.length)} Activities
                    </div>
                    {user.activities.slice(0, 10).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getActivityColor(activity.type)}`}>
                            {activity.type}
                          </span>
                          <span className="text-xs text-foreground">{activity.offer}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live panel showing current rotation batch with full offer details */
function RotationLivePanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rotation-batch-details"],
    queryFn: fetchRotationBatchDetails,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const offers = data?.offers || [];
  const info = data?.rotation_info;

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (ts: string | null | undefined) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50/30 overflow-hidden">
      {/* Rotation Status Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-100/50 border-b border-purple-200">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-purple-600" />
          <div>
            <span className="font-semibold text-purple-900">Current Rotation Batch</span>
            {info && (
              <span className="ml-2 text-xs text-purple-600">
                Batch #{info.batch_index} — {offers.length} offers active
              </span>
            )}
          </div>
          {info?.enabled ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Enabled</span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Disabled</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-purple-700">
          {info?.time_remaining_seconds != null && info.time_remaining_seconds > 0 && (
            <span>Next rotation in: {formatTime(info.time_remaining_seconds)}</span>
          )}
          {info?.window_minutes && <span>Window: {info.window_minutes}min</span>}
          {info?.inactive_pool_count != null && <span>Pool: {info.inactive_pool_count} inactive</span>}
          {info?.running_count != null && info.running_count > 0 && (
            <span className="text-green-700">Running: {info.running_count}</span>
          )}
          <button onClick={() => refetch()} className="p-1 hover:bg-purple-200 rounded transition-colors" aria-label="Refresh rotation data">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Offers Table */}
      {isLoading ? (
        <div className="px-4 py-8 text-center text-purple-600">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading rotation offers...
        </div>
      ) : offers.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground">
          No offers in current rotation batch. {!info?.enabled && "Rotation is disabled."}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-purple-50 border-b border-purple-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Offer ID</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Name</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Network</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Category</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Payout</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Countries</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Status</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Clicks</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Conversions</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Last Click</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Activated At</th>
                <th className="px-3 py-2 text-left font-medium text-purple-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {offers.map((offer) => (
                <tr key={offer.offer_id} className={`hover:bg-purple-50/50 ${offer.is_running ? "bg-green-50/30" : ""}`}>
                  <td className="px-3 py-2 font-mono text-purple-800">{offer.offer_id}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="font-medium text-foreground truncate" title={offer.name}>{offer.name}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{offer.network || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{offer.category || "—"}</td>
                  <td className="px-3 py-2 font-medium text-green-700">${offer.payout}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {offer.countries?.length > 0 ? offer.countries.join(", ") : "Global"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        offer.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {offer.status}
                      </span>
                      {offer.is_running && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">running</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium">{offer.clicks || 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{offer.conversions || 0}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(offer.last_click)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(offer.rotation_activated_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(offer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Email activity logs panel — shown when the Email Logs tab is active */
function EmailLogsPanel() {
  const [emailPage, setEmailPage] = useState(1);
  const [emailPerPage, setEmailPerPage] = useState(20);
  const [sourceFilter, setSourceFilter] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["email-activity-logs", emailPage, emailPerPage, sourceFilter],
    queryFn: () =>
      fetchEmailActivityLogs({
        page: emailPage,
        per_page: emailPerPage,
        source: sourceFilter || undefined,
      }),
    refetchOnWindowFocus: false,
  });

  const logs = data?.logs || [];
  const totalPages = data?.pages || 1;
  const total = data?.total || 0;

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ts; }
  };

  const SOURCE_OPTIONS = [
    { value: "", label: "All Sources" },
    { value: "single_offer", label: "Single Offer" },
    { value: "bulk_upload", label: "Bulk Upload" },
    { value: "api_import", label: "API Import" },
    { value: "support_reply", label: "Support Reply" },
    { value: "support_broadcast", label: "Support Broadcast" },
    { value: "search_logs", label: "Search Logs" },
  ];

  const SOURCE_COLORS: Record<string, string> = {
    bulk_upload: "bg-blue-100 text-blue-700",
    api_import: "bg-purple-100 text-purple-700",
    single_offer: "bg-green-100 text-green-700",
    support_reply: "bg-orange-100 text-orange-700",
    support_broadcast: "bg-pink-100 text-pink-700",
    search_logs: "bg-indigo-100 text-indigo-700",
  };

  const getRecipientLabel = (type: string) => {
    switch (type) {
      case "all_publishers": return "All Publishers";
      case "active_publishers": return "Active Only";
      case "specific_users": return "Specific Users";
      case "all_users": return "All Users";
      default: return type;
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-100/40 border-b border-blue-200">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-900">Email Activity Logs</span>
          <span className="text-xs text-blue-600">{total} total</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setEmailPage(1); }}
            className="border border-blue-200 rounded px-2 py-1 bg-white text-xs"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={emailPerPage}
            onChange={(e) => { setEmailPerPage(Number(e.target.value)); setEmailPage(1); }}
            className="border border-blue-200 rounded px-2 py-1 bg-white text-xs"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
          <button onClick={() => refetch()} className="p-1 hover:bg-blue-200 rounded transition-colors" aria-label="Refresh email logs">
            <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="px-4 py-8 text-center text-blue-600">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading email logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground">No email activity logs found</div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Date</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Action</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Source</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Offers</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Recipients</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Batches</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Per Email</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Admin</th>
                <th className="px-3 py-2 text-left font-medium text-blue-700">Scheduled For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-blue-50/50">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(log.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {log.action === "scheduled" ? (
                        <Clock className="h-3.5 w-3.5 text-yellow-600" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-green-600" />
                      )}
                      <span className="capitalize">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[log.source] || "bg-gray-100 text-gray-700"}`}>
                      {log.source?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div>
                      <span className="font-medium">{log.offer_count}</span>
                      {log.offer_names?.length > 0 && (
                        <div className="text-muted-foreground max-w-[180px] truncate" title={log.offer_names.join(", ")}>
                          {log.offer_names.slice(0, 2).join(", ")}
                          {log.offer_names.length > 2 && ` +${log.offer_names.length - 2}`}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div>
                      <span className="font-medium">{log.recipient_count}</span>
                      <div className="text-muted-foreground">{getRecipientLabel(log.recipient_type)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{log.batch_count}</td>
                  <td className="px-3 py-2 text-muted-foreground">{log.offers_per_email}</td>
                  <td className="px-3 py-2 font-medium">{log.admin_username}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {log.scheduled_time ? formatDate(log.scheduled_time) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-blue-200">
          <button
            onClick={() => setEmailPage((p) => Math.max(1, p - 1))}
            disabled={emailPage <= 1}
            className="p-1.5 rounded border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-blue-700">Page {emailPage} of {totalPages}</span>
          <button
            onClick={() => setEmailPage((p) => Math.min(totalPages, p + 1))}
            disabled={emailPage >= totalPages}
            className="p-1.5 rounded border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Renders contextual details based on the log action/category */
function LogDetails({ log }: { log: ActivityLog }) {
  const d = log.details || {};

  switch (log.action) {
    case "offer_created":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">{d.offer_name}</div>
          {d.network && <div className="text-muted-foreground">Network: {d.network}</div>}
          {d.category && <div className="text-muted-foreground">Category: {d.category}</div>}
          {d.payout && <div className="text-muted-foreground">Payout: ${d.payout}</div>}
        </div>
      );
    case "offer_updated":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">{d.offer_name}</div>
          {d.network && <div className="text-muted-foreground">Network: {d.network}</div>}
          {d.fields_updated && (
            <div className="text-muted-foreground">Fields: {d.fields_updated.slice(0, 5).join(", ")}{d.fields_updated.length > 5 ? ` +${d.fields_updated.length - 5} more` : ""}</div>
          )}
        </div>
      );
    case "offer_deleted":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">{d.offer_name}</div>
          {d.network && <div className="text-muted-foreground">Network: {d.network}</div>}
        </div>
      );
    case "bulk_delete":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">{d.deleted_count} offers deleted</div>
          <div className="text-muted-foreground">Requested: {d.total_requested}</div>
          {log.affected_items?.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-orange-600 hover:underline">View offers</summary>
              <ul className="mt-1 ml-2 space-y-0.5 max-h-32 overflow-y-auto">
                {log.affected_items.map((item, i) => (
                  <li key={i} className="text-muted-foreground">{item.name} {item.network ? `(${item.network})` : ""}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    case "bulk_status_update":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">Status → {d.new_status}</div>
          <div className="text-muted-foreground">{d.updated_count} offers updated ({d.scope})</div>
        </div>
      );
    case "clear_all_offers":
      return (
        <div className="text-xs">
          <div className="font-medium text-foreground">{d.moved_count} offers moved to recycle bin</div>
        </div>
      );
    case "recycle_bin_emptied":
      return (
        <div className="text-xs">
          <div className="font-medium text-foreground">{d.deleted_count} offers permanently deleted</div>
        </div>
      );
    case "rotation_batch_activated":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">Batch #{d.batch_index}: {d.activated_count} activated</div>
          <div className="text-muted-foreground">Window: {d.window_minutes}min | Remaining inactive: {d.total_inactive_remaining}</div>
          {log.affected_items?.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-orange-600 hover:underline">View activated offers</summary>
              <ul className="mt-1 ml-2 space-y-0.5 max-h-32 overflow-y-auto">
                {log.affected_items.map((item, i) => (
                  <li key={i} className="text-muted-foreground">
                    {item.name} ({item.network}) — ${item.payout} | {item.clicks || 0} clicks
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    case "promo_code_created":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">Code: {d.code}</div>
          <div className="text-muted-foreground">{d.bonus_type === "percentage" ? `${d.bonus_amount}%` : `$${d.bonus_amount}`} bonus</div>
          {d.emails_sent > 0 && <div className="text-muted-foreground">{d.emails_sent} emails sent</div>}
        </div>
      );
    case "gift_card_created":
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-foreground">{d.name}</div>
          <div className="text-muted-foreground">Code: {d.code} | ${d.amount} | Max: {d.max_redemptions}</div>
        </div>
      );
    case "image_update":
    case "image_update_ai":
    case "image_update_upload":
    case "image_update_stock":
    case "image_update_bulk":
      return (
        <div className="text-xs space-y-1">
          <div className="font-medium text-foreground">{d.offer_name || 'Unknown offer'}</div>
          <div className="flex items-center gap-2">
            {d.source && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-medium">
              {d.source === 'ai' ? '🤖 AI Generated' : d.source === 'upload' ? '📁 Uploaded' : d.source === 'stock' ? '🖼️ Stock Image' : d.source}
            </span>}
            {d.offer_id && <span className="text-muted-foreground font-mono">{d.offer_id}</span>}
          </div>
          {d.image_url && (
            <img src={d.image_url} alt="" className="w-16 h-16 rounded border object-cover mt-1" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
      );
    default:
      return (
        <div className="text-xs text-muted-foreground">
          {Object.entries(d).slice(0, 3).map(([k, v]) => (
            <div key={k}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
          ))}
        </div>
      );
  }
}
