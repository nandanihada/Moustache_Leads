import React, { useState, useMemo } from "react";
import {
  Zap,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Smartphone,
  Monitor,
  Video,
  Bell,
  Image,
  Layers,
} from "lucide-react";

/**
 * Polished CampaignBuilder
 * Drop into src/pages/CampaignBuilder.tsx
 * Uses Tailwind CSS. Expects lucide-react to be installed.
 */

const generateId = () => Math.random().toString(36).substring(2, 9);

const smallLabel = "text-xs font-semibold text-gray-500 mb-1";
const inputClasses =
  "w-full p-3 border border-gray-200 bg-white rounded-md shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition duration-150 placeholder-gray-400";
const selectClasses = `${inputClasses} appearance-none`;
const fileInputClasses =
  "w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer";

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">{title}</h3>
);

const FormatCard: React.FC<{
  name: string;
  selected: boolean;
  onClick: () => void;
  desc?: string;
  Icon: React.ComponentType<any>;
}> = ({ name, selected, onClick, desc, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-start gap-2 p-4 rounded-lg border transition-shadow duration-200 text-left hover:shadow-lg focus:outline-none  ${
      selected
        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-sm ring-2 ring-blue-200"
        : "border-gray-200 bg-white"
    }`}
  >
    <div className="flex items-center gap-3 w-full">
      <div className={`p-2 rounded-md ${selected ? "bg-blue-100" : "bg-gray-100"}`}>
        <Icon className={`w-5 h-5 ${selected ? "text-blue-600" : "text-gray-700"}`} />
      </div>
      <div className="flex-1">
        <div className={`font-semibold ${selected ? "text-gray-900" : "text-gray-800"}`}>{name}</div>
        {desc && <div className="text-xs text-gray-500">{desc}</div>}
      </div>
      <div className="ml-auto">
        {selected ? <CheckCircle className="w-5 h-5 text-blue-600" /> : null}
      </div>
    </div>
  </button>
);

const PlatformCard: React.FC<{ name: string; selected: boolean; onClick: () => void; Icon: React.ComponentType<any> }> = ({ name, selected, onClick, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 p-4 rounded-lg border transition-colors duration-200 ${
      selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"
    }`}
  >
    <Icon className={`w-5 h-5 ${selected ? "text-blue-600" : "text-gray-600"}`} />
    <div className="text-sm font-semibold">{name}</div>
  </button>
);

const Pill: React.FC<{ id: string; onRemove: (id: string) => void }> = ({ id, onRemove }) => (
  <span className="inline-flex items-center bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded-full mr-2 mb-2 border border-gray-200">
    {id}
    <button type="button" onClick={() => onRemove(id)} className="ml-2 text-gray-500 hover:text-gray-800">
      <XCircle className="w-4 h-4" />
    </button>
  </span>
);

