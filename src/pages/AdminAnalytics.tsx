import React from 'react';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminAnalytics = () => {
  return (
    <div className="space-y-6">
      <AnalyticsDashboard />
    </div>
  );
};

const AdminAnalyticsWithGuard = () => (
  <AdminPageGuard requiredTab="analytics">
    <AdminAnalytics />
  </AdminPageGuard>
);

export default AdminAnalyticsWithGuard;