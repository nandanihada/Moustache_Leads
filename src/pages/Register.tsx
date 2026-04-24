import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, Check } from "lucide-react";
import { AuthLoadingOverlay } from "../components/LoadingSpinner";
import { toast } from "sonner";

export default function Register() {
  const [step, setStep] = useState(1);
  const totalSteps = 8;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    promotionMethod: "",
    trafficSources: [] as string[],
    verticals: [] as string[],
    geos: [] as string[],
    promotionDescription: "",
    websiteUrls: [""] as string[],
    monthlyVisits: "",
    conversionRate: "",
    linkedinUrl: "",
    telegramHandle: "",
    teamAccount: "",
    unitAddress: "",
    streetAddress: "",
    city: "",
    country: "",
    stateProvince: "",
    postalCode: "",
    taxId: "",
    vatId: "",
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    smartLinkInterest: "none",
    smartLinkTrafficSource: "",
    acceptTerms: false,
    acceptMarketing: false
  });

  const AVAILABLE_VERTICALS = ['Sweeps', 'Finance', 'Dating', 'CPA', 'CPI', 'Crypto', 'Nutra', 'E-commerce', 'Gaming', 'Software', 'Surveys', 'Other'];
  const AVAILABLE_GEOS = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN', 'JP', 'WW'];
  const TRAFFIC_SOURCE_OPTIONS = ['Website/Blog', 'Paid Ads', 'Email Lists', 'Social Media', 'Telegram/Communities', 'Other'];

  const [captchaVerified, setCaptchaVerified] = useState(false);

  const toggleArrayItem = (field: 'trafficSources' | 'verticals' | 'geos', item: string) => {
    setFormData(prev => {
      const arr = prev[field] as string[];
      if (arr.includes(item)) return { ...prev, [field]: arr.filter(i => i !== item) };
      return { ...prev, [field]: [...arr, item] };
    });
  };

  const handleUrlChange = (index: number, val: string) => {
    const newUrls = [...formData.websiteUrls];
    newUrls[index] = val;
    setFormData({ ...formData, websiteUrls: newUrls });
  };
  const addUrl = () => setFormData({ ...formData, websiteUrls: [...formData.websiteUrls, ""] });


  const [partners, setPartners] = useState([{ network: "", email: "" }]);
  const [showStats, setShowStats] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationData, setRegistrationData] = useState<{
    email: string;
    username: string;
    token: string;
  } | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const referralProgram = searchParams.get('p') || '1';
  const { login } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePartnerChange = (index: number, field: string, value: string) => {
    const newPartners = [...partners];
    newPartners[index] = { ...newPartners[index], [field]: value };
    setPartners(newPartners);
  };

  const addPartner = () => {
    if (partners.length < 5) {
      setPartners([...partners, { network: "", email: "" }]);
    }
  };

  const progress = Math.round((step / totalSteps) * 100);

  const handleStep1Continue = async () => {
    setErrorMessage("");
    
    if (!formData.fullName || !formData.email || !formData.password || !formData.acceptTerms || !captchaVerified) {
      const err = "Please fill in all fields, confirm captcha, and accept Terms.";
      setErrorMessage(err);
      toast.error(err);
      return;
    }
    
    if (formData.password.length < 6) {
      const err = "Password must be at least 6 characters.";
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    setLoading(true);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const names = formData.fullName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '';
      
      const userEmail = formData.email.toLowerCase().trim();
      const username = userEmail.split('@')[0] + Math.floor(Math.random() * 100);
      
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          email: userEmail,
          password: formData.password,
          first_name: firstName,
          last_name: lastName,
          role: 'partner',
          terms_accepted: formData.acceptTerms,
          newsletter_consent: formData.acceptMarketing,
          referral_code: referralCode,
          referral_program: referralProgram,
          verticals: formData.verticals,
          geos: formData.geos,
          traffic_sources: formData.trafficSources,
          website_urls: formData.websiteUrls,
          promotion_description: formData.promotionDescription,
          monthly_visits: formData.monthlyVisits,
          conversion_rate: formData.conversionRate,
          social_contacts: {
            linkedin: formData.linkedinUrl,
            telegram: formData.telegramHandle,
            agency: formData.teamAccount
          },
          smart_link_interest: formData.smartLinkInterest,
          smart_link_traffic_source: formData.smartLinkTrafficSource,
          address: {
            street: formData.streetAddress,
            unit: formData.unitAddress,
            city: formData.city,
            country: formData.country,
            state: formData.stateProvince,
            postal: formData.postalCode
          },
          payout_details: {
            tax_id: formData.taxId,
            vat_id: formData.vatId,
            bank_name: formData.bankName,
            account_name: formData.accountHolderName,
            account_number: formData.accountNumber,
            routing_number: formData.routingNumber
          }
        }),
      });
      
      const data = await res.json();
      
      if (data.token) {
        setRegistrationData({
          email: userEmail,
          username: username,
          token: data.token
        });
        // Don't auto-login — user must verify email first
        toast.success("Account created! Please complete your profile.");
        setStep(2);
      } else {
        const errorText = data.error || "Registration failed";
        setErrorMessage(errorText);
        toast.error(errorText);
      }
    } catch (error) {
        // Fallback for network issues
        const errorText = "Network error. Please make sure the backend server is running.";
        setErrorMessage(errorText);
        toast.error(errorText);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  // Save steps 2-7 profile data to backend
  const saveProfileAndFinish = async () => {
    if (!registrationData?.token) {
      // No token means registration didn't complete — just go to step 8
      nextStep();
      return;
    }
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await fetch(`${API_URL}/api/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${registrationData.token}`,
        },
        body: JSON.stringify({
          verticals: formData.verticals,
          geos: formData.geos,
          traffic_sources: formData.trafficSources,
          website_urls: formData.websiteUrls.filter(u => u.trim()),
          promotion_description: formData.promotionDescription,
          monthly_visits: formData.monthlyVisits,
          conversion_rate: formData.conversionRate,
          social_contacts: {
            linkedin: formData.linkedinUrl,
            telegram: formData.telegramHandle,
            agency: formData.teamAccount,
          },
          smart_link_interest: formData.smartLinkInterest,
          smart_link_traffic_source: formData.smartLinkTrafficSource,
          address: {
            street: formData.streetAddress,
            unit: formData.unitAddress,
            city: formData.city,
            country: formData.country,
            state: formData.stateProvince,
            postal: formData.postalCode,
          },
          payout_details: {
            tax_id: formData.taxId,
            vat_id: formData.vatId,
            bank_name: formData.bankName,
            account_name: formData.accountHolderName,
            account_number: formData.accountNumber,
            routing_number: formData.routingNumber,
          },
          partners: partners.filter(p => p.network || p.email),
        }),
      });
    } catch (err) {
      // Non-blocking — profile save failure shouldn't block registration completion
      console.error('Profile save error:', err);
    }
    nextStep();
  };

  // Visual enhancements for bigger font and shorter aesthetic
  const inputClass = "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-base outline-none focus:border-purple-400 transition-colors placeholder:text-purple-200/50 backdrop-blur-sm";
  const labelClass = "block text-sm font-medium text-purple-100 mb-2";
  const fieldClass = "mb-5";
  const btnPrimary = "px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-base font-semibold hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg transform hover:scale-[1.02]";
  const btnSkip = "px-5 py-3 bg-transparent text-base text-purple-300 hover:text-white transition-colors font-medium";
  const btnBack = "px-5 py-3 bg-transparent border border-purple-500/30 rounded-lg text-base text-purple-300 hover:border-purple-400 hover:text-white transition-colors";

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12 px-4 overflow-hidden bg-slate-900">
      {/* Deep Purple Gradient Background matches Login Screen aesthetic */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
        {/* Floating Orbs matching Login */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{animationDelay: '2s'}}></div>
      </div>

      {loading && <AuthLoadingOverlay message="Creating Account..." />}

      <div className="w-full max-w-xl z-10 backdrop-blur-md bg-black/20 p-8 rounded-3xl shadow-2xl border border-white/10">
        <div className="h-1.5 bg-white/10 rounded-full mb-10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Step 1: Account basics */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center sm:text-left">
            <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">Create Account</h2>

            <div className={fieldClass}>
              <label className={labelClass}>Full Name</label>
              <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={inputClass} placeholder="John Doe" />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@example.com" />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className={inputClass} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <input type="checkbox" checked={captchaVerified} onChange={(e) => setCaptchaVerified(e.target.checked)} className="w-5 h-5 rounded cursor-pointer" />
                 <span className="text-white text-sm font-medium">I am not a robot</span>
               </div>
               <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" width="30" alt="reCAPTCHA" />
            </div>

            <div className="flex flex-col gap-3 mt-4 mb-6">
              <label className="flex items-center gap-2 text-sm text-purple-200 cursor-pointer">
                <input type="checkbox" name="acceptTerms" checked={formData.acceptTerms} onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})} className="w-4 h-4 rounded cursor-pointer" />
                I accept the Terms and Conditions
              </label>
              <label className="flex items-center gap-2 text-sm text-purple-200 cursor-pointer">
                <input type="checkbox" name="acceptMarketing" checked={formData.acceptMarketing} onChange={(e) => setFormData({...formData, acceptMarketing: e.target.checked})} className="w-4 h-4 rounded cursor-pointer" />
                I would like to receive marketing emails
              </label>
            </div>
            
            {errorMessage && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 text-red-100 text-base rounded-lg animate-in fade-in flex items-center gap-3">
                <span className="text-xl">⚠️</span> {errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10">
              <Link to="/login" className="text-base text-purple-300 hover:text-white font-medium transition-colors">Already have an account?</Link>
              <button className={`${btnPrimary} w-full sm:w-auto`} onClick={handleStep1Continue}>Continue &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 2: Promotion method */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Preferences & Traffic</h2>
            
            <label className={labelClass}>Traffic Sources (Select all that apply)</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {TRAFFIC_SOURCE_OPTIONS.map(opt => (
                <div key={opt} onClick={() => toggleArrayItem('trafficSources', opt)} className={`px-4 py-2 border rounded-full cursor-pointer text-sm font-medium transition-all ${formData.trafficSources.includes(opt) ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30'}`}>
                  {opt}
                </div>
              ))}
            </div>

            <label className={labelClass}>Verticals of Interest</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {AVAILABLE_VERTICALS.map(opt => (
                <div key={opt} onClick={() => toggleArrayItem('verticals', opt)} className={`px-3 py-1.5 border rounded cursor-pointer text-sm font-medium transition-all ${formData.verticals.includes(opt) ? 'border-blue-400 bg-blue-500/20 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30'}`}>
                  {opt}
                </div>
              ))}
            </div>

            <label className={labelClass}>Target GEOs</label>
            <div className="flex flex-wrap gap-2 mb-8">
              {AVAILABLE_GEOS.map(opt => (
                <div key={opt} onClick={() => toggleArrayItem('geos', opt)} className={`px-3 py-1.5 border rounded cursor-pointer text-sm font-medium transition-all ${formData.geos.includes(opt) ? 'border-green-400 bg-green-500/20 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'border-white/10 bg-white/5 text-purple-200 hover:border-white/30'}`}>
                  {opt}
                </div>
              ))}
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Additional Description (Optional)</label>
              <textarea name="promotionDescription" value={formData.promotionDescription} onChange={handleChange} className={inputClass} style={{ minHeight: '80px' }} placeholder="Briefly describe your traffic..."></textarea>
            </div>

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={() => { }}>Disabled</button>
              <button className={btnPrimary} onClick={nextStep}>Next &rarr;</button>
            </div>
          </div>
        )}

        {/* Step 3: Website & stats */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">URLs</h2>
            
            <div className={fieldClass}>
              <label className={labelClass}>Main URL or Profiles</label>
              <div className="space-y-3">
                {formData.websiteUrls.map((url, i) => (
                   <input key={i} type="text" value={url} onChange={(e) => handleUrlChange(i, e.target.value)} className={inputClass} placeholder="https://..." />
                ))}
              </div>
              <button 
                onClick={addUrl} 
                className="mt-3 text-sm text-purple-300 font-medium hover:text-white transition-colors flex items-center gap-1"
              >
                + Add More URL
              </button>
            </div>

            <label className="block text-base font-medium text-white mt-8 mb-4">Traffic Stats (Optional)</label>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div onClick={() => setShowStats(true)} className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${showStats ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <strong className="block text-base text-white mb-1">Add Now</strong>
              </div>
              <div onClick={() => setShowStats(false)} className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${!showStats ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <strong className="block text-base text-white mb-1">Skip for Later</strong>
              </div>
            </div>

            {showStats && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                <div className={fieldClass}>
                  <label className={labelClass}>Monthly Reach</label>
                  <input type="text" name="monthlyVisits" value={formData.monthlyVisits} onChange={handleChange} className={inputClass} placeholder="e.g. 50k" />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Avg Conversion</label>
                  <input type="text" name="conversionRate" value={formData.conversionRate} onChange={handleChange} className={inputClass} placeholder="e.g. 2%" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={prevStep}>Back</button>
              <div className="flex gap-2">
                <button className={btnSkip} onClick={nextStep}>Skip</button>
                <button className={btnPrimary} onClick={nextStep}>Next &rarr;</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Social Accounts */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Social Contacts & Smart Links</h2>
            
            <div className={fieldClass}>
              <label className={labelClass}>LinkedIn URL</label>
              <input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} className={inputClass} placeholder="https://linkedin.com/..." />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Telegram ID</label>
              <input type="text" name="telegramHandle" value={formData.telegramHandle} onChange={handleChange} className={inputClass} placeholder="@username" />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Agency Name</label>
              <input type="text" name="teamAccount" value={formData.teamAccount} onChange={handleChange} className={inputClass} placeholder="Optional team name" />
            </div>
            
            <div className="mt-8 mb-4 border-t border-white/10 pt-8">
               <label className={labelClass}>Are you interested in Smart Links?</label>
               <div className="flex gap-4 mb-4">
                  <div onClick={() => setFormData({...formData, smartLinkInterest: 'yes'})} className={`flex-1 p-3 border rounded-xl cursor-pointer text-center transition-all ${formData.smartLinkInterest === 'yes' ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5'}`}>
                     <strong className="text-white">Yes</strong>
                  </div>
                  <div onClick={() => setFormData({...formData, smartLinkInterest: 'no'})} className={`flex-1 p-3 border rounded-xl cursor-pointer text-center transition-all ${formData.smartLinkInterest === 'no' ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5'}`}>
                     <strong className="text-white">No</strong>
                  </div>
               </div>
               {formData.smartLinkInterest === 'yes' && (
                  <div className={fieldClass}>
                    <label className={labelClass}>Smart Link Traffic Source</label>
                    <input type="text" name="smartLinkTrafficSource" value={formData.smartLinkTrafficSource} onChange={handleChange} className={inputClass} placeholder="Describe source..." />
                  </div>
               )}
            </div>

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={prevStep}>Back</button>
              <div className="flex gap-2">
                <button className={btnSkip} onClick={nextStep}>Skip</button>
                <button className={btnPrimary} onClick={nextStep}>Next &rarr;</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Partners */}
        {step === 5 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Network References</h2>
            
            <div className="space-y-4">
              {partners.map((partner, index) => (
                <div key={index} className="p-5 border border-white/10 bg-white/5 rounded-xl">
                  <div className={fieldClass}>
                    <label className={labelClass}>Network Platform</label>
                    <input type="text" value={partner.network} onChange={(e) => handlePartnerChange(index, "network", e.target.value)} className={inputClass} placeholder="MaxBounty, ClickBank, etc." />
                  </div>
                  <div className="mb-0">
                    <label className={labelClass}>Manager Email</label>
                    <input type="email" value={partner.email} onChange={(e) => handlePartnerChange(index, "email", e.target.value)} className={inputClass} placeholder="contact@network.com" />
                  </div>
                </div>
              ))}
            </div>
            
            {partners.length < 3 && (
              <button className="text-purple-300 font-medium mt-4 hover:text-white transition-colors" onClick={addPartner}>
                + Add another reference
              </button>
            )}

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={prevStep}>Back</button>
              <div className="flex gap-2">
                <button className={btnSkip} onClick={nextStep}>Skip</button>
                <button className={btnPrimary} onClick={nextStep}>Next &rarr;</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Address */}
        {step === 6 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Location details</h2>
            
            <div className="grid grid-cols-[2fr_1fr] gap-4 mb-5">
              <div>
                <label className={labelClass}>Street Address</label>
                <input type="text" name="streetAddress" value={formData.streetAddress} onChange={handleChange} className={inputClass} placeholder="123 Main St" />
              </div>
              <div>
                <label className={labelClass}>Flat / Unit</label>
                <input type="text" name="unitAddress" value={formData.unitAddress} onChange={handleChange} className={inputClass} placeholder="Apt 4B" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClass} placeholder="City" />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input type="text" name="country" value={formData.country} onChange={handleChange} className={inputClass} placeholder="Country" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>State / Region</label>
                <input type="text" name="stateProvince" value={formData.stateProvince} onChange={handleChange} className={inputClass} placeholder="State" />
              </div>
              <div>
                <label className={labelClass}>Postal Code</label>
                <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputClass} placeholder="ZIP" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={prevStep}>Back</button>
              <div className="flex gap-2">
                <button className={btnSkip} onClick={nextStep}>Skip</button>
                <button className={btnPrimary} onClick={nextStep}>Next &rarr;</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Tax & banking */}
        {step === 7 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Payout Details</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelClass}>Tax ID / SSN</label>
                <input type="text" name="taxId" value={formData.taxId} onChange={handleChange} className={inputClass} placeholder="Identifier" />
              </div>
              <div>
                <label className={labelClass}>VAT Number</label>
                <input type="text" name="vatId" value={formData.vatId} onChange={handleChange} className={inputClass} placeholder="If applicable" />
              </div>
            </div>
            <div className={fieldClass}>
              <label className={labelClass}><span className="text-red-400">*</span> Account Holder / Beneficiary Name</label>
              <input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} className={inputClass} placeholder="Name exactly as on account" />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} placeholder="Institution" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Account / IBAN</label>
                <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className={inputClass} placeholder="Number" />
              </div>
              <div>
                <label className={labelClass}>Routing / SWIFT</label>
                <input type="text" name="routingNumber" value={formData.routingNumber} onChange={handleChange} className={inputClass} placeholder="Code" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-10">
              <button className={btnBack} onClick={prevStep}>Back</button>
              <div className="flex gap-2">
                <button className={btnSkip} onClick={saveProfileAndFinish}>Skip</button>
                <button className={btnPrimary} onClick={saveProfileAndFinish}>Finish &rarr;</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 8: Done */}
        {step === 8 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-8">
            <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(74,222,128,0.2)]">
              <Check size={40} className="stroke-2" />
            </div>
            
            <h2 className="text-4xl font-extrabold text-white mb-4">Almost there!</h2>
            <p className="text-xl text-purple-200 mb-4 max-w-md mx-auto leading-relaxed">
              Your account has been created.
            </p>

            {/* Email verification notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span className="text-amber-300 font-bold text-lg">Verify your email</span>
              </div>
              <p className="text-purple-200 text-sm mb-3">
                We've sent a verification link to <span className="text-white font-semibold">{registrationData?.email}</span>
              </p>
              <p className="text-purple-300/80 text-xs">
                Please click the link in your email to verify your account. You won't be able to access the dashboard until your email is verified.
              </p>
            </div>

            <p className="text-purple-400 text-xs max-w-sm mx-auto">
              Didn't receive the email? Check your spam folder or contact support.
            </p>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
      `}</style>
    </div>
  );
}
