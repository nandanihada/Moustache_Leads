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
  Lock,
  Trash2,
  ChevronDown,
  ImageIcon,
} from 'lucide-react';
import { Offer, adminOfferApi } from '@/services/adminOfferApi';
import { ImagePickerComponent } from '@/components/ImagePickerComponent';
import { DescriptionGeneratorComponent } from '@/components/DescriptionGeneratorComponent';
import { VerticalSuggesterComponent } from '@/components/VerticalSuggesterComponent';
import { ImageRulesComponent } from '@/components/ImageRulesComponent';

// Icons for collapsible sections
const DESC_ICON_URL = 'https://i.postimg.cc/XB0zjj5r/description.png';
const CAT_ICON_URL = 'https://i.postimg.cc/bw1GTwsg/categorization.png';

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
const LS_GLOBAL_VARS_KEY = 'offer_rename_global_vars';

interface GlobalVariable {
  field: PartKey;
  value: string;
}

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

  // 7. Brand — first unused token(s) that look like a brand name
  const brandTokens: string[] = [];
  for (let i = 0; i < nameTokens.length; i++) {
    if (usedTokens.has(i)) continue;
    const t = nameTokens[i];
    // Skip pure numbers (like "4131") but KEEP alphanumeric tokens (like "21KETO", "10Web", "12Go")
    if (/^\d+$/.test(t)) continue;
    // Accept any token that contains at least one letter and isn't a known pattern match
    if (/[A-Za-z]/.test(t) && !MODEL_PATTERNS.test(t) && !OPTIN_PATTERNS.test(t) && !INCENT_PATTERNS.test(t) && !PROOF_PATTERNS.test(t) && !COUNTRY_CODES.has(t.toUpperCase())) {
      brandTokens.push(t);
      usedTokens.add(i);
      // Take up to 4 consecutive brand-like tokens
      if (brandTokens.length >= 4) break;
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
  onApply: (renames: Array<{ offer_id: string; new_name: string; original_name: string }>, imageUrl?: string, perOfferImages?: Record<string, string>, perOfferDescs?: Record<string, string>, perOfferVerticals?: Record<string, string>) => Promise<void>;
}

export function OfferRenamingModal({ open, onOpenChange, selectedOffers, onApply }: OfferRenamingModalProps) {
  // Mode: always per-offer
  const mode = 'per-offer' as const;

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

  // Image picker state
  const [imageOpen, setImageOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // bulk image for all
  const [perOfferImages, setPerOfferImages] = useState<Record<string, string>>({}); // per-offer images
  const [perOfferImagePicker, setPerOfferImagePicker] = useState<string | null>(null); // which offer's picker is open
  const [previewDescPicker, setPreviewDescPicker] = useState<string | null>(null);
  const [previewVerticalPicker, setPreviewVerticalPicker] = useState<string | null>(null);

  // Description generator state
  const [descOpen, setDescOpen] = useState(false);
  const [perOfferDescs, setPerOfferDescs] = useState<Record<string, string>>({});

  // Vertical suggester state
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [perOfferVerticals, setPerOfferVerticals] = useState<Record<string, string>>({});

  // Bulk generation state
  const [bulkDescGenerating, setBulkDescGenerating] = useState(false);
  const [bulkDescProgress, setBulkDescProgress] = useState({ done: 0, total: 0 });
  const [bulkImageGenerating, setBulkImageGenerating] = useState(false);
  const [bulkImageProgress, setBulkImageProgress] = useState({ done: 0, total: 0 });
  const [bulkImageSource, setBulkImageSource] = useState<'ai' | 'stock'>('stock');
  const [bulkImageScope, setBulkImageScope] = useState<'all' | 'missing'>('missing');

  // Preview filter state
  const [previewFilter, setPreviewFilter] = useState<'all' | 'no_image' | 'has_image' | 'no_desc' | 'has_desc' | 'updated'>('all');

  // Image Rules state
  const [imageRulesOpen, setImageRulesOpen] = useState(false);

  // Global Variables — override/force specific fields across all offers
  const [globalVars, setGlobalVars] = useState<GlobalVariable[]>(() => {
    try { const s = localStorage.getItem(LS_GLOBAL_VARS_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

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

  // Save global vars to localStorage
  useEffect(() => {
    localStorage.setItem(LS_GLOBAL_VARS_KEY, JSON.stringify(globalVars));
  }, [globalVars]);

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
  // Build a map of global variable overrides
  const globalOverrides = useMemo(() => {
    const map: Partial<Record<PartKey, string>> = {};
    for (const gv of globalVars) {
      if (gv.value.trim()) map[gv.field] = gv.value.trim();
    }
    return map;
  }, [globalVars]);

  // Apply global vars to a token set — returns a new token set with overrides applied
  const applyGlobalVars = useCallback((tokens: Record<PartKey, TokenState>): Record<PartKey, TokenState> => {
    if (Object.keys(globalOverrides).length === 0) return tokens;
    const result = { ...tokens };
    for (const [key, value] of Object.entries(globalOverrides)) {
      result[key as PartKey] = { value: value!, enabled: true, inferred: false };
    }
    return result;
  }, [globalOverrides]);

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

      let tokens = mode === 'bulk' ? bulkTokens : offerTokensMap[offerId]?.tokens;
      if (!tokens) {
        return { offerId, originalName: offer.name, composedName: '' };
      }

      // Apply global variable overrides
      tokens = applyGlobalVars(tokens);

      return {
        offerId,
        originalName: offer.name,
        composedName: composeNameFromTemplate(template, tokens),
      };
    });
  }, [selectedOffers, mode, bulkTokens, offerTokensMap, template, manualOverrides, applyGlobalVars]);

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

      await onApply(renames, selectedImage || undefined, perOfferImages, perOfferDescs, perOfferVerticals);
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setApplying(false);
    }
  };

  // ─── Bulk Generate All Descriptions ──────────────────────────────
  const bulkGenerateDescriptions = async () => {
    setBulkDescGenerating(true);
    setBulkDescProgress({ done: 0, total: selectedOffers.length });
    for (let i = 0; i < selectedOffers.length; i++) {
      const offer = selectedOffers[i];
      try {
        const res = await adminOfferApi.generateDescription(
          offer.name, offer.description || '', offer.vertical || offer.category || '', 'name_and_desc'
        );
        if (res.success && res.description) {
          setPerOfferDescs(prev => ({ ...prev, [offer.offer_id]: res.description }));
          await adminOfferApi.updateOffer(offer.offer_id, { description: res.description } as any);
        }
      } catch {}
      setBulkDescProgress({ done: i + 1, total: selectedOffers.length });
    }
    setBulkDescGenerating(false);
  };

  // ─── Bulk Generate All Images ────────────────────────────────────
  const bulkGenerateImages = async () => {
    const offersToProcess = bulkImageScope === 'missing'
      ? selectedOffers.filter(o => !o.image_url && !o.thumbnail_url && !perOfferImages[o.offer_id])
      : selectedOffers;
    if (offersToProcess.length === 0) return;
    setBulkImageGenerating(true);
    setBulkImageProgress({ done: 0, total: offersToProcess.length });
    for (let i = 0; i < offersToProcess.length; i++) {
      const offer = offersToProcess[i];
      try {
        let imageUrl = '';
        if (bulkImageSource === 'ai') {
          const brand = offer.name.replace(/\s*\[.*?\]\s*/g, ' ').replace(/\(.*?\)/g, '').trim();
          const v = offer.vertical || offer.category || '';
          const prompt = `Professional affiliate marketing banner for ${brand}, ${v} offer, clean modern flat design, no text, suitable as thumbnail`;
          const res = await adminOfferApi.generateImage(prompt, true, offer.name);
          if (res.success && res.image_url) imageUrl = res.image_url;
        } else {
          // Stock: auto-assign based on vertical/category
          const v = (offer.vertical || offer.category || '').toUpperCase();
          const stockMap: Record<string, string> = {
            'HEALTH': '/category-images/health.png', 'SURVEY': '/category-images/survey.png',
            'SWEEPSTAKES': '/category-images/sweepstakes.png', 'EDUCATION': '/category-images/education.png',
            'INSURANCE': '/category-images/insurance.png', 'LOAN': '/category-images/loan.png',
            'FINANCE': '/category-images/finance.png', 'DATING': '/category-images/dating.png',
            'FREE_TRIAL': '/category-images/free_trial.png', 'INSTALLS': '/category-images/installs.png',
            'GAMES_INSTALL': '/category-images/games_install.png',
          };
          imageUrl = stockMap[v] || '/category-images/sweepstakes.png';
        }
        if (imageUrl) {
          setPerOfferImages(prev => ({ ...prev, [offer.offer_id]: imageUrl }));
          await adminOfferApi.updateOffer(offer.offer_id, { image_url: imageUrl });
          adminOfferApi.logImageUpdate(offer.offer_id, offer.name, imageUrl, bulkImageSource === 'ai' ? 'ai' : 'stock').catch(() => {});
        }
      } catch {}
      setBulkImageProgress({ done: i + 1, total: offersToProcess.length });
    }
    setBulkImageGenerating(false);
  };

  // ─── Render helpers ──────────────────────────────────────────────
  const renderTokenChips = (tokens: Record<PartKey, TokenState>, offerId?: string) => {
    // Merge global overrides for display purposes
    const effectiveTokens = applyGlobalVars(tokens);
    const activeTokens = PART_KEYS.filter(k => effectiveTokens[k].value);
    const missingTokens = PART_KEYS.filter(k => !effectiveTokens[k].value && !globalOverrides[k]);

    // Split multi-value GEO into individual items for rendering
    const geoValues = effectiveTokens.geo?.value ? effectiveTokens.geo.value.split(/[,\s]+/).filter(Boolean).map(g => g.trim()) : [];
    const hasMultiGeo = geoValues.length > 1;

    // Track which individual geo codes are disabled (stored as comma-separated in a special state)
    // For simplicity, we use the token enabled flag for all geos together,
    // but render them as individual chips that can be toggled

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {activeTokens.map(key => {
          const token = effectiveTokens[key];
          const isEditing = editingToken?.key === key && editingToken?.offerId === offerId;
          const isGlobal = !!globalOverrides[key];

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
            const isGeoGlobal = !!globalOverrides.geo;
            return geoValues.map((geoCode, gi) => (
              <div
                key={`geo-${gi}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  isGeoGlobal ? 'bg-violet-100 text-violet-800 border-violet-400 ring-1 ring-violet-300' :
                  token.enabled ? PART_COLORS.geo : 'bg-gray-50 text-gray-400 border-gray-200 line-through opacity-60'
                }`}
              >
                {isGeoGlobal && <Lock className="h-2.5 w-2.5 text-violet-600" />}
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
                isGlobal ? 'bg-violet-100 text-violet-800 border-violet-400 ring-1 ring-violet-300' :
                token.enabled ? PART_COLORS[key] : 'bg-gray-50 text-gray-400 border-gray-200 line-through opacity-60'
              }`}
            >
              {isGlobal && <Lock className="h-2.5 w-2.5 text-violet-600" />}
              <span className="font-medium text-[10px] uppercase opacity-70">{PART_LABELS[key]}:</span>
              <span>{token.value}</span>
              {token.inferred && !isGlobal && <span className="text-[9px] opacity-50">(inferred)</span>}
              {!isGlobal && (<>
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
              </>)}
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
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Smart Rename — {selectedOffers.length} Offer{selectedOffers.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
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

            {/* Global Variables */}
            <div className="space-y-2 border rounded-lg p-3 bg-violet-50/30 dark:bg-violet-950/10">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-violet-600" />
                  Global Variables
                  <span className="text-[10px] text-muted-foreground font-normal">(override all offers)</span>
                </Label>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 border-violet-300 text-violet-700 hover:bg-violet-100"
                  onClick={() => setGlobalVars(prev => [...prev, { field: 'model', value: '' }])}>
                  <Plus className="h-3 w-3" />Add Variable
                </Button>
              </div>
              {globalVars.length > 0 && (
                <div className="space-y-1.5">
                  {globalVars.map((gv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={gv.field}
                        onChange={e => setGlobalVars(prev => prev.map((v, i) => i === idx ? { ...v, field: e.target.value as PartKey } : v))}
                        className="h-7 rounded border border-violet-300 bg-white dark:bg-gray-900 text-xs px-2 w-28"
                      >
                        {PART_KEYS.filter(k => k !== 'brand').map(k => (
                          <option key={k} value={k}>{PART_LABELS[k]}</option>
                        ))}
                      </select>
                      <Input
                        value={gv.value}
                        onChange={e => setGlobalVars(prev => prev.map((v, i) => i === idx ? { ...v, value: e.target.value } : v))}
                        placeholder={`Enter ${PART_LABELS[gv.field]} value`}
                        className="h-7 text-xs flex-1 border-violet-300"
                      />
                      <button onClick={() => setGlobalVars(prev => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {globalVars.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No global variables set. Add one to force a field value across all offers.</p>
              )}
            </div>

            {/* Token Editor — Per-offer */}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">
                  Preview ({validRenames.length} of {selectedOffers.length} will be renamed)
                </Label>
                {/* Filter chips */}
                <div className="flex flex-wrap gap-1">
                  {([
                    { key: 'all', label: 'All', count: selectedOffers.length },
                    { key: 'no_image', label: '🖼️ No Image', count: selectedOffers.filter(o => !o.image_url && !o.thumbnail_url && !perOfferImages[o.offer_id]).length },
                    { key: 'has_image', label: '🖼️ Has Image', count: selectedOffers.filter(o => o.image_url || o.thumbnail_url || perOfferImages[o.offer_id]).length },
                    { key: 'no_desc', label: '📝 No Desc', count: selectedOffers.filter(o => !o.description && !perOfferDescs[o.offer_id]).length },
                    { key: 'has_desc', label: '📝 Has Desc', count: selectedOffers.filter(o => o.description || perOfferDescs[o.offer_id]).length },
                    { key: 'updated', label: '✨ Updated', count: selectedOffers.filter(o => perOfferDescs[o.offer_id] || perOfferImages[o.offer_id] || perOfferVerticals[o.offer_id]).length },
                  ] as const).map(f => (
                    <button key={f.key} onClick={() => setPreviewFilter(f.key)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        previewFilter === f.key ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {previewList.filter(item => {
                  const offer = selectedOffers.find(o => o.offer_id === item.offerId);
                  if (!offer) return false;
                  if (previewFilter === 'no_image') return !offer.image_url && !offer.thumbnail_url && !perOfferImages[item.offerId];
                  if (previewFilter === 'has_image') return !!(offer.image_url || offer.thumbnail_url || perOfferImages[item.offerId]);
                  if (previewFilter === 'no_desc') return !offer.description && !perOfferDescs[item.offerId];
                  if (previewFilter === 'has_desc') return !!(offer.description || perOfferDescs[item.offerId]);
                  if (previewFilter === 'updated') return !!(perOfferDescs[item.offerId] || perOfferImages[item.offerId] || perOfferVerticals[item.offerId]);
                  return true;
                }).map(item => {
                  const offer = selectedOffers.find(o => o.offer_id === item.offerId);
                  if (!offer) return null;
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
                        {/* Per-offer tools: Image + Description + Vertical in one box */}
                        <div className="flex items-center gap-0.5 shrink-0 border rounded-lg px-1 py-0.5 bg-muted/30">
                          <button
                            onClick={() => setPerOfferImagePicker(perOfferImagePicker === item.offerId ? null : item.offerId)}
                            className="p-0.5 rounded hover:bg-white/80 hover:scale-110 transition-all"
                            title="Image"
                          >
                            {perOfferImages[item.offerId] ? (
                              <img src={perOfferImages[item.offerId]} alt="" className="w-6 h-6 rounded object-cover ring-1 ring-green-400" />
                            ) : (
                              <img src="https://i.postimg.cc/rwr2vdT6/polaroid.png" alt="Image" className="w-6 h-6 object-contain" />
                            )}
                          </button>
                          <button
                            onClick={() => setPreviewDescPicker(previewDescPicker === item.offerId ? null : item.offerId)}
                            className="p-0.5 rounded hover:bg-white/80 hover:scale-110 transition-all"
                            title="Description"
                          >
                            <img src="https://i.postimg.cc/XB0zjj5r/description.png" alt="Desc" className="w-6 h-6 object-contain" />
                          </button>
                          <button
                            onClick={() => setPreviewVerticalPicker(previewVerticalPicker === item.offerId ? null : item.offerId)}
                            className="p-0.5 rounded hover:bg-white/80 hover:scale-110 transition-all"
                            title="Vertical"
                          >
                            <img src="https://i.postimg.cc/bw1GTwsg/categorization.png" alt="Vertical" className="w-6 h-6 object-contain" />
                          </button>
                        </div>
                      </div>
                      {/* Offer details: image, description, vertical — current + generated */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px]">
                        {/* Image status */}
                        {(perOfferImages[item.offerId] || offer.image_url || offer.thumbnail_url) ? (
                          <img src={perOfferImages[item.offerId] || offer.image_url || offer.thumbnail_url} alt="" className="w-8 h-8 rounded border object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-200">No image</span>
                        )}
                        {perOfferImages[item.offerId] && <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">🖼️ new</span>}
                        {/* Vertical */}
                        <span className={`px-1.5 py-0.5 rounded border ${perOfferVerticals[item.offerId] ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {perOfferVerticals[item.offerId] || offer.vertical || offer.category || '—'}
                          {perOfferVerticals[item.offerId] && ' ✨'}
                        </span>
                        {/* Description status */}
                        {(perOfferDescs[item.offerId] || offer.description) ? (
                          <span className={`px-1.5 py-0.5 rounded border truncate max-w-[200px] ${perOfferDescs[item.offerId] ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                            title={perOfferDescs[item.offerId] || offer.description}>
                            {perOfferDescs[item.offerId] ? '📝 ' : ''}{(perOfferDescs[item.offerId] || offer.description || '').slice(0, 50)}{(perOfferDescs[item.offerId] || offer.description || '').length > 50 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-200">No desc</span>
                        )}
                      </div>
                      {/* Per-offer image picker (inline) */}
                      {perOfferImagePicker === item.offerId && (
                        <div className="mt-2 p-2 border rounded-lg bg-muted/30">
                          <ImagePickerComponent
                            offerName={item.originalName}
                            vertical={selectedOffers.find(o => o.offer_id === item.offerId)?.vertical || selectedOffers.find(o => o.offer_id === item.offerId)?.category}
                            onImageSelected={(url, _source) => {
                              setPerOfferImages(prev => ({ ...prev, [item.offerId]: url }));
                              setPerOfferImagePicker(null);
                            }}
                          />
                        </div>
                      )}
                      {/* Per-offer description generator (inline) */}
                      {previewDescPicker === item.offerId && (
                        <div className="mt-2 p-2 border rounded-lg bg-muted/30">
                          <DescriptionGeneratorComponent
                            offerName={item.originalName}
                            existingDescription={selectedOffers.find(o => o.offer_id === item.offerId)?.description || ''}
                            vertical={selectedOffers.find(o => o.offer_id === item.offerId)?.vertical || selectedOffers.find(o => o.offer_id === item.offerId)?.category}
                            onDescriptionSaved={async (newDesc) => {
                              setPerOfferDescs(prev => ({ ...prev, [item.offerId]: newDesc }));
                              try { await adminOfferApi.updateOffer(item.offerId, { description: newDesc } as any); } catch {}
                              setPreviewDescPicker(null);
                            }}
                          />
                        </div>
                      )}
                      {/* Per-offer vertical suggester (inline) */}
                      {previewVerticalPicker === item.offerId && (
                        <div className="mt-2 p-2 border rounded-lg bg-muted/30">
                          <VerticalSuggesterComponent
                            offerName={item.originalName}
                            description={selectedOffers.find(o => o.offer_id === item.offerId)?.description || ''}
                            currentVertical={selectedOffers.find(o => o.offer_id === item.offerId)?.vertical || selectedOffers.find(o => o.offer_id === item.offerId)?.category || ''}
                            onVerticalSaved={async (newVertical) => {
                              setPerOfferVerticals(prev => ({ ...prev, [item.offerId]: newVertical }));
                              try { await adminOfferApi.updateOffer(item.offerId, { vertical: newVertical, category: newVertical } as any); } catch {}
                              setPreviewVerticalPicker(null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add Image — collapsible (bulk: applies to all offers without individual image) */}
            <div className="border-t pt-3">
              <button
                onClick={() => setImageOpen(!imageOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ImageIcon className="h-4 w-4" />
                Add Image {mode === 'per-offer' ? '(default for all)' : '(all offers)'}
                {selectedImage && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 ml-1">✓ Selected</Badge>}
                {Object.keys(perOfferImages).length > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 ml-1">{Object.keys(perOfferImages).length} individual</Badge>}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${imageOpen ? 'rotate-180' : ''}`} />
              </button>
              {imageOpen && (
                <div className="mt-3 space-y-3">
                  {/* Bulk generate all images */}
                  <div className="p-3 border rounded-lg bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={bulkImageScope} onChange={e => setBulkImageScope(e.target.value as 'all' | 'missing')}
                        className="h-7 rounded border text-xs px-2 bg-white dark:bg-gray-900">
                        <option value="missing">Only without images ({selectedOffers.filter(o => !o.image_url && !o.thumbnail_url && !perOfferImages[o.offer_id]).length})</option>
                        <option value="all">All offers ({selectedOffers.length})</option>
                      </select>
                      <select value={bulkImageSource} onChange={e => setBulkImageSource(e.target.value as 'ai' | 'stock')}
                        className="h-7 rounded border text-xs px-2 bg-white dark:bg-gray-900">
                        <option value="stock">Stock (by vertical)</option>
                        <option value="ai">AI Generated</option>
                      </select>
                      <Button size="sm" onClick={bulkGenerateImages} disabled={bulkImageGenerating} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                        {bulkImageGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {bulkImageGenerating ? `${bulkImageProgress.done}/${bulkImageProgress.total}` : 'Generate Images'}
                      </Button>
                    </div>
                    {bulkImageGenerating && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-violet-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(bulkImageProgress.done / bulkImageProgress.total) * 100}%` }} />
                      </div>
                    )}
                    {/* Generated images gallery */}
                    {Object.keys(perOfferImages).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">{Object.keys(perOfferImages).length} images assigned:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(perOfferImages).map(([offerId, url]) => {
                            const offer = selectedOffers.find(o => o.offer_id === offerId);
                            return (
                              <div key={offerId} className="relative group" title={offer?.name || offerId}>
                                <img src={url} alt="" className="w-12 h-12 rounded border object-cover hover:ring-2 hover:ring-violet-400 transition-all cursor-pointer"
                                  onClick={() => window.open(url, '_blank')} />
                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full shadow px-1 text-[8px] text-muted-foreground border opacity-0 group-hover:opacity-100 transition-opacity max-w-[80px] truncate">
                                  {offer?.name?.slice(0, 15) || offerId}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <ImagePickerComponent
                    offerName={selectedOffers[0]?.name || ''}
                    description={selectedOffers[0]?.description}
                    vertical={selectedOffers[0]?.vertical || selectedOffers[0]?.category}
                    onImageSelected={(url, _source) => setSelectedImage(url)}
                  />
                </div>
              )}
            </div>

            {/* Image Rules — collapsible */}
            <div className="border-t pt-3">
              <button
                onClick={() => setImageRulesOpen(!imageRulesOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <img src="https://i.postimg.cc/rwr2vdT6/polaroid.png" alt="" className="h-4 w-4 object-contain" />
                Image Rules (keyword → image)
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${imageRulesOpen ? 'rotate-180' : ''}`} />
              </button>
              {imageRulesOpen && (
                <div className="mt-3">
                  <ImageRulesComponent onRulesApplied={() => {}} />
                </div>
              )}
            </div>

            {/* Generate Description — collapsible */}
            <div className="border-t pt-3">
              <button
                onClick={() => setDescOpen(!descOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <img src={DESC_ICON_URL} alt="" className="h-4 w-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                Generate Description
                {Object.keys(perOfferDescs).length > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 ml-1">{Object.keys(perOfferDescs).length} updated</Badge>}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${descOpen ? 'rotate-180' : ''}`} />
              </button>
              {descOpen && (
                <div className="mt-3 space-y-3">
                  {/* Bulk generate all descriptions */}
                  <div className="p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={bulkGenerateDescriptions} disabled={bulkDescGenerating} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                        {bulkDescGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {bulkDescGenerating ? `${bulkDescProgress.done}/${bulkDescProgress.total}` : `Generate All ${selectedOffers.length} Descriptions`}
                      </Button>
                    </div>
                    {bulkDescGenerating && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(bulkDescProgress.done / bulkDescProgress.total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  {selectedOffers.map(offer => (
                    <div key={offer.offer_id} className="p-2 border rounded-lg bg-muted/20">
                      <p className="text-xs font-medium truncate mb-2">{offer.name}</p>
                      <DescriptionGeneratorComponent
                        offerName={offer.name}
                        existingDescription={offer.description || ''}
                        vertical={offer.vertical || offer.category}
                        onDescriptionSaved={async (newDesc) => {
                          setPerOfferDescs(prev => ({ ...prev, [offer.offer_id]: newDesc }));
                          try {
                            await adminOfferApi.updateOffer(offer.offer_id, { description: newDesc } as any);
                          } catch {}
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggest Vertical — collapsible */}
            <div className="border-t pt-3">
              <button
                onClick={() => setVerticalOpen(!verticalOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <img src={CAT_ICON_URL} alt="" className="h-4 w-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                Suggest Vertical
                {Object.keys(perOfferVerticals).length > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200 ml-1">{Object.keys(perOfferVerticals).length} updated</Badge>}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${verticalOpen ? 'rotate-180' : ''}`} />
              </button>
              {verticalOpen && (
                <div className="mt-3 space-y-3">
                  {selectedOffers.map(offer => (
                    <div key={offer.offer_id} className="p-2 border rounded-lg bg-muted/20">
                      <p className="text-xs font-medium truncate mb-2">{offer.name}</p>
                      <VerticalSuggesterComponent
                        offerName={offer.name}
                        description={offer.description || ''}
                        currentVertical={offer.vertical || offer.category || ''}
                        onVerticalSaved={async (newVertical) => {
                          setPerOfferVerticals(prev => ({ ...prev, [offer.offer_id]: newVertical }));
                          try {
                            await adminOfferApi.updateOffer(offer.offer_id, { vertical: newVertical, category: newVertical } as any);
                          } catch {}
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
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
        </div>{/* end scrollable */}
      </DialogContent>
    </Dialog>
  );
}