const AdPreview: React.FC<{ adFormat: string; campaignName: string; cta?: string; previewSrc?: string | null }> = ({ adFormat, campaignName, cta, previewSrc }) => {
  const badge = useMemo(() => {
    switch (adFormat) {
      case "Video":
        return "Video Preview";
      case "Push":
        return "Push Preview";
      case "Native":
        return "Native";
      case "Interstitial":
        return "Interstitial";
      default:
        return "Banner";
    }
  }, [adFormat]);

  return (
    <div className="w-full h-48 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 overflow-hidden">
      <div className="w-1/3 h-full flex items-center justify-center">
        {previewSrc ? (
          <img src={previewSrc} alt="preview" className="max-h-36 object-contain rounded" />
        ) : (
          <div className="w-36 h-24 rounded-md bg-gray-100 flex items-center justify-center text-sm text-gray-500">No asset</div>
        )}
      </div>
      <div className="flex-1 h-full flex flex-col justify-between py-1">
        <div>
          <div className="text-sm text-gray-500">{badge}</div>
          <div className="text-lg font-semibold text-gray-900">{campaignName || "Campaign name"}</div>
          <div className="text-xs text-gray-500 mt-1">Preview of how the creative will appear for selected format</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">Live preview</div>
          <button className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">{cta || "Learn"}</button>
        </div>
      </div>
    </div>
  );
};

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
  const [adFormat, setAdFormat] = useState("Banner");
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

  const [videoDuration, setVideoDuration] = useState<number | string>(15);
  const [pushTitle, setPushTitle] = useState("");
  const [nativeHeadline, setNativeHeadline] = useState("");

  const countryList = [
    "Central African Republic",
    "Chad",
    "Chile",
    "China",
    "Colombia",
    "Comoros",
    "Croatia",
    "Cuba",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Dominica",
    "Dominican Republic",
    "Ecuador",
    "Egypt",
    "El Salvador",
    "Equatorial Guinea",
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

    // Basic validation
    if (!campaignName || !redirectUrl || !campaignType || !maxPrice) {
      setSubmissionMessage({ type: "error", text: "Please fill required fields (name, redirect URL, campaign type, max price)." });
      setTimeout(() => setSubmissionMessage(null), 5000);
      return;
    }

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
      adFormat,
      bannerLayout,
      bannerSize,
      ctaButton,
      uploadedImage: uploadedImage ? uploadedImage.name : null,
      platforms,
      countries,
      startDate,
      endDate,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-white shadow">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Campaign Builder</h1>
            <p className="text-sm text-gray-500 mt-1">Create, preview and deploy high-converting ad campaigns</p>
          </div>
        </header>

        {submissionMessage && (
          <div className={`mb-4 p-4 rounded-md border ${
            submissionMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <div className="flex items-center gap-3">
              {submissionMessage.type === "success" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <div className="text-sm">{submissionMessage.text}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
            <section>
              <SectionTitle title="Basic" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={smallLabel}>Campaign Name</label>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className={inputClasses} placeholder="Summer Promo #1" />
                </div>

                <div>
                  <label className={smallLabel}>Redirect URL</label>
                  <input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className={inputClasses} placeholder="https://example.com/offer" />
                </div>

                <div className="md:col-span-2">
                  <label className={smallLabel}>Description</label>
                  <textarea value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} className={`${inputClasses} h-24`} placeholder="Short description shown in native placements" />
                </div>

                <div>
                  <label className={smallLabel}>Campaign Type</label>
                  <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className={selectClasses}>
                    <option value="">Select campaign type</option>
                    <option value="CPC">CPC</option>
                    <option value="CPA">CPA</option>
                    <option value="Views">Views (CPM)</option>
                  </select>
                </div>

                <div>
                  <label className={smallLabel}>Max Price ($)</label>
                  <input type="number" min="0" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={inputClasses} placeholder="0.05" />
                </div>
              </div>
            </section>

            <section className="mt-6">
              <SectionTitle title="Target IDs" />
              <div className="flex gap-2 mb-3">
                <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault() || handleAddTarget())} className={`${inputClasses} flex-1`} placeholder="Add target ID (press Enter)" />
                <button type="button" onClick={handleAddTarget} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Add</button>
              </div>
              <div className="flex flex-wrap">
                {targetIds.map((t) => (
                  <Pill key={t} id={t} onRemove={handleRemoveTarget} />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <SectionTitle title="Pricing & Budget" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className={smallLabel}>Price Adjust</label>
                  <input type="number" step="0.01" value={priceAdjust} onChange={(e) => setPriceAdjust(e.target.value)} className={inputClasses} placeholder="0.00" />
                </div>
                <div>
                  <label className={smallLabel}>Max Price ($)</label>
                  <input type="number" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={inputClasses} placeholder="0.50" />
                </div>
              </div>
            </section>

            <section className="mt-6">
              <SectionTitle title="Media & Creative" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                  <label className={smallLabel}>Upload Creative</label>
                  <input id="file-upload" type="file" onChange={handleImageUpload} className={fileInputClasses} accept="image/*,video/*" />
                </div>
              </div>

              <div className="mt-4">
                <label className={smallLabel}>Advertising Format</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
                  <FormatCard name="Banner" Icon={Monitor} desc="Leaderboard, MPU" selected={adFormat === "Banner"} onClick={() => setAdFormat("Banner")} />
                  <FormatCard name="Native" Icon={Layers} desc="In-feed, content native" selected={adFormat === "Native"} onClick={() => setAdFormat("Native")} />
                  <FormatCard name="Interstitial" Icon={Image} desc="Full-screen ads" selected={adFormat === "Interstitial"} onClick={() => setAdFormat("Interstitial")} />
                  <FormatCard name="Video" Icon={Video} desc="In-stream & rewarded" selected={adFormat === "Video"} onClick={() => setAdFormat("Video")} />
                  <FormatCard name="Push" Icon={Bell} desc="Push notifications" selected={adFormat === "Push"} onClick={() => setAdFormat("Push")} />
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={smallLabel}>Banner Layout</label>
                    <select value={bannerLayout} onChange={(e) => setBannerLayout(e.target.value)} className={selectClasses}>
                      <option value="">Choose layout</option>
                      <option value="layout1">Standard Banner</option>
                      <option value="layout2">Full Screen Overlay</option>
                    </select>
                  </div>

                  <div>
                    <label className={smallLabel}>Banner Size</label>
                    <select value={bannerSize} onChange={(e) => setBannerSize(e.target.value)} className={selectClasses}>
                      <option value="">Select size</option>
                      <option value="300x250">300x250</option>
                      <option value="728x90">728x90</option>
                      <option value="320x50">320x50</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <div className="text-xs text-gray-500">Selected format:</div>
                    <div className="ml-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold">{adFormat}</div>
                  </div>
                </div>

                {/* Conditional fields for formats */}
                {adFormat === "Video" && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={smallLabel}>Video Duration (sec)</label>
                      <input type="number" min={1} value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                      <label className={smallLabel}>Autoplay</label>
                      <select className={selectClasses}>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>
                  </div>
                )}

                {adFormat === "Push" && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={smallLabel}>Push Title</label>
                      <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} className={inputClasses} placeholder="50 characters max" />
                    </div>
                    <div>
                      <label className={smallLabel}>Push Message</label>
                      <input className={inputClasses} placeholder="Short message" />
                    </div>
                  </div>
                )}

                {adFormat === "Native" && (
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <label className={smallLabel}>Native Headline</label>
                    <input value={nativeHeadline} onChange={(e) => setNativeHeadline(e.target.value)} className={inputClasses} placeholder="Catchy headline for native placement" />
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <SectionTitle title="Targeting" />
              <div className="mb-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">Platforms</div>
                <div className="grid grid-cols-3 gap-3">
                  <PlatformCard name="Android" selected={platforms.includes("Android")} onClick={() => togglePlatform("Android")} Icon={Smartphone} />
                  <PlatformCard name="iOS" selected={platforms.includes("iOS")} onClick={() => togglePlatform("iOS")} Icon={Smartphone} />
                  <PlatformCard name="Web" selected={platforms.includes("Web")} onClick={() => togglePlatform("Web")} Icon={Monitor} />
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Target Countries</div>
                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-3 border border-gray-100 rounded">
                  {countryList.map((country) => (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleCountry(country)}
                      className={`text-sm px-3 py-1 rounded-md transition ${
                        countries.includes(country) ? "bg-indigo-600 text-white" : "bg-white text-gray-700 border border-gray-200"
                      }`}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-6">
              <SectionTitle title="Schedule & Settings" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={smallLabel}>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className={smallLabel}>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClasses} />
                </div>
              </div>
            </section>

            <div className="mt-6 flex items-center gap-3">
              <button type="submit" className="px-6 py-3 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">Deploy Campaign</button>
              <button type="button" onClick={() => console.log("Preview") } className="px-4 py-2 rounded-md border">Save Draft</button>
            </div>
          </div>

          {/* Right: Preview & summary */}
          <aside className="bg-white p-6 rounded-lg shadow-sm">
            <div className="mb-4">
              <AdPreview adFormat={adFormat} campaignName={campaignName} cta={ctaButton || "Learn More"} previewSrc={uploadedImagePreview} />
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Summary</h4>
              <div className="text-xs text-gray-600 space-y-2">
                <div><span className="font-medium text-gray-800">Type:</span> {campaignType || "—"}</div>
                <div><span className="font-medium text-gray-800">Format:</span> {adFormat}</div>
                <div><span className="font-medium text-gray-800">Platforms:</span> {platforms.length ? platforms.join(", ") : "—"}</div>
                <div><span className="font-medium text-gray-800">Countries:</span> {countries.length ? countries.slice(0,5).join(", ") + (countries.length>5?"...":"") : "—"}</div>
                <div><span className="font-medium text-gray-800">Targets:</span> {targetIds.length}</div>
                <div><span className="font-medium text-gray-800">Max Price:</span> ${maxPrice || "—"}</div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-gray-500 mb-1">Notes</label>
                <textarea className="w-full p-2 border border-gray-100 rounded h-20 text-xs text-gray-600" placeholder="Optional notes for this campaign (internal)" />
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default CampaignBuilder;
