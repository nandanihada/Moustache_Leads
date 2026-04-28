import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, RotateCcw, Save } from 'lucide-react';
import { adminOfferApi } from '@/services/adminOfferApi';

const DESC_ICON = 'https://postimg.cc/XB0zjj5r';

interface DescriptionGeneratorProps {
  offerName: string;
  existingDescription?: string;
  vertical?: string;
  offerId?: string; // if provided, enables restore from DB
  originalDescription?: string; // original from DB if available
  onDescriptionSaved: (newDesc: string, originalDesc: string) => void;
}

export function DescriptionGeneratorComponent({
  offerName, existingDescription = '', vertical = '', offerId, originalDescription, onDescriptionSaved,
}: DescriptionGeneratorProps) {
  const [description, setDescription] = useState(existingDescription);
  const [originalDesc] = useState(existingDescription);
  const [dbOriginal] = useState(originalDescription || '');
  const [mode, setMode] = useState<'name_and_desc' | 'name_only'>('name_and_desc');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await adminOfferApi.generateDescription(offerName, existingDescription, vertical, mode);
      if (res.success && res.description) {
        setDescription(res.description);
        setGenerated(true);
      } else {
        setError('No description returned');
      }
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRestore = () => {
    setDescription(originalDesc);
    setGenerated(false);
  };

  const handleSave = () => {
    onDescriptionSaved(description, originalDesc);
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-muted-foreground">Mode:</Label>
        {(['name_and_desc', 'name_only'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              mode === m ? 'bg-blue-100 text-blue-800' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {m === 'name_and_desc' ? 'Name + Description' : 'Name Only'}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          className="text-sm pr-16"
          placeholder="Offer description..."
        />
        <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
          {description.length} chars
        </span>
      </div>

      {/* Generate + Save buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleGenerate} disabled={generating || !offerName.trim()} className="gap-1.5">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="" className="h-4 w-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          {generating ? 'Generating...' : 'Generate with AI'}
        </Button>
        {generated && description !== originalDesc && (
          <Button size="sm" variant="outline" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save Description
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Original description — collapsible */}
      {(originalDesc || dbOriginal) && (
        <div className="border-t pt-2">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showOriginal ? 'rotate-180' : ''}`} />
            Original description
            {generated && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">modified</Badge>}
            {dbOriginal && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-amber-50 text-amber-700 border-amber-200">saved in DB</Badge>}
          </button>
          {showOriginal && (
            <div className="mt-2 p-2 bg-muted/30 rounded border text-xs text-muted-foreground">
              <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">Original (from partner):</p>
              <p className="whitespace-pre-wrap">{dbOriginal || originalDesc || '(empty)'}</p>
              <div className="flex gap-2 mt-2">
                {generated && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={handleRestore}>
                    <RotateCcw className="h-3 w-3" /> Restore to current session
                  </Button>
                )}
                {offerId && dbOriginal && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1 text-amber-700" onClick={async () => {
                    try {
                      await adminOfferApi.restoreOriginalFields(offerId, ['description']);
                      setDescription(dbOriginal);
                      setGenerated(false);
                      onDescriptionSaved(dbOriginal, originalDesc);
                    } catch {}
                  }}>
                    <RotateCcw className="h-3 w-3" /> Restore original in DB
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
