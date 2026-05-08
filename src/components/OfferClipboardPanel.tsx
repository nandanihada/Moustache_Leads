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
  Smartphone,
  ChevronRight,
  ArrowRight,
  History
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
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [liveOffers, setLiveOffers] = useState<FullParsedOffer[]>([]);
  const [extractedOffers, setExtractedOffers] = useState<any[]>([]);
  const [selectedOfferIndices, setSelectedOfferIndices] = useState<number[]>([]);
  const [bulkQueue, setBulkQueue] = useState<any[]>([]);
  const [showOfferPicker, setShowOfferPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Editable fields state
  const [parsedOffer, setParsedOffer] = useState<FullParsedOffer | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step2Tab, setStep2Tab] = useState<'edit' | 'queue' | 'history'>('edit');
  const [completedOffers, setCompletedOffers] = useState<any[]>(() => {
    const saved = localStorage.getItem('clipboard_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist history to localStorage
  useEffect(() => {
    localStorage.setItem('clipboard_history', JSON.stringify(completedOffers));
  }, [completedOffers]);

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

  // Initialize Tesseract CDN script
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputText.trim()) {
        const parsed = performAdvancedParsing(inputText);
        setLiveOffers(parsed);
      } else {
        setLiveOffers([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [inputText]);
  
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const mapAiOfferToParsed = (aiOffer: any): FullParsedOffer => {
    const setField = <T,>(val: T, source: string, required: boolean = false): FieldState<T> => ({
      value: val,
      confidence: val ? 'high' : (required ? 'none' : 'low'),
      source: source || 'Groq AI'
    });

    return {
      campaign_id: setField(aiOffer.offer_id || '', 'Groq AI', true),
      name: setField(aiOffer.offer_name || '', 'Groq AI', true),
      payout: setField(parseFloat(aiOffer.publisher_payout) || 0, 'Groq AI', true),
      revenue: setField(parseFloat(aiOffer.network_revenue) || 0, 'Groq AI'),
      currency: setField(aiOffer.payout_currency || 'USD', 'Groq AI'),
      countries: setField(typeof aiOffer.countries === 'string' ? aiOffer.countries.split(',').map((c: string) => c.trim()) : (Array.isArray(aiOffer.countries) ? aiOffer.countries : []), 'Groq AI'),
      device_targeting: setField(String(aiOffer.device_targeting || '').toLowerCase() === 'mobile' ? 'mobile' : (String(aiOffer.device_targeting || '').toLowerCase() === 'desktop' ? 'desktop' : 'all'), 'Groq AI'),
      os_targeting: setField(typeof aiOffer.os_targeting === 'string' ? aiOffer.os_targeting.split(',').map((c: string) => c.trim()) : (Array.isArray(aiOffer.os_targeting) ? aiOffer.os_targeting : []), 'Groq AI'),
      browser_targeting: setField([], 'Groq AI'),
      vertical: setField(aiOffer.vertical || 'Lifestyle', 'Groq AI'),
      network: setField('', 'Groq AI'),
      target_url: setField(aiOffer.target_url || '', 'Groq AI', true),
      preview_url: setField(aiOffer.preview_url || '', 'Groq AI'),
      publisher: setField('', 'Groq AI'),
      daily_cap: setField(parseInt(aiOffer.daily_cap) || 0, 'Groq AI'),
      payout_model: setField(aiOffer.flow_type || 'CPA', 'Groq AI'),
      conversion_goal: setField('lead', 'Groq AI'),
      status: setField(aiOffer.status === 'active' ? 'active' : 'inactive', 'Groq AI'),
      description: setField(`${aiOffer.description || ''}\n\n[Incent: ${aiOffer.incent}]\n[Approval: ${aiOffer.requires_approval}]\n[Proxy: ${aiOffer.block_proxy}]`.trim(), 'Groq AI'),
      postback_url: setField('https://moustacheleads.com/api/postback?click_id={click_id}&payout={payout}', 'System Default'),
      image: setField('', 'Groq AI')
    };
  };

  const handleAiExtract = async () => {
    if (activeTab === 'text' && !inputText.trim()) {
      toast({ title: "Input Required", description: "Please paste offer data first.", variant: "destructive" });
      return;
    }
    if (activeTab === 'image' && !selectedFile && !pastedImagePreview) {
      toast({ title: "Image Required", description: "Please upload or paste an image first.", variant: "destructive" });
      return;
    }

    setIsAiLoading(true);
    try {
      let payload: any = {};
      if (activeTab === 'text') {
        payload.text = inputText;
      } else {
        const base64 = pastedImagePreview || (selectedFile ? await fileToBase64(selectedFile) : '');
        payload.image = base64;
      }

      const response = await adminOfferApi.aiExtractOffers(payload);

      if (response.offers && response.offers.length > 0) {
        setExtractedOffers(response.offers);
        if (response.offers.length === 1) {
          setParsedOffer(mapAiOfferToParsed(response.offers[0]));
          setStep(2);
        } else {
          setShowOfferPicker(true);
        }
      } else {
        throw new Error("AI could not find any offers in the input.");
      }
    } catch (err: any) {
      console.error("AI Extraction Error:", err);
      toast({
        title: "AI Extraction Failed",
        description: err.message || "Groq AI could not process this request. Try the Old Regex Parser instead.",
        variant: "destructive",
        action: (
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={() => handleParse({ preventDefault: () => { } } as any)}
          >
            Use Old Parser
          </Button>
        )
      });
    } finally {
      setIsAiLoading(false);
    }
  };

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
      setSelectedFile(file);
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
      const offers = performAdvancedParsing(inputText);
      setIsParsing(false);

      if (offers.length === 0) {
        toast({ title: "No Offers Found", description: "The regex parser couldn't find any valid offer patterns.", variant: "destructive" });
        return;
      }

      setExtractedOffers(offers);
      if (offers.length === 1) {
        setParsedOffer(offers[0]);
        setStep(2);
        toast({ title: "Parsing Completed", description: "Mapped data into 20 fields with confidence levels!" });
      } else {
        setSelectedOfferIndices([]);
        setShowOfferPicker(true);
        toast({ title: "Multiple Offers Detected", description: `Found ${offers.length} potential offers to review.` });
      }
    }, 500);
  };

  // Advanced Multi-Field Parsing Engine
  const performAdvancedParsing = (text: string): FullParsedOffer[] => {
    const cleanText = text.replace(/\r\n/g, '\n').trim();
    if (!cleanText) return [];

    const offerBlocks: string[] = [];
    const lines = cleanText.split('\n');
    let currentBlock = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip common dashboard headers that aren't offers
      const lower = line.toLowerCase();
      if (
        lower.includes('monthly earnings') || 
        lower.includes('offers management') || 
        lower.includes('active offers (') ||
        lower.includes('hit limit') ||
        lower.includes('conversion goal') ||
        lower.includes('recycle bin') ||
        lower.includes('payout/revenue')
      ) {
        continue;
      }

      // Trigger new block if line contains ID patterns:
      // 1. ML- followed by digits
      // 2. XX-XXXXXXX (Hyphenated IDs)
      // 3. Pure Numeric 5-10 digits
      const isNewOfferId = 
        /(^|\s)ML-\d{4,9}(\s|$)/i.test(line) || 
        /(^|\s)\d{2,4}-\d{5,10}(\s|$)/.test(line) || 
        /^\d{5,10}(\s|$)/.test(line) || 
        lower.startsWith('offer id:') || 
        lower.startsWith('campaign id:');

      if (isNewOfferId && currentBlock.trim() && currentBlock.length > 20) {
        offerBlocks.push(currentBlock.trim());
        currentBlock = line + '\n';
      } else {
        currentBlock += line + '\n';
      }
    }
    if (currentBlock.trim()) offerBlocks.push(currentBlock.trim());
    if (offerBlocks.length === 0 && cleanText) offerBlocks.push(cleanText);

    return offerBlocks.map(block => {
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

      const countryCodeMap: Record<string, string> = {
        'austria': 'AT', 'australia': 'AU', 'canada': 'CA', 'germany': 'DE', 'norway': 'NO', 
        'ireland': 'IE', 'switzerland': 'CH', 'new zealand': 'NZ', 'denmark': 'DK', 
        'mexico': 'MX', 'morocco': 'MA', 'belgium': 'BE', 'united states': 'US', 
        'united kingdom': 'GB', 'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'india': 'IN'
      };

      const blockCleanText = block.trim();
      const blockLines = blockCleanText.split('\n');
      let foundUrl = '';
      let collectedCountries: string[] = [];

      for (let i = 0; i < blockLines.length; i++) {
        const line = blockLines[i].trim();
        if (!line) continue;

        // 1. Table Row Detection (ID Name Payout on same line)
        if (/(ML-)?\d{4,8}\s+/i.test(line)) {
          const idMatch = line.match(/((?:ML-)?\d{4,8})\s+(.*)$/i);
          if (idMatch && !parsed.campaign_id.value) {
            parsed.campaign_id = { value: idMatch[1].replace(/^ML-/i, ''), confidence: 'high', source: 'Table ID' };
            const remaining = idMatch[2].trim();
            
            // Try to find payout (e.g. $1.40, €45.000, 0.708, €0.97)
            const payoutMatch = remaining.match(/([€$£]\d+[\d,.]*|\d+[\d,.]*\s*[€$£]|CPA\s*[€$£]\d+[\d,.]*|\$\d+\.\d+)/i);
            if (payoutMatch) {
              const val = payoutMatch[0].match(/[\d.]+/);
              if (val) parsed.payout = { value: parseFloat(val[0].replace(/,/g, '')), confidence: 'high', source: 'Table Payout' };
              if (payoutMatch[0].includes('€')) parsed.currency = { value: 'EUR', confidence: 'high', source: 'Currency Sign' };
              
              // Name is likely everything between ID and Payout
              const namePart = remaining.split(payoutMatch[0])[0].trim();
              if (namePart && !parsed.name.value) {
                // Clean up name
                const cleanName = namePart.split(/\s(All Users|Approved|Pending|active|require approval)\b/i)[0];
                parsed.name = { value: cleanName, confidence: 'high', source: 'Table Name' };
              }
            }
          }
        }

        // 2. Label-based detection
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.startsWith('campaign id:') || lowerLine.startsWith('offer id:')) {
          const val = line.split(':')[1].trim().replace(/^ML-/, '');
          parsed.campaign_id = { value: val, confidence: 'high', source: 'Labeled ID' };
        }
        else if (lowerLine.startsWith('offer name:') || lowerLine.startsWith('name:')) {
          const val = line.split(':')[1].trim();
          parsed.name = { value: val, confidence: 'high', source: 'Labeled Name' };
        }
        else if (lowerLine.startsWith('payout:') || lowerLine.startsWith('publisher payout:')) {
          const valStr = line.split(':')[1].trim();
          const match = valStr.match(/[\d.]+/);
          if (match) parsed.payout = { value: parseFloat(match[0].replace(/,/g, '')), confidence: 'high', source: 'Labeled Payout' };
          if (valStr.includes('$')) parsed.currency = { value: 'USD', confidence: 'high', source: 'Currency Sign' };
        }
        else if (lowerLine.startsWith('tracking url:') || lowerLine.startsWith('link:')) {
          // Look at next line if current line is just a label
          const potentialUrl = line.split(':')[1]?.trim();
          if (potentialUrl && (potentialUrl.startsWith('http') || potentialUrl.includes('.'))) {
            parsed.target_url = { value: potentialUrl, confidence: 'high', source: 'Labeled URL' };
          } else if (i + 1 < blockLines.length) {
            const nextLine = blockLines[i + 1].trim();
            if (nextLine.startsWith('http')) {
              parsed.target_url = { value: nextLine, confidence: 'high', source: 'Post-Label URL' };
            }
          }
        }
        else if (lowerLine.startsWith('country:') || lowerLine.startsWith('geos:')) {
          const val = line.split(':')[1].trim().toUpperCase();
          collectedCountries.push(...val.split(/[\/, ]+/).filter(s => s.length === 2));
        }

        // 4. Fallback: Positional/Regex Logic (Name on next line)
        if (!parsed.campaign_id.value && (/^\d{5,10}$/.test(line) || /^\d{2,4}-\d{5,10}$/.test(line))) {
          parsed.campaign_id = { value: line, confidence: 'high', source: 'Position ID' };
          
          // Look ahead for name (usually 1-2 lines down)
          for (let j = 1; j <= 2; j++) {
            if (i + j < blockLines.length) {
              const nextLine = blockLines[i + j].trim();
              if (nextLine && !nextLine.includes(':') && !nextLine.startsWith('$') && !nextLine.includes('%') && nextLine.length > 3) {
                if (!parsed.name.value) {
                  parsed.name = { value: nextLine, confidence: 'high', source: 'Position Name' };
                }
              }
            }
          }
        }

        // 5. Standalone Payout Detection (e.g. $42.58)
        if (!parsed.payout.value || parsed.payout.value === 0) {
          const standalonePayout = line.match(/^([€$£]\d+[\d,.]*)$/);
          if (standalonePayout) {
            parsed.payout = { value: parseFloat(standalonePayout[1].replace(/[€$£,]/g, '')), confidence: 'high', source: 'Standalone Payout' };
            if (standalonePayout[1].includes('$')) parsed.currency = { value: 'USD', confidence: 'high', source: 'Currency Sign' };
            else if (standalonePayout[1].includes('€')) parsed.currency = { value: 'EUR', confidence: 'high', source: 'Currency Sign' };
          }
        }

        // 6. OS & Device Keyword Detection
        if (lowerLine.includes('android')) {
          const currentOs = parsed.os_targeting.value || [];
          if (!currentOs.includes('Android')) parsed.os_targeting = { value: [...currentOs, 'Android'], confidence: 'high', source: 'OS Keyword' };
          parsed.device_targeting = { value: 'mobile', confidence: 'high', source: 'OS Keyword' };
        }
        if (lowerLine.includes('iphone') || lowerLine.includes('ipad') || lowerLine.includes('ios')) {
          const currentOs = parsed.os_targeting.value || [];
          if (!currentOs.includes('iOS')) parsed.os_targeting = { value: [...currentOs, 'iOS'], confidence: 'high', source: 'OS Keyword' };
          parsed.device_targeting = { value: 'mobile', confidence: 'high', source: 'OS Keyword' };
        }
        if (lowerLine.includes('desktop') || lowerLine.includes('windows') || lowerLine.includes('mac')) {
          parsed.device_targeting = { value: 'desktop', confidence: 'high', source: 'Device Keyword' };
        }

        // 7. Standalone Country Code List Detection (e.g. US, CA, AU)
        if (!parsed.countries.value || parsed.countries.value.length === 0) {
          const codes = line.split(/[\s,]+/);
          const validCodes = codes.filter(c => /^[A-Z]{2}$/.test(c.trim().toUpperCase()));
          if (validCodes.length >= 2 || (validCodes.length === 1 && line.length < 5)) {
            collectedCountries.push(...validCodes.map(c => c.trim().toUpperCase()));
          }
        }
        
        // 8. Vertical Keyword Mapping
        if (parsed.name.value) {
          const nameLower = parsed.name.value.toLowerCase();
          if (nameLower.includes('game') || nameLower.includes('puzzle') || nameLower.includes('merge') || nameLower.includes('quest')) {
            parsed.vertical = { value: 'Gaming', confidence: 'high', source: 'Name Keyword' };
          } else if (nameLower.includes('casino') || nameLower.includes('bet') || nameLower.includes('slot')) {
            parsed.vertical = { value: 'Gambling', confidence: 'high', source: 'Name Keyword' };
          } else if (nameLower.includes('dating') || nameLower.includes('meet')) {
            parsed.vertical = { value: 'Dating', confidence: 'high', source: 'Name Keyword' };
          }
        }

        // Country detection (handle names like "Austria")
        const countryMatch = line.match(/^Country[:\s]+(.*)$/i);
        if (countryMatch) {
          const val = countryMatch[1].trim().toLowerCase();
          if (countryCodeMap[val]) {
            collectedCountries.push(countryCodeMap[val]);
          } else {
            const geos = val.split(/[,\s]+/).map(s => s.trim().toUpperCase().replace(/[^A-Z]/g, '')).filter(s => s.length === 2);
            collectedCountries = [...collectedCountries, ...geos];
          }
        }

        // Payout detection (standalone €/$ values)
        if (line.includes('€') || line.includes('$') || line.includes('£')) {
          const isEur = line.includes('€');
          const isGbp = line.includes('£');
          parsed.currency = { value: isEur ? 'EUR' : (isGbp ? 'GBP' : 'USD'), confidence: 'high', source: 'Currency detection' };
          
          const payMatch = line.match(/(?:€|\$|£)\s*([0-9.,]+)/);
          if (payMatch) {
            const val = parseFloat(payMatch[1].replace(',', ''));
            if (!parsed.payout.value) parsed.payout = { value: val, confidence: 'high', source: 'Standalone currency line' };
            else if (!parsed.revenue.value) parsed.revenue = { value: val, confidence: 'high', source: 'Secondary currency line' };
          }
        }

        // Vertical detection
        const verticalKeywords = ['gambling', 'casino', 'financial', 'finance', 'survey', 'utility', 'crypto', 'dating', 'ecommerce', 'gaming'];
        const lineLower = line.toLowerCase();
        verticalKeywords.forEach(v => {
          if (lineLower.includes(v) && parsed.vertical.confidence !== 'high') {
            parsed.vertical = { value: v.charAt(0).toUpperCase() + v.slice(1), confidence: 'high', source: 'Vertical keyword match' };
          }
        });

        // Incent / Model detection
        if (lineLower.includes('non incent') || lineLower.includes('non-incent')) {
          parsed.payout_model = { value: 'Non-Incent', confidence: 'high', source: 'Incent flag' };
        } else if (lineLower.includes('incent')) {
          parsed.payout_model = { value: 'Incent', confidence: 'high', source: 'Incent flag' };
        } else if (lineLower.match(/^(cpa|cpl|cpi|cps|revshare|cpm)$/)) {
          parsed.payout_model = { value: line.toUpperCase(), confidence: 'high', source: 'Model keyword' };
        }

        // URL detection
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch && !foundUrl) {
          foundUrl = urlMatch[1];
          parsed.target_url = { value: foundUrl, confidence: 'high', source: 'Detected URL' };
        }
      }

      if (collectedCountries.length > 0) {
        parsed.countries = { value: Array.from(new Set(collectedCountries)), confidence: 'high', source: 'Cumulative Geo Collection' };
      }

      if (!parsed.postback_url.value) {
        parsed.postback_url = { value: 'https://moustacheleads.com/api/postback?click_id={click_id}&payout={payout}', confidence: 'low', source: 'System Default' };
      }

      return parsed;
    });
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
      setCompletedOffers(prev => [{
        ...submitData,
        timestamp: new Date().toLocaleTimeString(),
        status: 'Updated'
      }, ...prev]);
      toast({
        title: "Offer Updated",
        description: `Existing offer "${parsedOffer.name.value}" has been updated successfully.`,
        variant: "default"
      });
    } else {
      // CREATE NEW
      response = await adminOfferApi.createOffer(submitData as any);
      setCompletedOffers(prev => [{
        ...submitData,
        timestamp: new Date().toLocaleTimeString(),
        status: 'Created'
      }, ...prev]);
      toast({
        title: "Offer Created",
        description: `New offer "${parsedOffer.name.value}" has been added to the database.`,
        variant: "default"
      });
    }

    // Check if there are more offers in the bulk queue
    if (bulkQueue.length > 0) {
      const nextOffer = bulkQueue[0];
      setBulkQueue(prev => prev.slice(1));
      setParsedOffer(nextOffer.campaign_id ? nextOffer : mapAiOfferToParsed(nextOffer));
      toast({
        title: "Offer Saved",
        description: `Loading next offer: ${nextOffer.name?.value || nextOffer.offer_name || 'Offer'}. ${bulkQueue.length} remaining.`,
        variant: "default"
      });
      // Stay in Step 2 for the next offer
    } else {
      onOffersCreated?.();
      onClose();
      toast({
        title: "All Offers Processed",
        description: "Successfully finished the bulk extraction queue.",
        variant: "default"
      });
    }
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
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="w-full h-full flex flex-col relative"
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
                    className="h-8 border-emerald-500/20 text-emerald-400 hover:text-white hover:bg-emerald-500/10 gap-1.5 rounded-xl transition-all"
                    onClick={() => {
                      setStep(2);
                      setStep2Tab('history');
                    }}
                  >
                    <History className="w-3.5 h-3.5" />
                    Session History ({completedOffers.length})
                  </Button>
                </div>

                {/* TABBED INPUT SYSTEM */}
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex border-b border-white/5 bg-slate-950/40 p-1">
                    <button
                      onClick={() => setActiveTab('text')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all rounded-xl ${activeTab === 'text' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <FileText className="w-4 h-4" />
                      Paste Raw Text
                    </button>
                    <button
                      onClick={() => setActiveTab('image')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all rounded-xl ${activeTab === 'image' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Smartphone className="w-4 h-4" />
                      Upload/Paste Screenshot
                    </button>
                  </div>

                  <div className="p-4">
                    {activeTab === 'text' ? (
                      <div className="space-y-4">
                        <Textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder={`Paste raw clipboard data from any affiliate network...\n\nGroq AI will intelligently extract IDs, payouts, geos, and targeting rules automatically.`}
                          rows={10}
                          style={{ color: '#ffffff', backgroundColor: 'transparent' }}
                          className="w-full bg-slate-950/50 border border-white/10 text-white font-mono text-sm placeholder:text-slate-600 focus:border-purple-500/50 focus:ring-0 transition-all rounded-xl resize-none"
                        />
                      </div>
                    ) : (
                      <div
                        className="min-h-[250px] border-2 border-dashed border-white/10 rounded-xl bg-slate-950/30 flex flex-col items-center justify-center relative group hover:border-purple-500/30 transition-all"
                      >
                        {pastedImagePreview ? (
                          <div className="p-4 flex flex-col items-center gap-4">
                            <img src={pastedImagePreview} className="max-h-[180px] rounded-lg border border-white/10 shadow-2xl" />
                            <Button variant="ghost" size="sm" onClick={() => setPastedImagePreview(null)} className="text-red-400 hover:text-red-300 rounded-xl">
                              <Trash2 className="w-4 h-4 mr-2" /> Remove Image
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center p-6 space-y-4">
                            <div className="p-4 bg-purple-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-purple-400 group-hover:scale-110 transition-transform">
                              <Upload className="w-8 h-8" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">Paste Screenshot or Upload</p>
                              <p className="text-xs text-slate-500 mt-1">Ctrl+V anywhere or drag & drop files</p>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                            />
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-white/10 text-slate-300 rounded-xl">
                              Select File
                            </Button>
                          </div>
                        )}

                        {isOcrLoading && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 rounded-xl z-10">
                            <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                            <span className="text-xs text-slate-300 font-semibold">{ocrProgress}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* LIVE PREVIEW SECTION */}
                {liveOffers.length > 0 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-purple-400" />
                        Detected Offers ({liveOffers.length})
                      </h4>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            if (selectedOfferIndices.length === liveOffers.length) setSelectedOfferIndices([]);
                            else setSelectedOfferIndices(liveOffers.map((_, i) => i));
                          }}
                          className="text-[11px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-tight flex items-center gap-1.5 transition-colors"
                        >
                          {selectedOfferIndices.length === liveOffers.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          {selectedOfferIndices.length === liveOffers.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                          {selectedOfferIndices.length} Selected
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {liveOffers.map((off, idx) => {
                        const isSelected = selectedOfferIndices.includes(idx);
                        return (
                          <div 
                            key={idx}
                            onClick={() => {
                              setSelectedOfferIndices(prev => 
                                isSelected ? prev.filter(i => i !== idx) : [...prev, idx]
                              );
                            }}
                            className={`bg-slate-900/60 border rounded-2xl p-5 cursor-pointer transition-all relative group overflow-hidden ${
                              isSelected ? 'border-purple-500 bg-purple-600/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-white/5 hover:border-white/20 hover:bg-slate-900'
                            }`}
                          >
                            <div className={`absolute top-0 left-0 w-1 h-full bg-purple-600 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                            
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-purple-600 border-purple-600' : 'border-white/20'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                  #{off.campaign_id.value || 'N/A'}
                                </span>
                              </div>
                              <div className="text-emerald-400 font-bold text-sm">
                                {off.currency.value === 'EUR' ? '€' : (off.currency.value === 'GBP' ? '£' : '$')}{off.payout.value}
                              </div>
                            </div>
                            
                            <h5 className="font-bold text-white mb-3 line-clamp-1">{off.name.value || 'Untitled Offer'}</h5>
                            
                            <div className="space-y-1.5">
                              {[
                                { label: 'Vertical', value: off.vertical.value },
                                { label: 'Geo', value: off.countries.value.join(', ') || 'Global' },
                                { label: 'Network', value: off.network.value },
                                { label: 'Model', value: off.payout_model.value }
                              ].filter(f => f.value).map(f => (
                                <div key={f.label} className="flex justify-between text-[11px]">
                                  <span className="text-slate-500">{f.label}:</span>
                                  <span className="text-slate-300 font-medium truncate max-w-[150px]">{f.value}</span>
                                </div>
                              ))}
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setParsedOffer(off);
                                  setStep(2);
                                }}
                                className="text-[10px] text-slate-400 hover:text-white font-bold uppercase flex items-center gap-1 transition-colors"
                              >
                                Edit Details <ArrowRight className="w-3 h-3" />
                              </button>
                              {isSelected && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[9px] h-4">Selected</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedOfferIndices.length > 0 && (
                      <div className="pt-6 flex justify-center">
                        <Button
                          onClick={() => {
                            const selected = selectedOfferIndices.map(idx => liveOffers[idx]);
                            setBulkQueue(selected.slice(1));
                            setParsedOffer(selected[0]);
                            setStep(2);
                            toast({
                              title: "Bulk Review Started",
                              description: `Processing 1 of ${selected.length} offers: ${selected[0].name.value}`
                            });
                          }}
                          className="h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] gap-2 transition-all"
                        >
                          <Layers className="w-5 h-5" />
                          Review {selectedOfferIndices.length} Selected Offers
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              ) : (
              /* STEP 2: REVIEW & EDIT PREVIEW */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Step 2 Header / Tabs */}
                <div className="bg-slate-900/50 border-b border-white/5 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <button
                      onClick={() => setStep2Tab('edit')}
                      className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${
                        step2Tab === 'edit' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      1. Edit Current Offer
                    </button>
                    <button
                      onClick={() => setStep2Tab('queue')}
                      className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all flex items-center gap-2 ${
                        step2Tab === 'queue' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      2. Pending Queue
                      {bulkQueue.length > 0 && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[9px] h-3.5 px-1.5 font-black">
                          {bulkQueue.length}
                        </Badge>
                      )}
                    </button>
                    <button
                      onClick={() => setStep2Tab('history')}
                      className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all flex items-center gap-2 ${
                        step2Tab === 'history' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      3. Recently Added
                      {completedOffers.length > 0 && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] h-3.5 px-1.5 font-black">
                          {completedOffers.length}
                        </Badge>
                      )}
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setStep(1)}
                    className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3 rotate-180" /> Back to Input
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  {step2Tab === 'edit' ? (
                    <div className="max-w-6xl mx-auto space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div>
                          <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            Review Extracted Offer Fields
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">Please review, complete, and modify any extracted fields before final insertion.</p>
                        </div>
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
            ) : step2Tab === 'queue' ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                          <Layers className="w-6 h-6 text-purple-400" />
                          Processing Queue
                        </h3>
                      </div>
                      
                      {bulkQueue.length === 0 ? (
                        <div className="bg-slate-900/40 border border-dashed border-white/10 rounded-[32px] p-20 flex flex-col items-center justify-center text-center">
                          <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
                            <Clipboard className="w-8 h-8 text-slate-500" />
                          </div>
                          <h4 className="text-lg font-bold text-white">Queue is Empty</h4>
                          <p className="text-sm text-slate-500 mt-2 max-w-xs">All detected offers have been processed or skipped.</p>
                          <Button onClick={() => setStep(1)} variant="outline" className="mt-6 border-white/10 text-white">Add More Offers</Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {bulkQueue.map((off, idx) => (
                            <div key={idx} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black">
                                  {idx + 2}
                                </div>
                                <div>
                                  <h4 className="font-bold text-white group-hover:text-purple-300 transition-colors">{off.name?.value || off.offer_name || 'Untitled Offer'}</h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-slate-500 font-mono font-bold tracking-tight">ID: {off.campaign_id?.value || off.offer_id}</span>
                                    <span className="text-[10px] text-emerald-500/80 font-black uppercase tracking-tight">{off.currency?.value || off.payout_currency}{off.payout?.value || off.publisher_payout}</span>
                                  </div>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setBulkQueue(prev => prev.filter((_, i) => i !== idx))}
                                className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                          Processed Offers (Session Total: {completedOffers.length})
                        </h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setCompletedOffers([])}
                          className="border-white/10 text-slate-400 hover:text-white rounded-xl"
                        >
                          Clear Session History
                        </Button>
                      </div>

                      {completedOffers.length === 0 ? (
                        <div className="bg-slate-900/40 border border-dashed border-white/10 rounded-[32px] p-20 flex flex-col items-center justify-center text-center">
                          <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
                            <History className="w-8 h-8 text-slate-500" />
                          </div>
                          <h4 className="text-lg font-bold text-white">No Offers Added Yet</h4>
                          <p className="text-sm text-slate-500 mt-2 max-w-xs">Offers you save during this session will appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {completedOffers.map((off, idx) => (
                            <div key={idx} className="bg-slate-900/60 border border-emerald-500/10 rounded-2xl p-5 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                              <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                  <Check className="w-6 h-6" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-lg">{off.name}</h4>
                                  <div className="flex items-center gap-4 mt-1.5">
                                    <Badge className="bg-slate-800 text-slate-400 border-white/5 text-[9px] font-mono">ID: {off.campaign_id}</Badge>
                                    <span className="text-[11px] text-emerald-400 font-black uppercase">{off.currency}{off.payout}</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                      <Globe className="w-3 h-3" /> {off.countries.join(', ') || 'Global'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{off.status}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{off.timestamp}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
            <div className="p-6 border-t border-white/10 bg-slate-900/95 flex flex-col gap-4">
              {/* Bulk Queue Status Row */}
              {bulkQueue.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                      Bulk Processing Queue
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {bulkQueue.length} More Pending
                  </span>
                </div>
              )}

              {/* Explicit Validation Banner */}
              {step2Tab === 'edit' && parsedOffer && (!parsedOffer.campaign_id.value || !parsedOffer.name.value || !parsedOffer.target_url.value) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 animate-pulse">
                  <div className="p-1.5 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-red-400 uppercase tracking-tight">Insertion Blocked</h5>
                    <p className="text-[10px] text-red-500/80 font-bold">
                      Required missing: {[!parsedOffer.campaign_id.value && 'ID', !parsedOffer.name.value && 'Name', !parsedOffer.target_url.value && 'Target URL'].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl font-bold transition-all"
                  onClick={() => {
                    if (bulkQueue.length > 0) {
                      const nextOffer = bulkQueue[0];
                      setBulkQueue(prev => prev.slice(1));
                      setParsedOffer(nextOffer.campaign_id ? nextOffer : mapAiOfferToParsed(nextOffer));
                      toast({ title: "Offer Skipped", description: `Loading next: ${nextOffer.name?.value || nextOffer.offer_name || 'Offer'}` });
                    } else {
                      setStep(1);
                      setParsedOffer(null);
                    }
                  }}
                >
                  {bulkQueue.length > 0 ? 'Skip This Offer' : 'Go Back'}
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all gap-1.5"
                  onClick={handleConfirmAndAdd}
                >
                  <Check className="w-5 h-5" />
                  {bulkQueue.length > 0 ? `Save & Next (${bulkQueue.length} left)` : 'Confirm Add Offer'}
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Offer Picker Modal (if multiple detected) */}
        <AnimatePresence>
          {showOfferPicker && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-xl">
                      <Layers className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">Multiple Offers Detected</h4>
                      <p className="text-xs text-slate-400">Groq AI found {extractedOffers.length} offers. Which one would you like to process?</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowOfferPicker(false)} className="rounded-xl text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="p-6 max-h-[450px] overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button
                      onClick={() => {
                        if (selectedOfferIndices.length === extractedOffers.length) setSelectedOfferIndices([]);
                        else setSelectedOfferIndices(extractedOffers.map((_, i) => i));
                      }}
                      className="text-[11px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-tight flex items-center gap-1.5 transition-colors"
                    >
                      {selectedOfferIndices.length === extractedOffers.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {selectedOfferIndices.length === extractedOffers.length ? 'Deselect All' : 'Select All Offers'}
                    </button>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      {selectedOfferIndices.length} of {extractedOffers.length} Selected
                    </span>
                  </div>

                  {extractedOffers.map((off, idx) => {
                    const isSelected = selectedOfferIndices.includes(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedOfferIndices(prev =>
                            isSelected ? prev.filter(i => i !== idx) : [...prev, idx]
                          );
                        }}
                        className={`p-5 bg-slate-950/40 border rounded-2xl cursor-pointer transition-all group relative overflow-hidden ${isSelected ? 'border-purple-500 bg-purple-600/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                          }`}
                      >
                        <div className={`absolute top-0 left-0 w-1 h-full bg-purple-600 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-white/20'
                                }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <span className="text-[10px] font-mono text-purple-400 font-black tracking-widest uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                ID: {off.offer_id || 'N/A'}
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-100 group-hover:text-white transition-colors text-lg">
                              {off.offer_name || 'Untitled Offer'}
                            </h5>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-black text-emerald-400">
                              {off.payout_currency || '$'}{off.publisher_payout || '0.00'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">Payout</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Globe className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-medium truncate">{off.countries || 'Global'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="font-medium">{off.vertical || 'General'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 bg-slate-950/60 border-t border-white/5 flex flex-col gap-4">
                  <Button
                    disabled={selectedOfferIndices.length === 0}
                    onClick={() => {
                      const selected = selectedOfferIndices.map(idx => extractedOffers[idx]);
                      setBulkQueue(selected.slice(1)); // Store remaining
                      setParsedOffer(mapAiOfferToParsed(selected[0])); // Load first
                      setStep(2);
                      setShowOfferPicker(false);
                      toast({
                        title: "Bulk Review Started",
                        description: `Processing 1 of ${selected.length} offers: ${selected[0].offer_name}`
                      });
                    }}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Eye className="w-5 h-5" />
                    Preview {selectedOfferIndices.length} Selected Offers
                  </Button>
                  <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    Powered by Groq AI Llama 3 70B • Select all offers you want to add
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )}
  </AnimatePresence>
);
};

