import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, UserCog, Trash2, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import subadminService, { User, SubadminPermission, AvailableTab } from '@/services/subadminService';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminSubadminManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [subadmins, setSubadmins] = useState<SubadminPermission[]>([]);
    const [availableTabs, setAvailableTabs] = useState<AvailableTab[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersData, subadminsData, tabsData] = await Promise.all([
                subadminService.getUsers(),
                subadminService.getAllSubadmins(),
                subadminService.getAvailableTabs()
            ]);

            setUsers(usersData.users);
            setSubadmins(subadminsData.subadmins);
            setAvailableTabs(tabsData.tabs);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to load data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUserSelect = (userId: string) => {
        setSelectedUserId(userId);

        // Check if user is already a subadmin
        const existingSubadmin = subadmins.find(s => s.user_id === userId);
        if (existingSubadmin) {
            setSelectedTabs(existingSubadmin.allowed_tabs);
        } else {
            setSelectedTabs([]);
        }
    };

    const handleTabToggle = (tabValue: string) => {
        setSelectedTabs(prev => {
            if (prev.includes(tabValue)) {
                return prev.filter(t => t !== tabValue);
            } else {
                return [...prev, tabValue];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedTabs.length === availableTabs.length) {
            setSelectedTabs([]);
        } else {
            setSelectedTabs(availableTabs.map(t => t.value));
        }
    };

    const handleSave = async () => {
        if (!selectedUserId) {
            toast({
                title: 'Error',
                description: 'Please select a user',
                variant: 'destructive',
            });
            return;
        }

        if (selectedTabs.length === 0) {
            toast({
                title: 'Error',
                description: 'Please select at least one tab permission',
                variant: 'destructive',
            });
            return;
        }

        try {
            setSaving(true);
            await subadminService.createOrUpdateSubadmin(selectedUserId, selectedTabs);

            toast({
                title: 'Success',
                description: 'Subadmin permissions saved successfully',
            });

            // Reload data
            await loadData();

            // Reset form
            setSelectedUserId('');
            setSelectedTabs([]);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to save subadmin',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSubadmin = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this subadmin role? This will revoke all their admin permissions.')) {
            return;
        }

        try {
            await subadminService.removeSubadmin(userId);

            toast({
                title: 'Success',
                description: 'Subadmin role removed successfully',
            });

            // Reload data
            await loadData();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to remove subadmin',
                variant: 'destructive',
            });
        }
    };

    const selectedUser = users.find(u => u._id === selectedUserId);
    const isExistingSubadmin = subadmins.some(s => s.user_id === selectedUserId);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        Subadmin Management
                    </h1>
                    <p className="text-muted-foreground">
                        Manage subadmin users and their tab-level permissions
                    </p>
                </div>
                <Button onClick={loadData} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Create/Update Subadmin */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserCog className="h-5 w-5" />
                        {isExistingSubadmin ? 'Update Subadmin Permissions' : 'Create New Subadmin'}
                    </CardTitle>
                    <CardDescription>
                        Select a user and assign tab-level permissions
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* User Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="user-select">Select User</Label>
                        <Select value={selectedUserId} onValueChange={handleUserSelect}>
                            <SelectTrigger id="user-select">
                                <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users
                                    .filter(u => u.role !== 'admin') // Don't allow changing admin to subadmin
                                    .map(user => (
                                        <SelectItem key={user._id} value={user._id}>
                                            <div className="flex items-center gap-2">
                                                <span>{user.username}</span>
                                                <span className="text-muted-foreground text-sm">({user.email})</span>
                                                {user.role === 'subadmin' && (
                                                    <Badge variant="secondary" className="ml-2">Subadmin</Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        {selectedUser && selectedUser.role === 'admin' && (
                            <div className="flex items-center gap-2 text-amber-600 text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                Cannot change admin user to subadmin
                            </div>
                        )}
                    </div>

                    {/* Tab Permissions */}
                    {selectedUserId && selectedUser?.role !== 'admin' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Tab Permissions</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAll}
                                >
                                    {selectedTabs.length === availableTabs.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
                                {availableTabs.map(tab => (
                                    <div key={tab.value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`tab-${tab.value}`}
                                            checked={selectedTabs.includes(tab.value)}
                                            onCheckedChange={() => handleTabToggle(tab.value)}
                                        />
                                        <Label
                                            htmlFor={`tab-${tab.value}`}
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            {tab.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">{selectedTabs.length}</span>
                                of {availableTabs.length} tabs selected
                            </div>

                            <Button
                                onClick={handleSave}
                                disabled={saving || selectedTabs.length === 0}
                                className="w-full"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? 'Saving...' : isExistingSubadmin ? 'Update Permissions' : 'Create Subadmin'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Existing Subadmins */}
            <Card>
                <CardHeader>
                    <CardTitle>Existing Subadmins ({subadmins.length})</CardTitle>
                    <CardDescription>
                        List of all users with subadmin permissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : subadmins.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No subadmins found. Create one using the form above.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {subadmins.map(subadmin => (
                                <div
                                    key={subadmin.user_id}
                                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold">{subadmin.username}</h3>
                                                <Badge variant="secondary">Subadmin</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{subadmin.email}</p>

                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">Allowed Tabs:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {subadmin.allowed_tabs.map(tab => {
                                                        const tabInfo = availableTabs.find(t => t.value === tab);
                                                        return (
                                                            <Badge key={tab} variant="outline">
                                                                {tabInfo?.label || tab}
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleUserSelect(subadmin.user_id)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleRemoveSubadmin(subadmin.user_id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};



const AdminSubadminManagementWithGuard = () => (
  <AdminPageGuard requiredTab="subadmin-management">
    <AdminSubadminManagement />
  </AdminPageGuard>
);

export default AdminSubadminManagementWithGuard;
