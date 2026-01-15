import React, { useState } from 'react';
import { Copy, Check, ArrowRight, Plus, Trash2, Save } from 'lucide-react';

interface ParameterMapping {
  ourParam: string;
  theirParam: string;
  enabled: boolean;
}

interface Partner {
  name: string;
  mappings: ParameterMapping[];
}

const AVAILABLE_OUR_PARAMS = [
  { value: 'user_id', label: 'user_id', description: 'User MongoDB ID' },
  { value: 'click_id', label: 'click_id', description: 'Unique click identifier' },
  { value: 'payout', label: 'payout', description: 'Conversion payout amount' },
  { value: 'status', label: 'status', description: 'Conversion status (approved/pending/rejected)' },
  { value: 'transaction_id', label: 'transaction_id', description: 'Transaction identifier' },
  { value: 'offer_id', label: 'offer_id', description: 'Offer identifier' },
  { value: 'conversion_id', label: 'conversion_id', description: 'Conversion identifier' },
  { value: 'currency', label: 'currency', description: 'Currency code (USD, EUR, etc.)' },
];

const PARTNER_TEMPLATES = {
  'LeadAds': [
    { ourParam: 'user_id', theirParam: 'aff_sub', enabled: true },
    { ourParam: 'status', theirParam: 'status', enabled: true },
    { ourParam: 'payout', theirParam: 'payout', enabled: true },
    { ourParam: 'transaction_id', theirParam: 'transaction_id', enabled: true },
  ],
  'CPALead': [
    { ourParam: 'user_id', theirParam: 'subid', enabled: true },
    { ourParam: 'click_id', theirParam: 's2', enabled: true },
    { ourParam: 'status', theirParam: 'status', enabled: true },
    { ourParam: 'payout', theirParam: 'payout', enabled: true },
  ],
  'OfferToro': [
    { ourParam: 'user_id', theirParam: 'user_id', enabled: true },
    { ourParam: 'status', theirParam: 'status', enabled: true },
    { ourParam: 'payout', theirParam: 'amount', enabled: true },
    { ourParam: 'transaction_id', theirParam: 'oid', enabled: true },
  ],
  'AdGate Media': [
    { ourParam: 'user_id', theirParam: 'subid', enabled: true },
    { ourParam: 'status', theirParam: 'status', enabled: true },
    { ourParam: 'payout', theirParam: 'payout', enabled: true },
  ],
  'Custom': [
    { ourParam: 'user_id', theirParam: '', enabled: true },
    { ourParam: 'status', theirParam: '', enabled: true },
    { ourParam: 'payout', theirParam: '', enabled: true },
  ],
};

