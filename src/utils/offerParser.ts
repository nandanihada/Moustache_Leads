/**
 * Smart Offer Parser Utility
 * Parses raw input text, JSON, URLs, or multiple key-value pairs
 * and extracts Offer ID, Offer Name, Payout, Partner, and targeting fields with confidence levels.
 */

export interface ParsedOffer {
  campaign_id: { value: string; confidence: 'high' | 'low' | 'none'; label: string };
  name: { value: string; confidence: 'high' | 'low' | 'none'; label: string };
  payout: { value: number; confidence: 'high' | 'low' | 'none'; label: string };
  network: { value: string; confidence: 'high' | 'low' | 'none'; label: string };
  target_url: { value: string; confidence: 'high' | 'low' | 'none'; label: string };
  description: { value: string; confidence: 'high' | 'low' | 'none'; label: string };
  rawText?: string;
}

/**
 * Parses a single block of raw text or JSON and extracts offer details
 */
export const parseRawOffer = (text: string): ParsedOffer => {
  const cleanText = text.trim();
  
  // Default structure
  const result: ParsedOffer = {
    campaign_id: { value: '', confidence: 'none', label: 'Offer ID' },
    name: { value: '', confidence: 'none', label: 'Offer Name' },
    payout: { value: 0, confidence: 'none', label: 'Payout' },
    network: { value: '', confidence: 'none', label: 'Partner/Network' },
    target_url: { value: '', confidence: 'none', label: 'Target URL' },
    description: { value: '', confidence: 'none', label: 'Description' },
    rawText: text,
  };

  if (!cleanText) return result;

  // 1. Try JSON Parsing first
  if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
    try {
      const obj = JSON.parse(cleanText);
      
      // Extract Offer ID / Campaign ID
      const idVal = obj.campaign_id || obj.offer_id || obj.id || obj.campaignId || obj.offerId;
      if (idVal !== undefined) {
        result.campaign_id = { value: String(idVal).trim(), confidence: 'high', label: 'Auto-detected (JSON)' };
      }

      // Extract Name
      const nameVal = obj.name || obj.title || obj.offer_name || obj.offerName || obj.campaign_name;
      if (nameVal !== undefined) {
        result.name = { value: String(nameVal).trim(), confidence: 'high', label: 'Auto-detected (JSON)' };
      }

      // Extract Payout
      const payoutVal = obj.payout || obj.rate || obj.revenue || obj.price || obj.amount || obj.payout_amount;
      if (payoutVal !== undefined) {
        const num = parseFloat(String(payoutVal).replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          result.payout = { value: num, confidence: 'high', label: 'Auto-detected (JSON)' };
        }
      }

      // Extract Partner/Network
      const networkVal = obj.network || obj.partner || obj.partner_id || obj.source || obj.network_name;
      if (networkVal !== undefined) {
        result.network = { value: String(networkVal).trim(), confidence: 'high', label: 'Auto-detected (JSON)' };
      }

      // Extract Target URL
      const urlVal = obj.target_url || obj.url || obj.link || obj.tracking_url || obj.click_url;
      if (urlVal !== undefined) {
        result.target_url = { value: String(urlVal).trim(), confidence: 'high', label: 'Auto-detected (JSON)' };
      }

      // Extract Description
      const descVal = obj.description || obj.desc || obj.summary;
      if (descVal !== undefined) {
        result.description = { value: String(descVal).trim(), confidence: 'high', label: 'Auto-detected (JSON)' };
      }

      return result;
    } catch (e) {
      // JSON parsing failed, fallback to text parsing
      console.log('JSON parse failed in offerParser, falling back to text regex.', e);
    }
  }

  // 2. Parse Line-by-Line Key-Value Text or Regex
  const lines = cleanText.split('\n');
  
  // Keep track of extracted URLs for special tracking URL parsing
  let foundUrl = '';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Detect URL inside line
    const urlMatch = trimmedLine.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch && !foundUrl) {
      foundUrl = urlMatch[1];
    }

    // Try key-value splits (e.g. OfferID: VBFS6, Payout = $1.20)
    const kvMatch = trimmedLine.match(/^([^:|=]+)\s*[:|=]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const val = kvMatch[2].trim();

      if (['campaignid', 'offerid', 'id', 'cid'].includes(key)) {
        result.campaign_id = { value: val, confidence: 'high', label: 'Auto-detected (Key-Value)' };
      } else if (['name', 'title', 'offername', 'campaignname'].includes(key)) {
        result.name = { value: val, confidence: 'high', label: 'Auto-detected (Key-Value)' };
      } else if (['payout', 'rate', 'revenue', 'price', 'payoutamount'].includes(key)) {
        const num = parseFloat(val.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          result.payout = { value: num, confidence: 'high', label: 'Auto-detected (Key-Value)' };
        }
      } else if (['partner', 'network', 'source', 'networkname', 'partnerid'].includes(key)) {
        result.network = { value: val, confidence: 'high', label: 'Auto-detected (Key-Value)' };
      } else if (['targeturl', 'url', 'link', 'trackingurl', 'clickurl'].includes(key)) {
        result.target_url = { value: val, confidence: 'high', label: 'Auto-detected (Key-Value)' };
      } else if (['description', 'desc', 'summary'].includes(key)) {
        result.description = { value: val, confidence: 'high', label: 'Auto-detected (Key-Value)' };
      }
    }
  });

  // 3. Fallback General Regex (if fields are still missing)
  if (!result.campaign_id.value) {
    // Look for standalone IDs or alphanumeric codes
    const idMatch = cleanText.match(/(?:offer[-_\s]?id|campaign[-_\s]?id|id)[:\s]*([a-zA-Z0-9_-]{3,20})/i);
    if (idMatch) {
      result.campaign_id = { value: idMatch[1], confidence: 'high', label: 'Auto-detected (ID Match)' };
    } else {
      // Possible fallback - first word that looks like a clean uppercase alphanumeric ID
      const possibleIdMatch = cleanText.match(/\b([A-Z0-9]{4,10})\b/);
      if (possibleIdMatch) {
        result.campaign_id = { value: possibleIdMatch[1], confidence: 'low', label: 'Possible ID (Low confidence)' };
      }
    }
  }

  if (!result.name.value) {
    const nameMatch = cleanText.match(/(?:name|title)[:\s]*([^\n]+)/i);
    if (nameMatch) {
      result.name = { value: nameMatch[1].trim(), confidence: 'high', label: 'Auto-detected (Name Match)' };
    } else {
      // Guess from the first line if it's short and does not contain keywords
      const firstLine = lines[0].trim();
      if (firstLine && firstLine.length < 50 && !firstLine.includes('http') && !firstLine.includes(':')) {
        result.name = { value: firstLine, confidence: 'low', label: 'Possible Name (First Line)' };
      }
    }
  }

  if (result.payout.value === 0) {
    const payoutMatch = cleanText.match(/(?:payout|rate|rev|revenue|pay)[:\s]*(?:\$|€|£)?\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (payoutMatch) {
      result.payout = { value: parseFloat(payoutMatch[1]), confidence: 'high', label: 'Auto-detected (Payout Match)' };
    } else {
      // Standalone dollar amounts like $1.20 or 1.50$
      const currencyMatch = cleanText.match(/(?:\$\s*|€\s*|£\s*)\s*([0-9]+(?:\.[0-9]+)?)/) || cleanText.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:\$\s*|€\s*|£\s*|USD|usd)/);
      if (currencyMatch) {
        result.payout = { value: parseFloat(currencyMatch[1]), confidence: 'low', label: 'Possible Payout (Currency symbol)' };
      }
    }
  }

  if (!result.network.value) {
    const partnerMatch = cleanText.match(/(?:partner|network|source|advertiser)[:\s]*([^\n]+)/i);
    if (partnerMatch) {
      result.network = { value: partnerMatch[1].trim(), confidence: 'high', label: 'Auto-detected (Partner Match)' };
    }
  }

  // 4. Special Tracking URL parsing
  if (foundUrl) {
    if (!result.target_url.value) {
      result.target_url = { value: foundUrl, confidence: 'high', label: 'Auto-detected (URL in Text)' };
    }

    try {
      const urlObj = new URL(foundUrl);
      const params = urlObj.searchParams;

      // Extract ID from URL params if missing
      if (!result.campaign_id.value) {
        const urlId = params.get('offer_id') || params.get('campaign_id') || params.get('id') || params.get('cid') || params.get('offid');
        if (urlId) {
          result.campaign_id = { value: urlId, confidence: 'high', label: 'Auto-detected (URL Param)' };
        }
      }

      // Extract Payout from URL params if missing
      if (result.payout.value === 0) {
        const urlPayout = params.get('payout') || params.get('pay') || params.get('rate');
        if (urlPayout) {
          const num = parseFloat(urlPayout.replace(/[^0-9.]/g, ''));
          if (!isNaN(num)) {
            result.payout = { value: num, confidence: 'high', label: 'Auto-detected (URL Param)' };
          }
        }
      }

      // Extract Network/Partner from domain name if missing
      if (!result.network.value) {
        const hostname = urlObj.hostname.replace('www.', '');
        const domainParts = hostname.split('.');
        const domainName = domainParts[domainParts.length - 2] || hostname;
        result.network = { 
          value: domainName.charAt(0).toUpperCase() + domainName.slice(1), 
          confidence: 'low', 
          label: 'Possible Partner (Domain Name)' 
        };
      }
    } catch {
      // URL parsing failed
    }
  }

  return result;
};

/**
 * Parses multiple offers separated by blank lines or multiple JSON elements
 */
export const parseMultipleOffers = (text: string): ParsedOffer[] => {
  const cleanText = text.trim();
  if (!cleanText) return [];

  // 1. Array of JSON
  if (cleanText.startsWith('[') && cleanText.endsWith(']')) {
    try {
      const arr = JSON.parse(cleanText);
      if (Array.isArray(arr)) {
        return arr.map(item => parseRawOffer(JSON.stringify(item)));
      }
    } catch {
      // Fallback to text blocks
    }
  }

  // 2. Split by double blank lines (or multiple newlines)
  const blocks = cleanText.split(/\n\s*\n+/);
  if (blocks.length > 1) {
    return blocks.map(block => parseRawOffer(block)).filter(o => o.campaign_id.value || o.name.value);
  }

  // 3. If single block but has multiple JSON objects consecutively
  const jsonMatches = cleanText.match(/\{[^{}]+\}/g);
  if (jsonMatches && jsonMatches.length > 1) {
    try {
      return jsonMatches.map(jsonStr => parseRawOffer(jsonStr));
    } catch {
      // Fallback
    }
  }

  // Just return single offer in array
  return [parseRawOffer(text)];
};
