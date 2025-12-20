import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gift, Sparkles, TrendingUp, History, Loader2 } from 'lucide-react';
import { giftCardUserApi, type RedeemResponse } from '@/services/giftCardApi';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function RedeemGiftCard() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<number>(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<RedeemResponse | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width, height } = useWindowSize();

    // Fetch initial balance
    useEffect(() => {
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        try {
            const response = await giftCardUserApi.getUserBalance();
            if (response.success) {
                setBalance(response.balance);
            }
        } catch (err) {
            console.error('Error fetching balance:', err);
        }
    };

    const handleRedeem = async () => {
        if (!code.trim()) {
            setError('Please enter a gift card code');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(null);

        try {
            const response = await giftCardUserApi.redeemGiftCard(code.trim());

            if (response.success) {
                setSuccess(response);
                setBalance(response.new_balance);
                setCode('');
                setShowConfetti(true);

                // Stop confetti after 5 seconds
                setTimeout(() => setShowConfetti(false), 5000);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to redeem gift card');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRedeem();
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            {/* Confetti Animation */}
            {showConfetti && (
                <Confetti
                    width={width}
                    height={height}
                    recycle={false}
                    numberOfPieces={500}
                    gravity={0.3}
                />
            )}

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                    🎁 Redeem Gift Card
                </h1>
                <p className="text-muted-foreground">
                    Enter your gift card code to instantly add credit to your account
                </p>
            </div>

            {/* Current Balance Card */}
            <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-full">
                                <TrendingUp className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Current Balance</p>
                                <p className="text-3xl font-bold text-purple-600">
                                    ${balance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <Sparkles className="h-12 w-12 text-purple-300" />
                    </div>
                </CardContent>
            </Card>

            {/* Redemption Card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5" />
                        Enter Gift Card Code
                    </CardTitle>
                    <CardDescription>
                        Paste your gift card code below and click redeem
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <Input
                            placeholder="GIFT12345678"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            onKeyPress={handleKeyPress}
                            className="text-lg font-mono"
                            disabled={loading}
                        />
                        <Button
                            onClick={handleRedeem}
                            disabled={loading || !code.trim()}
                            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 min-w-[120px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Redeeming...
                                </>
                            ) : (
                                <>
                                    <Gift className="mr-2 h-4 w-4" />
                                    Redeem
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Success Message with Animation */}
                    {success && (
                        <div className="mt-4 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-green-100 rounded-full">
                                    <Gift className="h-8 w-8 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-green-700 mb-2">
                                        🎉 {success.message}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="bg-white p-3 rounded-lg">
                                            <p className="text-sm text-muted-foreground">Amount Credited</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                +${success.amount.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg">
                                            <p className="text-sm text-muted-foreground">New Balance</p>
                                            <p className="text-2xl font-bold text-purple-600">
                                                ${success.new_balance.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg col-span-2">
                                            <p className="text-sm text-muted-foreground">Your Position</p>
                                            <p className="text-lg font-bold text-blue-600">
                                                #{success.redemption_number} out of {success.max_redemptions} lucky users!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* How it Works */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        How It Works
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="space-y-3">
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                                1
                            </span>
                            <span>Receive a gift card code via email or from admin</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                                2
                            </span>
                            <span>Paste the code in the input field above</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                                3
                            </span>
                            <span>Click "Redeem" and watch your balance increase instantly!</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                                4
                            </span>
                            <span>Note: Each gift card can only be redeemed once per user</span>
                        </li>
                    </ol>
                </CardContent>
            </Card>
        </div>
    );
}
