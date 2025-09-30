import React, { useState, useMemo } from "react";
import {
  Zap,
  CheckCircle,
  XCircle,
  Smartphone,
  Monitor,
  Video,
  Bell,
  Image,
  Layers,
} from "lucide-react";

/**
 * CampaignBuilder — compact + extra fields implemented
 * Drop into src/pages/CampaignBuilder.tsx
 * Uses Tailwind CSS. Expects lucide-react to be installed.
 */

const smallLabel = "text-[10px] font-medium text-gray-500 mb-1";
const inputClasses =
  "w-full p-2 text-xs border border-gray-200 bg-white rounded-md shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition duration-150 placeholder-gray-400";
const selectClasses = `${inputClasses} appearance-none`;
const fileInputClasses =
  "w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer";

const SectionTitle = ({ title }) => (
  <h3 className="text-sm md:text-sm font-semibold text-gray-800 mb-2">{title}</h3>
);

const FormatCard = ({ name, selected, onClick, desc, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-start gap-1.5 p-3 rounded-md border transition-shadow duration-200 text-left hover:shadow focus:outline-none text-xs ${
      selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
    }`}
  >
    <div className="flex items-center gap-2 w-full">
      <div className={`p-1.5 rounded ${selected ? "bg-blue-100" : "bg-gray-100"}`}>
        <Icon className={`w-4 h-4 ${selected ? "text-blue-600" : "text-gray-700"}`} />
      </div>
      <div className="flex-1">
        <div className={`font-semibold text-xs ${selected ? "text-gray-900" : "text-gray-800"}`}>{name}</div>
        {desc && <div className="text-[10px] text-gray-500">{desc}</div>}
      </div>
      <div className="ml-auto">{selected ? <CheckCircle className="w-4 h-4 text-blue-600" /> : null}</div>
    </div>
  </button>
);

const PlatformCard = ({ name, selected, onClick, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 p-2 rounded-md border text-xs transition-colors duration-200 ${
      selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"
    }`}
  >
    <Icon className={`w-4 h-4 ${selected ? "text-blue-600" : "text-gray-600"}`} />
    <div className="font-semibold text-xs">{name}</div>
  </button>
);

const Pill = ({ id, onRemove }) => (
  <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full mr-1.5 mb-1.5 border border-indigo-200">
    {id}
    <button type="button" onClick={() => onRemove(id)} className="ml-1 text-indigo-500 hover:text-indigo-800">
      <XCircle className="w-3.5 h-3.5" />
    </button>
  </span>
);

const AdPreview = ({ adFormat, campaignName, cta, previewSrc }) => {
  const badge = useMemo(() => {
    switch (adFormat) {
      case "Video":
        return "Video Preview";
      case "Push":
        return "Push Preview";
      case "Native":
      case "Interstitial":
        return adFormat;
      default:
        return "Banner";
    }
  }, [adFormat]);

  return (
    <div className="w-full h-40 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md p-3 flex items-center gap-3 overflow-hidden text-xs">
      <div className="w-1/3 h-full flex items-center justify-center">
        {previewSrc ? (
          // Using a placeholder image for better visual consistency when assets are "uploaded"
          <img src="https://placehold.co/120x80/2563EB/ffffff?text=Creative" alt="preview" className="max-h-28 object-contain rounded shadow-lg" />
        ) : (
          <div className="w-28 h-20 rounded-md bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 border border-dashed border-gray-300">No asset</div>
        )}
      </div>
      <div className="flex-1 h-full flex flex-col justify-between py-0.5">
        <div>
          <div className="text-[10px] text-gray-500">{badge}</div>
          <div className="text-sm font-semibold text-gray-900">{campaignName || "Campaign name"}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Preview of how the creative will appear for selected format</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-gray-400">Live preview</div>
          <button className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">{cta || "Learn"}</button>
        </div>
      </div>
    </div>
  );
};

