import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Save } from 'lucide-react';
import { adminOfferApi } from '@/services/adminOfferApi';

const VERTICALS = [
  { id: 'HEALTH', label: 'Health', icon: '💊' },
  { id: 'SURVEY', label: 'Survey', icon: '📋' },
  { id: 'SWEEPSTAKES', label: 'Sweepstakes', icon: '🎰' },
  { id: 'EDUCATION', label: 'Education', icon: '📚' },
  { id: 'INSURANCE', label: 'Insurance', icon: '🛡️' },
  { id: 'LOAN', label: 'Loan', icon: '💳' },
  { id: 'FINANCE', label: 'Finance', icon: '💰' },
  { id: 'DATING', label: 'Dating', icon: '❤️' },
  { id: 'FREE_TRIAL', label: 'Free Trial', icon: '🎁' },
  { id: 'INSTALLS', label: 'Installs', icon: '📲' },
  { id: 'GAMES_INSTALL', label: 'Games', icon: '🎮' },
];

interface VerticalSuggesterProps {
  offerName: string;
  description?: string;
  currentVertical?: string;
  offerId?: string; // if provided, enables restore from DB
  originalVertical?: string; // original from DB if available
  onVerticalSaved: (newVertical: string, originalVertical: string) => void;
}

export function VerticalSuggesterComponent({
  offerName, description = '', currentVertical = '', offerId, originalVertical: dbOriginalVertical, onVerticalSaved,
}: VerticalSuggesterProps) {
  const [selected, setSelected] = useState(currentVertical.toUpperCase());
  const [originalVertical] = useState(currentVertical.toUpperCase());
  const [aiSuggested, setAiSuggested] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');

  const handleSuggest = async () => {
    setSuggesting(true);
    setError('');
    try {
      const res = await adminOfferApi.suggestVertical(offerName, description);
      if (res.success && res.vertical) {
        setAiSuggested(res.vertical);
        setSelected(res.vertical);
      } else {
        setError('No suggestion returned');
      }
    } catch (err: any) {
      setError(err.message || 'Suggestion failed');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = () => {
    onVerticalSaved(selected, originalVertical);
  };

  return (
    <div className="space-y-3">
      {/* Current + AI suggestion */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSuggest} disabled={suggesting || !offerName.trim()} className="gap-1.5">
          {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <img src="https://i.postimg.cc/bw1GTwsg/categorization.png" alt="" className="h-4 w-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          {suggesting ? 'Analyzing...' : 'Suggest Vertical'}
        </Button>
        {aiSuggested && (
          <span className="text-[11px] text-muted-foreground">
            AI suggests: <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200">{aiSuggested}</Badge>
          </span>
        )}
        {selected !== originalVertical && selected && (
          <Button size="sm" variant="outline" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save Vertical
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Vertical grid — admin can pick manually */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {VERTICALS.map(v => (
          <button
            key={v.id}
            onClick={() => setSelected(v.id)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              selected === v.id
                ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-300 dark:bg-blue-950/30 dark:text-blue-300'
                : 'border-gray-200 text-muted-foreground hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700'
            }`}
          >
            <span>{v.icon}</span>
            <span className="truncate">{v.label}</span>
            {selected === v.id && <Check className="h-3 w-3 ml-auto text-blue-600 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Original vertical indicator */}
      {originalVertical && originalVertical !== selected && (
        <p className="text-[10px] text-muted-foreground">
          Original: <span className="font-medium">{originalVertical}</span>
          <button onClick={() => setSelected(originalVertical)} className="ml-1 text-blue-600 hover:underline">restore</button>
        </p>
      )}
      {offerId && dbOriginalVertical && dbOriginalVertical !== selected && (
        <p className="text-[10px] text-amber-700">
          DB Original: <span className="font-medium">{dbOriginalVertical}</span>
          <button onClick={async () => {
            try {
              await adminOfferApi.restoreOriginalFields(offerId, ['vertical']);
              setSelected(dbOriginalVertical);
              onVerticalSaved(dbOriginalVertical, originalVertical);
            } catch {}
          }} className="ml-1 text-amber-600 hover:underline">restore from DB</button>
        </p>
      )}
    </div>
  );
}
