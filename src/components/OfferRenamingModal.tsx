import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  RefreshCw,
  X,
  Plus,
  ArrowRight,
  Save,
  Edit3,
  Check,
  Sparkles,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { Offer, adminOfferApi } from '@/services/adminOfferApi';

// ─── Types ───────────────────────────────────────────────────────────
export interface ExtractedParts {
  brand: string;
  amount: string;
  geo: string;
  optin: string;
  model: string;
  incent: string;
  proof: string;
  extra: string;
}

type PartKey = keyof ExtractedParts;

interface TokenState {
  value: string;
  enabled: boolean;
  inferred?: boolean;
}

interface OfferTokens {
  offerId: string;
  originalName: string;
  tokens: Record<PartKey, TokenState>;
  composedName: string;
  manualOverride: string; // if user manually edits the composed name
}

interface TemplatePreset {
  name: string;
  template: string;
}

const PART_KEYS: PartKey[] = ['brand', 'amount', 'geo', 'optin', 'model', 'incent', 'proof', 'extra'];

const PART_LABELS: Record<PartKey, string> = {
  brand: 'Brand',
  amount: 'Amount',
  geo: 'GEO',
  optin: 'Opt-in',
  model: 'Model',
  incent: 'Incentive',
  proof: 'Proof',
  extra: 'Extra',
};

const PART_COLORS: Record<PartKey, string> = {
  brand: 'bg-blue-100 text-blue-800 border-blue-300',
  amount: 'bg-green-100 text-green-800 border-green-300',
  geo: 'bg-purple-100 text-purple-800 border-purple-300',
  optin: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  model: 'bg-orange-100 text-orange-800 border-orange-300',
  incent: 'bg-red-100 text-red-800 border-red-300',
  proof: 'bg-pink-100 text-pink-800 border-pink-300',
  extra: 'bg-gray-100 text-gray-800 border-gray-300',
};

// ─── localStorage keys ───────────────────────────────────────────────
const LS_TEMPLATE_KEY = 'offer_rename_template';
const LS_PRESETS_KEY = 'offer_rename_presets';

// ─── AI Extraction (client-side pattern matching) ────────────────────

const COUNTRY_CODES = new Set([
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI','KH','CM','CA','CV','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VE','VN','YE','ZM','ZW',
  'UK','USA','UAE','KSA',
]);

const OPTIN_PATTERNS = /\b(SOI|DOI|1[- ]?Click|2[- ]?Click|single[- ]?opt[- ]?in|double[- ]?opt[- ]?in)\b/i;
const MODEL_PATTERNS = /\b(CPL|CPA|CPI|CPE|CPS|CPC|CPM|RevShare)\b/i;
const INCENT_PATTERNS = /\b(Non[- ]?Incent(?:ive)?|Incent(?:ive)?|non[- ]?incentivized|incentivized)\b/i;
const PROOF_PATTERNS = /\b(No[- ]?Proof|Proof|proof[- ]?required|no[- ]?proof[- ]?required)\b/i;
const AMOUNT_PATTERNS = /(?:[\$€£¥₹]\s?\d[\d,.]*|\d[\d,.]*\s?[\$€£¥₹]|\d[\d,.]*\s?(?:USD|EUR|GBP))/i;

const VERTICAL_TO_MODEL: Record<string, string> = {
  sweepstakes: 'CPL',
  sweeps: 'CPL',
  survey: 'CPL',
  finance: 'CPL',
  trading: 'CPL',
  dating: 'CPL',
  insurance: 'CPL',
  loan: 'CPL',
  education: 'CPL',
  health: 'CPA',
  installs: 'CPI',
  games_install: 'CPI',
  free_trial: 'CPA',
};

