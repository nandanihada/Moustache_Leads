import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Search, RefreshCw, Mail, MessageSquare, Calendar, ArrowUpDown,
  ChevronLeft, ChevronRight, Link2, Layers, Globe, User, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { API_BASE_URL } from '@/services/apiConfig';
import OfferCard, { type TabOfferRequest } from './OfferCard';
import SendScheduleModal from './SendScheduleModal';
import PushMailModal from './PushMailModal';

type GroupBy = 'all' | 'network' | 'vertical' | 'country' | 'user';

interface TabContentProps {
  tab: string;
  isActive: boolean;
}

export default function TabContent({ tab, isActive }: TabContentProps) {
  const [items, setItems] = useState<TabOfferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters & grouping
  const [offerName, setOfferName] = useState('');
  const [network, setNetwork] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('all');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPerPage, setGroupPerPage] = useState(20);

  // Modal
  const [sendModal, setSendModal] = useState<{ offerIds: string[]; mode: 'schedule' | 'send_now' } | null>(null);
  const [pushMailModal, setPushMailModal] = useState<{ offerIds: string[] } | null>(null);

  // History items (for history tab)
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'push_mail'>('all');

  const token = localStorage.getItem('token');

  const fetchData = useCallback(async () => {
    if (!isActive) return;
    setLoading(true);
    try {
      if (tab === 'history') {
        const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
        if (historyFilter === 'push_mail') params.set('type', 'push_mail');
        const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-history?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setHistoryItems(data.history || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.pages || 1);
        setItems([]);
      } else {
        // Regular tab data — when grouping, fetch ALL items to group properly
        const isGrouped = groupBy !== 'all';
        const params = new URLSearchParams({
          tab,
          page: isGrouped ? '1' : String(page),
          per_page: isGrouped ? '500' : String(perPage),
          sort_dir: sortDir,
        });
        if (offerName) params.set('offer_name', offerName);
        if (network) params.set('network', network);

        const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/tab-data?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.requests || []);
        if (isGrouped) {
          // Total/pages will be computed from grouped data in the render
          setTotal(data.requests?.length || 0);
          setTotalPages(1);
        } else {
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.pages || 1);
        }
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab, page, perPage, sortDir, offerName, network, isActive, token, historyFilter, groupBy]);

  useEffect(() => { if (isActive) fetchData(); }, [fetchData, isActive]);
  useEffect(() => { setPage(1); setGroupPage(1); }, [offerName, network, sortDir, perPage, groupBy]);

  const handleSearchChange = (value: string) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => setOfferName(value), 400);
    setSearchTimeout(t);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.offer_id)));
  };

  const selectedOfferIds = Array.from(selectedIds);

  // Check if all offers in a group are selected
  const isGroupSelected = (groupItems: TabOfferRequest[]) => {
    return groupItems.length > 0 && groupItems.every(i => selectedIds.has(i.offer_id));
  };
  const isGroupPartial = (groupItems: TabOfferRequest[]) => {
    return groupItems.some(i => selectedIds.has(i.offer_id)) && !isGroupSelected(groupItems);
  };
  const toggleGroupSelect = (groupItems: TabOfferRequest[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isGroupSelected(groupItems)) {
        groupItems.forEach(i => next.delete(i.offer_id));
      } else {
        groupItems.forEach(i => next.add(i.offer_id));
      }
      return next;
    });
  };

  // Group items by selected dimension — CASE-INSENSITIVE to avoid duplicates
  const groupedData = useMemo(() => {
    if (groupBy === 'all') return null;
    const groups: Record<string, { items: TabOfferRequest[]; count: number; displayName: string }> = {};
    for (const item of items) {
      let keys: string[] = [];
      if (groupBy === 'network') {
        keys = [item.offer_network || 'Unknown'];
      } else if (groupBy === 'vertical') {
        keys = [item.offer_category || 'Unknown'];
      } else if (groupBy === 'country') {
        keys = (item.offer_countries && item.offer_countries.length > 0) ? item.offer_countries : ['Unknown'];
      } else if (groupBy === 'user') {
        keys = [item.publisher_username || 'Unknown'];
      }
      for (const key of keys) {
        const normalizedKey = key.trim().toLowerCase();
        if (!groups[normalizedKey]) groups[normalizedKey] = { items: [], count: 0, displayName: key.trim() };
        groups[normalizedKey].items.push(item);
        groups[normalizedKey].count++;
      }
    }
    // Sort by count descending
    return Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  }, [items, groupBy]);

  const handleDeleteCollection = async (item: TabOfferRequest) => {
    try {
      await fetch(`${API_BASE_URL}/api/admin/offer-collections/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offer_id: item.offer_id, collection_type: tab }),
      });
      toast.success('Removed from collection');
      fetchData();
    } catch { toast.error('Failed to remove'); }
  };

  const handlePushMail = async () => {
    if (selectedOfferIds.length === 0) { toast.error('Select offers first'); return; }
    setSendModal({ offerIds: selectedOfferIds, mode: 'schedule' });
  };

  return (
    <div className="space-y-4">
      {/* Group By toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          {([
            { id: 'all' as GroupBy, label: 'All', icon: Layers },
            { id: 'user' as GroupBy, label: 'By User', icon: User },
            { id: 'network' as GroupBy, label: 'By Network', icon: Link2 },
            { id: 'vertical' as GroupBy, label: 'By Vertical', icon: Layers },
            { id: 'country' as GroupBy, label: 'By Country', icon: Globe },
          ]).map(g => (
            <Button
              key={g.id}
              size="sm"
              variant={groupBy === g.id ? 'default' : 'ghost'}
              className={`gap-1.5 h-8 text-xs ${groupBy === g.id ? '' : 'text-muted-foreground'}`}
              onClick={() => { setGroupBy(g.id); setExpandedGroup(null); }}
            >
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search offers..." onChange={e => handleSearchChange(e.target.value)} className="pl-9" />
        </div>
        <Input placeholder="Network" className="w-[140px]" onChange={e => { if (searchTimeout) clearTimeout(searchTimeout); const t = setTimeout(() => setNetwork(e.target.value), 400); setSearchTimeout(t); }} />
        <Button variant="outline" size="sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />{sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </Button>
        <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}>
          <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        {(tab === 'approved' || tab === 'rejected' || tab === 'most_requested') && (
          <Button size="sm" variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setPushMailModal({ offerIds: items.map(i => i.offer_id) })}>
            <Mail className="h-3.5 w-3.5" /> Push Mail
          </Button>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/50">
          <Badge>{selectedIds.size} selected</Badge>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSendModal({ offerIds: selectedOfferIds, mode: 'send_now' })}>
            <Mail className="h-3.5 w-3.5" /> Send Now
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePushMail}>
            <Calendar className="h-3.5 w-3.5" /> Schedule
          </Button>
          {(tab === 'approved' || tab === 'rejected' || tab === 'most_requested') && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPushMailModal({ offerIds: selectedOfferIds })}>
              <MessageSquare className="h-3.5 w-3.5" /> Push Mail
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Select all */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={selectAll}>
            {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span>{groupBy !== 'all' && groupedData ? `${groupedData.length} groups · ` : ''}{total} total results</span>
        </div>
      )}

      {/* Items */}
      {tab === 'history' ? (
        /* ── History View ── */
        <>
        <div className="flex gap-1 bg-muted/60 rounded-lg p-1 mb-3">
          <Button size="sm" variant={historyFilter === 'all' ? 'default' : 'ghost'} onClick={() => { setHistoryFilter('all'); setPage(1); }}>All</Button>
          <Button size="sm" variant={historyFilter === 'push_mail' ? 'default' : 'ghost'} onClick={() => { setHistoryFilter('push_mail'); setPage(1); }}>Push Mail</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...</div>
        ) : historyItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No send history yet</div>
        ) : (
          <div className="space-y-2">
            {historyItems.map((h, i) => (
              <div key={h._id || i} className="border rounded-lg p-3 text-xs space-y-1.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={h.type === 'support' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                      {h.type === 'push_mail' ? '📬 Push Mail' : h.type === 'support' ? '💬 Support' : h.send_mode === 'schedule' || h.send_mode === 'scheduled' ? '📅 Scheduled' : '📧 Email'}
                    </Badge>
                    {h.send_mode === 'one_by_one' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">1-by-1</Badge>}
                    {h.send_mode === 'all_in_one' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">All-in-1</Badge>}
                    <span className="font-medium">{h.subject || h.offer_name || 'No subject'}</span>
                  </div>
                  <span className="text-muted-foreground">{h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>To: {h.recipient_count || (h.recipient_emails?.length ?? 0)} {h.recipient_type === 'all_users' ? 'users (all)' : 'selected users'}</span>
                  <span>By: {h.sent_by || 'admin'}</span>
                  <span>Tab: {h.source_tab || '—'}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600">{h.status || 'sent'}</Badge>
                </div>
                {h.offer_name && !h.offer_names && <div className="text-muted-foreground">Offer: {h.offer_name}</div>}
                {h.offer_names && h.offer_names.length > 0 && (
                  <div className="text-muted-foreground">
                    {h.offer_count || h.offer_names.length} offer{(h.offer_count || h.offer_names.length) !== 1 ? 's' : ''}: {h.offer_names.slice(0, 3).join(', ')}{h.offer_names.length > 3 ? ' +' + (h.offer_names.length - 3) + ' more' : ''}
                  </div>
                )}
                {h.recipient_emails && h.recipient_emails.length > 0 && (
                  <div className="text-muted-foreground truncate">Recipients: {h.recipient_emails.slice(0, 5).join(', ')}{(h.recipient_count || h.recipient_emails.length) > 5 ? ` +${(h.recipient_count || h.recipient_emails.length) - 5} more` : ''}</div>
                )}
              </div>
            ))}
          </div>
        )}
        </>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No items found</div>
      ) : groupBy !== 'all' && groupedData ? (
        /* ── Grouped View with pagination ── */
        <>
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <span>{groupedData.length} groups · {items.length} total offers</span>
          <div className="ml-auto flex items-center gap-2">
            <span>Groups per page:</span>
            <Select value={String(groupPerPage)} onValueChange={v => { setGroupPerPage(Number(v)); setGroupPage(1); }}>
              <SelectTrigger className="w-[70px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-3">
          {groupedData.slice((groupPage - 1) * groupPerPage, groupPage * groupPerPage).map(([groupKey, group]) => (
            <div key={groupKey} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={isGroupSelected(group.items)}
                    // @ts-ignore — indeterminate not in type but works
                    data-state={isGroupPartial(group.items) ? 'indeterminate' : isGroupSelected(group.items) ? 'checked' : 'unchecked'}
                    onCheckedChange={() => toggleGroupSelect(group.items)}
                    aria-label={`Select all ${group.displayName}`}
                  />
                </div>
                <button
                  className="flex-1 flex items-center justify-between text-left"
                  onClick={() => setExpandedGroup(prev => prev === groupKey ? null : groupKey)}
                >
                  <div className="flex items-center gap-2">
                    {groupBy === 'network' && <Link2 className="h-4 w-4 text-blue-500" />}
                    {groupBy === 'vertical' && <Layers className="h-4 w-4 text-purple-500" />}
                    {groupBy === 'country' && <Globe className="h-4 w-4 text-emerald-500" />}
                    {groupBy === 'user' && <User className="h-4 w-4 text-orange-500" />}
                    <span className="font-medium text-sm">{group.displayName}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.count}</Badge>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedGroup === groupKey ? 'rotate-90' : ''}`} />
                </button>
              </div>
              {expandedGroup === groupKey && (
                <div className="p-2 space-y-2 border-t">
                  {group.items.map(item => (
                    <OfferCard
                      key={item._id}
                      item={item}
                      tab={tab}
                      isSelected={selectedIds.has(item.offer_id)}
                      onToggleSelect={() => toggleSelect(item.offer_id)}
                      onCollectionChange={fetchData}
                      onSend={id => setSendModal({ offerIds: [id], mode: 'send_now' })}
                      onSchedule={id => setSendModal({ offerIds: [id], mode: 'schedule' })}
                      onDelete={(tab === 'direct_partner' || tab === 'affiliate') ? handleDeleteCollection : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Group pagination */}
        {Math.ceil(groupedData.length / groupPerPage) > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" disabled={groupPage <= 1} onClick={() => setGroupPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {groupPage} of {Math.ceil(groupedData.length / groupPerPage)}</span>
            <Button size="sm" variant="outline" disabled={groupPage >= Math.ceil(groupedData.length / groupPerPage)} onClick={() => setGroupPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        </>
      ) : (
        /* ── Flat View ── */
        <div className="space-y-2">
          {items.map(item => (
            <OfferCard
              key={item._id}
              item={item}
              tab={tab}
              isSelected={selectedIds.has(item.offer_id)}
              onToggleSelect={() => toggleSelect(item.offer_id)}
              onCollectionChange={fetchData}
              onSend={id => setSendModal({ offerIds: [id], mode: 'send_now' })}
              onSchedule={id => setSendModal({ offerIds: [id], mode: 'schedule' })}
              onDelete={(tab === 'direct_partner' || tab === 'affiliate') ? handleDeleteCollection : undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination — hidden when grouped since all data is loaded */}
      {totalPages > 1 && groupBy === 'all' && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Send/Schedule Modal */}
      {sendModal && (
        <SendScheduleModal
          open={!!sendModal}
          onClose={() => { setSendModal(null); setSelectedIds(new Set()); }}
          offerIds={sendModal.offerIds}
          defaultMode={sendModal.mode}
          sourceTab={tab}
          onSuccess={fetchData}
        />
      )}

      {/* Push Mail Modal */}
      {pushMailModal && (
        <PushMailModal
          open={!!pushMailModal}
          onClose={() => { setPushMailModal(null); setSelectedIds(new Set()); }}
          offerIds={pushMailModal.offerIds}
          sourceTab={tab}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
