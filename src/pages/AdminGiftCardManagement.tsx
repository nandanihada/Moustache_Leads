import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Gift, Plus, Loader2, Calendar, Users, TrendingUp, Ban } from 'lucide-react';
import { giftCardAdminApi, type GiftCard, type CreateGiftCardData } from '@/services/giftCardApi';
import { format } from 'date-fns';

export default function AdminGiftCardManagement() {
    const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // Form state
    const [formData, setFormData] = useState<CreateGiftCardData>({
        name: '',
        description: '',
        amount: 0,
        max_redemptions: 10,
        image_url: '',
        expiry_date: '',
        send_to_all: true,
        excluded_users: [],
        send_email: false,
    });

    useEffect(() => {
        fetchGiftCards();
    }, []);

    const fetchGiftCards = async () => {
        setLoading(true);
        try {
            const response = await giftCardAdminApi.getAllGiftCards(0, 100);
            if (response.success) {
                setGiftCards(response.gift_cards);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch gift cards');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.amount || !formData.max_redemptions || !formData.expiry_date) {
            setError('Please fill in all required fields');
            return;
        }

        setCreating(true);
        setError('');
        setSuccess('');

        try {
            // Format the date properly for the API
            const formattedData = {
                ...formData,
                expiry_date: formData.expiry_date.includes('Z')
                    ? formData.expiry_date
                    : `${formData.expiry_date}:00Z`
            };

            const response = await giftCardAdminApi.createGiftCard(formattedData);
            if (response.success) {
                setSuccess(`Gift card created successfully! Code: ${response.gift_card.code}`);
                setShowCreateDialog(false);
                fetchGiftCards();
                // Reset form
                setFormData({
                    name: '',
                    description: '',
                    amount: 0,
                    max_redemptions: 10,
                    image_url: '',
                    expiry_date: '',
                    send_to_all: true,
                    excluded_users: [],
                    send_email: false,
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create gift card');
        } finally {
            setCreating(false);
        }
    };

    const handleCancel = async (giftCardId: string) => {
        if (!confirm('Are you sure you want to cancel this gift card?')) return;

        try {
            await giftCardAdminApi.cancelGiftCard(giftCardId);
            setSuccess('Gift card cancelled successfully');
            fetchGiftCards();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to cancel gift card');
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; label: string }> = {
            active: { variant: 'default', label: 'Active' },
            fully_redeemed: { variant: 'secondary', label: 'Fully Redeemed' },
            expired: { variant: 'destructive', label: 'Expired' },
            cancelled: { variant: 'outline', label: 'Cancelled' },
        };
        const config = variants[status] || variants.active;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                        🎁 Gift Card Management
                    </h1>
                    <p className="text-muted-foreground">
                        Create and manage gift cards for your users
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Gift Card
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Gift Card</DialogTitle>
                            <DialogDescription>
                                Fill in the details to create a new gift card
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="Holiday Bonus"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Special holiday gift for our users"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount ($) *</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="100"
                                        value={formData.amount || ''}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="max_redemptions">Max Redemptions *</Label>
                                    <Input
                                        id="max_redemptions"
                                        type="number"
                                        placeholder="10"
                                        value={formData.max_redemptions || ''}
                                        onChange={(e) => setFormData({ ...formData, max_redemptions: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="image_url">Image URL</Label>
                                <Input
                                    id="image_url"
                                    placeholder="https://example.com/gift-card.jpg"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="expiry_date">Expiry Date *</Label>
                                <Input
                                    id="expiry_date"
                                    type="datetime-local"
                                    value={formData.expiry_date.replace(':00Z', '')}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Gift card will expire at this date and time
                                </p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="send_email"
                                    checked={formData.send_email}
                                    onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                                    className="rounded"
                                />
                                <Label htmlFor="send_email" className="cursor-pointer">
                                    Send email to all users immediately
                                </Label>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                onClick={handleCreate}
                                disabled={creating}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Gift className="mr-2 h-4 w-4" />
                                        Create Gift Card
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Success Message */}
            {success && (
                <Alert className="mb-6 border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Gift Cards</p>
                                <p className="text-2xl font-bold">{giftCards.length}</p>
                            </div>
                            <Gift className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Active</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {giftCards.filter((gc) => gc.status === 'active').length}
                                </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Fully Redeemed</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {giftCards.filter((gc) => gc.status === 'fully_redeemed').length}
                                </p>
                            </div>
                            <Users className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Credited</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    ${giftCards.reduce((sum, gc) => sum + gc.total_credited, 0).toFixed(2)}
                                </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gift Cards Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Gift Cards</CardTitle>
                    <CardDescription>
                        Manage and monitor all gift cards
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                        </div>
                    ) : giftCards.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No gift cards found. Create your first one!
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Redemptions</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {giftCards.map((gc) => (
                                    <TableRow key={gc._id}>
                                        <TableCell className="font-mono font-bold">{gc.code}</TableCell>
                                        <TableCell>{gc.name}</TableCell>
                                        <TableCell className="font-semibold text-green-600">
                                            ${gc.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-semibold">
                                                {gc.redemption_count}/{gc.max_redemptions}
                                            </span>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                <div
                                                    className="bg-purple-600 h-2 rounded-full"
                                                    style={{
                                                        width: `${(gc.redemption_count / gc.max_redemptions) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(gc.status)}</TableCell>
                                        <TableCell className="text-sm">
                                            {format(new Date(gc.expiry_date), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            {gc.status === 'active' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCancel(gc._id)}
                                                >
                                                    <Ban className="h-4 w-4 mr-1" />
                                                    Cancel
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
