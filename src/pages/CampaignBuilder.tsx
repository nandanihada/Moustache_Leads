import React, { useState } from "react";
import {
  Zap,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Smartphone,
  Monitor,
} from "lucide-react";

/**
 * CampaignBuilder page
 *
 * Drop into src/pages/CampaignBuilder.tsx
 * Uses Tailwind CSS utility classes (as in your provided code).
 * Expects lucide-react to be installed in the project.
 */

const generateId = () => Math.random().toString(36).substring(2, 9);

const CampaignBuilder: React.FC = () => {
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [campaignType, setCampaignType] = useState("");

  const [targetIds, setTargetIds] = useState<string[]>(["key", "jix"]);
  const [newTarget, setNewTarget] = useState("");

  const [pricingModel, setPricingModel] = useState("");
  const [priceAdjust, setPriceAdjust] = useState<number | string>(0.0);
  const [maxPrice, setMaxPrice] = useState<number | string>(0.0);

  const [adType, setAdType] = useState("Image Ad");
  const [bannerLayout, setBannerLayout] = useState("");
  const [bannerSize, setBannerSize] = useState("");
  const [ctaButton, setCtaButton] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);

  const [platforms, setPlatforms] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [submissionMessage, setSubmissionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const countryList = [
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Dominica",
    "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea"
  ];

  const handleAddTarget = () => {
    const trimmed = newTarget.trim();
    if (trimmed && !targetIds.includes(trimmed)) {
      setTargetIds((prev) => [...prev, trimmed]);
      setNewTarget("");
    }
  };

  const handleRemoveTarget = (idToRemove: string) => {
    setTargetIds((prev) => prev.filter((id) => id !== idToRemove));
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const toggleCountry = (country: string) => {
    setCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedImage(file);
    if (file) {
      setUploadedImagePreview(URL.createObjectURL(file));
    } else {
      setUploadedImagePreview(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      campaignName,
      campaignDesc,
      redirectUrl,
      campaignType,
      targetIds,
      pricingModel,
      priceAdjust: parseFloat(String(priceAdjust)) || 0,
      maxPrice: parseFloat(String(maxPrice)) || 0,
      adType,
      bannerLayout,
      bannerSize,
      ctaButton,
      uploadedImage: uploadedImage ? uploadedImage.name : null,
      platforms,
      countries,
      startDate,
      endDate,
    };

    // Replace with API call / firebase save as needed
    console.log("--- Submitted Campaign Data ---");
    console.log(payload);
    console.log("-------------------------------");

    setSubmissionMessage({ type: "success", text: "Campaign submitted successfully! Check the console for the data payload." });
    setTimeout(() => setSubmissionMessage(null), 6000);
  };

  const inputClasses = "w-full p-3 border border-gray-300 bg-white rounded-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 placeholder-gray-400";
  const selectClasses = `${inputClasses} appearance-none`;
  const fileInputClasses = "w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer";
  const labelClasses = "block text-xs font-semibold text-gray-500 mb-1";

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4 border-b border-gray-100 pb-2">{title}</h2>
  );

  const PlatformCard: React.FC<{ name: string; icon: React.ComponentType<any> }> = ({ name, icon: Icon }) => {
    const isSelected = platforms.includes(name);
    return (
      <button
        type="button"
        onClick={() => togglePlatform(name)}
        className={`p-6 border rounded-lg transition-all duration-200 shadow-sm flex flex-col items-center space-y-3 w-full h-32
          ${isSelected ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}
        `}
      >
        <div className="w-full flex justify-end mb-1">
          <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
            {isSelected && <CheckCircle className="w-4 h-4 text-white p-0.5" />}
          </div>
        </div>

        <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
        <span className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{name}</span>
      </button>
    );
  };

  const Pill: React.FC<{ id: string; onRemove: (id: string) => void }> = ({ id, onRemove }) => (
    <span className="inline-flex items-center bg-gray-100 text-gray-800 text-sm font-normal px-3 py-1 rounded-sm mr-2 mb-2 border border-gray-300">
      {id}
      <button type="button" onClick={() => onRemove(id)} className="ml-2 text-gray-500 hover:text-gray-900 focus:outline-none">
        <XCircle className="w-4 h-4" />
      </button>
    </span>
  );

  const AdPreviewMockup: React.FC<{ bannerSize?: string }> = () => (
    <div className="relative w-full h-full p-4 bg-white border border-gray-200 rounded-lg shadow-inner flex flex-col items-center justify-center overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(100, 50)">
          <rect x="50" y="70" width="80" height="70" rx="10" fill="#003366" />
          <path d="M90 60 L90 40 C90 29 99 20 110 20 C121 20 130 29 130 40 L130 60" stroke="#003366" strokeWidth="15" fill="none" />
          <text x="50" y="120" fontSize="30" fontWeight="bold" fill="white" fontFamily="sans-serif">CCPA</text>
        </g>
        <path fill="#FFC300" d="M10 20 L20 10 L30 20 L20 30 Z M350 250 L360 240 L370 250 L360 260 Z M50 280 L60 270 L70 280 L60 290 Z M300 50 L310 40 L320 50 L310 60 Z"/>
      </svg>

      <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gray-900 bg-opacity-80 p-2 flex items-end">
        <div className="text-left">
          <p className="text-white text-xs font-bold leading-tight">Campaign Name</p>
          <p className="text-gray-300 text-[10px] leading-tight">Your campaign description goes here</p>
        </div>
        <button className="ml-auto px-2 py-1 bg-white text-gray-900 text-[10px] font-semibold rounded-sm">
          CTA Text
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
          <Zap className="w-6 h-6 text-gray-700 mr-2" />
          Campaign Builder
        </h1>
      </header>

      {submissionMessage && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl z-50 transition-all duration-300 transform ${submissionMessage.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'} flex items-center space-x-2`}>
          {submissionMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{submissionMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-lg shadow-2xl space-y-8">
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" className={inputClasses} placeholder="Campaign Name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
            <input type="url" className={inputClasses} placeholder="Redirect URL (https://example.com)" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} required />
            <div className="md:col-span-2">
              <textarea className={`${inputClasses} h-24`} placeholder="Describe your campaign..." value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} />
            </div>
            <select className={selectClasses} value={campaignType} onChange={(e) => setCampaignType(e.target.value)} required>
              <option value="">Select campaign type</option>
              <option value="CPC">CPC</option>
              <option value="CPA">CPA</option>
              <option value="Views">Views (CPM)</option>
            </select>
          </div>
        </section>

        <section>
          <SectionTitle title="Target IDs" />
          <div className="flex space-x-3 mb-4">
            <input type="text" className={`${inputClasses} flex-grow`} placeholder="Add target ID" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault() || handleAddTarget())} />
            <button type="button" onClick={handleAddTarget} className="px-4 py-3 text-lg bg-gray-700 text-white rounded-sm hover:bg-gray-800 transition" style={{ padding: '0.75rem 1rem' }}>
              +
            </button>
          </div>
          <div className="min-h-8 flex flex-wrap content-start">
            {targetIds.map((id) => <Pill key={id} id={id} onRemove={handleRemoveTarget} />)}
          </div>
        </section>

        <section>
          <SectionTitle title="Pricing & Budget" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <select className={selectClasses} value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} required>
              <option value="">Select pricing model</option>
              <option value="CPC">CPC</option>
              <option value="CPM">CPM</option>
              <option value="CPA">CPA</option>
            </select>
            <input type="number" step="0.01" className={inputClasses} value={priceAdjust} onChange={(e) => setPriceAdjust(e.target.value)} placeholder="Price Adjust" min="0" />
            <input type="number" step="0.01" className={inputClasses} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max Price ($)" min="0.01" required />
          </div>
        </section>

        <section>
          <SectionTitle title="Media & Creative" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div>
              <label className={labelClasses}>Ad Type</label>
              <select className={selectClasses} value={adType} onChange={(e) => setAdType(e.target.value)}>
                <option>Image Ad</option>
                <option>Video Ad</option>
                <option>Pop-up Under</option>
                <option>Survey Exit</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Banner Layout</label>
              <select className={selectClasses} value={bannerLayout} onChange={(e) => setBannerLayout(e.target.value)}>
                <option value="">Choose layout</option>
                <option value="layout1">Standard Banner</option>
                <option value="layout2">Full Screen Overlay</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Banner Size</label>
              <select className={selectClasses} value={bannerSize} onChange={(e) => setBannerSize(e.target.value)}>
                <option value="">Select size</option>
                <option value="300x250">300x250</option>
                <option value="728x90">728x90</option>
                <option value="320x50">320x50</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>CTA Button</label>
              <select className={selectClasses} value={ctaButton} onChange={(e) => setCtaButton(e.target.value)}>
                <option value="">Choose CTA button</option>
                <option value="Sign Up">Sign Up</option>
                <option value="Learn More">Learn More</option>
                <option value="Buy Now">Buy Now</option>
                <option value="Download">Download</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label htmlFor="file-upload" className={labelClasses}>Upload Creative Asset</label>
              <input id="file-upload" type="file" onChange={handleImageUpload} className={fileInputClasses} accept="image/*,video/*" />
            </div>

            <div>
              <label className={labelClasses}>Ad Preview</label>
              <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner">
                {uploadedImagePreview ? (
                  <img src={uploadedImagePreview} alt="Ad Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <AdPreviewMockup />
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Targeting" />
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Platforms</h3>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <PlatformCard name="Android" icon={Smartphone} />
            <PlatformCard name="iOS" icon={Smartphone} />
            <PlatformCard name="Web" icon={Monitor} />
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-4">Target Countries</h3>
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-4 border border-gray-200 rounded-lg bg-white shadow-inner">
            {countryList.map((country) => (
              <button
                type="button"
                key={country}
                onClick={() => toggleCountry(country)}
                className={`text-sm px-4 py-2 rounded-sm transition-all duration-150 border shadow-sm ${countries.includes(country) ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              >
                {country}
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Schedule & Settings" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start-date" className={labelClasses}>Start Date</label>
              <input id="start-date" type="date" className={inputClasses} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="end-date" className={labelClasses}>End Date</label>
              <input id="end-date" type="date" className={inputClasses} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 mt-8">
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-md shadow-lg transition-colors text-lg">
            Deploy Campaign
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignBuilder;
