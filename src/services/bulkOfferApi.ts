import { API_BASE_URL } from './apiConfig';

export interface BulkUploadResult {
  success: boolean;
  message: string;
  created_count: number;
  error_count?: number;
  created_offer_ids: string[];
  validation_errors?: Array<{
    row: number;
    errors: string[];
  }>;
  creation_errors?: Array<{
    row: number;
    error: string;
  }>;
}

export const bulkOfferApi = {
  /**
   * Upload file (Excel or CSV) for bulk offer creation
   */
  uploadFile: async (file: File): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/api/admin/offers/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    // Debug logging
    console.log('Response status:', response.status);
    console.log('Response data:', data);

    if (!response.ok) {
      // If there are validation errors, include them in the error
      if (data.validation_errors) {
        console.log('Validation errors found:', data.validation_errors);
        const error: any = new Error(data.error || 'Validation errors found');
        error.validation_errors = data.validation_errors;
        error.error_count = data.error_count;
        error.valid_count = data.valid_count;
        throw error;
      }
      // If there are creation errors, log them
      if (data.creation_errors) {
        console.log('Creation errors found:', data.creation_errors);
      }
      throw new Error(data.error || 'Failed to upload file');
    }

    return data;
  },

  /**
   * Upload offers from Google Sheets URL
   */
  uploadFromGoogleSheets: async (url: string): Promise<BulkUploadResult> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/api/admin/offers/bulk-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, include them in the error
      if (data.validation_errors) {
        const error: any = new Error(data.error || 'Validation errors found');
        error.validation_errors = data.validation_errors;
        error.error_count = data.error_count;
        error.valid_count = data.valid_count;
        throw error;
      }
      throw new Error(data.error || 'Failed to upload from Google Sheets');
    }

    return data;
  },

  /**
   * Download template CSV file
   */
  downloadTemplate: async (): Promise<void> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/api/admin/offers/bulk-upload/template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    // Create blob from response
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'bulk_offer_template.csv';
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};
