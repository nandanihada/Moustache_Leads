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
    missing_fields?: string[];
    warnings?: string[];
  }>;
  missing_offers?: Array<{
    row: number;
    missing_fields: string[];
    warnings?: string[];
  }>;
  validation_feedback?: {
    summary: string;
    total_issues: number;
    required_fields: Array<{
      field: string;
      description: string;
      required: boolean;
    }>;
    special_network_info: {
      networks: string[];
      description: string;
      requirement: string;
    };
    errors_by_type: {
      missing_fields: Array<{
        row: number;
        missing: string[];
      }>;
      invalid_format: Array<{
        row: number;
        error: string;
      }>;
      invalid_values: Array<{
        row: number;
        error: string;
      }>;
    };
    fix_suggestions: Array<{
      field: string;
      issue: string;
      solution: string;
      example: string;
    }>;
    column_mapping: {
      description: string;
      mappings: Record<string, string[]>;
    };
  };
  creation_errors?: Array<{
    row: number;
    error: string;
  }>;
  can_skip_invalid?: boolean;
  valid_count?: number;
}

export interface BulkUploadOptions {
  approval_type?: string;
  auto_approve_delay?: number;
  require_approval?: boolean;
  default_star_rating?: number;
  default_timer?: number;
  skip_invalid_rows?: boolean;
}

export const bulkOfferApi = {
  /**
   * Upload file (Excel or CSV) for bulk offer creation
   */
  uploadFile: async (file: File, options?: BulkUploadOptions): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options as JSON string
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

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
      if (data.validation_errors || data.validation_feedback || data.missing_offers) {
        console.log('Validation errors found:', data.validation_errors);
        console.log('Missing offers found:', data.missing_offers);
        console.log('Validation feedback:', data.validation_feedback);
        const error: any = new Error(data.message || data.error || 'Validation errors found');
        error.validation_errors = data.validation_errors;
        error.missing_offers = data.missing_offers;
        error.validation_feedback = data.validation_feedback;
        error.error_count = data.error_count;
        error.valid_count = data.valid_count;
        error.missing_count = data.missing_count;
        error.can_skip_invalid = data.can_skip_invalid;
        error.message = data.message || data.error;
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
  uploadFromGoogleSheets: async (url: string, options?: BulkUploadOptions): Promise<BulkUploadResult> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/api/admin/offers/bulk-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url, options }),
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, include them in the error
      if (data.validation_errors || data.validation_feedback || data.missing_offers) {
        console.log('Google Sheets - Validation errors found:', data.validation_errors);
        console.log('Google Sheets - Missing offers found:', data.missing_offers);
        console.log('Google Sheets - Validation feedback:', data.validation_feedback);
        const error: any = new Error(data.message || data.error || 'Validation errors found');
        error.validation_errors = data.validation_errors;
        error.missing_offers = data.missing_offers;
        error.validation_feedback = data.validation_feedback;
        error.error_count = data.error_count;
        error.valid_count = data.valid_count;
        error.missing_count = data.missing_count;
        error.can_skip_invalid = data.can_skip_invalid;
        error.message = data.message || data.error;
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