function extractPartsFromOffer(offer: Offer): ExtractedParts {
  const name = offer.name || '';
  const desc = offer.description || '';
  const vertical = (offer.vertical || offer.category || '').toLowerCase();
  const apiGeo = (offer.countries || []).map(c => c.toUpperCase());

  const parts: ExtractedParts = { brand: '', amount: '', geo: '', optin: '', model: '', incent: '', proof: '', extra: '' };

  // Split name into tokens by common separators
  const nameTokens = name.split(/[-_|/\\,\s]+/).filter(Boolean);
  const usedTokens = new Set<number>();

  // 1. GEO — collect ALL geo codes from API field and name, comma-separated
  const allGeos: string[] = [];
  if (apiGeo.length > 0) {
    allGeos.push(...apiGeo);
  }
  nameTokens.forEach((t, i) => {
    const upper = t.toUpperCase();
    if (COUNTRY_CODES.has(upper)) {
      if (!allGeos.includes(upper)) allGeos.push(upper);
      usedTokens.add(i);
    }
  });
  parts.geo = allGeos.join(', ');

  // 2. Opt-in
  const optinMatch = name.match(OPTIN_PATTERNS) || desc.match(OPTIN_PATTERNS);
  if (optinMatch) {
    parts.optin = optinMatch[1].toUpperCase().replace(/\s+/g, '');
    nameTokens.forEach((t, i) => { if (OPTIN_PATTERNS.test(t)) usedTokens.add(i); });
  }

  // 3. Model
  const modelMatch = name.match(MODEL_PATTERNS) || desc.match(MODEL_PATTERNS);
  if (modelMatch) {
    parts.model = modelMatch[1].toUpperCase();
    nameTokens.forEach((t, i) => { if (MODEL_PATTERNS.test(t)) usedTokens.add(i); });
  }

  // 4. Incentive
  const incentMatch = name.match(INCENT_PATTERNS) || desc.match(INCENT_PATTERNS);
  if (incentMatch) {
    const raw = incentMatch[1].toLowerCase();
    parts.incent = raw.startsWith('non') ? 'Non-Incent' : 'Incent';
    nameTokens.forEach((t, i) => { if (INCENT_PATTERNS.test(t)) usedTokens.add(i); });
  }

  // 5. Proof
  const proofMatch = name.match(PROOF_PATTERNS) || desc.match(PROOF_PATTERNS);
  if (proofMatch) {
    const raw = proofMatch[1].toLowerCase();
    parts.proof = raw.startsWith('no') ? 'No-Proof' : 'Proof';
    nameTokens.forEach((t, i) => { if (PROOF_PATTERNS.test(t)) usedTokens.add(i); });
  }

  // 6. Amount
  const amountMatch = name.match(AMOUNT_PATTERNS) || desc.match(AMOUNT_PATTERNS);
  if (amountMatch) {
    parts.amount = amountMatch[0].trim();
    // Mark tokens that are part of the amount
    nameTokens.forEach((t, i) => {
      if (/[\$€£¥₹]/.test(t) || (AMOUNT_PATTERNS.test(t))) usedTokens.add(i);
    });
  }

  // 7. Brand — first unused token(s) that look like a brand name (capitalized, not a known pattern)
  const brandTokens: string[] = [];
  for (let i = 0; i < nameTokens.length; i++) {
    if (usedTokens.has(i)) continue;
    const t = nameTokens[i];
    // Skip pure numbers
    if (/^\d+$/.test(t)) continue;
    // If it looks like a word (starts with letter), it's likely brand
    if (/^[A-Za-z]/.test(t) && !MODEL_PATTERNS.test(t) && !OPTIN_PATTERNS.test(t) && !INCENT_PATTERNS.test(t) && !PROOF_PATTERNS.test(t) && !COUNTRY_CODES.has(t.toUpperCase())) {
      brandTokens.push(t);
      usedTokens.add(i);
      // Take up to 3 consecutive brand-like tokens
      if (brandTokens.length >= 3) break;
    } else if (brandTokens.length > 0) {
      break; // Stop collecting brand tokens once we hit a non-brand token
    }
  }
  parts.brand = brandTokens.join(' ');

  // 8. Extra — only short standalone descriptors from remaining tokens
  // Filter out filler words and number-only tokens
  const FILLER_WORDS = new Set(['only', 'and', 'the', 'for', 'with', 'from', 'your', 'our', 'new', 'free', 'get', 'now', 'best', 'top', 'just', 'more', 'all', 'any', 'app', 'web', 'int']);
  const extraTokens: string[] = [];
  nameTokens.forEach((t, i) => {
    if (!usedTokens.has(i) && !/^\d+$/.test(t) && t.length <= 20 && !FILLER_WORDS.has(t.toLowerCase())) {
      extraTokens.push(t);
    }
  });
  // Keep meaningful short extras (max 3 words)
  parts.extra = extraTokens.slice(0, 3).join(' ');

  // 9. Infer model from vertical if not found — mark as inferred
  if (!parts.model && vertical && VERTICAL_TO_MODEL[vertical]) {
    parts.model = VERTICAL_TO_MODEL[vertical];
    // Return a special marker so the caller can set inferred=true on the token
    (parts as any)._inferredModel = true;
  }

  return parts;
}

