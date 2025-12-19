import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import subadminService from '@/services/subadminService';
import { Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminPageGuardProps {
    children: React.ReactNode;
    requiredTab: string;
}

export const AdminPageGuard: React.FC<AdminPageGuardProps> = ({ children, requiredTab }) => {
    const { user, isAdmin } = useAuth();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkPermission = async () => {
            // Admins always have permission
            if (user?.role === 'admin') {
                setHasPermission(true);
                setLoading(false);
                return;
            }

            // Subadmins need to check their permissions
            if (user?.role === 'subadmin') {
                try {
                    const permissions = await subadminService.getMyPermissions();
                    const allowed = permissions.allowed_tabs.includes(requiredTab);
                    setHasPermission(allowed);
                } catch (error) {
                    console.error('Error checking permissions:', error);
                    setHasPermission(false);
                }
                setLoading(false);
                return;
            }

            // Non-admin/non-subadmin users should be redirected
            setHasPermission(false);
            setLoading(false);
        };

        checkPermission();
    }, [user, requiredTab]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Redirect non-admin/non-subadmin users
    if (user?.role !== 'admin' && user?.role !== 'subadmin') {
        return <Navigate to="/dashboard" replace />;
    }

    // Show forbidden message for subadmins without permission
    if (!hasPermission) {
        return (
            <div className="flex items-center justify-center min-h-[400px] p-6">
                <Card className="max-w-md w-full border-destructive/50">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <CardTitle className="text-2xl">Access Forbidden</CardTitle>
                        <CardDescription className="text-base">
                            You don't have permission to access this page
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            This page requires the <span className="font-semibold text-foreground">"{requiredTab}"</span> permission.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Please contact your administrator if you believe you should have access to this resource.
                        </p>
                        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-4 w-4" />
                            <span>Logged in as: {user?.username} (Subadmin)</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // User has permission, render the page
    return <>{children}</>;
};
