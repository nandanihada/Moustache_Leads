/**
 * Shared Axios API Instance
 * Centralized axios configuration with authentication and base URL
 */

import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

// Create axios instance with default config
const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized access
            console.error('Unauthorized access - token may be invalid');
            // Optionally redirect to login or clear token
        }
        return Promise.reject(error);
    }
);

export default api;