// ─── Template Composition ────────────────────────────────────────────

function buildTokensFromParts(parts: ExtractedParts): Record<PartKey, TokenState> {
  const tokens: Record<PartKey, TokenState> = {} as any;
  for (const key of PART_KEYS) {
    tokens[key] = {
      value: parts[key],
      // Extra starts OFF by default — it's a suggestion, manager toggles ON if wanted
      enabled: key === 'extra' ? false : !!parts[key],
      inferred: key === 'model' && !!(parts as any)._inferredModel,
    };
  }
  return tokens;
}

function composeNameFromTemplate(template: string, tokens: Record<PartKey, TokenState>): string {
  if (!template.trim()) return '';

  // Step 1: Build a list of segments — alternating between literal separators and placeholder values
  // Parse the template into parts: [{type:'text',value:'-'}, {type:'placeholder',key:'brand'}, ...]
  const segments: Array<{ type: 'separator' | 'value'; text: string }> = [];
  const placeholderRegex = /\{(brand|amount|geo|optin|model|incent|proof|extra)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = placeholderRegex.exec(template)) !== null) {
    // Text before this placeholder is a separator
    if (match.index > lastIndex) {
      segments.push({ type: 'separator', text: template.slice(lastIndex, match.index) });
    }
    const key = match[1] as PartKey;
    const token = tokens[key];
    let value = token && token.enabled && token.value ? token.value : '';
    // For GEO: if multi-value (comma-separated), join with /
    if (key === 'geo' && value && value.includes(',')) {
      value = value.split(/[,\s]+/).filter(Boolean).join('/');
    }
    segments.push({ type: 'value', text: value });
    lastIndex = match.index + match[0].length;
  }
  // Trailing text after last placeholder
  if (lastIndex < template.length) {
    segments.push({ type: 'separator', text: template.slice(lastIndex) });
  }

  // Step 2: Build result — only include a separator if it sits between two non-empty values
  // First, filter out empty values and merge adjacent separators
  const filtered: typeof segments = [];
  for (const seg of segments) {
    if (seg.type === 'value' && !seg.text) continue; // skip empty values
    if (seg.type === 'separator' && filtered.length > 0 && filtered[filtered.length - 1].type === 'separator') {
      // Merge adjacent separators (keep the first one)
      continue;
    }
    filtered.push(seg);
  }

  // Now build the result: separators only between values
  const resultParts: string[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const seg = filtered[i];
    if (seg.type === 'value') {
      resultParts.push(seg.text);
    } else {
      // Separator: only include if previous AND next are values
      const prev = i > 0 ? filtered[i - 1] : null;
      const next = i < filtered.length - 1 ? filtered[i + 1] : null;
      if (prev && prev.type === 'value' && next && next.type === 'value') {
        resultParts.push(seg.text);
      }
    }
  }

  return resultParts.join('').trim();
}

