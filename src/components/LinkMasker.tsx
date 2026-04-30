/**
 * LinkMasker — Reusable link masking component
 * Uses shadcn Dialog to avoid all outside-click/portal issues.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Copy, Check } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

const MASK_ICON_URL = 'https://i.postimg.cc/Dy2Q5DKp/healthcare.png';

interface LinkMaskerProps {
  offerId?: string;
  offerName?: string;
  label?: string;
  onMasked?: (maskedUrl: string, originalUrl: string, linkId: string) => void;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  className?: string;
}

export default function LinkMasker({
  offerId = '', offerName = '', label = '', onMasked,
  size = 'md', tooltip = 'Mask a link', className = '',
}: LinkMaskerProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [maskedUrl, setMaskedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem('token');

  const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  const handleOpen = () => {
    setUrl(''); setMaskedUrl(''); setCopied(false);
    setOpen(true);
  };

  const handleMask = async () => {
    if (!url.trim()) { toast.error('Please paste a URL first'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/mask-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim(), offer_id: offerId, offer_name: offerName, label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMaskedUrl(data.masked_url);
      toast.success('Link masked successfully');
      if (onMasked) onMasked(data.masked_url, data.original_url, data.link_id);
    } catch (err: any) { toast.error(err.message || 'Failed to mask link'); }
    finally { setLoading(false); }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(maskedUrl); } catch {
      const inp = document.createElement('input'); inp.value = maskedUrl;
      document.body.appendChild(inp); inp.select(); document.execCommand('copy'); document.body.removeChild(inp);
    }
    setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" onClick={handleOpen}
        className={`inline-flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors p-1 ${className}`}
        title={tooltip}>
        <img src={MASK_ICON_URL} alt="Mask Link" className={`${iconSize} object-contain`} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <img src={MASK_ICON_URL} alt="" className="w-5 h-5" />
              Mask Link
            </DialogTitle>
          </DialogHeader>

          {(offerId || offerName) && (
            <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
              Linked to: <span className="font-medium text-foreground">{offerName || offerId}</span>
            </div>
          )}

          {!maskedUrl ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Paste any URL</label>
                <Input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com/offer-page" className="mt-1" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMask(); } }} />
              </div>
              <Button onClick={handleMask} disabled={loading || !url.trim()}
                className="w-full gap-2 bg-gradient-to-r from-orange-500 to-gray-900 hover:from-orange-600 hover:to-gray-800 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <img src={MASK_ICON_URL} alt="" className="h-4 w-4" />}
                Mask It
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium uppercase">Original</label>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{url}</p>
              </div>
              <div>
                <label className="text-[10px] text-green-600 font-semibold uppercase">Masked Link ✓</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <code className="flex-1 text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2.5 py-2 rounded-md border border-green-200 dark:border-green-800 truncate">
                    {maskedUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 px-2.5 shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Every click is tracked. View analytics in Tracking → Masked Links.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => { setUrl(''); setMaskedUrl(''); }}>
                  Mask Another
                </Button>
                <Button size="sm" className="flex-1 text-xs" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
