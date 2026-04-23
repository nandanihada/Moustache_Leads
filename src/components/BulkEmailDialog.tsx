import React, { useState, useEffect } from "react";
import { X, Mail, ChevronRight, ChevronLeft, Loader2, TrendingUp, MousePointerClick, CheckCircle, Clock, Globe, Target, Edit3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";
import EmailSettingsPanel, { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from '@/components/EmailSettingsPanel';

interface BulkEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPublishers: Array<{
    id: string;
    name: string;
    email: string;
    level?: string;
    geo?: string;
    vertical?: string;
  }>;
}

interface OfferType {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const offerTypes: OfferType[] = [
  {
    id: "top_requested",
    label: "🔥 Top Requested Offers",
    description: "Offers with highest request count",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "from-red-500 to-orange-500"
  },
  {
    id: "highest_clicked",
    label: "👆 Highest Clicked Offers",
    description: "Offers sorted by click volume",
    icon: <MousePointerClick className="w-5 h-5" />,
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: "most_approved",
    label: "✅ Most Approved Offers",
    description: "Offers with best approval rate",
    icon: <CheckCircle className="w-5 h-5" />,
    color: "from-green-500 to-emerald-500"
  },
  {
    id: "recently_added",
    label: "🆕 Recently Added/Edited",
    description: "Newest or recently updated offers",
    icon: <Clock className="w-5 h-5" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    id: "geo_matched",
    label: "🌍 Geo-Matched Offers",
    description: "Offers matching publisher's geo",
    icon: <Globe className="w-5 h-5" />,
    color: "from-teal-500 to-cyan-500"
  },
  {
    id: "vertical_matched",
    label: "🎯 Vertical-Matched Offers",
    description: "Offers matching publisher's vertical",
    icon: <Target className="w-5 h-5" />,
    color: "from-indigo-500 to-purple-500"
  },
  {
    id: "custom",
    label: "✏️ Custom Selection",
    description: "Manually pick specific offers",
    icon: <Edit3 className="w-5 h-5" />,
    color: "from-gray-500 to-slate-500"
  }
];

export const BulkEmailDialog: React.FC<BulkEmailDialogProps> = ({
  isOpen,
  onClose,
  selectedPublishers
}) => {
  const [step, setStep] = useState(1);
  const [selectedOfferTypes, setSelectedOfferTypes] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedPublishers, setExpandedPublishers] = useState<Set<string>>(new Set());
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedOfferTypes([]);
      setSubject("");
      setMessage("");
      setPreviewData([]);
      setExpandedPublishers(new Set());
      setEmailSettings(DEFAULT_EMAIL_SETTINGS);
    }
  }, [isOpen]);

  const togglePublisherExpand = (publisherId: string) => {
    setExpandedPublishers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(publisherId)) {
        newSet.delete(publisherId);
      } else {
        newSet.add(publisherId);
      }
      return newSet;
    });
  };

  const toggleOfferType = (typeId: string) => {
    setSelectedOfferTypes(prev => {
      const newTypes = prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId];
      
      // Auto-generate email content based on selected offer types
      if (newTypes.length > 0) {
        generateEmailContent(newTypes);
      }
      
      return newTypes;
    });
  };

  const generateEmailContent = (types: string[]) => {
    // Generate subject based on offer types
    let subjectText = "";
    let messageText = "";

    if (types.includes('top_requested') && types.includes('highest_clicked')) {
      subjectText = "🔥 Our Most Popular & High-Converting Offers - Handpicked for You!";
      messageText = `Hi there,\n\nWe've selected our absolute best-performing offers just for you! These are the campaigns that publishers are requesting the most AND getting the highest click-through rates.\n\nThese offers are proven winners with excellent conversion rates and high payouts. Many publishers in your tier are seeing outstanding results with these campaigns.\n\nCheck out the personalized offer list below and start promoting today to maximize your earnings!\n\nBest of luck!`;
    } else if (types.includes('geo_matched') && types.includes('vertical_matched')) {
      subjectText = "🎯 Perfect Match: Offers Tailored Specifically for Your Traffic!";
      messageText = `Hi there,\n\nGreat news! We've matched offers that are perfect for your audience based on your geo and vertical.\n\nThese campaigns are specifically selected to match your traffic profile, which means higher conversion rates and better earnings for you. We've analyzed your performance data to bring you the most relevant opportunities.\n\nTake a look at your personalized offer recommendations below and start promoting the ones that fit your audience best!\n\nLet's make this your best month yet!`;
    } else if (types.includes('recently_added')) {
      subjectText = "🆕 Fresh Offers Just Added - Be the First to Promote!";
      messageText = `Hi there,\n\nExciting news! We've just added brand new offers to our platform, and you're among the first to get access.\n\nThese fresh campaigns are looking for quality publishers like you. Getting in early means less competition and better conversion rates. The offers below have been carefully vetted and are ready to perform.\n\nCheck out the new opportunities below and grab them before they reach capacity!\n\nHappy promoting!`;
    } else if (types.includes('most_approved')) {
      subjectText = "✅ High-Approval Offers - Easy Wins for Your Traffic!";
      messageText = `Hi there,\n\nWe've compiled a list of offers with the highest approval rates on our platform. These campaigns are known for approving quality traffic quickly and consistently.\n\nIf you're looking for reliable offers that convert well and pay on time, these are your best bet. Many publishers are seeing excellent approval rates and steady income from these campaigns.\n\nSee your personalized selection below and start earning with confidence!\n\nTo your success!`;
    } else if (types.includes('top_requested')) {
      subjectText = "🔥 Most Requested Offers - Join the Winning Publishers!";
      messageText = `Hi there,\n\nThese are the hottest offers on our platform right now! Publishers are requesting these campaigns more than any others, and for good reason.\n\nHigh demand usually means high performance. These offers are trending because they're converting well and paying great commissions. Don't miss out on what everyone else is already promoting successfully.\n\nCheck out your personalized list below and join the winning team!\n\nLet's grow together!`;
    } else if (types.includes('highest_clicked')) {
      subjectText = "👆 Top-Clicked Offers - Proven Click Magnets!";
      messageText = `Hi there,\n\nWe've identified the offers getting the most clicks across our network, and we want you to have access to them!\n\nHigh click volume means these offers have compelling creatives and attractive payouts that resonate with audiences. If you want campaigns that are proven to grab attention and drive traffic, these are it.\n\nSee your personalized recommendations below and start driving clicks today!\n\nHappy promoting!`;
    } else if (types.includes('geo_matched')) {
      subjectText = "🌍 Geo-Targeted Offers - Perfect for Your Location!";
      messageText = `Hi there,\n\nWe've selected offers that are specifically available and optimized for your geographic region.\n\nGeo-targeted campaigns typically perform better because they're tailored to local audiences, regulations, and preferences. These offers are ready to convert your traffic with location-specific messaging and payouts.\n\nCheck out your geo-matched offers below and start promoting locally!\n\nBest regards!`;
    } else if (types.includes('vertical_matched')) {
      subjectText = "🎯 Vertical-Matched Offers - Aligned with Your Niche!";
      messageText = `Hi there,\n\nWe've handpicked offers that match your top-performing vertical. These campaigns align perfectly with the type of traffic you're already driving.\n\nWhen you promote offers in your proven niche, conversion rates soar. These campaigns are selected based on your historical performance data to give you the best chance of success.\n\nSee your vertical-matched offers below and leverage your expertise!\n\nTo your success!`;
    } else {
      // Default message for any other combination
      subjectText = "🎯 Exclusive Offers Selected Just for You!";
      messageText = `Hi there,\n\nWe've carefully selected a collection of high-quality offers based on your profile and performance.\n\nThese campaigns are chosen to match your traffic characteristics and maximize your earning potential. Each offer has been vetted for quality, reliability, and strong conversion rates.\n\nCheck out your personalized offer recommendations below and start promoting the ones that resonate with your audience!\n\nLet's make great things happen together!`;
    }

    setSubject(subjectText);
    setMessage(messageText);
  };

  const loadPreview = async () => {
    if (selectedOfferTypes.length === 0) {
      toast({
        title: "No offer types selected",
        description: "Please select at least one offer type",
        variant: "destructive"
      });
      return;
    }

    setLoadingPreview(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/preview-offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publisher_ids: selectedPublishers.map(p => p.id),
          offer_types: selectedOfferTypes
        })
      });

      if (!response.ok) throw new Error('Failed to load preview');

      const data = await response.json();
      setPreviewData(data.preview_data || []);
      setStep(2);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast({
        title: "Error",
        description: "Failed to load offer preview",
        variant: "destructive"
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter an email subject",
        variant: "destructive"
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter an email message",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/publishers/bulk-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publisher_ids: selectedPublishers.map(p => p.id),
          offer_types: selectedOfferTypes,
          subject: subject.trim(),
          message: message.trim(),
          template_settings: {
            template_style: emailSettings.templateStyle,
            visible_fields: emailSettings.visibleFields,
            default_image: emailSettings.defaultImage,
            payout_type: emailSettings.payoutType,
          },
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send emails');
      }

      const data = await response.json();
      
      if (data.failed_count > 0) {
        // Show detailed error for failed emails
        const failedResults = data.results?.filter((r: any) => r.status === 'failed') || [];
        const errorDetails = failedResults.map((r: any) => `${r.email}: ${r.reason}`).join('\n');
        
        toast({
          title: data.success_count > 0 ? "⚠️ Partially Sent" : "❌ Failed to Send",
          description: `${data.success_count} sent, ${data.failed_count} failed.\n${errorDetails}`,
          variant: data.success_count > 0 ? "default" : "destructive"
        });
      } else {
        toast({
          title: "✅ Emails Sent!",
          description: data.message || `Successfully sent ${data.success_count} emails`,
        });
      }

      if (data.success_count > 0) {
        onClose();
      }
    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send emails",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6" />
            <div>
              <h2 className="text-2xl font-bold">Send Offers to Publishers</h2>
              <p className="text-sm text-white/90">
                {step === 1 ? "Step 1: Choose offer types" : "Step 2: Compose & preview"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-100 h-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            // Step 1: Offer Type Selection
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>{selectedPublishers.length} publishers selected.</strong> Choose which types of offers to send. Each publisher will receive personalized offers based on their profile.
                </p>
                {selectedOfferTypes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-300">
                    <p className="text-xs font-semibold text-blue-800 mb-2">✅ Selected ({selectedOfferTypes.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOfferTypes.map(typeId => {
                        const type = offerTypes.find(t => t.id === typeId);
                        return type ? (
                          <Badge key={typeId} className="bg-blue-600 text-white text-xs">
                            {type.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Suggestions */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-purple-900 mb-2">💡 Quick Suggestions:</p>
                <div className="space-y-2 text-xs text-purple-800">
                  <button
                    onClick={() => {
                      const types = ['top_requested', 'highest_clicked', 'most_approved'];
                      setSelectedOfferTypes(types);
                      generateEmailContent(types);
                    }}
                    className="block w-full text-left px-3 py-2 bg-white rounded hover:bg-purple-100 transition-colors border border-purple-200"
                  >
                    <strong>🔥 High Performers:</strong> Top Requested + Highest Clicked + Most Approved
                  </button>
                  <button
                    onClick={() => {
                      const types = ['geo_matched', 'vertical_matched'];
                      setSelectedOfferTypes(types);
                      generateEmailContent(types);
                    }}
                    className="block w-full text-left px-3 py-2 bg-white rounded hover:bg-purple-100 transition-colors border border-purple-200"
                  >
                    <strong>🎯 Perfect Match:</strong> Geo-Matched + Vertical-Matched
                  </button>
                  <button
                    onClick={() => {
                      const types = ['recently_added', 'top_requested'];
                      setSelectedOfferTypes(types);
                      generateEmailContent(types);
                    }}
                    className="block w-full text-left px-3 py-2 bg-white rounded hover:bg-purple-100 transition-colors border border-purple-200"
                  >
                    <strong>🆕 Fresh & Popular:</strong> Recently Added + Top Requested
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offerTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => toggleOfferType(type.id)}
                    className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                      selectedOfferTypes.includes(type.id)
                        ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${type.color} text-white`}>
                        {type.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{type.label}</h3>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                      {selectedOfferTypes.includes(type.id) && (
                        <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Step 2: Compose & Preview
            <div className="space-y-6">
              {/* Left: Compose */}
              <div className="space-y-4 max-w-3xl mx-auto">
                {/* Quick Templates */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-green-900 mb-2">✨ Quick Templates:</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setSubject("🔥 Exclusive High-Paying Offers Just for You!");
                        setMessage("We've handpicked these premium offers based on your performance and preferences.\n\nThese offers are converting well and match your traffic profile perfectly. Don't miss out on these opportunities to maximize your earnings!\n\nCheck them out below and start promoting today.");
                      }}
                      className="block w-full text-left px-2 py-1.5 bg-white rounded hover:bg-green-100 transition-colors text-xs border border-green-200"
                    >
                      <strong>🔥 Premium Offers</strong> - High-converting, exclusive deals
                    </button>
                    <button
                      onClick={() => {
                        setSubject("🆕 New Offers Added - Perfect Match for Your Traffic!");
                        setMessage("Great news! We've just added new offers that are a perfect fit for your audience.\n\nBased on your geo and vertical, these offers should perform exceptionally well. We've seen great results from similar publishers.\n\nTake a look and let us know if you need any support getting started.");
                      }}
                      className="block w-full text-left px-2 py-1.5 bg-white rounded hover:bg-green-100 transition-colors text-xs border border-green-200"
                    >
                      <strong>🆕 New Arrivals</strong> - Fresh offers matching your profile
                    </button>
                    <button
                      onClick={() => {
                        setSubject("📊 Boost Your Earnings with These Top Performers");
                        setMessage("Looking to increase your revenue? These offers are currently our top performers with the highest approval rates and payouts.\n\nMany publishers in your tier are seeing excellent results with these campaigns. The timing is perfect to jump in.\n\nLet's make this your best month yet!");
                      }}
                      className="block w-full text-left px-2 py-1.5 bg-white rounded hover:bg-green-100 transition-colors text-xs border border-green-200"
                    >
                      <strong>📊 Top Performers</strong> - Highest converting offers
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Subject Line
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., New High-Paying Offers Just for You!"
                    maxLength={200}
                    className="text-base"
                  />
                  <p className="text-xs text-gray-500 mt-1">{subject.length}/200 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message Body
                  </label>

                  {/* Email Template Settings */}
                  <div className="mb-3">
                    <EmailSettingsPanel settings={emailSettings} onChange={setEmailSettings} compact />
                  </div>

                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your personalized message here..."
                    rows={12}
                    maxLength={5000}
                    className="text-base resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{message.length}/5000 characters</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900">
                    💡 <strong>Tip:</strong> Personalized offers will be automatically appended to each email based on the publisher's profile.
                  </p>
                </div>

                {/* Per-Publisher Breakdown */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600" />
                    📊 Per-Publisher Breakdown:
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {previewData.map((pub) => {
                      const isExpanded = expandedPublishers.has(pub.publisher_id);
                      const hasMoreOffers = pub.matched_offers && pub.matched_offers.length > 2;
                      
                      return (
                      <div key={pub.publisher_id} className="bg-gray-50 rounded p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{pub.publisher_name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {pub.publisher_level || 'L1'}
                              </Badge>
                              {pub.publisher_geo && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  🌍 {pub.publisher_geo}
                                </Badge>
                              )}
                              {pub.publisher_vertical && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  🎯 {pub.publisher_vertical}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-blue-600 text-white text-[9px] px-2 py-1">
                            {pub.offers_count} offers
                          </Badge>
                        </div>
                        
                        {/* Show offers for this publisher */}
                        {pub.matched_offers && pub.matched_offers.length > 0 && (
                          <div className="space-y-1 mt-2 pt-2 border-t border-gray-300">
                            {(isExpanded ? pub.matched_offers : pub.matched_offers.slice(0, 2)).map((offer: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-[10px] bg-white rounded p-1.5 border border-gray-200">
                                <span className="font-medium text-gray-800 truncate flex-1">{offer.name}</span>
                                <span className="font-bold text-green-600 ml-2 whitespace-nowrap">${offer.payout?.toFixed(2)}</span>
                              </div>
                            ))}
                            {hasMoreOffers && (
                              <button
                                onClick={() => togglePublisherExpand(pub.publisher_id)}
                                className="w-full text-[9px] text-blue-600 hover:text-blue-800 font-semibold text-center py-1 hover:bg-blue-50 rounded transition-colors"
                              >
                                {isExpanded ? '▲ Show less' : `▼ +${pub.offers_count - 2} more offers`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {step === 1 ? (
              <span>{selectedOfferTypes.length} offer type{selectedOfferTypes.length !== 1 ? 's' : ''} selected</span>
            ) : (
              <span>Sending to {selectedPublishers.length} publisher{selectedPublishers.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 2 && (
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={sending}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}

            {step === 1 ? (
              <Button
                onClick={loadPreview}
                disabled={selectedOfferTypes.length === 0 || loadingPreview}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    Next: Compose Email
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send to {selectedPublishers.length} Publisher{selectedPublishers.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
