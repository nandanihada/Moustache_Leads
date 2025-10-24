import React, { useState } from 'react';

interface PlacementFormData {
  platformType: 'website' | 'iOS' | 'android';
  offerwallTitle: string;
  currencyName: string;
  exchangeRate: number;
  postbackUrl: string;
  status: 'LIVE' | 'PAUSED' | 'INACTIVE';
}

interface PlacementFormProps {
  onSubmit: (data: PlacementFormData) => Promise<void>;
  initialData?: Partial<PlacementFormData>;
  isEditing?: boolean;
}

const PlacementForm: React.FC<PlacementFormProps> = ({
  onSubmit,
  initialData = {},
  isEditing = false
}) => {
  const [formData, setFormData] = useState<PlacementFormData>({
    platformType: initialData.platformType || 'website',
    offerwallTitle: initialData.offerwallTitle || '',
    currencyName: initialData.currencyName || '',
    exchangeRate: initialData.exchangeRate || 1,
    postbackUrl: initialData.postbackUrl || '',
    status: initialData.status || 'LIVE'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<PlacementFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<PlacementFormData> = {};

    if (!formData.offerwallTitle.trim()) {
      newErrors.offerwallTitle = 'Offerwall title is required';
    }

    if (!formData.currencyName.trim()) {
      newErrors.currencyName = 'Currency name is required';
    }

    if (formData.exchangeRate <= 0) {
      newErrors.exchangeRate = 'Exchange rate must be greater than 0';
    }

    if (!formData.postbackUrl.trim()) {
      newErrors.postbackUrl = 'Postback URL is required';
    } else {
      try {
        new URL(formData.postbackUrl);
      } catch {
        newErrors.postbackUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PlacementFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Placement' : 'Create New Placement'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Platform Type
          </label>
          <select
            value={formData.platformType}
            onChange={(e) => handleInputChange('platformType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="website">Website</option>
            <option value="iOS">iOS</option>
            <option value="android">Android</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offerwall Title
          </label>
          <input
            type="text"
            value={formData.offerwallTitle}
            onChange={(e) => handleInputChange('offerwallTitle', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.offerwallTitle ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter offerwall title"
          />
          {errors.offerwallTitle && (
            <p className="mt-1 text-sm text-red-600">{errors.offerwallTitle}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency Name
          </label>
          <input
            type="text"
            value={formData.currencyName}
            onChange={(e) => handleInputChange('currencyName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.currencyName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Coins, Points, Gems"
          />
          {errors.currencyName && (
            <p className="mt-1 text-sm text-red-600">{errors.currencyName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exchange Rate
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.exchangeRate}
            onChange={(e) => handleInputChange('exchangeRate', parseFloat(e.target.value))}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.exchangeRate ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="1.00"
          />
          {errors.exchangeRate && (
            <p className="mt-1 text-sm text-red-600">{errors.exchangeRate}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Postback URL
          </label>
          <input
            type="url"
            value={formData.postbackUrl}
            onChange={(e) => handleInputChange('postbackUrl', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.postbackUrl ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="https://your-domain.com/postback"
          />
          {errors.postbackUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.postbackUrl}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="LIVE">Live</option>
            <option value="PAUSED">Paused</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEditing ? 'Update Placement' : 'Create Placement'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlacementForm;
