import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Zap, 
  Clipboard, 
  Check, 
  AlertTriangle, 
  Info, 
  Loader2, 
  Layers, 
  Copy, 
  FileText,
  AlertCircle,
  Plus,
  Upload,
  Trash2,
  CheckCircle2,
  Edit2,
  Globe,
  DollarSign,
  Cpu,
  Link,
  Sliders,
  Sparkles,
  Eye,
  CheckSquare,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { adminOfferApi } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';

// Extend Window interface for Tesseract
declare global {
  interface Window {
    Tesseract?: any;
  }
}

interface OfferClipboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFill: (offer: any) => void;
  onOffersCreated?: () => void;
}

// Field confidence type
type Confidence = 'high' | 'low' | 'none';

interface FieldState<T> {
  value: T;
  confidence: Confidence;
  source: string;
}

interface FullParsedOffer {
  campaign_id: FieldState<string>;
  name: FieldState<string>;
  payout: FieldState<number>;
  revenue: FieldState<number>;
  currency: FieldState<string>;
  countries: FieldState<string[]>;
  device_targeting: FieldState<'all' | 'mobile' | 'desktop'>;
  os_targeting: FieldState<string[]>;
  browser_targeting: FieldState<string[]>;
  vertical: FieldState<string>;
  network: FieldState<string>;
  target_url: FieldState<string>;
  preview_url: FieldState<string>;
  publisher: FieldState<string>;
  daily_cap: FieldState<number>;
  payout_model: FieldState<string>; // CPA, CPL, CPI, etc.
  conversion_goal: FieldState<string>;
  status: FieldState<'active' | 'inactive'>;
  description: FieldState<string>;
  postback_url: FieldState<string>;
  image: FieldState<string>;
}

const TEST_DATA_SAMPLES = [
  // Sample 1: Plain text key-values with deep specs
  `Offer ID: CAMPAIGN_X902\nName: CyberShield VPN Lifetime\nPayout: $8.50\nRevenue: $11.20\nCurrency: USD\nNetwork: PepperAds\nCountries: US, CA, GB\nDevice: desktop\nOS: Windows, Mac\nVertical: Utilities\nUrl: https://pepperads.com/click?cid=X902&pub=direct_ads\nCaps: 500\nFlow Type: CPA\nConversion Type: Signup\nStatus: active\nDescription: High payout security subscription download.`,
  
  // Sample 2: Messy tracking link with query params
  `https://qiver.com/track?cid=CAMP_8812&payout=4.50&currency=EUR&countries=DE,AT&device=mobile&os=Android,iOS&vertical=Gaming&pub=aff_998&cap=250&model=CPI&goal=Install`,
  
  // Sample 3: Raw JSON Block
  `{\n  "campaign_id": "CAMP_AUD_2148",\n  "name": "Audible Premium",\n  "payout": 6.00,\n  "revenue": 8.50,\n  "currency": "USD",\n  "countries": ["US"],\n  "device_targeting": "all",\n  "vertical": "Lifestyle",\n  "network": "Qiver",\n  "target_url": "https://qiver.com/track?offer=2148",\n  "description": "Premium audiobook subscription sign up"\n}`,
  
  // Sample 4: Single line text
  `New sweepstakes campaign! Name: iPhone 16 Giveaway, ID: SWEEP_16, Payout is $1.80 from Network: SweepsMedia. URL: https://sweeps.com/win?id=SWEEP_16`
];

