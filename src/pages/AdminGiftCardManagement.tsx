import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
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
import { Gift, Plus, Loader2, Users, TrendingUp, Ban, Edit2, X } from 'lucide-react';
import { giftCardAdminApi, type GiftCard, type CreateGiftCardData } from '@/services/giftCardApi';
import { API_BASE_URL } from '@/services/apiConfig';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SimpleUser {
    _id: string;
    username: string;
    email: string;
    name?: string;
}

export default function AdminGiftCardManagement() {
    const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingCard, setEditingCard] = useState<GiftCard | null>(null);
    const [saving, setSaving] = useState(false);

    // User search for targeting
    const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // Form state
    const defaultForm: CreateGiftCardData = {
        name: '',
        description: '',
        amount: 0,
        max_redemptions: 10,
        image_url: '',
        expiry_date: '',
        send_to_all: true,
        excluded_users: [],
        user_ids: [],
        send_email: false,
    };
    const [formData, setFormData] = useState<CreateGiftCardData>({ ...defaultForm });

    // Edit form state
    const [editForm, setEditForm] = useState<Partial<CreateGiftCardData>>({});

    useEffect(() => {
        fetchGiftCards();
    }, []);

    const fetchGiftCards = async () => {
        setLoading(true);
        try {
            const response = await giftCardAdminApi.getAllGiftCards(0, 100);
            if (response.success) setGiftCards(response.gift_cards);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch gift cards');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (allUsers.length > 0) return;
        setUsersLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data.users || []);
            }
        } catch { /* silent */ } finally {
            setUsersLoading(false);
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
            const formattedData = {
                ...formData,
                user_ids: !formData.send_to_all ? selectedUserIds : [],
                expiry_date: formData.expiry_date.includes('Z') ? formData.expiry_date : `${formData.expiry_date}:00Z`,
            };
            const response = await giftCardAdminApi.createGiftCard(formattedData);
            if (response.success) {
                setSuccess(`Gift card created! Code: ${response.gift_card.code}`);
                setShowCreateDialog(false);
                fetchGiftCards();
                setFormData({ ...defaultForm });
                setSelectedUserIds([]);
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
            toast.success('Gift card cancelled');
            fetchGiftCards();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to cancel');
        }
    };

    const openEditDialog = (gc: GiftCard) => {
        setEditingCard(gc);
        setEditForm({
            name: gc.name,
            description: gc.description || '',
            amount: gc.amount,
            max_redemptions: gc.max_redemptions,
            image_url: gc.image_url || '',
            expiry_date: gc.expiry_date ? gc.expiry_date.slice(0, 16) : '',
            send_to_all: gc.send_to_all,
        });
        setSelectedUserIds(gc.user_ids || []);
        setShowEditDialog(true);
        fetchUsers();
    };

    const handleUpdate = async () => {
        if (!editingCard) return;
        setSaving(true);
        try {
            const payload: any = { ...editForm };
            if (!editForm.send_to_all) payload.user_ids = selectedUserIds;
            if (payload.expiry_date && !payload.expiry_date.includes('Z')) {
                payload.expiry_date = `${payload.expiry_date}:00Z`;
            }
            const res = await giftCardAdminApi.updateGiftCard(editingCard._id, payload);
            if (res.success) {
                toast.success('Gift card updated');
                setShowEditDialog(false);
                setEditingCard(null);
                fetchGiftCards();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const filteredUsers = allUsers.filter(u => {
        if (!userSearch) return true;
        const search = userSearch.toLowerCase();
        return (u.username || '').toLowerCase().includes(search) ||
            (u.email || '').toLowerCase().includes(search) ||
            (u.name || '').toLowerCase().includes(search);
    });

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

    // User picker component (reused in create & edit)
    const UserPicker = () => (
        <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
            <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="mb-2"
            />
            {usersLoading ? (
                <div className="text-center py-2 text-sm text-muted-foreground">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-2 text-sm text-muted-foreground">No users found</div>
            ) : (
                filteredUsers.slice(0, 50).map(u => (
                    <label key={u._id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u._id)}
                            onChange={() => toggleUser(u._id)}
                            className="rounded"
                        />
                        <span className="font-medium">{u.username || u.name}</span>
                        <span className="text-muted-foreground text-xs">{u.email}</span>
                    </label>
                ))
            )}
            {selectedUserIds.length > 0 && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                    {selectedUserIds.length} user(s) selected
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                        🎁 Gift Card Management
                    </h1>
                    <p className="text-muted-foreground">Create and manage gift cards for your users</p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={(open) => {
                    setShowCreateDialog(open);
                    if (open) fetchUsers();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700">
                            <Plus className="mr-2 h-4 w-4" /> Create Gift Card
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Gift Card</DialogTitle>
                            <DialogDescription>Fill in the details to create a new gift card</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input id="name" placeholder="Holiday Bonus" value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" placeholder="Special holiday gift for our users"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Amount ($) *</Label>
                                    <Input type="number" placeholder="100" value={formData.amount || ''}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Redemptions *</Label>
                                    <Input type="number" placeholder="10" value={formData.max_redemptions || ''}
                                        onChange={(e) => setFormData({ ...formData, max_redemptions: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Image URL</Label>
                                <Input placeholder="https://example.com/gift-card.jpg" value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Expiry Date *</Label>
                                <Input type="datetime-local" value={formData.expiry_date.replace(':00Z', '')}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                            </div>

                            {/* User Targeting */}
                            <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-r from-purple-50 to-pink-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-base font-semibold">👥 User Targeting</Label>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {formData.send_to_all ? 'Visible to all users' : 'Visible to selected users only'}
                                        </p>
                                    </div>
                                    <Switch checked={!formData.send_to_all}
                                        onCheckedChange={(checked) => setFormData({ ...formData, send_to_all: !checked })} />
                                </div>
                                {!formData.send_to_all && <UserPicker />}
                            </div>

                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="send_email" checked={formData.send_email}
                                    onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })} className="rounded" />
                                <Label htmlFor="send_email" className="cursor-pointer">
                                    {formData.send_to_all ? 'Send email to all users' : 'Send email to selected users'}
                                </Label>
                            </div>

                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                            <Button onClick={handleCreate} disabled={creating}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700">
                                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> :
                                    <><Gift className="mr-2 h-4 w-4" /> Create Gift Card</>}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {success && (
                <Alert className="mb-6 border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Total Gift Cards</p><p className="text-2xl font-bold">{giftCards.length}</p></div>
                    <Gift className="h-8 w-8 text-purple-500" /></div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-600">{giftCards.filter(gc => gc.status === 'active').length}</p></div>
                    <TrendingUp className="h-8 w-8 text-green-500" /></div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Fully Redeemed</p><p className="text-2xl font-bold text-blue-600">{giftCards.filter(gc => gc.status === 'fully_redeemed').length}</p></div>
                    <Users className="h-8 w-8 text-blue-500" /></div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
                    <div><p className="text-sm text-muted-foreground">Total Credited</p><p className="text-2xl font-bold text-purple-600">${giftCards.reduce((sum, gc) => sum + gc.total_credited, 0).toFixed(2)}</p></div>
                    <TrendingUp className="h-8 w-8 text-purple-500" /></div></CardContent></Card>
            </div>

            {/* Gift Cards Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Gift Cards</CardTitle>
                    <CardDescription>Manage and monitor all gift cards</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>
                    ) : giftCards.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No gift cards found. Create your first one!</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Redemptions</TableHead>
                                    <TableHead>Targeting</TableHead>
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
                                        <TableCell className="font-semibold text-green-600">${gc.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <span className="font-semibold">{gc.redemption_count}/{gc.max_redemptions}</span>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                <div className="bg-purple-600 h-2 rounded-full"
                                                    style={{ width: `${(gc.redemption_count / gc.max_redemptions) * 100}%` }} />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {gc.send_to_all ? (
                                                <Badge variant="outline" className="text-xs">All Users</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">{(gc.user_ids || []).length} Users</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(gc.status)}</TableCell>
                                        <TableCell className="text-sm">{format(new Date(gc.expiry_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(gc)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                {gc.status === 'active' && (
                                                    <Button variant="outline" size="sm" onClick={() => handleCancel(gc._id)}>
                                                        <Ban className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Gift Card: {editingCard?.code}</DialogTitle>
                        <DialogDescription>Update gift card details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount ($)</Label>
                                <Input type="number" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Redemptions</Label>
                                <Input type="number" value={editForm.max_redemptions || ''} onChange={(e) => setEditForm({ ...editForm, max_redemptions: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Image URL</Label>
                            <Input value={editForm.image_url || ''} onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date</Label>
                            <Input type="datetime-local" value={(editForm.expiry_date || '').replace(':00Z', '').slice(0, 16)}
                                onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })} />
                        </div>

                        {/* User Targeting */}
                        <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-r from-purple-50 to-pink-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-semibold">👥 User Targeting</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {editForm.send_to_all ? 'Visible to all users' : 'Visible to selected users only'}
                                    </p>
                                </div>
                                <Switch checked={!editForm.send_to_all}
                                    onCheckedChange={(checked) => setEditForm({ ...editForm, send_to_all: !checked })} />
                            </div>
                            {!editForm.send_to_all && <UserPicker />}
                        </div>

                        <Button onClick={handleUpdate} disabled={saving} className="w-full bg-gradient-to-r from-pink-500 to-purple-600">
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
