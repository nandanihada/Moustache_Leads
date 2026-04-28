import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, RefreshCw, Check, Upload, Search, ImageIcon, Wand2,
} from 'lucide-react';
import { adminOfferApi } from '@/services/adminOfferApi';

// ─── Moustache Leads stock images ────────────────────────────────────
const ML_IMAGES: { label: string; category: string; url: string }[] = [
  { label: 'Moustache Leads', category: 'LOGO', url: '/logo.png' },
  { label: 'Health', category: 'HEALTH', url: '/category-images/health.png' },
  { label: 'Survey', category: 'SURVEY', url: '/category-images/survey.png' },
  { label: 'Sweepstakes', category: 'SWEEPSTAKES', url: '/category-images/sweepstakes.png' },
  { label: 'Education', category: 'EDUCATION', url: '/category-images/education.png' },
  { label: 'Insurance', category: 'INSURANCE', url: '/category-images/insurance.png' },
  { label: 'Loan', category: 'LOAN', url: '/category-images/loan.png' },
  { label: 'Finance', category: 'FINANCE', url: '/category-images/finance.png' },
  { label: 'Dating', category: 'DATING', url: '/category-images/dating.png' },
  { label: 'Free Trial', category: 'FREE_TRIAL', url: '/category-images/free_trial.png' },
  { label: 'Installs', category: 'INSTALLS', url: '/category-images/installs.png' },
  { label: 'Games', category: 'GAMES_INSTALL', url: '/category-images/games_install.png' },
];

// ─── Props ───────────────────────────────────────────────────────────
interface ImagePickerProps {
  offerName: string;
  description?: string;
  vertical?: string;
  onImageSelected: (url: string, source: 'ai' | 'upload' | 'stock') => void;
}

type Tab = 'ai' | 'upload' | 'stock';

export function ImagePickerComponent({ offerName, description, vertical, onImageSelected }: ImagePickerProps) {
  const [tab, setTab] = useState<Tab>('ai');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  // AI tab state
  const [prompt, setPrompt] = useState(() => {
    const brand = offerName.replace(/\s*\[.*?\]\s*/g, ' ').replace(/\(.*?\)/g, '').trim();
    const v = vertical || '';
    return `Professional affiliate marketing banner for ${brand}, ${v} offer, clean modern flat design, no text, suitable as thumbnail`;
  });
  const [generating, setGenerating] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');

  // Upload tab state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Stock tab state
  const [stockSearch, setStockSearch] = useState('');

  // ─── AI Generate ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setAiError('');
    try {
      const res = await adminOfferApi.generateImage(prompt);
      if (res.success && res.image_url) {
        setAiImageUrl(res.image_url);
        setSelectedUrl(res.image_url);
      } else {
        setAiError('No image returned');
      }
    } catch (err: any) {
      setAiError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ─── File Upload ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadPreview(dataUrl);
      setSelectedUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Confirm ─────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (selectedUrl) {
      const source: 'ai' | 'upload' | 'stock' = tab === 'ai' ? 'ai' : tab === 'upload' ? 'upload' : 'stock';
      onImageSelected(selectedUrl, source);
    }
  };

  const filteredStock = stockSearch
    ? ML_IMAGES.filter(img => img.label.toLowerCase().includes(stockSearch.toLowerCase()) || img.category.toLowerCase().includes(stockSearch.toLowerCase()))
    : ML_IMAGES;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ai', label: 'AI Generated', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { key: 'upload', label: 'Upload', icon: <Upload className="h-3.5 w-3.5" /> },
    { key: 'stock', label: 'Moustache Leads', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-blue-100 text-blue-800 border-b-2 border-blue-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* AI Generated Tab */}
      {tab === 'ai' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="text-xs"
              placeholder="Describe the image you want..."
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={generating || !prompt.trim()} className="gap-1.5">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Generating...' : 'Generate'}
            </Button>
            {aiImageUrl && (
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
            )}
          </div>
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          {aiImageUrl && (
            <div
              className={`relative w-32 h-32 rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                selectedUrl === aiImageUrl ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedUrl(aiImageUrl)}
            >
              <img src={aiImageUrl} alt="AI generated" className="w-full h-full object-cover" />
              {selectedUrl === aiImageUrl && (
                <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {tab === 'upload' && (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Choose from device
          </Button>
          {uploadPreview && (
            <div
              className={`relative w-32 h-32 rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                selectedUrl === uploadPreview ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedUrl(uploadPreview)}
            >
              <img src={uploadPreview} alt="Uploaded" className="w-full h-full object-cover" />
              {selectedUrl === uploadPreview && (
                <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stock Images Tab */}
      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              placeholder="Search categories..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {filteredStock.map(img => (
              <div
                key={img.category}
                className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedUrl === img.url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedUrl(img.url)}
              >
                <img src={img.url} alt={img.label} className="w-full aspect-square object-cover" />
                {selectedUrl === img.url && (
                  <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 truncate px-1">
                  {img.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm button */}
      {selectedUrl && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={selectedUrl} alt="Selected" className="w-10 h-10 rounded border object-cover shrink-0" />
            <span className="text-xs text-muted-foreground truncate">Image selected</span>
          </div>
          <Button size="sm" onClick={handleConfirm} className="gap-1.5 bg-blue-600 hover:bg-blue-700 shrink-0">
            <Check className="h-3.5 w-3.5" /> Use This Image
          </Button>
        </div>
      )}
    </div>
  );
}
