import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, CheckCircle, AlertCircle, TrendingUp, Wallet, Calendar, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AvailableCode {
  _id: string;
  code: string;
  name: string;
  description: string;
  bonus_type: "percentage" | "fixed";
  bonus_amount: number;
  status: "available" | "already_applied" | "expired";
  end_date: string;
}

interface ActiveCode {
  _id: string;
  code: string;
  bonus_type: "percentage" | "fixed";
  bonus_amount: number;
  total_bonus_earned: number;
  conversions_count: number;
  expires_at: string;
  is_active: boolean;
}

interface BonusEarning {
  _id: string;
  code: string;
  bonus_amount: number;
  status: "pending" | "credited" | "reversed";
  created_at: string;
}

export default function PublisherPromoCodeManagement() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("available");
  const [availableCodes, setAvailableCodes] = useState<AvailableCode[]>([]);
  const [activeCodes, setActiveCodes] = useState<ActiveCode[]>([]);
  const [bonusEarnings, setBonusEarnings] = useState<BonusEarning[]>([]);
  const [bonusSummary, setBonusSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [codeToApply, setCodeToApply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSelectOffersDialog, setShowSelectOffersDialog] = useState(false);
  const [selectedCodeForOffers, setSelectedCodeForOffers] = useState<AvailableCode | null>(null);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [usedCodes, setUsedCodes] = useState<string[]>([]);

  // Fetch data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAvailableCodes(),
        fetchActiveCodes(),
        fetchBonusSummary(),
        fetchBonusEarnings(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCodes = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/promo-codes/available`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableCodes(data.promo_codes || []);
      }
    } catch (error) {
      console.error("Error fetching available codes:", error);
    }
  };

  const fetchActiveCodes = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/promo-codes/active`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setActiveCodes(data.codes || []);
      }
    } catch (error) {
      console.error("Error fetching active codes:", error);
    }
  };

  const fetchBonusSummary = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/bonus/summary`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBonusSummary(data);
      }
    } catch (error) {
      console.error("Error fetching bonus summary:", error);
    }
  };

  const fetchBonusEarnings = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/bonus/earnings?limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBonusEarnings(data.bonus_earnings || []);
      }
    } catch (error) {
      console.error("Error fetching bonus earnings:", error);
    }
  };

  const fetchAvailableOffers = async () => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/offers/available`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableOffers(data.offers || []);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
    }
  };

  const handleApplyCodeToOffers = async (code: AvailableCode) => {
    // Check if code already used
    if (usedCodes.includes(code._id)) {
      toast.error("This promo code has already been used");
      return;
    }

    setSelectedCodeForOffers(code);
    setSelectedOffers([]);
    await fetchAvailableOffers();
    setShowSelectOffersDialog(true);
  };

  const handleConfirmApplyToOffers = async () => {
    if (!selectedCodeForOffers) {
      toast.error("No code selected");
      return;
    }

    if (selectedOffers.length === 0) {
      toast.error("Please select at least one offer");
      return;
    }

    try {
      setApplyingCode(selectedCodeForOffers._id);

      // Apply code to each selected offer
      const { API_BASE_URL } = await import('../services/apiConfig');
      const results = await Promise.all(
        selectedOffers.map(offerId =>
          fetch(
            `${API_BASE_URL}/api/publisher/offers/${offerId}/apply-promo-code`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ promo_code_id: selectedCodeForOffers._id }),
            }
          )
        )
      );

      const allSuccess = results.every(r => r.ok);
      if (allSuccess) {
        toast.success(
          `Code ${selectedCodeForOffers.code} applied successfully!`
        );

        // Mark code as used (one-time use)
        setUsedCodes([...usedCodes, selectedCodeForOffers._id]);

        setShowSelectOffersDialog(false);
        setSelectedCodeForOffers(null);
        setSelectedOffers([]);
        fetchAllData();
      } else {
        toast.error("Failed to apply code to some offers");
      }
    } catch (error) {
      toast.error("Error applying code");
      console.error(error);
    } finally {
      setApplyingCode(null);
    }
  };

  const handleRemoveCode = async (codeId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const response = await fetch(
        `${API_BASE_URL}/api/publisher/promo-codes/${codeId}/remove`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Promo code removed");
        fetchAllData();
      } else {
        toast.error("Failed to remove code");
      }
    } catch (error) {
      toast.error("Error removing code");
      console.error(error);
    }
  };

  const filteredAvailableCodes = availableCodes.filter((code) =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-green-500">Available</Badge>;
      case "already_applied":
        return <Badge className="bg-blue-500">Applied</Badge>;
      case "expired":
        return <Badge className="bg-red-500">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getEarningStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "credited":
        return <Badge className="bg-green-500">Credited</Badge>;
      case "reversed":
        return <Badge className="bg-red-500">Reversed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Promo Codes & Bonuses</h1>
          <p className="text-gray-600 mt-1">Manage your promo codes and track bonus earnings</p>
        </div>
        {/* Select Offers Dialog */}
        <Dialog open={showSelectOffersDialog} onOpenChange={setShowSelectOffersDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Apply Promo Code to Offers</DialogTitle>
              <DialogDescription>
                {selectedCodeForOffers && (
                  <>
                    Code: <span className="font-mono font-bold">{selectedCodeForOffers.code}</span> -
                    Bonus: +{selectedCodeForOffers.bonus_amount}{selectedCodeForOffers.bonus_type === "percentage" ? "%" : ""}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-600">Select ONE offer to apply this code to:</p>
              {availableOffers.map((offer) => (
                <div key={offer.offer_id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    id={offer.offer_id}
                    name="offer-selection"
                    checked={selectedOffers.includes(offer.offer_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOffers([offer.offer_id]);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <label htmlFor={offer.offer_id} className="flex-1 cursor-pointer">
                    <p className="font-medium">{offer.name}</p>
                    <p className="text-sm text-gray-600">${offer.payout} - {offer.offer_id}</p>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSelectOffersDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmApplyToOffers} disabled={selectedOffers.length === 0 || applyingCode !== null}>
                {applyingCode ? "Applying..." : "Apply Code"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bonus Summary Cards */}
      {bonusSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Earned</p>
                  <p className="text-2xl font-bold">
                    ${bonusSummary.total_earned?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">
                    ${bonusSummary.pending?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Credited</p>
                  <p className="text-2xl font-bold">
                    ${bonusSummary.credited?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Balance</p>
                  <p className="text-2xl font-bold">
                    ${bonusSummary.current_balance?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="available">Available Codes</TabsTrigger>
          <TabsTrigger value="active">My Active Codes</TabsTrigger>
          <TabsTrigger value="earnings">Bonus Earnings</TabsTrigger>
        </TabsList>

        {/* Available Codes Tab */}
        <TabsContent value="available" className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Available Promo Codes ({filteredAvailableCodes.length})</CardTitle>
              <CardDescription>
                Browse and apply available promotional codes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredAvailableCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No available codes found
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAvailableCodes.map((code) => (
                    <div
                      key={code._id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-bold text-lg">{code.code}</p>
                            <p className="text-sm text-gray-600">{code.name}</p>
                          </div>
                          {code.description && (
                            <p className="text-sm text-gray-500">{code.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">
                            {code.bonus_type === "percentage"
                              ? `${code.bonus_amount}%`
                              : `$${code.bonus_amount}`}
                          </p>
                          <p className="text-xs text-gray-600">
                            Expires {new Date(code.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        {(code as any).already_applied ? (
                          <Badge className="bg-blue-500">Already Applied</Badge>
                        ) : usedCodes.includes(code._id) ? (
                          <Badge className="bg-gray-500">Used</Badge>
                        ) : (
                          getStatusBadge(code.status)
                        )}
                        {!(code as any).already_applied && !usedCodes.includes(code._id) && (code.status === "available" || code.status === "active") && (
                          <Button
                            size="sm"
                            onClick={() => handleApplyCodeToOffers(code)}
                          >
                            Apply to Offers
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Codes Tab */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Active Codes ({activeCodes.length})</CardTitle>
              <CardDescription>
                Codes you have applied to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : activeCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  You haven't applied any codes yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Bonus</TableHead>
                        <TableHead>Conversions</TableHead>
                        <TableHead>Total Earned</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeCodes.map((code) => (
                        <TableRow key={code._id}>
                          <TableCell className="font-mono font-bold">{code.code}</TableCell>
                          <TableCell>
                            {code.bonus_type === "percentage"
                              ? `${code.bonus_amount}%`
                              : `$${code.bonus_amount}`}
                          </TableCell>
                          <TableCell>{code.conversions_count}</TableCell>
                          <TableCell>${code.total_bonus_earned.toFixed(2)}</TableCell>
                          <TableCell>
                            {new Date(code.expires_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveCode(code._id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonus Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bonus Earnings ({bonusEarnings.length})</CardTitle>
              <CardDescription>
                Track your bonus earnings from applied promo codes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : bonusEarnings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No bonus earnings yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Earned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusEarnings.map((earning) => (
                        <TableRow key={earning._id}>
                          <TableCell className="font-mono font-bold">
                            {earning.code}
                          </TableCell>
                          <TableCell>${earning.bonus_amount.toFixed(2)}</TableCell>
                          <TableCell>{getEarningStatusBadge(earning.status)}</TableCell>
                          <TableCell>
                            {new Date(earning.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
