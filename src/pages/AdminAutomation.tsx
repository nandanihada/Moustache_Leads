import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Play, CheckCircle, XCircle, Clock, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getAuthToken } from '@/utils/cookies';

interface ServiceInfo {
  name: string;
  status: 'running' | 'manual' | 'disabled';
  type: string;
  description: string;
}

interface AutomationStatus {
  services: ServiceInfo[];
  total_running: number;
  total_manual: number;
  total_disabled: number;
  estimated_memory_mb: number;
}

export default function AdminAutomation() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningInactivity, setRunningInactivity] = useState(false);
  const [runningInvoice, setRunningInvoice] = useState(false);
  const [lastInactivityResult, setLastInactivityResult] = useState<any>(null);
  const [lastInvoiceResult, setLastInvoiceResult] = useState<any>(null);

  const baseUrl = getApiBaseUrl();
  const token = getAuthToken();

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/admin/automation/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch automation status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const runInactivityCheck = async () => {
    setRunningInactivity(true);
    setLastInactivityResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/admin/automation/run-inactivity-check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLastInactivityResult(data);
        toast.success(`Inactivity check complete: ${data.deactivated_count} offers deactivated out of ${data.checked} checked`);
      } else {
        toast.error(data.error || 'Failed to run inactivity check');
      }
    } catch (e: any) {
      toast.error('Network error: ' + e.message);
    } finally {
      setRunningInactivity(false);
    }
  };

  const runInvoiceGeneration = async () => {
    setRunningInvoice(true);
    setLastInvoiceResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/admin/automation/run-invoice-generation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLastInvoiceResult(data);
        toast.success('Invoice generation completed');
      } else {
        toast.error(data.error || 'Failed to generate invoices');
      }
    } catch (e: any) {
      toast.error('Network error: ' + e.message);
    } finally {
      setRunningInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Automation</h1>
        <p className="text-muted-foreground mt-1">
          Background services status and manual triggers. Memory usage: ~{status?.estimated_memory_mb || 220}MB / 512MB
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{status?.total_running || 0}</div>
          <div className="text-sm text-green-600 dark:text-green-500">Running</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{status?.total_manual || 0}</div>
          <div className="text-sm text-blue-600 dark:text-blue-500">Manual (Button)</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-400">{status?.total_disabled || 0}</div>
          <div className="text-sm text-gray-600 dark:text-gray-500">Disabled</div>
        </div>
      </div>

      {/* Manual Action Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Manual Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inactivity Check Button */}
          <div className="border rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Offer Inactivity Check</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Scans all 20,000+ active offers and deactivates any with zero clicks in the last 30 days. Run once a week.
            </p>
            <button
              onClick={runInactivityCheck}
              disabled={runningInactivity}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {runningInactivity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {runningInactivity ? 'Running...' : 'Run Inactivity Check'}
            </button>
            {lastInactivityResult && (
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <div><strong>Checked:</strong> {lastInactivityResult.checked} offers</div>
                <div><strong>Deactivated:</strong> {lastInactivityResult.deactivated_count} offers</div>
                {lastInactivityResult.deactivated_offers?.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {lastInactivityResult.deactivated_offers.map((o: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground">• {o.name} ({o.offer_id})</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoice Generation Button */}
          <div className="border rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Generate Invoices</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Generates monthly invoices for all publishers. Click on the 1st of each month.
            </p>
            <button
              onClick={runInvoiceGeneration}
              disabled={runningInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {runningInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {runningInvoice ? 'Generating...' : 'Generate Invoices'}
            </button>
            {lastInvoiceResult && (
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <div><strong>Status:</strong> {lastInvoiceResult.message}</div>
                <div><strong>Run at:</strong> {new Date(lastInvoiceResult.run_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Status Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Services</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Service</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {status?.services?.map((service, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{service.name}</td>
                  <td className="p-3">
                    {service.status === 'running' && (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3.5 w-3.5" /> Running
                      </span>
                    )}
                    {service.status === 'manual' && (
                      <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Clock className="h-3.5 w-3.5" /> Manual
                      </span>
                    )}
                    {service.status === 'disabled' && (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <XCircle className="h-3.5 w-3.5" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{service.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