export default function PostbackURLBuilder() {
  const [selectedPartner, setSelectedPartner] = useState<string>('LeadAds');
  const [postbackKey, setPostbackKey] = useState<string>('YOUR_POSTBACK_KEY');
  const [mappings, setMappings] = useState<ParameterMapping[]>(PARTNER_TEMPLATES['LeadAds']);
  const [copied, setCopied] = useState(false);
  const [baseURL] = useState('https://postback.moustacheleads.com/postback');

  const handlePartnerChange = (partner: string) => {
    setSelectedPartner(partner);
    setMappings(PARTNER_TEMPLATES[partner as keyof typeof PARTNER_TEMPLATES] || PARTNER_TEMPLATES['Custom']);
  };

  const handleMappingChange = (index: number, field: 'ourParam' | 'theirParam' | 'enabled', value: string | boolean) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const addMapping = () => {
    setMappings([...mappings, { ourParam: '', theirParam: '', enabled: true }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const generatePostbackURL = () => {
    const params = mappings
      .filter(m => m.enabled && m.ourParam && m.theirParam)
      .map(m => `${m.theirParam}={${m.theirParam}}`)
      .join('&');
    
    return `${baseURL}/${postbackKey}${params ? '?' + params : ''}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePostbackURL());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const savePartnerConfig = () => {
    // TODO: Save to backend
    alert('Partner configuration saved! (Backend integration pending)');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Postback URL Builder</h2>
        <p className="text-gray-600">
          Visually map parameters to generate postback URLs for upward partners
        </p>
      </div>

      {/* Partner Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Partner Template
        </label>
        <select
          value={selectedPartner}
          onChange={(e) => handlePartnerChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.keys(PARTNER_TEMPLATES).map(partner => (
            <option key={partner} value={partner}>{partner}</option>
          ))}
        </select>
      </div>

      {/* Postback Key */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Postback Key
        </label>
        <input
          type="text"
          value={postbackKey}
          onChange={(e) => setPostbackKey(e.target.value)}
          placeholder="Enter your unique postback key"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          This is the unique key for this partner (e.g., -3YJWcgL-TnlNnscehd5j23IbVZRJHUY)
        </p>
      </div>

      {/* Parameter Mapping Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Parameter Mapping</h3>
          <button
            onClick={addMapping}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <Plus size={16} />
            Add Parameter
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="col-span-1 text-center">
              <input type="checkbox" className="rounded" checked disabled />
            </div>
            <div className="col-span-4 font-medium text-gray-700">Our Parameter</div>
            <div className="col-span-1 text-center text-gray-400">→</div>
            <div className="col-span-4 font-medium text-gray-700">Their Parameter</div>
            <div className="col-span-2 text-center font-medium text-gray-700">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {mappings.map((mapping, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50">
                {/* Enable Checkbox */}
                <div className="col-span-1 text-center">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={(e) => handleMappingChange(index, 'enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {/* Our Parameter */}
                <div className="col-span-4">
                  <select
                    value={mapping.ourParam}
                    onChange={(e) => handleMappingChange(index, 'ourParam', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select parameter...</option>
                    {AVAILABLE_OUR_PARAMS.map(param => (
                      <option key={param.value} value={param.value}>
                        {param.label} - {param.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Arrow */}
                <div className="col-span-1 text-center">
                  <ArrowRight className="mx-auto text-blue-500" size={20} />
                </div>

                {/* Their Parameter */}
                <div className="col-span-4">
                  <input
                    type="text"
                    value={mapping.theirParam}
                    onChange={(e) => handleMappingChange(index, 'theirParam', e.target.value)}
                    placeholder="e.g., aff_sub, subid, user_id"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                  />
                </div>

                {/* Actions */}
                <div className="col-span-2 text-center">
                  <button
                    onClick={() => removeMapping(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove mapping"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {mappings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No parameter mappings. Click "Add Parameter" to start.
          </div>
        )}
      </div>

      {/* Generated URL */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generated Postback URL
        </label>
        <div className="relative">
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 pr-12 font-mono text-sm break-all">
            {generatePostbackURL()}
          </div>
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-600" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Share this URL with your partner. They will replace the macros (e.g., {'{aff_sub}'}) with actual values.
        </p>
      </div>

      {/* Preview Section */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📋 How It Works:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Select a partner template or create custom mapping</li>
          <li>Map YOUR parameters (left) to THEIR parameters (right)</li>
          <li>Copy the generated postback URL</li>
          <li>Give this URL to your partner</li>
          <li>Partner will send postbacks with their parameter names</li>
          <li>Our system will extract the values and credit users</li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={copyToClipboard}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? 'Copied!' : 'Copy Postback URL'}
        </button>
        <button
          onClick={savePartnerConfig}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          <Save size={20} />
          Save Partner Config
        </button>
      </div>

      {/* Example Section */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">💡 Example: LeadAds Integration</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300 text-xs">user_id</span>
            <ArrowRight size={16} className="mt-1 text-gray-400" />
            <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300 text-xs">aff_sub</span>
            <span className="text-gray-600 mt-1">LeadAds uses "aff_sub" for user tracking</span>
          </div>
          <div className="mt-3 p-3 bg-white rounded border border-gray-300">
            <p className="text-xs text-gray-600 mb-1">Generated URL:</p>
            <code className="text-xs text-gray-800 break-all">
              {baseURL}/{postbackKey}?aff_sub={'{aff_sub}'}&status={'{status}'}&payout={'{payout}'}
            </code>
          </div>
          <div className="mt-3 p-3 bg-white rounded border border-gray-300">
            <p className="text-xs text-gray-600 mb-1">When LeadAds sends postback:</p>
            <code className="text-xs text-gray-800 break-all">
              {baseURL}/{postbackKey}?aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00
            </code>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            ✅ Our system extracts <code className="bg-white px-1 py-0.5 rounded">aff_sub=507f1f77bcf86cd799439011</code> and credits that user!
          </p>
        </div>
      </div>
    </div>
  );
}
