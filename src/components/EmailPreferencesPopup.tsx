/**
 * Email Preferences Popup Component
 * Shown after successful registration to let users choose email notification preferences
 */

import React, { useState } from 'react';
import { Mail, Bell, Zap, Gift, X } from 'lucide-react';
import { emailPreferencesService, EmailPreferences } from '@/services/emailPreferencesApi';

interface EmailPreferencesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  username: string;
}

export default function EmailPreferencesPopup({
  isOpen,
  onClose,
  token,
  username,
}: EmailPreferencesPopupProps) {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    new_offers: true,
    offer_updates: true,
    system_notifications: true,
    marketing_emails: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      await emailPreferencesService.updateEmailPreferences(token, preferences);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to save preferences. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Email Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="mb-4 flex justify-center">
                <div className="bg-green-100 rounded-full p-3">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Preferences Saved!
              </h3>
              <p className="text-gray-600">
                Your email preferences have been saved successfully.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 mb-6">
                Hi <span className="font-semibold">{username}</span>! Choose which emails you'd like to receive:
              </p>

              {/* Preference Options */}
              <div className="space-y-4 mb-6">
                {/* New Offers */}
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={preferences.new_offers}
                    onChange={() => handleToggle('new_offers')}
                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-gray-900">New Offers</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Get notified when new offers are added to the platform
                    </p>
                  </div>
                </label>

                {/* Offer Updates */}
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={preferences.offer_updates}
                    onChange={() => handleToggle('offer_updates')}
                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-600" />
                      <span className="font-semibold text-gray-900">Offer Updates</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Get notified about promo codes, payouts, and other offer changes
                    </p>
                  </div>
                </label>

                {/* System Notifications */}
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={preferences.system_notifications}
                    onChange={() => handleToggle('system_notifications')}
                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">System Notifications</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Get important system and account notifications
                    </p>
                  </div>
                </label>

                {/* Marketing Emails */}
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={preferences.marketing_emails}
                    onChange={() => handleToggle('marketing_emails')}
                    className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-pink-600" />
                      <span className="font-semibold text-gray-900">Marketing Emails</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Receive promotional content and special offers
                    </p>
                  </div>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 font-medium transition"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>

              {/* Info Text */}
              <p className="text-xs text-gray-500 text-center mt-4">
                You can change these preferences anytime in your settings
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
