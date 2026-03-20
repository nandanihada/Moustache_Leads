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
            console.error('Unauthorized access - clearing stale token');
            // Clear stale auth data to stop infinite 401 loops
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('session_id');
            // Clear cross-subdomain cookie
            document.cookie = 'auth_token=; path=/; domain=.moustacheleads.com; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'auth_user=; path=/; domain=.moustacheleads.com; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'auth_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            // Redirect to login if not already there
            if (!window.location.pathname.includes('/signin') && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
                window.location.href = '/publisher/signin';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
