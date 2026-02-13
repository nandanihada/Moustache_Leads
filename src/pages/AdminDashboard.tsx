import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import AdminOverviewBoxes from '@/components/dashboard/AdminOverviewBoxes';

const AdminDashboard = () => {
  const { isAdminOrSubadmin, user } = useAuth();

  // Redirect non-admin/non-subadmin users
  if (!isAdminOrSubadmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base truncate">
            Welcome back, {user?.username}. Manage your platform from here.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0">
          <Shield className="h-4 w-4" />
          {user?.role === 'admin' ? 'Administrator' : 'Sub-Admin'}
        </div>
      </div>

      {/* Admin Overview Boxes - Real Data */}
      <AdminOverviewBoxes />

      {/* Outlet for nested routes */}
      <Outlet />
    </div>
  );
};

export default AdminDashboard;
