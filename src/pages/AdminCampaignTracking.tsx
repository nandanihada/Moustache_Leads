import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw } from 'lucide-react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';
import { toast } from 'sonner';

function AdminCampaignTrackingContent() {
  const API_BASE = getApiBaseUrl();
  const [range, setRange] = useState("last_7_days");
  const [breakdown, setBreakdown] = useState("date");
  const [advertiserId, setAdvertiserId] = useState("all");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ kpis: {}, breakdown: [], conversions: [], advertisers: [] });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/admin/advertiser/reports?range=${range}&breakdown=${breakdown}&advertiser_id=${advertiserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch advertiser reports data");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      toast.error(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range, breakdown, advertiserId]);

  const exportCSV = () => {
    if (!data.breakdown || data.breakdown.length === 0) return;
    
    let headers = [breakdown.toUpperCase(), "IMPRESSIONS", "CLICKS", "CTR", "CONVERSIONS", "CR%", "SPEND", "CPA"];
    let csvRows = [headers.join(",")];
    
    data.breakdown.forEach((row: any) => {
      const label = breakdown === 'campaign' ? row.campaign_name : row.key;
      csvRows.push([
        `"${label}"`,
        row.impressions,
        row.clicks,
        `${row.ctr}%`,
        row.conversions,
        `${row.cr}%`,
        `$${row.spend.toFixed(2)}`,
        `$${row.cpa.toFixed(2)}`
      ].join(","));
    });
    
    // Add total row
    const totalImpressions = data.breakdown.reduce((sum: number, r: any) => sum + r.impressions, 0);
    const totalClicks = data.breakdown.reduce((sum: number, r: any) => sum + r.clicks, 0);
    const totalConversions = data.breakdown.reduce((sum: number, r: any) => sum + r.conversions, 0);
    const totalSpend = data.breakdown.reduce((sum: number, r: any) => sum + r.spend, 0);
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : "0.00";
    const totalCr = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : "0.00";
    const totalCpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";
    
    csvRows.push([
      `"TOTAL"`,
      totalImpressions,
      totalClicks,
      `${totalCtr}%`,
      totalConversions,
      `${totalCr}%`,
      `$${totalSpend.toFixed(2)}`,
      `$${totalCpa}`
    ].join(","));
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_advertiser_report_${breakdown}_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const money = (n: any) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: any) => (Number(n) || 0).toLocaleString("en-US");

  // Sum up totals for table footer
  const totalImpressions = data.breakdown?.reduce((sum: number, r: any) => sum + r.impressions, 0) || 0;
  const totalClicks = data.breakdown?.reduce((sum: number, r: any) => sum + r.clicks, 0) || 0;
  const totalConversions = data.breakdown?.reduce((sum: number, r: any) => sum + r.conversions, 0) || 0;
  const totalSpend = data.breakdown?.reduce((sum: number, r: any) => sum + r.spend, 0) || 0;
  const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
  const totalCr = totalClicks > 0 ? (totalConversions / totalClicks * 100) : 0;
  const totalCpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advertiser Campaign Tracking</h1>
          <p className="text-muted-foreground text-sm">Oversight of advertiser-specific campaign real-time metrics and activity.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Advertiser Dropdown Selection */}
          <div className="w-[220px]">
            <Select value={advertiserId} onValueChange={setAdvertiserId}>
              <SelectTrigger>
                <SelectValue placeholder="All Advertisers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Advertisers</SelectItem>
                {data.advertisers?.map((adv: any) => (
                  <SelectItem key={adv.advertiser_id} value={adv.advertiser_id}>
                    {adv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Range Selection */}
          <div className="w-[150px]">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button 
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center gap-2"
            onClick={exportCSV} 
            disabled={loading || !data.breakdown || data.breakdown.length === 0}
          >
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: "Impressions", val: num(data.kpis?.impressions), color: "text-blue-600 dark:text-blue-400" },
          { label: "Clicks", val: num(data.kpis?.clicks), color: "text-purple-600 dark:text-purple-400" },
          { label: "CTR", val: (data.kpis?.ctr || 0) + "%", color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Conversions", val: num(data.kpis?.conversions), color: "text-green-600 dark:text-green-400" },
          { label: "CR%", val: (data.kpis?.cr || 0) + "%", color: "text-green-600 dark:text-green-400" },
          { label: "Spend", val: money(data.kpis?.spend), color: "text-red-600 dark:text-red-400" },
          { label: "Avg CPA", val: money(data.kpis?.avg_cpa), color: "text-gray-700 dark:text-gray-300" }
        ].map((c, i) => (
          <Card key={i} className="p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <span className="text-xs font-semibold text-muted-foreground">{c.label}</span>
            <span className={`text-xl font-bold mt-2 ${c.color}`}>{c.val}</span>
          </Card>
        ))}
      </div>

      {/* Breakdown Section */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold">Breakdown Analysis</h2>
          <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border">
            {["date", "campaign", "country", "device"].map((b) => (
              <Button
                key={b}
                variant={breakdown === b ? "default" : "ghost"}
                size="sm"
                className="capitalize text-xs font-medium"
                onClick={() => setBreakdown(b)}
              >
                {b}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading reports...</div>
        ) : error ? (
          <div className="py-8 text-center text-red-500 text-sm">Error: {error}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase">{breakdown}</TableHead>
                  <TableHead className="text-right">IMPRESSIONS</TableHead>
                  <TableHead className="text-right">CLICKS</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CONVERSIONS</TableHead>
                  <TableHead className="text-right">CR%</TableHead>
                  <TableHead className="text-right">SPEND</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.breakdown?.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">
                      {breakdown === 'campaign' ? row.campaign_name : row.key}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{num(row.impressions)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{num(row.clicks)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-green-600">{num(row.conversions)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.cr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">{money(row.spend)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{money(row.cpa)}</TableCell>
                  </TableRow>
                ))}
                
                {data.breakdown?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No breakdown data recorded for this range
                    </TableCell>
                  </TableRow>
                )}
                
                {data.breakdown?.length > 0 && (
                  <TableRow className="font-bold bg-muted/50 border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-mono text-xs">{num(totalImpressions)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{num(totalClicks)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{totalCtr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs text-green-600">{num(totalConversions)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{totalCr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{money(totalSpend)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{money(totalCpa)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Conversion Log */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Conversion Log</h3>
          <p className="text-xs text-muted-foreground">Recent conversion events processed via S2S tracking pipelines.</p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TIME</TableHead>
                <TableHead>CONV. ID</TableHead>
                <TableHead>OFFER</TableHead>
                <TableHead className="text-center">GEO</TableHead>
                <TableHead className="text-center">DEVICE</TableHead>
                <TableHead>GOAL</TableHead>
                <TableHead className="text-right">PAYOUT</TableHead>
                <TableHead className="text-center">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.conversions?.map((c: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground text-xs">{new Date(c.time).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{c.conversion_id}</TableCell>
                  <TableCell className="font-semibold">{c.offer_name}</TableCell>
                  <TableCell className="text-center">{c.geo}</TableCell>
                  <TableCell className="text-center capitalize text-xs">{c.device}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.goal}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{money(c.payout)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              
              {data.conversions?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No conversion logs found for this range
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

const AdminCampaignTracking = () => (
  <AdminPageGuard requiredTab="tracking">
    <AdminCampaignTrackingContent />
  </AdminPageGuard>
);

export default AdminCampaignTracking;