const CampaignBuilder = () => {
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [campaignType, setCampaignType] = useState("");

  const [campaignObjective, setCampaignObjective] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [language, setLanguage] = useState("");

  const [targetIds, setTargetIds] = useState<string[]>(["key", "jix"]);
  const [newTarget, setNewTarget] = useState("");

  const [pricingModel, setPricingModel] = useState("");
  const [priceAdjust, setPriceAdjust] = useState<number | string>(0.0);
  const [maxPrice, setMaxPrice] = useState<number | string>(0.0);
  const [dailyBudget, setDailyBudget] = useState<number | string>(0);
  const [totalBudget, setTotalBudget] = useState<number | string>(0);
  const [bidType, setBidType] = useState("");

  const [adType, setAdType] = useState("Image Ad");
  const [adFormat, setAdFormat] = useState("Banner");
  const [ctaButton, setCtaButton] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);
  const [headlineText, setHeadlineText] = useState("");

  const [platforms, setPlatforms] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState(""); // New state for country search

  const [ageMin, setAgeMin] = useState<number | string>(18);
  const [ageMax, setAgeMax] = useState<number | string>(45);
  const [gender, setGender] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [newCity, setNewCity] = useState("");
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [serveStartHour, setServeStartHour] = useState("00:00");
  const [serveEndHour, setServeEndHour] = useState("23:59");

  const [submissionMessage, setSubmissionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [videoDuration, setVideoDuration] = useState<number | string>(15);
  const [pushTitle, setPushTitle] = useState("");
  const [nativeHeadline, setNativeHeadline] = useState("");
  
  // Static lists for simplicity
  const bannerLayout = "Standard";
  const bannerSize = "300x250";

  // --- FULL LIST OF WORLD COUNTRIES ---
  const countryList = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)",
    "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
    "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
    "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
    "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
    "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
    "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
    "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
    "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
    "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
    "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
    "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
    "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
    "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
    "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];
  // --- END OF FULL LIST ---

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

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    // NOTE: In a real app, you wouldn't use createObjectURL for long-term storage, 
    // but it works for client-side preview.
    const newPreviews = files.map((f) => URL.createObjectURL(f)); 
    setUploadedPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDeviceType = (device: string) => {
    setDeviceTypes((prev) => (prev.includes(device) ? prev.filter((d) => d !== device) : [...prev, device]));
  };

  const handleAddCity = () => {
    const trimmed = newCity.trim();
    if (trimmed && !cities.includes(trimmed)) {
      setCities((prev) => [...prev, trimmed]);
      setNewCity("");
    }
  };

  const removeCity = (c: string) => setCities((prev) => prev.filter((x) => x !== c));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaignName || !redirectUrl || !campaignType || !maxPrice) {
      setSubmissionMessage({ type: "error", text: "Please fill required fields (name, redirect URL, campaign type, max price)." });
      setTimeout(() => setSubmissionMessage(null), 5000);
      return;
    }

    const payload = {
      campaignName,
      campaignDesc,
      campaignObjective,
      advertiserName,
      language,
      redirectUrl,
      campaignType,
      targetIds,
      pricingModel,
      priceAdjust: parseFloat(String(priceAdjust)) || 0,
      maxPrice: parseFloat(String(maxPrice)) || 0,
      dailyBudget: parseFloat(String(dailyBudget)) || 0,
      totalBudget: parseFloat(String(totalBudget)) || 0,
      bidType,
      adType,
      adFormat,
      bannerLayout,
      bannerSize,
      ctaButton,
      headlineText,
      uploadedFiles: uploadedFiles.map((f) => f.name),
      platforms,
      countries,
      ageRange: { min: ageMin, max: ageMax },
      gender,
      cities,
      deviceTypes,
      startDate,
      endDate,
      timeZone,
      serveStartHour,
      serveEndHour,
      videoDuration: adFormat === "Video" ? videoDuration : undefined,
      pushTitle: adFormat === "Push" ? pushTitle : undefined,
      nativeHeadline: adFormat === "Native" ? nativeHeadline : undefined,
    };

    console.log("--- Submitted Campaign Data ---");
    console.log(payload);
    console.log("-------------------------------");

    setSubmissionMessage({ type: "success", text: "Campaign submitted successfully! Check the console for the payload." });
    setTimeout(() => setSubmissionMessage(null), 6000);
  };
  
  // Filter countries based on search input
  const filteredCountries = useMemo(() => {
    const searchLower = countrySearch.toLowerCase();
    return countryList.filter(country =>
        country.toLowerCase().includes(searchLower)
    );
  }, [countrySearch]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6 font-sans text-xs">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white shadow-lg">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Campaign Builder</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Create, preview and deploy high-converting ad campaigns</p>
          </div>
        </header>

        {submissionMessage && (
          <div className={`mb-3 p-3 rounded-md border ${submissionMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <div className="flex items-center gap-2 text-xs">
              {submissionMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <div>{submissionMessage.text}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-lg space-y-4">
            
            {/* --- BASIC --- */}
            <SectionTitle title="Basic Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={smallLabel}>Campaign Name *</label>
                <input required value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className={inputClasses} placeholder="Summer Promo #1" />
              </div>

              <div>
                <label className={smallLabel}>Advertiser / Brand</label>
                <input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} className={inputClasses} placeholder="Advertiser name" />
              </div>

              <div>
                <label className={smallLabel}>Redirect URL *</label>
                <input required value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className={inputClasses} placeholder="https://example.com/offer" />
              </div>

              <div>
                <label className={smallLabel}>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClasses}>
                  <option value="">Default</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={smallLabel}>Description</label>
                <textarea value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} className={`${inputClasses} h-20`} placeholder="Short description shown in native placements (optional)" />
              </div>

              <div>
                <label className={smallLabel}>Campaign Type *</label>
                <select required value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className={selectClasses}>
                  <option value="">Select campaign type</option>
                  <option value="CPC">CPC</option>
                  <option value="CPA">CPA</option>
                  <option value="Views">Views (CPM)</option>
                </select>
              </div>

              <div>
                <label className={smallLabel}>Campaign Objective</label>
                <select value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} className={selectClasses}>
                  <option value="">Choose objective</option>
                  <option value="traffic">Traffic</option>
                  <option value="conversions">Conversions</option>
                  <option value="engagement">Engagement</option>
                </select>
              </div>
            </div>

            {/* --- TARGET IDS --- */}
            <SectionTitle title="Target IDs (Key/Value)" />
            <div className="flex gap-2 mb-2">
              <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault() || handleAddTarget())} className={`${inputClasses} flex-1`} placeholder="Add target ID (press Enter)" />
              <button type="button" onClick={handleAddTarget} className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-700">Add</button>
            </div>
            <div className="flex flex-wrap mb-2 min-h-[1.5rem]">{targetIds.map((t) => (<Pill key={t} id={t} onRemove={handleRemoveTarget} />))}</div>

            {/* --- PRICING & BUDGET --- */}
            <SectionTitle title="Pricing & Budget" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={smallLabel}>Pricing Model</label>
                <select value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} className={selectClasses}>
                  <option value="">Select pricing model</option>
                  <option value="CPC">CPC</option>
                  <option value="CPM">CPM</option>
                  <option value="CPA">CPA</option>
                </select>
              </div>

              <div>
                <label className={smallLabel}>Price Adjust ($)</label>
                <input type="number" step="0.01" value={priceAdjust} onChange={(e) => setPriceAdjust(e.target.value)} className={inputClasses} placeholder="0.00" />
              </div>

              <div>
                <label className={smallLabel}>Max Price ($) *</label>
                <input required type="number" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={inputClasses} placeholder="0.50" />
              </div>

              <div>
                <label className={smallLabel}>Daily Budget ($)</label>
                <input type="number" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} className={inputClasses} placeholder="0" />
              </div>

              <div>
                <label className={smallLabel}>Total Budget ($)</label>
                <input type="number" step="0.01" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} className={inputClasses} placeholder="0" />
              </div>

              <div>
                <label className={smallLabel}>Bid Type</label>
                <select value={bidType} onChange={(e) => setBidType(e.target.value)} className={selectClasses}>
                  <option value="">Select bid type</option>
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            {/* --- MEDIA & CREATIVE --- */}
            <SectionTitle title="Media & Creative" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div>
                <label className={smallLabel}>Ad Type</label>
                <select value={adType} onChange={(e) => setAdType(e.target.value)} className={selectClasses}>
                  <option>Image Ad</option>
                  <option>Video Ad</option>
                  <option>Pop-up Under</option>
                  <option>Survey Exit</option>
                </select>
              </div>

              <div>
                <label className={smallLabel}>CTA Button</label>
                <select value={ctaButton} onChange={(e) => setCtaButton(e.target.value)} className={selectClasses}>
                  <option value="">Choose CTA</option>
                  <option value="Sign Up">Sign Up</option>
                  <option value="Learn More">Learn More</option>
                  <option value="Buy Now">Buy Now</option>
                  <option value="Download">Download</option>
                </select>
              </div>

              <div>
                <label className={smallLabel}>Upload Creative (multiple)</label>
                <input id="file-upload" type="file" multiple onChange={handleFilesUpload} className={fileInputClasses} accept="image/*,video/*" />
              </div>

              <div className="md:col-span-3">
                <label className={smallLabel}>Headline / Ad copy</label>
                <input value={headlineText} onChange={(e) => setHeadlineText(e.target.value)} className={inputClasses} placeholder="Short headline or primary text" />
              </div>

              <div className="md:col-span-3">
                <label className={smallLabel}>Advertising Format</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-1">
                  <FormatCard name="Banner" Icon={Monitor} desc="Leaderboard, MPU" selected={adFormat === "Banner"} onClick={() => setAdFormat("Banner")} />
                  <FormatCard name="Native" Icon={Layers} desc="In-feed, content native" selected={adFormat === "Native"} onClick={() => setAdFormat("Native")} />
                  <FormatCard name="Interstitial" Icon={Image} desc="Full-screen ads" selected={adFormat === "Interstitial"} onClick={() => setAdFormat("Interstitial")} />
                  <FormatCard name="Video" Icon={Video} desc="In-stream & rewarded" selected={adFormat === "Video"} onClick={() => setAdFormat("Video")} />
                  <FormatCard name="Push" Icon={Bell} desc="Push notifications" selected={adFormat === "Push"} onClick={() => setAdFormat("Push")} />
                </div>
              </div>

              <div className="md:col-span-3">
                <div className="flex gap-2 mt-2 flex-wrap">
                  {uploadedPreviews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* Using placeholder image URL for display */}
                      <img src={"https://placehold.co/80x48/1F2937/ffffff?text=Asset"} alt={`preview-${i}`} className="w-20 h-12 object-cover rounded border" />
                      <button type="button" onClick={() => removeUploadedFile(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full border border-gray-300 text-xs font-semibold hover:bg-gray-100 transition">x</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- TARGETING --- */}
            <SectionTitle title="Targeting" />
            
            <div className="mb-2">
              <div className="text-[11px] font-medium text-gray-700 mb-1">Platforms</div>
              <div className="grid grid-cols-3 gap-2">
                <PlatformCard name="Android" selected={platforms.includes("Android")} onClick={() => togglePlatform("Android")} Icon={Smartphone} />
                <PlatformCard name="iOS" selected={platforms.includes("iOS")} onClick={() => togglePlatform("iOS")} Icon={Smartphone} />
                <PlatformCard name="Web" selected={platforms.includes("Web")} onClick={() => togglePlatform("Web")} Icon={Monitor} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* === UPDATED COUNTRY SELECTION SECTION === */}
              <div>
                <label className={smallLabel}>Target Countries</label>
                {/* 1. Display selected countries as pills */}
                <div className="flex flex-wrap mb-2 min-h-[1.5rem] p-1 border border-gray-200 bg-gray-50 rounded-md">
                    {countries.length === 0 && <span className="text-[10px] text-gray-400 p-1">No countries selected.</span>}
                    {countries.map((country) => (
                        <Pill key={country} id={country} onRemove={toggleCountry} />
                    ))}
                </div>
                
                {/* 2. Country Search Input */}
                <input
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className={inputClasses}
                    placeholder="Search for a country..."
                />

                {/* 3. Filtered Country List for Selection */}
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 border border-gray-100 rounded text-xs mt-2 bg-white">
                  {filteredCountries.map((country) => (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleCountry(country)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors shadow-sm ${
                        countries.includes(country)
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {country}
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                      <div className="text-gray-400 text-xs w-full text-center py-2">No countries found matching "{countrySearch}"</div>
                  )}
                </div>
              </div>
              {/* === END UPDATED COUNTRY SELECTION SECTION === */}

              <div>
                <label className={smallLabel}>Age Range</label>
                <div className="flex gap-2">
                  <input type="number" min={13} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className={inputClasses} />
                  <input type="number" min={13} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className={inputClasses} />
                </div>
              </div>

              <div>
                <label className={smallLabel}>Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClasses}>
                  <option value="">Any</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className={smallLabel}>Cities / Regions</label>
                <div className="flex gap-2 mb-2">
                  <input value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault() || handleAddCity())} className={inputClasses} placeholder="Add city (e.g., London, Tokyo)" />
                  <button type="button" onClick={handleAddCity} className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-700">Add</button>
                </div>
                <div className="flex flex-wrap min-h-[1.5rem] p-1 border border-gray-100 rounded">
                  {cities.length === 0 && <span className="text-[10px] text-gray-400 p-1">No cities added.</span>}
                  {cities.map((c) => (<button key={c} type="button" onClick={() => removeCity(c)} className="mr-1 mb-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700 hover:bg-gray-200">{c} &times;</button>))}
                </div>
              </div>

              <div>
                <label className={smallLabel}>Device Type</label>
                <div className="flex gap-1 flex-wrap">
                  <button type="button" onClick={() => toggleDeviceType("Mobile")} className={`px-2 py-1 rounded text-xs shadow-sm ${deviceTypes.includes("Mobile") ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>Mobile</button>
                  <button type="button" onClick={() => toggleDeviceType("Tablet")} className={`px-2 py-1 rounded text-xs shadow-sm ${deviceTypes.includes("Tablet") ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>Tablet</button>
                  <button type="button" onClick={() => toggleDeviceType("Desktop")} className={`px-2 py-1 rounded text-xs shadow-sm ${deviceTypes.includes("Desktop") ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>Desktop</button>
                </div>
              </div>
            </div>

            {/* --- SCHEDULE & SETTINGS --- */}
            <SectionTitle title="Schedule & Settings" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={smallLabel}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className={smallLabel}>End Date (Optional)</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClasses} />
              </div>

              <div>
                <label className={smallLabel}>Time Zone</label>
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={selectClasses}>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={smallLabel}>Ad serving hours (local TZ)</label>
                <div className="flex gap-2">
                  <input type="time" value={serveStartHour} onChange={(e) => setServeStartHour(e.target.value)} className={inputClasses} />
                  <input type="time" value={serveEndHour} onChange={(e) => setServeEndHour(e.target.value)} className={inputClasses} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
              <button type="submit" className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">Deploy Campaign</button>
              <button type="button" onClick={() => console.log("Save draft")} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">Save Draft</button>
            </div>
          </div>

          <aside className="bg-white p-4 rounded-xl shadow-lg h-fit sticky top-4">
            <AdPreview adFormat={adFormat} campaignName={campaignName} cta={ctaButton || "Learn More"} previewSrc={uploadedPreviews[0] || null} />

            <div className="mt-4 text-xs text-gray-600 space-y-2 border-t border-gray-100 pt-3">
              <h4 className="font-semibold text-gray-900 text-sm">Summary</h4>
              <div><span className="font-medium text-gray-800">Type:</span> {campaignType || "—"}</div>
              <div><span className="font-medium text-gray-800">Format:</span> {adFormat}</div>
              <div><span className="font-medium text-gray-800">Platforms:</span> {platforms.length ? platforms.join(", ") : "—"}</div>
              <div><span className="font-medium text-gray-800">Countries:</span> {countries.length ? countries.slice(0, 5).join(", ") + (countries.length > 5 ? ` (+${countries.length - 5} more)` : "") : "—"}</div>
              <div><span className="font-medium text-gray-800">Target IDs:</span> {targetIds.length}</div>
              <div><span className="font-medium text-gray-800">Max Price:</span> ${maxPrice || "—"}</div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
              <label className="text-[10px] font-semibold text-gray-500 mb-1">Notes (Internal)</label>
              <textarea className="w-full p-2 border border-gray-200 rounded-md h-20 text-xs text-gray-600" placeholder="Optional notes for this campaign (internal)" />
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default CampaignBuilder;
