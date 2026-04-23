import os

def patch():
    file_path = 'src/pages/AdminReportsTracking.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already patched
    if 'ClickTrackAnalytics' in content:
        print("Already patched.")
        return

    # Add Recharts imports if not present
    if 'from \'recharts\'' not in content:
        import_stmt = "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';\n"
        content = content.replace("import React,", import_stmt + "import React,")

    # The new component for Analytics
    analytics_comp = """
const ClickTrackAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/click-tracking/analytics?days=7`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if(data.success) {
        setAnalyticsData(data);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const pauseOffer = async (offer_id: string) => {
    if(!window.confirm('Pause this offer?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/click-tracking/action/pause-offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id })
      });
      const data = await res.json();
      if(data.success) {
        let text = data.suggestions ? '\\nRelated offers:\\n' + data.suggestions.map((s:any)=> `- ${s.name} ($${s.payout})`).join('\\n') : '';
        alert('Offer paused.' + text);
        fetchAnalytics();
      } else alert('Failed: ' + data.error);
    } catch(e) { alert(e); }
  };
  const unpauseOffer = async (offer_id: string) => {
    if(!window.confirm('Unpause this offer?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/click-tracking/action/unpause-offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id })
      });
      const data = await res.json();
      if(data.success) { alert(data.message); fetchAnalytics(); }
      else alert('Failed: ' + data.error);
    } catch(e) { alert(e); }
  };
  const warnUser = async (user_id: string) => {
    const reason = window.prompt('Warning reason? (Sent to user inbox)');
    if(!reason) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/click-tracking/action/warn`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, reason })
      });
      const data = await res.json();
      if(data.success) alert('User warned.');
      else alert('Failed: ' + data.error);
    } catch(e) { alert(e); }
  };
  const decreasePrice = async (offer_id: string, user_id: string | null = null) => {
    const price = window.prompt(`New payout price for ${user_id ? 'this user' : 'ALL users'}?`);
    if(!price) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/click-tracking/action/decrease-price`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id, user_id, new_price: price })
      });
      const data = await res.json();
      if(data.success) alert(data.message);
      else alert('Failed: ' + data.error);
    } catch(e) { alert(e); }
  };

  if(!analyticsData) return <div>{loading ? 'Loading Analytics...' : <Button onClick={fetchAnalytics}>Load Analytics</Button>}</div>;

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Top Users</CardTitle></CardHeader><CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.top_users} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="user_id" type="category" width={80} /><Tooltip /><Bar dataKey="clicks" fill="#f97316" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Top Offers</CardTitle></CardHeader><CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.top_offers} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="offer_id" type="category" width={80} /><Tooltip /><Bar dataKey="clicks" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Top Countries</CardTitle></CardHeader><CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.top_countries} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="country" type="category" width={80} /><Tooltip /><Bar dataKey="clicks" fill="#22c55e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Suspicious & Recent Clicks Analytics</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px]">
          <Table>
            <TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Offer ID</TableHead><TableHead>IP Address</TableHead><TableHead>Country</TableHead><TableHead>Status / Suspicious</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {analyticsData.recent_clicks.map((c: any) => (
                <TableRow key={c._id} className={c.is_suspicious ? 'bg-red-50/50' : ''}>
                  <TableCell>{c.affiliate_id}</TableCell>
                  <TableCell>{c.offer_id}</TableCell>
                  <TableCell>{c.ip_address}</TableCell>
                  <TableCell>{c.country}</TableCell>
                  <TableCell>
                    {c.is_suspicious ? (
                      <div><Badge variant="destructive">Suspicious</Badge><p className="text-xs text-red-600 mt-1">{c.suspicious_reason}</p></div>
                    ) : <Badge variant="outline" className="text-green-700 bg-green-50">Genuine</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                       <Button size="sm" variant="outline" onClick={() => warnUser(c.affiliate_id)}>Warn</Button>
                       <Button size="sm" variant="destructive" onClick={() => pauseOffer(c.offer_id)}>Pause Offer</Button>
                       <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => unpauseOffer(c.offer_id)}>Unpause</Button>
                       <Button size="sm" variant="secondary" onClick={() => decreasePrice(c.offer_id, c.affiliate_id)}>Decr Price</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
"""
    
    # Insert before ClickTrackingTab
    content = content.replace("function ClickTrackingTab() {", analytics_comp + "\nfunction ClickTrackingTab() {")

    # Inject the `<ClickTrackAnalytics />` inside the return statement of ClickTrackingTab
    # Right inside `<div className="space-y-4">`
    content = content.replace('   <div className="space-y-4">\n      <ChartSection', '   <div className="space-y-4">\n      <ClickTrackAnalytics />\n      <ChartSection')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Patched Analytics component successfully!")

patch()
