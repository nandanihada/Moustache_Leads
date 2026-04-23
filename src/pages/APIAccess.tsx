import React, { useState, useEffect } from "react";
import { Copy, AlertCircle, Trash, Code2, Terminal, Plus, Lock, Webhook, KeyRound, Zap, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/services/apiConfig";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

const APIAccess = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [globalPostback, setGlobalPostback] = useState("");
  const [isSavingPostback, setIsSavingPostback] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/keys`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.api_keys) {
          const formattedKeys = data.api_keys.map((k: any) => ({
            id: k._id, name: k.key_name, key: k.api_key, status: k.status,
            createdAt: new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          }));
          setApiKeys(formattedKeys);
        }
      }).catch(console.error);

    fetch(`${API_BASE_URL}/api/keys/postback`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setGlobalPostback(data.postback_url || ""); })
      .catch(console.error).finally(() => setIsLoading(false));
  }, [token]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return toast({ title: "Error", description: "API Key Name is required", variant: "destructive" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key_name: newKeyName })
      });
      const data = await response.json();
      if (data.success) {
        setApiKeys([{
          id: data.api_key._id, name: data.api_key.key_name, key: data.api_key.api_key, 
          status: data.api_key.status, createdAt: new Date(data.api_key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }, ...apiKeys]);
        setIsCreateModalOpen(false); setNewKeyName("");
        toast({ title: "API Key Created", description: "Your new API key has been generated." });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied!", description: "Copied to clipboard" });
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) setApiKeys(apiKeys.map(key => key.id === id ? { ...key, status: newStatus as "Active"|"Inactive" } : key));
      else toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } catch (e) { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key permanently?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (data.success) {
        setApiKeys(apiKeys.filter(key => key.id !== id));
        toast({ title: "Deleted", description: "API key revoked." });
      } else toast({ title: "Error", description: data.error, variant: "destructive" });
    } catch (e) { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
  };

  const savePostbackUrl = async () => {
    setIsSavingPostback(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys/postback`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postback_url: globalPostback })
      });
      if ((await response.json()).success) toast({ title: "Saved", description: "Global webhook synchronized." });
      else toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } catch (e) { toast({ title: "Error", description: "Network Error", variant: "destructive" }); }
    setIsSavingPostback(false);
  };

  return (
    <div className="relative min-h-screen pb-20">
      {/* Decorative Background Blur */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-100/50 via-indigo-50/20 to-transparent -z-10 pointer-events-none"></div>
      <div className="absolute top-40 right-10 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 pt-8">
        
        {/* HERO HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-slate-200/60">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-wide uppercase mb-4 shadow-sm">
              <Zap className="w-3.5 h-3.5 fill-indigo-600" /> Developers
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              API & Webhooks
            </h1>
            <p className="text-slate-500 text-lg mt-3 max-w-2xl">
              Programmatic access to your campaigns, intelligent tracking links, and real-time conversion streams.
            </p>
          </div>
          <div className="flex gap-4">
            <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all h-12 px-6" onClick={() => document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth' })}>
              <Code2 className="w-5 h-5 mr-2" /> Read the Docs
            </Button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT: API KEYS (COL SPAN 7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" /> Authentication Keys
                </h2>
                <p className="text-sm text-slate-500 mt-1">Bearer tokens used for authenticating requests.</p>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)} className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-200">
                <Plus className="w-5 h-5 mr-2" /> Create New API
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {apiKeys.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center flex flex-col items-center justify-center bg-slate-50/50">
                  <KeyRound className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="font-bold text-slate-700">No tokens found</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-4">You haven't generated any API keys yet.</p>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-md shadow-indigo-200 text-white font-medium">Create your first key</Button>
                </div>
              ) : apiKeys.map((k) => (
                <div key={k.id} className="relative group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                  <div className={`p-4 rounded-2xl flex-shrink-0 \${k.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 truncate text-lg">{k.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider \${k.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {k.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mb-3">Created • {k.createdAt}</p>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1.5 pl-3 rounded-lg w-full max-w-sm">
                      <code className="text-sm font-mono text-slate-600 font-semibold truncate flex-1 leading-none py-1">
                        {k.key.substring(0, 15)}••••••••••••••••••••
                      </code>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(k.key)} className="h-7 w-7 text-indigo-600 hover:bg-indigo-100 rounded-md shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(k.id, k.status)} className="w-full sm:w-auto h-9 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600">
                      {k.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteApiKey(k.id)} className="w-full sm:w-auto h-9 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: WEBHOOKS (COL SPAN 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <Webhook className="w-6 h-6 text-purple-500" /> Event Webhooks
              </h2>
              <p className="text-sm text-slate-500 mt-1">Receive real-time push data for conversions.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
              
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-bold text-slate-900">Global Postback Endpoint</Label>
                  {isSavingPostback && <span className="text-xs text-indigo-600 font-medium animate-pulse">Syncing...</span>}
                </div>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                  <div className="relative">
                    <Input 
                      value={globalPostback}
                      onChange={e => setGlobalPostback(e.target.value)}
                      placeholder="https://yourserver.com/ping?click={click_id}&pay={payout}"
                      className="font-mono text-sm bg-white border-none shadow-inner h-14 rounded-2xl pl-4 pr-32 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                    <div className="absolute right-2 top-2">
                       <Button onClick={savePostbackUrl} disabled={isSavingPostback} className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md">
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  We fire an HTTP GET to this endpoint immediately when a trackable lead fires in our system. Ensure your server responds with a 200 OK.
                </p>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-8"></div>

              <div>
                <Label className="text-sm font-bold text-slate-900 block mb-3">Manual Postback Trigger (S2S)</Label>
                <div className="bg-slate-900 rounded-2xl p-4 overflow-hidden relative shadow-inner">
                  <div className="flex items-center justify-between mb-2 opacity-80 border-b border-slate-700/50 pb-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse"></span>Get Request</span>
                  </div>
                  <code className="text-xs font-mono text-indigo-200 break-all leading-relaxed block">
                    {API_BASE_URL}/api/v1/postback?click_id=<span className="text-emerald-300">USER</span>&amp;offer_id=<span className="text-emerald-300">TEST</span>&amp;payout=<span className="text-emerald-300">12.5</span>&amp;s1=<span className="text-amber-300">YOUR_API_KEY</span>
                  </code>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* DEVELOPER DOCS */}
        <div id="docs" className="pt-20">
          <div className="bg-slate-950 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="flex items-center gap-4 mb-4">
              <Terminal className="w-8 h-8 text-indigo-400" />
              <h2 className="text-3xl font-bold text-white tracking-tight">Developers Guide</h2>
            </div>
            <p className="text-slate-400 text-lg mb-12 max-w-2xl">Copy and paste these RESTful requests straight into your code to start pulling live data streams to your application.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 relative z-10">
              
              {/* DOC CARD 1 */}
              <div>
                <h3 className="text-xl font-bold text-indigo-300 mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Pull Eligible Offers</h3>
                <p className="text-slate-400 text-sm mb-4">Fetch real-time actionable campaigns programatically.</p>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mb-6">
                  <div className="flex border-b border-slate-800 bg-slate-900/50">
                    <div className="px-4 py-2 border-b-2 border-indigo-500 text-indigo-400 text-xs font-bold uppercase tracking-widest">REQUEST</div>
                  </div>
                  <div className="p-4 bg-slate-950">
                     <code className="text-xs md:text-sm font-mono text-slate-300 flex items-center gap-3">
                       <span className="text-emerald-400 font-bold">GET</span> 
                       <span className="line-clamp-1">{API_BASE_URL}/api/v1/offers?api_key=<span className="text-amber-400">KEY</span></span>
                     </code>
                  </div>
                </div>

                <div className="bg-[#0D1117] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 mx-auto">response.json</span>
                  </div>
                  <pre className="p-5 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed">{`{
  "success": true,
  "offers": [{
    "offer_id": "ML-02113",
    "name": "Finance App Install",
    "payout": 33.0,
    "currency": "USD",
    "tracking_link": "..."
  }]
}`}</pre>
                </div>
              </div>

              {/* DOC CARD 2 */}
              <div>
                <h3 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Stream Analytics</h3>
                <p className="text-slate-400 text-sm mb-4">Export chronological performance data arrays.</p>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mb-6">
                  <div className="flex border-b border-slate-800 bg-slate-900/50">
                    <div className="px-4 py-2 border-b-2 border-purple-500 text-purple-400 text-xs font-bold uppercase tracking-widest">REQUEST</div>
                  </div>
                  <div className="p-4 bg-slate-950 flex flex-col gap-2">
                     <code className="text-xs md:text-sm font-mono text-slate-300 flex items-center gap-3">
                       <span className="text-emerald-400 font-bold">GET</span> 
                       <span className="line-clamp-1">{API_BASE_URL}/v1/report/stats</span>
                     </code>
                     <code className="text-xs text-slate-500 font-mono mt-1 pt-2 border-t border-slate-800/50">
                       Headers: Authorization: Bearer <span className="text-amber-400">KEY</span>
                     </code>
                  </div>
                </div>

                <div className="bg-[#0D1117] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 mx-auto">response.json</span>
                  </div>
                  <pre className="p-5 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed">{`{
  "success": true,
  "stats": [{
    "date": "2026-04-17",
    "impressions": 1500,
    "clicks": 45,
    "device_type": "mobile"
  }]
}`}</pre>
                </div>
              </div>

            </div>

             <div className="mt-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex gap-4 items-start relative z-10">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <div>
                <h4 className="font-bold text-rose-300 mb-1">Rate Limiting Enforced</h4>
                <p className="text-sm text-rose-200/70 leading-relaxed">System allows a maximum burst of 30 programmatic requests per minute. Exceeding operations yield a <code className="bg-rose-500/20 px-1.5 rounded py-0.5 text-rose-300">429 Too Many Requests</code> header.</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* CREATE MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem] border border-slate-200 shadow-2xl p-6">
          <DialogHeader className="mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
               <KeyRound className="w-6 h-6 text-indigo-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900">Create Token</DialogTitle>
            <DialogDescription className="text-slate-500">
              Use a memorable name related to the application you're integrating.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs font-bold text-slate-600 uppercase mb-2 block tracking-wider">Key Label</Label>
            <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. Production Backend" className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 font-medium"/>
          </div>
          <DialogFooter className="mt-6 sm:justify-start gap-2">
            <Button onClick={handleCreateKey} className="w-full bg-slate-900 hover:bg-slate-800 h-12 rounded-xl text-white font-bold shadow-md mb-2 sm:mb-0">Generate Secret</Button>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-full h-12 rounded-xl border-slate-200 font-bold text-slate-600">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default APIAccess;
