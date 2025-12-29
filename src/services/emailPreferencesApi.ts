/**
 * Email Preferences API Service
 * Handles all email notification preference operations
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface EmailPreferences {
  new_offers: boolean;
  offer_updates: boolean;
  system_notifications: boolean;
  marketing_emails: boolean;
  updated_at?: string;
}

export interface PublisherSettings {
  email: string;
  username: string;
  company_name?: string;
  website?: string;
  email_verified: boolean;
  email_preferences: EmailPreferences;
}

class EmailPreferencesService {
  /**
   * Get current user's email notification preferences
   */
  async getEmailPreferences(token: string): Promise<{
    email: string;
    preferences: EmailPreferences;
  }> {
    try {
      const response = await fetch(
        `${API_URL}/api/publisher/settings/email-preferences`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch email preferences');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching email preferences:', error);
      throw error;
    }
  }

  /**
   * Update all email notification preferences
   */
  async updateEmailPreferences(
    token: string,
    preferences: EmailPreferences
  ): Promise<{
    message: string;
    preferences: EmailPreferences;
  }> {
    try {
      const response = await fetch(
        `${API_URL}/api/publisher/settings/email-preferences`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update email preferences');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating email preferences:', error);
      throw error;
    }
  }

  /**
   * Toggle a specific email preference
   */
  async toggleEmailPreference(
    token: string,
    preferenceType: keyof EmailPreferences,
    enabled: boolean
  ): Promise<{
    message: string;
    preference_type: string;
    enabled: boolean;
    preferences: EmailPreferences;
  }> {
    try {
      const response = await fetch(
        `${API_URL}/api/publisher/settings/email-preferences/toggle`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            preference_type: preferenceType,
            enabled,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to toggle email preference');
      }

      return await response.json();
    } catch (error) {
      console.error('Error toggling email preference:', error);
      throw error;
    }
  }

  /**
   * Get all publisher settings including email preferences
   */
  async getPublisherSettings(token: string): Promise<PublisherSettings> {
    try {
      const response = await fetch(
        `${API_URL}/api/publisher/settings`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch publisher settings');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching publisher settings:', error);
      throw error;
    }
  }
}

export const emailPreferencesService = new EmailPreferencesService();
