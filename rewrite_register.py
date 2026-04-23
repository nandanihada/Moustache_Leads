import re

with open('src/pages/Register.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update formData state
form_data_old = """  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    promotionMethod: "",
    promotionDescription: "",
    websiteUrl: "",
    monthlyVisits: "",
    conversionRate: "",
    linkedinUrl: "",
    telegramHandle: "",
    teamAccount: "",
    streetAddress: "",
    city: "",
    country: "",
    stateProvince: "",
    postalCode: "",
    taxId: "",
    vatId: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
  });"""

form_data_new = """  const [formData, setFormData] = useState({
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
"""
content = content.replace(form_data_old, form_data_new)

# 2. Add validation requirements to Step 1 & update fetch body
step_1_old = """    if (!formData.fullName || !formData.email || !formData.password) {
      const err = "Please fill in all fields.";"""

step_1_new = """    if (!formData.fullName || !formData.email || !formData.password || !formData.acceptTerms || !captchaVerified) {
      const err = "Please fill in all fields, confirm captcha, and accept Terms.";"""
content = content.replace(step_1_old, step_1_new)

# Fetch body update
api_body_old = """        body: JSON.stringify({
          username: username,
          email: userEmail,
          password: formData.password,
          first_name: firstName,
          last_name: lastName,
          role: 'partner',
          terms_accepted: true,
          newsletter_consent: true,
          referral_code: referralCode,
          referral_program: referralProgram,
        }),"""
api_body_new = """        body: JSON.stringify({
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
        }),"""
content = content.replace(api_body_old, api_body_new)

# 3. Step 1 Visual append (Captcha & T&C)
step1_vis_old = """              <div className="relative">
                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className={inputClass} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>"""
step1_vis_new = """              <div className="relative">
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
            </div>"""
content = content.replace(step1_vis_old, step1_vis_new)

# 4. Step 2 update
step2_old = """          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Traffic Sources</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                { id: 'web', title: 'Website / Blog' },
                { id: 'ads', title: 'Paid Ads' },
                { id: 'email', title: 'Email Lists' },
                { id: 'social', title: 'Social Media' },
                { id: 'telegram', title: 'Communities' },
                { id: 'other', title: 'Other' },
              ].map(opt => (
                <div key={opt.id} onClick={() => setFormData({ ...formData, promotionMethod: opt.id })} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${formData.promotionMethod === opt.id ? 'border-purple-400 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${formData.promotionMethod === opt.id ? 'border-purple-400 bg-purple-400' : 'border-white/30'}`}>
                    {formData.promotionMethod === opt.id && <div className="w-2 h-2 rounded-full bg-white"></div>}
                  </div>
                  <strong className="text-base font-medium text-white">{opt.title}</strong>
                </div>
              ))}
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Description</label>
              <textarea name="promotionDescription" value={formData.promotionDescription} onChange={handleChange} className={inputClass} style={{ minHeight: '100px' }} placeholder="Briefly describe your method..."></textarea>
            </div>"""

step2_new = """          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            </div>"""
content = content.replace(step2_old, step2_new)

# 5. Step 3 update (URL handling)
step3_old = """          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-white mb-8">Promo Channels</h2>
            
            <div className={fieldClass}>
              <label className={labelClass}>Main URL or Handle</label>
              <input type="url" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} className={inputClass} placeholder="https://..." />
            </div>"""
step3_new = """          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            </div>"""
content = content.replace(step3_old, step3_new)

# 6. Step 4 Verification -> Social Contacts
step4_old = """            <h2 className="text-3xl font-bold text-white mb-8">Verification</h2>"""
step4_new = """            <h2 className="text-3xl font-bold text-white mb-8">Social Contacts & Smart Links</h2>"""
content = content.replace(step4_old, step4_new)

# 6.5 Smart link interest in step 4
smartlink_old = """            <div className={fieldClass}>
              <label className={labelClass}>Agency Name</label>
              <input type="text" name="teamAccount" value={formData.teamAccount} onChange={handleChange} className={inputClass} placeholder="Optional team name" />
            </div>"""
smartlink_new = """            <div className={fieldClass}>
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
            </div>"""
content = content.replace(smartlink_old, smartlink_new)

# 7. Step 6 Location Details (unit address)
loc_old = """            <div className={fieldClass}>
              <label className={labelClass}>Street Address</label>
              <input type="text" name="streetAddress" value={formData.streetAddress} onChange={handleChange} className={inputClass} placeholder="123 Main St" />
            </div>"""
loc_new = """            <div className="grid grid-cols-[2fr_1fr] gap-4 mb-5">
              <div>
                <label className={labelClass}>Street Address</label>
                <input type="text" name="streetAddress" value={formData.streetAddress} onChange={handleChange} className={inputClass} placeholder="123 Main St" />
              </div>
              <div>
                <label className={labelClass}>Flat / Unit</label>
                <input type="text" name="unitAddress" value={formData.unitAddress} onChange={handleChange} className={inputClass} placeholder="Apt 4B" />
              </div>
            </div>"""
content = content.replace(loc_old, loc_new)

# 8. Step 7 Bank Details (account holder)
bank_old = """            <div className={fieldClass}>
              <label className={labelClass}>Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} placeholder="Institution" />
            </div>"""
bank_new = """            <div className={fieldClass}>
              <label className={labelClass}><span className="text-red-400">*</span> Account Holder / Beneficiary Name</label>
              <input type="text" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} className={inputClass} placeholder="Name exactly as on account" />
            </div>
            <div className={fieldClass}>
              <label className={labelClass}>Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} placeholder="Institution" />
            </div>"""
content = content.replace(bank_old, bank_new)

with open('src/pages/Register.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

