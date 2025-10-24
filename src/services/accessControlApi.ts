const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Access Control Functions
export const accessControlApi = {
  async requestAccess(offerId: string, reason: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/offers/${offerId}/request-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to request access');
    }

    return response.json();
  },

  async checkAccess(offerId: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/offers/${offerId}/check-access`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check access');
    }

    return response.json();
  },

  async getAccessRequests(offerId: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/admin/offers/${offerId}/access-requests`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get access requests');
    }

    return response.json();
  },

  async approveRequest(offerId: string, requestId: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/admin/offers/${offerId}/access-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to approve request');
    }

    return response.json();
  },

  async rejectRequest(offerId: string, requestId: string, reason: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/admin/offers/${offerId}/access-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to reject request');
    }

    return response.json();
  }
};

// File Upload Functions
export const fileUploadApi = {
  async uploadFile(file: File, offerId?: string, description?: string): Promise<any> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    
    if (offerId) {
      formData.append('offer_id', offerId);
    }
    
    if (description) {
      formData.append('description', description);
    }

    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return response.json();
  },

  async getFileInfo(fileId: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get file info');
    }

    return response.json();
  },

  async deleteFile(fileId: string): Promise<any> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }

    return response.json();
  },

  async getUserFiles(userId: string, offerId?: string): Promise<any> {
    const token = localStorage.getItem('token');
    let url = `${API_BASE_URL}/api/files/user/${userId}`;
    
    if (offerId) {
      url += `?offer_id=${offerId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user files');
    }

    return response.json();
  },

  getFileUrl(fileId: string): string {
    return `${API_BASE_URL}/api/files/${fileId}`;
  }
};
