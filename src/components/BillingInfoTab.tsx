/**
 * Billing Info Component
 * Payout method setup (Bank, PayPal, Crypto)
 * Shows read-only view after saving, with edit icon to switch to edit mode
 */

import { useState, useEffect } from 'react';
import { Save, AlertCircle, Pencil, Building2, Wallet, Bitcoin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { payoutSettingsApi, PayoutMethod } from '@/services/payoutSettingsApi';

export function BillingInfoTab() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeMethod, setActiveMethod] = useState<'bank' | 'paypal' | 'crypto'>('bank');
    const [hasExistingMethod, setHasExistingMethod] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Bank details state
    const [bankDetails, setBankDetails] = useState({
        account_name: '',
        bank_name: '',
        account_number: '',
        ifsc_swift: '',
        country: '',
        currency: '',
        phone: '',
        address: '',
        upi: ''
    });

    // PayPal details state
    const [paypalDetails, setPaypalDetails] = useState({
        email: '',
        country: '',
        minimum_threshold: 100
    });

    // Crypto details state
    const [cryptoDetails, setCryptoDetails] = useState({
        currency: '',
        network: '',
        wallet_address: '',
        label: ''
    });

    // Load existing payout method
    useEffect(() => {
        const loadPayoutMethod = async () => {
            setLoading(true);
            try {
                const response = await payoutSettingsApi.getPayoutMethod();
                if (response.has_method && response.method) {
                    setActiveMethod(response.method.active_method);
                    setHasExistingMethod(true);
                    if (response.method.bank_details) {
                        setBankDetails(prev => ({ ...prev, ...response.method!.bank_details }));
                    }
                    if (response.method.paypal_details) {
                        setPaypalDetails(prev => ({
                            ...prev,
                            ...response.method!.paypal_details,
                            minimum_threshold: response.method!.paypal_details!.minimum_threshold ?? 100
                        }));
                    }
                    if (response.method.crypto_details) {
                        setCryptoDetails(prev => ({ ...prev, ...response.method!.crypto_details }));
                    }
                } else {
                    setIsEditing(true); // No method yet, show form
                }
            } catch (error) {
                console.error('Error loading payout method:', error);
                setIsEditing(true);
            } finally {
                setLoading(false);
            }
        };

        loadPayoutMethod();
    }, []);

    const validateBankDetails = () => {
        const required = ['account_name', 'bank_name', 'account_number', 'ifsc_swift', 'country', 'currency'];
        for (const field of required) {
            if (!bankDetails[field as keyof typeof bankDetails]) {
                return `${field.replace('_', ' ')} is required`;
            }
        }
        return null;
    };

    const validatePayPalDetails = () => {
        if (!paypalDetails.email) return 'PayPal email is required';
        if (!paypalDetails.email.includes('@')) return 'Invalid email address';
        if (!paypalDetails.country) return 'Country is required';
        if (!paypalDetails.minimum_threshold) return 'Minimum threshold is required';
        return null;
    };

    const validateCryptoDetails = () => {
        if (!cryptoDetails.currency) return 'Currency is required';
        if (!cryptoDetails.network) return 'Network is required';
        if (!cryptoDetails.wallet_address) return 'Wallet address is required';
        if (cryptoDetails.wallet_address.length < 20) return 'Invalid wallet address';
        return null;
    };

    const handleSave = async () => {
        // Validate based on active method
        let error = null;
        if (activeMethod === 'bank') {
            error = validateBankDetails();
        } else if (activeMethod === 'paypal') {
            error = validatePayPalDetails();
        } else if (activeMethod === 'crypto') {
            error = validateCryptoDetails();
        }

        if (error) {
            toast({
                title: 'Validation Error',
                description: error,
                variant: 'destructive'
            });
            return;
        }

        setSaving(true);
        try {
            const methodData: PayoutMethod = {
                active_method: activeMethod,
                bank_details: activeMethod === 'bank' ? bankDetails : undefined,
                paypal_details: activeMethod === 'paypal' ? paypalDetails : undefined,
                crypto_details: activeMethod === 'crypto' ? cryptoDetails : undefined
            };

            await payoutSettingsApi.savePayoutMethod(methodData);

            setHasExistingMethod(true);
            setIsEditing(false);
            toast({
                title: 'Success',
                description: 'Payout method saved successfully'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save payout method',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4">Loading...</div>;
    }

    // ========== READ-ONLY VIEW (after saving) ==========
    if (hasExistingMethod && !isEditing) {
        const maskValue = (val: string) => {
            if (!val || val.length < 6) return val ? '••••••' : '—';
            return '••••••' + val.slice(-4);
        };

        const COUNTRY_NAMES: Record<string, string> = {
            US: 'United States', IN: 'India', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia'
        };

        return (
            <div className="space-y-6">
                {/* Billing Details Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Billing Details</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                </div>

                {/* Bank Transfer Card */}
                <div className={`border rounded-lg p-5 ${activeMethod === 'bank' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className={`h-5 w-5 ${activeMethod === 'bank' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm text-gray-800">Bank Transfer</span>
                        {activeMethod === 'bank' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
                    </div>
                    {bankDetails.account_name ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 text-xs">Account Name</span>
                                <p className="font-medium text-gray-900">{bankDetails.account_name}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Bank Name</span>
                                <p className="font-medium text-gray-900">{bankDetails.bank_name || '—'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Account Number</span>
                                <p className="font-medium text-gray-900 font-mono">{maskValue(bankDetails.account_number)}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">IFSC/SWIFT</span>
                                <p className="font-medium text-gray-900 font-mono">{bankDetails.ifsc_swift || '—'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Country</span>
                                <p className="font-medium text-gray-900">{COUNTRY_NAMES[bankDetails.country] || bankDetails.country || '—'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Currency</span>
                                <p className="font-medium text-gray-900">{bankDetails.currency || '—'}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No bank details configured</p>
                    )}
                </div>

                {/* PayPal Card */}
                <div className={`border rounded-lg p-5 ${activeMethod === 'paypal' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Wallet className={`h-5 w-5 ${activeMethod === 'paypal' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm text-gray-800">PayPal</span>
                        {activeMethod === 'paypal' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
                    </div>
                    {paypalDetails.email ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 text-xs">Email</span>
                                <p className="font-medium text-gray-900">{paypalDetails.email}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Country</span>
                                <p className="font-medium text-gray-900">{COUNTRY_NAMES[paypalDetails.country] || paypalDetails.country || '—'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Min Threshold</span>
                                <p className="font-medium text-gray-900">${paypalDetails.minimum_threshold}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No PayPal details configured</p>
                    )}
                </div>

                {/* Crypto Card */}
                <div className={`border rounded-lg p-5 ${activeMethod === 'crypto' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Bitcoin className={`h-5 w-5 ${activeMethod === 'crypto' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm text-gray-800">Cryptocurrency</span>
                        {activeMethod === 'crypto' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>}
                    </div>
                    {cryptoDetails.wallet_address ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 text-xs">Currency</span>
                                <p className="font-medium text-gray-900">{cryptoDetails.currency || '—'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 text-xs">Network</span>
                                <p className="font-medium text-gray-900">{cryptoDetails.network || '—'}</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <span className="text-gray-500 text-xs">Wallet Address</span>
                                <p className="font-medium text-gray-900 font-mono text-xs truncate">{maskValue(cryptoDetails.wallet_address)}</p>
                            </div>
                            {cryptoDetails.label && (
                                <div>
                                    <span className="text-gray-500 text-xs">Label</span>
                                    <p className="font-medium text-gray-900">{cryptoDetails.label}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No crypto details configured</p>
                    )}
                </div>
            </div>
        );
    }

    // ========== EDIT MODE (form) ==========
    return (
        <div className="space-y-6">
            {hasExistingMethod && (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700">
                        Cancel
                    </Button>
                </div>
            )}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Payout Method Setup</p>
                        <p>Choose your preferred payout method and provide the required details. Only one method can be active at a time.</p>
                    </div>
                </div>
            </div>

            <Tabs value={activeMethod} onValueChange={(v) => setActiveMethod(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
                    <TabsTrigger value="paypal">PayPal</TabsTrigger>
                    <TabsTrigger value="crypto">Cryptocurrency</TabsTrigger>
                </TabsList>

                <TabsContent value="bank" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="account_name">Account Name *</Label>
                            <Input
                                id="account_name"
                                value={bankDetails.account_name}
                                onChange={(e) => setBankDetails({ ...bankDetails, account_name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bank_name">Bank Name *</Label>
                            <Input
                                id="bank_name"
                                value={bankDetails.bank_name}
                                onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                                placeholder="Bank of America"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="account_number">Account Number *</Label>
                            <Input
                                id="account_number"
                                value={bankDetails.account_number}
                                onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                                placeholder="1234567890"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ifsc_swift">IFSC/SWIFT Code *</Label>
                            <Input
                                id="ifsc_swift"
                                value={bankDetails.ifsc_swift}
                                onChange={(e) => setBankDetails({ ...bankDetails, ifsc_swift: e.target.value })}
                                placeholder="ABCD0123456"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="country">Country *</Label>
                            <Select value={bankDetails.country} onValueChange={(v) => setBankDetails({ ...bankDetails, country: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="US">United States</SelectItem>
                                    <SelectItem value="IN">India</SelectItem>
                                    <SelectItem value="GB">United Kingdom</SelectItem>
                                    <SelectItem value="CA">Canada</SelectItem>
                                    <SelectItem value="AU">Australia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency *</Label>
                            <Select value={bankDetails.currency} onValueChange={(v) => setBankDetails({ ...bankDetails, currency: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="INR">INR</SelectItem>
                                    <SelectItem value="GBP">GBP</SelectItem>
                                    <SelectItem value="CAD">CAD</SelectItem>
                                    <SelectItem value="AUD">AUD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            value={bankDetails.phone}
                            onChange={(e) => setBankDetails({ ...bankDetails, phone: e.target.value })}
                            placeholder="+1 234 567 8900"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                            id="address"
                            value={bankDetails.address}
                            onChange={(e) => setBankDetails({ ...bankDetails, address: e.target.value })}
                            placeholder="123 Main Street, City, State, ZIP"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="upi">UPI ID (for India)</Label>
                        <Input
                            id="upi"
                            value={bankDetails.upi}
                            onChange={(e) => setBankDetails({ ...bankDetails, upi: e.target.value })}
                            placeholder="user@paytm"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="paypal" className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="paypal_email">PayPal Email *</Label>
                        <Input
                            id="paypal_email"
                            type="email"
                            value={paypalDetails.email}
                            onChange={(e) => setPaypalDetails({ ...paypalDetails, email: e.target.value })}
                            placeholder="your-email@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="paypal_country">Country *</Label>
                        <Select value={paypalDetails.country} onValueChange={(v) => setPaypalDetails({ ...paypalDetails, country: v })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="US">United States</SelectItem>
                                <SelectItem value="IN">India</SelectItem>
                                <SelectItem value="GB">United Kingdom</SelectItem>
                                <SelectItem value="CA">Canada</SelectItem>
                                <SelectItem value="AU">Australia</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="minimum_threshold">Minimum Payout Threshold *</Label>
                        <Select
                            value={(paypalDetails.minimum_threshold ?? 100).toString()}
                            onValueChange={(v) => setPaypalDetails({ ...paypalDetails, minimum_threshold: parseInt(v) })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select threshold" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">$50</SelectItem>
                                <SelectItem value="100">$100</SelectItem>
                                <SelectItem value="250">$250</SelectItem>
                                <SelectItem value="500">$500</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </TabsContent>

                <TabsContent value="crypto" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="crypto_currency">Currency *</Label>
                            <Select value={cryptoDetails.currency} onValueChange={(v) => setCryptoDetails({ ...cryptoDetails, currency: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                                    <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                                    <SelectItem value="USDT">Tether (USDT)</SelectItem>
                                    <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="network">Network *</Label>
                            <Select value={cryptoDetails.network} onValueChange={(v) => setCryptoDetails({ ...cryptoDetails, network: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ERC20">ERC-20 (Ethereum)</SelectItem>
                                    <SelectItem value="TRC20">TRC-20 (Tron)</SelectItem>
                                    <SelectItem value="BEP20">BEP-20 (BSC)</SelectItem>
                                    <SelectItem value="Bitcoin">Bitcoin Network</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wallet_address">Wallet Address *</Label>
                        <Input
                            id="wallet_address"
                            value={cryptoDetails.wallet_address}
                            onChange={(e) => setCryptoDetails({ ...cryptoDetails, wallet_address: e.target.value })}
                            placeholder="0x1234567890abcdef1234567890abcdef12345678"
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="wallet_label">Wallet Label (optional)</Label>
                        <Input
                            id="wallet_label"
                            value={cryptoDetails.label}
                            onChange={(e) => setCryptoDetails({ ...cryptoDetails, label: e.target.value })}
                            placeholder="My Main Wallet"
                        />
                    </div>
                </TabsContent>
            </Tabs>

            <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Payout Method'}
            </Button>
        </div>
    );
}
