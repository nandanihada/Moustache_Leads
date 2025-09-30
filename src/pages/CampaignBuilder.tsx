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

const smallLabel = "text-[10px] font-medium text-gray-500 mb-1";
const inputClasses =
  "w-full p-2 text-xs border border-gray-200 bg-white rounded-md shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition duration-150 placeholder-gray-400";
const selectClasses = `${inputClasses} appearance-none`;
const fileInputClasses =
  "w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer";

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-sm md:text-sm font-semibold text-gray-800 mb-2">
    {title}
  </h3>
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
    className={`flex flex-col items-start gap-1.5 p-3 rounded-md border transition-shadow duration-200 text-left hover:shadow focus:outline-none text-xs  ${
      selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
    }`}
  >
    <div className="flex items-center gap-2 w-full">
      <div
        className={`p-1.5 rounded ${
          selected ? "bg-blue-100" : "bg-gray-100"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${
            selected ? "text-blue-600" : "text-gray-700"
          }`}
        />
      </div>
      <div className="flex-1">
        <div
          className={`font-semibold text-xs ${
            selected ? "text-gray-900" : "text-gray-800"
          }`}
        >
          {name}
        </div>
        {desc && <div className="text-[10px] text-gray-500">{desc}</div>}
      </div>
      <div className="ml-auto">
        {selected ? <CheckCircle className="w-4 h-4 text-blue-600" /> : null}
      </div>
    </div>
  </button>
);

