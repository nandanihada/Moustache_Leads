/**
 * Publisher Email Settings Component
 * Allows publishers to manage their email notification preferences
 */

import React, { useState, useEffect } from 'react';
import { Mail, Bell, Zap, Gift, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { emailPreferencesService, EmailPreferences } from '@/services/emailPreferencesApi';

interface PublisherEmailSettingsProps {
  token: string;
}

export default function PublisherEmailSettings({ token }: PublisherEmailSettingsProps) {
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetchPreferences();
  }, [token]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await emailPreferencesService.getEmailPreferences(token);
      setPreferences(data.preferences);
      if (data.preferences.updated_at) {
        setLastUpdated(new Date(data.preferences.updated_at).toLocaleDateString());
      }
    } catch (err) {
      setError('Failed to load email preferences');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof EmailPreferences) => {
    if (!preferences) return;

    const newValue = !preferences[key];
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await emailPreferencesService.toggleEmailPreference(
        token,
        key,
        newValue
      );

      setPreferences(result.preferences);
      setSuccess(`${key.replace(/_/g, ' ')} has been ${newValue ? 'enabled' : 'disabled'}`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update preference');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">Failed to load email preferences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="w-6 h-6 text-indigo-600" />
          Email Notification Preferences
        </h2>
        <p className="text-gray-600 mt-2">
          Manage which emails you'd like to receive from MustacheLeads
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Preference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* New Offers */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Gift className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New Offers</h3>
                <p className="text-sm text-gray-600">Get notified about new offers</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('new_offers')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                preferences.new_offers ? 'bg-indigo-600' : 'bg-gray-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.new_offers ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {preferences.new_offers ? '✓ Enabled' : '✗ Disabled'}
          </p>
        </div>

        {/* Offer Updates */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Offer Updates</h3>
                <p className="text-sm text-gray-600">Promo codes, payouts, changes</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('offer_updates')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                preferences.offer_updates ? 'bg-indigo-600' : 'bg-gray-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.offer_updates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {preferences.offer_updates ? '✓ Enabled' : '✗ Disabled'}
          </p>
        </div>

        {/* System Notifications */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">System Notifications</h3>
                <p className="text-sm text-gray-600">Important account updates</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('system_notifications')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                preferences.system_notifications ? 'bg-indigo-600' : 'bg-gray-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.system_notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {preferences.system_notifications ? '✓ Enabled' : '✗ Disabled'}
          </p>
        </div>

        {/* Marketing Emails */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-pink-100 p-2 rounded-lg">
                <Mail className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Marketing Emails</h3>
                <p className="text-sm text-gray-600">Promotions and special offers</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('marketing_emails')}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                preferences.marketing_emails ? 'bg-indigo-600' : 'bg-gray-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.marketing_emails ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {preferences.marketing_emails ? '✓ Enabled' : '✗ Disabled'}
          </p>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            Last updated: <span className="font-semibold">{lastUpdated}</span>
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tip</h4>
        <p className="text-sm text-blue-800">
          We recommend keeping at least "New Offers" and "Offer Updates" enabled to stay informed about the latest opportunities and changes.
        </p>
      </div>
    </div>
  );
}
