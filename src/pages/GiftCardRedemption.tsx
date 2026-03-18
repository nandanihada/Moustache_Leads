import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, DollarSign, History, Loader2, Copy, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/services/apiConfig";

interface GiftCardItem {
  _id: string;
  code: string;
  name: string;
  amount: number;
  status: string;
  is_redeemed: boolean;
  remaining_redemptions: number;
  max_redemptions: number;
  expiry_date: string;
}

interface RedemptionRecord {
  code: string;
  amount: number;
  redeemed_at: string;
}

export default function GiftCardRedemption() {
  const { token } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [availableCards, setAvailableCards] = useState<GiftCardItem[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
    fetchAvailableCards();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/publisher/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance ?? 0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const fetchAvailableCards = async () => {
    try {
      setCardsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/publisher/gift-cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableCards(data.gift_cards || []);
      }
    } catch (error) {
      console.error("Error fetching gift cards:", error);
    } finally {
      setCardsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/publisher/gift-cards/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRedemptions(data.history || data.redemptions || []);
        setShowHistory(true);
      } else {
        toast.error("Failed to fetch redemption history");
      }
    } catch (error) {
      toast.error("Error fetching history");
      console.error(error);
    }
  };

  const handleRedeem = async (redeemCode?: string) => {
    const codeToRedeem = (redeemCode || code).trim().toUpperCase();
    if (!codeToRedeem) {
      toast.error("Please enter a gift card code");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/publisher/gift-cards/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: codeToRedeem }),
      });

      const data = await response.json();

      if (response.ok) {
        const credited = data.amount ?? data.credit_amount ?? 0;
        toast.success(
          `🎉 Gift card redeemed! $${credited.toFixed(2)} credited to your account`,
          { duration: 5000 }
        );
        setCode("");
        if (data.new_balance != null) setBalance(data.new_balance);
        fetchAvailableCards();
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

  const copyCode = (cardCode: string) => {
    navigator.clipboard.writeText(cardCode);
    setCopiedCode(cardCode);
    setCode(cardCode);
    toast.success(`Code "${cardCode}" copied and filled in!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const unredeemedCards = availableCards.filter(gc => !gc.is_redeemed && gc.status === 'active');
  const redeemedCards = availableCards.filter(gc => gc.is_redeemed);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
                  ${(balance ?? 0).toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Gift Cards */}
      {!cardsLoading && unredeemedCards.length > 0 && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Sparkles className="w-5 h-5" />
              Available Gift Cards for You
            </CardTitle>
            <CardDescription>
              Click "Redeem" to instantly credit your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {unredeemedCards.map((card) => (
                <div
                  key={card._id}
                  className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{card.name}</p>
                      <p className="text-2xl font-bold text-purple-600">${(card.amount ?? 0).toFixed(2)}</p>
                    </div>
                    <Gift className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-gray-50 border border-dashed border-gray-300">
                    <span className="text-xs text-gray-500 uppercase">Code:</span>
                    <span className="font-mono font-bold text-gray-900 tracking-wider flex-1">{card.code}</span>
                    <button
                      onClick={() => copyCode(card.code)}
                      className="text-gray-400 hover:text-purple-600 transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === card.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={() => handleRedeem(card.code)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    size="sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Gift className="w-4 h-4 mr-1" />}
                    Redeem Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Redemption Card */}
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
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              className="font-mono text-lg"
              disabled={loading}
            />
          </div>
          <Button
            onClick={() => handleRedeem()}
            disabled={loading || !code.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redeeming...</>
            ) : (
              <><Gift className="w-4 h-4 mr-2" />Redeem Gift Card</>
            )}
          </Button>
          <div className="text-center">
            <Button variant="link" onClick={fetchHistory} className="text-purple-600">
              <History className="w-4 h-4 mr-2" />
              View Redemption History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Already Redeemed Cards */}
      {redeemedCards.length > 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-green-700 text-base">Already Redeemed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {redeemedCards.map((card) => (
                <div key={card._id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Gift className="w-4 h-4 text-green-500" />
                    <span className="font-mono text-sm">{card.code}</span>
                    <span className="text-sm text-gray-500">{card.name}</span>
                  </div>
                  <Badge className="bg-green-500">+${(card.amount ?? 0).toFixed(2)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Redemption History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Redemption History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {redemptions.length > 0 ? (
              <div className="space-y-3">
                {redemptions.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Gift className="w-4 h-4 text-purple-500" />
                      <div>
                        <span className="font-mono text-sm">{r.code}</span>
                        <p className="text-xs text-gray-500">
                          {new Date(r.redeemed_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-purple-500">+${(r.amount ?? 0).toFixed(2)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No redemptions yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How it works</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Receive a gift card code from the admin or via email</li>
            <li>Enter the code above or click "Redeem Now" on an available card</li>
            <li>The credit amount is instantly added to your account balance</li>
            <li>Use your balance for payouts or keep earning</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
