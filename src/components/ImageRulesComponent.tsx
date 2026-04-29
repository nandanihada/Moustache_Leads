/**
 * ImageRulesComponent — Reusable component for managing keyword → image rules.
 * Admin defines rules like "coinbase" → image URL. All offers matching that keyword get that image.
 * Can be imported into Smart Rename modal, offer settings, or any admin page.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Zap, Search } from 'lucide-react';
import { adminOfferApi } from '@/services/adminOfferApi';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';

interface ImageRule {
  id: string;
  keyword: string;
  image_url: string;
  match_count: number;
  created_at: string;
}

interface ImageRulesProps {
  /** Optional: if provided, auto-fills the keyword field */
  defaultKeyword?: string;
  /** Optional: callback when rules are applied to offers */
  onRulesApplied?: (count: number) => void;
}

export function ImageRulesComponent({ defaultKeyword, onRulesApplied }: ImageRulesProps) {
  const [rules, setRules] = useState<ImageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState(defaultKeyword || '');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerKeyword, setPickerKeyword] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState('');

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await adminOfferApi.getImageRules();
      setRules(res.rules || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const handleCreateRule = (imageUrl: string) => {
    if (!pickerKeyword.trim()) return;
    adminOfferApi.createImageRule(pickerKeyword.trim(), imageUrl).then(() => {
      setShowPicker(false);
      setPickerKeyword('');
      setNewKeyword('');
      fetchRules();
    }).catch(() => {});
  };

  const handleDelete = async (ruleId: string) => {
    await adminOfferApi.deleteImageRule(ruleId);
    fetchRules();
  };

  const handleApplyAll = async () => {
    setApplying(true);
    setApplyResult('');
    try {
      const res = await adminOfferApi.applyImageRules();
      setApplyResult(res.message || `Applied to ${res.applied} offers`);
      onRulesApplied?.(res.applied);
      fetchRules();
    } catch {
      setApplyResult('Failed to apply rules');
    }
    setApplying(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <img src="https://i.postimg.cc/rwr2vdT6/polaroid.png" alt="" className="w-4 h-4 object-contain" />
          Image Rules
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{rules.length} rules</Badge>
        </Label>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={handleApplyAll} disabled={applying || rules.length === 0} className="gap-1 text-[10px] h-7">
            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Apply All Rules
          </Button>
        </div>
      </div>

      {applyResult && <p className="text-xs text-green-600">{applyResult}</p>}

      {/* Add new rule */}
      <div className="flex items-center gap-2">
        <Input
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          placeholder="Enter keyword (e.g. coinbase)"
          className="h-7 text-xs flex-1"
        />
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1"
          disabled={!newKeyword.trim()}
          onClick={() => { setPickerKeyword(newKeyword.trim()); setShowPicker(true); }}>
          <Plus className="h-3 w-3" /> Add Rule
        </Button>
      </div>

      {/* Image picker for new rule */}
      {showPicker && (
        <div className="p-2 border rounded-lg bg-muted/30">
          <p className="text-xs font-medium mb-2">Pick image for keyword: <span className="text-blue-700">"{pickerKeyword}"</span></p>
          <ImagePickerComponent
            offerName={pickerKeyword}
            onImageSelected={(url) => handleCreateRule(url)}
          />
          <Button size="sm" variant="ghost" className="mt-2 text-[10px]" onClick={() => setShowPicker(false)}>Cancel</Button>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading rules...</div>
      ) : rules.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2">No image rules yet. Add a keyword and pick an image to create one.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center gap-2 p-1.5 border rounded-lg bg-white dark:bg-gray-900">
              <img src={rule.image_url} alt="" className="w-8 h-8 rounded border object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">{rule.keyword}</span>
                  {rule.match_count > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0">{rule.match_count} matched</Badge>}
                </div>
              </div>
              <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
