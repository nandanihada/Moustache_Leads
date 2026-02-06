import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

interface Reference {
  name: string;
  companyRole: string;
  email: string;
  contactNumber: string;
}

export default function AdvertiserRegister() {
  const [formData, setFormData] = useState({
    // General
    firstName: "",
    lastName: "",
    email: "",
    emailConfirmation: "",
    phoneNumber: "",
    password: "",
    passwordConfirmation: "",
    // Company
    companyName: "",
    websiteUrl: "",
    offerLandingPage: "",
    // Address
    address: "",
    apartment: "",
    country: "",
    city: "",
    zipCode: "",
    // Accounting
    accountingContactName: "",
    accountingContactRole: "",
    accountingContactNumber: "",
    accountingContactEmail: "",
    paymentAgreement: "",
    paymentTerms: "",
    // Additional
    einVatNumber: "",
    noMinimumThresholdAgreed: false,
    termsAgreed: false,
  });

  const [references, setReferences] = useState<Reference[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const addReference = () => {
    setReferences(prev => [...prev, { name: '', companyRole: '', email: '', contactNumber: '' }]);
  };

  const removeReference = (index: number) => {
    setReferences(prev => prev.filter((_, i) => i !== index));
  };

  const updateReference = (index: number, field: keyof Reference, value: string) => {
    setReferences(prev => prev.map((ref, i) => i === index ? { ...ref, [field]: value } : ref));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.emailConfirmation.trim()) newErrors.emailConfirmation = "Email Confirmation is required";
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone Number is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (!formData.passwordConfirmation) newErrors.passwordConfirmation = "Password Confirmation is required";
    if (!formData.companyName.trim()) newErrors.companyName = "Company Name is required";
    if (!formData.websiteUrl.trim()) newErrors.websiteUrl = "Website URL is required";
    if (!formData.offerLandingPage.trim()) newErrors.offerLandingPage = "Offer Landing Page is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.country.trim()) newErrors.country = "Country is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.zipCode.trim()) newErrors.zipCode = "ZIP/Postal Code is required";
    if (!formData.accountingContactName.trim()) newErrors.accountingContactName = "Accounting Contact Name is required";
    if (!formData.accountingContactNumber.trim()) newErrors.accountingContactNumber = "Accounting Contact Number is required";
    if (!formData.accountingContactEmail.trim()) newErrors.accountingContactEmail = "Accounting Contact Email is required";
    if (!formData.paymentAgreement.trim()) newErrors.paymentAgreement = "Payment Agreement is required";
    if (!formData.paymentTerms.trim()) newErrors.paymentTerms = "Payment Terms is required";
    if (!formData.einVatNumber.trim()) newErrors.einVatNumber = "EIN/VAT Number is required";

    // Email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (formData.accountingContactEmail && !emailRegex.test(formData.accountingContactEmail)) {
      newErrors.accountingContactEmail = "Invalid email format";
    }

    // Email confirmation
    if (formData.email.toLowerCase() !== formData.emailConfirmation.toLowerCase()) {
      newErrors.emailConfirmation = "Email addresses do not match";
    }

    // Password validation
    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (formData.password !== formData.passwordConfirmation) {
      newErrors.passwordConfirmation = "Passwords do not match";
    }

    // URL validation
    const urlRegex = /^https?:\/\//;
    if (formData.websiteUrl && !urlRegex.test(formData.websiteUrl)) {
      newErrors.websiteUrl = "URL must start with http:// or https://";
    }
    if (formData.offerLandingPage && !urlRegex.test(formData.offerLandingPage)) {
      newErrors.offerLandingPage = "URL must start with http:// or https://";
    }

    // Checkbox validations
    if (!formData.noMinimumThresholdAgreed) {
      newErrors.noMinimumThresholdAgreed = "You must agree to the No Minimum Threshold terms";
    }
    if (!formData.termsAgreed) {
      newErrors.termsAgreed = "You must agree to the Terms and Conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fix the errors in the form");
      return;
    }

    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/advertiser/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, references }),
      });

      const data = await res.json();

      if (data.token) {
        login(data.token, data.user);
        alert("Application submitted successfully! Your account is under review.");
        navigate("/dashboard");
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (error) {
      alert("Network error. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (fieldName: string) => `w-full px-4 py-3 bg-white/10 border ${errors[fieldName] ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent backdrop-blur-sm transition-all`;

  return (
    <div className="min-h-screen relative overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">ADVERTISER APPLICATION</h2>
            <h1 className="text-4xl font-extrabold text-white mb-4">Get Leads Now</h1>
            <p className="text-gray-300">
              Already have an account?{" "}
              <Link to="/advertiser/signin" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                Sign In
              </Link>
            </p>
            <p className="text-gray-400 text-sm mt-2">Fields with an asterisk (*) are mandatory.</p>
          </div>

          <div className="space-y-8">
            {/* General Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">First Name *</label>
                  <input name="firstName" type="text" className={inputClass('firstName')} placeholder="John" value={formData.firstName} onChange={handleChange} />
                  {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Last Name *</label>
                  <input name="lastName" type="text" className={inputClass('lastName')} placeholder="Doe" value={formData.lastName} onChange={handleChange} />
                  {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Email *</label>
                  <input name="email" type="email" className={inputClass('email')} placeholder="john@company.com" value={formData.email} onChange={handleChange} />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Email Confirmation *</label>
                  <input name="emailConfirmation" type="email" className={inputClass('emailConfirmation')} placeholder="Confirm email" value={formData.emailConfirmation} onChange={handleChange} />
                  {errors.emailConfirmation && <p className="text-red-400 text-xs mt-1">{errors.emailConfirmation}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Phone Number *</label>
                  <input name="phoneNumber" type="tel" className={inputClass('phoneNumber')} placeholder="+1 234 567 8900" value={formData.phoneNumber} onChange={handleChange} />
                  {errors.phoneNumber && <p className="text-red-400 text-xs mt-1">{errors.phoneNumber}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Password *</label>
                  <div className="relative">
                    <input name="password" type={showPassword ? "text" : "password"} className={inputClass('password')} placeholder="••••••••" value={formData.password} onChange={handleChange} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Password Confirmation *</label>
                  <div className="relative">
                    <input name="passwordConfirmation" type={showConfirmPassword ? "text" : "password"} className={inputClass('passwordConfirmation')} placeholder="••••••••" value={formData.passwordConfirmation} onChange={handleChange} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.passwordConfirmation && <p className="text-red-400 text-xs mt-1">{errors.passwordConfirmation}</p>}
                </div>
              </div>
            </div>

            {/* Company Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">Company</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Company/Individual/Website Name *</label>
                  <input name="companyName" type="text" className={inputClass('companyName')} placeholder="Your Company Ltd." value={formData.companyName} onChange={handleChange} />
                  {errors.companyName && <p className="text-red-400 text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Website/Social Media * <span className="text-gray-400">(http(s)://)</span></label>
                  <input name="websiteUrl" type="url" className={inputClass('websiteUrl')} placeholder="https://yourcompany.com" value={formData.websiteUrl} onChange={handleChange} />
                  {errors.websiteUrl && <p className="text-red-400 text-xs mt-1">{errors.websiteUrl}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Example Offer Landing Page / Product Page * <span className="text-gray-400">(http(s)://)</span></label>
                  <input name="offerLandingPage" type="url" className={inputClass('offerLandingPage')} placeholder="https://yourcompany.com/offer" value={formData.offerLandingPage} onChange={handleChange} />
                  {errors.offerLandingPage && <p className="text-red-400 text-xs mt-1">{errors.offerLandingPage}</p>}
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">Address</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Address *</label>
                  <input name="address" type="text" className={inputClass('address')} placeholder="123 Business Street" value={formData.address} onChange={handleChange} />
                  {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Apartment, suite, etc.</label>
                  <input name="apartment" type="text" className={inputClass('apartment')} placeholder="Suite 100" value={formData.apartment} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Country *</label>
                    <input name="country" type="text" className={inputClass('country')} placeholder="United States" value={formData.country} onChange={handleChange} />
                    {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">City *</label>
                    <input name="city" type="text" className={inputClass('city')} placeholder="New York" value={formData.city} onChange={handleChange} />
                    {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">ZIP/Postal Code *</label>
                    <input name="zipCode" type="text" className={inputClass('zipCode')} placeholder="10001" value={formData.zipCode} onChange={handleChange} />
                    {errors.zipCode && <p className="text-red-400 text-xs mt-1">{errors.zipCode}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Accounting Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">Customer's Accounting Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Contact Name *</label>
                  <input name="accountingContactName" type="text" className={inputClass('accountingContactName')} placeholder="Jane Smith" value={formData.accountingContactName} onChange={handleChange} />
                  {errors.accountingContactName && <p className="text-red-400 text-xs mt-1">{errors.accountingContactName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Role</label>
                  <input name="accountingContactRole" type="text" className={inputClass('accountingContactRole')} placeholder="CFO" value={formData.accountingContactRole} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Contact Number *</label>
                  <input name="accountingContactNumber" type="tel" className={inputClass('accountingContactNumber')} placeholder="+1 234 567 8900" value={formData.accountingContactNumber} onChange={handleChange} />
                  {errors.accountingContactNumber && <p className="text-red-400 text-xs mt-1">{errors.accountingContactNumber}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Contact Email *</label>
                  <input name="accountingContactEmail" type="email" className={inputClass('accountingContactEmail')} placeholder="accounting@company.com" value={formData.accountingContactEmail} onChange={handleChange} />
                  {errors.accountingContactEmail && <p className="text-red-400 text-xs mt-1">{errors.accountingContactEmail}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Payment Agreement *</label>
                  <input name="paymentAgreement" type="text" className={inputClass('paymentAgreement')} placeholder="Net 30" value={formData.paymentAgreement} onChange={handleChange} />
                  {errors.paymentAgreement && <p className="text-red-400 text-xs mt-1">{errors.paymentAgreement}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Amount Payment Terms *</label>
                  <input name="paymentTerms" type="text" className={inputClass('paymentTerms')} placeholder="Wire Transfer" value={formData.paymentTerms} onChange={handleChange} />
                  {errors.paymentTerms && <p className="text-red-400 text-xs mt-1">{errors.paymentTerms}</p>}
                </div>
              </div>
            </div>

            {/* References Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">References <span className="text-gray-400 text-sm">(Optional)</span></h3>
              {references.map((ref, index) => (
                <div key={index} className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-white font-medium">Reference {index + 1}</span>
                    <button type="button" onClick={() => removeReference(index)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" placeholder="Name" className={inputClass('')} value={ref.name} onChange={(e) => updateReference(index, 'name', e.target.value)} />
                    <input type="text" placeholder="Company Role" className={inputClass('')} value={ref.companyRole} onChange={(e) => updateReference(index, 'companyRole', e.target.value)} />
                    <input type="email" placeholder="Email" className={inputClass('')} value={ref.email} onChange={(e) => updateReference(index, 'email', e.target.value)} />
                    <input type="tel" placeholder="Contact Number" className={inputClass('')} value={ref.contactNumber} onChange={(e) => updateReference(index, 'contactNumber', e.target.value)} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addReference} className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors">
                <Plus size={18} className="mr-1" /> Add Reference
              </button>
            </div>

            {/* Additional Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">EIN/VAT Number *</label>
                  <input name="einVatNumber" type="text" className={inputClass('einVatNumber')} placeholder="XX-XXXXXXX" value={formData.einVatNumber} onChange={handleChange} />
                  {errors.einVatNumber && <p className="text-red-400 text-xs mt-1">{errors.einVatNumber}</p>}
                </div>
                <div className="flex items-start">
                  <input id="noMinimumThresholdAgreed" name="noMinimumThresholdAgreed" type="checkbox" checked={formData.noMinimumThresholdAgreed} onChange={handleChange} className="h-5 w-5 mt-1 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500" />
                  <label htmlFor="noMinimumThresholdAgreed" className="ml-3 text-sm text-gray-300">
                    <span className="font-semibold">No Minimum Threshold Permitted *</span><br />
                    By checking this box, I, (Responsible of the company) agree that no minimum is required to pay TriadMedia for the production
                  </label>
                </div>
                {errors.noMinimumThresholdAgreed && <p className="text-red-400 text-xs">{errors.noMinimumThresholdAgreed}</p>}
              </div>
            </div>

            {/* Terms Section */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">Terms and Conditions</h3>
              <div className="flex items-start">
                <input id="termsAgreed" name="termsAgreed" type="checkbox" checked={formData.termsAgreed} onChange={handleChange} className="h-5 w-5 mt-1 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500" />
                <label htmlFor="termsAgreed" className="ml-3 text-sm text-gray-300">
                  <span className="font-semibold">Triad Media, Inc. Terms *</span><br />
                  I agree to the <a href="/terms" target="_blank" className="text-cyan-400 hover:text-cyan-300">Terms and Conditions</a>
                </label>
              </div>
              {errors.termsAgreed && <p className="text-red-400 text-xs mt-1">{errors.termsAgreed}</p>}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
            >
              {loading ? "Submitting Application..." : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
