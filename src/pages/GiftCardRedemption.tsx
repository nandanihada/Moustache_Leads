import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, DollarSign, History, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface GiftCardRedemption {
    code: string;
    amount: number;
    redeemed_at: string;
}

export default function GiftCardRedemption() {
    const { token, user } = useAuth();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [redemptions, setRedemptions] = useState<GiftCardRedemption[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const fetchBalance = async () => {
        try {
            const { API_BASE_URL } = await import('../services/apiConfig');
            const response = await fetch(`${API_BASE_URL}/api/publisher/balance`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setBalance(data.balance);
            }
        } catch (error) {
            console.error("Error fetching balance:", error);
        }
    };

    const fetchHistory = async () => {
        try {
            const { API_BASE_URL } = await import('../services/apiConfig');
            const response = await fetch(`${API_BASE_URL}/api/publisher/gift-cards/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setRedemptions(data.redemptions || []);
                setShowHistory(true);
            } else {
                toast.error("Failed to fetch redemption history");
            }
        } catch (error) {
            toast.error("Error fetching history");
            console.error(error);
        }
    };

    const handleRedeem = async () => {
        if (!code.trim()) {
            toast.error("Please enter a gift card code");
            return;
        }

        try {
            setLoading(true);
            const { API_BASE_URL } = await import('../services/apiConfig');
            const response = await fetch(`${API_BASE_URL}/api/publisher/gift-cards/redeem`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ code: code.toUpperCase() }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(
                    `🎉 Gift card redeemed! $${data.credit_amount.toFixed(2)} credited to your account`,
                    { duration: 5000 }
                );
                setCode("");
                setBalance(data.new_balance);
                // Refresh history
                fetchHistory();
            } else {
                toast.error(data.error || "Failed to redeem gift card");
            }
        } catch (error) {
            toast.error("Error redeeming gift card");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch balance on mount
    useState(() => {
        fetchBalance();
    });

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    🎁 Gift Card Redemption
                </h1>
                <p className="text-gray-600">
                    Redeem your gift card code to add credits to your account
                </p>
            </div>

            {/* Balance Card */}
            {balance !== null && (
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Current Balance</p>
                                <p className="text-3xl font-bold text-purple-600">
                                    ${balance.toFixed(2)}
                                </p>
                            </div>
                            <DollarSign className="w-12 h-12 text-purple-400" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Redemption Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="w-5 h-5" />
                        Redeem Gift Card
                    </CardTitle>
                    <CardDescription>
                        Enter your gift card code below to add credits to your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="code">Gift Card Code</Label>
                        <Input
                            id="code"
                            placeholder="Enter code (e.g., GIFT10)"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === "Enter" && handleRedeem()}
                            className="font-mono text-lg"
                            disabled={loading}
                        />
                    </div>

                    <Button
                        onClick={handleRedeem}
                        disabled={loading || !code.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Redeeming...
                            </>
                        ) : (
                            <>
                                <Gift className="w-4 h-4 mr-2" />
                                Redeem Gift Card
                            </>
                        )}
                    </Button>

                    <div className="text-center">
                        <Button
                            variant="link"
                            onClick={fetchHistory}
                            className="text-purple-600"
                        >
                            <History className="w-4 h-4 mr-2" />
                            View Redemption History
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Redemption History */}
            {showHistory && (
                <Card>
                    <CardHeader>
                        <CardTitle>Redemption History</CardTitle>
                        <CardDescription>
                            Your gift card redemption history
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {redemptions.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                                No gift cards redeemed yet
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {redemptions.map((redemption, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Gift className="w-5 h-5 text-purple-500" />
                                            <div>
                                                <p className="font-mono font-bold">{redemption.code}</p>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(redemption.redeemed_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge className="bg-green-500">
                                            +${redemption.amount.toFixed(2)}
                                        </Badge>
                                    </div>
                                ))}
                                <div className="pt-4 border-t">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">Total Redeemed:</span>
                                        <span className="text-xl font-bold text-purple-600">
                                            ${redemptions.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">ℹ️ How it works</h3>
                    <ul className="space-y-1 text-sm text-gray-700">
                        <li>• Enter your gift card code in the field above</li>
                        <li>• The amount will be instantly credited to your account</li>
                        <li>• Each gift card can only be used once</li>
                        <li>• Your balance can be used for future purchases</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