const PlatformCard: React.FC<{
  name: string;
  selected: boolean;
  onClick: () => void;
  Icon: React.ComponentType<any>;
}> = ({ name, selected, onClick, Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 p-2 rounded-md border text-xs transition-colors duration-200 ${
      selected
        ? "border-blue-500 bg-blue-50"
        : "border-gray-200 bg-white hover:border-blue-300"
    }`}
  >
    <Icon
      className={`w-4 h-4 ${
        selected ? "text-blue-600" : "text-gray-600"
      }`}
    />
    <div className="font-semibold text-xs">{name}</div>
  </button>
);

const Pill: React.FC<{ id: string; onRemove: (id: string) => void }> = ({
  id,
  onRemove,
}) => (
  <span className="inline-flex items-center bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-1.5 mb-1.5 border border-gray-200">
    {id}
    <button
      type="button"
      onClick={() => onRemove(id)}
      className="ml-1 text-gray-500 hover:text-gray-800"
    >
      <XCircle className="w-3.5 h-3.5" />
    </button>
  </span>
);

const AdPreview: React.FC<{
  adFormat: string;
  campaignName: string;
  cta?: string;
  previewSrc?: string | null;
}> = ({ adFormat, campaignName, cta, previewSrc }) => {
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
    <div className="w-full h-40 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md p-3 flex items-center gap-3 overflow-hidden text-xs">
      <div className="w-1/3 h-full flex items-center justify-center">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt="preview"
            className="max-h-28 object-contain rounded"
          />
        ) : (
          <div className="w-28 h-20 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
            No asset
          </div>
        )}
      </div>
      <div className="flex-1 h-full flex flex-col justify-between py-0.5">
        <div>
          <div className="text-[10px] text-gray-500">{badge}</div>
          <div className="text-sm font-semibold text-gray-900">
            {campaignName || "Campaign name"}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Preview of how the creative will appear for selected format
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-gray-400">Live preview</div>
          <button className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">
            {cta || "Learn"}
          </button>
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
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [headlineText, setHeadlineText] = useState("");

  const [submissionMessage, setSubmissionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const toggleCountry = (country: string) => {
    setCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setUploadedPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaignName || !redirectUrl || !campaignType || !maxPrice) {
      setSubmissionMessage({
        type: "error",
        text: "Please fill required fields (name, redirect URL, campaign type, max price).",
      });
      setTimeout(() => setSubmissionMessage(null), 5000);
      return;
    }

    const payload = {
      campaignName,
      campaignDesc,
      advertiserName,
      language,
      redirectUrl,
      campaignType,
      campaignObjective,
      targetIds,
      pricingModel,
      priceAdjust,
      maxPrice,
      dailyBudget,
      totalBudget,
      bidType,
      adType,
      adFormat,
      ctaButton,
      headlineText,
      uploadedFiles: uploadedFiles.map((f) => f.name),
      platforms,
      countries,
    };

    console.log("--- Submitted Campaign Data ---");
    console.log(payload);
    console.log("-------------------------------");

    setSubmissionMessage({
      type: "success",
      text: "Campaign submitted successfully! Check the console for the payload.",
    });
    setTimeout(() => setSubmissionMessage(null), 6000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6 font-sans text-xs">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-white shadow">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              Campaign Builder
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Create, preview and deploy high-converting ad campaigns
            </p>
          </div>
        </header>

        {submissionMessage && (
          <div
            className={`mb-3 p-3 rounded-md border ${
              submissionMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2 text-xs">
              {submissionMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <div>{submissionMessage.text}</div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 bg-white p-4 rounded-md shadow-sm">
            {/* BASIC INFO */}
            <SectionTitle title="Basic Info" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={smallLabel}>Campaign Name</label>
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className={inputClasses}
                  placeholder="Summer Promo #1"
                />
              </div>
              <div>
                <label className={smallLabel}>Advertiser / Brand</label>
                <input
                  value={advertiserName}
                  onChange={(e) => setAdvertiserName(e.target.value)}
                  className={inputClasses}
                  placeholder="Advertiser name"
                />
              </div>
              <div>
                <label className={smallLabel}>Redirect URL</label>
                <input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  className={inputClasses}
                  placeholder="https://example.com/offer"
                />
              </div>
              <div>
                <label className={smallLabel}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Default</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={smallLabel}>Description</label>
                <textarea
                  value={campaignDesc}
                  onChange={(e) => setCampaignDesc(e.target.value)}
                  className={`${inputClasses} h-20`}
                  placeholder="Short description shown in native placements"
                />
              </div>
              <div>
                <label className={smallLabel}>Campaign Type</label>
                <select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select campaign type</option>
                  <option value="CPC">CPC</option>
                  <option value="CPA">CPA</option>
                  <option value="Views">Views (CPM)</option>
                </select>
              </div>
              <div>
                <label className={smallLabel}>Objective</label>
                <select
                  value={campaignObjective}
                  onChange={(e) => setCampaignObjective(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Choose objective</option>
                  <option value="traffic">Traffic</option>
                  <option value="conversions">Conversions</option>
                  <option value="engagement">Engagement</option>
                </select>
              </div>
            </div>

            {/* TARGET IDs */}
            <SectionTitle title="Target IDs" />
            <div className="flex gap-2 mb-2">
              <input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault() || handleAddTarget())
                }
                className={`${inputClasses} flex-1`}
                placeholder="Add target ID (press Enter)"
              />
              <button
                type="button"
                onClick={handleAddTarget}
                className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap mb-2">
              {targetIds.map((t) => (
                <Pill key={t} id={t} onRemove={handleRemoveTarget} />
              ))}
            </div>

            {/* PRICING */}
            <SectionTitle title="Pricing & Budget" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={smallLabel}>Pricing Model</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select pricing model</option>
                  <option value="CPC">CPC</option>
                  <option value="CPM">CPM</option>
                  <option value="CPA">CPA</option>
                </select>
              </div>
              <div>
                <label className={smallLabel}>Price Adjust</label>
                <input
                  type="number"
                  step="0.01"
                  value={priceAdjust}
                  onChange={(e) => setPriceAdjust(e.target.value)}
                  className={inputClasses}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={smallLabel}>Max Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={inputClasses}
                  placeholder="0.50"
                />
              </div>
              <div>
                <label className={smallLabel}>Daily Budget ($)</label>
                <input
                  type="number"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className={inputClasses}
                  placeholder="500"
                />
              </div>
              <div>
                <label className={smallLabel}>Total Budget ($)</label>
                <input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className={inputClasses}
                  placeholder="5000"
                />
              </div>
              <div>
                <label className={smallLabel}>Bid Type</label>
                <select
                  value={bidType}
                  onChange={(e) => setBidType(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select bid type</option>
                  <option value="fixed">Fixed</option>
                  <option value="auto">Auto-optimised</option>
                </select>
              </div>
            </div>

            {/* PLATFORMS */}
            <SectionTitle title="Platforms" />
            <div className="flex gap-2 flex-wrap mb-2">
              <PlatformCard
                name="Mobile"
                selected={platforms.includes("Mobile")}
                onClick={() => togglePlatform("Mobile")}
                Icon={Smartphone}
              />
              <PlatformCard
                name="Desktop"
                selected={platforms.includes("Desktop")}
                onClick={() => togglePlatform("Desktop")}
                Icon={Monitor}
              />
            </div>

            {/* COUNTRIES */}
            <SectionTitle title="Countries" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto mb-2">
              {countryList.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 text-[11px] text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={countries.includes(c)}
                    onChange={() => toggleCountry(c)}
                    className="w-3 h-3"
                  />
                  {c}
                </label>
              ))}
            </div>

            {/* AD CREATIVE */}
            <SectionTitle title="Ad Creative" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={smallLabel}>Ad Type</label>
                <select
                  value={adType}
                  onChange={(e) => setAdType(e.target.value)}
                  className={selectClasses}
                >
                  <option value="Image Ad">Image Ad</option>
                  <option value="Video Ad">Video Ad</option>
                  <option value="Carousel Ad">Carousel Ad</option>
                </select>
              </div>
              <div>
                <label className={smallLabel}>Ad Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <FormatCard
                    name="Banner"
                    desc="Standard sizes"
                    selected={adFormat === "Banner"}
                    onClick={() => setAdFormat("Banner")}
                    Icon={Image}
                  />
                  <FormatCard
                    name="Video"
                    desc="In-stream"
                    selected={adFormat === "Video"}
                    onClick={() => setAdFormat("Video")}
                    Icon={Video}
                  />
                  <FormatCard
                    name="Push"
                    desc="Notification"
                    selected={adFormat === "Push"}
                    onClick={() => setAdFormat("Push")}
                    Icon={Bell}
                  />
                  <FormatCard
                    name="Interstitial"
                    desc="Full-screen"
                    selected={adFormat === "Interstitial"}
                    onClick={() => setAdFormat("Interstitial")}
                    Icon={Layers}
                  />
                </div>
              </div>
              <div>
                <label className={smallLabel}>CTA Button</label>
                <input
                  value={ctaButton}
                  onChange={(e) => setCtaButton(e.target.value)}
                  className={inputClasses}
                  placeholder="Download / Sign up"
                />
              </div>
              <div>
                <label className={smallLabel}>Headline Text</label>
                <input
                  value={headlineText}
                  onChange={(e) => setHeadlineText(e.target.value)}
                  className={inputClasses}
                  placeholder="Write a headline"
                />
              </div>
              <div className="md:col-span-2">
                <label className={smallLabel}>Upload Assets</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFilesUpload}
                  className={fileInputClasses}
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              {uploadedPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative border rounded-md overflow-hidden group"
                >
                  <img
                    src={src}
                    alt="preview"
                    className="object-cover w-full h-24"
                  />
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(i)}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-gray-100"
                  >
                    <XCircle className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN (Preview) */}
          <div className="lg:col-span-1 bg-white p-4 rounded-md shadow-sm">
            <SectionTitle title="Preview" />
            <AdPreview
              adFormat={adFormat}
              campaignName={campaignName}
              cta={ctaButton}
              previewSrc={uploadedPreviews[0]}
            />
          </div>

          {/* SUBMIT */}
          <div className="lg:col-span-3 mt-3">
            <button
              type="submit"
              className="w-full py-2.5 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Save Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignBuilder;