export const OfferClipboardPanel: React.FC<OfferClipboardPanelProps> = ({
  isOpen,
  onClose,
  onFill,
  onOffersCreated,
}) => {
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1: Input, 2: Preview & Edit
  const [isParsing, setIsParsing] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  const [quickPasteIndex, setQuickPasteIndex] = useState(0);

  // Editable fields state
  const [parsedOffer, setParsedOffer] = useState<FullParsedOffer | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Global paste handler when the drawer is open in Step 1
  useEffect(() => {
    if (!isOpen || step !== 1) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Avoid pasting twice if focus is already in the textarea
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return; 
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;
          e.preventDefault();
          await processImageOcr(file);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen, step, pastedImagePreview]);

  // Initialize Tesseract CDN script on mount
  useEffect(() => {
    if (isOpen && !window.Tesseract) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [isOpen]);

  // Reset states when drawer closes/opens
  useEffect(() => {
    if (!isOpen) {
      setInputText('');
      setStep(1);
      setParsedOffer(null);
      setIsParsing(false);
      setIsOcrLoading(false);
      setOcrProgress('');
      setPastedImagePreview(null);
      setQuickPasteIndex(0);
    }
  }, [isOpen]);

  // Process image using OCR engine (Tesseract)
  const processImageOcr = async (file: File) => {
    setIsOcrLoading(true);
    setOcrProgress('Reading image...');
    
    try {
      const imageUrl = URL.createObjectURL(file);
      setPastedImagePreview(imageUrl);
      
      let attempts = 0;
      while (!window.Tesseract && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
      }
      
      if (!window.Tesseract) {
        throw new Error('OCR Engine could not be loaded. Please enter raw text instead.');
      }
      
      const result = await window.Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(`Analyzing text: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      const extractedText = result?.data?.text || '';
      if (!extractedText.trim()) {
        toast({
          title: "Low confidence extraction",
          description: "No text could be extracted from this image. You can still manually edit or paste raw text below.",
          variant: "destructive"
        });
      } else {
        setInputText(prev => prev ? prev + '\n' + extractedText : extractedText);
        toast({
          title: "Image Processed Successfully",
          description: "Extracted and appended text from the image!",
        });
      }
    } catch (err: any) {
      toast({
        title: "OCR Failed",
        description: err.message || "Failed to parse text from image.",
        variant: "destructive"
      });
    } finally {
      setIsOcrLoading(false);
      setOcrProgress('');
    }
  };

  // Handle image pasting (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;
        e.preventDefault();
        await processImageOcr(file);
      }
    }
  };

  // Handle file input upload change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // Support mime types and extension fallback
    const isImage = file.type.startsWith('image/') || 
                    /\.(png|jpe?g|webp|gif|bmp|jfif)$/i.test(file.name);
                    
    if (isImage) {
      await processImageOcr(file);
    } else {
      toast({
        title: "Invalid File Format",
        description: "Please upload an image file (PNG, JPG, JPEG, WebP).",
        variant: "destructive"
      });
    }
    
    // Clear value to allow selecting same file again
    e.target.value = '';
  };

  // Perform full parsing
  const handleParse = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsParsing(true);

    setTimeout(() => {
      const parsed = performAdvancedParsing(inputText);
      setParsedOffer(parsed);
      setStep(2);
      setIsParsing(false);
      toast({
        title: "Parsing Completed",
        description: "Mapped data into 20 fields with confidence levels!",
      });
    }, 500);
  };

  // Advanced Multi-Field Parsing Engine
  const performAdvancedParsing = (text: string): FullParsedOffer => {
    const cleanText = text.trim();
    
    const defaultState = <T,>(val: T): FieldState<T> => ({
      value: val,
      confidence: 'none',
      source: 'Missing'
    });

    const parsed: FullParsedOffer = {
      campaign_id: defaultState(''),
      name: defaultState(''),
      payout: defaultState(0),
      revenue: defaultState(0),
      currency: defaultState('USD'),
      countries: defaultState([] as string[]),
      device_targeting: defaultState('all' as 'all' | 'mobile' | 'desktop'),
      os_targeting: defaultState([] as string[]),
      browser_targeting: defaultState([] as string[]),
      vertical: defaultState('Lifestyle'),
      network: defaultState(''),
      target_url: defaultState(''),
      preview_url: defaultState(''),
      publisher: defaultState(''),
      daily_cap: defaultState(0),
      payout_model: defaultState('CPA'),
      conversion_goal: defaultState('lead'),
      status: defaultState('active' as 'active' | 'inactive'),
      description: defaultState(''),
      postback_url: defaultState(''),
      image: defaultState('')
    };

    if (!cleanText) return parsed;

    // 1. JSON Parsing Fallback
    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
      try {
        const obj = JSON.parse(cleanText);
        const setHigh = <T,>(field: keyof FullParsedOffer, val: T) => {
          if (val !== undefined && val !== null) {
            (parsed as any)[field] = { value: val, confidence: 'high', source: 'Auto-detected (JSON)' };
          }
        };

        setHigh('campaign_id', obj.campaign_id || obj.offer_id || obj.id || obj.cid);
        setHigh('name', obj.name || obj.title || obj.offer_name || obj.campaign_name);
        setHigh('payout', parseFloat(obj.payout || obj.rate || 0));
        setHigh('revenue', parseFloat(obj.revenue || 0));
        setHigh('currency', obj.currency || 'USD');
        setHigh('countries', Array.isArray(obj.countries) ? obj.countries : (obj.countries ? [obj.countries] : []));
        setHigh('device_targeting', obj.device_targeting || obj.device || 'all');
        setHigh('os_targeting', Array.isArray(obj.os_targeting) ? obj.os_targeting : (obj.os_targeting ? [obj.os_targeting] : []));
        setHigh('browser_targeting', Array.isArray(obj.browser_targeting) ? obj.browser_targeting : (obj.browser_targeting ? [obj.browser_targeting] : []));
        setHigh('vertical', obj.vertical || obj.category || 'Lifestyle');
        setHigh('network', obj.network || obj.partner || obj.network_name);
        setHigh('target_url', obj.target_url || obj.url || obj.link);
        setHigh('preview_url', obj.preview_url || '');
        setHigh('publisher', obj.publisher || obj.pub || '');
        setHigh('daily_cap', parseInt(obj.daily_cap || obj.cap || 0));
        setHigh('payout_model', obj.payout_model || obj.model || 'CPA');
        setHigh('conversion_goal', obj.conversion_goal || obj.goal || 'lead');
        setHigh('status', obj.status || 'active');
        setHigh('description', obj.description || obj.desc || '');
        setHigh('postback_url', obj.postback_url || '');
        setHigh('image', obj.image || obj.logo || obj.icon || obj.image_url || '');

        return parsed;
      } catch { /* fallback */ }
    }

    // 2. Line-by-Line Regex Parsing
    const lines = cleanText.split('\n');
    let foundUrl = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract url
      const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        const url = urlMatch[1];
        if (!foundUrl) foundUrl = url;
        
        // If it looks like an image URL and we don't have one, pick it up
        if (!parsed.image.value && url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
          parsed.image = { value: url, confidence: 'high', source: 'Detected image URL' };
        }
      }

      // Check for key-value pairs (e.g., "Name: My Offer" or "Payout = 5.00")
      let keyPart = '';
      let valPart = '';
      const kv = trimmed.match(/^([^:|=]+)\s*[:|=]\s*(.*)$/);
      
      if (kv) {
        keyPart = kv[1];
        valPart = kv[2].trim();
        
        // If value is empty, look at the next line (often URLs are on new lines)
        if (!valPart && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Accept next line if it's a URL (starts with http) 
          // OR if it doesn't look like another key-value pair
          const isNextKV = nextLine.match(/^[^:|=]{2,30}[:|=]/);
          if (nextLine && (nextLine.toLowerCase().startsWith('http') || !isNextKV)) {
            valPart = nextLine;
            i++; // Consume next line
          }
        }
      }

      // Stand-alone keyword detection (for lines without colons like "Mobile Only")
      if (!keyPart) {
        const lowTrimmed = trimmed.toLowerCase();
        if (lowTrimmed.includes('mobile only')) {
          parsed.device_targeting = { value: 'mobile', confidence: 'high', source: 'Keyword Match' };
        } else if (lowTrimmed.includes('desktop only')) {
          parsed.device_targeting = { value: 'desktop', confidence: 'high', source: 'Keyword Match' };
        }
        
        // Check for common OS mentions if not already found
        if (parsed.os_targeting.value.length === 0) {
          const osList: string[] = [];
          if (lowTrimmed.includes('android')) osList.push('Android');
          if (lowTrimmed.includes('ios')) osList.push('iOS');
          if (lowTrimmed.includes('windows') && !lowTrimmed.includes('window.')) osList.push('Windows');
          if (osList.length > 0) {
            parsed.os_targeting = { value: osList, confidence: 'low', source: 'Keyword Match' };
          }
        }
      }

      if (keyPart) {
        const key = keyPart.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const val = valPart;

        const matchMap: Record<string, keyof FullParsedOffer> = {
          campaignid: 'campaign_id', offerid: 'campaign_id', id: 'campaign_id', cid: 'campaign_id',
          name: 'name', title: 'name', offername: 'name',
          payout: 'payout', rate: 'payout',
          revenue: 'revenue', payoutrevenue: 'revenue',
          currency: 'currency', unit: 'currency',
          network: 'network', partner: 'network', networkname: 'network', partnernetwork: 'network',
          targeturl: 'target_url', url: 'target_url', link: 'target_url', trackingurl: 'target_url',
          previewurl: 'preview_url', landingpage: 'preview_url',
          publisher: 'publisher', pub: 'publisher', source: 'publisher', publisherusername: 'publisher',
          dailycap: 'daily_cap', cap: 'daily_cap', conversionlimit: 'daily_cap',
          payoutmodel: 'payout_model', flowtype: 'payout_model', model: 'payout_model',
          conversiongoal: 'conversion_goal', goal: 'conversion_goal', conversiontype: 'conversion_goal',
          status: 'status',
          description: 'description', desc: 'description', summary: 'description',
          postbackurl: 'postback_url', postback: 'postback_url',
          image: 'image', logo: 'image', icon: 'image', imageurl: 'image', imageuri: 'image',
          country: 'countries', countries: 'countries', geo: 'countries', targetcountries: 'countries', geotargeting: 'countries',
          device: 'device_targeting', devicetargeting: 'device_targeting',
          os: 'os_targeting', ostargeting: 'os_targeting', platform: 'os_targeting', platforms: 'os_targeting', operatingsystem: 'os_targeting',
          browser: 'browser_targeting', browsertargeting: 'browser_targeting',
          category: 'vertical', vertical: 'vertical', verticalcategory: 'vertical', offercategory: 'vertical'
        };

        const field = matchMap[key];
        if (field) {
          if (field === 'payout' || field === 'revenue') {
            const num = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) (parsed as any)[field] = { value: num, confidence: 'high', source: 'Auto-detected (Key-Value)' };
          } else if (field === 'daily_cap') {
            const num = parseInt(val.replace(/[^0-9]/g, ''));
            if (!isNaN(num)) (parsed as any)[field] = { value: num, confidence: 'high', source: 'Auto-detected (Key-Value)' };
          } else if (field === 'countries' || field === 'os_targeting' || field === 'browser_targeting') {
            // Split by comma or space, and clean up
            const arr = val.split(/[,\s]+/).map(s => s.trim().replace(/[^a-z0-9]/gi, '')).filter(s => s.length > 0);
            if (field === 'countries') {
              const upperArr = arr.map(s => s.toUpperCase());
              (parsed as any)[field] = { value: upperArr, confidence: 'high', source: 'Auto-detected (Key-Value)' };
            } else {
              (parsed as any)[field] = { value: arr, confidence: 'high', source: 'Auto-detected (Key-Value)' };
            }
          } else if (field === 'device_targeting') {
            const lowVal = val.toLowerCase();
            let device: 'all' | 'mobile' | 'desktop' = 'all';
            if (lowVal.includes('mobile') || lowVal.includes('android') || lowVal.includes('ios') || lowVal.includes('smartphone') || lowVal.includes('phone')) device = 'mobile';
            else if (lowVal.includes('desktop') || lowVal.includes('pc') || lowVal.includes('windows') || lowVal.includes('mac')) device = 'desktop';
            (parsed as any)[field] = { value: device, confidence: 'high', source: 'Auto-detected (Key-Value)' };
          } else if (val) {
            (parsed as any)[field] = { value: val, confidence: 'high', source: 'Auto-detected (Key-Value)' };
          }
        }
      }
    }

    // 3. Fallback stand-alone regex mapping & Defaults
    
    // Fallback for OS Targeting if missed by line-by-line
    if (parsed.os_targeting.value.length === 0) {
      const osMatch = cleanText.match(/(?:os|operating[-_\s]?system|platform|platforms)[:\s]+([^(\n]+)/i);
      if (osMatch) {
        const arr = osMatch[1].split(/[,\s]+/).map(s => s.trim().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
        if (arr.length > 0) {
          parsed.os_targeting = { value: arr, confidence: 'high', source: 'Stand-alone OS Regex' };
        }
      }
    }

    // Suggest a default Postback URL if missing
    if (!parsed.postback_url.value) {
      parsed.postback_url = { 
        value: 'https://moustacheleads.com/api/postback?click_id={click_id}&payout={payout}', 
        confidence: 'low', 
        source: 'System Default Suggestion' 
      };
    }

    if (!parsed.campaign_id.value) {
      const match = cleanText.match(/(?:offer[-_\s]?id|campaign[-_\s]?id|id)[:\s]*([a-zA-Z0-9_-]{3,20})/i);
      if (match) parsed.campaign_id = { value: match[1], confidence: 'high', source: 'Stand-alone ID Regex' };
      else {
        const possibleId = cleanText.match(/\b([A-Z0-9]{4,10})\b/);
        if (possibleId) parsed.campaign_id = { value: possibleId[1], confidence: 'low', source: 'Possible Stand-alone word' };
      }
    }

    if (!parsed.name.value) {
      const match = cleanText.match(/(?:name|title)[:\s]*([^\n]+)/i);
      if (match) parsed.name = { value: match[1].trim(), confidence: 'high', source: 'Stand-alone Name Regex' };
      else if (lines[0] && lines[0].length < 45 && !lines[0].includes('http') && !lines[0].includes(':')) {
        parsed.name = { value: lines[0].trim(), confidence: 'low', source: 'First Line Guess' };
      }
    }

    if (parsed.payout.value === 0) {
      const match = cleanText.match(/(?:payout|rate|pay)[:\s]*(?:\$|€|£)?\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (match) parsed.payout = { value: parseFloat(match[1]), confidence: 'high', source: 'Payout Regex' };
    }

    // 4. URL Param Parsing
    if (foundUrl) {
      if (!parsed.target_url.value) parsed.target_url = { value: foundUrl, confidence: 'high', source: 'URL found in text' };
      try {
        const url = new URL(foundUrl);
        const params = url.searchParams;

        const setFromParam = (field: keyof FullParsedOffer, paramKeys: string[], parserFn?: (v: string) => any) => {
          if (parsed[field].confidence !== 'high') {
            for (const key of paramKeys) {
              const val = params.get(key);
              if (val) {
                (parsed as any)[field] = { 
                  value: parserFn ? parserFn(val) : val, 
                  confidence: 'low', 
                  source: `Extracted from URL param: '${key}'` 
                };
                break;
              }
            }
          }
        };

        setFromParam('campaign_id', ['offer_id', 'campaign_id', 'cid', 'id']);
        setFromParam('payout', ['payout', 'rate'], parseFloat);
        setFromParam('publisher', ['pub', 'aff_id', 'source']);
        setFromParam('vertical', ['vertical', 'cat', 'category']);
        setFromParam('payout_model', ['model', 'payout_model', 'flow']);
        setFromParam('conversion_goal', ['goal', 'conversion_goal', 'type']);
        setFromParam('image', ['image', 'logo', 'icon', 'image_url']);

        if (!parsed.network.value) {
          const host = url.hostname.replace('www.', '').split('.')[0];
          parsed.network = { 
            value: host.charAt(0).toUpperCase() + host.slice(1), 
            confidence: 'low', 
            source: 'Guessed from URL hostname' 
          };
        }
      } catch { /* URL parser error */ }
    }

    return parsed;
  };

  const handleFieldChange = (field: keyof FullParsedOffer, value: any) => {
    if (!parsedOffer) return;
    setParsedOffer({
      ...parsedOffer,
      [field]: {
        value,
        confidence: 'high', // User override sets to high confidence
        source: 'User Modified'
      }
    });
  };

  const handleQuickPaste = (e: React.MouseEvent) => {
    e.preventDefault();
    const txt = TEST_DATA_SAMPLES[quickPasteIndex];
    setQuickPasteIndex(prev => (prev + 1) % TEST_DATA_SAMPLES.length);
    setInputText(txt);
  };

  const handleConfirmAndAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!parsedOffer) return;

    if (!parsedOffer.campaign_id.value || !parsedOffer.name.value || !parsedOffer.target_url.value) {
      toast({
        title: "Validation Error",
        description: "Offer ID, Offer Name, and Target URL are strictly required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Check if offer already exists in DB
      let existingId = null;
      try {
        const checkRes = await adminOfferApi.getOffer(parsedOffer.campaign_id.value);
        if (checkRes && checkRes.offer) {
          const proceed = window.confirm(
            `DUPLICATE ALERT: Offer ID "${parsedOffer.campaign_id.value}" already exists!\n\n` +
            `Existing: ${checkRes.offer.name} (${checkRes.offer.network})\n\n` +
            `• Click [OK] to OVERWRITE / EDIT the existing offer.\n` +
            `• Click [CANCEL] to add this as a NEW duplicate entry.`
          );
          if (proceed) {
            existingId = checkRes.offer._id;
          }
        }
      } catch (err) {
        // Not found or error, proceed as new
      }

      const submitData = {
        campaign_id: parsedOffer.campaign_id.value,
        name: parsedOffer.name.value,
        payout: Number(parsedOffer.payout.value) || 0,
        revenue: Number(parsedOffer.revenue.value) || 0,
        currency: parsedOffer.currency.value,
        countries: parsedOffer.countries.value,
        device_targeting: parsedOffer.device_targeting.value,
        os_targeting: parsedOffer.os_targeting.value,
        browser_targeting: parsedOffer.browser_targeting.value,
        vertical: parsedOffer.vertical.value,
        category: parsedOffer.vertical.value, // keep sync
        network: parsedOffer.network.value || 'PepperAds',
        target_url: parsedOffer.target_url.value,
        preview_url: parsedOffer.preview_url.value,
        publisher: parsedOffer.publisher.value,
        daily_cap: Number(parsedOffer.daily_cap.value) || 0,
        payout_model: parsedOffer.payout_model.value,
        conversion_goal: parsedOffer.conversion_goal.value,
        status: parsedOffer.status.value,
        description: parsedOffer.description.value ? `${parsedOffer.description.value} [Smart Clipboard]` : '[Smart Clipboard]',
        postback_url: parsedOffer.postback_url.value,
        image: parsedOffer.image.value,
        affiliates: 'all',
        show_in_iframe: true,
        star_rating: 5,
        priority: 0,
        rotation_weight: 1.0
      };

      let response;
      if (existingId) {
        // UPDATE EXISTING
        response = await adminOfferApi.updateOffer(existingId, submitData);
        toast({
          title: "Offer Updated",
          description: `Existing offer "${parsedOffer.name.value}" has been updated successfully.`,
          variant: "default"
        });
      } else {
        // CREATE NEW
        response = await adminOfferApi.createOffer(submitData as any);
        toast({
          title: "Offer Created",
          description: `New offer "${parsedOffer.name.value}" has been added to the database.`,
          variant: "default"
        });
      }

      onOffersCreated?.();
      onClose();
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message || "Failed to create offer inside database.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceBadge = (confidence: Confidence) => {
    switch (confidence) {
      case 'high':
        return <Badge style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }} className="text-[10px] px-1.5 h-4 font-semibold border">Auto-detected</Badge>;
      case 'low':
        return <Badge style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)' }} className="text-[10px] px-1.5 h-4 font-semibold border">Possible</Badge>;
      default:
        return <Badge style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }} className="text-[10px] px-1.5 h-4 font-semibold border">Missing</Badge>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/75 backdrop-blur-md">
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div 
            initial={{ x: '100%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 210 }}
            className="relative z-10 w-full max-w-4xl h-full bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-100"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Full Raw Data Parsing System</h3>
                  <p className="text-xs text-slate-400">Step {step}: {step === 1 ? 'Paste Raw Data or Screenshot' : 'Review & Verify Mapped Fields'}</p>
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" className="text-slate-400 hover:text-white rounded-xl" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {step === 1 ? (
                /* STEP 1: INPUT BLOCK */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">Raw Source Input</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Supports plain text, tracking URLs, JSON, and screenshots (Ctrl+V)</p>
                    </div>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline" 
                      className="h-8 border-slate-800 text-slate-300 hover:text-white hover:bg-white/5 gap-1.5 rounded-xl"
                      onClick={handleQuickPaste}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      Quick Paste Sample ({quickPasteIndex + 1}/4)
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Image Upload Dropzone / pasted preview */}
                    <div className="md:col-span-1 border border-white/10 rounded-2xl bg-slate-900/40 p-4 flex flex-col items-center justify-center text-center relative hover:border-purple-500/50 transition-all group min-h-[220px]">
                      {pastedImagePreview ? (
                        <div className="absolute inset-0 p-3 flex flex-col items-center justify-center bg-slate-950/40 rounded-2xl">
                          <img 
                            src={pastedImagePreview} 
                            alt="Uploaded preview" 
                            className="max-h-[140px] rounded-lg object-contain shadow-lg border border-white/10 bg-slate-900" 
                          />
                          <div className="flex items-center gap-2 mt-3 w-full justify-center">
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">Image loaded</span>
                            <Button 
                              type="button" 
                              size="icon" 
                              variant="destructive" 
                              className="h-6 w-6 rounded-lg hover:bg-red-500 hover:text-white text-slate-300"
                              onClick={() => setPastedImagePreview(null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-4 w-full h-full p-4">
                          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-200">Upload or Paste Image</p>
                            <p className="text-[10px] text-slate-500">PNG, JPG, WebP up to 10MB</p>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            className="text-[10px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 file:cursor-pointer cursor-pointer bg-slate-950 border border-white/5 rounded-xl p-1 pr-3 shadow-inner focus:outline-none" 
                          />
                        </div>
                      )}
                    </div>

                    {/* Raw Text Input Card */}
                    <div 
                      className="md:col-span-2 relative border border-white/10 rounded-2xl bg-slate-900/40 p-4 focus-within:border-purple-500/50 transition-all flex flex-col justify-between"
                      onPaste={handlePaste}
                    >
                      <Textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={`Paste raw clipboard data or OCR text appears here...\n\nSupports:\n• Unstructured Text descriptions\n• Tracking link URLs\n• JSON Offer payloads\n• Drag & drop or upload screenshots on the left!`}
                        rows={8}
                        style={{ color: '#ffffff', backgroundColor: 'transparent' }}
                        className="w-full border-0 focus-visible:ring-0 text-sm placeholder-slate-500 resize-none font-mono flex-1 min-h-[150px]"
                      />

                      {isOcrLoading && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 rounded-2xl z-10">
                          <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                          <span className="text-xs text-slate-300 font-semibold">{ocrProgress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {inputText.trim() && (
                    <div className="flex justify-end pt-2">
                      <Button 
                        type="button"
                        size="lg"
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl gap-2 h-12 shadow-lg transition-all px-8"
                        onClick={handleParse}
                        disabled={isParsing}
                      >
                        {isParsing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 text-purple-200 animate-bounce" />
                        )}
                        Extract & Parse Data
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* STEP 2: REVIEW & EDIT PREVIEW */
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        Review Extracted Offer Fields
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Please review, complete, and modify any extracted fields before final insertion.</p>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setStep(1)} 
                      className="text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                    >
                      ← Back to Input
                    </Button>
                  </div>

                  {parsedOffer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* CARD 1: IDENTIFICATION */}
                      <Card className="bg-slate-900/40 border-white/5 shadow-xl rounded-2xl overflow-hidden">
                        <CardHeader className="bg-slate-900/60 p-4 border-b border-white/5 flex flex-row items-center gap-2 space-y-0">
                          <Plus className="w-4 h-4 text-purple-400" />
                          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Offer Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-xs">
                          {/* Offer ID */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Offer ID (Campaign ID) *</span>
                              {getConfidenceBadge(parsedOffer.campaign_id.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.campaign_id.value}
                              onChange={e => handleFieldChange('campaign_id', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Offer Name */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Offer Name *</span>
                              {getConfidenceBadge(parsedOffer.name.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.name.value}
                              onChange={e => handleFieldChange('name', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500 font-semibold font-semibold"
                            />
                          </div>

                          {/* Vertical / Category */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Vertical / Category</span>
                              {getConfidenceBadge(parsedOffer.vertical.confidence)}
                            </div>
                            <select 
                              value={parsedOffer.vertical.value}
                              onChange={e => handleFieldChange('vertical', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="w-full h-9 border border-white/10 text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                              {['Lifestyle', 'Finance', 'Surveys', 'Casino', 'Utilities', 'Gaming', 'Crypto', 'Dating', 'E-Commerce', 'Mobile'].map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>

                          {/* Partner / Network */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Partner / Network</span>
                              {getConfidenceBadge(parsedOffer.network.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.network.value}
                              onChange={e => handleFieldChange('network', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Image URL */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Image / Logo URL</span>
                              {getConfidenceBadge(parsedOffer.image.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.image.value}
                              onChange={e => handleFieldChange('image', e.target.value)}
                              placeholder="https://example.com/logo.png"
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* CARD 2: PAYOUT & CAP */}
                      <Card className="bg-slate-900/40 border-white/5 shadow-xl rounded-2xl overflow-hidden">
                        <CardHeader className="bg-slate-900/60 p-4 border-b border-white/5 flex flex-row items-center gap-2 space-y-0">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Payouts & Limits</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-xs">
                          {/* Payout */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Publisher Payout</span>
                              {getConfidenceBadge(parsedOffer.payout.confidence)}
                            </div>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                              <Input 
                                type="number"
                                step="0.01"
                                value={parsedOffer.payout.value || ''}
                                onChange={e => handleFieldChange('payout', parseFloat(e.target.value) || 0)}
                                style={{ color: '#34d399', backgroundColor: '#020617' }}
                                className="h-9 pl-8 border-white/10 text-xs font-bold rounded-lg focus:ring-purple-500 placeholder-slate-500"
                              />
                            </div>
                          </div>

                          {/* Revenue */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Network Revenue (Our Earn)</span>
                              {getConfidenceBadge(parsedOffer.revenue.confidence)}
                            </div>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                              <Input 
                                type="number"
                                step="0.01"
                                value={parsedOffer.revenue.value || ''}
                                onChange={e => handleFieldChange('revenue', parseFloat(e.target.value) || 0)}
                                style={{ color: '#ffffff', backgroundColor: '#020617' }}
                                className="h-9 pl-8 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                              />
                            </div>
                          </div>

                          {/* Currency */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Currency</span>
                              {getConfidenceBadge(parsedOffer.currency.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.currency.value}
                              onChange={e => handleFieldChange('currency', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Daily Cap */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Daily Conversion Cap</span>
                              {getConfidenceBadge(parsedOffer.daily_cap.confidence)}
                            </div>
                            <Input 
                              type="number"
                              value={parsedOffer.daily_cap.value || ''}
                              onChange={e => handleFieldChange('daily_cap', parseInt(e.target.value) || 0)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* CARD 3: TARGETING */}
                      <Card className="bg-slate-900/40 border-white/5 shadow-xl rounded-2xl overflow-hidden md:col-span-2">
                        <CardHeader className="bg-slate-900/60 p-4 border-b border-white/5 flex flex-row items-center gap-2 space-y-0">
                          <Globe className="w-4 h-4 text-blue-400" />
                          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Targeting Rules</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Countries */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Countries (Comma-separated codes)</span>
                              {getConfidenceBadge(parsedOffer.countries.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.countries.value.join(', ')}
                              onChange={e => handleFieldChange('countries', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))}
                              placeholder="US, CA, GB"
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Device Targeting */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Device Targeting</span>
                              {getConfidenceBadge(parsedOffer.device_targeting.confidence)}
                            </div>
                            <select 
                              value={parsedOffer.device_targeting.value}
                              onChange={e => handleFieldChange('device_targeting', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="w-full h-9 border border-white/10 text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                              <option value="all">All Devices</option>
                              <option value="mobile">Mobile Only</option>
                              <option value="desktop">Desktop Only</option>
                            </select>
                          </div>

                          {/* OS Targeting */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">OS Targeting</span>
                              {getConfidenceBadge(parsedOffer.os_targeting.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.os_targeting.value.join(', ')}
                              onChange={e => handleFieldChange('os_targeting', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                              placeholder="iOS, Android, Windows"
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Browser Targeting */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Browser Targeting</span>
                              {getConfidenceBadge(parsedOffer.browser_targeting.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.browser_targeting.value.join(', ')}
                              onChange={e => handleFieldChange('browser_targeting', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                              placeholder="Chrome, Safari, Firefox"
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* CARD 4: TRACKING & SETUP */}
                      <Card className="bg-slate-900/40 border-white/5 shadow-xl rounded-2xl overflow-hidden md:col-span-2">
                        <CardHeader className="bg-slate-900/60 p-4 border-b border-white/5 flex flex-row items-center gap-2 space-y-0">
                          <Link className="w-4 h-4 text-indigo-400" />
                          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Tracking & Setup</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-xs">
                          {/* Target URL */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Target URL (Click/Tracking Link) *</span>
                              {getConfidenceBadge(parsedOffer.target_url.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.target_url.value}
                              onChange={e => handleFieldChange('target_url', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Preview URL */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Preview URL (Landing/Offer Page)</span>
                              {getConfidenceBadge(parsedOffer.preview_url.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.preview_url.value}
                              onChange={e => handleFieldChange('preview_url', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Payout Model / Flow */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-semibold">Flow Type (Payout Model)</span>
                                {getConfidenceBadge(parsedOffer.payout_model.confidence)}
                              </div>
                              <select 
                                value={parsedOffer.payout_model.value}
                                onChange={e => handleFieldChange('payout_model', e.target.value)}
                                style={{ color: '#ffffff', backgroundColor: '#020617' }}
                                className="w-full h-9 border border-white/10 text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                {['CPA', 'CPL', 'CPI', 'CPS', 'RevShare', 'CPM'].map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            {/* Conversion Goal */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-semibold">Conversion Goal</span>
                                {getConfidenceBadge(parsedOffer.conversion_goal.confidence)}
                              </div>
                              <Input 
                                value={parsedOffer.conversion_goal.value}
                                onChange={e => handleFieldChange('conversion_goal', e.target.value)}
                                style={{ color: '#ffffff', backgroundColor: '#020617' }}
                                className="h-9 border-white/10 text-xs rounded-lg focus:ring-purple-500 placeholder-slate-500"
                              />
                            </div>
                          </div>

                          {/* Postback URL */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Postback URL</span>
                              {getConfidenceBadge(parsedOffer.postback_url.confidence)}
                            </div>
                            <Input 
                              value={parsedOffer.postback_url.value}
                              onChange={e => handleFieldChange('postback_url', e.target.value)}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="h-9 border-white/10 text-xs font-mono rounded-lg focus:ring-purple-500 placeholder-slate-500"
                            />
                          </div>

                          {/* Description */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">Description / Notes</span>
                              {getConfidenceBadge(parsedOffer.description.confidence)}
                            </div>
                            <Textarea 
                              value={parsedOffer.description.value}
                              onChange={e => handleFieldChange('description', e.target.value)}
                              rows={3}
                              style={{ color: '#ffffff', backgroundColor: '#020617' }}
                              className="border-white/10 text-xs rounded-lg placeholder-slate-500 focus:ring-purple-500"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bulk Submission Overlay */}
            <AnimatePresence>
              {isSubmitting && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 z-[110] space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                  <div className="text-center space-y-1">
                    <h4 className="text-lg font-bold text-white">Inserting Offer Into Database</h4>
                    <p className="text-xs text-slate-400">Syncing with active campaigns table...</p>
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Footer Actions */}
            {step === 2 && parsedOffer && (
              <div className="p-6 border-t border-white/10 bg-slate-900/95 flex gap-3">
                <Button 
                  type="button"
                  style={{ color: '#cbd5e1', borderColor: '#334155', backgroundColor: '#1e293b' }}
                  className="flex-1 h-12 font-semibold rounded-xl hover:bg-slate-800 hover:text-white border"
                  onClick={() => {
                    setParsedOffer(null);
                    setStep(1);
                  }}
                >
                  Edit Raw Input
                </Button>
                <Button 
                  type="button"
                  className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all gap-1.5"
                  onClick={handleConfirmAndAdd}
                >
                  <CheckSquare className="w-4 h-4 text-purple-200" />
                  Confirm & Add Offer
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