// ─── Component ───────────────────────────────────────────────────────
interface OfferRenamingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOffers: Offer[];
  onApply: (renames: Array<{ offer_id: string; new_name: string; original_name: string }>) => Promise<void>;
}

export function OfferRenamingModal({ open, onOpenChange, selectedOffers, onApply }: OfferRenamingModalProps) {
  // Mode: bulk vs per-offer
  const [mode, setMode] = useState<'bulk' | 'per-offer'>('bulk');

  // Template
  const [template, setTemplate] = useState(() => {
    return localStorage.getItem(LS_TEMPLATE_KEY) || '{brand} {amount} {geo} {optin}';
  });

  // Presets
  const [presets, setPresets] = useState<TemplatePreset[]>(() => {
    try {
      const saved = localStorage.getItem(LS_PRESETS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // Bulk mode: single token set for all offers
  const [bulkTokens, setBulkTokens] = useState<Record<PartKey, TokenState>>(() => createEmptyTokens());

  // Per-offer mode: individual token sets
  const [offerTokensMap, setOfferTokensMap] = useState<Record<string, OfferTokens>>({});

  // Manual overrides for composed names (per-offer)
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  // Editing state
  const [editingToken, setEditingToken] = useState<{ offerId?: string; key: PartKey } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingComposed, setEditingComposed] = useState<string | null>(null);
  const [editingComposedValue, setEditingComposedValue] = useState('');

  // Adding missing token
  const [addingToken, setAddingToken] = useState<{ offerId?: string; key: PartKey } | null>(null);
  const [addingValue, setAddingValue] = useState('');

  // Applying state
  const [applying, setApplying] = useState(false);

  function createEmptyTokens(): Record<PartKey, TokenState> {
    return PART_KEYS.reduce((acc, key) => {
      acc[key] = { value: '', enabled: true };
      return acc;
    }, {} as Record<PartKey, TokenState>);
  }

  // Save template to localStorage
  useEffect(() => {
    localStorage.setItem(LS_TEMPLATE_KEY, template);
  }, [template]);

  // Save presets to localStorage
  useEffect(() => {
    localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  // Reset state when modal opens with new offers
  useEffect(() => {
    if (open) {
      setExtracted(false);
      setManualOverrides({});
      setEditingToken(null);
      setEditingComposed(null);
      setAddingToken(null);
    }
  }, [open, selectedOffers]);

  // ─── Extraction ──────────────────────────────────────────────────
  const runExtraction = useCallback(() => {
    setExtracting(true);

    // Try AI extraction via backend first, fall back to local regex
    const offersPayload = selectedOffers.map(o => ({
      offer_id: o.offer_id,
      name: o.name || '',
      description: o.description || '',
      vertical: o.vertical || o.category || '',
      category: o.category || '',
      countries: o.countries || [],
    }));

    adminOfferApi.aiExtractParts(offersPayload)
      .then(response => {
        const extractions = response.extractions;

        if (mode === 'bulk') {
          // Use first offer's AI extraction for bulk mode
          if (selectedOffers.length > 0) {
            const offerId = selectedOffers[0].offer_id;
            const aiResult = extractions[offerId];
            if (aiResult) {
              const tokens: Record<PartKey, TokenState> = {} as any;
              for (const key of PART_KEYS) {
                tokens[key] = {
                  value: aiResult[key as keyof typeof aiResult] as string || '',
                  enabled: key === 'extra' ? false : !!(aiResult[key as keyof typeof aiResult]),
                  inferred: key === 'model' && aiResult.inferred_model,
                };
              }
              setBulkTokens(tokens);
            } else {
              // Fallback to local extraction for this offer
              setBulkTokens(buildTokensFromParts(extractPartsFromOffer(selectedOffers[0])));
            }
          }
        } else {
          // Per-offer: each offer gets its own AI-extracted tokens
          const map: Record<string, OfferTokens> = {};
          for (const offer of selectedOffers) {
            const aiResult = extractions[offer.offer_id];
            let tokens: Record<PartKey, TokenState>;
            if (aiResult) {
              tokens = {} as any;
              for (const key of PART_KEYS) {
                tokens[key] = {
                  value: aiResult[key as keyof typeof aiResult] as string || '',
                  enabled: key === 'extra' ? false : !!(aiResult[key as keyof typeof aiResult]),
                  inferred: key === 'model' && aiResult.inferred_model,
                };
              }
            } else {
              tokens = buildTokensFromParts(extractPartsFromOffer(offer));
            }
            map[offer.offer_id] = {
              offerId: offer.offer_id,
              originalName: offer.name,
              tokens,
              composedName: '',
              manualOverride: '',
            };
          }
          setOfferTokensMap(map);
        }

        setExtracted(true);
        setExtracting(false);
      })
      .catch(() => {
        // AI failed — fall back to local regex extraction silently
        if (mode === 'bulk') {
          if (selectedOffers.length > 0) {
            setBulkTokens(buildTokensFromParts(extractPartsFromOffer(selectedOffers[0])));
          }
        } else {
          const map: Record<string, OfferTokens> = {};
          for (const offer of selectedOffers) {
            map[offer.offer_id] = {
              offerId: offer.offer_id,
              originalName: offer.name,
              tokens: buildTokensFromParts(extractPartsFromOffer(offer)),
              composedName: '',
              manualOverride: '',
            };
          }
          setOfferTokensMap(map);
        }
        setExtracted(true);
        setExtracting(false);
      });
  }, [mode, selectedOffers]);

  // Auto-extract on open
  useEffect(() => {
    if (open && selectedOffers.length > 0 && !extracted) {
      runExtraction();
    }
  }, [open, selectedOffers, extracted, runExtraction]);

  // ─── Composed names (live preview) ───────────────────────────────
  const previewList = useMemo(() => {
    return selectedOffers.map(offer => {
      const offerId = offer.offer_id;

      // Check manual override first
      if (manualOverrides[offerId]) {
        return {
          offerId,
          originalName: offer.name,
          composedName: manualOverrides[offerId],
        };
      }

      const tokens = mode === 'bulk' ? bulkTokens : offerTokensMap[offerId]?.tokens;
      if (!tokens) {
        return { offerId, originalName: offer.name, composedName: '' };
      }

      return {
        offerId,
        originalName: offer.name,
        composedName: composeNameFromTemplate(template, tokens),
      };
    });
  }, [selectedOffers, mode, bulkTokens, offerTokensMap, template, manualOverrides]);

  // ─── Token actions ───────────────────────────────────────────────
  const toggleToken = (key: PartKey, offerId?: string) => {
    if (mode === 'bulk' || !offerId) {
      setBulkTokens(prev => ({
        ...prev,
        [key]: { ...prev[key], enabled: !prev[key].enabled },
      }));
    } else {
      setOfferTokensMap(prev => {
        const offerData = prev[offerId];
        if (!offerData) return prev;
        return {
          ...prev,
          [offerId]: {
            ...offerData,
            tokens: {
              ...offerData.tokens,
              [key]: { ...offerData.tokens[key], enabled: !offerData.tokens[key].enabled },
            },
          },
        };
      });
    }
  };

  const startEditToken = (key: PartKey, offerId?: string) => {
    const tokens = mode === 'bulk' || !offerId ? bulkTokens : offerTokensMap[offerId]?.tokens;
    if (!tokens) return;
    setEditingToken({ offerId, key });
    setEditingValue(tokens[key].value);
  };

  const saveEditToken = () => {
    if (!editingToken) return;
    const { key, offerId } = editingToken;

    if (mode === 'bulk' || !offerId) {
      setBulkTokens(prev => ({
        ...prev,
        [key]: { ...prev[key], value: editingValue, enabled: true },
      }));
    } else {
      setOfferTokensMap(prev => {
        const offerData = prev[offerId];
        if (!offerData) return prev;
        return {
          ...prev,
          [offerId]: {
            ...offerData,
            tokens: {
              ...offerData.tokens,
              [key]: { ...offerData.tokens[key], value: editingValue, enabled: true },
            },
          },
        };
      });
    }
    setEditingToken(null);
    setEditingValue('');
  };

  const deleteToken = (key: PartKey, offerId?: string) => {
    if (mode === 'bulk' || !offerId) {
      setBulkTokens(prev => ({
        ...prev,
        [key]: { value: '', enabled: false },
      }));
    } else {
      setOfferTokensMap(prev => {
        const offerData = prev[offerId];
        if (!offerData) return prev;
        return {
          ...prev,
          [offerId]: {
            ...offerData,
            tokens: {
              ...offerData.tokens,
              [key]: { value: '', enabled: false },
            },
          },
        };
      });
    }
  };

  const addMissingToken = () => {
    if (!addingToken || !addingValue.trim()) return;
    const { key, offerId } = addingToken;

    if (mode === 'bulk' || !offerId) {
      setBulkTokens(prev => ({
        ...prev,
        [key]: { value: addingValue.trim(), enabled: true },
      }));
    } else {
      setOfferTokensMap(prev => {
        const offerData = prev[offerId];
        if (!offerData) return prev;
        return {
          ...prev,
          [offerId]: {
            ...offerData,
            tokens: {
              ...offerData.tokens,
              [key]: { value: addingValue.trim(), enabled: true },
            },
          },
        };
      });
    }
    setAddingToken(null);
    setAddingValue('');
  };

  // ─── Preset actions ──────────────────────────────────────────────
  const savePreset = () => {
    if (!newPresetName.trim()) return;
    setPresets(prev => [...prev.filter(p => p.name !== newPresetName.trim()), { name: newPresetName.trim(), template }]);
    setNewPresetName('');
    setShowPresetInput(false);
  };

  const deletePreset = (name: string) => {
    setPresets(prev => prev.filter(p => p.name !== name));
  };

  // ─── Apply ───────────────────────────────────────────────────────
  const handleApply = async () => {
    setApplying(true);
    try {
      const renames = previewList
        .filter(p => p.composedName && p.composedName !== p.originalName)
        .map(p => ({
          offer_id: p.offerId,
          new_name: p.composedName,
          original_name: p.originalName,
        }));

      if (renames.length === 0) {
        setApplying(false);
        return;
      }

      await onApply(renames);
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setApplying(false);
    }
  };

  // ─── Render helpers ──────────────────────────────────────────────
  const renderTokenChips = (tokens: Record<PartKey, TokenState>, offerId?: string) => {
    const activeTokens = PART_KEYS.filter(k => tokens[k].value);
    const missingTokens = PART_KEYS.filter(k => !tokens[k].value);

    // Split multi-value GEO into individual items for rendering
    const geoValues = tokens.geo?.value ? tokens.geo.value.split(/[,\s]+/).filter(Boolean).map(g => g.trim()) : [];
    const hasMultiGeo = geoValues.length > 1;

    // Track which individual geo codes are disabled (stored as comma-separated in a special state)
    // For simplicity, we use the token enabled flag for all geos together,
    // but render them as individual chips that can be toggled

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {activeTokens.map(key => {
          const token = tokens[key];
          const isEditing = editingToken?.key === key && editingToken?.offerId === offerId;

          if (isEditing) {
            return (
              <div key={key} className="flex items-center gap-1">
                <Input
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  className="h-7 w-28 text-xs"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEditToken(); if (e.key === 'Escape') setEditingToken(null); }}
                />
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={saveEditToken}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            );
          }

          // For GEO with multiple values, render each country as a separate chip
          if (key === 'geo' && hasMultiGeo) {
            return geoValues.map((geoCode, gi) => (
              <div
                key={`geo-${gi}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  token.enabled ? PART_COLORS.geo : 'bg-gray-50 text-gray-400 border-gray-200 line-through opacity-60'
                }`}
              >
                <span className="font-medium text-[10px] uppercase opacity-70">GEO:</span>
                <span>{geoCode}</span>
                <button
                  onClick={() => {
                    // Remove this specific geo code from the value
                    const remaining = geoValues.filter((_, i) => i !== gi);
                    if (remaining.length === 0) {
                      deleteToken('geo', offerId);
                    } else {
                      // Update the geo value without this code
                      if (mode === 'bulk' || !offerId) {
                        setBulkTokens(prev => ({ ...prev, geo: { ...prev.geo, value: remaining.join(', ') } }));
                      } else {
                        setOfferTokensMap(prev => {
                          const od = prev[offerId]; if (!od) return prev;
                          return { ...prev, [offerId]: { ...od, tokens: { ...od.tokens, geo: { ...od.tokens.geo, value: remaining.join(', ') } } } };
                        });
                      }
                    }
                  }}
                  className="hover:opacity-70 text-red-400"
                  title={`Remove ${geoCode}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ));
          }

          return (
            <div
              key={key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                token.enabled ? PART_COLORS[key] : 'bg-gray-50 text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              <span className="font-medium text-[10px] uppercase opacity-70">{PART_LABELS[key]}:</span>
              <span>{token.value}</span>
              {token.inferred && <span className="text-[9px] opacity-50">(inferred)</span>}
              <button
                onClick={() => toggleToken(key, offerId)}
                className="ml-0.5 hover:opacity-70"
                title={token.enabled ? 'Disable' : 'Enable'}
              >
                {token.enabled ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3 opacity-40" />
                )}
              </button>
              <button
                onClick={() => startEditToken(key, offerId)}
                className="hover:opacity-70"
                title="Edit"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={() => deleteToken(key, offerId)}
                className="hover:opacity-70 text-red-400"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Add missing tokens */}
        {missingTokens.map(key => {
          const isAdding = addingToken?.key === key && addingToken?.offerId === offerId;

          if (isAdding) {
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground uppercase">{PART_LABELS[key]}:</span>
                <Input
                  value={addingValue}
                  onChange={e => setAddingValue(e.target.value)}
                  className="h-7 w-24 text-xs"
                  placeholder={`Add ${PART_LABELS[key]}`}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addMissingToken(); if (e.key === 'Escape') setAddingToken(null); }}
                />
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={addMissingToken}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            );
          }

          return (
            <button
              key={key}
              onClick={() => { setAddingToken({ key, offerId }); setAddingValue(''); }}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
              title={`Add ${PART_LABELS[key]}`}
            >
              <Plus className="h-2.5 w-2.5" />
              {PART_LABELS[key]}
            </button>
          );
        })}
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────
  const validRenames = previewList.filter(p => p.composedName && p.composedName !== p.originalName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Smart Rename — {selectedOffers.length} Offer{selectedOffers.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex items-center gap-3 pb-2 border-b">
          <span className="text-sm font-medium">Mode:</span>
          <button
            onClick={() => { setMode('bulk'); setExtracted(false); }}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              mode === 'bulk' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bulk (same name)
          </button>
          <button
            onClick={() => { setMode('per-offer'); setExtracted(false); }}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              mode === 'per-offer' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Per-Offer (individual)
          </button>
        </div>

        {/* Extraction Section */}
        {!extracted ? (
          <div className="flex flex-col items-center gap-3 py-8">
            {extracting ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">Extracting parts from offer names...</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to extract name parts from selected offers</p>
                <Button onClick={runExtraction}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Parts
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Re-extract button */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { setExtracted(false); setManualOverrides({}); runExtraction(); }}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-extract
              </Button>
            </div>

            {/* Token Editor — Bulk mode */}
            {mode === 'bulk' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Extracted Parts (applied to all offers)</Label>
                {renderTokenChips(bulkTokens)}
              </div>
            )}

            {/* Token Editor — Per-offer mode */}
            {mode === 'per-offer' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Extracted Parts (per offer)</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedOffers.map(offer => {
                    const offerData = offerTokensMap[offer.offer_id];
                    if (!offerData) return null;
                    return (
                      <div key={offer.offer_id} className="p-2 rounded border bg-gray-50/50 space-y-1">
                        <div className="text-xs text-muted-foreground truncate">{offer.name}</div>
                        {renderTokenChips(offerData.tokens, offer.offer_id)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Template Section */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm font-medium">Name Template</Label>

              {/* Presets */}
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map(preset => (
                    <div key={preset.name} className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setTemplate(preset.template)}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                          template === preset.template
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deletePreset(preset.name)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="{brand} {amount} {geo} {optin}"
                  className="font-mono text-sm"
                />
                {showPresetInput ? (
                  <div className="flex gap-1">
                    <Input
                      value={newPresetName}
                      onChange={e => setNewPresetName(e.target.value)}
                      placeholder="Preset name"
                      className="w-32 text-sm"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowPresetInput(false); }}
                    />
                    <Button size="sm" variant="outline" onClick={savePreset}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowPresetInput(true)} title="Save as preset">
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {PART_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setTemplate(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + `{${key}}`)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 font-mono"
                  >
                    {`{${key}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm font-medium">
                Preview ({validRenames.length} of {selectedOffers.length} will be renamed)
              </Label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {previewList.map(item => {
                  const isEditingThis = editingComposed === item.offerId;
                  const hasChange = item.composedName && item.composedName !== item.originalName;
                  const isManuallyEdited = !!manualOverrides[item.offerId];

                  return (
                    <div
                      key={item.offerId}
                      className={`p-2 rounded border text-sm group ${
                        isManuallyEdited ? 'border-amber-300 bg-amber-50/30' : hasChange ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/30'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="text-xs text-muted-foreground line-through truncate flex-1">
                              was: {item.originalName}
                            </div>
                            {isManuallyEdited && (
                              <span className="text-[9px] px-1.5 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">✏️ edited</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                            {isEditingThis ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input
                                  value={editingComposedValue}
                                  onChange={e => setEditingComposedValue(e.target.value)}
                                  className="h-7 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setManualOverrides(prev => ({ ...prev, [item.offerId]: editingComposedValue }));
                                      setEditingComposed(null);
                                    }
                                    if (e.key === 'Escape') setEditingComposed(null);
                                  }}
                                  onBlur={() => {
                                    if (editingComposedValue.trim()) {
                                      setManualOverrides(prev => ({ ...prev, [item.offerId]: editingComposedValue }));
                                    }
                                    setEditingComposed(null);
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onMouseDown={e => {
                                    e.preventDefault(); // prevent blur before click
                                    setManualOverrides(prev => ({ ...prev, [item.offerId]: editingComposedValue }));
                                    setEditingComposed(null);
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span
                                className={`font-medium cursor-pointer hover:underline inline-flex items-center gap-1 ${
                                  hasChange ? 'text-blue-700' : 'text-gray-400 italic'
                                }`}
                                onClick={() => {
                                  setEditingComposed(item.offerId);
                                  setEditingComposedValue(item.composedName || item.originalName);
                                }}
                                title="Click to edit manually"
                              >
                                {item.composedName || '(no change)'}
                                <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                              </span>
                            )}
                          </div>
                        </div>
                        {manualOverrides[item.offerId] && (
                          <button
                            onClick={() => setManualOverrides(prev => {
                              const next = { ...prev };
                              delete next[item.offerId];
                              return next;
                            })}
                            className="text-xs text-gray-400 hover:text-gray-600"
                            title="Reset to template"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex justify-between items-center border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying || validRenames.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Apply to {validRenames.length} Offer{validRenames.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
